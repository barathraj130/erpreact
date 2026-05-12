// backend/routes/testRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * 🧹 TEST DATA CLEANUP
 * Deletes all records where name/reference starts with 'TEST_'
 * Only callable by Admin
 */
router.post('/cleanup', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Access denied. Admins only." });
    }

    const companyId = req.user.active_company_id;
    
    try {
        const client = await db.getClient();

        // 1. Identify all TEST users and their IDs
        const testUsers = await client.query(`SELECT id FROM users WHERE company_id = $1 AND (username LIKE 'TEST_%' OR nickname LIKE 'TEST_%' OR phone LIKE 'TEST_%')`, [companyId]);
        const testUserIds = testUsers.rows.map(u => u.id);

        // 2. Child tables first (reordering for safety)
        const targets = [
            { table: 'transaction_lines', column: 'description' },
            { table: 'transactions', column: 'description' },
            { table: 'invoice_line_items', column: 'product_name' },
            { table: 'invoices', column: 'invoice_number' },
            { table: 'purchase_bills', column: 'bill_number' },
            { table: 'inventory_movements', column: 'note' },
            { table: 'attendance', column: 'status' },
            { table: 'payroll_runs', column: 'month_year' },
            { table: 'chit_installments', column: 'notes' },
            { table: 'loan_payments', column: 'notes' },
            { table: 'loans', column: 'party_name' },
            { table: 'chit_groups', column: 'group_name' },
            { table: 'suppliers', column: 'name' },
            { table: 'products', column: 'name' },
            { table: 'brokers', column: 'broker_name' },
            { table: 'lenders', column: 'lender_name' },
            { table: 'employees', column: 'name' }
        ];

        const results = {};

        // 3. Delete transactions linked to test users (even if description doesn't start with TEST_)
        if (testUserIds.length > 0) {
            const delLines = await client.query(`DELETE FROM transaction_lines WHERE transaction_id IN (SELECT id FROM transactions WHERE company_id = $1 AND (user_id = ANY($2) OR created_by = ANY($2)))`, [companyId, testUserIds]);
            const delTx = await client.query(`DELETE FROM transactions WHERE company_id = $1 AND (user_id = ANY($2) OR created_by = ANY($2))`, [companyId, testUserIds]);
            results['deleted_user_transactions'] = delTx.rowCount;
        }

        // 4. Standard cleanup loop
        for (const target of targets) {
            try {
                const tableCheck = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_name = $1`, [target.table]);
                if (tableCheck.rowCount > 0) {
                    const sql = `DELETE FROM ${target.table} WHERE company_id = $1 AND ${target.column} LIKE 'TEST_%'`;
                    const result = await client.query(sql, [companyId]);
                    results[`deleted_${target.table}`] = result.rowCount;
                }
            } catch (e) {
                console.warn(`Skipping cleanup for ${target.table}: ${e.message}`);
            }
        }

        // 5. Finally delete users
        const userResult = await client.query(`DELETE FROM users WHERE company_id = $1 AND (username LIKE 'TEST_%' OR nickname LIKE 'TEST_%' OR phone LIKE 'TEST_%')`, [companyId]);
        results[`deleted_users`] = userResult.rowCount;

        client.release();

        res.json({ message: "Cleanup successful", results });
    } catch (err) {
        console.error("❌ Cleanup failed:", err);
        res.status(500).json({ error: "Cleanup failed: " + err.message });
    }
});

export default router;
