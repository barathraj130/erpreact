// backend/routes/resetRoutes.js
// ADMIN-ONLY: Full ERP data reset for market launch.
// Wipes all transactional + master data for the company.
// Preserves: admin/staff users, company record, branches, roles,
//            permissions, bill format settings, chart of accounts.
//
// Confirm phrase: "RESET FLUXORA"

import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

const CONFIRM_PHRASE = "RESET FLUXORA";

// Each step runs inside its own SAVEPOINT so a missing table / column
// rolls back only that one step — the outer transaction stays alive.
async function safeDel(client, label, sql, params = []) {
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

// ── POST /reset/full ────────────────────────────────────────────────────────
router.post("/full", authMiddleware, async (req, res) => {
    if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
    }

    const { confirm_text } = req.body || {};
    if (confirm_text !== CONFIRM_PHRASE) {
        return res.status(400).json({
            error: `Type exactly "${CONFIRM_PHRASE}" to confirm`,
        });
    }

    const cid = req.user.active_company_id;
    const branchId = req.user.branch_id || 1;
    let client;
    try {
        client = await db.getClient();
        await client.query("BEGIN");

        // ── 1. LEDGER / TRANSACTION LINES ──────────────────────────────────────
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
        await safeDel(client, 'purchase_payments',
            `DELETE FROM purchase_payments WHERE bill_id IN (
                SELECT id FROM purchase_bills WHERE company_id = $1)`, [cid]);
        await safeDel(client, 'purchase_bills',
            `DELETE FROM purchase_bills WHERE company_id = $1`, [cid]);

        // ── 4. ALL TRANSACTIONS / LEDGERS ───────────────────────────────────────
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
        await safeDel(client, 'inventory_qty_reset',
            `UPDATE inventory SET quantity = 0 WHERE company_id = $1`, [cid]);
        await safeDel(client, 'inventory_current_reset',
            `UPDATE inventory SET current_stock = 0 WHERE company_id = $1`, [cid]);
        await safeDel(client, 'branch_inventory_reset',
            `UPDATE branch_inventory SET current_stock = 0 WHERE company_id = $1`, [cid]);

        // ── 6. HR / PAYROLL ─────────────────────────────────────────────────────
        await safeDel(client, 'advance_repayments',
            `DELETE FROM advance_repayments WHERE advance_id IN (
                SELECT id FROM salary_advances WHERE company_id = $1)`, [cid]);
        await safeDel(client, 'salary_advances',
            `DELETE FROM salary_advances WHERE company_id = $1`, [cid]);
        await safeDel(client, 'employee_advances',
            `DELETE FROM employee_advances WHERE employee_id IN (
                SELECT id FROM employees WHERE company_id = $1)`, [cid]);
        await safeDel(client, 'payroll_runs',
            `DELETE FROM payroll_runs WHERE company_id = $1`, [cid]);
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
        await safeDel(client, 'chit_fund_members',
            `DELETE FROM chit_fund_members WHERE company_id = $1`, [cid]);
        await safeDel(client, 'chit_fund_groups',
            `DELETE FROM chit_fund_groups WHERE company_id = $1`, [cid]);

        // ── 8. CUSTOMERS (non-admin/staff users) ────────────────────────────────
        await safeDel(client, 'customer_ledger',
            `DELETE FROM customer_ledger WHERE company_id = $1`, [cid]);
        await safeDel(client, 'customer_points',
            `DELETE FROM customer_points WHERE customer_id IN (
                SELECT id FROM users WHERE company_id = $1)`, [cid]);
        await safeDel(client, 'customer_notifications',
            `DELETE FROM customer_notifications WHERE company_id = $1`, [cid]);
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
        await safeDel(client, 'broker_commissions',
            `DELETE FROM broker_commissions WHERE broker_id IN (
                SELECT id FROM brokers WHERE company_id = $1)`, [cid]);
        await safeDel(client, 'broker_product_rates',
            `DELETE FROM broker_product_rates WHERE broker_id IN (
                SELECT id FROM brokers WHERE company_id = $1)`, [cid]);
        await safeDel(client, 'brokers',
            `DELETE FROM brokers WHERE company_id = $1`, [cid]);
        await safeDel(client, 'lenders',
            `DELETE FROM lenders WHERE company_id = $1`, [cid]);

        // ── 10. INVOICE NUMBER SERIES ───────────────────────────────────────────
        await safeDel(client, 'invoice_sequences',
            `DELETE FROM invoice_sequences WHERE company_id = $1`, [cid]);
        await safeDel(client, 'invoice_number_series',
            `DELETE FROM invoice_number_series WHERE company_id = $1`, [cid]);
        await safeDel(client, 'branch_sequences',
            `UPDATE branches SET bill_sequence = 0 WHERE company_id = $1`, [cid]);

        // ── 11. DROP OLD BROKEN UNIQUE CONSTRAINTS on invoice_number ───────────
        await safeDel(client, 'drop_inv_num_key',
            `ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key`);
        await safeDel(client, 'drop_inv_company_key',
            `ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_company_invoice_number_key`);
        await safeDel(client, 'drop_inv_type_key',
            `ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_company_type_invoice_number_key`);
        await safeDel(client, 'drop_idx_active',
            `DROP INDEX IF EXISTS idx_invoices_company_number_active`);
        await safeDel(client, 'drop_idx_type_num',
            `DROP INDEX IF EXISTS idx_invoices_company_type_number`);

        // ── 12. USER META CLEANUP ───────────────────────────────────────────────
        await safeDel(client, 'user_meta',
            `UPDATE users SET meta = NULL WHERE company_id = $1`, [cid]);

        // ── 13. RESET ALL TABLE ID SEQUENCES to 1 ──────────────────────────────
        const sequences = [
            'invoices_id_seq', 'invoice_line_items_id_seq', 'invoice_payments_id_seq',
            'purchase_bills_id_seq', 'purchase_bill_items_id_seq', 'purchase_payments_id_seq',
            'products_id_seq', 'inventory_id_seq', 'inventory_movements_id_seq',
            'branch_inventory_id_seq',
            'employees_id_seq', 'payroll_runs_id_seq', 'attendance_id_seq',
            'salary_advances_id_seq', 'advance_repayments_id_seq', 'employee_advances_id_seq',
            'loans_id_seq', 'loan_payments_id_seq',
            'chit_groups_id_seq', 'chit_installments_id_seq',
            'transactions_id_seq', 'transaction_lines_id_seq', 'ledger_entries_id_seq',
            'cash_ledger_id_seq', 'bank_ledger_id_seq',
            'customer_ledger_id_seq', 'customer_points_id_seq',
            'invoice_number_series_id_seq', 'invoice_sequences_id_seq',
            'brokers_id_seq', 'suppliers_id_seq', 'lenders_id_seq',
            'stock_requests_id_seq', 'stock_transfers_id_seq',
            'proprietor_transactions_id_seq', 'cash_transfers_id_seq',
        ];
        for (const seq of sequences) {
            await safeDel(client, `seq_${seq}`,
                `ALTER SEQUENCE IF EXISTS ${seq} RESTART WITH 1`);
        }

        // ── 14. SEED FRESH INVOICE NUMBER SERIES ───────────────────────────────
        const yr  = new Date().getFullYear();
        const mon = new Date().getMonth() + 1;
        await safeDel(client, 'seed_invoice_series', `
            INSERT INTO invoice_number_series
                (company_id, bill_type, year, month, last_number)
            VALUES
                ($1, 'TAX',       $2, $3, 0),
                ($1, 'NSB',       $2, $3, 0),
                ($1, 'INV',       $2, $3, 0),
                ($1, 'RET',       $2, $3, 0),
                ($1, 'GFT',       $2, $3, 0)
            ON CONFLICT (company_id, bill_type, year, month)
            DO UPDATE SET last_number = 0
        `, [cid, yr, mon]);

        await client.query("COMMIT");

        res.json({
            success: true,
            message: "✅ ERP data fully wiped. All IDs reset to 1. Invoice series seeded. Ready for market launch!",
        });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("ERP Reset Error:", err.message);
        res.status(500).json({ error: "Reset failed: " + err.message });
    } finally {
        if (client) client.release();
    }
});

