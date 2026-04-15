import express from "express";
import * as db from "../database/pg.js";
import checkPermission from "../middlewares/checkPermission.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

// 1. GET TAX SUMMARY (Real-time calculation)
router.get("/tax-summary", authMiddleware, checkPermission("Settings", "access_settings"), async (req, res) => {
    const companyId = req.user.active_company_id;
    
    try {
        // Output GST (Sales) - Current Month
        const outputSql = `
            SELECT 
                COALESCE(SUM(total_cgst_amount + total_sgst_amount + total_igst_amount), 0) as total_output_tax
            FROM invoices
            WHERE company_id = $1 
            AND EXTRACT(MONTH FROM invoice_date) = EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(YEAR FROM invoice_date) = EXTRACT(YEAR FROM CURRENT_DATE)
            AND status != 'Void'
        `;
        const outputRes = await db.pgGet(outputSql, [companyId]);

        // Input Tax Credit (Purchases) - Current Month
        // Estimation: 18% of total bill amount is tax (Simplification for dashboard)
        const inputSql = `
            SELECT 
                COALESCE(SUM(total_amount * 0.18 / 1.18), 0) as estimated_input_tax
            FROM purchase_bills
            WHERE company_id = $1 
            AND EXTRACT(MONTH FROM bill_date) = EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(YEAR FROM bill_date) = EXTRACT(YEAR FROM CURRENT_DATE)
        `;
        const inputRes = await db.pgGet(inputSql, [companyId]);

        res.json({
            output_gst: Number(outputRes.total_output_tax),
            input_tax_credit: Number(inputRes.estimated_input_tax),
            tds_payable: 0 // Placeholder
        });

    } catch (err) {
        console.error("Tax summary error:", err);
        res.status(500).json({ error: "Failed to fetch tax summary" });
    }
});

// 2. GET SYSTEM LOGS
router.get("/system-logs", authMiddleware, checkPermission("Settings", "access_settings"), async (req, res) => {
    try {
        const logs = await db.pgAll(`
            SELECT 
                al.timestamp, 
                u.username, 
                al.action, 
                al.ip_address 
            FROM audit_log al
            LEFT JOIN users u ON al.user_id_acting = u.id
            ORDER BY al.timestamp DESC 
            LIMIT 10
        `);
        res.json(logs);
    } catch (err) {
        console.error("Logs error:", err);
        res.status(500).json({ error: "Failed to fetch logs" });
    }
});

// 3. GET STORAGE & DB STATS
router.get("/storage", authMiddleware, checkPermission("Settings", "access_settings"), async (req, res) => {
    try {
        const sizeRes = await db.pgGet(`SELECT pg_size_pretty(pg_database_size(current_database())) as size`);
        
        const counts = await db.pgGet(`
            SELECT 
                (SELECT COUNT(*) FROM invoices) + 
                (SELECT COUNT(*) FROM purchase_bills) + 
                (SELECT COUNT(*) FROM products) +
                (SELECT COUNT(*) FROM users) as record_count
        `);

        res.json({
            db_size: sizeRes.size,
            record_count: Number(counts.record_count)
        });
    } catch (err) {
        console.error("Storage error:", err);
        res.status(500).json({ error: "Failed to fetch storage info" });
    }
});

export default router;