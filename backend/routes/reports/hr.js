// backend/routes/reports/hr.js
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
 * GET /api/reports/hr/productivity
 */
router.get('/productivity', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const sql = `
      SELECT
        e.name AS employee_name,
        e.designation,
        e.designation AS department,
        COUNT(CASE WHEN UPPER(a.status) IN ('PRESENT', 'OD') THEN 1 END) AS days_present,
        COUNT(a.id) AS total_days,
        CASE WHEN COUNT(a.id) > 0
          THEN ROUND(COUNT(CASE WHEN UPPER(a.status) IN ('PRESENT', 'OD') THEN 1 END)::numeric / COUNT(a.id) * 100, 1)
          ELSE 0 END AS attendance_pct
      FROM employees e
      LEFT JOIN attendance_logs a ON a.employee_id = e.id
        AND a.company_id = $1
        AND a.date BETWEEN $2::date AND $3::date
      WHERE e.company_id = $1
        AND COALESCE(e.status, 'Active') = 'Active'
      GROUP BY e.id, e.name, e.designation
      ORDER BY attendance_pct DESC
    `;
    const rawData = await db.pgAll(sql, [companyId, startDate, endDate]);
    const data = rawData.map(r => ({
      ...r,
      days_present: parseFloat(r.days_present || 0),
      total_days: parseFloat(r.total_days || 0),
      attendance_pct: parseFloat(r.attendance_pct || 0),
    }));
    const summary = {
      total_employees: data.length,
      avg_attendance: data.length > 0 ? (data.reduce((a, b) => a + (b.attendance_pct || 0), 0) / data.length).toFixed(1) : 0,
    };
    res.json({ data: data || [], summary });
  } catch (err) {
    console.error('hr/productivity error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/hr/attendance-trends
 */
router.get('/attendance-trends', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const sql = `
      SELECT
        TO_CHAR(DATE_TRUNC('week', a.date), 'DD Mon YYYY') AS period,
        DATE_TRUNC('week', a.date) AS period_sort,
        COUNT(CASE WHEN UPPER(a.status) IN ('PRESENT', 'OD') THEN 1 END) AS present_count,
        COUNT(CASE WHEN UPPER(a.status) = 'ABSENT' THEN 1 END) AS absent_count,
        COUNT(a.id) AS total_entries,
        CASE WHEN COUNT(a.id) > 0
          THEN ROUND(COUNT(CASE WHEN UPPER(a.status) IN ('PRESENT', 'OD') THEN 1 END)::numeric / COUNT(a.id) * 100, 1)
          ELSE 0 END AS attendance_rate
      FROM attendance_logs a
      WHERE a.company_id = $1
        AND a.date BETWEEN $2::date AND $3::date
      GROUP BY period_sort, period
      ORDER BY period_sort ASC
    `;
    const rawData = await db.pgAll(sql, [companyId, startDate, endDate]);
    const data = rawData.map(r => ({
      ...r,
      present_count: parseFloat(r.present_count || 0),
      absent_count: parseFloat(r.absent_count || 0),
      attendance_rate: parseFloat(r.attendance_rate || 0),
    }));
    res.json({ data: data || [], summary: {} });
  } catch (err) {
    console.error('attendance-trends error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/hr/salary-cost
 */
router.get('/salary-cost', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const [monthlySalary, dailyWages] = await Promise.all([
      db.pgAll(`
        SELECT
          e.name AS employee_name,
          e.designation AS department,
          COALESCE(SUM(sp.amount), 0) AS salary_paid,
          COUNT(sp.id) AS payment_count
        FROM employees e
        JOIN salaries s ON s.employee_id = e.id
        JOIN salary_payments sp ON sp.salary_id = s.id
        WHERE s.company_id = $1
          AND sp.date BETWEEN $2::date AND $3::date
        GROUP BY e.id, e.name, e.designation
        ORDER BY salary_paid DESC
      `, [companyId, startDate, endDate]).catch(() => []),
      db.pgGet(`
        SELECT COALESCE(SUM(gross_wage), 0) AS total
        FROM daily_salary_payments
        WHERE company_id = $1
          AND payment_date BETWEEN $2::date AND $3::date
      `, [companyId, startDate, endDate]).catch(() => ({ total: 0 })),
    ]);
    const data = (monthlySalary || []).map(r => ({
      ...r,
      salary_paid: parseFloat(r.salary_paid || 0),
      payment_count: parseFloat(r.payment_count || 0),
    }));
    const summary = {
      total_monthly_salary: data.reduce((a, b) => a + (b.salary_paid || 0), 0),
      total_daily_wages: parseFloat(dailyWages?.total || 0),
      total_cost: data.reduce((a, b) => a + (b.salary_paid || 0), 0) + parseFloat(dailyWages?.total || 0),
    };
    res.json({ data: data || [], summary });
  } catch (err) {
    console.error('salary-cost error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

/**
 * GET /api/reports/hr/advance-analysis
 */
router.get('/advance-analysis', authMiddleware, async (req, res) => {
  const companyId = req.user.active_company_id;
  const { from, to } = req.query;
  const { from: startDate, to: endDate } = getDateRange(from, to);
  try {
    const sql = `
      SELECT
        e.name AS employee_name,
        e.designation AS department,
        COALESCE(SUM(sa.amount), 0) AS total_advanced,
        COALESCE(SUM(CASE WHEN COALESCE(sa.status,'ACTIVE') = 'ACTIVE' THEN COALESCE(sa.current_balance, sa.amount, 0) ELSE 0 END), 0) AS outstanding,
        COUNT(sa.id) AS advance_count
      FROM employees e
      LEFT JOIN salary_advances sa ON sa.employee_id = e.id
        AND sa.company_id = $1
        AND sa.created_at::date BETWEEN $2::date AND $3::date
      WHERE e.company_id = $1
        AND COALESCE(e.status, 'Active') = 'Active'
      GROUP BY e.id, e.name, e.designation
      HAVING COALESCE(SUM(sa.amount), 0) > 0
      ORDER BY outstanding DESC
    `;
    const data = await db.pgAll(sql, [companyId, startDate, endDate]).catch(() => []);
    const summary = {
      total_employees: data.length,
      total_outstanding: data.reduce((a, b) => a + parseFloat(b.outstanding || 0), 0),
    };
    res.json({ data: data || [], summary });
  } catch (err) {
    console.error('advance-analysis error:', err.message);
    res.json({ data: [], summary: {} });
  }
});

export default router;
