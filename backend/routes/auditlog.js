// backend/routes/auditlog.js
// Read-only viewer for the existing `audit_logs` table, which is already
// populated automatically by Postgres triggers (audit_log_changes()) on
// invoices and products. New, additive route file — no schema changes.
import express from "express";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import * as db from "../database/pg.js";

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
    try {
        const role = req.user?.role?.toLowerCase();
        const companyId = req.user?.active_company_id;
        if (!["admin", "superadmin"].includes(role) || !companyId) {
            return res.status(403).json({ error: "Admin only." });
        }

        const { module, user_id, from, to, page = 1 } = req.query;
        const limit = 50;
        const offset = (parseInt(page) - 1) * limit;

        const conditions = ["al.company_id = $1"];
        const params = [companyId];

        if (module) { params.push(module); conditions.push(`al.table_name = $${params.length}`); }
        if (user_id) { params.push(user_id); conditions.push(`al.user_id = $${params.length}`); }
        if (from) { params.push(from); conditions.push(`al.created_at::date >= $${params.length}`); }
        if (to) { params.push(to); conditions.push(`al.created_at::date <= $${params.length}`); }

        const where = `WHERE ${conditions.join(" AND ")}`;

        const listParams = [...params, limit, offset];
        const logs = await db.pgAll(
            `SELECT al.*, COALESCE(u.nickname, u.username) AS user_name
             FROM audit_logs al
             LEFT JOIN users u ON al.user_id = u.id
             ${where}
             ORDER BY al.created_at DESC
             LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
            listParams
        );

        const countRow = await db.pgGet(
            `SELECT COUNT(*) FROM audit_logs al ${where}`,
            params
        );
        const total = parseInt(countRow?.count) || 0;

        res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (e) {
        console.error("Audit log fetch error:", e.message);
        res.json({ logs: [], total: 0, page: 1, pages: 0 });
    }
});

// GET /api/audit-log/modules — distinct table_name values this company has entries for
router.get("/modules", authMiddleware, async (req, res) => {
    try {
        const role = req.user?.role?.toLowerCase();
        const companyId = req.user?.active_company_id;
        if (!["admin", "superadmin"].includes(role) || !companyId) {
            return res.status(403).json({ error: "Admin only." });
        }
        const rows = await db.pgAll(
            "SELECT DISTINCT table_name FROM audit_logs WHERE company_id = $1 ORDER BY table_name",
            [companyId]
        );
        res.json({ modules: rows.map((r) => r.table_name) });
    } catch (e) {
        res.json({ modules: [] });
    }
});

export default router;
