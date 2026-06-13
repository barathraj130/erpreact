// backend/routes/reports/stock.js
import express from 'express';
import * as db from '../../database/pg.js';
import authMiddleware from '../../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

// ─── GET /lot-profitability  ─────────────────────────────────────────────────
router.get('/lot-profitability', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const { from, to } = req.query;
        const params = [companyId];
        let dateClause = '';
        if (from) { params.push(from); dateClause += ` AND sl.purchase_date >= $${params.length}`; }
        if (to)   { params.push(to);   dateClause += ` AND sl.purchase_date <= $${params.length}`; }

        const rows = await db.pgAll(`
            SELECT
                sl.id, sl.lot_number, sl.status, sl.purchase_date,
                p.name AS product_name, s.name AS supplier_name,
                sl.fresh_qty_purchased, sl.mistake_qty_purchased,
                sl.fresh_purchase_cost, sl.mistake_purchase_cost,
                sl.transport_cost, sl.total_repair_cost, sl.repaired_qty,
                sl.total_purchase_cost,
                sl.total_purchase_cost + sl.total_repair_cost AS total_cost,
                COALESCE(sales.total_revenue, 0) AS total_revenue,
                COALESCE(sales.total_revenue, 0) - (sl.total_purchase_cost + sl.total_repair_cost) AS gross_profit,
                CASE WHEN COALESCE(sales.total_revenue, 0) > 0
                    THEN ROUND(((COALESCE(sales.total_revenue, 0) - (sl.total_purchase_cost + sl.total_repair_cost)) / COALESCE(sales.total_revenue, 1)) * 100, 1)
                    ELSE 0 END AS profit_margin,
                CASE WHEN sl.mistake_qty_purchased > 0
                    THEN ROUND((sl.repaired_qty::numeric / sl.mistake_qty_purchased) * 100, 1)
                    ELSE 0 END AS conversion_efficiency
            FROM stock_lots sl
            LEFT JOIN products p ON p.id = sl.product_id
            LEFT JOIN suppliers s ON s.id = sl.supplier_id
            LEFT JOIN (
                SELECT ili.lot_id, SUM(ili.quantity * ili.unit_price) AS total_revenue
                FROM invoice_line_items ili
                WHERE ili.lot_id IS NOT NULL
                GROUP BY ili.lot_id
            ) sales ON sales.lot_id = sl.id
            WHERE sl.is_deleted = false AND sl.company_id = $1 ${dateClause}
            ORDER BY gross_profit DESC NULLS LAST
        `, params);
        res.json(rows);
    } catch (e) {
        console.error('[stockReport lot-profitability]', e.message);
        res.json([]);
    }
});

// ─── GET /conversion-efficiency  ─────────────────────────────────────────────
router.get('/conversion-efficiency', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const { from, to } = req.query;
        const params = [companyId];
        let dateClause = '';
        if (from) { params.push(from); dateClause += ` AND sl.purchase_date >= $${params.length}`; }
        if (to)   { params.push(to);   dateClause += ` AND sl.purchase_date <= $${params.length}`; }

        const byLot = await db.pgAll(`
            SELECT
                sl.lot_number, sl.purchase_date,
                p.name AS product_name,
                s.name AS supplier_name,
                sl.mistake_qty_purchased,
                sl.repaired_qty,
                sl.rejected_qty,
                sl.total_repair_cost,
                CASE WHEN sl.mistake_qty_purchased > 0
                    THEN ROUND((sl.repaired_qty::numeric / sl.mistake_qty_purchased) * 100, 1)
                    ELSE 0 END AS efficiency_pct,
                CASE WHEN sl.repaired_qty > 0
                    THEN ROUND(sl.total_repair_cost / sl.repaired_qty, 2)
                    ELSE 0 END AS repair_cost_per_piece
            FROM stock_lots sl
            LEFT JOIN products p ON p.id = sl.product_id
            LEFT JOIN suppliers s ON s.id = sl.supplier_id
            WHERE sl.is_deleted = false AND sl.company_id = $1 ${dateClause}
              AND sl.mistake_qty_purchased > 0
            ORDER BY efficiency_pct DESC
        `, params);

        const bySupplier = await db.pgAll(`
            SELECT
                s.name AS supplier_name,
                COUNT(sl.id) AS lots_count,
                SUM(sl.mistake_qty_purchased) AS total_mistake,
                SUM(sl.repaired_qty) AS total_repaired,
                SUM(sl.rejected_qty) AS total_rejected,
                CASE WHEN SUM(sl.mistake_qty_purchased) > 0
                    THEN ROUND((SUM(sl.repaired_qty)::numeric / SUM(sl.mistake_qty_purchased)) * 100, 1)
                    ELSE 0 END AS avg_efficiency,
                CASE WHEN SUM(sl.mistake_qty_purchased) > 0
                    THEN ROUND((SUM(sl.rejected_qty)::numeric / SUM(sl.mistake_qty_purchased)) * 100, 1)
                    ELSE 0 END AS defect_rate_pct
            FROM stock_lots sl
            LEFT JOIN suppliers s ON s.id = sl.supplier_id
            WHERE sl.is_deleted = false AND sl.company_id = $1 ${dateClause}
              AND sl.mistake_qty_purchased > 0
            GROUP BY s.id, s.name
            ORDER BY avg_efficiency DESC
        `, params);

        res.json({ by_lot: byLot, by_supplier: bySupplier });
    } catch (e) {
        console.error('[stockReport conversion-efficiency]', e.message);
        res.json({ by_lot: [], by_supplier: [] });
    }
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
                COALESCE(si.total_qty, 0) AS current_stock,
                COALESCE(si.total_value, 0) AS value_at_risk,
                CASE
                    WHEN CURRENT_DATE - sl.purchase_date::date <= 30 THEN 'low'
                    WHEN CURRENT_DATE - sl.purchase_date::date <= 60 THEN 'medium'
                    WHEN CURRENT_DATE - sl.purchase_date::date <= 90 THEN 'high'
                    ELSE 'critical'
                END AS aging_flag
            FROM stock_lots sl
            LEFT JOIN products p ON p.id = sl.product_id
            LEFT JOIN (
                SELECT lot_id,
                    SUM(CASE WHEN stock_type != 'rejected' THEN quantity ELSE 0 END) AS total_qty,
                    SUM(COALESCE(total_cost, 0)) AS total_value
                FROM stock_inventory GROUP BY lot_id
            ) si ON si.lot_id = sl.id
            WHERE sl.is_deleted = false AND sl.company_id = $1
              AND sl.status NOT IN ('sold_out', 'closed')
            ORDER BY days_old DESC
        `, [companyId]);
        res.json(rows);
    } catch (e) { res.json([]); }
});

export default router;
