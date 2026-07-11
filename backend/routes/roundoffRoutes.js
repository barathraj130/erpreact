// backend/routes/roundoffRoutes.js
// Strict branch billing controls — Rule 3: no discount/round-off directly at
// branch level. A branch billing user can only *request* a round-off; it only
// takes effect on the invoice once an admin approves it.
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

// POST /roundoff/request — branch billing role requests a round-off on an invoice
router.post("/request", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId = req.user.branch_id;
    const userId = req.user.id;
    const { invoice_id, customer_id, original_amount, requested_roundoff, reason } = req.body;

    try {
        if (!reason || reason.trim().length < 5) {
            return res.json({ success: false, error: "Reason required for round off request" });
        }
        const roundoff = parseFloat(requested_roundoff);
        const original = parseFloat(original_amount);
        if (isNaN(roundoff) || roundoff <= 0) {
            return res.json({ success: false, error: "Round off amount must be positive" });
        }
        if (isNaN(original) || roundoff > original * 0.1) {
            return res.json({ success: false, error: "Round off cannot exceed 10% of invoice amount" });
        }

        const existing = await db.pgGet(
            `SELECT id FROM roundoff_requests WHERE invoice_id = $1 AND company_id = $2 AND status = 'pending'`,
            [invoice_id, companyId]
        );
        if (existing) {
            return res.json({ success: false, error: "A round off request already exists for this invoice" });
        }

        const row = await db.pgGet(
            `INSERT INTO roundoff_requests
                (company_id, invoice_id, branch_id, requested_by, customer_id,
                 original_amount, requested_roundoff, requested_final_amount, reason)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING *`,
            [companyId, invoice_id || null, branchId, userId, customer_id || null,
             original, roundoff, original - roundoff, reason.trim()]
        );

        res.json({ success: true, request: row, message: "Round off request sent to head office for approval" });
    } catch (err) {
        console.error("[roundoff/request]", err.message);
        res.json({ success: false, error: err.message });
    }
});

// GET /roundoff/pending — admin sees all pending requests for their company
router.get("/pending", authMiddleware, async (req, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
    const companyId = req.user.active_company_id;
    try {
        const rows = await db.pgAll(`
            SELECT rr.*, b.branch_name, u.username AS requested_by_name,
                   COALESCE(c.nickname, c.username) AS customer_name, i.invoice_number
            FROM roundoff_requests rr
            LEFT JOIN branches b ON b.id = rr.branch_id
            LEFT JOIN users u ON u.id = rr.requested_by
            LEFT JOIN users c ON c.id = rr.customer_id
            LEFT JOIN invoices i ON i.id = rr.invoice_id
            WHERE rr.status = 'pending' AND rr.company_id = $1
            ORDER BY rr.created_at DESC
        `, [companyId]);
        res.json(rows);
    } catch (err) {
        console.error("[roundoff/pending]", err.message);
        res.json([]);
    }
});

// POST /roundoff/:id/approve — admin approves; applies the discount to the invoice
router.post("/:id/approve", authMiddleware, async (req, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
    const companyId = req.user.active_company_id;
    const client = await db.getClient();
    try {
        await client.query("BEGIN");
        const reqRes = await client.query(
            `SELECT * FROM roundoff_requests WHERE id=$1 AND company_id=$2`,
            [req.params.id, companyId]
        );
        const roundoffReq = reqRes.rows[0];
        if (!roundoffReq) throw new Error("Request not found");
        if (roundoffReq.status !== "pending") throw new Error("Already processed");

        await client.query(
            `UPDATE roundoff_requests SET status='approved', approved_by=$1, approved_at=NOW(), updated_at=NOW() WHERE id=$2`,
            [req.user.id, req.params.id]
        );

        if (roundoffReq.invoice_id) {
            await client.query(
                `UPDATE invoices SET
                    discount_amount = COALESCE(discount_amount,0) + $1,
                    total_amount = total_amount - $1,
                    updated_at = NOW()
                 WHERE id = $2 AND company_id = $3`,
                [roundoffReq.requested_roundoff, roundoffReq.invoice_id, companyId]
            );
        }

        await client.query("COMMIT");
        res.json({ success: true, message: "Round off approved and applied to invoice" });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("[roundoff/approve]", err.message);
        res.json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

// POST /roundoff/:id/reject
router.post("/:id/reject", authMiddleware, async (req, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
    const { reason } = req.body;
    if (!reason) return res.json({ success: false, error: "Rejection reason required" });
    try {
        await db.pgRun(
            `UPDATE roundoff_requests SET status='rejected', rejection_reason=$1, approved_by=$2, approved_at=NOW(), updated_at=NOW()
             WHERE id=$3 AND company_id=$4`,
            [reason, req.user.id, req.params.id, req.user.active_company_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

export default router;
