// backend/routes/hub.js
//
// Team Hub — internal communication + employee self-service: direct messages,
// group channels, announcements, task-linked comments, file/voice sharing,
// and HR forms (leave/advance/expense/complaint/suggestion/...) submitted
// straight from chat. New, standalone feature: only touches its own seven new
// hub_* tables. Mounted at /api/hub in server.js (two added lines, nothing
// else touched).
//
// Adapted from the original spec (CommonJS, generic schema) to this codebase's
// real conventions: ESM, db.pgAll/pgGet/getClient(), authMiddleware,
// req.user.id / req.user.active_company_id (no user_id/company_id on
// req.user), COALESCE(nickname, username) for a display name (users has no
// `name` column), and parameterized filters instead of the spec's string-
// interpolated `type` filter (SQL-injection risk in the original — fixed here
// with a real bound parameter). Frontend uses apiFetch (which already attaches
// the bearer token) rather than manual localStorage/fetch as the spec assumed.

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

const UPLOAD_DIR = "./uploads/hub";
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => cb(null, `hub_${Date.now()}_${Math.round(Math.random() * 1e6)}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

// ── POST /api/hub/upload — attach a file/image/document/voice note ─────────
router.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
  if (!req.file) return res.json({ success: false, error: "No file received" });
  res.json({
    success: true,
    file_url: `/uploads/hub/${req.file.filename}`,
    file_name: req.file.originalname,
    file_size: req.file.size,
    file_type: req.file.mimetype,
  });
});

// ── GET /api/hub/overview — dashboard overview for the logged-in user ──────
router.get("/overview", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.active_company_id;

    const [channels, unread, forms, announcements] = await Promise.all([
      db.pgAll(
        `SELECT hc.*,
            COUNT(hm.id) FILTER (
              WHERE hm.created_at > COALESCE(hcm.last_seen_at, '2000-01-01')
                AND hm.sender_id != $1 AND hm.is_deleted = false
            ) AS unread_count
         FROM hub_channel_members hcm
         JOIN hub_channels hc ON hc.id = hcm.channel_id
         LEFT JOIN hub_messages hm ON hm.channel_id = hc.id
         WHERE hcm.user_id = $1 AND hcm.is_active = true AND hc.is_active = true
         GROUP BY hc.id, hcm.last_seen_at
         ORDER BY hc.last_message_at DESC NULLS LAST`,
        [userId]
      ),
      db.pgGet(`SELECT COUNT(*) AS total FROM hub_notifications WHERE user_id = $1 AND is_read = false`, [userId]),
      db.pgAll(
        `SELECT hf.*, COALESCE(u.nickname, u.username) AS responded_by_name
         FROM hub_forms hf
         LEFT JOIN users u ON u.id = hf.responded_by
         WHERE hf.submitted_by = $1 AND hf.company_id = $2
         ORDER BY hf.created_at DESC LIMIT 10`,
        [userId, companyId]
      ),
      db.pgAll(
        `SELECT hm.*, COALESCE(u.nickname, u.username) AS sender_name
         FROM hub_messages hm
         JOIN hub_channels hc ON hc.id = hm.channel_id
         JOIN users u ON u.id = hm.sender_id
         WHERE hc.channel_type = 'announcement' AND hc.company_id = $1 AND hm.is_deleted = false
         ORDER BY hm.created_at DESC LIMIT 5`,
        [companyId]
      ),
    ]);

    res.json({
      channels,
      unread_count: parseInt(unread?.total || 0),
      my_forms: forms,
      announcements,
    });
  } catch (e) {
    console.error("[hub/overview]", e.message);
    res.json({ channels: [], unread_count: 0, my_forms: [], announcements: [] });
  }
});

// ── GET /api/hub/channels — every channel the current user belongs to ──────
router.get("/channels", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query;

    const result = await db.pgAll(
      `SELECT hc.*,
          COUNT(DISTINCT hcm2.user_id) AS member_count,
          COUNT(hm.id) FILTER (
            WHERE hm.created_at > COALESCE(hcm.last_seen_at, '2000-01-01')
              AND hm.sender_id != $1 AND hm.is_deleted = false
          ) AS unread_count,
          CASE WHEN hc.channel_type = 'direct' THEN (
            SELECT COALESCE(u.nickname, u.username) FROM hub_channel_members hcm3
            JOIN users u ON u.id = hcm3.user_id
            WHERE hcm3.channel_id = hc.id AND hcm3.user_id != $1 LIMIT 1
          ) ELSE hc.name END AS display_name
       FROM hub_channel_members hcm
       JOIN hub_channels hc ON hc.id = hcm.channel_id
       LEFT JOIN hub_channel_members hcm2 ON hcm2.channel_id = hc.id AND hcm2.is_active = true
       LEFT JOIN hub_messages hm ON hm.channel_id = hc.id
       WHERE hcm.user_id = $1 AND hcm.is_active = true AND hc.is_active = true
         AND ($2::text IS NULL OR hc.channel_type = $2)
       GROUP BY hc.id, hcm.last_seen_at
       ORDER BY hc.last_message_at DESC NULLS LAST`,
      [userId, type || null]
    );

    res.json(result);
  } catch (e) {
    console.error("[hub/channels list]", e.message);
    res.json([]);
  }
});

// ── POST /api/hub/channels — create a group/announcement channel or start a DM ─
router.post("/channels", authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const {
      channel_type, name, description, member_ids,
      task_reference_type, task_reference_id, task_reference_number,
      on_behalf_of_user_id,
    } = req.body;

    const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";
    // Admin entering a paper form for an employee without app access — the DM
    // is created as that employee, not the admin, so it lands correctly under
    // their own identity. Only admins may use this; everyone else is
    // byte-identical to before (on_behalf_of_user_id is simply absent).
    const userId = (on_behalf_of_user_id && isAdmin) ? on_behalf_of_user_id : req.user.id;
    const companyId = req.user.active_company_id;

    if ((channel_type === "group" || channel_type === "announcement") && !isAdmin) {
      throw new Error("Only admins can create group or announcement channels");
    }

    if (channel_type === "direct") {
      const otherId = member_ids?.[0];
      if (!otherId) throw new Error("Select a person to message");

      const existing = await client.query(
        `SELECT hc.id FROM hub_channels hc
         JOIN hub_channel_members hcm1 ON hcm1.channel_id = hc.id AND hcm1.user_id = $1
         JOIN hub_channel_members hcm2 ON hcm2.channel_id = hc.id AND hcm2.user_id = $2
         WHERE hc.channel_type = 'direct' AND hc.company_id = $3
         LIMIT 1`,
        [userId, otherId, companyId]
      );
      if (existing.rows[0]) {
        await client.query("COMMIT");
        return res.json({ success: true, channel_id: existing.rows[0].id, existing: true });
      }
    }

    const channelRes = await client.query(
      `INSERT INTO hub_channels (
          company_id, channel_type, name, description, created_by,
          task_reference_type, task_reference_id, task_reference_number
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        companyId, channel_type, name || null, description || null, userId,
        task_reference_type || null, task_reference_id || null, task_reference_number || null,
      ]
    );
    const channel = channelRes.rows[0];

    const allMembers = [...new Set([userId, ...(member_ids || [])])];
    for (const memberId of allMembers) {
      await client.query(
        `INSERT INTO hub_channel_members (channel_id, user_id, role)
         VALUES ($1,$2,$3) ON CONFLICT (channel_id, user_id) DO NOTHING`,
        [channel.id, memberId, memberId === userId ? "admin" : "member"]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, channel_id: channel.id, channel });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[hub/channels create]", e.message);
    res.json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// ── GET /api/hub/channels/:id/messages — message history (paged, newest-first→reversed) ─
