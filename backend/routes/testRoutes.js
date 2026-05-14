// backend/routes/testRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

const TEST_PATTERN = "(^TEST_|TEST_|deep_cust|selenium|_TXN$)";

const ids = (rows) => rows.map((r) => r.id);

const tableExists = async (client, table) => {
    const result = await client.query("SELECT to_regclass($1) AS table_name", [`public.${table}`]);
    return Boolean(result.rows[0]?.table_name);
};

const columnExists = async (client, table, column) => {
    const result = await client.query(
        `SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2`,
        [table, column]
    );
    return result.rowCount > 0;
};

const deleteIfTable = async (client, results, table, where, params = []) => {
    if (!(await tableExists(client, table))) return 0;
    const result = await client.query(`DELETE FROM ${table} WHERE ${where}`, params);
    results[table] = (results[table] || 0) + result.rowCount;
    return result.rowCount;
};

const selectIdsIfTable = async (client, table, where, params = []) => {
    if (!(await tableExists(client, table))) return [];
    const result = await client.query(`SELECT id FROM ${table} WHERE ${where}`, params);
    return ids(result.rows);
};

/**
 * Production-safe test data cleanup.
 * Removes rows created by automated/manual test flows for the active company.
 */
router.post('/cleanup', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const results = {};

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const testUserIds = await selectIdsIfTable(
            client,
            'users',
            `(company_id = $1 OR active_company_id = $1)
             AND (
                username ~* $2
                OR COALESCE(email, '') ~* $2
                OR COALESCE(nickname, '') ~* $2
             )`,
            [companyId, TEST_PATTERN]
        );

        const testSupplierIds = await selectIdsIfTable(
            client,
            'suppliers',
            `company_id = $1 AND name ~* $2`,
            [companyId, TEST_PATTERN]
        );

        const testProductIds = await selectIdsIfTable(
            client,
            'products',
            `company_id = $1
             AND (
                COALESCE(name, '') ~* $2
                OR COALESCE(sku, '') ~* $2
                OR COALESCE(supplier_name, '') ~* $2
             )`,
            [companyId, TEST_PATTERN]
        );

        const testEmployeeIds = await selectIdsIfTable(
            client,
            'employees',
            `company_id = $1 AND name ~* $2`,
            [companyId, TEST_PATTERN]
        );

        const testLenderIds = await selectIdsIfTable(
            client,
            'lenders',
            `company_id = $1 AND lender_name ~* $2`,
            [companyId, TEST_PATTERN]
        );

        const testBrokerIds = await selectIdsIfTable(
            client,
            'brokers',
            `company_id = $1 AND name ~* $2`,
            [companyId, TEST_PATTERN]
        );

        const testChitGroupIds = await selectIdsIfTable(
            client,
            'chit_groups',
            `company_id = $1 AND group_name ~* $2`,
            [companyId, TEST_PATTERN]
        );

        const testInvoiceIds = await selectIdsIfTable(
            client,
            'invoices',
            `company_id = $1
             AND (
                customer_id = ANY($2)
                OR EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.id = invoices.customer_id
                      AND (u.username ~* $3 OR COALESCE(u.nickname, '') ~* $3)
                )
                OR EXISTS (
                    SELECT 1 FROM invoice_line_items ili
                    WHERE ili.invoice_id = invoices.id
                      AND COALESCE(ili.description, '') ~* $3
                )
             )`,
            [companyId, testUserIds.length ? testUserIds : [-1], TEST_PATTERN]
        );

        const testPurchaseBillIds = await selectIdsIfTable(
            client,
            'purchase_bills',
            `company_id = $1
             AND (
                supplier_id = ANY($2)
                OR COALESCE(supplier_name, '') ~* $3
                OR COALESCE(bill_number, '') ~* $3
             )`,
            [companyId, testSupplierIds.length ? testSupplierIds : [-1], TEST_PATTERN]
        );

        const testLoanIds = await selectIdsIfTable(
            client,
            'loans',
            `company_id = $1
             AND (
                lender_id = ANY($2)
                OR COALESCE(party_name, '') ~* $3
             )`,
            [companyId, testLenderIds.length ? testLenderIds : [-1], TEST_PATTERN]
        );

        const hasCreatedBy = await columnExists(client, 'transactions', 'created_by');
        const testTxWhere = hasCreatedBy
            ? `company_id = $1 AND (user_id = ANY($2) OR created_by = ANY($2) OR COALESCE(description, '') ~* $3 OR COALESCE(reference_type, '') ~* $3)`
            : `company_id = $1 AND (user_id = ANY($2) OR COALESCE(description, '') ~* $3 OR COALESCE(reference_type, '') ~* $3)`;
        const testTransactionIds = await selectIdsIfTable(
            client,
            'transactions',
            testTxWhere,
            [companyId, testUserIds.length ? testUserIds : [-1], TEST_PATTERN]
        );

        results.targets = {
            users: testUserIds.length,
            suppliers: testSupplierIds.length,
            products: testProductIds.length,
            employees: testEmployeeIds.length,
            lenders: testLenderIds.length,
            brokers: testBrokerIds.length,
            chit_groups: testChitGroupIds.length,
            invoices: testInvoiceIds.length,
            purchase_bills: testPurchaseBillIds.length,
            loans: testLoanIds.length,
            transactions: testTransactionIds.length
        };

        const userIds = testUserIds.length ? testUserIds : [-1];
        const supplierIds = testSupplierIds.length ? testSupplierIds : [-1];
        const productIds = testProductIds.length ? testProductIds : [-1];
        const employeeIds = testEmployeeIds.length ? testEmployeeIds : [-1];
        const lenderIds = testLenderIds.length ? testLenderIds : [-1];
        const brokerIds = testBrokerIds.length ? testBrokerIds : [-1];
        const chitGroupIds = testChitGroupIds.length ? testChitGroupIds : [-1];
        const invoiceIds = testInvoiceIds.length ? testInvoiceIds : [-1];
        const purchaseBillIds = testPurchaseBillIds.length ? testPurchaseBillIds : [-1];
        const loanIds = testLoanIds.length ? testLoanIds : [-1];
        const transactionIds = testTransactionIds.length ? testTransactionIds : [-1];

        await deleteIfTable(client, results, 'bank_transactions', 'matched_transaction_id = ANY($1)', [transactionIds]);
        await deleteIfTable(client, results, 'transaction_lines', 'transaction_id = ANY($1)', [transactionIds]);
        await deleteIfTable(client, results, 'expenses', 'transaction_id = ANY($1)', [transactionIds]);
        await deleteIfTable(client, results, 'ledger_entries', 'transaction_id = ANY($1)', [transactionIds]);

        await deleteIfTable(client, results, 'invoice_line_items', 'invoice_id = ANY($1) OR product_id = ANY($2) OR COALESCE(description, \'\') ~* $3', [invoiceIds, productIds, TEST_PATTERN]);
        await deleteIfTable(client, results, 'invoice_lines', 'invoice_id = ANY($1)', [invoiceIds]);
        await deleteIfTable(client, results, 'invoice_payments', 'invoice_id = ANY($1)', [invoiceIds]);
        await deleteIfTable(client, results, 'customer_ledger_events', 'related_invoice_id = ANY($1) OR customer_id = ANY($2)', [invoiceIds, userIds]);
        await deleteIfTable(client, results, 'customer_accounts', 'user_id = ANY($1)', [userIds]);
        await deleteIfTable(client, results, 'customer_notifications', 'company_id = $1 AND (customer_id = ANY($2) OR handled_by = ANY($2) OR COALESCE(message, \'\') ~* $3)', [companyId, userIds, TEST_PATTERN]);

        await deleteIfTable(client, results, 'purchase_bill_expenses', 'bill_id = ANY($1)', [purchaseBillIds]);
        await deleteIfTable(client, results, 'purchase_bill_items', 'bill_id = ANY($1) OR product_id = ANY($2)', [purchaseBillIds, productIds]);
        await deleteIfTable(client, results, 'supplier_bill_items', 'bill_id = ANY($1) OR product_id = ANY($2)', [purchaseBillIds, productIds]);
        await deleteIfTable(client, results, 'product_suppliers', 'supplier_id = ANY($1) OR product_id = ANY($2)', [supplierIds, productIds]);

        await deleteIfTable(client, results, 'cash_receipts', 'company_id = $1 AND (loan_id = ANY($2) OR COALESCE(party_name, \'\') ~* $3)', [companyId, loanIds, TEST_PATTERN]);
        await deleteIfTable(client, results, 'loan_payments', 'loan_id = ANY($1)', [loanIds]);
        await deleteIfTable(client, results, 'loan_schedule', 'loan_id = ANY($1)', [loanIds]);

        await deleteIfTable(client, results, 'broker_commissions', 'broker_id = ANY($1)', [brokerIds]);
        await deleteIfTable(client, results, 'broker_product_rates', 'broker_id = ANY($1)', [brokerIds]);
        await deleteIfTable(client, results, 'chit_installments', 'chit_group_id = ANY($1)', [chitGroupIds]);

        await deleteIfTable(client, results, 'attendance', 'employee_id = ANY($1)', [employeeIds]);
        await deleteIfTable(client, results, 'attendance_logs', 'employee_id = ANY($1)', [employeeIds]);
        await deleteIfTable(client, results, 'payroll_runs', 'employee_id = ANY($1)', [employeeIds]);
        await deleteIfTable(client, results, 'salaries', 'employee_id = ANY($1)', [employeeIds]);
        await deleteIfTable(client, results, 'salary_advances', 'employee_id = ANY($1)', [employeeIds]);
        await deleteIfTable(client, results, 'salary_payments', 'employee_id = ANY($1)', [employeeIds]);
        await deleteIfTable(client, results, 'employee_ledger', 'employee_id = ANY($1)', [employeeIds]);
        await deleteIfTable(client, results, 'employee_qr_codes', 'employee_id = ANY($1)', [employeeIds]);

        await deleteIfTable(client, results, 'branch_inventory', 'product_id = ANY($1)', [productIds]);
        await deleteIfTable(client, results, 'inventory_movements', 'product_id = ANY($1)', [productIds]);
        await deleteIfTable(client, results, 'inventory', 'product_id = ANY($1) OR (company_id = $2 AND COALESCE(product_name, \'\') ~* $3)', [productIds, companyId, TEST_PATTERN]);
        await deleteIfTable(client, results, 'stock_requests', 'product_id = ANY($1)', [productIds]);
        await deleteIfTable(client, results, 'stock_transfers', 'product_id = ANY($1)', [productIds]);

        await deleteIfTable(client, results, 'refresh_tokens', 'user_id = ANY($1)', [userIds]);
        await deleteIfTable(client, results, 'notifications', 'user_id = ANY($1) OR COALESCE(message, \'\') ~* $2', [userIds, TEST_PATTERN]);
        await deleteIfTable(client, results, 'user_permissions', 'user_id = ANY($1)', [userIds]);
        await deleteIfTable(client, results, 'audit_log', 'user_id_acting = ANY($1)', [userIds]);
        await deleteIfTable(client, results, 'audit_logs', 'company_id = $1 AND COALESCE(table_name, \'\') ~* $2', [companyId, TEST_PATTERN]);

        await deleteIfTable(client, results, 'invoices', 'id = ANY($1)', [invoiceIds]);
        await deleteIfTable(client, results, 'purchase_bills', 'id = ANY($1)', [purchaseBillIds]);
        await deleteIfTable(client, results, 'loans', 'id = ANY($1)', [loanIds]);
        await deleteIfTable(client, results, 'transactions', 'id = ANY($1)', [transactionIds]);

        await deleteIfTable(client, results, 'brokers', 'id = ANY($1)', [brokerIds]);
        await deleteIfTable(client, results, 'chit_groups', 'id = ANY($1)', [chitGroupIds]);
        await deleteIfTable(client, results, 'lenders', 'id = ANY($1)', [lenderIds]);
        await deleteIfTable(client, results, 'employees', 'id = ANY($1)', [employeeIds]);
        await deleteIfTable(client, results, 'suppliers', 'id = ANY($1)', [supplierIds]);

        await deleteIfTable(client, results, 'ledgers', 'company_id = $1 AND name ~* $2', [companyId, TEST_PATTERN]);
        await deleteIfTable(client, results, 'chart_of_accounts', 'company_id = $1 AND name ~* $2', [companyId, TEST_PATTERN]);
        await deleteIfTable(client, results, 'products', 'id = ANY($1)', [productIds]);
        await deleteIfTable(client, results, 'users', 'id = ANY($1)', [userIds]);

        await client.query('COMMIT');
        res.json({ success: true, message: "Cleanup successful", results });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Cleanup failed:", err);
        res.status(500).json({ error: "Cleanup failed: " + err.message, results });
    } finally {
        client.release();
    }
});

