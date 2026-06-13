// backend/routes/stockInventory.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

// ─── GET /summary  ───────────────────────────────────────────────────────────
router.get('/summary', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const row = await db.pgGet(`
            SELECT
                COALESCE(SUM(CASE WHEN si.stock_type IN ('fresh_purchased','fresh_repaired') THEN si.quantity ELSE 0 END), 0) AS total_fresh,
                COALESCE(SUM(CASE WHEN si.stock_type = 'mistake'  THEN si.quantity ELSE 0 END), 0) AS total_mistake,
                COALESCE(SUM(CASE WHEN si.stock_type = 'rejected' THEN si.quantity ELSE 0 END), 0) AS total_rejected,
                COALESCE(SUM(si.total_cost), 0) AS total_inventory_value,
                COUNT(DISTINCT CASE WHEN sl.status NOT IN ('sold_out','closed') THEN sl.id END) AS active_lots
            FROM stock_inventory si
            JOIN stock_lots sl ON sl.id = si.lot_id
            WHERE sl.is_deleted = false AND sl.company_id = $1
        `, [companyId]);
        res.json(row);
    } catch (e) {
        console.error('[stockInventory summary]', e.message);
        res.json({ total_fresh: 0, total_mistake: 0, total_rejected: 0, total_inventory_value: 0, active_lots: 0 });
    }
});

// ─── GET /by-lot  ────────────────────────────────────────────────────────────
router.get('/by-lot', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const rows = await db.pgAll(`
            SELECT
                sl.id AS lot_id, sl.lot_number, sl.status, sl.purchase_date,
                p.name AS product_name,
                s.name AS supplier_name,
                COALESCE(si_fp.quantity, 0) AS fresh_purchased,
                COALESCE(si_fr.quantity, 0) AS fresh_repaired,
                COALESCE(si_fp.quantity, 0) + COALESCE(si_fr.quantity, 0) AS total_fresh,
                COALESCE(si_m.quantity, 0)  AS mistake,
                COALESCE(si_r.quantity, 0)  AS rejected,
                COALESCE(si_fp.avg_cost, 0) AS fresh_purchased_avg,
                COALESCE(si_fr.avg_cost, 0) AS fresh_repaired_avg,
                COALESCE(si_m.avg_cost, 0)  AS mistake_avg,
                COALESCE(
                    (COALESCE(si_fp.total_cost,0) + COALESCE(si_fr.total_cost,0) + COALESCE(si_m.total_cost,0)),
                    0
                ) AS total_value,
                CURRENT_DATE - sl.purchase_date::date AS days_old
            FROM stock_lots sl
            LEFT JOIN products p ON p.id = sl.product_id
            LEFT JOIN suppliers s ON s.id = sl.supplier_id
            LEFT JOIN stock_inventory si_fp ON si_fp.lot_id = sl.id AND si_fp.stock_type = 'fresh_purchased'
            LEFT JOIN stock_inventory si_fr ON si_fr.lot_id = sl.id AND si_fr.stock_type = 'fresh_repaired'
            LEFT JOIN stock_inventory si_m  ON si_m.lot_id  = sl.id AND si_m.stock_type  = 'mistake'
            LEFT JOIN stock_inventory si_r  ON si_r.lot_id  = sl.id AND si_r.stock_type  = 'rejected'
            WHERE sl.is_deleted = false AND sl.company_id = $1
              AND sl.status NOT IN ('sold_out', 'closed')
            ORDER BY sl.purchase_date ASC
        `, [companyId]);
        res.json(rows);
    } catch (e) {
        console.error('[stockInventory by-lot]', e.message);
        res.json([]);
    }
});

// ─── GET /valuation  ─────────────────────────────────────────────────────────
router.get('/valuation', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const rows = await db.pgAll(`
            SELECT
                si.stock_type,
                COALESCE(SUM(si.quantity), 0) AS total_qty,
                COALESCE(SUM(si.total_cost), 0) AS total_value,
                CASE WHEN SUM(si.quantity) > 0 THEN SUM(si.total_cost) / SUM(si.quantity) ELSE 0 END AS weighted_avg_cost
            FROM stock_inventory si
            JOIN stock_lots sl ON sl.id = si.lot_id
            WHERE sl.is_deleted = false AND sl.company_id = $1
            GROUP BY si.stock_type
        `, [companyId]);
        res.json(rows);
    } catch (e) { res.json([]); }
});

// ─── GET /aging  ─────────────────────────────────────────────────────────────
router.get('/aging', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const rows = await db.pgAll(`
            SELECT
                sl.lot_number, sl.purchase_date, sl.status,
                p.name AS product_name,
                CURRENT_DATE - sl.purchase_date::date AS days_old,
                COALESCE(si_fp.quantity, 0) + COALESCE(si_fr.quantity, 0) + COALESCE(si_m.quantity, 0) AS total_stock,
                COALESCE(si_fp.total_cost, 0) + COALESCE(si_fr.total_cost, 0) + COALESCE(si_m.total_cost, 0) AS value_at_risk,
                CASE
                    WHEN CURRENT_DATE - sl.purchase_date::date <= 30 THEN 'low'
                    WHEN CURRENT_DATE - sl.purchase_date::date <= 60 THEN 'medium'
                    WHEN CURRENT_DATE - sl.purchase_date::date <= 90 THEN 'high'
                    ELSE 'critical'
                END AS aging_flag
            FROM stock_lots sl
            LEFT JOIN products p ON p.id = sl.product_id
            LEFT JOIN stock_inventory si_fp ON si_fp.lot_id = sl.id AND si_fp.stock_type = 'fresh_purchased'
            LEFT JOIN stock_inventory si_fr ON si_fr.lot_id = sl.id AND si_fr.stock_type = 'fresh_repaired'
            LEFT JOIN stock_inventory si_m  ON si_m.lot_id  = sl.id AND si_m.stock_type  = 'mistake'
            WHERE sl.is_deleted = false AND sl.company_id = $1
              AND sl.status NOT IN ('sold_out', 'closed')
            ORDER BY days_old DESC
        `, [companyId]);
        res.json(rows);
    } catch (e) { res.json([]); }
});

// ─── GET /transactions/:lotId  ───────────────────────────────────────────────
router.get('/transactions/:lotId', authMiddleware, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT * FROM stock_transactions WHERE lot_id = $1 ORDER BY created_at DESC`,
            [req.params.lotId]
        );
        res.json(rows);
    } catch (e) { res.json([]); }
});

export default router;
