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
 * GET /api/reports/finance/profit-loss
 * Enhanced P&L including proprietor personal account flows
 */
router.get('/profit-loss', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const [
      invoiceRev, personalReceipts,
      purchases, purchasesPersonal,
      salaryCash, salaryPersonal,
      capitalIntro, drawings,
    ] = await Promise.all([
      // Invoice revenue (billed amounts)
      db.pgGet(`SELECT COALESCE(SUM(total_amount),0) AS total FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only' AND invoice_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]),
      // Personal account receipts (customer paid to proprietor personally)
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='PERSONAL_RECEIPT' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      // Total purchases (all modes — already captured in purchase_bills)
      db.pgGet(`SELECT COALESCE(SUM(COALESCE(total_amount,grand_total,net_amount,0)),0) AS total FROM purchase_bills WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND bill_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      // Purchases specifically paid via proprietor personal account
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='CAPITAL_INTRO' AND reference_type='PURCHASE_BILL' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      // Salary from cash/bank ledger
      db.pgGet(`SELECT COALESCE(SUM(cl.amount),0)+COALESCE(SUM(bl.amount),0) AS total FROM (SELECT amount FROM cash_ledger WHERE company_id=$1 AND source IN ('SALARY_PAYMENT','daily_wage','weekly_salary','ADVANCE_PAYMENT') AND direction='out' AND date BETWEEN $2::date AND $3::date) cl, (SELECT amount FROM bank_ledger WHERE company_id=$1 AND source IN ('SALARY_PAYMENT','daily_wage','weekly_salary','ADVANCE_PAYMENT') AND direction='out' AND date BETWEEN $2::date AND $3::date) bl`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      // Salary paid via proprietor personal account
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='CAPITAL_INTRO' AND reference_type IN ('SALARY','SALARY_ADVANCE','DAILY_WAGE','WEEKLY_SALARY') AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      // All capital introduced this period
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='CAPITAL_INTRO' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      // Drawings taken this period
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='DRAWINGS' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
    ]);

    const invoiceRevenue    = parseFloat(invoiceRev?.total || 0);
    const personalReceiptRev= parseFloat(personalReceipts?.total || 0);
    const totalRevenue      = invoiceRevenue + personalReceiptRev;

    const totalPurchases    = parseFloat(purchases?.total || 0);
    const purchasesViaPersonal = parseFloat(purchasesPersonal?.total || 0);
    const purchasesViaCashBank = totalPurchases - purchasesViaPersonal;
    const grossProfit       = totalRevenue - totalPurchases;

    const salaryCashBank    = parseFloat(salaryCash?.total || 0);
    const salaryViaPersonal = parseFloat(salaryPersonal?.total || 0);
    const totalSalary       = salaryCashBank + salaryViaPersonal;

    const capitalIntroTotal = parseFloat(capitalIntro?.total || 0);
    const drawingsTotal     = parseFloat(drawings?.total || 0);

    const totalExpenses     = totalSalary;
    const netProfit         = grossProfit - totalExpenses;

    res.json({
      data: {
        income: { invoice_revenue: invoiceRevenue, personal_receipts: personalReceiptRev, total_revenue: totalRevenue },
        cogs:   { purchases_cash_bank: purchasesViaCashBank, purchases_personal: purchasesViaPersonal, total_purchases: totalPurchases },
        expenses: { salary_cash_bank: salaryCashBank, salary_personal: salaryViaPersonal, total_salary: totalSalary, total_expenses: totalExpenses },
        profit: { gross_profit: grossProfit, net_profit: netProfit },
        proprietor_equity: { capital_introduced: capitalIntroTotal, drawings_taken: drawingsTotal, net_equity_change: capitalIntroTotal - drawingsTotal },
      },
      summary: { total_revenue: totalRevenue, gross_profit: grossProfit, net_profit: netProfit, from: startDate, to: endDate },
    });
  } catch (err) {
    console.error('profit-loss error:', err.message);
    res.json({ data: {}, summary: {} });
  }
});

/**
 * GET /api/reports/finance/cash-flow
 * Cash flow statement including proprietor flows
 */