// ── POST /reset/opening-balance ─────────────────────────────────────────────
// Enter opening cash and/or bank balance after a fresh reset.
// Records go into cash_ledger / bank_ledger as 'opening_balance' source.
router.post("/opening-balance", authMiddleware, async (req, res) => {
    if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
    }

    const { cash_amount = 0, bank_amount = 0, bank_name = "Main Account", date } = req.body || {};
    const cid      = req.user.active_company_id;
    const branchId = req.user.branch_id || 1;
    const entryDate = date || new Date().toISOString().split('T')[0];
    const cashAmt  = Number(cash_amount) || 0;
    const bankAmt  = Number(bank_amount) || 0;

    if (cashAmt <= 0 && bankAmt <= 0) {
        return res.status(400).json({ error: "Enter at least one balance > 0" });
    }

    let client;
    try {
        client = await db.getClient();
        await client.query("BEGIN");

        if (cashAmt > 0) {
            await client.query(
                `INSERT INTO cash_ledger
                 (company_id, branch_id, source, amount, direction, date)
                 VALUES ($1, $2, 'opening_balance', $3, 'in', $4)`,
                [cid, branchId, cashAmt, entryDate]
            );
        }

        if (bankAmt > 0) {
            await client.query(
                `INSERT INTO bank_ledger
                 (company_id, branch_id, source, amount, direction, bank_name, date)
                 VALUES ($1, $2, 'opening_balance', $3, 'in', $4, $5)`,
                [cid, branchId, bankAmt, bank_name, entryDate]
            );
        }

        await client.query("COMMIT");
        res.json({
            success: true,
            message: `Opening balance saved — Cash: ₹${cashAmt.toLocaleString('en-IN')}, Bank: ₹${bankAmt.toLocaleString('en-IN')}`,
            cash_amount: cashAmt,
            bank_amount: bankAmt,
        });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("[opening-balance]", err.message);
        res.status(500).json({ error: "Failed to save opening balance: " + err.message });
    } finally {
        if (client) client.release();
    }
});