/**
 * Full business data reset for fresh market launch.
 * Preserves: company, users, branches, settings, chart_of_accounts structure.
 * Wipes: all transactions, invoices, purchases, customers (non-admin), suppliers, products, etc.
 */
router.post('/reset-all', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const role = req.user.role;

    if (role !== 'admin' && role !== 'superadmin') {
        return res.status(403).json({ error: 'Only admin can perform a full reset.' });
    }

    const client = await db.getClient();
    const results = {};
    try {
        await client.query('BEGIN');

        const del = async (table, where, params) => {
            if (!(await tableExists(client, table))) return;
            const r = await client.query(`DELETE FROM ${table} WHERE ${where}`, params);
            results[table] = r.rowCount;
        };

        // Ledger entries first (FK deps)
        await del('ledger_entries', 'company_id = $1', [companyId]);
        await del('transaction_lines', 'transaction_id IN (SELECT id FROM transactions WHERE company_id = $1)', [companyId]);
        await del('bank_transactions', 'company_id = $1', [companyId]);

        // Invoice children
        await del('invoice_line_items', 'invoice_id IN (SELECT id FROM invoices WHERE company_id = $1)', [companyId]);
        await del('invoice_lines', 'invoice_id IN (SELECT id FROM invoices WHERE company_id = $1)', [companyId]);
        await del('invoice_payments', 'invoice_id IN (SELECT id FROM invoices WHERE company_id = $1)', [companyId]);

        // Purchase bill children
        await del('purchase_bill_items', 'bill_id IN (SELECT id FROM purchase_bills WHERE company_id = $1)', [companyId]);
        await del('purchase_bill_expenses', 'bill_id IN (SELECT id FROM purchase_bills WHERE company_id = $1)', [companyId]);
        await del('supplier_bill_items', 'bill_id IN (SELECT id FROM purchase_bills WHERE company_id = $1)', [companyId]);

        // Customer data
        await del('customer_ledger_events', 'company_id = $1', [companyId]);
        await del('customer_accounts', 'company_id = $1', [companyId]);
        await del('customer_notifications', 'company_id = $1', [companyId]);

        // Loan data
        await del('loan_payments', 'loan_id IN (SELECT id FROM loans WHERE company_id = $1)', [companyId]);
        await del('loan_schedule', 'loan_id IN (SELECT id FROM loans WHERE company_id = $1)', [companyId]);
        await del('cash_receipts', 'company_id = $1', [companyId]);

        // Chit / broker
        await del('chit_installments', 'chit_group_id IN (SELECT id FROM chit_groups WHERE company_id = $1)', [companyId]);
        await del('broker_commissions', 'broker_id IN (SELECT id FROM brokers WHERE company_id = $1)', [companyId]);
        await del('broker_product_rates', 'broker_id IN (SELECT id FROM brokers WHERE company_id = $1)', [companyId]);

        // HR / payroll
        await del('attendance', 'company_id = $1', [companyId]);
        await del('attendance_logs', 'employee_id IN (SELECT id FROM employees WHERE company_id = $1)', [companyId]);
        await del('payroll_runs', 'employee_id IN (SELECT id FROM employees WHERE company_id = $1)', [companyId]);
        await del('salaries', 'employee_id IN (SELECT id FROM employees WHERE company_id = $1)', [companyId]);
        await del('salary_advances', 'employee_id IN (SELECT id FROM employees WHERE company_id = $1)', [companyId]);
        await del('salary_payments', 'employee_id IN (SELECT id FROM employees WHERE company_id = $1)', [companyId]);
        await del('employee_ledger', 'employee_id IN (SELECT id FROM employees WHERE company_id = $1)', [companyId]);

        // Inventory
        await del('branch_inventory', 'company_id = $1', [companyId]);
        await del('inventory_movements', 'company_id = $1', [companyId]);
        await del('inventory', 'company_id = $1', [companyId]);
        await del('stock_requests', 'company_id = $1', [companyId]);
        await del('stock_transfers', 'company_id = $1', [companyId]);

        // Main tables
        await del('invoices', 'company_id = $1', [companyId]);
        await del('purchase_bills', 'company_id = $1', [companyId]);
        await del('loans', 'company_id = $1', [companyId]);
        await del('transactions', 'company_id = $1', [companyId]);
        await del('chit_groups', 'company_id = $1', [companyId]);
        await del('brokers', 'company_id = $1', [companyId]);
        await del('lenders', 'company_id = $1', [companyId]);
        await del('product_suppliers', 'company_id = $1', [companyId]);
        await del('products', 'company_id = $1', [companyId]);
        await del('suppliers', 'company_id = $1', [companyId]);
        await del('employees', 'company_id = $1', [companyId]);

        // Remove non-admin customers
        await del('users', 'company_id = $1 AND role NOT IN (\'admin\', \'superadmin\', \'manager\', \'accountant\', \'staff\')', [companyId]);

        // Reset ledger balances
        await del('ledgers', 'company_id = $1 AND type NOT IN (\'SYSTEM\', \'COA\')', [companyId]);
        await del('daily_ledger_closings', 'company_id = $1', [companyId]);

        // Reset COA opening balances to 0 (keep structure)
        await client.query(
            `UPDATE chart_of_accounts SET opening_balance = 0, current_balance = 0 WHERE company_id = $1`,
            [companyId]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'All business data cleared. Ready for fresh start.', results });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Reset failed:', err);
        res.status(500).json({ error: 'Reset failed: ' + err.message, results });
    } finally {
        client.release();
    }
});

export default router;