router.get("/channels/:id/messages", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const channelId = req.params.id;
    const { before, limit } = req.query;
    const msgLimit = parseInt(limit || 50);

    const member = await db.pgGet(
      `SELECT id FROM hub_channel_members WHERE channel_id = $1 AND user_id = $2 AND is_active = true`,
      [channelId, userId]
    );
    if (!member) return res.status(403).json({ error: "Not a member of this channel" });

    const result = await db.pgAll(
      `SELECT hm.*,
          COALESCE(u.nickname, u.username) AS sender_name, u.role AS sender_role,
          reply.content AS reply_content,
          COALESCE(reply_user.nickname, reply_user.username) AS reply_sender_name,
          COUNT(DISTINCT hmr.user_id) AS read_count,
          BOOL_OR(hmr.user_id = $1) AS is_read_by_me,
          hf.id AS form_id, hf.status AS live_form_status, hf.submitted_to AS form_submitted_to,
          (
            SELECT JSON_AGG(row_to_json(t)) FROM (
              SELECT hr.emoji, COUNT(*) AS count, BOOL_OR(hr.user_id = $1) AS reacted
              FROM hub_reactions hr WHERE hr.message_id = hm.id GROUP BY hr.emoji
            ) t
          ) AS reactions
       FROM hub_messages hm
       JOIN users u ON u.id = hm.sender_id
       LEFT JOIN hub_messages reply ON reply.id = hm.reply_to_id
       LEFT JOIN users reply_user ON reply_user.id = reply.sender_id
       LEFT JOIN hub_message_reads hmr ON hmr.message_id = hm.id
       LEFT JOIN hub_forms hf ON hf.channel_message_id = hm.id
       WHERE hm.channel_id = $2 AND hm.is_deleted = false
         AND ($3::timestamp IS NULL OR hm.created_at < $3::timestamp)
       GROUP BY hm.id, u.nickname, u.username, u.role, reply.content, reply_user.nickname, reply_user.username,
                hf.id, hf.status, hf.submitted_to
       ORDER BY hm.created_at DESC
       LIMIT $4`,
      [userId, channelId, before || null, msgLimit]
    );

    await db.pgRun(`UPDATE hub_channel_members SET last_seen_at = NOW() WHERE channel_id = $1 AND user_id = $2`, [channelId, userId]);

    res.json(result.reverse());
  } catch (e) {
    console.error("[hub/messages get]", e.message);
    res.json([]);
  }
});

