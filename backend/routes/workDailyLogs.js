// backend/routes/workDailyLogs.js
// Work Accountability — on-site daily job tracking. Additive extension:
// a Job (existing jobs table) can have one or more employee_groups sent to
// a supplier's site to verify a Purchase Bill on the ground, with a
// day-by-day log of check-in/out, pcs done, and overtime hours.
//
// New tables only (already created): work_job_details, work_job_groups,
// work_daily_logs, supplier_deal_terms. No existing table, route file, or
// API response shape is touched. Reuses the existing audit_events table
// (already used by workAccountability.js) purely via INSERT — no changes
// to that file.
//
// Mounted at /api/work-daily-logs — a prefix that collides with nothing
// currently mounted in server.js (confirmed against the live mount list
// before this file was written).
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

const isManager = (role) => ["admin", "superadmin", "manager", "branch_manager"].includes((role || "").toLowerCase());
const isAdmin = (role) => ["admin", "superadmin"].includes((role || "").toLowerCase());

const requireManager = (req, res, next) => {
    if (!isManager(req.user.role)) return res.status(403).json({ error: "Manager/Admin only" });
    next();
};
const requireAdmin = (req, res, next) => {
    if (!isAdmin(req.user.role)) return res.status(403).json({ error: "Admin only" });
    next();
};

const logAudit = (req, { entityType, entityId = null, action, oldValue = null, newValue = null, jobId = null, groupId = null }) =>
    db.pgRun(
        `INSERT INTO audit_events (company_id, branch_id, actor_user_id, job_id, group_id, entity_type, entity_id, action, old_value, new_value, reason, risk_level, ip_address, session_info)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
            req.user.active_company_id, req.user.branch_id || null, req.user.id, jobId, groupId,
            entityType, entityId, action,
            oldValue !== null ? JSON.stringify(oldValue) : null,
            newValue !== null ? JSON.stringify(newValue) : null,
            null, "low", req.ip || null, req.headers["user-agent"] || null,
        ]
    ).catch((e) => console.error("audit_events insert failed:", e.message));

// Overtime hours past the fixed 10:00 AM–6:00 PM shift. No rate is applied
// (ot_amount always stays 0) — no existing OT formula was found anywhere
// in the codebase to reuse, so pay calculation is intentionally deferred.
const SHIFT_END_MINUTES = 18 * 60;
const computeOtHours = (checkOutTime) => {
    if (!checkOutTime) return 0;
    const [h, m] = checkOutTime.split(":").map(Number);
    const minutes = h * 60 + (m || 0);
    if (minutes <= SHIFT_END_MINUTES) return 0;
    return Number(((minutes - SHIFT_END_MINUTES) / 60).toFixed(2));
};

// ============================================================
// JOB ↔ SUPPLIER/PO LINK (work_job_details) — 1:1 extension of jobs
// ============================================================
router.get("/jobs/:jobId/details", authMiddleware, async (req, res) => {
    try {
        const row = await db.pgGet(
            `SELECT wjd.*, s.name AS supplier_name, pb.bill_number AS purchase_bill_number,
                    sdt.mistake_pcs_allowed
             FROM work_job_details wjd
             LEFT JOIN suppliers s ON s.id = wjd.supplier_id
             LEFT JOIN purchase_bills pb ON pb.id = wjd.purchase_bill_id
             LEFT JOIN supplier_deal_terms sdt ON sdt.supplier_id = wjd.supplier_id
             WHERE wjd.job_id = $1 AND wjd.company_id = $2`,
            [req.params.jobId, req.user.active_company_id]
        );
        res.json(row || null);
    } catch (e) {
        console.error("job details fetch error:", e.message);
        res.json(null);
    }
});

router.put("/jobs/:jobId/details", authMiddleware, requireManager, async (req, res) => {
    try {
        const { supplier_id, purchase_bill_id, notes } = req.body;
        const job = await db.pgGet(`SELECT id FROM jobs WHERE id = $1 AND company_id = $2`, [req.params.jobId, req.user.active_company_id]);
        if (!job) return res.json({ success: false, error: "Job not found" });

        const result = await db.pgRun(
            `INSERT INTO work_job_details (company_id, job_id, purchase_bill_id, supplier_id, notes)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (job_id) DO UPDATE SET
                purchase_bill_id = $3, supplier_id = $4, notes = $5, updated_at = NOW()
             RETURNING *`,
            [req.user.active_company_id, req.params.jobId, purchase_bill_id || null, supplier_id || null, notes || null]
        );
        await logAudit(req, { entityType: "work_job_details", entityId: result.rows[0].id, action: "job_details_set", newValue: { supplier_id, purchase_bill_id }, jobId: Number(req.params.jobId) });
        res.json({ success: true, details: result.rows[0] });
    } catch (e) {
        console.error("job details save error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// ============================================================
// JOB ↔ GROUPS
// ============================================================
router.get("/jobs/:jobId/groups", authMiddleware, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT wjg.id AS assignment_id, wjg.group_id, eg.name AS group_name, wjg.assigned_at,
                    u.username AS assigned_by_name,
                    (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = eg.id AND gm.is_active = true) AS member_count
             FROM work_job_groups wjg
             JOIN employee_groups eg ON eg.id = wjg.group_id
             LEFT JOIN users u ON u.id = wjg.assigned_by
             WHERE wjg.job_id = $1 AND wjg.company_id = $2
             ORDER BY eg.name`,
            [req.params.jobId, req.user.active_company_id]
        );
        res.json(rows);
    } catch (e) {
        console.error("job groups fetch error:", e.message);
        res.json([]);
    }
});

