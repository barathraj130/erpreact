import express from "express";
import * as db from "../database/pg.js";
import checkPermission from "../middlewares/checkPermission.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import { getPreferences, updatePreferences, getNotificationHistory, createNotification } from "../services/notificationService.js";

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

// ══════════════════════════════════════════════════════════════════════════════
// SMS Notification Recipients — who gets texted on events like attendance being
// marked, at Main Office or any branch. Self-healing table guard, same pattern
// used throughout this codebase for tables schemaUpdates.js might have missed.
// ══════════════════════════════════════════════════════════════════════════════
let smsRecipientsTableEnsured = false;
async function ensureSmsRecipientsTable() {
    if (smsRecipientsTableEnsured) return;
    await db.query(`
        CREATE TABLE IF NOT EXISTS sms_notification_recipients (
            id            SERIAL PRIMARY KEY,
            company_id    INTEGER NOT NULL,
            name          VARCHAR(100) NOT NULL,
            phone_number  VARCHAR(20) NOT NULL,
            is_active     BOOLEAN DEFAULT true,
            created_at    TIMESTAMP DEFAULT NOW()
        )
    `).catch(e => console.warn("[settings] sms_notification_recipients guard:", e.message));
    smsRecipientsTableEnsured = true;
}

router.get("/sms-recipients", authMiddleware, checkPermission("Settings", "access_settings"), async (req, res) => {
    try {
        await ensureSmsRecipientsTable();
        const rows = await db.pgAll(
            `SELECT id, name, phone_number, is_active, created_at
             FROM sms_notification_recipients
             WHERE company_id = $1
             ORDER BY created_at ASC`,
            [req.user.active_company_id]
        );
        res.json(rows);
    } catch (err) {
        console.error("SMS recipients list error:", err);
        res.status(500).json({ error: "Failed to fetch SMS recipients" });
    }
});

router.post("/sms-recipients", authMiddleware, checkPermission("Settings", "access_settings"), async (req, res) => {
    const { name, phone_number } = req.body;
    if (!name?.trim() || !phone_number?.trim()) {
        return res.status(400).json({ error: "Name and phone number are required" });
    }
    try {
        await ensureSmsRecipientsTable();
        const row = await db.pgGet(
            `INSERT INTO sms_notification_recipients (company_id, name, phone_number)
             VALUES ($1, $2, $3) RETURNING id, name, phone_number, is_active, created_at`,
            [req.user.active_company_id, name.trim(), phone_number.trim()]
        );
        res.json(row);
    } catch (err) {
        console.error("SMS recipient add error:", err);
        res.status(500).json({ error: "Failed to add SMS recipient" });
    }
});

router.patch("/sms-recipients/:id", authMiddleware, checkPermission("Settings", "access_settings"), async (req, res) => {
    try {
        await ensureSmsRecipientsTable();
        const result = await db.pgRun(
            `UPDATE sms_notification_recipients SET is_active = $1 WHERE id = $2 AND company_id = $3`,
            [req.body.is_active !== false, req.params.id, req.user.active_company_id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: "Recipient not found" });
        res.json({ success: true });
    } catch (err) {
        console.error("SMS recipient update error:", err);
        res.status(500).json({ error: "Failed to update SMS recipient" });
    }
});

router.delete("/sms-recipients/:id", authMiddleware, checkPermission("Settings", "access_settings"), async (req, res) => {
    try {
        await ensureSmsRecipientsTable();
        const result = await db.pgRun(
            `DELETE FROM sms_notification_recipients WHERE id = $1 AND company_id = $2`,
            [req.params.id, req.user.active_company_id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: "Recipient not found" });
        res.json({ success: true });
    } catch (err) {
        console.error("SMS recipient delete error:", err);
        res.status(500).json({ error: "Failed to delete SMS recipient" });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// SMS notification preferences — master on/off + per-category toggles — and
// history, backed by the centralized notificationService.
// ══════════════════════════════════════════════════════════════════════════════
router.get("/sms-preferences", authMiddleware, checkPermission("Settings", "access_settings"), async (req, res) => {
    try {
        const prefs = await getPreferences(req.user.active_company_id);
        res.json(prefs);
    } catch (err) {
        console.error("SMS preferences fetch error:", err);
        res.status(500).json({ error: "Failed to fetch SMS preferences" });
    }
});

router.patch("/sms-preferences", authMiddleware, checkPermission("Settings", "access_settings"), async (req, res) => {
    try {
        const prefs = await updatePreferences(req.user.active_company_id, req.body || {});
        res.json(prefs);
    } catch (err) {
        console.error("SMS preferences update error:", err);
        res.status(500).json({ error: "Failed to update SMS preferences" });
    }
});

router.get("/sms-history", authMiddleware, checkPermission("Settings", "access_settings"), async (req, res) => {
    try {
        const { status, event_type } = req.query;
        const rows = await getNotificationHistory(req.user.active_company_id, { status, eventType: event_type, limit: 200 });
        res.json(rows);
    } catch (err) {
        console.error("SMS history fetch error:", err);
        res.status(500).json({ error: "Failed to fetch SMS history" });
    }
});

router.post("/sms-test", authMiddleware, checkPermission("Settings", "access_settings"), async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const recipients = await db.pgAll(
            `SELECT phone_number FROM sms_notification_recipients WHERE company_id = $1 AND is_active = true`,
            [companyId]
        );
        if (!recipients.length) {
            return res.status(400).json({ error: "No active recipients — add one first" });
        }
        const notification = await createNotification(companyId, {
            eventType: "SECURITY_ALERT",
            title: "Test SMS",
            message: `Test SMS from your ERP — sent by ${req.user.username || "admin"} at ${new Date().toLocaleString("en-IN")}.`,
            priority: "HIGH",
        });
        res.json({ success: true, notification });
    } catch (err) {
        console.error("SMS test send error:", err);
        res.status(500).json({ error: "Failed to send test SMS" });
    }
});

export default router;