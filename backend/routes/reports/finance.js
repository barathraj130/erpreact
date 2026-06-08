// backend/routes/reports/finance.js
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

// Ensure budget_targets table exists
const ensureBudgetTable = async () => {
  try {
    await db.pgRun(`
      CREATE TABLE IF NOT EXISTS budget_targets (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        category VARCHAR(100) NOT NULL,
        budget_amount NUMERIC(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, year, month, category)
      )
    `);
  } catch (err) {
    console.error('ensureBudgetTable error:', err.message);
  }
};

/**
 * GET /api/reports/finance/budget-vs-actual
 */
router.get('/budget-vs-actual', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { year, month } = req.query;
  const targetYear = parseInt(year) || new Date().getFullYear();
  const targetMonth = parseInt(month) || new Date().getMonth() + 1;
  try {
    await ensureBudgetTable();
    const [budgets, actual] = await Promise.all([
      db.pgAll(
        `SELECT category, budget_amount FROM budget_targets WHERE company_id=$1 AND year=$2 AND month=$3`,
        [companyId, targetYear, targetMonth]
      ),
      Promise.all([
        db.pgGet(`SELECT COALESCE(SUM(total_amount),0) AS total FROM invoices WHERE company_id=$1 AND EXTRACT(YEAR FROM invoice_date)=$2 AND EXTRACT(MONTH FROM invoice_date)=$3 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only'`, [companyId, targetYear, targetMonth]),
        db.pgGet(`SELECT COALESCE(SUM(COALESCE(total_amount,grand_total,net_amount,0)),0) AS total FROM purchase_bills WHERE company_id=$1 AND EXTRACT(YEAR FROM bill_date)=$2 AND EXTRACT(MONTH FROM bill_date)=$3 AND COALESCE(is_deleted,false)=false`, [companyId, targetYear, targetMonth]).catch(() => ({ total: 0 })),
        db.pgGet(`SELECT COALESCE(SUM(sp.amount),0) AS total FROM salary_payments sp JOIN salaries s ON s.id=sp.salary_id WHERE s.company_id=$1 AND EXTRACT(YEAR FROM sp.date)=$2 AND EXTRACT(MONTH FROM sp.date)=$3`, [companyId, targetYear, targetMonth]).catch(() => ({ total: 0 })),
      ]),
    ]);
    const [salesActual, purchaseActual, salaryActual] = actual;
    const budgetMap = {};
    budgets.forEach(b => { budgetMap[b.category] = parseFloat(b.budget_amount || 0); });
    const data = [
      { category: 'Sales Revenue', budget: budgetMap['Sales Revenue'] || 0, actual: parseFloat(salesActual?.total || 0) },
      { category: 'Purchases', budget: budgetMap['Purchases'] || 0, actual: parseFloat(purchaseActual?.total || 0) },
      { category: 'Salary', budget: budgetMap['Salary'] || 0, actual: parseFloat(salaryActual?.total || 0) },
    ];
    data.forEach(d => { d.variance = d.actual - d.budget; d.variance_pct = d.budget > 0 ? ((d.variance / d.budget) * 100).toFixed(1) : 0; });
    res.json({ data, summary: { year: targetYear, month: targetMonth } });
  } catch (err) {
    console.error('budget-vs-actual error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * POST /api/reports/finance/budget
 */
router.post('/budget', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { year, month, category, budget_amount } = req.body;
  try {
    await ensureBudgetTable();
    await db.pgRun(
      `INSERT INTO budget_targets (company_id, year, month, category, budget_amount, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (company_id, year, month, category)
       DO UPDATE SET budget_amount = $5, updated_at = NOW()`,
      [companyId, year, month, category, budget_amount]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('budget POST error:', err.message);
    res.json({ success: false, error: err.message });
  }
});

/**
 * GET /api/reports/finance/fund-flow
 */
router.get('/fund-flow', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const [salesInflow, purchaseOutflow, salaryOutflow, loanInflow, loanOutflow] = await Promise.all([
      db.pgGet(`SELECT COALESCE(SUM(total_amount),0) AS total FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only' AND invoice_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]),
      db.pgGet(`SELECT COALESCE(SUM(COALESCE(total_amount,grand_total,net_amount,0)),0) AS total FROM purchase_bills WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND bill_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(sp.net_salary),0) AS total FROM salary_payments sp JOIN salaries s ON s.id=sp.salary_id WHERE s.company_id=$1 AND COALESCE(sp.paid_date, sp.created_at::date) BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(principal_amount),0) AS total FROM loans WHERE company_id=$1 AND UPPER(COALESCE(loan_direction,'TAKEN'))='TAKEN' AND created_at::date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(lp.total_amount),0) AS total FROM loan_payments lp JOIN loans l ON l.id=lp.loan_id WHERE l.company_id=$1 AND lp.payment_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
    ]);
    const data = [
      { category: 'Sales Revenue', type: 'inflow', amount: parseFloat(salesInflow?.total || 0) },
      { category: 'Loan Received', type: 'inflow', amount: parseFloat(loanInflow?.total || 0) },
      { category: 'Purchases', type: 'outflow', amount: parseFloat(purchaseOutflow?.total || 0) },
      { category: 'Salary', type: 'outflow', amount: parseFloat(salaryOutflow?.total || 0) },
      { category: 'Loan Repayment', type: 'outflow', amount: parseFloat(loanOutflow?.total || 0) },
    ];
    const totalInflow = data.filter(d => d.type === 'inflow').reduce((a, b) => a + b.amount, 0);
    const totalOutflow = data.filter(d => d.type === 'outflow').reduce((a, b) => a + b.amount, 0);
    res.json({ data, summary: { total_inflow: totalInflow, total_outflow: totalOutflow, net_flow: totalInflow - totalOutflow } });
  } catch (err) {
    console.error('fund-flow error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/finance/profitability
 */
router.get('/profitability', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const [sales, purchases, salaries, expenses] = await Promise.all([
      db.pgGet(`SELECT COALESCE(SUM(total_amount),0) AS total FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only' AND invoice_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]),
      db.pgGet(`SELECT COALESCE(SUM(COALESCE(total_amount,grand_total,net_amount,0)),0) AS total FROM purchase_bills WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND bill_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(sp.net_salary),0) AS total FROM salary_payments sp JOIN salaries s ON s.id=sp.salary_id WHERE s.company_id=$1 AND COALESCE(sp.paid_date, sp.created_at::date) BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE company_id=$1 AND expense_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
    ]);
    const revenue = parseFloat(sales?.total || 0);
    const cogs = parseFloat(purchases?.total || 0);
    const grossProfit = revenue - cogs;
    const opExpenses = parseFloat(salaries?.total || 0) + parseFloat(expenses?.total || 0);
    const netProfit = grossProfit - opExpenses;
    const data = [
      { label: 'Revenue', value: revenue, type: 'income' },
      { label: 'Cost of Goods', value: -cogs, type: 'expense' },
      { label: 'Gross Profit', value: grossProfit, type: 'subtotal' },
      { label: 'Operating Expenses', value: -opExpenses, type: 'expense' },
      { label: 'Net Profit', value: netProfit, type: 'total' },
    ];
    res.json({ data, summary: { revenue, cogs, gross_profit: grossProfit, net_profit: netProfit, gross_margin: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : 0 } });
  } catch (err) {
    console.error('profitability error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/finance/ratios
 */
router.get('/ratios', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const [sales, purchases, receivables, payables, inventory] = await Promise.all([
      db.pgGet(`SELECT COALESCE(SUM(total_amount),0) AS total FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only' AND invoice_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]),
      db.pgGet(`SELECT COALESCE(SUM(COALESCE(total_amount,grand_total,net_amount,0)),0) AS total FROM purchase_bills WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND bill_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount,0)),0) AS total FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only'`, [companyId]),
      db.pgGet(`SELECT COALESCE(SUM(COALESCE(total_amount,grand_total,net_amount,0)),0) AS total FROM purchase_bills WHERE company_id=$1 AND COALESCE(is_deleted,false)=false`, [companyId]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(current_stock * COALESCE(cost_price,0)),0) AS total FROM products WHERE company_id=$1 AND COALESCE(is_deleted,false)=false`, [companyId]),
    ]);
    const rev = parseFloat(sales?.total || 0);
    const cogs = parseFloat(purchases?.total || 0);
    const rec = parseFloat(receivables?.total || 0);
    const pay = parseFloat(payables?.total || 0);
    const inv = parseFloat(inventory?.total || 0);
    const grossMargin = rev > 0 ? ((rev - cogs) / rev * 100).toFixed(1) : 0;
    const currentRatio = pay > 0 ? (rec + inv) / pay : 0;
    const dso = rev > 0 ? (rec / rev * 365).toFixed(0) : 0;
    const inventoryTurnover = inv > 0 ? (cogs / inv).toFixed(2) : 0;
    const data = [
      { ratio: 'Gross Margin', value: `${grossMargin}%`, description: 'Revenue minus COGS / Revenue' },
      { ratio: 'Current Ratio', value: currentRatio.toFixed(2), description: 'Current Assets / Current Liabilities' },
      { ratio: 'Days Sales Outstanding', value: `${dso} days`, description: 'Average collection period' },
      { ratio: 'Inventory Turnover', value: `${inventoryTurnover}x`, description: 'COGS / Inventory Value' },
    ];
    res.json({ data, summary: {} });
  } catch (err) {
    console.error('ratios error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/finance/cash-forecast
 */
router.get('/cash-forecast', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { days = 30 } = req.query;
  try {
    const [avgDailySales, avgDailyPurchases, receivables, payables] = await Promise.all([
      db.pgGet(`SELECT COALESCE(SUM(total_amount),0)/30 AS daily_avg FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND invoice_date >= CURRENT_DATE - INTERVAL '30 days'`, [companyId]),
      db.pgGet(`SELECT COALESCE(SUM(COALESCE(total_amount,grand_total,net_amount,0)),0)/30 AS daily_avg FROM purchase_bills WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND bill_date >= CURRENT_DATE - INTERVAL '30 days'`, [companyId]).catch(() => ({ daily_avg: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount,0)),0) AS total FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only'`, [companyId]),
      db.pgGet(`SELECT COALESCE(SUM(COALESCE(total_amount,grand_total,net_amount,0)),0) AS total FROM purchase_bills WHERE company_id=$1 AND COALESCE(is_deleted,false)=false`, [companyId]).catch(() => ({ total: 0 })),
    ]);
    const dailyInflow = parseFloat(avgDailySales?.daily_avg || 0);
    const dailyOutflow = parseFloat(avgDailyPurchases?.daily_avg || 0);
    const openingBalance = parseFloat(receivables?.total || 0) - parseFloat(payables?.total || 0);
    const data = [];
    let balance = openingBalance;
    for (let i = 0; i < Math.min(parseInt(days), 30); i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      balance += dailyInflow - dailyOutflow;
      data.push({
        date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        inflow: dailyInflow,
        outflow: dailyOutflow,
        balance: Math.max(0, balance),
      });
    }
    res.json({ data, summary: { opening_balance: openingBalance, daily_inflow: dailyInflow, daily_outflow: dailyOutflow } });
  } catch (err) {
    console.error('cash-forecast error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/finance/breakeven
 */
router.get('/breakeven', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  try {
    const [sales, purchases, salaries] = await Promise.all([
      db.pgGet(`SELECT COALESCE(SUM(total_amount),0) AS total FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only' AND invoice_date >= DATE_TRUNC('month', CURRENT_DATE)`, [companyId]),
      db.pgGet(`SELECT COALESCE(SUM(COALESCE(total_amount,grand_total,net_amount,0)),0) AS total FROM purchase_bills WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND bill_date >= DATE_TRUNC('month', CURRENT_DATE)`, [companyId]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(sp.amount),0) AS total FROM salary_payments sp JOIN salaries s ON s.id=sp.salary_id WHERE s.company_id=$1 AND sp.date >= DATE_TRUNC('month', CURRENT_DATE)`, [companyId]).catch(() => ({ total: 0 })),
    ]);
    const revenue = parseFloat(sales?.total || 0);
    const variableCosts = parseFloat(purchases?.total || 0);
    const fixedCosts = parseFloat(salaries?.total || 0);
    const contributionMargin = revenue > 0 ? (revenue - variableCosts) / revenue : 0;
    const breakevenRevenue = contributionMargin > 0 ? fixedCosts / contributionMargin : 0;
    res.json({
      data: [
        { label: 'Current Revenue', value: revenue },
        { label: 'Variable Costs', value: variableCosts },
        { label: 'Fixed Costs', value: fixedCosts },
        { label: 'Breakeven Revenue', value: breakevenRevenue },
      ],
      summary: {
        breakeven_revenue: breakevenRevenue,
        contribution_margin_pct: (contributionMargin * 100).toFixed(1),
        above_breakeven: revenue > breakevenRevenue,
        gap: revenue - breakevenRevenue,
      },
    });
  } catch (err) {
    console.error('breakeven error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

export default router;
