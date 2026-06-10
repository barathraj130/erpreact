// backend/routes/reports/executive.js
import express from 'express';
import * as db from '../../database/pg.js';
import authMiddleware from '../../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * GET /api/reports/executive/kpis
 */
router.get('/kpis', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const now = new Date();
  const startDate = from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endDate = to || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  try {
    const [
      salesData, purchaseData, receivablesData,
      customerCount, productCount, attendanceData,
      salaryData, prevSalesData,
      propData, propAllTime,
    ] = await Promise.all([
      db.pgGet(`SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(id) AS count FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only' AND invoice_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]),
      db.pgGet(`SELECT COALESCE(SUM(COALESCE(total_amount,grand_total,net_amount,0)),0) AS total FROM purchase_bills WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND bill_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount,0)),0) AS total FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only'`, [companyId]),
      db.pgGet(`SELECT COUNT(*) AS count FROM users WHERE company_id=$1 AND role='customer'`, [companyId]),
      db.pgGet(`SELECT COUNT(*) AS count FROM products WHERE company_id=$1 AND COALESCE(is_deleted,false)=false`, [companyId]),
      db.pgGet(`SELECT COUNT(CASE WHEN UPPER(status) IN ('PRESENT','OD') THEN 1 END) AS present, COUNT(id) AS total FROM attendance_logs WHERE company_id=$1 AND date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]),
      db.pgGet(`SELECT COALESCE(SUM(sp.amount),0) AS total FROM salary_payments sp JOIN salaries s ON s.id=sp.salary_id WHERE s.company_id=$1 AND sp.date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(total_amount),0) AS total FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only' AND invoice_date BETWEEN (($2::date) - INTERVAL '1 month') AND (($3::date) - INTERVAL '1 month')`, [companyId, startDate, endDate]),
      // Proprietor period data
      db.pgGet(`SELECT COALESCE(SUM(CASE WHEN transaction_type='CAPITAL_INTRO' THEN amount ELSE 0 END),0) AS capital_intro, COALESCE(SUM(CASE WHEN transaction_type='DRAWINGS' THEN amount ELSE 0 END),0) AS drawings, COALESCE(SUM(CASE WHEN transaction_type='PERSONAL_RECEIPT' THEN amount ELSE 0 END),0) AS personal_receipts FROM proprietor_transactions WHERE company_id=$1 AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ capital_intro: 0, drawings: 0, personal_receipts: 0 })),
      // Proprietor all-time capital invested
      db.pgGet(`SELECT COALESCE(SUM(CASE WHEN transaction_type='CAPITAL_INTRO' THEN amount ELSE 0 END),0) AS capital_invested, COALESCE(SUM(CASE WHEN transaction_type='DRAWINGS' THEN amount ELSE 0 END),0) AS drawings_ytd FROM proprietor_transactions WHERE company_id=$1`, [companyId]).catch(() => ({ capital_invested: 0, drawings_ytd: 0 })),
    ]);

    const currentRevenue  = parseFloat(salesData?.total || 0);
    const prevRevenue     = parseFloat(prevSalesData?.total || 0);
    const revenueGrowth   = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue * 100).toFixed(1) : null;
    const totalPurchases  = parseFloat(purchaseData?.total || 0);
    const grossProfit     = currentRevenue - totalPurchases;
    const propCapitalPeriod = parseFloat(propData?.capital_intro || 0);
    const propDrawingsPeriod = parseFloat(propData?.drawings || 0);
    const propPersonalRec   = parseFloat(propData?.personal_receipts || 0);
    const trueRevenue       = currentRevenue + propPersonalRec;
    const capitalInvested   = parseFloat(propAllTime?.capital_invested || 0);
    const drawingsYTD       = parseFloat(propAllTime?.drawings_ytd || 0);
    const netEquity         = capitalInvested - drawingsYTD;
    const fundedByPropPct   = trueRevenue > 0 ? ((propCapitalPeriod / trueRevenue) * 100).toFixed(1) : 0;

    res.json({
      data: {
        revenue: { value: currentRevenue, trend: revenueGrowth, label: 'Revenue' },
        purchases: { value: totalPurchases, label: 'Purchases' },
        gross_profit: { value: grossProfit, label: 'Gross Profit' },
        receivables: { value: parseFloat(receivablesData?.total || 0), label: 'Receivables' },
        customers: { value: parseInt(customerCount?.count || 0), label: 'Customers' },
        products: { value: parseInt(productCount?.count || 0), label: 'Products' },
        invoice_count: { value: parseInt(salesData?.count || 0), label: 'Invoices' },
        salary_cost: { value: parseFloat(salaryData?.total || 0), label: 'Salary Cost' },
        attendance_rate: {
          value: attendanceData?.total > 0 ? ((attendanceData.present / attendanceData.total) * 100).toFixed(1) : 0,
          label: 'Attendance Rate',
        },
        // Proprietor metrics
        true_revenue: { value: trueRevenue, label: 'True Total Revenue' },
        proprietor_capital_period: { value: propCapitalPeriod, label: 'Capital Introduced (Period)' },
        proprietor_drawings_period: { value: propDrawingsPeriod, label: 'Drawings (Period)' },
        proprietor_capital_invested: { value: capitalInvested, label: 'Capital Invested (All Time)' },
        proprietor_drawings_ytd: { value: drawingsYTD, label: 'Drawings (All Time)' },
        proprietor_net_equity: { value: netEquity, label: 'Net Proprietor Equity' },
        business_funded_by_proprietor_pct: { value: fundedByPropPct, label: '% Funded by Proprietor' },
      },
      summary: { from: startDate, to: endDate },
    });
  } catch (err) {
    console.error('executive/kpis error:', err.message);
    res.json({ data: {}, summary: {} });
  }
});

/**
 * GET /api/reports/executive/insights
 * Rule-based alerts, no AI
 */
router.get('/insights', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  try {
    const [
      overdueReceivables, lowStockProducts, pendingPayables, highAbsence
    ] = await Promise.all([
      db.pgGet(`SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount,0)),0) AS total, COUNT(*) AS count FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND invoice_date < CURRENT_DATE - INTERVAL '30 days' AND total_amount - COALESCE(paid_amount,0) > 0`, [companyId]),
      db.pgGet(`SELECT COUNT(*) AS count FROM products WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND current_stock <= COALESCE(min_stock_level,5)`, [companyId]),
      db.pgGet(`SELECT COALESCE(SUM(COALESCE(total_amount,grand_total,net_amount,0)),0) AS total FROM purchase_bills WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND bill_date < CURRENT_DATE - INTERVAL '30 days'`, [companyId]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COUNT(*) AS count FROM attendance_logs WHERE company_id=$1 AND status='ABSENT' AND date >= CURRENT_DATE - INTERVAL '7 days'`, [companyId]),
    ]);

    const insights = [];
    const overdue = parseFloat(overdueReceivables?.total || 0);
    if (overdue > 0) {
      insights.push({ type: 'alert', message: `${overdueReceivables.count} overdue invoices totaling ₹${Number(overdue).toLocaleString('en-IN')} — follow up needed`, category: 'receivables' });
    }
    const lowStock = parseInt(lowStockProducts?.count || 0);
    if (lowStock > 0) {
      insights.push({ type: 'warning', message: `${lowStock} products are at or below minimum stock level — reorder required`, category: 'inventory' });
    }
    const payables = parseFloat(pendingPayables?.total || 0);
    if (payables > 0) {
      insights.push({ type: 'info', message: `Pending supplier payments over 30 days: ₹${Number(payables).toLocaleString('en-IN')}`, category: 'payables' });
    }
    const absences = parseInt(highAbsence?.count || 0);
    if (absences > 5) {
      insights.push({ type: 'warning', message: `${absences} employee absences recorded this week`, category: 'hr' });
    }
    if (insights.length === 0) {
      insights.push({ type: 'success', message: 'All business metrics are within normal range', category: 'general' });
    }

    res.json({ data: insights, summary: { count: insights.length } });
  } catch (err) {
    console.error('executive/insights error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/executive/revenue-forecast
 */
router.get('/revenue-forecast', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { months = 3 } = req.query;
  try {
    const sql = `
      SELECT
        TO_CHAR(DATE_TRUNC('month', invoice_date), 'Mon YYYY') AS period,
        DATE_TRUNC('month', invoice_date) AS period_sort,
        COALESCE(SUM(total_amount), 0) AS revenue
      FROM invoices
      WHERE company_id = $1
        AND COALESCE(is_deleted, false) = false
        AND COALESCE(bill_purpose, '') != 'name_only'
        AND invoice_date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY period_sort, period
      ORDER BY period_sort ASC
    `;
    const historical = await db.pgAll(sql, [companyId]);
    const revenues = historical.map(r => parseFloat(r.revenue || 0));
    const n = revenues.length;
    const avg = n > 0 ? revenues.reduce((a, b) => a + b, 0) / n : 0;
    const trend = n >= 2 ? (revenues[n - 1] - revenues[0]) / Math.max(n - 1, 1) : 0;

    const forecasts = Array.from({ length: parseInt(months) }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() + i + 1);
      return {
        period: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        period_sort: d.toISOString(),
        revenue: Math.max(0, avg + trend * (i + 1)),
        type: 'forecast',
      };
    });

    res.json({
      data: [...historical.map(r => ({ ...r, type: 'actual' })), ...forecasts],
      summary: { avg_monthly: avg, trend_per_month: trend },
    });
  } catch (err) {
    console.error('revenue-forecast error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/executive/risk-indicators
 */
router.get('/risk-indicators', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  try {
    const [
      receivablesRatio, stockoutRisk, payablesRatio, attendanceRisk
    ] = await Promise.all([
      Promise.all([
        db.pgGet(`SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount,0)),0) AS overdue FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND invoice_date < CURRENT_DATE - INTERVAL '60 days' AND total_amount > COALESCE(paid_amount,0)`, [companyId]),
        db.pgGet(`SELECT COALESCE(SUM(total_amount),0) AS total FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only'`, [companyId]),
      ]),
      db.pgGet(`SELECT COUNT(*) AS count, (SELECT COUNT(*) FROM products WHERE company_id=$1 AND COALESCE(is_deleted,false)=false) AS total FROM products WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND current_stock = 0`, [companyId]),
      Promise.all([
        db.pgGet(`SELECT COALESCE(SUM(COALESCE(total_amount,grand_total,net_amount,0)),0) AS overdue FROM purchase_bills WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND bill_date < CURRENT_DATE - INTERVAL '60 days'`, [companyId]).catch(() => ({ overdue: 0 })),
        db.pgGet(`SELECT COALESCE(SUM(COALESCE(total_amount,grand_total,net_amount,0)),0) AS total FROM purchase_bills WHERE company_id=$1 AND COALESCE(is_deleted,false)=false`, [companyId]).catch(() => ({ total: 0 })),
      ]),
      db.pgGet(`SELECT COUNT(CASE WHEN UPPER(status)='ABSENT' THEN 1 END) AS absent, COUNT(id) AS total FROM attendance_logs WHERE company_id=$1 AND date >= CURRENT_DATE - INTERVAL '30 days'`, [companyId]),
    ]);

    const [overdueRec, totalRec] = receivablesRatio;
    const overdueRecPct = parseFloat(totalRec?.total || 0) > 0 ? (parseFloat(overdueRec?.overdue || 0) / parseFloat(totalRec?.total || 0) * 100) : 0;
    const stockoutPct = parseInt(stockoutRisk?.total || 0) > 0 ? (parseInt(stockoutRisk?.count || 0) / parseInt(stockoutRisk?.total || 1) * 100) : 0;
    const [overduePayRec, totalPayRec] = payablesRatio;
    const overduePayPct = parseFloat(totalPayRec?.total || 0) > 0 ? (parseFloat(overduePayRec?.overdue || 0) / parseFloat(totalPayRec?.total || 0) * 100) : 0;
    const absencePct = parseInt(attendanceRisk?.total || 0) > 0 ? (parseInt(attendanceRisk?.absent || 0) / parseInt(attendanceRisk?.total || 1) * 100) : 0;

    const getRiskLevel = (pct) => pct > 30 ? 'high' : pct > 15 ? 'medium' : 'low';

    const data = [
      { indicator: 'Overdue Receivables', value: overdueRecPct.toFixed(1), unit: '%', risk_level: getRiskLevel(overdueRecPct), description: 'Receivables overdue > 60 days' },
      { indicator: 'Stockout Risk', value: stockoutPct.toFixed(1), unit: '%', risk_level: getRiskLevel(stockoutPct), description: 'Products with zero stock' },
      { indicator: 'Overdue Payables', value: overduePayPct.toFixed(1), unit: '%', risk_level: getRiskLevel(overduePayPct), description: 'Payables overdue > 60 days' },
      { indicator: 'Absence Rate', value: absencePct.toFixed(1), unit: '%', risk_level: getRiskLevel(absencePct), description: 'Employee absence rate (30 days)' },
    ];

    res.json({ data, summary: {} });
  } catch (err) {
    console.error('risk-indicators error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

export default router;
