import express from "express";
import * as db from "../database/pg.js";
import { checkCustomerAuth } from "../middlewares/checkCustomerAuth.js";

const router = express.Router();

// 1. GET CATALOG (Safe Product View - No Cost Price)
router.get("/catalog", checkCustomerAuth, async (req, res) => {
    try {
        const sql = `
            SELECT id, product_name, description, sale_price, image_url, sku, current_stock 
            FROM products 
            WHERE is_active = 1
        `;
        const data = await db.pgAll(sql);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Failed to load catalog" });
    }
});

// 2. GET MY LEDGER SUMMARY & HISTORY
router.get("/my-ledger", checkCustomerAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch Transactions (Invoices)
        const historySql = `
            SELECT 
                id, invoice_number, invoice_date, total_amount, paid_amount, status, file_url
            FROM invoices 
            WHERE customer_id = $1 
            ORDER BY invoice_date DESC
        `;
        const transactions = await db.pgAll(historySql, [userId]);

        // Calculate Totals
        const summarySql = `
            SELECT 
                COALESCE(SUM(total_amount), 0) as total_billed,
                COALESCE(SUM(paid_amount), 0) as total_paid
            FROM invoices 
            WHERE customer_id = $1 AND status != 'Void'
        `;
        const summary = await db.pgGet(summarySql, [userId]);

        const totalBilled = Number(summary.total_billed);
        const totalPaid = Number(summary.total_paid);
        const balancePending = totalBilled - totalPaid;

        res.json({
            summary: {
                total_billed: totalBilled,
                total_paid: totalPaid,
                balance_pending: balancePending
            },
            transactions
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load ledger" });
    }
});

export default router;