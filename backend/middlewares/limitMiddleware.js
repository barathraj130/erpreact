// backend/middlewares/limitMiddleware.js
import * as db from '../database/pg.js';

/**
 * 🏢 BRANCH LIMIT MIDDLEWARE
 * Prevents adding more branches than allowed by subscription.
 */
export const checkBranchLimit = async (req, res, next) => {
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Tenant context required." });

    try {
        // 1. Get Subscription Limits
        const sub = await db.pgGet(`
            SELECT s.max_branches 
            FROM companies c 
            JOIN subscriptions s ON c.subscription_id = s.id 
            WHERE c.id = $1
        `, [companyId]);

        if (!sub) return next(); // No subscription found, bypass (or strict reject)

        // 2. Count Existing Branches
        const countRes = await db.pgGet('SELECT COUNT(*) as total FROM branches WHERE company_id = $1', [companyId]);
        const totalBranches = parseInt(countRes.total);

        if (totalBranches >= sub.max_branches) {
            return res.status(403).json({ 
                error: `Plan Limit Reached: Your current plan only allows ${sub.max_branches} branches.`,
                code: "LIMIT_REACHED"
            });
        }

        next();
    } catch (err) {
        console.error("Limit Check Error:", err);
        res.status(500).json({ error: "Internal server error during limit verification." });
    }
};

/**
 * 👤 USER LIMIT MIDDLEWARE
 */
export const checkUserLimit = async (req, res, next) => {
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Tenant context required." });

    try {
        const sub = await db.pgGet(`
            SELECT s.max_users 
            FROM companies c 
            JOIN subscriptions s ON c.subscription_id = s.id 
            WHERE c.id = $1
        `, [companyId]);

        if (!sub) return next();

        const countRes = await db.pgGet('SELECT COUNT(*) as total FROM users WHERE company_id = $1', [companyId]);
        const totalUsers = parseInt(countRes.total);

        if (totalUsers >= sub.max_users) {
            return res.status(403).json({ 
                error: `Plan Limit Reached: Your current plan only allows ${sub.max_users} users.`,
                code: "LIMIT_REACHED"
            });
        }

        next();
    } catch (err) {
        console.error("Limit Check Error:", err);
        res.status(500).json({ error: "Internal server error." });
    }
};
