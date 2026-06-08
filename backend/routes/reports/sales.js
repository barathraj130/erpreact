// backend/routes/reports/sales.js
import express from 'express';
import * as db from '../../database/pg.js';
import authMiddleware from '../../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

const getDateRange = (from, to) => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  return {
    from: from || firstDay,
    to: to || lastDay,
  };
};

/**
 * GET /api/reports/sales/top-customers
 */
router.get('/top-customers', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to, limit = 10 } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    // Paid = invoice_payments (direct) + CUSTOMER_PAYMENT transactions (proprietor)
    // This matches the Account Ledger / dashboardRoutes outstanding formula exactly
    const sql = `
      SELECT
        u.username AS customer_name,
        COUNT(i.id) AS invoice_count,
        COALESCE(SUM(i.total_amount), 0) AS total_sales,
        -- Total paid = invoice_payments for this customer + proprietor receipts (CUSTOMER_PAYMENT)
        COALESCE((
          SELECT SUM(ip.amount)
          FROM invoice_payments ip
          JOIN invoices i2 ON i2.id = ip.invoice_id
          WHERE i2.customer_id = u.id AND i2.company_id = $1
            AND COALESCE(i2.is_deleted, false) = false
        ), 0) +
        COALESCE((
          SELECT SUM(t.amount) FROM transactions t
          WHERE t.reference_id = u.id AND t.company_id = $1
            AND t.type = 'CUSTOMER_PAYMENT'
        ), 0) AS total_paid,
        -- All-time outstanding = opening + invoices - invoice_payments - returns - proprietor_payments
        GREATEST(0,
          COALESCE(COALESCE((u.meta->>'customer_opening_balance')::NUMERIC, u.initial_balance), 0)
          + COALESCE((
            SELECT SUM(CASE WHEN UPPER(COALESCE(i2.invoice_type,'')) != 'SALES_RETURN'
                            THEN i2.total_amount ELSE -i2.total_amount END)
            FROM invoices i2
            WHERE i2.customer_id = u.id AND i2.company_id = $1
              AND COALESCE(i2.is_deleted, false) = false
              AND COALESCE(i2.bill_purpose, '') != 'name_only'
          ), 0)
          - COALESCE((
            SELECT SUM(ip.amount) FROM invoice_payments ip
            JOIN invoices i3 ON i3.id = ip.invoice_id
            WHERE i3.customer_id = u.id AND i3.company_id = $1
              AND COALESCE(i3.is_deleted, false) = false
          ), 0)
          - COALESCE((
            SELECT SUM(sr.total_amount) FROM sales_returns sr
            WHERE sr.customer_id = u.id AND sr.company_id = $1
          ), 0)
          - COALESCE((
            SELECT SUM(t.amount) FROM transactions t
            WHERE t.reference_id = u.id AND t.company_id = $1
              AND t.type = 'CUSTOMER_PAYMENT'
          ), 0)
        ) AS outstanding,
        MAX(i.invoice_date) AS last_purchase
      FROM users u
      JOIN invoices i ON i.customer_id = u.id
      WHERE u.company_id = $1
        AND i.company_id = $1
        AND COALESCE(i.is_deleted, false) = false
        AND COALESCE(i.bill_purpose, '') != 'name_only'
        AND i.invoice_date BETWEEN $2::date AND $3::date
        AND u.role = 'customer'
      GROUP BY u.id, u.username, u.meta, u.initial_balance
      ORDER BY total_sales DESC
      LIMIT $4
    `;
    const data = await db.pgAll(sql, [companyId, startDate, endDate, parseInt(limit)]);
    const summary = {
      total_customers: data.length,
      total_revenue: data.reduce((a, b) => a + parseFloat(b.total_sales || 0), 0),
    };
    res.json({ data: data || [], summary });
  } catch (err) {
    console.error('top-customers error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/sales/customer-profitability
 */
router.get('/customer-profitability', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const sql = `
      SELECT
        u.username AS customer_name,
        COALESCE(SUM(i.total_amount), 0) AS revenue,
        COALESCE(SUM(
          (SELECT COALESCE(SUM(ili.quantity * p.cost_price), 0)
           FROM invoice_line_items ili
           LEFT JOIN products p ON p.id = ili.product_id
           WHERE ili.invoice_id = i.id)
        ), 0) AS cost,
        COALESCE(SUM(i.total_amount), 0) - COALESCE(SUM(
          (SELECT COALESCE(SUM(ili.quantity * p.cost_price), 0)
           FROM invoice_line_items ili
           LEFT JOIN products p ON p.id = ili.product_id
           WHERE ili.invoice_id = i.id)
        ), 0) AS profit,
        COUNT(i.id) AS invoice_count
      FROM users u
      JOIN invoices i ON i.customer_id = u.id
      WHERE u.company_id = $1
        AND COALESCE(i.is_deleted, false) = false
        AND COALESCE(i.bill_purpose, '') != 'name_only'
        AND i.invoice_date BETWEEN $2::date AND $3::date
        AND u.role = 'customer'
      GROUP BY u.id, u.username
      ORDER BY profit DESC
      LIMIT 20
    `;
    const data = await db.pgAll(sql, [companyId, startDate, endDate]);
    res.json({ data: data || [], summary: {} });
  } catch (err) {
    console.error('customer-profitability error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/sales/trend
 */
router.get('/trend', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to, group_by = 'month' } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const truncate = group_by === 'week' ? 'week' : group_by === 'day' ? 'day' : 'month';
    const format = group_by === 'day' ? 'DD Mon YYYY' : group_by === 'week' ? 'IW YYYY' : 'Mon YYYY';
    const sql = `
      SELECT
        TO_CHAR(DATE_TRUNC($4, i.invoice_date), $5) AS period,
        DATE_TRUNC($4, i.invoice_date) AS period_sort,
        COALESCE(SUM(i.total_amount), 0) AS revenue,
        COUNT(i.id) AS invoice_count,
        COALESCE(SUM(i.paid_amount), 0) AS collected
      FROM invoices i
      WHERE i.company_id = $1
        AND COALESCE(i.is_deleted, false) = false
        AND COALESCE(i.bill_purpose, '') != 'name_only'
        AND i.invoice_date BETWEEN $2::date AND $3::date
      GROUP BY period_sort, period
      ORDER BY period_sort ASC
    `;
    const data = await db.pgAll(sql, [companyId, startDate, endDate, truncate, format]);
    const summary = {
      total_revenue: data.reduce((a, b) => a + parseFloat(b.revenue || 0), 0),
      avg_monthly: data.length > 0 ? data.reduce((a, b) => a + parseFloat(b.revenue || 0), 0) / data.length : 0,
    };
    res.json({ data: data || [], summary });
  } catch (err) {
    console.error('sales/trend error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/sales/forecast
 */
router.get('/forecast', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  try {
    const sql = `
      SELECT
        TO_CHAR(DATE_TRUNC('month', i.invoice_date), 'Mon YYYY') AS period,
        DATE_TRUNC('month', i.invoice_date) AS period_sort,
        COALESCE(SUM(i.total_amount), 0) AS revenue
      FROM invoices i
      WHERE i.company_id = $1
        AND COALESCE(i.is_deleted, false) = false
        AND COALESCE(i.bill_purpose, '') != 'name_only'
        AND i.invoice_date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY period_sort, period
      ORDER BY period_sort ASC
    `;
    const historical = await db.pgAll(sql, [companyId]);
    const revenues = historical.map(r => parseFloat(r.revenue || 0));
    const avg = revenues.length > 0 ? revenues.reduce((a, b) => a + b, 0) / revenues.length : 0;
    const trend = revenues.length >= 2 ? (revenues[revenues.length - 1] - revenues[0]) / revenues.length : 0;

    const forecasts = [1, 2, 3].map(months => {
      const d = new Date();
      d.setMonth(d.getMonth() + months);
      return {
        period: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        revenue: Math.max(0, avg + trend * months),
        type: 'forecast',
      };
    });

    res.json({ data: [...historical.map(r => ({ ...r, type: 'actual' })), ...forecasts], summary: { avg_monthly: avg, trend } });
  } catch (err) {
    console.error('sales/forecast error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/sales/aging-receivables
 */
router.get('/aging-receivables', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  try {
    const sql = `
      SELECT
        u.username AS customer_name,
        -- Outstanding per age bucket, based on per-invoice balance (total - per-invoice payments)
        COALESCE(SUM(CASE WHEN CURRENT_DATE - i.invoice_date::date <= 30
          THEN GREATEST(0, i.total_amount - COALESCE((SELECT SUM(ip.amount) FROM invoice_payments ip WHERE ip.invoice_id=i.id),0)) ELSE 0 END), 0) AS days_0_30,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - i.invoice_date::date BETWEEN 31 AND 60
          THEN GREATEST(0, i.total_amount - COALESCE((SELECT SUM(ip.amount) FROM invoice_payments ip WHERE ip.invoice_id=i.id),0)) ELSE 0 END), 0) AS days_31_60,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - i.invoice_date::date BETWEEN 61 AND 90
          THEN GREATEST(0, i.total_amount - COALESCE((SELECT SUM(ip.amount) FROM invoice_payments ip WHERE ip.invoice_id=i.id),0)) ELSE 0 END), 0) AS days_61_90,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - i.invoice_date::date > 90
          THEN GREATEST(0, i.total_amount - COALESCE((SELECT SUM(ip.amount) FROM invoice_payments ip WHERE ip.invoice_id=i.id),0)) ELSE 0 END), 0) AS days_90_plus,
        -- All-time outstanding = opening + invoices - invoice_payments - returns - proprietor payments
        GREATEST(0,
          COALESCE(COALESCE((u.meta->>'customer_opening_balance')::NUMERIC, u.initial_balance), 0)
          + COALESCE((SELECT SUM(CASE WHEN UPPER(COALESCE(i2.invoice_type,''))!='SALES_RETURN' THEN i2.total_amount ELSE -i2.total_amount END) FROM invoices i2 WHERE i2.customer_id=u.id AND i2.company_id=$1 AND COALESCE(i2.is_deleted,false)=false AND COALESCE(i2.bill_purpose,'')!='name_only'), 0)
          - COALESCE((SELECT SUM(ip.amount) FROM invoice_payments ip JOIN invoices i3 ON i3.id=ip.invoice_id WHERE i3.customer_id=u.id AND i3.company_id=$1 AND COALESCE(i3.is_deleted,false)=false), 0)
          - COALESCE((SELECT SUM(sr.total_amount) FROM sales_returns sr WHERE sr.customer_id=u.id AND sr.company_id=$1), 0)
          - COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.reference_id=u.id AND t.company_id=$1 AND t.type='CUSTOMER_PAYMENT'), 0)
        ) AS total_outstanding
      FROM users u
      JOIN invoices i ON i.customer_id = u.id
      WHERE u.company_id = $1
        AND COALESCE(i.is_deleted, false) = false
        AND COALESCE(i.bill_purpose, '') != 'name_only'
        AND u.role = 'customer'
      GROUP BY u.id, u.username, u.meta, u.initial_balance
      HAVING GREATEST(0,
        COALESCE(COALESCE((u.meta->>'customer_opening_balance')::NUMERIC, u.initial_balance), 0)
        + COALESCE((SELECT SUM(CASE WHEN UPPER(COALESCE(i2.invoice_type,''))!='SALES_RETURN' THEN i2.total_amount ELSE -i2.total_amount END) FROM invoices i2 WHERE i2.customer_id=u.id AND i2.company_id=$1 AND COALESCE(i2.is_deleted,false)=false AND COALESCE(i2.bill_purpose,'')!='name_only'), 0)
        - COALESCE((SELECT SUM(ip.amount) FROM invoice_payments ip JOIN invoices i3 ON i3.id=ip.invoice_id WHERE i3.customer_id=u.id AND i3.company_id=$1 AND COALESCE(i3.is_deleted,false)=false), 0)
        - COALESCE((SELECT SUM(sr.total_amount) FROM sales_returns sr WHERE sr.customer_id=u.id AND sr.company_id=$1), 0)
        - COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.reference_id=u.id AND t.company_id=$1 AND t.type='CUSTOMER_PAYMENT'), 0)
      ) > 0
      ORDER BY total_outstanding DESC
    `;
    const data = await db.pgAll(sql, [companyId]);
    const summary = {
      total_outstanding: data.reduce((a, b) => a + parseFloat(b.total_outstanding || 0), 0),
      days_0_30: data.reduce((a, b) => a + parseFloat(b.days_0_30 || 0), 0),
      days_31_60: data.reduce((a, b) => a + parseFloat(b.days_31_60 || 0), 0),
      days_61_90: data.reduce((a, b) => a + parseFloat(b.days_61_90 || 0), 0),
      days_90_plus: data.reduce((a, b) => a + parseFloat(b.days_90_plus || 0), 0),
    };
    res.json({ data: data || [], summary });
  } catch (err) {
    console.error('aging-receivables error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/sales/monthly-growth
 */
router.get('/monthly-growth', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { year } = req.query;
  const targetYear = year || new Date().getFullYear();
  try {
    const sql = `
      SELECT
        TO_CHAR(DATE_TRUNC('month', i.invoice_date), 'Mon') AS month,
        EXTRACT(MONTH FROM i.invoice_date) AS month_num,
        COALESCE(SUM(i.total_amount), 0) AS revenue,
        COUNT(i.id) AS invoice_count
      FROM invoices i
      WHERE i.company_id = $1
        AND COALESCE(i.is_deleted, false) = false
        AND COALESCE(i.bill_purpose, '') != 'name_only'
        AND EXTRACT(YEAR FROM i.invoice_date) = $2
      GROUP BY month, month_num
      ORDER BY month_num ASC
    `;
    const data = await db.pgAll(sql, [companyId, targetYear]);
    res.json({ data: data || [], summary: { year: targetYear } });
  } catch (err) {
    console.error('monthly-growth error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/sales/product-performance
 */
router.get('/product-performance', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const sql = `
      SELECT
        p.name AS product_name,
        COALESCE(SUM(ili.quantity), 0) AS qty_sold,
        COALESCE(SUM(ili.line_total), 0) AS revenue,
        COALESCE(AVG(ili.unit_price), 0) AS avg_price,
        COALESCE(SUM(ili.quantity * p.cost_price), 0) AS cost,
        COALESCE(SUM(ili.line_total), 0) - COALESCE(SUM(ili.quantity * p.cost_price), 0) AS profit,
        CASE WHEN COALESCE(SUM(ili.line_total), 0) > 0
          THEN ROUND(((COALESCE(SUM(ili.line_total), 0) - COALESCE(SUM(ili.quantity * p.cost_price), 0)) / COALESCE(SUM(ili.line_total), 1)) * 100, 1)
          ELSE 0 END AS margin_pct
      FROM invoice_line_items ili
      JOIN invoices i ON ili.invoice_id = i.id
      JOIN products p ON ili.product_id = p.id
      WHERE i.company_id = $1
        AND COALESCE(i.is_deleted, false) = false
        AND COALESCE(i.bill_purpose, '') != 'name_only'
        AND i.invoice_date BETWEEN $2::date AND $3::date
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
      LIMIT 20
    `;
    const data = await db.pgAll(sql, [companyId, startDate, endDate]);
    res.json({ data: data || [], summary: {} });
  } catch (err) {
    console.error('product-performance error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

export default router;
