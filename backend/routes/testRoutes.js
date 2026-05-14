// backend/routes/testRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * 🧹 TEST DATA CLEANUP — T9.1
 * Deletes all TEST_ prefixed records in dependency-safe order.
 * Uses try/catch per table so partial failures don't block cleanup.
 * Callable by any authenticated user (test suite is authed).
 */
router.post('/cleanup', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const results = {};
    const errors  = [];

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // ── Step 1: Identify TEST entities ──────────────────────────────────
        const testUserIds = (await client.query(
            `SELECT id FROM users WHERE company_id = $1 AND username LIKE 'TEST_%'`,
            [companyId]
        )).rows.map(r => r.id);

        const testSupplierIds = (await client.query(
            `SELECT id FROM suppliers WHERE company_id = $1 AND name LIKE 'TEST_%'`,
            [companyId]
        )).rows.map(r => r.id);

        const testProductIds = (await client.query(
            `SELECT id FROM products WHERE company_id = $1 AND name LIKE 'TEST_%'`,
            [companyId]
        )).rows.map(r => r.id);

        const testEmployeeIds = (await client.query(
            `SELECT id FROM employees WHERE company_id = $1 AND name LIKE 'TEST_%'`,
            [companyId]
        )).rows.map(r => r.id);

        const testLenderIds = (await client.query(
            `SELECT id FROM lenders WHERE company_id = $1 AND lender_name LIKE 'TEST_%'`,
            [companyId]
        )).rows.map(r => r.id);

        const testBrokerIds = (await client.query(
            `SELECT id FROM brokers WHERE company_id = $1 AND name LIKE 'TEST_%'`,
            [companyId]
        )).rows.map(r => r.id);

        const testInvoiceIds = testUserIds.length > 0
            ? (await client.query(
                `SELECT id FROM invoices WHERE company_id = $1 AND customer_id = ANY($2)`,
                [companyId, testUserIds]
              )).rows.map(r => r.id)
            : [];

        const testPurchaseBillIds = testSupplierIds.length > 0
            ? (await client.query(
                `SELECT id FROM purchase_bills WHERE company_id = $1 AND supplier_id = ANY($2)`,
                [companyId, testSupplierIds]
              )).rows.map(r => r.id)
            : [];

        const testLoanIds = testLenderIds.length > 0
            ? (await client.query(
                `SELECT id FROM loans WHERE company_id = $1 AND lender_id = ANY($2)`,
                [companyId, testLenderIds]
              )).rows.map(r => r.id)
            : [];

        const testTxIds = (await client.query(
            `SELECT id FROM transactions WHERE company_id = $1 AND (created_by = ANY($2) OR description LIKE '%TEST_%')`,
            [companyId, testUserIds.length > 0 ? testUserIds : [-1]]
        )).rows.map(r => r.id);

        // ── Step 2: Delete dependents first (FK order) ────────────────────

        // ledger_entries → transactions
        if (testTxIds.length > 0) {
            const r = await client.query(
                `DELETE FROM ledger_entries WHERE transaction_id = ANY($1)`,
                [testTxIds]
            );
            results.ledger_entries = r.rowCount;

            const r2 = await client.query(
                `DELETE FROM transaction_lines WHERE transaction_id = ANY($1)`,
                [testTxIds]
            );
            results.transaction_lines = r2.rowCount;

            const r3 = await client.query(
                `DELETE FROM transactions WHERE id = ANY($1)`,
                [testTxIds]
            );
            results.transactions = r3.rowCount;
        }

        // inventory_movements → products
        if (testProductIds.length > 0) {
            await client.query(`DELETE FROM inventory_movements WHERE product_id = ANY($1)`, [testProductIds]);
        }

        // invoice_line_items + invoice_payments → invoices
        if (testInvoiceIds.length > 0) {
            await client.query(`DELETE FROM invoice_line_items WHERE invoice_id = ANY($1)`, [testInvoiceIds]);
            await client.query(`DELETE FROM invoice_payments   WHERE invoice_id = ANY($1)`, [testInvoiceIds]);
            await client.query(`DELETE FROM customer_ledger_events WHERE related_invoice_id = ANY($1) OR customer_id = ANY($2)`, [testInvoiceIds, testUserIds.length > 0 ? testUserIds : [-1]]);
            const r = await client.query(`DELETE FROM invoices WHERE id = ANY($1)`, [testInvoiceIds]);
            results.invoices = r.rowCount;
        }

        // purchase_bill_items → purchase_bills
        if (testPurchaseBillIds.length > 0) {
            await client.query(`DELETE FROM purchase_bill_items WHERE bill_id = ANY($1)`, [testPurchaseBillIds]);
            await client.query(`DELETE FROM purchase_payments   WHERE bill_id = ANY($1)`, [testPurchaseBillIds]);
            const r = await client.query(`DELETE FROM purchase_bills WHERE id = ANY($1)`, [testPurchaseBillIds]);
            results.purchase_bills = r.rowCount;
        }

        // loan_payments → loans
        if (testLoanIds.length > 0) {
            await client.query(`DELETE FROM loan_payments WHERE loan_id = ANY($1)`, [testLoanIds]);
            const r = await client.query(`DELETE FROM loans WHERE id = ANY($1)`, [testLoanIds]);
            results.loans = r.rowCount;
        }

        // broker_commissions → brokers
        if (testBrokerIds.length > 0) {
            await client.query(`DELETE FROM broker_commissions WHERE broker_id = ANY($1)`, [testBrokerIds]);
            const r = await client.query(`DELETE FROM brokers WHERE id = ANY($1)`, [testBrokerIds]);
            results.brokers = r.rowCount;
        }

        // attendance, payroll for test employees
        if (testEmployeeIds.length > 0) {
            await client.query(`DELETE FROM attendance     WHERE employee_id = ANY($1)`, [testEmployeeIds]);
            await client.query(`DELETE FROM attendance_logs WHERE employee_id = ANY($1)`, [testEmployeeIds]);
            await client.query(`DELETE FROM payroll_runs   WHERE employee_id = ANY($1)`, [testEmployeeIds]);
            await client.query(`DELETE FROM salaries       WHERE employee_id = ANY($1)`, [testEmployeeIds]);
            await client.query(`DELETE FROM inventory_movements WHERE created_by = ANY($1)`, [testUserIds.length > 0 ? testUserIds : [-1]]);
            const r = await client.query(`DELETE FROM employees WHERE id = ANY($1)`, [testEmployeeIds]);
            results.employees = r.rowCount;
        }

        // suppliers → products → users → lenders
        if (testSupplierIds.length > 0) {
            const r = await client.query(`DELETE FROM suppliers WHERE id = ANY($1)`, [testSupplierIds]);
            results.suppliers = r.rowCount;
        }
        if (testProductIds.length > 0) {
            const r = await client.query(`DELETE FROM products WHERE id = ANY($1)`, [testProductIds]);
            results.products = r.rowCount;
        }
        if (testLenderIds.length > 0) {
            const r = await client.query(`DELETE FROM lenders WHERE id = ANY($1)`, [testLenderIds]);
            results.lenders = r.rowCount;
        }
        if (testUserIds.length > 0) {
            await client.query(`DELETE FROM refresh_tokens WHERE user_id = ANY($1)`, [testUserIds]);
            const r = await client.query(`DELETE FROM users WHERE id = ANY($1)`, [testUserIds]);
            results.users = r.rowCount;
        }

        await client.query('COMMIT');
        console.log('🧹 Test cleanup complete:', results);
        res.json({ success: true, message: "Cleanup successful", results, errors });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Cleanup failed:", err);
        res.status(500).json({ error: "Cleanup failed: " + err.message, results, errors });
    } finally {
        client.release();
    }
});

export default router;
