// backend/middlewares/checkPermission.js
// Granular permission check against user_permissions table.
// Admins always bypass. Non-admins with no row configured also pass through
// (safe rollout default — once permissions are set up for a user, that user
// is fully restricted to only what's granted).
import * as db from '../database/pg.js';

// user_permissions only ever had four real columns: can_view/can_create/
// can_edit/can_delete. Several routes call this with compound action names
// like "view_invoices" or "access_settings" — building `can_${action}`
// straight from those produces a column that has never existed (e.g.
// can_view_invoices), throwing on every check and getting caught below as a
// generic "Permission check failed" for any non-admin user. Normalize to the
// real base verb before touching the database.
const BASE_ACTION = {
    view: 'view', create: 'create', edit: 'edit', delete: 'delete',
    view_invoices: 'view', create_invoices: 'create', edit_invoices: 'edit', delete_invoices: 'delete',
    access_settings: 'edit',
};
const resolveBaseAction = (action) => BASE_ACTION[action] || action.split('_')[0];

const checkPermission = (moduleKey, action = 'view') => {
    return async (req, res, next) => {
        try {
            if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

            const role = req.user?.role?.toLowerCase();

            // Admins always pass
            if (['admin', 'superadmin'].includes(role)) return next();

            // Portal-only roles (Employee Portal / customer storefront logins) have
            // their own separate, narrower route sets and should never reach ERP
            // business routes gated by this middleware — deny outright rather than
            // the "no row configured yet" fail-open default below, which used to
            // grant them full access to whatever they could reach.
            if (['field_employee', 'customer', 'user'].includes(role)) {
                return res.status(403).json({ error: `You don't have permission to ${action} ${moduleKey}` });
            }

            const actionColumn = `can_${resolveBaseAction(action)}`;

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
