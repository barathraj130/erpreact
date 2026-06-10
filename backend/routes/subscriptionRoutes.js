// backend/routes/subscriptionRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

// --- PLAN & ENTITY MANAGEMENT ---

// GET all plans
router.get('/plans', authMiddleware, async (req, res) => {
    try {
        const plans = await db.pgAll('SELECT * FROM subscriptions ORDER BY id ASC');
        res.json(plans);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch plans." });
    }
});

// GET all companies with their subscription info
router.get('/companies', authMiddleware, async (req, res) => {
    if (req.user?.role?.toLowerCase() !== 'superadmin') return res.status(403).json({ error: "Access denied." });
    try {
        const sql = `
            SELECT 
                c.*, 
                s.plan_name, s.status as sub_status, s.expiry_date,
                s.max_branches, s.max_users,
                (SELECT COUNT(*) FROM branches WHERE company_id = c.id) as active_branches,
                (SELECT COUNT(*) FROM users WHERE company_id = c.id) as active_users
            FROM companies c
            LEFT JOIN subscriptions s ON c.subscription_id = s.id
            ORDER BY c.created_at DESC
        `;
        const companies = await db.pgAll(sql);
        res.json(companies);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch companies." });
    }
});
// --- TENANT LIFECYCLE MANAGEMENT (Stage 9) ---

// PUT update company subscription/limits
router.put('/companies/:id', authMiddleware, async (req, res) => {
    if (req.user?.role?.toLowerCase() !== 'superadmin') {
        return res.status(403).json({ error: "Unauthorized." });
    }

    const { id } = req.params;
    const { is_active, subscription_id, max_branches, max_users, enabled_modules, expiry_date } = req.body;

    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        // Update Company Status
        if (is_active !== undefined) {
            await client.query('UPDATE companies SET is_active = $1 WHERE id = $2', [is_active, id]);
        }

        // Update Linked Subscription Record
        if (subscription_id) {
            const sql = `
                UPDATE subscriptions 
                SET max_branches = COALESCE($1, max_branches),
                    max_users = COALESCE($2, max_users),
                    enabled_modules = COALESCE($3, enabled_modules),
                    expiry_date = COALESCE($4, expiry_date)
                WHERE id = $5
            `;
            await client.query(sql, [max_branches, max_users, enabled_modules, expiry_date, subscription_id]);
        }

        await client.query('COMMIT');
        res.json({ message: "Tenant governance updated successfully." });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("Governance Error:", error);
        res.status(500).json({ error: "Failed to update tenant configuration." });
    } finally {
        if (client) client.release();
    }
});

// POST assign subscription to company
router.post('/assign', authMiddleware, async (req, res) => {
    if (req.user?.role?.toLowerCase() !== 'superadmin') return res.status(403).json({ error: "Access denied." });
    const { company_id, subscription_id } = req.body;
    
    try {
        await db.pgRun('UPDATE companies SET subscription_id = $1 WHERE id = $2', [subscription_id, company_id]);
        res.json({ message: "Subscription assigned successfully." });
    } catch (error) {
        res.status(500).json({ error: "Failed to assign subscription." });
    }
});

/**
 * 🗑️ DELETE TENANT (Global Administration)
 * Only accessible by 'superadmin'
 */
router.delete('/companies/:id', authMiddleware, async (req, res) => {
    if (req.user?.role?.toLowerCase() !== 'superadmin') {
        return res.status(403).json({ error: "Unauthorized. Superadmin only." });
    }

    const { id } = req.params;
    let client;

    try {
        client = await db.getClient();
        await client.query('BEGIN');

        // 1. Get Subscription ID before deleting company
        const companyRes = await client.query('SELECT subscription_id FROM companies WHERE id = $1', [id]);
        if (companyRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Company not found." });
        }
        const subscriptionId = companyRes.rows[0].subscription_id;

        // --- CASCADE DELETE ALL DEPENDENT DATA ---
        
        // 2. Finance & Transactions
        await client.query('DELETE FROM transaction_lines WHERE transaction_id IN (SELECT id FROM transactions WHERE company_id = $1)', [id]);
        await client.query('DELETE FROM ledger_entries WHERE company_id = $1', [id]);
        await client.query('DELETE FROM transactions WHERE company_id = $1', [id]);
        await client.query('DELETE FROM ledgers WHERE company_id = $1', [id]);
        await client.query('DELETE FROM ledger_groups WHERE company_id = $1', [id]);
        await client.query('DELETE FROM chart_of_accounts WHERE company_id = $1', [id]);
        
        // 3. Sales & Purchases
        await client.query('DELETE FROM invoice_line_items WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = $1)', [id]);
        await client.query('DELETE FROM invoice_payments WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = $1)', [id]);
        await client.query('DELETE FROM invoices WHERE company_id = $1', [id]);
        await client.query('DELETE FROM purchase_bill_items WHERE bill_id IN (SELECT id FROM purchase_bills WHERE company_id = $1)', [id]);
        await client.query('DELETE FROM purchase_bills WHERE company_id = $1', [id]);
        
        // 4. Products & Inventory
        await client.query('DELETE FROM product_suppliers WHERE product_id IN (SELECT id FROM products WHERE company_id = $1)', [id]);
        await client.query('DELETE FROM products WHERE company_id = $1', [id]);
        await client.query('DELETE FROM stock_units WHERE company_id = $1', [id]);
        
        // 5. HR & Payroll
        await client.query('DELETE FROM attendance_logs WHERE company_id = $1', [id]);
        await client.query('DELETE FROM payroll_runs WHERE company_id = $1', [id]);
        await client.query('DELETE FROM advance_repayments WHERE advance_id IN (SELECT id FROM salary_advances WHERE company_id = $1)', [id]);
        await client.query('DELETE FROM salary_advances WHERE company_id = $1', [id]);
        await client.query('DELETE FROM employees WHERE company_id = $1', [id]);
        
        // 6. Others
        await client.query('DELETE FROM bank_details WHERE company_id = $1', [id]);
        await client.query('DELETE FROM business_agreements WHERE company_id = $1', [id]);
        await client.query('DELETE FROM constraint_actions WHERE company_id = $1', [id]);
        await client.query('DELETE FROM constraints WHERE company_id = $1', [id]);
        await client.query('DELETE FROM throughput_metrics WHERE company_id = $1', [id]);
        await client.query('DELETE FROM audit_log WHERE entity_id = $1 AND entity_type = \'company\'', [id]);
        
        // 7. Core Identity (Users, Branches, Company, Subs)
        await client.query('DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE company_id = $1)', [id]);
        await client.query('DELETE FROM user_companies WHERE company_id = $1', [id]);
        await client.query('DELETE FROM users WHERE company_id = $1', [id]);
        await client.query('DELETE FROM branches WHERE company_id = $1', [id]);
        await client.query('DELETE FROM companies WHERE id = $1', [id]);

        if (subscriptionId) {
            await client.query('DELETE FROM subscriptions WHERE id = $1', [subscriptionId]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Tenant and all associated data deleted successfully." });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("❌ Tenant Deletion Failed:", error);
        res.status(500).json({ error: "Failed to delete tenant. Data may be linked to other records." });
    } finally {
        if (client) client.release();
    }
});

export default router;
