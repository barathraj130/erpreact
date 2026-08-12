// backend/routes/workAccountability.js
// Work Accountability & Strict Audit — new, additive module.
// Tenant-scoped via companies(id)/branches(id)/users(id) — reuses the
// existing auth, RBAC, and tenant-isolation mechanisms exactly as they
// already work everywhere else in this app. No existing table, route, or
// record is read-write except through normal FK references (SELECT only
// where an existing entity is looked up, e.g. to resolve a submitter).
//
// New permissions were added to the EXISTING permissions table under
// module='work_accountability' (see the migration already run). No
// existing role/permission row was touched.
//
// audit_events is append-only: this file exposes no PUT/PATCH/DELETE
// route on it anywhere. Corrections always create a NEW row instead of
// mutating an old one (report_versions, evidence_versions,
// quantity_corrections) — see logAuditEvent() and each write handler.
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

// ── Permission check — reuses the existing roles/permissions/role_permissions
// tables (backend/setupRBAC.js). The real production `permissions` table has
// only (module, action, description) — no `resource` column — so every
// work_accountability permission is stored as module='work_accountability',
// action='<resource>.<verb>' (e.g. 'job.view'). admin/superadmin bypass,
// matching the same convention already used by the existing checkPermission
// middleware. ────────────────────────────────────────────────────────────
const hasPermission = async (role, action) => {
    if (["admin", "superadmin"].includes((role || "").toLowerCase())) return true;
    const perm = await db.pgGet(
        `SELECT 1 FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         JOIN roles r ON r.id = rp.role_id
         WHERE LOWER(r.name) = LOWER($1) AND p.module = 'work_accountability' AND p.action = $2`,
        [role, action]
    ).catch(() => null);
    return !!perm;
};

const requirePermission = (action) => async (req, res, next) => {
    try {
        const ok = await hasPermission(req.user.role, action);
        if (!ok) return res.status(403).json({ error: `Missing permission: ${action}` });
        next();
    } catch (e) {
        res.status(500).json({ error: "Permission check failed" });
    }
};

// ── Every mutating action writes one of these. Append-only by construction —
// no route anywhere updates or deletes an audit_events row. ────────────────
const logAuditEvent = (req, { entityType, entityId = null, action, oldValue = null, newValue = null, reason = null, riskLevel = "low", jobId = null, groupId = null }) =>
    db.pgRun(
        `INSERT INTO audit_events (company_id, branch_id, actor_user_id, job_id, group_id, entity_type, entity_id, action, old_value, new_value, reason, risk_level, ip_address, session_info)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
            req.user.active_company_id, req.user.branch_id || null, req.user.id, jobId, groupId,
            entityType, entityId, action,
            oldValue !== null ? JSON.stringify(oldValue) : null,
            newValue !== null ? JSON.stringify(newValue) : null,
            reason, riskLevel, req.ip || null, req.headers["user-agent"] || null,
        ]
    ).catch((e) => console.error("audit_events insert failed:", e.message));

const raiseAlert = (req, auditEventId, { alertType, severity = "medium", message }) =>
    db.pgRun(
        `INSERT INTO audit_alerts (company_id, audit_event_id, alert_type, severity, message) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.active_company_id, auditEventId, alertType, severity, message]
    ).catch((e) => console.error("audit_alerts insert failed:", e.message));

const isSelf = (a, b) => a != null && b != null && parseInt(a) === parseInt(b);

