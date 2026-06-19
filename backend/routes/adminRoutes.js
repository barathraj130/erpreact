// backend/routes/adminRoutes.js
// Admin-only routes: branches overview, branch detail, user management extras
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

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
                b.address,
                b.is_active,
                u.username AS manager_name,
                u.email    AS manager_email,
                COALESCE(ts.amount, 0)       AS today_sales,
                COALESCE(ts.bill_count, 0)   AS today_bills,
                COALESCE(out.amount, 0)      AS outstanding
            FROM branches b
            LEFT JOIN users u ON u.branch_id = b.id AND u.role = 'branch_manager' AND u.is_active = true
            LEFT JOIN (
                SELECT branch_id,
                       SUM(COALESCE(grand_total, net_payable, 0)) AS amount,
                       COUNT(*) AS bill_count
                FROM invoices
                WHERE DATE(invoice_date) = CURRENT_DATE
                  AND COALESCE(is_deleted, false) = false
                  AND company_id = $1
                GROUP BY branch_id
            ) ts ON ts.branch_id = b.id
            LEFT JOIN (
                SELECT branch_id,
                       SUM(COALESCE(balance_amount, 0)) AS amount
                FROM invoices
                WHERE COALESCE(is_deleted, false) = false
                  AND COALESCE(balance_amount, 0) > 0
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
    const companyId = req.user.active_company_id;
    const branchId  = parseInt(req.params.id);
    try {
        const branch  = await db.pgGet(`SELECT * FROM branches WHERE id = $1 AND company_id = $2`, [branchId, companyId]);
        if (!branch) return res.status(404).json({ error: 'Branch not found' });

        const manager = await db.pgGet(`
            SELECT id, username, email, last_login FROM users
            WHERE branch_id = $1 AND role = 'branch_manager' AND is_active = true LIMIT 1
        `, [branchId]);

        const stats = await db.pgGet(`
            SELECT
                COALESCE(SUM(CASE WHEN DATE(invoice_date) = CURRENT_DATE THEN COALESCE(grand_total, net_payable, 0) END), 0) AS today_sales,
                COUNT(CASE WHEN DATE(invoice_date) = CURRENT_DATE THEN 1 END)                                                  AS today_count,
                COALESCE(SUM(CASE WHEN DATE_TRUNC('month', invoice_date) = DATE_TRUNC('month', CURRENT_DATE) THEN COALESCE(grand_total, net_payable, 0) END), 0) AS month_sales,
                COALESCE(SUM(COALESCE(balance_amount, 0)), 0)                                                                  AS outstanding
            FROM invoices
            WHERE branch_id = $1 AND company_id = $2 AND COALESCE(is_deleted, false) = false
        `, [branchId, companyId]);

        const customerCount = await db.pgGet(`
            SELECT COUNT(*) AS customer_count FROM users
            WHERE branch_id = $1 AND company_id = $2 AND role IN ('customer','user')
        `, [branchId, companyId]);

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
        let sql = `SELECT id, invoice_number, invoice_date, customer_name,
                          COALESCE(grand_total, net_payable, 0) AS grand_total,
                          COALESCE(paid_amount, 0) AS paid_amount,
                          COALESCE(balance_amount, 0) AS balance_amount,
                          payment_status, bill_type
                   FROM invoices
                   WHERE branch_id = $1 AND company_id = $2 AND COALESCE(is_deleted, false) = false`;
        const params = [branchId, companyId];
        if (from) { params.push(from); sql += ` AND invoice_date >= $${params.length}`; }
        if (to)   { params.push(to);   sql += ` AND invoice_date <= $${params.length}`; }
        sql += ` ORDER BY invoice_date DESC LIMIT 200`;
        const rows = await db.pgAll(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('[admin/branches/:id/invoices]', err.message);
        res.status(500).json({ error: 'Failed to fetch branch invoices' });
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

export default router;
