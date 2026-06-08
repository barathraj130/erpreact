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
    const data = await db.pgAll(sql, [companyId]);
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
    const data = await db.pgAll(sql, [companyId, startDate, endDate, parseInt(limit)]);
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
    const data = await db.pgAll(sql, [companyId, parseInt(days)]);
    const summary = {
      total_items: data.length,
      total_value: data.reduce((a, b) => a + parseFloat(b.stock_value || 0), 0),
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
    const data = await db.pgAll(sql, [companyId]);
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

export default router;