router.post("/jobs/:jobId/groups", authMiddleware, requireManager, async (req, res) => {
    try {
        const { group_id } = req.body;
        if (!group_id) return res.json({ success: false, error: "group_id required" });

        const job = await db.pgGet(`SELECT id FROM jobs WHERE id = $1 AND company_id = $2`, [req.params.jobId, req.user.active_company_id]);
        if (!job) return res.json({ success: false, error: "Job not found" });
        const group = await db.pgGet(`SELECT id FROM employee_groups WHERE id = $1 AND company_id = $2 AND is_active = true`, [group_id, req.user.active_company_id]);
        if (!group) return res.json({ success: false, error: "Group not found" });

        const result = await db.pgRun(
            `INSERT INTO work_job_groups (company_id, job_id, group_id, assigned_by)
             VALUES ($1,$2,$3,$4) ON CONFLICT (job_id, group_id) DO NOTHING RETURNING *`,
            [req.user.active_company_id, req.params.jobId, group_id, req.user.id]
        );
        if (result.rows.length === 0) return res.json({ success: false, error: "Group already assigned to this job" });

        await logAudit(req, { entityType: "work_job_groups", entityId: result.rows[0].id, action: "group_assigned_to_job", newValue: { group_id }, jobId: Number(req.params.jobId), groupId: Number(group_id) });
        res.json({ success: true, assignment: result.rows[0] });
    } catch (e) {
        console.error("job group assign error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// ============================================================
// DAILY LOGS
// ============================================================
router.get("/jobs/:jobId/logs", authMiddleware, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT wdl.*, eg.name AS group_name, u.username AS marked_by_name
             FROM work_daily_logs wdl
             JOIN employee_groups eg ON eg.id = wdl.group_id
             LEFT JOIN users u ON u.id = wdl.marked_by_user_id
             WHERE wdl.job_id = $1 AND wdl.company_id = $2
             ORDER BY wdl.log_date DESC, eg.name`,
            [req.params.jobId, req.user.active_company_id]
        );
        res.json(rows);
    } catch (e) {
        console.error("daily logs fetch error:", e.message);
        res.json([]);
    }
});

router.post("/logs", authMiddleware, requireManager, async (req, res) => {
    try {
        const { job_id, group_id, log_date, check_in_time, check_out_time, fresh_pcs, mistake_pcs, notes } = req.body;
        if (!job_id || !group_id || !log_date) return res.json({ success: false, error: "job_id, group_id and log_date are required" });

        const assigned = await db.pgGet(`SELECT id FROM work_job_groups WHERE job_id = $1 AND group_id = $2 AND company_id = $3`, [job_id, group_id, req.user.active_company_id]);
        if (!assigned) return res.json({ success: false, error: "This group is not assigned to this job — assign it first" });

        const members = await db.pgAll(`SELECT employee_id FROM group_members WHERE group_id = $1 AND is_active = true`, [group_id]);
        const memberSnapshot = members.map((m) => m.employee_id);
        const otHours = computeOtHours(check_out_time);

        const result = await db.pgRun(
            `INSERT INTO work_daily_logs
                (company_id, job_id, group_id, log_date, marked_by_user_id, check_in_time, check_out_time,
                 fresh_pcs, mistake_pcs, ot_hours, ot_amount, member_snapshot, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,$12)
             RETURNING *`,
            [
                req.user.active_company_id, job_id, group_id, log_date, req.user.id,
                check_in_time || null, check_out_time || null,
                Number(fresh_pcs) || 0, Number(mistake_pcs) || 0, otHours,
                JSON.stringify(memberSnapshot), notes || null,
            ]
        );
        await logAudit(req, { entityType: "work_daily_logs", entityId: result.rows[0].id, action: "daily_log_created", newValue: { log_date, fresh_pcs, mistake_pcs, ot_hours: otHours }, jobId: Number(job_id), groupId: Number(group_id) });
        res.json({ success: true, log: result.rows[0] });
    } catch (e) {
        if (e.message?.includes("duplicate key")) {
            return res.json({ success: false, error: "A log already exists for this job, group and date. Edit it instead." });
        }
        console.error("daily log create error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

router.put("/logs/:id", authMiddleware, requireManager, async (req, res) => {
    try {
        const { check_in_time, check_out_time, fresh_pcs, mistake_pcs, notes } = req.body;
        const existing = await db.pgGet(`SELECT * FROM work_daily_logs WHERE id = $1 AND company_id = $2`, [req.params.id, req.user.active_company_id]);
        if (!existing) return res.json({ success: false, error: "Log entry not found" });

        const otHours = computeOtHours(check_out_time !== undefined ? check_out_time : existing.check_out_time);

        const result = await db.pgRun(
            `UPDATE work_daily_logs SET
                check_in_time = $1, check_out_time = $2, fresh_pcs = $3, mistake_pcs = $4,
                ot_hours = $5, notes = $6, updated_at = NOW()
             WHERE id = $7 RETURNING *`,
            [
                check_in_time !== undefined ? check_in_time : existing.check_in_time,
                check_out_time !== undefined ? check_out_time : existing.check_out_time,
                fresh_pcs !== undefined ? Number(fresh_pcs) : existing.fresh_pcs,
                mistake_pcs !== undefined ? Number(mistake_pcs) : existing.mistake_pcs,
                otHours,
                notes !== undefined ? notes : existing.notes,
                req.params.id,
            ]
        );
        await logAudit(req, { entityType: "work_daily_logs", entityId: Number(req.params.id), action: "daily_log_edited", oldValue: existing, newValue: result.rows[0], jobId: existing.job_id, groupId: existing.group_id });
        res.json({ success: true, log: result.rows[0] });
    } catch (e) {
        console.error("daily log edit error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// ============================================================
// SUPPLIER DEAL TERMS — extends suppliers via a side table only
// ============================================================
router.get("/supplier-deal-terms", authMiddleware, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT s.id AS supplier_id, s.name AS supplier_name,
                    COALESCE(sdt.mistake_pcs_allowed, false) AS mistake_pcs_allowed, sdt.notes
             FROM suppliers s
             LEFT JOIN supplier_deal_terms sdt ON sdt.supplier_id = s.id
             WHERE s.company_id = $1
             ORDER BY s.name`,
            [req.user.active_company_id]
        );
        res.json(rows);
    } catch (e) {
        console.error("supplier deal terms fetch error:", e.message);
        res.json([]);
    }
});

router.put("/supplier-deal-terms/:supplierId", authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { mistake_pcs_allowed, notes } = req.body;
        const supplier = await db.pgGet(`SELECT id FROM suppliers WHERE id = $1 AND company_id = $2`, [req.params.supplierId, req.user.active_company_id]);
        if (!supplier) return res.json({ success: false, error: "Supplier not found" });

        const result = await db.pgRun(
            `INSERT INTO supplier_deal_terms (company_id, supplier_id, mistake_pcs_allowed, notes)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (supplier_id) DO UPDATE SET mistake_pcs_allowed = $3, notes = $4, updated_at = NOW()
             RETURNING *`,
            [req.user.active_company_id, req.params.supplierId, !!mistake_pcs_allowed, notes || null]
        );
        await logAudit(req, { entityType: "supplier_deal_terms", entityId: result.rows[0].id, action: "supplier_deal_term_updated", newValue: { mistake_pcs_allowed } });
        res.json({ success: true, term: result.rows[0] });
    } catch (e) {
        console.error("supplier deal term save error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

export default router;