// ── POST /reset/nuclear ─────────────────────────────────────────────────────
// COMPLETE wipe — truncates EVERY table and restarts ALL sequences to 1.
// After this the DB is empty; the user must re-register from scratch.
// Confirm phrase: "DELETE EVERYTHING"
router.post("/nuclear", authMiddleware, async (req, res) => {
    if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
    }
    const { confirm_text } = req.body || {};
    if (confirm_text !== "DELETE EVERYTHING") {
        return res.status(400).json({ error: 'Type exactly "DELETE EVERYTHING" to confirm' });
    }

    let client;
    try {
        client = await db.getClient();

        // Get all user-created tables in the public schema
        const tablesResult = await client.query(`
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        const tables = tablesResult.rows.map(r => r.tablename);

        if (tables.length === 0) {
            return res.json({ success: true, message: "Database already empty." });
        }

        // TRUNCATE all tables at once with CASCADE + RESTART IDENTITY
        const quotedTables = tables.map(t => `"${t}"`).join(', ');
        await client.query(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`);

        console.log(`[nuclear-reset] Wiped ${tables.length} tables: ${tables.join(', ')}`);

        res.json({
            success: true,
            tables_wiped: tables.length,
            message: `✅ Nuclear wipe complete — ${tables.length} tables truncated, all IDs reset to 1. Re-register to start fresh.`,
        });
    } catch (err) {
        console.error("[nuclear-reset] Error:", err.message);
        res.status(500).json({ error: "Nuclear reset failed: " + err.message });
    } finally {
        if (client) client.release();
    }
});

export default router;
