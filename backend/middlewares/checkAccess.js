// backend/middlewares/checkAccess.js
import * as db from "../database/pg.js";

/**
 * Middleware to check granular permissions.
 * Usage: router.get('/', checkAccess('Sales', 'view_invoices'), ...)
 * 
 * @param {string} moduleName - The module (e.g., 'Sales')
 * @param {string} actionName - The action (e.g., 'view_invoices')
 */
export const checkAccess = (moduleName, actionName) => {
    return async (req, res, next) => {
        try {
            // 1. Verify User Exists
            if (!req.user || !req.user.id) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const user = req.user;

            // 2. Admin Bypass
            // Admins always have access, no need to check DB
            if (user.role === 'admin') {
                return next();
            }

            // 3. Get Role ID from DB
            // We look up the ID for the string role (e.g. 'manager')
            const roleRes = await db.pgGet(
                "SELECT id FROM roles WHERE LOWER(name) = LOWER($1)", 
                [user.role]
            );
            
            if (!roleRes) {
                console.warn(`⛔ RBAC: Role '${user.role}' not defined in database.`);
                return res.status(403).json({ error: "Access Denied: Invalid Role" });
            }

            const roleId = roleRes.id;

            // 4. Check Permission in Database
            // ✅ FIX: Changed 'p.resource' to 'p.module' to match your schema
            const sql = `
                SELECT 1 
                FROM role_permissions rp
                JOIN permissions p ON rp.permission_id = p.id
                WHERE rp.role_id = $1 
                AND p.module = $2 
                AND p.action = $3
            `;
            
            const hasPermission = await db.pgGet(sql, [roleId, moduleName, actionName]);

            if (!hasPermission) {
                console.warn(`⛔ Access Denied: User '${user.username}' (${user.role}) tried to access ${moduleName} -> ${actionName}`);
                return res.status(403).json({ error: "Access Denied: Insufficient Permissions" });
            }

            next();

        } catch (err) {
            console.error("RBAC Check Error:", err);
            // Return 403 or 500 but do NOT crash the server
            res.status(500).json({ error: "Authorization Error" });
        }
    };
};