// ── POST /api/hub/channels/:id/messages — send a message (text/file/form) ──
router.post("/channels/:id/messages", authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const {
      content, message_type, file_url, file_name, file_size, file_type,
      reply_to_id, form_type, form_data, on_behalf_of_user_id,
    } = req.body;

    // Admin entering a paper form for an employee without app access — the
    // message/form is recorded as that employee, not the admin. Only admins
    // may use this; everyone else is byte-identical to before.
    const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";
    const userId = (on_behalf_of_user_id && isAdmin) ? on_behalf_of_user_id : req.user.id;
    const channelId = parseInt(req.params.id);

    const memberCheck = await client.query(
      `SELECT id FROM hub_channel_members WHERE channel_id = $1 AND user_id = $2 AND is_active = true`,
      [channelId, userId]
    );
    if (!memberCheck.rows[0]) throw new Error("Not a member of this channel");

    const msgRes = await client.query(
      `INSERT INTO hub_messages (
          channel_id, sender_id, message_type, content,
          file_url, file_name, file_size, file_type,
          reply_to_id, form_type, form_data
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        channelId, userId, message_type || "text", content || null,
        file_url || null, file_name || null, file_size || null, file_type || null,
        reply_to_id || null, form_type || null, form_data ? JSON.stringify(form_data) : null,
      ]
    );
    const msg = msgRes.rows[0];

    await client.query(
      `UPDATE hub_channels SET last_message_at = NOW(), last_message_preview = $1, updated_at = NOW() WHERE id = $2`,
      [content?.substring(0, 100) || `[${message_type || "file"}]`, channelId]
    );

    if (form_type && form_data) {
      const companyId = req.user.active_company_id;
      // Send To — a specific decision maker chosen client-side (via
      // /api/authority/decision-makers) travels inside form_data.send_to_id;
      // falls back to any admin if not provided.
      let submittedTo = form_data.send_to_id || null;
      if (!submittedTo) {
        const adminRow = await client.query(
          `SELECT id FROM users WHERE company_id = $1 AND role = 'admin' AND is_active = true LIMIT 1`,
          [companyId]
        );
        submittedTo = adminRow.rows[0]?.id || null;
      }

      // Server-stamped, not client-claimed — trustworthy record of who
      // actually entered a paper form on someone else's behalf.
      const finalFormData = (on_behalf_of_user_id && isAdmin)
        ? { ...form_data, entered_from_paper_form: true, entered_by_admin_id: req.user.id, entered_at: new Date().toISOString() }
        : form_data;

      await client.query(
        `INSERT INTO hub_forms (company_id, form_type, submitted_by, submitted_to, channel_message_id, form_data, status)
         VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
        [companyId, form_type, userId, submittedTo, msg.id, JSON.stringify(finalFormData)]
      );
    }

    await client.query(
      `INSERT INTO hub_message_reads (message_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [msg.id, userId]
    );

    const members = await client.query(
      `SELECT user_id FROM hub_channel_members WHERE channel_id = $1 AND user_id != $2 AND is_active = true`,
      [channelId, userId]
    );
    const senderName = (await client.query(`SELECT COALESCE(nickname, username) AS name FROM users WHERE id = $1`, [userId])).rows[0]?.name || "Someone";

    for (const member of members.rows) {
      await client.query(
        `INSERT INTO hub_notifications (company_id, user_id, notification_type, title, body, channel_id, message_id)
         VALUES ($1,$2,'new_message',$3,$4,$5,$6)`,
        [
          req.user.active_company_id, member.user_id, `New message from ${senderName}`,
          content?.substring(0, 80) || `Sent a ${message_type || "file"}`, channelId, msg.id,
        ]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, message: msg });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[hub/messages send]", e.message);
    res.json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// ── DELETE /api/hub/messages/:id — soft-delete own message ─────────────────
router.delete("/messages/:id", authMiddleware, async (req, res) => {
  try {
    const row = await db.pgGet(`SELECT sender_id FROM hub_messages WHERE id = $1`, [req.params.id]);
    if (!row) return res.json({ success: false, error: "Message not found" });
    if (row.sender_id !== req.user.id && !(req.user.role === "admin" || req.user.role === "superadmin")) {
      return res.status(403).json({ success: false, error: "You can only delete your own messages" });
    }
    await db.pgRun(`UPDATE hub_messages SET is_deleted = true, deleted_at = NOW() WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── GET /api/hub/users — company staff, to start a DM or add to a channel ──
router.get("/users", authMiddleware, async (req, res) => {
  try {
    const companyId = req.user.active_company_id;
    const { search } = req.query;

    const result = await db.pgAll(
      `SELECT id, COALESCE(nickname, username) AS name, email, role, phone
       FROM users
       WHERE company_id = $1 AND is_active = true AND id != $2 AND role NOT IN ('customer','user')
         AND ($3::text IS NULL OR LOWER(COALESCE(nickname, username)) LIKE LOWER($3) OR LOWER(email) LIKE LOWER($3))
       ORDER BY name`,
      [companyId, req.user.id, search ? `%${search}%` : null]
    );

    res.json(result);
  } catch (e) {
    console.error("[hub/users]", e.message);
    res.json([]);
  }
});

// ── GET /api/hub/forms — forms submitted by me, or to me (inbox) ───────────
router.get("/forms", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdminUser = req.user.role === "admin" || req.user.role === "superadmin";
    const { type, status, view } = req.query;

    let where = "WHERE 1=1";
    const params = [];
    let pc = 0;

    if (view === "inbox") {
      // Admin's inbox sees every pending-ish request company-wide (per spec:
      // "Admin sees everything from everyone always"); a non-admin decision
      // maker's inbox only sees what was routed to them specifically.
      if (isAdminUser) {
        pc++; where += ` AND hf.company_id = $${pc}`; params.push(req.user.active_company_id);
      } else {
        pc++; where += ` AND hf.submitted_to = $${pc}`; params.push(userId);
      }
    } else {
      pc++; where += ` AND hf.submitted_by = $${pc}`; params.push(userId);
    }

    if (type) { pc++; where += ` AND hf.form_type = $${pc}`; params.push(type); }
    if (status) { pc++; where += ` AND hf.status = $${pc}`; params.push(status); }

    const result = await db.pgAll(
      `SELECT hf.*,
          COALESCE(sub.nickname, sub.username) AS submitted_by_name,
          COALESCE(rep.nickname, rep.username) AS responded_by_name,
          COALESCE(rec.nickname, rec.username) AS submitted_to_name
       FROM hub_forms hf
       LEFT JOIN users sub ON sub.id = hf.submitted_by
       LEFT JOIN users rep ON rep.id = hf.responded_by
       LEFT JOIN users rec ON rec.id = hf.submitted_to
       ${where}
       ORDER BY hf.created_at DESC`,
      params
    );

    res.json(result);
  } catch (e) {
    console.error("[hub/forms]", e.message);
    res.json([]);
  }
});

