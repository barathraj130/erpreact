// backend/routes/resetRoutes.js
// ADMIN-ONLY: Full ERP data reset
// Wipes all transactional + master data for the company.
// Preserves: admin/staff users, company record, branches, roles,
//            permissions, bill format settings, chart of accounts.

import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

// Helper: run a DELETE safely — skips if table doesn't exist or has no company_id
async function safeDel(client, sql, params) {
    try {
        await client.query(sql, params);
    } catch (e) {
        // Ignore "table does not exist" or "column does not exist" errors
        if (!e.message.includes('does not exist') && !e.message.includes('undefined_table')) {
            throw e;
        }
        console.warn(`[reset] skipped: ${e.message.split('\n')[0]}`);
    }
}

router.post("/full", authMiddleware, async (req, res) => {
    if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
    }

    const cid = req.user.active_company_id;
    let client;
    try {
        client = await db.getClient();
        await client.query("BEGIN");

        // ── 1. LEDGER ENTRIES (FK dep of transactions) ─────────────────────────
        await safeDel(client, `DELETE FROM ledger_entries WHERE transaction_id IN (
            SELECT id FROM transactions WHERE company_id = $1)`, [cid]);
        await safeDel(client, `DELETE FROM transaction_lines WHERE transaction_id IN (
            SELECT id FROM transactions WHERE company_id = $1)`, [cid]);

        // ── 2. SALES ────────────────────────────────────────────────────────────
        await safeDel(client, `DELETE FROM invoice_payments WHERE invoice_id IN (
            SELECT id FROM invoices WHERE company_id = $1)`, [cid]);
        await safeDel(client, `DELETE FROM invoice_line_items WHERE invoice_id IN (
            SELECT id FROM invoices WHERE company_id = $1)`, [cid]);
        await safeDel(client, `DELETE FROM invoices WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM sales_orders WHERE company_id = $1`, [cid]);

        // ── 3. PURCHASES ────────────────────────────────────────────────────────
        await safeDel(client, `DELETE FROM purchase_bill_items WHERE bill_id IN (
            SELECT id FROM purchase_bills WHERE company_id = $1)`, [cid]);
        await safeDel(client, `DELETE FROM purchase_bill_expenses WHERE bill_id IN (
            SELECT id FROM purchase_bills WHERE company_id = $1)`, [cid]);
        await safeDel(client, `DELETE FROM purchase_bills WHERE company_id = $1`, [cid]);

        // ── 4. ALL TRANSACTIONS ─────────────────────────────────────────────────
        await safeDel(client, `DELETE FROM transactions WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM cash_ledger WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM bank_ledger WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM daily_ledger_closings WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM proprietor_transactions WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM cash_transfers WHERE company_id = $1`, [cid]);

        // ── 5. INVENTORY ────────────────────────────────────────────────────────
        await safeDel(client, `DELETE FROM inventory_movements WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM stock_requests WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM stock_transfers WHERE company_id = $1`, [cid]);
        await safeDel(client, `UPDATE products SET current_stock = 0 WHERE company_id = $1`, [cid]);
        await safeDel(client, `UPDATE inventory SET current_stock = 0 WHERE company_id = $1`, [cid]);
        await safeDel(client, `UPDATE branch_inventory SET current_stock = 0 WHERE company_id = $1`, [cid]);

        // ── 6. HR / PAYROLL ─────────────────────────────────────────────────────
        await safeDel(client, `DELETE FROM payroll_runs WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM salary_advances WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM advance_repayments WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM attendance WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM attendance_logs WHERE company_id = $1`, [cid]);

        // ── 7. FINANCE ──────────────────────────────────────────────────────────
        await safeDel(client, `DELETE FROM loan_payments WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM loans WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM chit_installments WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM chit_groups WHERE company_id = $1`, [cid]);

        // ── 8. CUSTOMERS (non-admin/staff users) ────────────────────────────────
        await safeDel(client,
            `DELETE FROM users WHERE company_id = $1 AND role IN ('customer', 'user')`, [cid]);

        // ── 9. MASTER DATA ──────────────────────────────────────────────────────
        await safeDel(client, `DELETE FROM product_suppliers WHERE company_id = $1`, [cid]);
        // inventory must go before products (FK)
        await safeDel(client, `DELETE FROM branch_inventory WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM inventory WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM products WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM suppliers WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM employees WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM brokers WHERE company_id = $1`, [cid]);
        await safeDel(client, `DELETE FROM lenders WHERE company_id = $1`, [cid]);

        // ── 10. NOTIFICATIONS ───────────────────────────────────────────────────
        await safeDel(client, `DELETE FROM customer_notifications WHERE company_id = $1`, [cid]);

        // ── 11. RESET BRANCH BILL SEQUENCES ────────────────────────────────────
        await client.query(
            `UPDATE branches SET bill_sequence = 0 WHERE company_id = $1`, [cid]);

        // ── 12. CLEAR USER META (customer ledger pointers on staff) ────────────
        await client.query(
            `UPDATE users SET meta = NULL WHERE company_id = $1 AND role IN ('admin', 'staff', 'manager')`,
            [cid]
        );

        await client.query("COMMIT");

        res.json({
            success: true,
            message: "ERP fully reset. Preserved: company setup, admin/staff users, branches, roles, permissions, bill format, and chart of accounts."
        });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("ERP Reset Error:", err.message);
        res.status(500).json({ error: "Reset failed: " + err.message });
    } finally {
        if (client) client.release();
    }
});

export default router;
