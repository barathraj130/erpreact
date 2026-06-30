// backend/middlewares/checkPermission.js
// Granular permission check against user_permissions table.
// Admins always bypass. Non-admins with no row configured also pass through
// (safe rollout default — once permissions are set up for a user, that user
// is fully restricted to only what's granted).
import * as db from '../database/pg.js';

const checkPermission = (moduleKey, action = 'view') => {
    return async (req, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

            const role = req.user?.role?.toLowerCase();

            // Admins always pass
            if (['admin', 'superadmin'].includes(role)) return next();

            const actionColumn = `can_${action}`;

            const perm = await db.pgGet(
                `SELECT ${actionColumn} AS allowed FROM user_permissions WHERE user_id = $1 AND module_key = $2`,
                [req.user.id, moduleKey]
            );

            // No row = user has no custom permissions configured yet → allow through (safe default)
            if (!perm) return next();

            if (perm.allowed !== true) {
                return res.status(403).json({
                    error: `You don't have permission to ${action} ${moduleKey}`,
                    required_module: moduleKey,
                    required_action: action,
                });
            }

            next();
        } catch (e) {
            console.error('checkPermission error:', e.message);
            return res.status(403).json({ error: 'Permission check failed' });
        }
    };
};

export default checkPermission;
