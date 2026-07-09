// backend/routes/reports/expense.js
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

// Sources that represent internal movement, not a real expense
const NON_EXPENSE_SOURCES = ['OPENING_BALANCE', 'CASH_TRANSFER'];

const CATEGORY_LABELS = {
  PURCHASE_PAYMENT: 'Purchase Payments',
  SALARY_PAYMENT: 'Salary',
  WEEKLY_SALARY: 'Weekly Salary',
  DAILY_WAGE: 'Daily Wages',
  LOAN_REPAYMENT: 'Loan Repayment',
  ADVANCE_PAYMENT: 'Salary Advances',
  CHIT_PAYMENT: 'Chit Payments',
  CHIT: 'Chit Payments',
  RECEIPT: 'Receipts',
};

const CATEGORY_COLORS = {
  PURCHASE_PAYMENT: '#0891b2',
  SALARY_PAYMENT: '#4f46e5',
  WEEKLY_SALARY: '#4f46e5',
  DAILY_WAGE: '#7c3aed',
  LOAN_REPAYMENT: '#dc2626',
  ADVANCE_PAYMENT: '#9333ea',
  CHIT_PAYMENT: '#16a34a',
  CHIT: '#16a34a',
  RECEIPT: '#64748b',
};

const labelFor = (source) => {
  const key = (source || '').toUpperCase();
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  return (source || 'Other')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
};

const colorFor = (source) => CATEGORY_COLORS[(source || '').toUpperCase()] || '#64748b';

// Idempotent — daily_salary_payments is only created lazily by the Daily Wage
// screen (backend/routes/hrRoutes.js), so a fresh environment that has never
// processed a daily wage payment won't have this table yet.
const ensureDailySalaryTable = async () => {
  await db.pgRun(`
    CREATE TABLE IF NOT EXISTS daily_salary_payments (
      id           SERIAL PRIMARY KEY,
      company_id   INTEGER NOT NULL,
      employee_id  INTEGER REFERENCES employees(id),
      payment_date DATE NOT NULL,
      gross_wage   NUMERIC(12,2) DEFAULT 0,
      deduction    NUMERIC(12,2) DEFAULT 0,
      daily_wage   NUMERIC(12,2) DEFAULT 0,
      payment_mode VARCHAR(20) DEFAULT 'cash',
      status       VARCHAR(20) DEFAULT 'paid',
      created_at   TIMESTAMP DEFAULT NOW(),
      UNIQUE(employee_id, payment_date)
    )
  `).catch(() => {});
};

/**
 * GET /api/reports/expense/summary
 * KPIs + category breakdown + daily trend.
 * Powers the Overview, By Category, and Day by Day tabs.
 */
