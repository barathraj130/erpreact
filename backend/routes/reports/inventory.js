// backend/routes/reports/inventory.js
import express from 'express';
import * as db from '../../database/pg.js';
import authMiddleware from '../../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

const getDateRange = (from, to) => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  return { from: from || firstDay, to: to || lastDay };
};

/**
 * GET /api/reports/inventory/abc-analysis
 * ABC classification by revenue contribution
 */
router.get('/abc-analysis', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  try {
    const sql = `
      WITH product_revenue AS (
        SELECT
          p.id,
          p.name AS product_name,
          p.current_stock,
          p.cost_price,
          COALESCE(SUM(ili.line_total), 0) AS revenue,
          COALESCE(SUM(ili.quantity), 0) AS qty_sold
        FROM products p
        LEFT JOIN invoice_line_items ili ON ili.product_id = p.id
        LEFT JOIN invoices i ON ili.invoice_id = i.id AND COALESCE(i.is_deleted, false) = false
        WHERE p.company_id = $1 AND COALESCE(p.is_deleted, false) = false
        GROUP BY p.id, p.name, p.current_stock, p.cost_price
      ),
      ranked AS (
        SELECT *,
          SUM(revenue) OVER () AS total_revenue,
          SUM(revenue) OVER (ORDER BY revenue DESC) AS cumulative_revenue
        FROM product_revenue
        WHERE revenue > 0
      )
      SELECT
        product_name,
        current_stock,
        cost_price,
        revenue,
        qty_sold,
        ROUND((revenue / NULLIF(total_revenue, 0)) * 100, 2) AS revenue_pct,
        ROUND((cumulative_revenue / NULLIF(total_revenue, 0)) * 100, 2) AS cumulative_pct,
        CASE
          WHEN (cumulative_revenue / NULLIF(total_revenue, 0)) * 100 <= 80 THEN 'A'
          WHEN (cumulative_revenue / NULLIF(total_revenue, 0)) * 100 <= 95 THEN 'B'
          ELSE 'C'
        END AS abc_class
      FROM ranked
      ORDER BY revenue DESC
    `;
    const rawData = await db.pgAll(sql, [companyId]);
    const data = rawData.map(r => ({
      ...r,
      revenue: parseFloat(r.revenue || 0),
      qty_sold: parseFloat(r.qty_sold || 0),
      revenue_pct: parseFloat(r.revenue_pct || 0),
      cumulative_pct: parseFloat(r.cumulative_pct || 0),
      current_stock: parseFloat(r.current_stock || 0),
      cost_price: parseFloat(r.cost_price || 0),
    }));
    const summary = {
      a_count: data.filter(d => d.abc_class === 'A').length,
      b_count: data.filter(d => d.abc_class === 'B').length,
      c_count: data.filter(d => d.abc_class === 'C').length,
    };
    res.json({ data: data || [], summary });
  } catch (err) {
    console.error('abc-analysis error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/inventory/fast-moving
 */
router.get('/fast-moving', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to, limit = 20 } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const sql = `
      SELECT
        p.name AS product_name,
        p.current_stock,
        COALESCE(SUM(ili.quantity), 0) AS qty_sold,
        COALESCE(SUM(ili.line_total), 0) AS revenue,
        COUNT(DISTINCT i.id) AS order_count
      FROM products p
      JOIN invoice_line_items ili ON ili.product_id = p.id
      JOIN invoices i ON ili.invoice_id = i.id
      WHERE p.company_id = $1
        AND COALESCE(p.is_deleted, false) = false
        AND COALESCE(i.is_deleted, false) = false
        AND i.invoice_date BETWEEN $2::date AND $3::date
      GROUP BY p.id, p.name, p.current_stock
      ORDER BY qty_sold DESC
      LIMIT $4
    `;
    const rawData = await db.pgAll(sql, [companyId, startDate, endDate, parseInt(limit)]);
    const data = rawData.map(r => ({
      ...r,
      qty_sold: parseFloat(r.qty_sold || 0),
      revenue: parseFloat(r.revenue || 0),
      current_stock: parseFloat(r.current_stock || 0),
      order_count: parseFloat(r.order_count || 0),
    }));
    res.json({ data: data || [], summary: {} });
  } catch (err) {
    console.error('fast-moving error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/inventory/slow-moving
 */
router.get('/slow-moving', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { days = 90 } = req.query;
  try {
    const sql = `
      SELECT
        p.name AS product_name,
        p.current_stock,
        COALESCE(p.current_stock * p.cost_price, 0) AS stock_value,
        MAX(i.invoice_date) AS last_sale_date,
        COALESCE(CURRENT_DATE - MAX(i.invoice_date)::date, 999) AS days_since_sale
      FROM products p
      LEFT JOIN invoice_line_items ili ON ili.product_id = p.id
      LEFT JOIN invoices i ON ili.invoice_id = i.id AND COALESCE(i.is_deleted, false) = false
      WHERE p.company_id = $1
        AND COALESCE(p.is_deleted, false) = false
        AND COALESCE(p.current_stock, 0) > 0
      GROUP BY p.id, p.name, p.current_stock, p.cost_price
      HAVING MAX(i.invoice_date) < CURRENT_DATE - ($2 || ' days')::INTERVAL
          OR MAX(i.invoice_date) IS NULL
      ORDER BY days_since_sale DESC
    `;
    const rawData = await db.pgAll(sql, [companyId, parseInt(days)]);
    const data = rawData.map(r => ({
      ...r,
      current_stock: parseFloat(r.current_stock || 0),
      stock_value: parseFloat(r.stock_value || 0),
      days_since_sale: parseFloat(r.days_since_sale || 0),
    }));
    const summary = {
      total_items: data.length,
      total_value: data.reduce((a, b) => a + (b.stock_value || 0), 0),
    };
    res.json({ data: data || [], summary });
  } catch (err) {
    console.error('slow-moving error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/inventory/reorder-alerts
 */
router.get('/reorder-alerts', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  try {
    const sql = `
      SELECT
        p.name AS product_name,
        COALESCE(p.current_stock, 0) AS current_stock,
        COALESCE(p.min_stock_level, 0) AS min_stock_level,
        COALESCE(p.cost_price, 0) AS cost_price,
        CASE
          WHEN COALESCE(p.current_stock, 0) = 0 THEN 'OUT_OF_STOCK'
          WHEN COALESCE(p.current_stock, 0) <= COALESCE(p.min_stock_level, 0) THEN 'CRITICAL'
          WHEN COALESCE(p.current_stock, 0) <= COALESCE(p.min_stock_level, 0) * 1.5 THEN 'LOW'
          ELSE 'OK'
        END AS alert_level
      FROM products p
      WHERE p.company_id = $1
        AND COALESCE(p.is_deleted, false) = false
        AND (COALESCE(p.current_stock, 0) <= COALESCE(p.min_stock_level, 5) OR COALESCE(p.current_stock, 0) = 0)
      ORDER BY
        CASE WHEN COALESCE(p.current_stock, 0) = 0 THEN 0
             WHEN COALESCE(p.current_stock, 0) <= COALESCE(p.min_stock_level, 0) THEN 1
             ELSE 2 END ASC,
        p.name ASC
    `;
    const rawData = await db.pgAll(sql, [companyId]);
    const data = rawData.map(r => ({
      ...r,
      current_stock: parseFloat(r.current_stock || 0),
      min_stock_level: parseFloat(r.min_stock_level || 0),
      cost_price: parseFloat(r.cost_price || 0),
      shortage: Math.max(0, parseFloat(r.min_stock_level || 0) - parseFloat(r.current_stock || 0)),
    }));
    const summary = {
      out_of_stock: data.filter(d => d.alert_level === 'OUT_OF_STOCK').length,
      critical: data.filter(d => d.alert_level === 'CRITICAL').length,
      low: data.filter(d => d.alert_level === 'LOW').length,
    };
    res.json({ data: data || [], summary });
  } catch (err) {
    console.error('reorder-alerts error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/inventory/stock-turnover
 */
router.get('/stock-turnover', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const sql = `
      SELECT
        p.name AS product_name,
        COALESCE(p.current_stock, 0) AS current_stock,
        COALESCE(SUM(ili.quantity), 0) AS qty_sold,
        COALESCE(SUM(ili.quantity * p.cost_price), 0) AS cogs,
        COALESCE(p.current_stock * p.cost_price, 0) AS stock_value,
        CASE WHEN COALESCE(p.current_stock, 0) > 0
          THEN ROUND((COALESCE(SUM(ili.quantity), 0) / COALESCE(p.current_stock, 1))::numeric, 2)
          ELSE 0 END AS turnover_ratio
      FROM products p
      LEFT JOIN invoice_line_items ili ON ili.product_id = p.id
      LEFT JOIN invoices i ON ili.invoice_id = i.id
        AND COALESCE(i.is_deleted, false) = false
        AND i.invoice_date BETWEEN $2::date AND $3::date
      WHERE p.company_id = $1
        AND COALESCE(p.is_deleted, false) = false
      GROUP BY p.id, p.name, p.current_stock, p.cost_price
      ORDER BY turnover_ratio DESC
    `;
    const data = await db.pgAll(sql, [companyId, startDate, endDate]);
    res.json({ data: data || [], summary: {} });
  } catch (err) {
    console.error('stock-turnover error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/inventory/aging
 */
router.get('/aging', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  try {
    const sql = `
      SELECT
        p.name AS product_name,
        COALESCE(p.current_stock, 0) AS current_stock,
        COALESCE(p.cost_price, 0) AS cost_price,
        COALESCE(p.current_stock * p.cost_price, 0) AS stock_value,
        COALESCE(CURRENT_DATE - MAX(im.created_at)::date, 999) AS days_in_stock
      FROM products p
      LEFT JOIN inventory_movements im ON im.product_id = p.id
        AND im.company_id = $1
        AND im.qty_in > 0
      WHERE p.company_id = $1
        AND COALESCE(p.is_deleted, false) = false
        AND COALESCE(p.current_stock, 0) > 0
      GROUP BY p.id, p.name, p.current_stock, p.cost_price
      ORDER BY days_in_stock DESC
    `;
    const data = await db.pgAll(sql, [companyId]);
    res.json({ data: data || [], summary: {} });
  } catch (err) {
    console.error('inventory/aging error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/inventory/stock-breakdown
 * Per-product, per-stock-type breakdown
 */
router.get('/stock-breakdown', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  try {
    const sql = `
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        i.stock_type,
        i.lot_id,
        sl.lot_number,
        COALESCE(i.quantity, 0) AS quantity,
        COALESCE(i.avg_cost, 0) AS avg_cost,
        COALESCE(i.total_cost, 0) AS total_cost
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN stock_lots sl ON i.lot_id = sl.id
      WHERE p.company_id = $1 AND COALESCE(p.is_deleted, false) = false AND i.quantity > 0
      ORDER BY p.name, i.stock_type
    `;
    const data = await db.pgAll(sql, [companyId]);
    const summary = {
      total_fresh: data.filter(r => r.stock_type === 'fresh').reduce((s, r) => s + Number(r.quantity), 0),
      total_mistake: data.filter(r => r.stock_type === 'mistake').reduce((s, r) => s + Number(r.quantity), 0),
      total_repaired: data.filter(r => r.stock_type === 'fresh_repaired').reduce((s, r) => s + Number(r.quantity), 0),
      total_value: data.reduce((s, r) => s + Number(r.total_cost), 0),
    };
    res.json({ data: data || [], summary });
  } catch (err) {
    console.error('stock-breakdown error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/inventory/lot-profitability
 * Lot-wise P&L from invoice_line_items
 */
router.get('/lot-profitability', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  try {
    const sql = `
      SELECT
        sl.id AS lot_id,
        sl.lot_number,
        sl.status,
        COALESCE(sl.total_fresh_qty + sl.total_mistake_qty, 0) AS total_purchased,
        COALESCE(sl.total_cost, 0) AS purchase_cost,
        COALESCE(SUM(ili.quantity), 0) AS qty_sold,
        COALESCE(SUM(ili.line_total), 0) AS revenue,
        COALESCE(SUM(ili.total_profit), 0) AS gross_profit,
        COALESCE(sl.total_repair_cost, 0) AS repair_cost,
        ROUND(
          CASE WHEN COALESCE(SUM(ili.line_total), 0) > 0
          THEN (COALESCE(SUM(ili.total_profit), 0) / SUM(ili.line_total)) * 100
          ELSE 0 END, 2
        ) AS margin_pct
      FROM stock_lots sl
      LEFT JOIN invoice_line_items ili ON ili.lot_id = sl.id
      LEFT JOIN invoices inv ON ili.invoice_id = inv.id AND COALESCE(inv.is_deleted, false) = false
      WHERE sl.company_id = $1 AND COALESCE(sl.is_deleted, false) = false
      GROUP BY sl.id, sl.lot_number, sl.status, sl.total_fresh_qty, sl.total_mistake_qty, sl.total_cost, sl.total_repair_cost
      ORDER BY sl.created_at DESC
    `;
    const data = await db.pgAll(sql, [companyId]);
    res.json({ data: data || [], summary: {} });
  } catch (err) {
    console.error('lot-profitability error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/inventory/conversions
 * Conversion (mistake→repaired) history
 */
router.get('/conversions', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  try {
    const sql = `
      SELECT
        sc.id,
        sc.conversion_date,
        sl.lot_number,
        p.name AS product_name,
        sc.mistake_qty_in,
        sc.fresh_qty_out,
        sc.rejected_qty,
        sc.repair_cost_per_piece,
        sc.total_repair_cost,
        sc.repair_worker,
        sc.payment_mode
      FROM stock_conversions sc
      JOIN stock_lots sl ON sc.lot_id = sl.id
      LEFT JOIN products p ON p.company_id = $1 AND COALESCE(p.is_deleted, false) = false
      WHERE sl.company_id = $1
      ORDER BY sc.created_at DESC
      LIMIT 200
    `;
    const data = await db.pgAll(sql, [companyId]);
    res.json({ data: data || [], summary: {} });
  } catch (err) {
    console.error('conversions error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

export default router;