router.get('/cash-flow', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const [
      cashInflows, bankInflows, personalInflows,
      cashOutflows, bankOutflows, personalOutflows,
      capitalIntro, drawings,
      loansIn, loanRepay,
      openingCash,
    ] = await Promise.all([
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM cash_ledger WHERE company_id=$1 AND direction='in' AND date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM bank_ledger WHERE company_id=$1 AND direction='in' AND date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='PERSONAL_RECEIPT' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM cash_ledger WHERE company_id=$1 AND direction='out' AND date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM bank_ledger WHERE company_id=$1 AND direction='out' AND date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='CAPITAL_INTRO' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='CAPITAL_INTRO' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='DRAWINGS' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(principal_amount),0) AS total FROM loans WHERE company_id=$1 AND UPPER(COALESCE(loan_direction,'TAKEN'))='TAKEN' AND created_at::date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(lp.total_amount),0) AS total FROM loan_payments lp JOIN loans l ON l.id=lp.loan_id WHERE l.company_id=$1 AND lp.payment_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0) AS bal FROM cash_ledger WHERE company_id=$1 AND date < $2::date`, [companyId, startDate]),
    ]);

    const opInflow  = parseFloat(cashInflows?.total||0) + parseFloat(bankInflows?.total||0);
    const propInflow = parseFloat(personalInflows?.total||0);
    const opOutflow = parseFloat(cashOutflows?.total||0) + parseFloat(bankOutflows?.total||0);
    const propOutflow = parseFloat(personalOutflows?.total||0);
    const capIntro  = parseFloat(capitalIntro?.total||0);
    const drawOut   = parseFloat(drawings?.total||0);
    const loanIn    = parseFloat(loansIn?.total||0);
    const loanOut   = parseFloat(loanRepay?.total||0);
    const opening   = parseFloat(openingCash?.bal||0);

    const totalInflow  = opInflow + propInflow + capIntro + loanIn;
    const totalOutflow = opOutflow + propOutflow + drawOut + loanOut;
    const netCashFlow  = totalInflow - totalOutflow;
    const closingCash  = opening + netCashFlow;

    res.json({
      data: [
        { category: 'Operating Inflows (Cash+Bank)', type: 'inflow', amount: opInflow },
        { category: 'Personal Account Receipts', type: 'inflow', amount: propInflow },
        { category: 'Capital Introduced', type: 'financing', amount: capIntro },
        { category: 'Loans Received', type: 'financing', amount: loanIn },
        { category: 'Operating Outflows (Cash+Bank)', type: 'outflow', amount: opOutflow },
        { category: 'Proprietor Business Payments', type: 'outflow', amount: propOutflow },
        { category: 'Drawings', type: 'outflow', amount: drawOut },
        { category: 'Loan Repayments', type: 'outflow', amount: loanOut },
      ],
      summary: { total_inflow: totalInflow, total_outflow: totalOutflow, net_cash_flow: netCashFlow, opening_cash: opening, closing_cash: closingCash, from: startDate, to: endDate },
    });
  } catch (err) {
    console.error('cash-flow error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/finance/proprietor-capital
 * Proprietor capital account in T-account format
 */
router.get('/proprietor-capital', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const [periodData, openingCapital] = await Promise.all([
      db.pgGet(`
        SELECT
          COALESCE(SUM(CASE WHEN transaction_type='CAPITAL_INTRO' THEN amount ELSE 0 END),0) AS capital_intro,
          COALESCE(SUM(CASE WHEN transaction_type='DRAWINGS' THEN amount ELSE 0 END),0) AS drawings,
          COALESCE(SUM(CASE WHEN transaction_type='PERSONAL_RECEIPT' THEN amount ELSE 0 END),0) AS personal_receipts,
          COALESCE(SUM(CASE WHEN transaction_type='PERSONAL_PAYMENT' THEN amount ELSE 0 END),0) AS personal_payments
        FROM proprietor_transactions WHERE company_id=$1 AND transaction_date BETWEEN $2::date AND $3::date
      `, [companyId, startDate, endDate]).catch(() => ({ capital_intro: 0, drawings: 0, personal_receipts: 0, personal_payments: 0 })),
      db.pgGet(`
        SELECT
          COALESCE(SUM(CASE WHEN transaction_type='CAPITAL_INTRO' THEN amount ELSE 0 END),0) -
          COALESCE(SUM(CASE WHEN transaction_type='DRAWINGS' THEN amount ELSE 0 END),0) AS balance
        FROM proprietor_transactions WHERE company_id=$1 AND transaction_date < $2::date
      `, [companyId, startDate]).catch(() => ({ balance: 0 })),
    ]);

    const opening = parseFloat(openingCapital?.balance||0);
    const capIntro= parseFloat(periodData?.capital_intro||0);
    const drawout = parseFloat(periodData?.drawings||0);
    const perRec  = parseFloat(periodData?.personal_receipts||0);
    const closing = opening + capIntro + perRec - drawout;

    res.json({
      data: {
        debit: [
          { label: 'Drawings Taken', amount: drawout },
          { label: 'Closing Balance', amount: closing },
        ],
        credit: [
          { label: 'Opening Balance', amount: opening },
          { label: 'Capital Introduced', amount: capIntro },
          { label: 'Personal Receipts', amount: perRec },
        ],
      },
      summary: { opening_balance: opening, capital_intro: capIntro, drawings: drawout, personal_receipts: perRec, closing_balance: closing, from: startDate, to: endDate },
    });
  } catch (err) {
    console.error('proprietor-capital error:', err.message);
    res.json({ data: { debit: [], credit: [] }, summary: {} });
  }
});

/**
 * GET /api/reports/finance/balance-sheet
 * Full balance sheet as of a date
 */
router.get('/balance-sheet', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { as_of_date } = req.query;
  const asOf = as_of_date || new Date().toISOString().split('T')[0];
  try {
    const [
      cashBal, bankBal, receivables, inventory,
      payables, loans, chits,
      proprietorCapital, retainedEarnings,
    ] = await Promise.all([
      db.pgGet(`SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0) AS bal FROM cash_ledger WHERE company_id=$1 AND date <= $2::date`, [companyId, asOf]),
      db.pgGet(`SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0) AS bal FROM bank_ledger WHERE company_id=$1 AND date <= $2::date`, [companyId, asOf]),
      db.pgGet(`SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount,0)),0) AS total FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only' AND invoice_date <= $2::date`, [companyId, asOf]),
      db.pgGet(`SELECT COALESCE(SUM(current_stock * COALESCE(cost_price,selling_price,0)),0) AS total FROM products WHERE company_id=$1 AND COALESCE(is_deleted,false)=false`, [companyId]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(COALESCE(total_amount,grand_total,net_amount,0)),0) AS total FROM purchase_bills WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND bill_date <= $2::date`, [companyId, asOf]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(remaining_principal),0) AS total FROM loans WHERE company_id=$1 AND status='ACTIVE'`, [companyId]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(remaining_balance),0) AS total FROM chit_funds WHERE company_id=$1 AND status='ACTIVE'`, [companyId]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(CASE WHEN transaction_type='CAPITAL_INTRO' THEN amount ELSE 0 END),0) - COALESCE(SUM(CASE WHEN transaction_type='DRAWINGS' THEN amount ELSE 0 END),0) AS net FROM proprietor_transactions WHERE company_id=$1 AND transaction_date <= $2::date`, [companyId, asOf]).catch(() => ({ net: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(total_amount),0) - COALESCE(SUM(COALESCE(total_amount,grand_total,net_amount,0)),0) AS net FROM invoices i, purchase_bills pb WHERE i.company_id=$1 AND pb.company_id=$1 AND COALESCE(i.is_deleted,false)=false`, [companyId]).catch(() => ({ net: 0 })),
    ]);

    const cash      = parseFloat(cashBal?.bal||0);
    const bank      = parseFloat(bankBal?.bal||0);
    const rec       = parseFloat(receivables?.total||0);
    const inv       = parseFloat(inventory?.total||0);
    const totalAssets = cash + bank + rec + inv;

    const pay       = parseFloat(payables?.total||0);
    const loan      = parseFloat(loans?.total||0);
    const chit      = parseFloat(chits?.total||0);
    const totalLiabilities = pay + loan + chit;

    const propCap   = parseFloat(proprietorCapital?.net||0);
    const retained  = totalAssets - totalLiabilities - propCap;
    const totalEquity = propCap + retained;

    const difference = totalAssets - (totalLiabilities + totalEquity);

    res.json({
      data: {
        assets: { cash_in_hand: cash, bank_balance: bank, accounts_receivable: rec, inventory_value: inv, total_assets: totalAssets },
        liabilities: { accounts_payable: pay, loan_payable: loan, chit_liability: chit, total_liabilities: totalLiabilities },
        equity: { proprietor_capital: propCap, retained_earnings: retained, total_equity: totalEquity },
        check: { difference, balanced: Math.abs(difference) < 1 },
      },
      summary: { total_assets: totalAssets, total_liabilities: totalLiabilities, total_equity: totalEquity, as_of_date: asOf },
    });
  } catch (err) {
    console.error('balance-sheet error:', err.message);
    res.json({ data: {}, summary: {} });
  }
});

/**
 * GET /api/reports/finance/income-expense-trend
 * Monthly income vs expense breakdown including proprietor
 */
router.get('/income-expense-trend', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { year } = req.query;
  const targetYear = parseInt(year) || new Date().getFullYear();
  try {
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const pad = String(m).padStart(2, '0');
      return { month: m, label: new Date(targetYear, i, 1).toLocaleString('en-IN', { month: 'short' }), start: `${targetYear}-${pad}-01`, end: new Date(targetYear, m, 0).toISOString().split('T')[0] };
    });

    const rows = await Promise.all(months.map(async ({ month, label, start, end }) => {
      const [inv, prop_rec, cash_out, bank_out, prop_cap, prop_draw] = await Promise.all([
        db.pgGet(`SELECT COALESCE(SUM(total_amount),0) AS v FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only' AND invoice_date BETWEEN $2::date AND $3::date`, [companyId, start, end]),
        db.pgGet(`SELECT COALESCE(SUM(amount),0) AS v FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='PERSONAL_RECEIPT' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, start, end]).catch(() => ({ v: 0 })),
        db.pgGet(`SELECT COALESCE(SUM(amount),0) AS v FROM cash_ledger WHERE company_id=$1 AND direction='out' AND date BETWEEN $2::date AND $3::date`, [companyId, start, end]),
        db.pgGet(`SELECT COALESCE(SUM(amount),0) AS v FROM bank_ledger WHERE company_id=$1 AND direction='out' AND date BETWEEN $2::date AND $3::date`, [companyId, start, end]),
        db.pgGet(`SELECT COALESCE(SUM(amount),0) AS v FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='CAPITAL_INTRO' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, start, end]).catch(() => ({ v: 0 })),
        db.pgGet(`SELECT COALESCE(SUM(amount),0) AS v FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='DRAWINGS' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, start, end]).catch(() => ({ v: 0 })),
      ]);
      return {
        month: label,
        total_income:   parseFloat(inv?.v||0) + parseFloat(prop_rec?.v||0),
        total_expense:  parseFloat(cash_out?.v||0) + parseFloat(bank_out?.v||0) + parseFloat(prop_cap?.v||0),
        capital_intro:  parseFloat(prop_cap?.v||0),
        drawings:       parseFloat(prop_draw?.v||0),
      };
    }));

    res.json({ data: rows, summary: { year: targetYear } });
  } catch (err) {
    console.error('income-expense-trend error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/finance/true-performance
 * Complete money flow — all sources including proprietor
 */
router.get('/true-performance', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const [
      invoiceRev, propReceipts, capIntro, loanIn,
      purchaseCash, purchaseBank, purchaseProp,
      salaryCashBk, salaryProp,
      chitCash, chitBank, chitProp,
      loanRepay, drawings,
      cashBal, bankBal, receivables,
    ] = await Promise.all([
      db.pgGet(`SELECT COALESCE(SUM(total_amount),0) AS v FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only' AND invoice_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS v FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='PERSONAL_RECEIPT' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ v: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS v FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='CAPITAL_INTRO' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ v: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(principal_amount),0) AS v FROM loans WHERE company_id=$1 AND UPPER(COALESCE(loan_direction,'TAKEN'))='TAKEN' AND created_at::date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ v: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS v FROM cash_ledger WHERE company_id=$1 AND source='PURCHASE_PAYMENT' AND direction='out' AND date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS v FROM bank_ledger WHERE company_id=$1 AND source='PURCHASE_PAYMENT' AND direction='out' AND date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS v FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='CAPITAL_INTRO' AND reference_type='PURCHASE_BILL' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ v: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS v FROM cash_ledger WHERE company_id=$1 AND source IN ('SALARY_PAYMENT','daily_wage','weekly_salary','ADVANCE_PAYMENT') AND direction='out' AND date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS v FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='CAPITAL_INTRO' AND reference_type IN ('SALARY','SALARY_ADVANCE','DAILY_WAGE','WEEKLY_SALARY') AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ v: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS v FROM cash_ledger WHERE company_id=$1 AND source IN ('CHIT_PAYMENT','chit') AND direction='out' AND date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS v FROM bank_ledger WHERE company_id=$1 AND source IN ('CHIT_PAYMENT','chit') AND direction='out' AND date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS v FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='CAPITAL_INTRO' AND LOWER(notes) LIKE '%chit%' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ v: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(lp.total_amount),0) AS v FROM loan_payments lp JOIN loans l ON l.id=lp.loan_id WHERE l.company_id=$1 AND lp.payment_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ v: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS v FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='DRAWINGS' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ v: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0) AS v FROM cash_ledger WHERE company_id=$1`, [companyId]),
      db.pgGet(`SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0) AS v FROM bank_ledger WHERE company_id=$1`, [companyId]),
      db.pgGet(`SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount,0)),0) AS v FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND COALESCE(bill_purpose,'')!='name_only'`, [companyId]),
    ]);

    const p = (x) => parseFloat(x?.v || 0);
    const totalInflow = p(invoiceRev) + p(propReceipts) + p(capIntro) + p(loanIn);
    const totalOutflow = p(purchaseCash) + p(purchaseBank) + p(purchaseProp) + p(salaryCashBk) + p(salaryProp) + p(chitCash) + p(chitBank) + p(chitProp) + p(loanRepay) + p(drawings);
    const netPosition = totalInflow - totalOutflow;
    const cashBankBal = p(cashBal) + p(bankBal);
    const totalValue  = cashBankBal + p(receivables);

    res.json({
      data: {
        inflows: [
          { label: 'Invoices Collected (Cash/Bank)', amount: p(invoiceRev) },
          { label: 'Customer Receipts (Personal Acct)', amount: p(propReceipts) },
          { label: 'Capital Introduced by Proprietor', amount: p(capIntro) },
          { label: 'Loans Received', amount: p(loanIn) },
        ],
        outflows: [
          { label: 'Purchases Paid (Cash/Bank)', amount: p(purchaseCash) + p(purchaseBank) },
          { label: 'Purchases Paid (Personal)', amount: p(purchaseProp) },
          { label: 'Salaries Paid (Cash/Bank)', amount: p(salaryCashBk) },
          { label: 'Salaries Paid (Personal)', amount: p(salaryProp) },
          { label: 'Chits Paid (Cash/Bank)', amount: p(chitCash) + p(chitBank) },
          { label: 'Chits Paid (Personal)', amount: p(chitProp) },
          { label: 'Loan Repayments', amount: p(loanRepay) },
          { label: 'Drawings by Proprietor', amount: p(drawings) },
        ],
      },
      summary: { total_inflow: totalInflow, total_outflow: totalOutflow, net_position: netPosition, cash_bank_balance: cashBankBal, outstanding_receivables: p(receivables), total_business_value: totalValue, from: startDate, to: endDate },
    });
  } catch (err) {
    console.error('true-performance error:', err.message);
    res.json({ data: { inflows: [], outflows: [] }, summary: {} });
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
      db.pgGet(`SELECT COALESCE(SUM(sp.amount),0) AS total FROM salary_payments sp JOIN salaries s ON s.id=sp.salary_id WHERE s.company_id=$1 AND COALESCE(sp.date, sp.created_at::date) BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(principal_amount),0) AS total FROM loans WHERE company_id=$1 AND UPPER(COALESCE(loan_direction,'TAKEN'))='TAKEN' AND created_at::date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(lp.total_amount),0) AS total FROM loan_payments lp JOIN loans l ON l.id=lp.loan_id WHERE l.company_id=$1 AND lp.payment_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
    ]);
    // Proprietor flows
    const [propCapital, propDrawings, propPersonalReceipts] = await Promise.all([
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='CAPITAL_INTRO' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='DRAWINGS' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM proprietor_transactions WHERE company_id=$1 AND transaction_type='PERSONAL_RECEIPT' AND transaction_date BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
    ]);
    const data = [
      { category: 'Sales Revenue', type: 'inflow', amount: parseFloat(salesInflow?.total || 0) },
      { category: 'Personal Account Receipts', type: 'inflow', amount: parseFloat(propPersonalReceipts?.total || 0) },
      { category: 'Capital Introduced', type: 'inflow', amount: parseFloat(propCapital?.total || 0) },
      { category: 'Loan Received', type: 'inflow', amount: parseFloat(loanInflow?.total || 0) },
      { category: 'Purchases', type: 'outflow', amount: parseFloat(purchaseOutflow?.total || 0) },
      { category: 'Salary', type: 'outflow', amount: parseFloat(salaryOutflow?.total || 0) },
      { category: 'Loan Repayment', type: 'outflow', amount: parseFloat(loanOutflow?.total || 0) },
      { category: 'Drawings', type: 'outflow', amount: parseFloat(propDrawings?.total || 0) },
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
      db.pgGet(`SELECT COALESCE(SUM(sp.amount),0) AS total FROM salary_payments sp JOIN salaries s ON s.id=sp.salary_id WHERE s.company_id=$1 AND COALESCE(sp.date, sp.created_at::date) BETWEEN $2::date AND $3::date`, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
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
