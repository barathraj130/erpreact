import express from "express";
import * as db from "../database/pg.js";
import { checkCustomerAuth } from "../middlewares/checkCustomerAuth.js";

const router = express.Router();

// 1. GET CATALOG (Safe Product View - No Cost Price)
router.get("/catalog", checkCustomerAuth, async (req, res) => {
    try {
        const sql = `
            SELECT id, name, description, selling_price, image_url, sku, current_stock 
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

// 3. POST ENQUIRY
router.post("/enquiry", checkCustomerAuth, async (req, res) => {
    try {
        const { product_id, product_name, qty, unit, message } = req.body;
        const customerId = req.user.id;
        const companyId = req.user.company_id || req.user.active_company_id || 1;
        
        await db.pgRun(`
            INSERT INTO customer_notifications (company_id, customer_id, type, message, details)
            VALUES ($1, $2, 'ENQUIRY', $3, $4)
        `, [companyId, customerId, `Enquiry: ${req.user.username} wants ${qty} ${unit} of ${product_name}`, JSON.stringify({ product_id, product_name, qty, unit, message })]);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to send enquiry" });
    }
});

// 4. POST MESSAGE
router.post("/message", checkCustomerAuth, async (req, res) => {
    try {
        const { subject, message } = req.body;
        const customerId = req.user.id;
        const companyId = req.user.company_id || req.user.active_company_id || 1;
        
        await db.pgRun(`
            INSERT INTO customer_notifications (company_id, customer_id, type, message, details)
            VALUES ($1, $2, 'MESSAGE', $3, $4)
        `, [companyId, customerId, `Message from ${req.user.username}: ${subject}`, JSON.stringify({ subject, message })]);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to send message" });
    }
});

// 5. POST LOG ACTIVITY
router.post("/activity", checkCustomerAuth, async (req, res) => {
    try {
        const { activity } = req.body;
        const customerId = req.user.id;
        const companyId = req.user.company_id || req.user.active_company_id || 1;
        
        await db.pgRun(`
            INSERT INTO customer_notifications (company_id, customer_id, type, message, details)
            VALUES ($1, $2, 'ACTIVITY', $3, $4)
        `, [companyId, customerId, `${req.user.username} ${activity}`, JSON.stringify({ activity })]);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to log activity" });
    }
});

export default router;