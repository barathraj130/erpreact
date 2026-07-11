// backend/routes/ledgerCorrectionRoutes.js
// Strict branch billing controls — Rule 6: branch manager can view their branch
// ledger read-only but cannot add/edit/delete entries directly. Any correction
// must be requested here and approved by an admin, who then makes the actual
// ledger change through the existing admin-only ledger tools.
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

// POST /ledger-corrections/request
router.post("/request", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId = req.user.branch_id;
    const userId = req.user.id;
    const { correction_type, description, amount, payment_mode, reference_date } = req.body;

    try {
        if (!correction_type || !description || description.trim().length < 5) {
            return res.json({ success: false, error: "Correction type and a description (min 5 chars) are required" });
        }
        const row = await db.pgGet(
            `INSERT INTO ledger_correction_requests
                (company_id, branch_id, requested_by, correction_type, description, amount, payment_mode, reference_date)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING *`,
            [companyId, branchId, userId, correction_type, description.trim(),
             amount ? parseFloat(amount) : null, payment_mode || null, reference_date || null]
        );
        res.json({ success: true, request: row, message: "Correction request sent to head office" });
    } catch (err) {
        console.error("[ledger-corrections/request]", err.message);
        res.json({ success: false, error: err.message });
    }
});

// GET /ledger-corrections/pending — admin only
router.get("/pending", authMiddleware, async (req, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
    const companyId = req.user.active_company_id;
    try {
        const rows = await db.pgAll(`
            SELECT lcr.*, b.branch_name, u.username AS requested_by_name
            FROM ledger_correction_requests lcr
            LEFT JOIN branches b ON b.id = lcr.branch_id
            LEFT JOIN users u ON u.id = lcr.requested_by
            WHERE lcr.status = 'pending' AND lcr.company_id = $1
            ORDER BY lcr.created_at DESC
        `, [companyId]);
        res.json(rows);
    } catch (err) {
        console.error("[ledger-corrections/pending]", err.message);
        res.json([]);
    }
});

// POST /ledger-corrections/:id/approve — admin acknowledges the request; the
// actual ledger fix is then made manually via the existing admin ledger tools.
router.post("/:id/approve", authMiddleware, async (req, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
    try {
        await db.pgRun(
            `UPDATE ledger_correction_requests SET status='approved', approved_by=$1, approved_at=NOW()
             WHERE id=$2 AND company_id=$3`,
            [req.user.id, req.params.id, req.user.active_company_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// POST /ledger-corrections/:id/reject
router.post("/:id/reject", authMiddleware, async (req, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
    const { reason } = req.body;
    if (!reason) return res.json({ success: false, error: "Rejection reason required" });
    try {
        await db.pgRun(
            `UPDATE ledger_correction_requests SET status='rejected', rejection_reason=$1, approved_by=$2, approved_at=NOW()
             WHERE id=$3 AND company_id=$4`,
            [reason, req.user.id, req.params.id, req.user.active_company_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

export default router;
