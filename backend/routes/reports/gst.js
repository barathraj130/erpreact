// backend/routes/reports/gst.js
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
 * GET /api/reports/gst/audit
 */
router.get('/audit', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const sql = `
      SELECT
        i.invoice_date AS date,
        i.invoice_number AS invoice_no,
        COALESCE(u.username, 'Unknown') AS customer_name,
        COALESCE(i.total_amount, 0) AS total_amount,
        COALESCE(i.cgst_amount, 0) AS cgst,
        COALESCE(i.sgst_amount, 0) AS sgst,
        COALESCE(i.igst_amount, 0) AS igst,
        COALESCE(i.cgst_amount, 0) + COALESCE(i.sgst_amount, 0) + COALESCE(i.igst_amount, 0) AS total_gst,
        i.invoice_type
      FROM invoices i
      LEFT JOIN users u ON i.customer_id = u.id
      WHERE i.company_id = $1
        AND COALESCE(i.is_deleted, false) = false
        AND COALESCE(i.bill_purpose, '') != 'name_only'
        AND i.invoice_date BETWEEN $2::date AND $3::date
      ORDER BY i.invoice_date DESC
      LIMIT 500
    `;
    const data = await db.pgAll(sql, [companyId, startDate, endDate]);
    const summary = {
      total_invoices: data.length,
      total_taxable: data.reduce((a, b) => a + parseFloat(b.total_amount || 0) - parseFloat(b.total_gst || 0), 0),
      total_cgst: data.reduce((a, b) => a + parseFloat(b.cgst || 0), 0),
      total_sgst: data.reduce((a, b) => a + parseFloat(b.sgst || 0), 0),
      total_igst: data.reduce((a, b) => a + parseFloat(b.igst || 0), 0),
      total_gst: data.reduce((a, b) => a + parseFloat(b.total_gst || 0), 0),
    };
    res.json({ data: data || [], summary });
  } catch (err) {
    console.error('gst/audit error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/gst/tax-liability
 */
router.get('/tax-liability', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const [outputGst, inputGst] = await Promise.all([
      db.pgGet(`
        SELECT
          COALESCE(SUM(cgst_amount), 0) AS output_cgst,
          COALESCE(SUM(sgst_amount), 0) AS output_sgst,
          COALESCE(SUM(igst_amount), 0) AS output_igst
        FROM invoices
        WHERE company_id = $1
          AND COALESCE(is_deleted, false) = false
          AND COALESCE(bill_purpose, '') != 'name_only'
          AND invoice_date BETWEEN $2::date AND $3::date
      `, [companyId, startDate, endDate]),
      db.pgGet(`
        SELECT
          COALESCE(SUM(cgst_total), 0) AS input_cgst,
          COALESCE(SUM(sgst_total), 0) AS input_sgst,
          COALESCE(SUM(igst_total), 0) AS input_igst
        FROM purchase_bills
        WHERE company_id = $1
          AND COALESCE(is_deleted, false) = false
          AND bill_date BETWEEN $2::date AND $3::date
      `, [companyId, startDate, endDate]).catch(() => ({ input_cgst: 0, input_sgst: 0, input_igst: 0 })),
    ]);
    const outCgst = parseFloat(outputGst?.output_cgst || 0);
    const outSgst = parseFloat(outputGst?.output_sgst || 0);
    const outIgst = parseFloat(outputGst?.output_igst || 0);
    const inCgst = parseFloat(inputGst?.input_cgst || 0);
    const inSgst = parseFloat(inputGst?.input_sgst || 0);
    const inIgst = parseFloat(inputGst?.input_igst || 0);
    const data = [
      { tax_type: 'CGST', output: outCgst, input: inCgst, net_liability: outCgst - inCgst },
      { tax_type: 'SGST', output: outSgst, input: inSgst, net_liability: outSgst - inSgst },
      { tax_type: 'IGST', output: outIgst, input: inIgst, net_liability: outIgst - inIgst },
    ];
    const summary = {
      total_output: outCgst + outSgst + outIgst,
      total_input: inCgst + inSgst + inIgst,
      net_liability: (outCgst + outSgst + outIgst) - (inCgst + inSgst + inIgst),
    };
    res.json({ data, summary });
  } catch (err) {
    console.error('tax-liability error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/gst/collection-trend
 */
router.get('/collection-trend', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { year } = req.query;
  const targetYear = year || new Date().getFullYear();
  try {
    const sql = `
      SELECT
        TO_CHAR(DATE_TRUNC('month', invoice_date), 'Mon') AS month,
        EXTRACT(MONTH FROM invoice_date) AS month_num,
        COALESCE(SUM(cgst_amount), 0) AS cgst,
        COALESCE(SUM(sgst_amount), 0) AS sgst,
        COALESCE(SUM(igst_amount), 0) AS igst,
        COALESCE(SUM(cgst_amount), 0) + COALESCE(SUM(sgst_amount), 0) + COALESCE(SUM(igst_amount), 0) AS total_gst
      FROM invoices
      WHERE company_id = $1
        AND COALESCE(is_deleted, false) = false
        AND COALESCE(bill_purpose, '') != 'name_only'
        AND EXTRACT(YEAR FROM invoice_date) = $2
      GROUP BY month, month_num
      ORDER BY month_num ASC
    `;
    const data = await db.pgAll(sql, [companyId, targetYear]);
    res.json({ data: data || [], summary: { year: targetYear } });
  } catch (err) {
    console.error('collection-trend error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

export default router;