// ── PUT /api/hub/forms/:id/respond — decision maker/admin approves or rejects ─
router.put("/forms/:id/respond", authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { status, response } = req.body;
    if (!["approved", "rejected", "under_review"].includes(status)) throw new Error("Invalid status");

    const formRes = await client.query(`SELECT * FROM hub_forms WHERE id = $1`, [req.params.id]);
    const form = formRes.rows[0];
    if (!form) throw new Error("Form not found");

    const isAdminUser = req.user.role === "admin" || req.user.role === "superadmin";
    if (!isAdminUser && form.submitted_to !== req.user.id) {
      throw new Error("You are not the assigned decision maker for this request");
    }

    await client.query(
      `UPDATE hub_forms SET status = $1, response = $2, responded_by = $3, responded_at = NOW(), updated_at = NOW() WHERE id = $4`,
      [status, response || null, req.user.id, req.params.id]
    );

    const label = form.form_type.replace(/_/g, " ");
    const notifTitle =
      status === "approved" ? `✅ Your ${label} was approved` :
      status === "rejected" ? `❌ Your ${label} was rejected` :
      `👀 Your ${label} is under review`;

    await client.query(
      `INSERT INTO hub_notifications (company_id, user_id, notification_type, title, body, form_id)
       VALUES ($1,$2,'form_approved',$3,$4,$5)`,
      [req.user.active_company_id, form.submitted_by, notifTitle, response || `Status updated to ${status}`, form.id]
    );

    await client.query("COMMIT");
    res.json({ success: true, status });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[hub/forms respond]", e.message);
    res.json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// ── GET /api/hub/notifications ──────────────────────────────────────────────
router.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const result = await db.pgAll(
      `SELECT hn.*, hc.name AS channel_name, hc.channel_type
       FROM hub_notifications hn
       LEFT JOIN hub_channels hc ON hc.id = hn.channel_id
       WHERE hn.user_id = $1
       ORDER BY hn.created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const unread = result.filter((n) => !n.is_read).length;
    res.json({ notifications: result, unread_count: unread });
  } catch (e) {
    console.error("[hub/notifications]", e.message);
    res.json({ notifications: [], unread_count: 0 });
  }
});

// ── PUT /api/hub/notifications/mark-all-read ────────────────────────────────
router.put("/notifications/mark-all-read", authMiddleware, async (req, res) => {
  try {
    await db.pgRun(`UPDATE hub_notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false`, [req.user.id]);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false });
  }
});

// ── POST /api/hub/messages/:id/react — toggle an emoji reaction ────────────
router.post("/messages/:id/react", authMiddleware, async (req, res) => {
  try {
    const { emoji } = req.body;
    const existing = await db.pgGet(
      `SELECT id FROM hub_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [req.params.id, req.user.id, emoji]
    );
    if (existing) {
      await db.pgRun(`DELETE FROM hub_reactions WHERE id = $1`, [existing.id]);
      return res.json({ success: true, action: "removed" });
    }
    await db.pgRun(`INSERT INTO hub_reactions (message_id, user_id, emoji) VALUES ($1,$2,$3)`, [req.params.id, req.user.id, emoji]);
    res.json({ success: true, action: "added" });
  } catch (e) {
    res.json({ success: false });
  }
});