// ============================================================
// GROUPS
// ============================================================
router.get("/groups", authMiddleware, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT g.*, u.username AS leader_name,
                    (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.is_active = true) AS member_count
             FROM employee_groups g
             LEFT JOIN users u ON u.id = g.leader_id
             WHERE g.company_id = $1 AND g.is_active = true
             ORDER BY g.name`,
            [req.user.active_company_id]
        );
        res.json(rows);
    } catch (e) { res.json([]); }
});

router.post("/groups", authMiddleware, requirePermission("job.assign"), async (req, res) => {
    try {
        const { name, leader_id, branch_id } = req.body;
        if (!name) return res.json({ success: false, error: "Group name required" });
        const result = await db.pgRun(
            `INSERT INTO employee_groups (company_id, branch_id, name, leader_id) VALUES ($1,$2,$3,$4) RETURNING *`,
            [req.user.active_company_id, branch_id || req.user.branch_id || null, name, leader_id || null]
        );
        await logAuditEvent(req, { entityType: "employee_group", entityId: result.rows[0].id, action: "group_created", newValue: { name, leader_id } });
        res.json({ success: true, group: result.rows[0] });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

router.post("/groups/:id/members", authMiddleware, requirePermission("job.assign"), async (req, res) => {
    try {
        const { employee_id } = req.body;
        if (!employee_id) return res.json({ success: false, error: "employee_id required" });
        const group = await db.pgGet(`SELECT id FROM employee_groups WHERE id = $1 AND company_id = $2`, [req.params.id, req.user.active_company_id]);
        if (!group) return res.json({ success: false, error: "Group not found" });
        await db.pgRun(
            `INSERT INTO group_members (group_id, employee_id) VALUES ($1,$2)
             ON CONFLICT (group_id, employee_id) DO UPDATE SET is_active = true`,
            [req.params.id, employee_id]
        );
        await logAuditEvent(req, { entityType: "employee_group", entityId: parseInt(req.params.id), action: "member_added", newValue: { employee_id } });
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

router.delete("/groups/:id/members/:employeeId", authMiddleware, requirePermission("job.assign"), async (req, res) => {
    try {
        await db.pgRun(
            `UPDATE group_members SET is_active = false WHERE group_id = $1 AND employee_id = $2`,
            [req.params.id, req.params.employeeId]
        );
        await logAuditEvent(req, { entityType: "employee_group", entityId: parseInt(req.params.id), action: "member_removed", oldValue: { employee_id: req.params.employeeId } });
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// ============================================================
// JOBS
// ============================================================
router.get("/jobs", authMiddleware, async (req, res) => {
    try {
        const { status, branch_id, assigned_to_me } = req.query;
        const conditions = ["j.company_id = $1"];
        const params = [req.user.active_company_id];
        let pc = 1;

        if (status) { pc++; conditions.push(`j.status = $${pc}`); params.push(status); }
        if (branch_id) { pc++; conditions.push(`j.branch_id = $${pc}`); params.push(branch_id); }

        let joinAssignment = "";
        if (assigned_to_me === "true") {
            pc++;
            joinAssignment = `JOIN job_assignments ja ON ja.job_id = j.id AND ja.employee_id = $${pc}`;
            params.push(req.user.id);
        }

        const rows = await db.pgAll(
            `SELECT DISTINCT j.*, u.username AS created_by_name,
                    (SELECT COUNT(*) FROM job_assignments WHERE job_id = j.id) AS assignment_count
             FROM jobs j
             ${joinAssignment}
             LEFT JOIN users u ON u.id = j.created_by
             WHERE ${conditions.join(" AND ")}
             ORDER BY j.created_at DESC`,
            params
        );
        res.json(rows);
    } catch (e) { console.error("jobs list error:", e.message); res.json([]); }
});

router.post("/jobs", authMiddleware, requirePermission("job.create"), async (req, res) => {
    try {
        const { title, description, job_type, expected_quantity, unit, due_date, branch_id } = req.body;
        if (!title) return res.json({ success: false, error: "Job title required" });
        const result = await db.pgRun(
            `INSERT INTO jobs (company_id, branch_id, title, description, job_type, expected_quantity, unit, due_date, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [req.user.active_company_id, branch_id || req.user.branch_id || null, title, description || null, job_type || "general", expected_quantity || null, unit || null, due_date || null, req.user.id]
        );
        await logAuditEvent(req, { entityType: "job", entityId: result.rows[0].id, action: "job_created", newValue: { title, job_type }, jobId: result.rows[0].id });
        res.json({ success: true, job: result.rows[0] });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

router.get("/jobs/:id", authMiddleware, async (req, res) => {
    try {
        const job = await db.pgGet(`SELECT j.*, u.username AS created_by_name FROM jobs j LEFT JOIN users u ON u.id = j.created_by WHERE j.id = $1 AND j.company_id = $2`, [req.params.id, req.user.active_company_id]);
        if (!job) return res.json({ error: "Job not found" });

        const [assignments, dutySessions, reports, evidenceRows, quantityReports, verifications, approvals] = await Promise.all([
            db.pgAll(`SELECT ja.*, u.username AS employee_name, g.name AS group_name FROM job_assignments ja LEFT JOIN users u ON u.id = ja.employee_id LEFT JOIN employee_groups g ON g.id = ja.group_id WHERE ja.job_id = $1`, [req.params.id]),
            db.pgAll(`SELECT ds.*, u.username AS employee_name FROM duty_sessions ds LEFT JOIN users u ON u.id = ds.employee_id WHERE ds.job_id = $1 ORDER BY ds.started_at DESC`, [req.params.id]),
            db.pgAll(`SELECT dr.*, u.username AS employee_name FROM daily_reports dr LEFT JOIN users u ON u.id = dr.employee_id WHERE dr.job_id = $1 ORDER BY dr.report_date DESC`, [req.params.id]),
            db.pgAll(`SELECT * FROM evidence WHERE job_id = $1 ORDER BY uploaded_at DESC`, [req.params.id]),
            db.pgAll(`SELECT * FROM quantity_reports WHERE job_id = $1 ORDER BY report_date DESC`, [req.params.id]),
            db.pgAll(`SELECT vr.*, u.username AS verified_by_name FROM verification_records vr LEFT JOIN users u ON u.id = vr.verified_by WHERE vr.entity_type = 'job' AND vr.entity_id = $1`, [req.params.id]),
            db.pgAll(`SELECT ar.*, u.username AS approved_by_name FROM approval_records ar LEFT JOIN users u ON u.id = ar.approved_by WHERE ar.entity_type = 'job' AND ar.entity_id = $1`, [req.params.id]),
        ]);

        res.json({ job, assignments, duty_sessions: dutySessions, reports, evidence: evidenceRows, quantity_reports: quantityReports, verifications, approvals });
    } catch (e) { console.error("job detail error:", e.message); res.json({ error: e.message }); }
});

router.post("/jobs/:id/assign", authMiddleware, requirePermission("job.assign"), async (req, res) => {
    try {
        const { employee_id, group_id } = req.body;
        if (!employee_id && !group_id) return res.json({ success: false, error: "employee_id or group_id required" });

        const job = await db.pgGet(`SELECT id, status FROM jobs WHERE id = $1 AND company_id = $2`, [req.params.id, req.user.active_company_id]);
        if (!job) return res.json({ success: false, error: "Job not found" });

        const result = await db.pgRun(
            `INSERT INTO job_assignments (job_id, employee_id, group_id, assigned_by) VALUES ($1,$2,$3,$4) RETURNING *`,
            [req.params.id, employee_id || null, group_id || null, req.user.id]
        );
        if (job.status === "draft") {
            await db.pgRun(`UPDATE jobs SET status = 'assigned', updated_at = NOW() WHERE id = $1`, [req.params.id]);
        }
        await logAuditEvent(req, { entityType: "job", entityId: parseInt(req.params.id), action: "job_assigned", newValue: { employee_id, group_id }, jobId: parseInt(req.params.id) });
        res.json({ success: true, assignment: result.rows[0] });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

router.post("/jobs/:id/assignments/:assignmentId/respond", authMiddleware, requirePermission("job.accept"), async (req, res) => {
    try {
        const { action } = req.body;
        if (!["accept", "decline"].includes(action)) return res.json({ success: false, error: "action must be accept or decline" });

        const assignment = await db.pgGet(`SELECT * FROM job_assignments WHERE id = $1 AND job_id = $2`, [req.params.assignmentId, req.params.id]);
        if (!assignment) return res.json({ success: false, error: "Assignment not found" });
        if (assignment.employee_id && !isSelf(assignment.employee_id, req.user.id) && !["admin", "superadmin"].includes((req.user.role || "").toLowerCase())) {
            return res.status(403).json({ error: "Not your assignment" });
        }

        const newStatus = action === "accept" ? "accepted" : "declined";
        await db.pgRun(`UPDATE job_assignments SET status = $1, responded_at = NOW() WHERE id = $2`, [newStatus, req.params.assignmentId]);
        if (action === "accept") {
            await db.pgRun(`UPDATE jobs SET status = 'in_progress', updated_at = NOW() WHERE id = $1 AND status = 'assigned'`, [req.params.id]);
        }
        await logAuditEvent(req, { entityType: "job_assignment", entityId: parseInt(req.params.assignmentId), action: `assignment_${newStatus}`, jobId: parseInt(req.params.id) });
        res.json({ success: true, status: newStatus });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// ============================================================
// DUTY SESSIONS + WORK ACTIVITIES
// ============================================================
router.get("/duty", authMiddleware, async (req, res) => {
    try {
        const { job_id, employee_id } = req.query;
        const conditions = ["ds.company_id = $1"];
        const params = [req.user.active_company_id];
        let pc = 1;
        if (job_id) { pc++; conditions.push(`ds.job_id = $${pc}`); params.push(job_id); }
        if (employee_id) { pc++; conditions.push(`ds.employee_id = $${pc}`); params.push(employee_id); }

        const rows = await db.pgAll(
            `SELECT ds.*, u.username AS employee_name, j.title AS job_title
             FROM duty_sessions ds
             LEFT JOIN users u ON u.id = ds.employee_id
             LEFT JOIN jobs j ON j.id = ds.job_id
             WHERE ${conditions.join(" AND ")}
             ORDER BY ds.started_at DESC`,
            params
        );
        res.json(rows);
    } catch (e) { res.json([]); }
});

router.post("/duty/start", authMiddleware, async (req, res) => {
    try {
        const { job_id, group_id } = req.body;
        if (!job_id) return res.json({ success: false, error: "job_id required" });

        const job = await db.pgGet(`SELECT id, status FROM jobs WHERE id = $1 AND company_id = $2`, [job_id, req.user.active_company_id]);
        if (!job) return res.json({ success: false, error: "Job not found" });

        const existing = await db.pgGet(`SELECT id FROM duty_sessions WHERE job_id = $1 AND employee_id = $2 AND status = 'active'`, [job_id, req.user.id]);
        if (existing) return res.json({ success: false, error: "You already have an active duty session for this job" });

        const result = await db.pgRun(
            `INSERT INTO duty_sessions (job_id, employee_id, group_id, company_id) VALUES ($1,$2,$3,$4) RETURNING *`,
            [job_id, req.user.id, group_id || null, req.user.active_company_id]
        );
        if (job.status === "assigned") {
            await db.pgRun(`UPDATE jobs SET status = 'in_progress', updated_at = NOW() WHERE id = $1`, [job_id]);
        }
        await logAuditEvent(req, { entityType: "duty_session", entityId: result.rows[0].id, action: "duty_started", jobId: parseInt(job_id), groupId: group_id || null });
        res.json({ success: true, session: result.rows[0] });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

router.post("/duty/:id/end", authMiddleware, async (req, res) => {
    try {
        const session = await db.pgGet(`SELECT * FROM duty_sessions WHERE id = $1 AND company_id = $2`, [req.params.id, req.user.active_company_id]);
        if (!session) return res.json({ success: false, error: "Session not found" });
        if (!isSelf(session.employee_id, req.user.id) && !["admin", "superadmin"].includes((req.user.role || "").toLowerCase())) {
            return res.status(403).json({ error: "Not your duty session" });
        }
        await db.pgRun(`UPDATE duty_sessions SET ended_at = NOW(), status = 'ended' WHERE id = $1`, [req.params.id]);
        await logAuditEvent(req, { entityType: "duty_session", entityId: parseInt(req.params.id), action: "duty_ended", jobId: session.job_id });
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

router.post("/duty/:id/activities", authMiddleware, async (req, res) => {
    try {
        const { activity_type, description } = req.body;
        const session = await db.pgGet(`SELECT * FROM duty_sessions WHERE id = $1 AND company_id = $2`, [req.params.id, req.user.active_company_id]);
        if (!session) return res.json({ success: false, error: "Session not found" });

        const result = await db.pgRun(
            `INSERT INTO work_activities (duty_session_id, job_id, employee_id, company_id, activity_type, description)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [req.params.id, session.job_id, req.user.id, req.user.active_company_id, activity_type || "note", description || null]
        );
        await logAuditEvent(req, { entityType: "work_activity", entityId: result.rows[0].id, action: "activity_logged", jobId: session.job_id, newValue: { activity_type, description } });
        res.json({ success: true, activity: result.rows[0] });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

router.get("/jobs/:id/activities", authMiddleware, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT wa.*, u.username AS employee_name FROM work_activities wa LEFT JOIN users u ON u.id = wa.employee_id WHERE wa.job_id = $1 AND wa.company_id = $2 ORDER BY wa.occurred_at DESC`,
            [req.params.id, req.user.active_company_id]
        );
        res.json(rows);
    } catch (e) { res.json([]); }
});

// ============================================================
// DAILY REPORTS — versioned edits, backdating controls
// ============================================================
router.get("/reports", authMiddleware, async (req, res) => {
    try {
        const { job_id } = req.query;
        const conditions = ["dr.company_id = $1"];
        const params = [req.user.active_company_id];
        if (job_id) { conditions.push(`dr.job_id = $2`); params.push(job_id); }
        const rows = await db.pgAll(
            `SELECT dr.*, u.username AS employee_name FROM daily_reports dr LEFT JOIN users u ON u.id = dr.employee_id WHERE ${conditions.join(" AND ")} ORDER BY dr.report_date DESC`,
            params
        );
        res.json(rows);
    } catch (e) { res.json([]); }
});

router.post("/reports", authMiddleware, requirePermission("work_report.create"), async (req, res) => {
    try {
        const { job_id, report_date, content, backdated_reason } = req.body;
        if (!job_id || !content) return res.json({ success: false, error: "job_id and content required" });

        const today = new Date().toISOString().split("T")[0];
        const isBackdated = report_date && report_date < today;
        if (isBackdated && !backdated_reason) {
            return res.json({ success: false, error: "Backdated reports require a reason" });
        }

        const result = await db.pgRun(
            `INSERT INTO daily_reports (job_id, employee_id, company_id, report_date, content, status, is_backdated, backdated_reason, submitted_at)
             VALUES ($1,$2,$3,$4,$5,'submitted',$6,$7,NOW()) RETURNING *`,
            [job_id, req.user.id, req.user.active_company_id, report_date || today, content, !!isBackdated, isBackdated ? backdated_reason : null]
        );

        // First version snapshot so version history starts complete
        await db.pgRun(
            `INSERT INTO report_versions (daily_report_id, version_number, content, edited_by, edit_reason) VALUES ($1,1,$2,$3,'Initial submission')`,
            [result.rows[0].id, content, req.user.id]
        );

        const auditRisk = isBackdated ? "high" : "low";
        const evt = await logAuditEvent(req, { entityType: "daily_report", entityId: result.rows[0].id, action: "report_submitted", newValue: { report_date, is_backdated: isBackdated }, reason: isBackdated ? backdated_reason : null, riskLevel: auditRisk, jobId: job_id });
        if (isBackdated) {
            await raiseAlert(req, null, { alertType: "backdated_report", severity: "high", message: `Backdated daily report submitted for job #${job_id} (original date ${report_date}, submitted ${today})` });
        }
        res.json({ success: true, report: result.rows[0] });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

router.put("/reports/:id", authMiddleware, requirePermission("work_report.create"), async (req, res) => {
    try {
        const { content, edit_reason } = req.body;
        if (!content) return res.json({ success: false, error: "Content required" });

        const report = await db.pgGet(`SELECT * FROM daily_reports WHERE id = $1 AND company_id = $2`, [req.params.id, req.user.active_company_id]);
        if (!report) return res.json({ success: false, error: "Report not found" });
        if (!isSelf(report.employee_id, req.user.id) && !["admin", "superadmin"].includes((req.user.role || "").toLowerCase())) {
            return res.status(403).json({ error: "Not your report" });
        }

        const versionRow = await db.pgGet(`SELECT COALESCE(MAX(version_number),0) AS max FROM report_versions WHERE daily_report_id = $1`, [req.params.id]);
        const nextVersion = parseInt(versionRow.max) + 1;

        // Preserve the OLD content as a version BEFORE overwriting — never
        // silently lose history (Rule 20).
        await db.pgRun(
            `INSERT INTO report_versions (daily_report_id, version_number, content, edited_by, edit_reason) VALUES ($1,$2,$3,$4,$5)`,
            [req.params.id, nextVersion, content, req.user.id, edit_reason || null]
        );
        await db.pgRun(`UPDATE daily_reports SET content = $1 WHERE id = $2`, [content, req.params.id]);
        await logAuditEvent(req, { entityType: "daily_report", entityId: parseInt(req.params.id), action: "report_edited", oldValue: { content: report.content }, newValue: { content }, reason: edit_reason, riskLevel: "medium", jobId: report.job_id });
        res.json({ success: true, version: nextVersion });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

router.get("/reports/:id/versions", authMiddleware, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT rv.*, u.username AS edited_by_name FROM report_versions rv LEFT JOIN users u ON u.id = rv.edited_by WHERE rv.daily_report_id = $1 ORDER BY rv.version_number DESC`,
            [req.params.id]
        );
        res.json(rows);
    } catch (e) { res.json([]); }
});

// ============================================================
// EVIDENCE — versioned replacement, never overwritten in place
// ============================================================
router.get("/evidence", authMiddleware, async (req, res) => {
    try {
        const { job_id } = req.query;
        const conditions = ["e.company_id = $1"];
        const params = [req.user.active_company_id];
        if (job_id) { conditions.push(`e.job_id = $2`); params.push(job_id); }
        const rows = await db.pgAll(
            `SELECT e.*, u.username AS uploaded_by_name FROM evidence e LEFT JOIN users u ON u.id = e.uploaded_by WHERE ${conditions.join(" AND ")} ORDER BY e.uploaded_at DESC`,
            params
        );
        res.json(rows);
    } catch (e) { res.json([]); }
});

router.post("/evidence", authMiddleware, requirePermission("evidence.upload"), async (req, res) => {
    try {
        const { job_id, daily_report_id, file_url, file_type, file_metadata } = req.body;
        if (!file_url) return res.json({ success: false, error: "file_url required" });

        const result = await db.pgRun(
            `INSERT INTO evidence (company_id, job_id, daily_report_id, file_url, file_type, uploaded_by, current_version)
             VALUES ($1,$2,$3,$4,$5,$6,1) RETURNING *`,
            [req.user.active_company_id, job_id || null, daily_report_id || null, file_url, file_type || "photo", req.user.id]
        );
        await db.pgRun(
            `INSERT INTO evidence_versions (evidence_id, version_number, file_url, file_metadata, uploaded_by) VALUES ($1,1,$2,$3,$4)`,
            [result.rows[0].id, file_url, file_metadata ? JSON.stringify(file_metadata) : null, req.user.id]
        );
        await logAuditEvent(req, { entityType: "evidence", entityId: result.rows[0].id, action: "evidence_uploaded", newValue: { file_url, file_type }, jobId: job_id || null });
        res.json({ success: true, evidence: result.rows[0] });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

router.post("/evidence/:id/replace", authMiddleware, requirePermission("evidence.upload"), async (req, res) => {
    try {
        const { file_url, file_metadata, reason } = req.body;
        if (!file_url || !reason) return res.json({ success: false, error: "file_url and reason are required to replace evidence" });

        const ev = await db.pgGet(`SELECT * FROM evidence WHERE id = $1 AND company_id = $2`, [req.params.id, req.user.active_company_id]);
        if (!ev) return res.json({ success: false, error: "Evidence not found" });

        const nextVersion = ev.current_version + 1;
        await db.pgRun(
            `INSERT INTO evidence_versions (evidence_id, version_number, file_url, file_metadata, uploaded_by, replacement_reason) VALUES ($1,$2,$3,$4,$5,$6)`,
            [req.params.id, nextVersion, file_url, file_metadata ? JSON.stringify(file_metadata) : null, req.user.id, reason]
        );
        await db.pgRun(
            `UPDATE evidence SET file_url = $1, current_version = $2, verification_status = 'pending', verified_by = NULL, verified_at = NULL WHERE id = $3`,
            [file_url, nextVersion, req.params.id]
        );
        await logAuditEvent(req, { entityType: "evidence", entityId: parseInt(req.params.id), action: "evidence_replaced", oldValue: { file_url: ev.file_url, version: ev.current_version }, newValue: { file_url, version: nextVersion }, reason, riskLevel: "medium", jobId: ev.job_id });
        res.json({ success: true, version: nextVersion });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

router.post("/evidence/:id/verify", authMiddleware, requirePermission("evidence.review"), async (req, res) => {
    try {
        const { status, notes } = req.body;
        if (!["verified", "rejected"].includes(status)) return res.json({ success: false, error: "status must be verified or rejected" });

        const ev = await db.pgGet(`SELECT * FROM evidence WHERE id = $1 AND company_id = $2`, [req.params.id, req.user.active_company_id]);
        if (!ev) return res.json({ success: false, error: "Evidence not found" });
        if (isSelf(ev.uploaded_by, req.user.id)) return res.status(403).json({ error: "You cannot verify your own evidence upload" });

        await db.pgRun(`UPDATE evidence SET verification_status = $1, verified_by = $2, verified_at = NOW() WHERE id = $3`, [status, req.user.id, req.params.id]);
        await db.pgRun(
            `INSERT INTO verification_records (company_id, entity_type, entity_id, verified_by, verification_status, notes) VALUES ($1,'evidence',$2,$3,$4,$5)`,
            [req.user.active_company_id, req.params.id, req.user.id, status, notes || null]
        );
        await logAuditEvent(req, { entityType: "evidence", entityId: parseInt(req.params.id), action: `evidence_${status}`, reason: notes, riskLevel: status === "rejected" ? "medium" : "low", jobId: ev.job_id });
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// ============================================================
// QUANTITY REPORTS + CORRECTIONS — immutable event trail
// ============================================================
router.get("/quantity", authMiddleware, async (req, res) => {
    try {
        const { job_id } = req.query;
        const conditions = ["qr.company_id = $1"];
        const params = [req.user.active_company_id];
        if (job_id) { conditions.push(`qr.job_id = $2`); params.push(job_id); }
        const rows = await db.pgAll(
            `SELECT qr.*, u.username AS employee_name FROM quantity_reports qr LEFT JOIN users u ON u.id = qr.employee_id WHERE ${conditions.join(" AND ")} ORDER BY qr.report_date DESC`,
            params
        );
        res.json(rows);
    } catch (e) { res.json([]); }
});

router.post("/quantity", authMiddleware, requirePermission("quantity.submit"), async (req, res) => {
    try {
        const { job_id, reported_quantity, unit, report_date } = req.body;
        if (!job_id || reported_quantity === undefined) return res.json({ success: false, error: "job_id and reported_quantity required" });

        const result = await db.pgRun(
            `INSERT INTO quantity_reports (job_id, employee_id, company_id, reported_quantity, unit, report_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [job_id, req.user.id, req.user.active_company_id, parseFloat(reported_quantity), unit || null, report_date || new Date().toISOString().split("T")[0]]
        );
        await logAuditEvent(req, { entityType: "quantity_report", entityId: result.rows[0].id, action: "quantity_submitted", newValue: { reported_quantity }, jobId: job_id });
        res.json({ success: true, quantity_report: result.rows[0] });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

router.post("/quantity/:id/correct", authMiddleware, requirePermission("quantity.submit"), async (req, res) => {
    try {
        const { corrected_quantity, reason } = req.body;
        if (corrected_quantity === undefined || !reason) return res.json({ success: false, error: "corrected_quantity and reason required" });

        const qr = await db.pgGet(`SELECT * FROM quantity_reports WHERE id = $1 AND company_id = $2`, [req.params.id, req.user.active_company_id]);
        if (!qr) return res.json({ success: false, error: "Quantity report not found" });

        const result = await db.pgRun(
            `INSERT INTO quantity_corrections (quantity_report_id, previous_quantity, corrected_quantity, reason, requested_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [req.params.id, qr.reported_quantity, parseFloat(corrected_quantity), reason, req.user.id]
        );
        await db.pgRun(`UPDATE quantity_reports SET status = 'corrected' WHERE id = $1`, [req.params.id]);
        // EVENT 001 (original) stays untouched in quantity_reports history via
        // this correction row's previous_quantity — nothing is overwritten yet,
        // the current figure only changes once the correction is approved.
        await logAuditEvent(req, { entityType: "quantity_report", entityId: parseInt(req.params.id), action: "quantity_correction_requested", oldValue: { quantity: qr.reported_quantity }, newValue: { quantity: corrected_quantity }, reason, riskLevel: "medium", jobId: qr.job_id });
        res.json({ success: true, correction: result.rows[0] });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

router.post("/quantity-corrections/:id/approve", authMiddleware, requirePermission("quantity.verify"), async (req, res) => {
    try {
        const { action } = req.body;
        if (!["approve", "reject"].includes(action)) return res.json({ success: false, error: "action must be approve or reject" });

        const correction = await db.pgGet(`SELECT * FROM quantity_corrections WHERE id = $1`, [req.params.id]);
        if (!correction) return res.json({ success: false, error: "Correction not found" });
        if (isSelf(correction.requested_by, req.user.id)) return res.status(403).json({ error: "You cannot approve your own correction request" });

        const newStatus = action === "approve" ? "approved" : "rejected";
        await db.pgRun(`UPDATE quantity_corrections SET status = $1, approved_by = $2, approved_at = NOW() WHERE id = $3`, [newStatus, req.user.id, req.params.id]);

        const qr = await db.pgGet(`SELECT * FROM quantity_reports WHERE id = $1`, [correction.quantity_report_id]);
        if (action === "approve") {
            // EVENT 004 — current quantity becomes the corrected value.
            await db.pgRun(`UPDATE quantity_reports SET reported_quantity = $1, status = 'verified' WHERE id = $2`, [correction.corrected_quantity, correction.quantity_report_id]);
        } else {
            await db.pgRun(`UPDATE quantity_reports SET status = 'submitted' WHERE id = $1`, [correction.quantity_report_id]);
        }
        await logAuditEvent(req, { entityType: "quantity_correction", entityId: parseInt(req.params.id), action: `quantity_correction_${newStatus}`, jobId: qr?.job_id, riskLevel: "medium" });
        res.json({ success: true, status: newStatus });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// ============================================================
// VERIFICATION (generic — job / daily_report)
// ============================================================
router.post("/verify", authMiddleware, requirePermission("quantity.verify"), async (req, res) => {
    try {
        const { entity_type, entity_id, status, notes } = req.body;
        if (!["job", "daily_report"].includes(entity_type)) return res.json({ success: false, error: "Unsupported entity_type" });
        if (!["verified", "rejected"].includes(status)) return res.json({ success: false, error: "status must be verified or rejected" });

        const table = entity_type === "job" ? "jobs" : "daily_reports";
        const submitterCol = entity_type === "job" ? "created_by" : "employee_id";
        const entity = await db.pgGet(`SELECT * FROM ${table} WHERE id = $1 AND company_id = $2`, [entity_id, req.user.active_company_id]);
        if (!entity) return res.json({ success: false, error: "Not found" });
        if (isSelf(entity[submitterCol], req.user.id)) return res.status(403).json({ error: "You cannot verify your own submission" });

        await db.pgRun(
            `INSERT INTO verification_records (company_id, entity_type, entity_id, verified_by, verification_status, notes) VALUES ($1,$2,$3,$4,$5,$6)`,
            [req.user.active_company_id, entity_type, entity_id, req.user.id, status, notes || null]
        );
        const newStatus = entity_type === "job" ? (status === "verified" ? "verified" : "rejected") : (status === "verified" ? "reviewed" : "rejected");
        await db.pgRun(`UPDATE ${table} SET status = $1${entity_type === "job" ? ", updated_at = NOW()" : ""} WHERE id = $2`, [newStatus, entity_id]);

        await logAuditEvent(req, { entityType: entity_type, entityId: parseInt(entity_id), action: `${entity_type}_${status}`, reason: notes, riskLevel: status === "rejected" ? "medium" : "low", jobId: entity_type === "job" ? parseInt(entity_id) : entity.job_id });
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// ============================================================
// APPROVAL (final step — separate from verification)
// ============================================================
router.post("/approve", authMiddleware, requirePermission("job.approve"), async (req, res) => {
    try {
        const { entity_type, entity_id, status, notes } = req.body;
        if (!["job", "daily_report", "quantity_report"].includes(entity_type)) return res.json({ success: false, error: "Unsupported entity_type" });
        if (!["approved", "rejected"].includes(status)) return res.json({ success: false, error: "status must be approved or rejected" });

        const table = entity_type === "job" ? "jobs" : entity_type === "daily_report" ? "daily_reports" : "quantity_reports";
        const submitterCol = entity_type === "job" ? "created_by" : "employee_id";
        const entity = await db.pgGet(`SELECT * FROM ${table} WHERE id = $1 AND company_id = $2`, [entity_id, req.user.active_company_id]);
        if (!entity) return res.json({ success: false, error: "Not found" });
        if (isSelf(entity[submitterCol], req.user.id)) return res.status(403).json({ error: "You cannot approve your own submission" });

        await db.pgRun(
            `INSERT INTO approval_records (company_id, entity_type, entity_id, approved_by, approval_status, notes) VALUES ($1,$2,$3,$4,$5,$6)`,
            [req.user.active_company_id, entity_type, entity_id, req.user.id, status, notes || null]
        );
        await db.pgRun(`UPDATE ${table} SET status = $1${entity_type === "job" ? ", updated_at = NOW()" : ""} WHERE id = $2`, [status, entity_id]);

        await logAuditEvent(req, { entityType: entity_type, entityId: parseInt(entity_id), action: `${entity_type}_${status}`, reason: notes, riskLevel: status === "rejected" ? "medium" : "low", jobId: entity_type === "job" ? parseInt(entity_id) : entity.job_id });
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

// ============================================================
// AUDIT — read-only, no update/delete route ever exposed here
// ============================================================
router.get("/audit-events", authMiddleware, requirePermission("job.approve"), async (req, res) => {
    try {
        const { job_id, entity_type, from, to } = req.query;
        const conditions = ["ae.company_id = $1"];
        const params = [req.user.active_company_id];
        let pc = 1;
        if (job_id) { pc++; conditions.push(`ae.job_id = $${pc}`); params.push(job_id); }
        if (entity_type) { pc++; conditions.push(`ae.entity_type = $${pc}`); params.push(entity_type); }
        if (from) { pc++; conditions.push(`ae.created_at::date >= $${pc}`); params.push(from); }
        if (to) { pc++; conditions.push(`ae.created_at::date <= $${pc}`); params.push(to); }

        const rows = await db.pgAll(
            `SELECT ae.*, u.username AS actor_name FROM audit_events ae LEFT JOIN users u ON u.id = ae.actor_user_id WHERE ${conditions.join(" AND ")} ORDER BY ae.created_at DESC LIMIT 300`,
            params
        );
        res.json(rows);
    } catch (e) { res.json([]); }
});

router.get("/audit-alerts", authMiddleware, requirePermission("job.approve"), async (req, res) => {
    try {
        const { resolved } = req.query;
        const conditions = ["company_id = $1"];
        const params = [req.user.active_company_id];
        if (resolved !== undefined) { conditions.push(`is_resolved = $2`); params.push(resolved === "true"); }
        const rows = await db.pgAll(
            `SELECT * FROM audit_alerts WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT 200`,
            params
        );
        res.json(rows);
    } catch (e) { res.json([]); }
});

router.post("/audit-alerts/:id/resolve", authMiddleware, requirePermission("job.approve"), async (req, res) => {
    try {
        await db.pgRun(
            `UPDATE audit_alerts SET is_resolved = true, resolved_by = $1, resolved_at = NOW() WHERE id = $2 AND company_id = $3`,
            [req.user.id, req.params.id, req.user.active_company_id]
        );
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

export default router;
