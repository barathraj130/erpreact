// backend/routes/resetRoutes.js
// ADMIN-ONLY: Full ERP data reset
// Wipes all transactional + master data for the company.
// Preserves: admin/staff users, company record, branches, roles,
//            permissions, bill format settings, chart of accounts.

import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

// Each step runs inside its own SAVEPOINT so a missing table / column
// rolls back only that one step — the outer transaction stays alive.
async function safeDel(client, label, sql, params) {
    await client.query(`SAVEPOINT "${label}"`);
    try {
        await client.query(sql, params);
        await client.query(`RELEASE SAVEPOINT "${label}"`);
    } catch (e) {
        await client.query(`ROLLBACK TO SAVEPOINT "${label}"`);
        await client.query(`RELEASE SAVEPOINT "${label}"`);
        console.warn(`[reset] skipped "${label}": ${e.message.split('\n')[0]}`);
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
        await safeDel(client, 'ledger_entries',
            `DELETE FROM ledger_entries WHERE transaction_id IN (
                SELECT id FROM transactions WHERE company_id = $1)`, [cid]);
        await safeDel(client, 'transaction_lines',
            `DELETE FROM transaction_lines WHERE transaction_id IN (
                SELECT id FROM transactions WHERE company_id = $1)`, [cid]);

        // ── 2. SALES ────────────────────────────────────────────────────────────
        await safeDel(client, 'invoice_payments',
            `DELETE FROM invoice_payments WHERE invoice_id IN (
                SELECT id FROM invoices WHERE company_id = $1)`, [cid]);
        await safeDel(client, 'invoice_line_items',
            `DELETE FROM invoice_line_items WHERE invoice_id IN (
                SELECT id FROM invoices WHERE company_id = $1)`, [cid]);
        await safeDel(client, 'invoices',
            `DELETE FROM invoices WHERE company_id = $1`, [cid]);
        await safeDel(client, 'sales_orders',
            `DELETE FROM sales_orders WHERE company_id = $1`, [cid]);

        // ── 3. PURCHASES ────────────────────────────────────────────────────────
        await safeDel(client, 'purchase_bill_items',
            `DELETE FROM purchase_bill_items WHERE bill_id IN (
                SELECT id FROM purchase_bills WHERE company_id = $1)`, [cid]);
        await safeDel(client, 'purchase_bill_expenses',
            `DELETE FROM purchase_bill_expenses WHERE bill_id IN (
                SELECT id FROM purchase_bills WHERE company_id = $1)`, [cid]);
        await safeDel(client, 'purchase_bills',
            `DELETE FROM purchase_bills WHERE company_id = $1`, [cid]);

        // ── 4. ALL TRANSACTIONS ─────────────────────────────────────────────────
        await safeDel(client, 'transactions',
            `DELETE FROM transactions WHERE company_id = $1`, [cid]);
        await safeDel(client, 'cash_ledger',
            `DELETE FROM cash_ledger WHERE company_id = $1`, [cid]);
        await safeDel(client, 'bank_ledger',
            `DELETE FROM bank_ledger WHERE company_id = $1`, [cid]);
        await safeDel(client, 'daily_ledger_closings',
            `DELETE FROM daily_ledger_closings WHERE company_id = $1`, [cid]);
        await safeDel(client, 'proprietor_transactions',
            `DELETE FROM proprietor_transactions WHERE company_id = $1`, [cid]);
        await safeDel(client, 'cash_transfers',
            `DELETE FROM cash_transfers WHERE company_id = $1`, [cid]);

        // ── 5. INVENTORY ────────────────────────────────────────────────────────
        await safeDel(client, 'inventory_movements',
            `DELETE FROM inventory_movements WHERE company_id = $1`, [cid]);
        await safeDel(client, 'stock_requests',
            `DELETE FROM stock_requests WHERE company_id = $1`, [cid]);
        await safeDel(client, 'stock_transfers',
            `DELETE FROM stock_transfers WHERE company_id = $1`, [cid]);
        await safeDel(client, 'products_stock_reset',
            `UPDATE products SET current_stock = 0 WHERE company_id = $1`, [cid]);
        await safeDel(client, 'inventory_reset',
            `UPDATE inventory SET current_stock = 0 WHERE company_id = $1`, [cid]);
        await safeDel(client, 'branch_inventory_reset',
            `UPDATE branch_inventory SET current_stock = 0 WHERE company_id = $1`, [cid]);

        // ── 6. HR / PAYROLL ─────────────────────────────────────────────────────
        await safeDel(client, 'payroll_runs',
            `DELETE FROM payroll_runs WHERE company_id = $1`, [cid]);
        await safeDel(client, 'salary_advances',
            `DELETE FROM salary_advances WHERE company_id = $1`, [cid]);
        await safeDel(client, 'advance_repayments',
            `DELETE FROM advance_repayments WHERE company_id = $1`, [cid]);
        await safeDel(client, 'attendance',
            `DELETE FROM attendance WHERE company_id = $1`, [cid]);
        await safeDel(client, 'attendance_logs',
            `DELETE FROM attendance_logs WHERE company_id = $1`, [cid]);

        // ── 7. FINANCE ──────────────────────────────────────────────────────────
        await safeDel(client, 'loan_payments',
            `DELETE FROM loan_payments WHERE company_id = $1`, [cid]);
        await safeDel(client, 'loans',
            `DELETE FROM loans WHERE company_id = $1`, [cid]);
        await safeDel(client, 'chit_installments',
            `DELETE FROM chit_installments WHERE company_id = $1`, [cid]);
        await safeDel(client, 'chit_groups',
            `DELETE FROM chit_groups WHERE company_id = $1`, [cid]);

        // ── 8. CUSTOMERS (non-admin/staff users) ────────────────────────────────
        await safeDel(client, 'customers',
            `DELETE FROM users WHERE company_id = $1 AND role IN ('customer', 'user')`, [cid]);

        // ── 9. MASTER DATA ──────────────────────────────────────────────────────
        await safeDel(client, 'product_suppliers',
            `DELETE FROM product_suppliers WHERE company_id = $1`, [cid]);
        await safeDel(client, 'branch_inventory_del',
            `DELETE FROM branch_inventory WHERE company_id = $1`, [cid]);
        await safeDel(client, 'inventory_del',
            `DELETE FROM inventory WHERE company_id = $1`, [cid]);
        await safeDel(client, 'products',
            `DELETE FROM products WHERE company_id = $1`, [cid]);
        await safeDel(client, 'suppliers',
            `DELETE FROM suppliers WHERE company_id = $1`, [cid]);
        await safeDel(client, 'employees',
            `DELETE FROM employees WHERE company_id = $1`, [cid]);
        await safeDel(client, 'brokers',
            `DELETE FROM brokers WHERE company_id = $1`, [cid]);
        await safeDel(client, 'lenders',
            `DELETE FROM lenders WHERE company_id = $1`, [cid]);

        // ── 10. NOTIFICATIONS ───────────────────────────────────────────────────
        await safeDel(client, 'customer_notifications',
            `DELETE FROM customer_notifications WHERE company_id = $1`, [cid]);

        // ── 11. RESET BRANCH BILL SEQUENCES ────────────────────────────────────
        await safeDel(client, 'branch_sequences',
            `UPDATE branches SET bill_sequence = 0 WHERE company_id = $1`, [cid]);

        // ── 12. CLEAR USER META (customer ledger pointers on staff) ────────────
        await safeDel(client, 'user_meta',
            `UPDATE users SET meta = NULL WHERE company_id = $1 AND role IN ('admin', 'staff', 'manager')`,
            [cid]);

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