// ── Announcements — a thin, semantic layer over hub_channels/hub_messages ──

// GET /api/hub/announcements — list, with read-percentage stats for admins
router.get("/announcements", authMiddleware, async (req, res) => {
  try {
    const companyId = req.user.active_company_id;
    const isAdminUser = req.user.role === "admin" || req.user.role === "superadmin";

    const result = await db.pgAll(
      `SELECT hm.*, hc.id AS channel_id,
          COALESCE(u.nickname, u.username) AS sender_name,
          COUNT(DISTINCT hmr.user_id) AS read_count,
          (SELECT COUNT(*) FROM hub_channel_members WHERE channel_id = hc.id AND is_active = true) AS total_members,
          BOOL_OR(hmr.user_id = $2) AS read_by_me
       FROM hub_messages hm
       JOIN hub_channels hc ON hc.id = hm.channel_id
       JOIN users u ON u.id = hm.sender_id
       LEFT JOIN hub_message_reads hmr ON hmr.message_id = hm.id
       WHERE hc.channel_type = 'announcement' AND hc.company_id = $1 AND hm.is_deleted = false
       GROUP BY hm.id, hc.id, u.nickname, u.username
       ORDER BY hm.created_at DESC`,
      [companyId, req.user.id]
    );

    const enriched = result.map((r) => ({
      ...r,
      read_percent: r.total_members > 0 ? Math.round((r.read_count / r.total_members) * 100) : 0,
    }));

    res.json({ announcements: enriched, is_admin: isAdminUser });
  } catch (e) {
    console.error("[hub/announcements list]", e.message);
    res.json({ announcements: [], is_admin: false });
  }
});

