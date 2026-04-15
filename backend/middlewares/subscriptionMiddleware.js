// backend/middlewares/subscriptionMiddleware.js
import * as db from '../database/pg.js';

/**
 * Middleware to check if a specific module is enabled for the company
 * @param {string} moduleName - Name of the module (finance, sales, inventory, hr, ai, analytics)
 */
export const checkModule = (moduleName) => {
    return async (req, res, next) => {
        const companyId = req.user?.company_id || req.user?.active_company_id;
        if (!companyId) return res.status(401).json({ error: "No active company context." });

        try {
            // Get company subscription info
            const sql = `
                SELECT s.enabled_modules, s.status, s.expiry_date
                FROM companies c
                JOIN subscriptions s ON c.subscription_id = s.id
                WHERE c.id = $1
            `;
            const subscription = await db.pgGet(sql, [companyId]);

            if (!subscription) {
                return res.status(403).json({ error: "No active subscription found for this company." });
            }

            // Check status and expiry
            if (subscription.status !== 'ACTIVE') {
                return res.status(403).json({ error: `Subscription is ${subscription.status}. Please contact support.` });
            }

            if (subscription.expiry_date && new Date(subscription.expiry_date) < new Date()) {
                return res.status(403).json({ error: "Subscription has expired. Please upgrade to continue." });
            }

            // Check modules
            const enabledModules = subscription.enabled_modules ? subscription.enabled_modules.split(',').map(m => m.trim().toLowerCase()) : [];
            
            if (moduleName && !enabledModules.includes(moduleName.toLowerCase())) {
                return res.status(403).json({ 
                    error: `The '${moduleName}' module is not included in your current plan.`,
                    upgradeRequired: true 
                });
            }

            next();
        } catch (error) {
            console.error("Subscription check error:", error);
            res.status(500).json({ error: "Internal server error during subscription check." });
        }
    };
};

/**
 * Middleware to check usage limits
 * @param {string} limitType - max_branches, max_users, etc.
 */
export const checkLimit = (limitType) => {
    return async (req, res, next) => {
        const companyId = req.user?.company_id || req.user?.active_company_id;
        if (!companyId) return res.status(401).json({ error: "No active company context." });

        try {
            const sql = `
                SELECT s.* 
                FROM companies c
                JOIN subscriptions s ON c.subscription_id = s.id
                WHERE c.id = $1
            `;
            const subscription = await db.pgGet(sql, [companyId]);

            if (!subscription) return res.status(403).json({ error: "No active subscription found." });

            let currentCount = 0;
            let limit = subscription[limitType];

            if (limitType === 'max_branches') {
                const countRes = await db.pgGet('SELECT COUNT(*) as count FROM branches WHERE company_id = $1', [companyId]);
                currentCount = parseInt(countRes.count);
            } else if (limitType === 'max_users') {
                const countRes = await db.pgGet('SELECT COUNT(*) as count FROM users WHERE company_id = $1', [companyId]);
                currentCount = parseInt(countRes.count);
            }

            if (currentCount >= limit) {
                return res.status(403).json({ 
                    error: `Limit reached for ${limitType.replace('max_', '')}. Current: ${currentCount}, Limit: ${limit}`,
                    upgradeRequired: true
                });
            }

            next();
        } catch (error) {
            console.error("Limit check error:", error);
            res.status(500).json({ error: "Internal server error during limit check." });
        }
    };
};
