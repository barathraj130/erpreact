// backend/routes/reports/proprietor.js
import express from 'express';
import * as db from '../../database/pg.js';
import authMiddleware from '../../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

const getDateRange = (from, to) => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  return { from: from || firstDay, to: to || lastDay };
};

/**
 * GET /api/reports/proprietor/transactions
 * Detailed list of all proprietor transactions
 */
router.get('/transactions', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to, type } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    let where = `WHERE pt.company_id = $1 AND pt.transaction_date BETWEEN $2::date AND $3::date`;
    const params = [companyId, startDate, endDate];

    const typeMap = {
      capital_intro:    'CAPITAL_INTRO',
      drawing:          'DRAWINGS',
      personal_receipt: 'PERSONAL_RECEIPT',
      personal_payment: 'PERSONAL_PAYMENT',
    };
    if (type && type !== 'all' && typeMap[type]) {
      where += ` AND pt.transaction_type = $4`;
      params.push(typeMap[type]);
    }

    const rows = await db.pgAll(`
      SELECT
        pt.id,
        pt.transaction_date AS date,
        pt.transaction_type AS type,
        pt.reference_type,
        pt.amount,
        pt.payment_mode,
        pt.notes,
        pt.created_at
      FROM proprietor_transactions pt
      ${where}
      ORDER BY pt.transaction_date DESC, pt.created_at DESC
    `, params).catch(() => []);

    const totals = await db.pgGet(`
      SELECT
        COALESCE(SUM(CASE WHEN transaction_type='CAPITAL_INTRO'    THEN amount ELSE 0 END),0) AS capital_intro,
        COALESCE(SUM(CASE WHEN transaction_type='DRAWINGS'         THEN amount ELSE 0 END),0) AS drawings,
        COALESCE(SUM(CASE WHEN transaction_type='PERSONAL_RECEIPT' THEN amount ELSE 0 END),0) AS personal_receipts,
        COALESCE(SUM(CASE WHEN transaction_type='PERSONAL_PAYMENT' THEN amount ELSE 0 END),0) AS personal_payments
      FROM proprietor_transactions
      WHERE company_id=$1 AND transaction_date BETWEEN $2::date AND $3::date
    `, [companyId, startDate, endDate]).catch(() => ({ capital_intro: 0, drawings: 0, personal_receipts: 0, personal_payments: 0 }));

    const cap  = parseFloat(totals?.capital_intro   || 0);
    const draw = parseFloat(totals?.drawings         || 0);
    const pr   = parseFloat(totals?.personal_receipts|| 0);
    const pp   = parseFloat(totals?.personal_payments|| 0);

    res.json({
      data: rows,
      summary: {
        total_capital_intro: cap,
        total_drawings: draw,
        net_capital: cap - draw,
        total_personal_receipts: pr,
        total_personal_payments: pp,
        from: startDate,
        to: endDate,
      },
    });
  } catch (err) {
    console.error('proprietor/transactions error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

export default router;