router.get('/summary', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { branch_id } = req.query;
  const { from, to } = getDateRange(req.query.from, req.query.to);
  const branchId = branch_id ? parseInt(branch_id) : null;

  try {
    const excludeSql = `UPPER(source) NOT IN ('${NON_EXPENSE_SOURCES.join("','")}')`;
    const branchClause = branchId ? 'AND branch_id = $4' : '';
    const unionParams = branchId ? [companyId, from, to, branchId] : [companyId, from, to];

    const ledgerOutSql = (table, dateClause = 'date BETWEEN $2 AND $3') => `
      SELECT source, amount, date
      FROM ${table}
      WHERE company_id = $1 AND direction = 'out' AND COALESCE(is_deleted, false) = false
        AND ${excludeSql}
        AND ${dateClause}
        ${branchClause}
    `;
    const prevDateClause = "date BETWEEN ($2::date - ($3::date - $2::date) - interval '1 day') AND ($2::date - interval '1 day')";

    const [totalRes, categoryRes, dailyRes, prevRes, cashRes, bankRes] = await Promise.all([
      db.pgGet(`
        SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt FROM (
          ${ledgerOutSql('cash_ledger')} UNION ALL ${ledgerOutSql('bank_ledger')}
        ) t
      `, unionParams),

      db.pgAll(`
        SELECT source, COUNT(*) AS transaction_count, COALESCE(SUM(amount),0) AS total_amount,
               COALESCE(AVG(amount),0) AS avg_amount, MIN(amount) AS min_amount, MAX(amount) AS max_amount
        FROM (${ledgerOutSql('cash_ledger')} UNION ALL ${ledgerOutSql('bank_ledger')}) t
        GROUP BY source
        ORDER BY total_amount DESC
      `, unionParams),

      db.pgAll(`
        SELECT date, source, COALESCE(SUM(amount),0) AS amount
        FROM (${ledgerOutSql('cash_ledger')} UNION ALL ${ledgerOutSql('bank_ledger')}) t
        GROUP BY date, source
        ORDER BY date ASC
      `, unionParams),

      db.pgGet(`
        SELECT COALESCE(SUM(amount), 0) AS total FROM (
          ${ledgerOutSql('cash_ledger', prevDateClause)} UNION ALL ${ledgerOutSql('bank_ledger', prevDateClause)}
        ) t
      `, unionParams),

      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM cash_ledger
                 WHERE company_id = $1 AND direction='out' AND COALESCE(is_deleted,false)=false
                   AND ${excludeSql} AND date BETWEEN $2 AND $3 ${branchClause}`, unionParams),
      db.pgGet(`SELECT COALESCE(SUM(amount),0) AS total FROM bank_ledger
                 WHERE company_id = $1 AND direction='out' AND COALESCE(is_deleted,false)=false
                   AND ${excludeSql} AND date BETWEEN $2 AND $3 ${branchClause}`, unionParams),
    ]);

    const totalOut = parseFloat(totalRes?.total || 0);
    const prevTotal = parseFloat(prevRes?.total || 0);
    const changePercent = prevTotal > 0 ? Number((((totalOut - prevTotal) / prevTotal) * 100).toFixed(1)) : 0;

    const categoryData = categoryRes.map(row => ({
      category: row.source,
      label: labelFor(row.source),
      color: colorFor(row.source),
      total_amount: parseFloat(row.total_amount) || 0,
      transaction_count: parseInt(row.transaction_count) || 0,
      avg_amount: parseFloat(row.avg_amount) || 0,
      min_amount: parseFloat(row.min_amount) || 0,
      max_amount: parseFloat(row.max_amount) || 0,
      percentage: totalOut > 0 ? Number(((parseFloat(row.total_amount) / totalOut) * 100).toFixed(1)) : 0,
    }));

    const dailyMap = {};
    dailyRes.forEach(row => {
      const d = row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date;
      if (!dailyMap[d]) dailyMap[d] = { date: d, total: 0, categories: {} };
      dailyMap[d].categories[row.source] = parseFloat(row.amount) || 0;
      dailyMap[d].total += parseFloat(row.amount) || 0;
    });

    res.json({
      period: { from, to },
      summary: {
        total_expenses: totalOut,
        prev_period_total: prevTotal,
        change_percent: changePercent,
        change_direction: totalOut >= prevTotal ? 'up' : 'down',
        cash_outflow: parseFloat(cashRes?.total || 0),
        bank_outflow: parseFloat(bankRes?.total || 0),
        transaction_count: parseInt(totalRes?.cnt || 0),
      },
      category_breakdown: categoryData,
      daily_trend: Object.values(dailyMap).sort((a, b) => (a.date > b.date ? 1 : -1)),
    });
  } catch (err) {
    console.error('[reports/expense/summary]', err.message);
    res.json({ summary: {}, category_breakdown: [], daily_trend: [], error: err.message });
  }
});

/**
 * GET /api/reports/expense/transactions
 * Flat list of every outbound cash/bank ledger entry — the "All Transactions" tab + CSV export.
 */
router.get('/transactions', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { branch_id } = req.query;
  const { from, to } = getDateRange(req.query.from, req.query.to);
  const branchId = branch_id ? parseInt(branch_id) : null;

  try {
    const excludeSql = `UPPER(source) NOT IN ('${NON_EXPENSE_SOURCES.join("','")}')`;
    const params = branchId ? [companyId, from, to, branchId] : [companyId, from, to];
    const branchClause = branchId ? 'AND branch_id = $4' : '';

    const rows = await db.pgAll(`
      SELECT id, source, amount, date, 'cash' AS mode
      FROM cash_ledger
      WHERE company_id = $1 AND direction = 'out' AND COALESCE(is_deleted,false)=false
        AND ${excludeSql} AND date BETWEEN $2 AND $3 ${branchClause}
      UNION ALL
      SELECT id, source, amount, date, 'bank' AS mode
      FROM bank_ledger
      WHERE company_id = $1 AND direction = 'out' AND COALESCE(is_deleted,false)=false
        AND ${excludeSql} AND date BETWEEN $2 AND $3 ${branchClause}
      ORDER BY date DESC, amount DESC
      LIMIT 1000
    `, params);

    res.json({
      data: rows.map(r => ({
        id: r.id,
        date: r.date,
        category: r.source,
        label: labelFor(r.source),
        amount: parseFloat(r.amount) || 0,
        mode: r.mode,
      })),
    });
  } catch (err) {
    console.error('[reports/expense/transactions]', err.message);
    res.json({ data: [], error: err.message });
  }
});

/**
 * GET /api/reports/expense/salary
 * Per-employee salary/wages/advances paid out — unions the three separate
 * payroll mechanisms (monthly salary_payments, weekly_salary, daily_salary_payments)
 * plus salary_advances.
 */
router.get('/salary', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { branch_id } = req.query;
  const { from, to } = getDateRange(req.query.from, req.query.to);
  const branchId = branch_id ? parseInt(branch_id) : null;

  try {
    await ensureDailySalaryTable();

    const branchClause = branchId ? 'AND e.branch_id = $4' : '';
    const params = branchId ? [companyId, from, to, branchId] : [companyId, from, to];

    const rows = await db.pgAll(`
      SELECT
        e.id AS employee_id,
        e.name AS employee_name,
        e.designation AS employee_role,
        COALESCE(sp.monthly_paid, 0) AS monthly_salary_paid,
        COALESCE(sp.monthly_count, 0) AS monthly_count,
        COALESCE(ws.weekly_paid, 0) AS weekly_salary_paid,
        COALESCE(ws.weekly_count, 0) AS weekly_count,
        COALESCE(dw.daily_paid, 0) AS daily_wage_paid,
        COALESCE(dw.daily_count, 0) AS daily_count,
        COALESCE(adv.advances_given, 0) AS advances_given
      FROM employees e
      LEFT JOIN (
        SELECT employee_id, SUM(amount) AS monthly_paid, COUNT(*) AS monthly_count
        FROM salary_payments
        WHERE date BETWEEN $2 AND $3
        GROUP BY employee_id
      ) sp ON sp.employee_id = e.id
      LEFT JOIN (
        SELECT employee_id, SUM(net_salary) AS weekly_paid, COUNT(*) AS weekly_count
        FROM weekly_salary
        WHERE status = 'paid' AND DATE(paid_at) BETWEEN $2 AND $3
        GROUP BY employee_id
      ) ws ON ws.employee_id = e.id
      LEFT JOIN (
        SELECT employee_id, SUM(daily_wage) AS daily_paid, COUNT(*) AS daily_count
        FROM daily_salary_payments
        WHERE payment_date BETWEEN $2 AND $3
        GROUP BY employee_id
      ) dw ON dw.employee_id = e.id
      LEFT JOIN (
        SELECT employee_id, SUM(amount) AS advances_given
        FROM salary_advances
        WHERE advance_date BETWEEN $2 AND $3
        GROUP BY employee_id
      ) adv ON adv.employee_id = e.id
      WHERE e.company_id = $1 AND COALESCE(e.is_deleted, false) = false
        ${branchClause}
    `, params);

    const data = rows
      .map(r => {
        const salary_paid = parseFloat(r.monthly_salary_paid || 0) + parseFloat(r.weekly_salary_paid || 0);
        const wages_paid = parseFloat(r.daily_wage_paid || 0);
        const advances_given = parseFloat(r.advances_given || 0);
        return {
          employee_name: r.employee_name,
          employee_role: r.employee_role || 'Staff',
          salary_paid,
          wages_paid,
          advances_given,
          total_outflow: salary_paid + wages_paid + advances_given,
          payments_count: (parseInt(r.monthly_count) || 0) + (parseInt(r.weekly_count) || 0) + (parseInt(r.daily_count) || 0),
        };
      })
      .filter(r => r.total_outflow > 0)
      .sort((a, b) => b.total_outflow - a.total_outflow);

    const summary = data.reduce((acc, r) => ({
      total_salary: acc.total_salary + r.salary_paid,
      total_wages: acc.total_wages + r.wages_paid,
      total_advances: acc.total_advances + r.advances_given,
      total_outflow: acc.total_outflow + r.total_outflow,
    }), { total_salary: 0, total_wages: 0, total_advances: 0, total_outflow: 0 });

    res.json({ data, summary });
  } catch (err) {
    console.error('[reports/expense/salary]', err.message);
    res.json({ data: [], summary: {}, error: err.message });
  }
});

/**
 * GET /api/reports/expense/purchases
 * Purchase bills raised (and paid/pending) in the period.
 */
router.get('/purchases', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { branch_id } = req.query;
  const { from, to } = getDateRange(req.query.from, req.query.to);
  const branchId = branch_id ? parseInt(branch_id) : null;

  try {
    const branchClause = branchId ? 'AND pb.branch_id = $4' : '';
    const params = branchId ? [companyId, from, to, branchId] : [companyId, from, to];

    const rows = await db.pgAll(`
      SELECT pb.bill_number, COALESCE(s.name, pb.supplier_name, 'Unknown') AS supplier_name,
             pb.bill_date AS date, pb.total_amount, pb.paid_amount, pb.balance_amount, pb.status
      FROM purchase_bills pb
      LEFT JOIN suppliers s ON s.id = pb.supplier_id
      WHERE pb.company_id = $1 AND COALESCE(pb.is_deleted, false) = false
        AND pb.bill_date BETWEEN $2 AND $3 ${branchClause}
      ORDER BY pb.total_amount DESC
    `, params);

    const data = rows.map(r => ({
      bill_number: r.bill_number,
      supplier_name: r.supplier_name,
      date: r.date,
      bill_amount: parseFloat(r.total_amount) || 0,
      paid_amount: parseFloat(r.paid_amount) || 0,
      balance_amount: parseFloat(r.balance_amount) || 0,
      status: r.status,
    }));

    const summary = data.reduce((acc, r) => ({
      total_billed: acc.total_billed + r.bill_amount,
      total_paid: acc.total_paid + r.paid_amount,
      total_balance: acc.total_balance + r.balance_amount,
    }), { total_billed: 0, total_paid: 0, total_balance: 0 });

    res.json({ data, summary });
  } catch (err) {
    console.error('[reports/expense/purchases]', err.message);
    res.json({ data: [], summary: {}, error: err.message });
  }
});

/**
 * GET /api/reports/expense/loans
 * Per-lender loan repayments (principal + interest) in the period.
 */
router.get('/loans', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { branch_id } = req.query;
  const { from, to } = getDateRange(req.query.from, req.query.to);
  const branchId = branch_id ? parseInt(branch_id) : null;

  try {
    const branchClause = branchId ? 'AND l.branch_id = $4' : '';
    const params = branchId ? [companyId, from, to, branchId] : [companyId, from, to];

    const rows = await db.pgAll(`
      SELECT COALESCE(ln.lender_name, l.party_name, 'Unknown') AS lender_name,
             COUNT(lp.id) AS payments_count,
             COALESCE(SUM(lp.total_amount), 0) AS total_repaid,
             COALESCE(SUM(lp.principal_component), 0) AS principal_repaid,
             COALESCE(SUM(lp.interest_component), 0) AS interest_repaid
      FROM loan_payments lp
      JOIN loans l ON l.id = lp.loan_id AND COALESCE(l.is_deleted, false) = false
      LEFT JOIN lenders ln ON ln.id = l.lender_id
      WHERE lp.company_id = $1 AND DATE(lp.payment_date) BETWEEN $2 AND $3 ${branchClause}
      GROUP BY COALESCE(ln.lender_name, l.party_name, 'Unknown')
      ORDER BY total_repaid DESC
    `, params);

    const data = rows.map(r => ({
      lender_name: r.lender_name,
      payments_count: parseInt(r.payments_count) || 0,
      total_repaid: parseFloat(r.total_repaid) || 0,
      principal_repaid: parseFloat(r.principal_repaid) || 0,
      interest_repaid: parseFloat(r.interest_repaid) || 0,
    }));

    const summary = data.reduce((acc, r) => ({
      total_repaid: acc.total_repaid + r.total_repaid,
      total_principal: acc.total_principal + r.principal_repaid,
      total_interest: acc.total_interest + r.interest_repaid,
    }), { total_repaid: 0, total_principal: 0, total_interest: 0 });

    res.json({ data, summary });
  } catch (err) {
    console.error('[reports/expense/loans]', err.message);
    res.json({ data: [], summary: {}, error: err.message });
  }
});

export default router;
