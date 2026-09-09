// backend/routes/authority.js
//
// Role & Authority Management — admin decides which employees are decision
// makers and what request types each one can decide on. New, standalone
// feature: only touches its own new authority_roles table. Mounted at
// /api/authority in server.js (two added lines, nothing else touched).
//
// Adapted from the original spec (CommonJS, generic schema) to this codebase's
// real conventions: ESM, db.pgAll/pgGet/getClient(), authMiddleware,
// req.user.id / req.user.active_company_id / req.user.role (no user_id,
// company_id or is_super_admin on req.user), and COALESCE(nickname, username)
// for a display name since users has no `name` column. "Employees" here means
// internal staff rows in `users` — customer/portal accounts (role IN
// ('user','customer')) are excluded from every list.

import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

const isAdmin = (req) => req.user.role === "admin" || req.user.role === "superadmin";

const PERMISSION_COLUMNS = {
  leave_request: "can_approve_leave",
  advance_request: "can_approve_advance",
  expense_claim: "can_approve_expense",
  attendance: "can_approve_attendance",
  complaint: "can_approve_complaint",
  work_from_home: "can_approve_wfh",
  overtime_request: "can_approve_overtime",
  asset_request: "can_approve_asset",
  suggestion: "can_approve_suggestion",
  purchase: "can_approve_purchase",
};

// ── GET /api/authority/all — admin: every employee + their authority ───────
router.get("/all", authMiddleware, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: "Admin only" });
    const companyId = req.user.active_company_id;

    const employees = await db.pgAll(
      `SELECT
          u.id, COALESCE(u.nickname, u.username) AS name, u.email, u.phone,
          u.role, u.is_active,
          ar.id AS authority_id,
          COALESCE(ar.is_decision_maker, false) AS is_decision_maker,
          ar.display_title,
          COALESCE(ar.can_approve_leave, false) AS can_approve_leave,
          COALESCE(ar.can_approve_advance, false) AS can_approve_advance,
          COALESCE(ar.can_approve_expense, false) AS can_approve_expense,
          COALESCE(ar.can_approve_attendance, false) AS can_approve_attendance,
          COALESCE(ar.can_approve_complaint, false) AS can_approve_complaint,
          COALESCE(ar.can_approve_wfh, false) AS can_approve_wfh,
          COALESCE(ar.can_approve_overtime, false) AS can_approve_overtime,
          COALESCE(ar.can_approve_purchase, false) AS can_approve_purchase,
          COALESCE(ar.can_approve_asset, false) AS can_approve_asset,
          COALESCE(ar.can_approve_suggestion, false) AS can_approve_suggestion,
          COALESCE(ar.scope, 'company') AS scope,
          ar.scope_branch_id,
          b.branch_name AS scope_branch_name,
          COALESCE(setter.nickname, setter.username) AS set_by_name
       FROM users u
       LEFT JOIN authority_roles ar ON ar.user_id = u.id AND ar.company_id = $1
       LEFT JOIN branches b ON b.id = ar.scope_branch_id
       LEFT JOIN users setter ON setter.id = ar.set_by
       WHERE u.company_id = $1 AND u.is_active = true AND u.role NOT IN ('customer','user')
       ORDER BY CASE WHEN ar.is_decision_maker = true THEN 0 ELSE 1 END, name ASC`,
      [companyId]
    );

    const summaryRow = await db.pgGet(
      `SELECT
          COUNT(*) AS total_employees,
          COUNT(*) FILTER (WHERE ar.is_decision_maker = true) AS decision_makers,
          COUNT(*) FILTER (WHERE ar.is_decision_maker IS NOT TRUE) AS non_decision_makers
       FROM users u
       LEFT JOIN authority_roles ar ON ar.user_id = u.id AND ar.company_id = $1
       WHERE u.company_id = $1 AND u.is_active = true AND u.role NOT IN ('customer','user')`,
      [companyId]
    );

    res.json({ employees, summary: summaryRow || {} });
  } catch (e) {
    console.error("[authority/all]", e.message);
    res.json({ employees: [], summary: {} });
  }
});

