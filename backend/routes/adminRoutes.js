// backend/routes/adminRoutes.js
// Admin-only routes: branches overview, branch detail, user management extras
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import { seedPermissionModules, seedPermissionTemplates } from '../config/permissionModulesSeed.js';

const router = express.Router();

const requireAdmin = (req, res, next) => {
    if (!['admin', 'superadmin'].includes(req.user?.role?.toLowerCase())) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// ── GET /api/admin/branches-overview ──────────────────────────────────────────
// Returns all branches with today's stats and manager info
router.get('/branches-overview', authMiddleware, requireAdmin, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const branches = await db.pgAll(`
            SELECT
                b.id,
                b.branch_name,
                b.branch_code,
                b.address_line1 AS address,
                b.is_active,
                COALESCE(u.username, b.manager_name) AS manager_name,
                COALESCE(u.email, b.manager_email)   AS manager_email,
                COALESCE(ts.amount, 0)       AS today_sales,
                COALESCE(ts.bill_count, 0)   AS today_bills,
                COALESCE(out.amount, 0)      AS outstanding
            FROM branches b
            LEFT JOIN users u ON u.branch_id = b.id AND u.role = 'branch_manager' AND u.is_active = true
            LEFT JOIN (
                SELECT branch_id,
                       SUM(total_amount) AS amount,
                       COUNT(*) AS bill_count
                FROM invoices
                WHERE DATE(invoice_date) = CURRENT_DATE
                  AND COALESCE(is_deleted, false) = false
                  AND company_id = $1
                GROUP BY branch_id
            ) ts ON ts.branch_id = b.id
            LEFT JOIN (
                SELECT branch_id,
                       SUM(total_amount - COALESCE(paid_amount, 0)) AS amount
                FROM invoices
                WHERE COALESCE(is_deleted, false) = false
                  AND (total_amount - COALESCE(paid_amount, 0)) > 0
                  AND company_id = $1
                GROUP BY branch_id
            ) out ON out.branch_id = b.id
            WHERE b.company_id = $1
            ORDER BY b.branch_name
        `, [companyId]);

        res.json(branches);
    } catch (err) {
        console.error('[admin/branches-overview]', err.message);
        res.status(500).json({ error: 'Failed to fetch branches overview' });
    }
});

// ── GET /api/admin/branches/:id/detail ────────────────────────────────────────
router.get('/branches/:id/detail', authMiddleware, requireAdmin, async (req, res) => {
    const companyId = req.user.active_company_id || req.user.company_id;
    const branchId  = parseInt(req.params.id);
    try {
        const branch = companyId
            ? await db.pgGet(`SELECT * FROM branches WHERE id = $1 AND company_id = $2`, [branchId, companyId])
            : await db.pgGet(`SELECT * FROM branches WHERE id = $1`, [branchId]);
        if (!branch) return res.status(404).json({ error: 'Branch not found' });

        const managerUser = await db.pgGet(`
            SELECT id, username, email, last_login FROM users
            WHERE branch_id = $1 AND role = 'branch_manager' AND is_active = true LIMIT 1
        `, [branchId]);
        const manager = managerUser || (branch.manager_name
            ? { id: null, username: branch.manager_name, email: branch.manager_email, last_login: null }
            : null);

        const statsParams = companyId ? [branchId, companyId] : [branchId];
        const statsWhere  = companyId ? 'branch_id = $1 AND company_id = $2' : 'branch_id = $1';
        const stats = await db.pgGet(`
            SELECT
                COALESCE(SUM(CASE WHEN DATE(invoice_date) = CURRENT_DATE THEN total_amount END), 0) AS today_sales,
                COUNT(CASE WHEN DATE(invoice_date) = CURRENT_DATE THEN 1 END)                          AS today_count,
                COALESCE(SUM(CASE WHEN DATE_TRUNC('month', invoice_date) = DATE_TRUNC('month', CURRENT_DATE) THEN total_amount END), 0) AS month_sales,
                COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0)                              AS outstanding
            FROM invoices
            WHERE ${statsWhere} AND COALESCE(is_deleted, false) = false
        `, statsParams);

        const custParams = companyId ? [branchId, companyId] : [branchId];
        const custWhere  = companyId ? 'branch_id = $1 AND company_id = $2' : 'branch_id = $1';
        const customerCount = await db.pgGet(`
            SELECT COUNT(*) AS customer_count FROM users
            WHERE ${custWhere} AND role IN ('customer','user')
        `, custParams);

        res.json({
            branch,
            manager: manager || null,
            stats: { ...stats, customer_count: customerCount?.customer_count || 0 },
        });
    } catch (err) {
        console.error('[admin/branches/:id/detail]', err.message);
        res.status(500).json({ error: 'Failed to fetch branch detail' });
    }
});

