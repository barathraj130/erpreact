import db from "../database/pg.js";

export default function checkPermission(module, action) {
    return async (req, res, next) => {
        try {
            // Admin bypass - always allow
            if (req.user.role === 'admin') return next();

            // 1. Get user's role ID from the DB (safer than trusting JWT payload for critical checks)
            const userRes = await db.pgGet("SELECT role_id FROM users WHERE id = $1", [req.user.id]);
            if (!userRes || !userRes.role_id) {
                return res.status(403).json({ error: "Access Denied. No role assigned." });
            }

            // 2. Check if this role has the required permission
            const result = await db.pgGet(`
                SELECT 1 
                FROM role_permissions rp
                JOIN permissions p ON rp.permission_id = p.id
                WHERE rp.role_id = $1
                AND p.module = $2
                AND p.action = $3
            `, [userRes.role_id, module, action]);

            if (!result) {
                return res.status(403).json({
                    error: `Access Denied. You do not have permission to ${action.replace('_', ' ')}.`
                });
            }

            next();
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Permission check failed" });
        }
    };
}