// ── PUT /api/authority/set — admin: create/update one employee's authority ─
router.put("/set", authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    if (!isAdmin(req)) throw new Error("Admin only");

    const companyId = req.user.active_company_id;
    const {
      user_id, is_decision_maker, display_title,
      can_approve_leave, can_approve_advance, can_approve_expense,
      can_approve_attendance, can_approve_complaint, can_approve_wfh,
      can_approve_overtime, can_approve_purchase, can_approve_asset,
      can_approve_suggestion, scope, scope_branch_id,
    } = req.body;

    if (!user_id) throw new Error("User ID required");

    const userRow = await client.query(
      `SELECT id, COALESCE(nickname, username) AS name FROM users WHERE id = $1 AND company_id = $2`,
      [user_id, companyId]
    );
    if (!userRow.rows[0]) throw new Error("Employee not found");

    await client.query(
      `INSERT INTO authority_roles (
          company_id, user_id, is_decision_maker, display_title,
          can_approve_leave, can_approve_advance, can_approve_expense,
          can_approve_attendance, can_approve_complaint, can_approve_wfh,
          can_approve_overtime, can_approve_purchase, can_approve_asset,
          can_approve_suggestion, scope, scope_branch_id,
          is_active, set_by, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true,$17,NOW())
       ON CONFLICT (company_id, user_id) DO UPDATE SET
          is_decision_maker = $3, display_title = $4,
          can_approve_leave = $5, can_approve_advance = $6, can_approve_expense = $7,
          can_approve_attendance = $8, can_approve_complaint = $9, can_approve_wfh = $10,
          can_approve_overtime = $11, can_approve_purchase = $12, can_approve_asset = $13,
          can_approve_suggestion = $14, scope = $15, scope_branch_id = $16,
          set_by = $17, updated_at = NOW()`,
      [
        companyId, user_id, is_decision_maker || false, display_title || null,
        can_approve_leave || false, can_approve_advance || false, can_approve_expense || false,
        can_approve_attendance || false, can_approve_complaint || false, can_approve_wfh || false,
        can_approve_overtime || false, can_approve_purchase || false, can_approve_asset || false,
        can_approve_suggestion || false, scope || "company", scope_branch_id || null,
        req.user.id,
      ]
    );

    const actionLog = is_decision_maker
      ? `Granted decision-making authority to ${userRow.rows[0].name}`
      : `Removed decision-making authority from ${userRow.rows[0].name}`;

    // audit_log's real columns (verified against schemaDef.js) — differs from
    // the spec's assumed erp_audit_log shape. Non-fatal if it fails.
    await client.query(
      `INSERT INTO audit_log (user_id_acting, action, entity_type, entity_id, details_after)
       VALUES ($1, 'authority_updated', 'user', $2, $3)`,
      [req.user.id, user_id, actionLog]
    ).catch(() => {});

    await client.query("COMMIT");
    res.json({ success: true, message: actionLog });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[authority/set]", e.message);
    res.json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// ── GET /api/authority/decision-makers — who can decide a given request type ─
router.get("/decision-makers", authMiddleware, async (req, res) => {
  try {
    const companyId = req.user.active_company_id;
    const { request_type } = req.query;
    const column = PERMISSION_COLUMNS[request_type];

    const decisionMakers = await db.pgAll(
      `SELECT
          u.id, COALESCE(u.nickname, u.username) AS name, u.email, u.role,
          ar.display_title, ar.scope, ar.scope_branch_id, b.branch_name AS scope_branch_name
       FROM authority_roles ar
       JOIN users u ON u.id = ar.user_id
       LEFT JOIN branches b ON b.id = ar.scope_branch_id
       WHERE ar.company_id = $1 AND ar.is_decision_maker = true AND ar.is_active = true
         AND u.is_active = true
         ${column ? `AND ar.${column} = true` : ""}
       ORDER BY name ASC`,
      [companyId]
    );

    const admins = await db.pgAll(
      `SELECT id, COALESCE(nickname, username) AS name, email, role
       FROM users WHERE company_id = $1 AND role = 'admin' AND is_active = true`,
      [companyId]
    );

    for (const admin of admins) {
      if (!decisionMakers.find((dm) => dm.id === admin.id)) {
        decisionMakers.unshift({ ...admin, display_title: "Admin", scope: "company" });
      }
    }

    res.json(decisionMakers);
  } catch (e) {
    console.error("[authority/decision-makers]", e.message);
    res.json([]);
  }
});

// ── GET /api/authority/my-authority — the logged-in user checks their own ──
router.get("/my-authority", authMiddleware, async (req, res) => {
  try {
    const companyId = req.user.active_company_id;
    const row = await db.pgGet(
      `SELECT ar.*, COALESCE(u.nickname, u.username) AS name, u.role
       FROM authority_roles ar
       JOIN users u ON u.id = ar.user_id
       WHERE ar.user_id = $1 AND ar.company_id = $2`,
      [req.user.id, companyId]
    );

    if (!row) {
      const admin = isAdmin(req);
      return res.json({
        is_decision_maker: admin,
        can_approve_leave: admin, can_approve_advance: admin, can_approve_expense: admin,
        can_approve_attendance: admin, can_approve_complaint: admin, can_approve_wfh: admin,
        can_approve_overtime: admin, can_approve_purchase: admin, can_approve_asset: admin,
        can_approve_suggestion: admin,
      });
    }

    res.json(row);
  } catch (e) {
    console.error("[authority/my-authority]", e.message);
    res.json({ is_decision_maker: false });
  }
});

export default router;