// ── GET /api/admin/branches/:id/invoices ──────────────────────────────────────
router.get('/branches/:id/invoices', authMiddleware, requireAdmin, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = parseInt(req.params.id);
    const { from, to } = req.query;
    try {
        let sql = `SELECT i.id, i.invoice_number, i.invoice_date,
                          COALESCE(cu.nickname, cu.username) AS customer_name,
                          i.total_amount AS grand_total,
                          COALESCE(i.paid_amount, 0) AS paid_amount,
                          (i.total_amount - COALESCE(i.paid_amount, 0)) AS balance_amount,
                          CASE
                              WHEN COALESCE(i.paid_amount, 0) >= i.total_amount THEN 'PAID'
                              WHEN COALESCE(i.paid_amount, 0) > 0 THEN 'PARTIAL'
                              ELSE 'PENDING'
                          END AS payment_status
                   FROM invoices i
                   LEFT JOIN users cu ON cu.id = i.customer_id
                   WHERE i.branch_id = $1 AND i.company_id = $2 AND COALESCE(i.is_deleted, false) = false`;
        const params = [branchId, companyId];
        if (from) { params.push(from); sql += ` AND i.invoice_date >= $${params.length}`; }
        if (to)   { params.push(to);   sql += ` AND i.invoice_date <= $${params.length}`; }
        sql += ` ORDER BY i.invoice_date DESC LIMIT 200`;
        const rows = await db.pgAll(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('[admin/branches/:id/invoices]', err.message);
        res.status(500).json({ error: 'Failed to fetch branch invoices' });
    }
});

// ── GET /api/admin/branches/:id/customers ─────────────────────────────────────
router.get('/branches/:id/customers', authMiddleware, requireAdmin, async (req, res) => {
    const companyId = req.user.active_company_id || req.user.company_id;
    const branchId  = parseInt(req.params.id);
    try {
        const rows = await db.pgAll(`
            SELECT u.id, COALESCE(u.nickname, u.username) AS name, u.phone,
                   COUNT(i.id) AS total_invoices,
                   COALESCE(SUM(i.total_amount), 0) AS total_billed,
                   COALESCE(SUM(i.total_amount - COALESCE(i.paid_amount, 0)), 0) AS outstanding_balance
            FROM users u
            LEFT JOIN invoices i ON i.customer_id = u.id AND COALESCE(i.is_deleted, false) = false
            WHERE u.branch_id = $1 AND u.company_id = $2 AND u.role IN ('customer', 'user')
            GROUP BY u.id
            ORDER BY u.username ASC
        `, [branchId, companyId]);
        res.json(rows);
    } catch (err) {
        console.error('[admin/branches/:id/customers]', err.message);
        res.status(500).json({ error: 'Failed to fetch branch customers' });
    }
});

// ── GET /api/admin/branches/:id/stock ─────────────────────────────────────────
router.get('/branches/:id/stock', authMiddleware, requireAdmin, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = parseInt(req.params.id);
    try {
        const rows = await db.pgAll(`
            SELECT p.id, p.name, p.hsn_code, p.selling_price,
                   COALESCE(bi.fresh_stock, bi.quantity, 0) AS fresh_stock,
                   COALESCE(bi.mistake_stock, 0)            AS mistake_stock
            FROM products p
            LEFT JOIN branch_inventory bi ON bi.product_id = p.id AND bi.branch_id = $1
            WHERE p.company_id = $2 AND COALESCE(p.is_deleted, false) = false
            ORDER BY p.name
        `, [branchId, companyId]);
        res.json(rows);
    } catch (err) {
        console.error('[admin/branches/:id/stock]', err.message);
        res.status(500).json({ error: 'Failed to fetch branch stock' });
    }
});

// ── POST /api/admin/users/:id/reset-password ──────────────────────────────────
import bcrypt from 'bcryptjs';

