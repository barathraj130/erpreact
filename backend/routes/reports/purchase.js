// backend/routes/reports/purchase.js
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
 * GET /api/reports/purchase/vendor-performance
 */
router.get('/vendor-performance', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const sql = `
      SELECT
        COALESCE(s.name, pb.supplier_name, 'Unknown') AS vendor_name,
        COUNT(pb.id) AS bill_count,
        COALESCE(SUM(pb.total_amount), 0) AS total_purchased,
        COALESCE(SUM(pb.paid_amount), 0) AS total_paid,
        COALESCE(SUM(pb.balance_amount), 0) AS outstanding,
        MAX(pb.bill_date) AS last_purchase
      FROM purchase_bills pb
      LEFT JOIN suppliers s ON pb.supplier_id = s.id
      WHERE pb.company_id = $1
        AND COALESCE(pb.is_deleted, false) = false
        AND pb.bill_date BETWEEN $2::date AND $3::date
      GROUP BY s.id, s.name, pb.supplier_name
      ORDER BY total_purchased DESC
      LIMIT 20
    `;
    const rawData = await db.pgAll(sql, [companyId, startDate, endDate]);
    const data = rawData.map(r => ({
      ...r,
      bill_count: parseFloat(r.bill_count || 0),
      total_purchased: parseFloat(r.total_purchased || 0),
      total_paid: parseFloat(r.total_paid || 0),
      outstanding: parseFloat(r.outstanding || 0),
    }));
    const summary = {
      total_vendors: data.length,
      total_purchased: data.reduce((a, b) => a + (b.total_purchased || 0), 0),
      total_outstanding: data.reduce((a, b) => a + (b.outstanding || 0), 0),
    };
    res.json({ data: data || [], summary });
  } catch (err) {
    console.error('vendor-performance error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/purchase/payment-aging
 */
router.get('/payment-aging', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  try {
    const sql = `
      SELECT
        COALESCE(s.name, pb.supplier_name, 'Unknown') AS vendor_name,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - pb.bill_date::date <= 30 THEN pb.balance_amount ELSE 0 END), 0) AS days_0_30,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - pb.bill_date::date BETWEEN 31 AND 60 THEN pb.balance_amount ELSE 0 END), 0) AS days_31_60,
        COALESCE(SUM(CASE WHEN CURRENT_DATE - pb.bill_date::date > 60 THEN pb.balance_amount ELSE 0 END), 0) AS days_60_plus,
        COALESCE(SUM(pb.balance_amount), 0) AS total_outstanding
      FROM purchase_bills pb
      LEFT JOIN suppliers s ON pb.supplier_id = s.id
      WHERE pb.company_id = $1
        AND COALESCE(pb.is_deleted, false) = false
      GROUP BY s.id, s.name, pb.supplier_name
      HAVING COALESCE(SUM(pb.balance_amount), 0) > 0
      ORDER BY total_outstanding DESC
    `;
    const rawData = await db.pgAll(sql, [companyId]);
    const data = rawData.map(r => ({
      ...r,
      days_0_30: parseFloat(r.days_0_30 || 0),
      days_31_60: parseFloat(r.days_31_60 || 0),
      days_60_plus: parseFloat(r.days_60_plus || 0),
      total_outstanding: parseFloat(r.total_outstanding || 0),
    }));
    const summary = {
      total_payable: data.reduce((a, b) => a + (b.total_outstanding || 0), 0),
    };
    res.json({ data: data || [], summary });
  } catch (err) {
    console.error('payment-aging error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/purchase/monthly-trend
 */
router.get('/monthly-trend', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const sql = `
      SELECT
        TO_CHAR(DATE_TRUNC('month', pb.bill_date), 'Mon YYYY') AS period,
        DATE_TRUNC('month', pb.bill_date) AS period_sort,
        COALESCE(SUM(COALESCE(pb.total_amount, pb.grand_total, pb.net_amount, 0)), 0) AS amount,
        COUNT(pb.id) AS bill_count
      FROM purchase_bills pb
      WHERE pb.company_id = $1
        AND COALESCE(pb.is_deleted, false) = false
        AND pb.bill_date BETWEEN $2::date AND $3::date
      GROUP BY period_sort, period
      ORDER BY period_sort ASC
    `;
    const rawData = await db.pgAll(sql, [companyId, startDate, endDate]);
    const data = rawData.map(r => ({
      ...r,
      amount: parseFloat(r.amount || 0),
      bill_count: parseFloat(r.bill_count || 0),
    }));
    res.json({ data: data || [], summary: {} });
  } catch (err) {
    console.error('purchase/monthly-trend error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/purchase/price-variance
 */
router.get('/price-variance', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const sql = `
      SELECT
        p.name AS product_name,
        COALESCE(MIN(pbi.unit_price), 0) AS min_price,
        COALESCE(MAX(pbi.unit_price), 0) AS max_price,
        COALESCE(AVG(pbi.unit_price), 0) AS avg_price,
        COALESCE(MAX(pbi.unit_price), 0) - COALESCE(MIN(pbi.unit_price), 0) AS variance,
        COUNT(pbi.id) AS purchase_count
      FROM purchase_bill_items pbi
      JOIN purchase_bills pb ON pbi.bill_id = pb.id
      LEFT JOIN products p ON pbi.product_id = p.id
      WHERE pb.company_id = $1
        AND COALESCE(pb.is_deleted, false) = false
        AND pb.bill_date BETWEEN $2::date AND $3::date
        AND pbi.unit_price > 0
      GROUP BY p.id, p.name, pbi.product_name
      HAVING COUNT(pbi.id) > 1
      ORDER BY variance DESC
      LIMIT 20
    `;
    const data = await db.pgAll(sql, [companyId, startDate, endDate]);
    res.json({ data: data || [], summary: {} });
  } catch (err) {
    console.error('price-variance error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

export default router;
