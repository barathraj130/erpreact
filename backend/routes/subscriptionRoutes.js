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

export default router;