router.post('/users/:id/reset-password', authMiddleware, requireAdmin, async (req, res) => {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6)
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    try {
        const hash = await bcrypt.hash(new_password, 10);
        await db.pgRun(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/admin/branches/:id/balance ───────────────────────────────────────
// Returns this branch's cash and bank totals computed from invoices paid at this branch
router.get('/branches/:id/balance', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = parseInt(req.params.id);
    try {
        const row = await db.pgGet(`
            SELECT
              COALESCE(SUM(CASE WHEN UPPER(COALESCE(payment_mode,'CASH')) = 'CASH'
                               THEN COALESCE(paid_amount, 0) ELSE 0 END), 0) AS cash,
              COALESCE(SUM(CASE WHEN UPPER(COALESCE(payment_mode,'')) IN ('BANK','UPI','NEFT','RTGS','IMPS')
                               THEN COALESCE(paid_amount, 0) ELSE 0 END), 0) AS bank,
              COALESCE(SUM(CASE WHEN UPPER(COALESCE(payment_mode,'')) = 'SPLIT'
                               THEN COALESCE(cash_amount, 0) ELSE 0 END), 0) AS split_cash,
              COALESCE(SUM(CASE WHEN UPPER(COALESCE(payment_mode,'')) = 'SPLIT'
                               THEN COALESCE(bank_amount, 0) ELSE 0 END), 0) AS split_bank
            FROM invoices
            WHERE company_id = $1
              AND branch_id = $2
              AND COALESCE(is_deleted, false) = false
        `, [companyId, branchId]);

        res.json({
            cash: Number(row?.cash || 0) + Number(row?.split_cash || 0),
            bank: Number(row?.bank || 0) + Number(row?.split_bank || 0),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/admin/branches/:id/today-bills ───────────────────────────────────
router.get('/branches/:id/today-bills', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = parseInt(req.params.id);
    const date = req.query.date || new Date().toISOString().split('T')[0];
    try {
        const rows = await db.pgAll(`
            SELECT i.id, i.invoice_number, i.invoice_type, i.invoice_date, i.created_at,
                   COALESCE(u.nickname, u.username, i.walk_in_name) AS customer_name,
                   COALESCE(i.grand_total, i.net_payable, i.total_amount, 0) AS grand_total,
                   COALESCE(i.paid_amount, 0) AS paid_amount,
                   COALESCE(i.balance_amount, COALESCE(i.grand_total, i.net_payable, i.total_amount, 0) - COALESCE(i.paid_amount, 0)) AS balance_amount,
                   COALESCE(i.payment_status, 'PENDING') AS payment_status,
                   COALESCE(i.payment_mode, 'CASH') AS payment_mode,
                   COALESCE(i.bill_type, i.invoice_type, 'NON_TAX') AS bill_type,
                   (SELECT COUNT(*) FROM invoice_line_items WHERE invoice_id = i.id) AS item_count
            FROM invoices i
            LEFT JOIN users u ON i.customer_id = u.id
            WHERE i.company_id = $1
              AND (i.branch_id = $2 OR $2 = 0)
              AND DATE(i.invoice_date) = $3
              AND COALESCE(i.is_deleted, false) = false
            ORDER BY i.created_at DESC
        `, [companyId, branchId, date]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/admin/branches/:id/day-close ───────────────────────────────────
router.post('/branches/:id/day-close', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = parseInt(req.params.id);
    const { date, actual_cash, actual_bank, notes } = req.body;
    const closeDate = date || new Date().toISOString().split('T')[0];
    try {
        // Summary stats
        const summary = await db.pgGet(`
            SELECT
              COUNT(*)                                                   AS total_bills,
              COALESCE(SUM(COALESCE(grand_total, net_payable, total_amount, 0)), 0) AS total_amount,
              COALESCE(SUM(COALESCE(paid_amount, 0)), 0)                AS total_paid,
              COALESCE(SUM(CASE WHEN COALESCE(payment_mode,'CASH')='CASH'   THEN COALESCE(paid_amount,0) ELSE 0 END), 0) AS cash_sales,
              COALESCE(SUM(CASE WHEN COALESCE(payment_mode,'CASH') IN ('BANK','UPI') THEN COALESCE(paid_amount,0) ELSE 0 END), 0) AS bank_sales,
              COALESCE(SUM(CASE WHEN COALESCE(payment_status,'PENDING')='PENDING' THEN 1 ELSE 0 END), 0) AS credit_bills
            FROM invoices
            WHERE company_id = $1
              AND (branch_id = $2 OR $2 = 0)
              AND DATE(invoice_date) = $3
              AND COALESCE(is_deleted, false) = false
        `, [companyId, branchId, closeDate]);

        await db.pgRun(`
            INSERT INTO day_close_records (company_id, branch_id, close_date, actual_cash, actual_bank,
              total_bills, total_amount, total_paid, cash_sales, bank_sales, credit_bills, notes, created_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            ON CONFLICT (company_id, branch_id, close_date) DO UPDATE
              SET actual_cash=$4, actual_bank=$5, notes=$12, updated_at=NOW()
        `, [companyId, branchId, closeDate,
            actual_cash || 0, actual_bank || 0,
            summary.total_bills, summary.total_amount, summary.total_paid,
            summary.cash_sales, summary.bank_sales, summary.credit_bills,
            notes || '', req.user.id
        ]).catch(() => {});

        res.json({ success: true, summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/admin/permission-modules ─────────────────────────────────────────
router.get('/permission-modules', authMiddleware, requireAdmin, async (req, res) => {
    try {
        let modules = await db.pgAll(`SELECT * FROM permission_modules ORDER BY category, display_order`);
        if (!modules || modules.length === 0) {
            // Self-heal: startup seeding may have failed silently on this environment.
            await seedPermissionModules(db);
            modules = await db.pgAll(`SELECT * FROM permission_modules ORDER BY category, display_order`);
        }
        res.json(modules || []);
    } catch (e) {
        console.error('[admin/permission-modules]', e.message);
        res.json([]);
    }
});

// ── GET /api/admin/permission-templates ───────────────────────────────────────
router.get('/permission-templates', authMiddleware, requireAdmin, async (req, res) => {
    try {
        let templates = await db.pgAll(`SELECT * FROM permission_templates ORDER BY id`);
        if (!templates || templates.length === 0) {
            // Self-heal: startup seeding may have failed silently on this environment.
            await seedPermissionModules(db);
            await seedPermissionTemplates(db);
            templates = await db.pgAll(`SELECT * FROM permission_templates ORDER BY id`);
        }
        res.json(templates || []);
    } catch (e) {
        console.error('[admin/permission-templates]', e.message);
        res.json([]);
    }
});

// ── GET /api/admin/users/:id/permissions ──────────────────────────────────────
router.get('/users/:id/permissions', authMiddleware, requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id);
    try {
        let [userRow, modules, perms] = await Promise.all([
            db.pgGet(`SELECT username FROM users WHERE id = $1`, [userId]),
            db.pgAll(`SELECT * FROM permission_modules ORDER BY category, display_order`),
            db.pgAll(`SELECT * FROM user_permissions WHERE user_id = $1`, [userId]),
        ]);

        if (!modules || modules.length === 0) {
            // Self-heal: startup seeding may have failed silently on this environment.
            await seedPermissionModules(db);
            modules = await db.pgAll(`SELECT * FROM permission_modules ORDER BY category, display_order`);
        }

        const permsMap = {};
        (perms || []).forEach(p => { permsMap[p.module_key] = p; });

        res.json({
            username:    userRow?.username || '',
            modules:     (modules || []).map(m => ({
                module_key:   m.module_key,
                display_name: m.module_name,
                category:     m.category,
                description:  '',
            })),
            permissions: (modules || []).map(m => ({
                module_key: m.module_key,
                can_view:   permsMap[m.module_key]?.can_view   || false,
                can_create: permsMap[m.module_key]?.can_create || false,
                can_edit:   permsMap[m.module_key]?.can_edit   || false,
                can_delete: permsMap[m.module_key]?.can_delete || false,
            })),
        });
    } catch (e) {
        console.error('[admin/users/:id/permissions]', e.message);
        res.json({ username: '', modules: [], permissions: [] });
    }
});

// ── POST /api/admin/users/:id/permissions ─────────────────────────────────────
router.post('/users/:id/permissions', authMiddleware, requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) return res.json({ success: false, error: 'permissions must be an array' });

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        for (const p of permissions) {
            await client.query(`
                INSERT INTO user_permissions
                    (user_id, module_key, can_view, can_create, can_edit, can_delete, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (user_id, module_key) DO UPDATE SET
                    can_view = $3, can_create = $4, can_edit = $5, can_delete = $6, updated_at = NOW()
            `, [userId, p.module_key, p.can_view || false, p.can_create || false, p.can_edit || false, p.can_delete || false]);
        }
        await client.query('COMMIT');
        res.json({ success: true, message: 'Permissions saved' });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[admin/users/:id/permissions POST]', e.message);
        res.json({ success: false, error: e.message });
    } finally {
        client.release();
    }
});

// ── POST /api/admin/users/:id/apply-template ──────────────────────────────────
router.post('/users/:id/apply-template', authMiddleware, requireAdmin, async (req, res) => {
    const userId     = parseInt(req.params.id);
    const { template_id } = req.body;
    if (!template_id) return res.json({ success: false, error: 'template_id required' });

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const items = await client.query(
            `SELECT * FROM permission_template_items WHERE template_id = $1`,
            [template_id]
        );

        await client.query('DELETE FROM user_permissions WHERE user_id = $1', [userId]);

        for (const item of items.rows) {
            await client.query(`
                INSERT INTO user_permissions
                    (user_id, module_key, can_view, can_create, can_edit, can_delete)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [userId, item.module_key, item.can_view, item.can_create, item.can_edit, item.can_delete]);
        }

        await client.query(
            `UPDATE users SET permission_template_id = $1 WHERE id = $2`,
            [template_id, userId]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Template applied' });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[admin/users/:id/apply-template]', e.message);
        res.json({ success: false, error: e.message });
    } finally {
        client.release();
    }
});

export default router;