// GET /api/hub/announcements/:messageId/reads — admin: who has/hasn't read it
router.get("/announcements/:messageId/reads", authMiddleware, async (req, res) => {
  try {
    if (!(req.user.role === "admin" || req.user.role === "superadmin")) {
      return res.status(403).json({ error: "Admin only" });
    }
    const msg = await db.pgGet(`SELECT channel_id FROM hub_messages WHERE id = $1`, [req.params.messageId]);
    if (!msg) return res.json({ read: [], unread: [] });

    const members = await db.pgAll(
      `SELECT u.id, COALESCE(u.nickname, u.username) AS name,
          EXISTS(SELECT 1 FROM hub_message_reads hmr WHERE hmr.message_id = $1 AND hmr.user_id = u.id) AS has_read
       FROM hub_channel_members hcm
       JOIN users u ON u.id = hcm.user_id
       WHERE hcm.channel_id = $2 AND hcm.is_active = true
       ORDER BY has_read ASC, name ASC`,
      [req.params.messageId, msg.channel_id]
    );

    res.json({ read: members.filter((m) => m.has_read), unread: members.filter((m) => !m.has_read) });
  } catch (e) {
    res.json({ read: [], unread: [] });
  }
});

// POST /api/hub/announcements — admin: post a new broadcast
router.post("/announcements", authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    if (!(req.user.role === "admin" || req.user.role === "superadmin")) throw new Error("Admin only");

    const { title, message, priority, target, target_branch_id } = req.body;
    if (!title?.trim() || !message?.trim()) throw new Error("Title and message are required");

    const companyId = req.user.active_company_id;
    const userId = req.user.id;

    // One shared announcement channel per company — created on first use.
    let channel = await client.query(
      `SELECT id FROM hub_channels WHERE company_id = $1 AND channel_type = 'announcement' LIMIT 1`,
      [companyId]
    );
    let channelId;
    if (channel.rows[0]) {
      channelId = channel.rows[0].id;
    } else {
      const created = await client.query(
        `INSERT INTO hub_channels (company_id, channel_type, name, description, created_by)
         VALUES ($1,'announcement','Company Announcements','Admin broadcasts to all staff',$2) RETURNING id`,
        [companyId, userId]
      );
      channelId = created.rows[0].id;
    }

    // Membership = every active internal-staff user, kept in sync on each post.
    let staffWhere = "WHERE company_id = $1 AND is_active = true AND role NOT IN ('customer','user')";
    const staffParams = [companyId];
    if (target === "branch" && target_branch_id) {
      staffParams.push(target_branch_id);
      staffWhere += ` AND branch_id = $${staffParams.length}`;
    }
    const staff = await client.query(`SELECT id FROM users ${staffWhere}`, staffParams);
    for (const s of staff.rows) {
      await client.query(
        `INSERT INTO hub_channel_members (channel_id, user_id, role) VALUES ($1,$2,'member')
         ON CONFLICT (channel_id, user_id) DO NOTHING`,
        [channelId, s.id]
      );
    }

    const priorityTag = priority === "urgent" ? "🔴 URGENT" : priority === "important" ? "🟠 IMPORTANT" : "🔵";
    const content = `${priorityTag} ${title}\n\n${message}`;

    const msgRes = await client.query(
      `INSERT INTO hub_messages (channel_id, sender_id, message_type, content) VALUES ($1,$2,'text',$3) RETURNING *`,
      [channelId, userId, content]
    );

    await client.query(
      `UPDATE hub_channels SET last_message_at = NOW(), last_message_preview = $1, updated_at = NOW() WHERE id = $2`,
      [title.substring(0, 100), channelId]
    );

    for (const s of staff.rows) {
      if (s.id === userId) continue;
      await client.query(
        `INSERT INTO hub_notifications (company_id, user_id, notification_type, title, body, channel_id, message_id)
         VALUES ($1,$2,'announcement',$3,$4,$5,$6)`,
        [companyId, s.id, `📢 ${title}`, message.substring(0, 100), channelId, msgRes.rows[0].id]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, message: msgRes.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[hub/announcements create]", e.message);
    res.json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// POST /api/hub/announcements/:messageId/read — employee marks one as read
router.post("/announcements/:messageId/read", authMiddleware, async (req, res) => {
  try {
    await db.pgRun(
      `INSERT INTO hub_message_reads (message_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [req.params.messageId, req.user.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false });
  }
});

export default router;
