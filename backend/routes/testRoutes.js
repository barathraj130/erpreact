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

        const targets = [
            { table: 'suppliers', column: 'name' },
            { table: 'products', column: 'name' },
            { table: 'invoices', column: 'invoice_number' },
            { table: 'purchase_bills', column: 'bill_number' },
            { table: 'transactions', column: 'description' },
            { table: 'transaction_lines', column: 'description' },
            { table: 'ledger_entries', column: 'description' },
            { table: 'inventory_movements', column: 'note' },
            { table: 'brokers', column: 'broker_name' },
            { table: 'chit_groups', column: 'group_name' },
            { table: 'lenders', column: 'lender_name' },
            { table: 'employees', column: 'name' }
        ];

        const results = {};

        for (const target of targets) {
            try {
                // Check if table exists first to avoid crashing the transaction
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

        // Special case: users table
        const userSql = `DELETE FROM users WHERE company_id = $1 AND (username LIKE 'TEST_%' OR nickname LIKE 'TEST_%' OR phone LIKE 'TEST_%')`;
        const userResult = await client.query(userSql, [companyId]);
        results[`deleted_users`] = userResult.rowCount;

        client.release();

        res.json({ message: "Cleanup successful", results });
    } catch (err) {
        console.error("❌ Cleanup failed:", err);
        res.status(500).json({ error: "Cleanup failed: " + err.message });
    }
});

export default router;
