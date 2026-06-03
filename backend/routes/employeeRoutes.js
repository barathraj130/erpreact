// backend/routes/employeeRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import { sendWelcomeWhatsApp } from '../utils/sendWelcomeWhatsApp.js';

const router = express.Router();

/**
 * 👥 LIST EMPLOYEES
 * Support tabs: ALL / MONTHLY / WEEKLY / DAILY
 */
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { tab = 'ALL', search } = req.query;

    try {
        let where = "WHERE e.company_id = $1";
        let params = [companyId];

        if (search) {
            where += " AND e.name ILIKE $2";
            params.push(`%${search}%`);
        }

        let sql = `
            SELECT
                e.*,
                COALESCE(a.today_status, 'Absent') as today_status,
                COALESCE(m.month_present, 0) as month_present_days,
                COALESCE(pd.paid_days, 0) as paid_days
            FROM employees e
            LEFT JOIN (
                SELECT employee_id, status as today_status
                FROM attendance
                WHERE date = CURRENT_DATE
            ) a ON e.id = a.employee_id
            LEFT JOIN (
                SELECT employee_id, COUNT(*) as month_present
                FROM attendance
                WHERE date >= DATE_TRUNC('month', CURRENT_DATE) AND status = 'Present'
                GROUP BY employee_id
            ) m ON e.id = m.employee_id
            LEFT JOIN (
                SELECT employee_id, COUNT(*) as paid_days
                FROM daily_salary_payments
                WHERE company_id = $1 AND status = 'paid'
                GROUP BY employee_id
            ) pd ON e.id = pd.employee_id
            ${where}
            ORDER BY e.name ASC
        `;

        const employees = await db.pgAll(sql, params);
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch employees" });
    }
});

/**
 * ➕ CREATE EMPLOYEE
 */
router.post('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const {
        name, designation, salary, phone, joining_date, department,
        salary_type = 'monthly',   // 'monthly' | 'weekly' | 'daily'
        daily_rate  = 0,
        weekly_rate = 0,
        working_days_per_week = 6,
    } = req.body;

    if (!name) return res.status(400).json({ error: "Employee name is required" });

    try {
        await ensureEmployeeColumns();
        const sql = `
            INSERT INTO employees
              (company_id, name, designation, salary, phone, joining_date,
               salary_type, daily_rate, weekly_rate, working_days_per_week)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            RETURNING *
        `;
        const emp = await db.pgGet(sql, [
            companyId, name, designation,
            salary_type === 'monthly' ? (Number(salary) || 0) : 0,
            phone, joining_date,
            salary_type, Number(daily_rate) || 0,
            Number(weekly_rate) || 0, Number(working_days_per_week) || 6,
        ]);

        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=EMP_${emp.id}`;

        // Welcome WhatsApp (non-blocking)
        sendWelcomeWhatsApp('employee', { ...emp, department }).catch(() => {});

        res.status(201).json({ ...emp, qr_code_url: qrUrl });
    } catch (err) {
        console.error('[employee create]', err.message);
        res.status(500).json({ error: "Failed to create employee: " + err.message });
    }
});

// Ensure extra columns exist (lazy migration — safe to run multiple times)
const ensureEmployeeColumns = async () => {
    await db.pgRun(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_type VARCHAR(20) DEFAULT 'monthly'`).catch(() => {});
    await db.pgRun(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(12,2) DEFAULT 0`).catch(() => {});
    await db.pgRun(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS weekly_rate NUMERIC(12,2) DEFAULT 0`).catch(() => {});
    await db.pgRun(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS working_days_per_week INTEGER DEFAULT 6`).catch(() => {});
};

/**
 * ✏️ UPDATE EMPLOYEE
 */
router.put('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.active_company_id;
    const {
        name, designation, salary, phone, joining_date,
        salary_type = 'monthly',
        daily_rate  = 0,
        weekly_rate = 0,
        working_days_per_week = 6,
        status = 'Active',
    } = req.body;

    try {
        await ensureEmployeeColumns();

        const sType      = (salary_type || 'monthly').toLowerCase();
        // Compute correct salary value per type in JS — avoids CASE ambiguity in PG
        const salaryVal  = sType === 'monthly'  ? (Number(salary)      || 0) : 0;
        const dailyVal   = sType === 'daily'    ? (Number(daily_rate)  || 0) : 0;
        const weeklyVal  = sType === 'weekly'   ? (Number(weekly_rate) || 0) : 0;

        const emp = await db.pgGet(
            `UPDATE employees
             SET name=$1, designation=$2, phone=$3, joining_date=$4,
                 salary_type=$5, salary=$6, daily_rate=$7, weekly_rate=$8,
                 working_days_per_week=$9, status=$10
             WHERE id=$11 AND company_id=$12
             RETURNING *`,
            [name, designation, phone || null, joining_date || null,
             sType, salaryVal, dailyVal, weeklyVal,
             Number(working_days_per_week) || 6,
             status || 'Active', id, companyId]
        );
        if (!emp) return res.status(404).json({ error: "Employee not found" });
        res.json(emp);
    } catch (err) {
        console.error('[employee update]', err.message);
        res.status(500).json({ error: "Failed to update employee: " + err.message });
    }
});

/**
 * 🗑️ DELETE EMPLOYEE
 */
router.delete('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.active_company_id;
    try {
        const emp = await db.pgGet('SELECT id FROM employees WHERE id = $1 AND company_id = $2', [id, companyId]);
        if (!emp) return res.status(404).json({ error: "Employee not found" });

        // Delete dependent records first
        await db.pgRun('DELETE FROM attendance_logs WHERE employee_id = $1', [id]).catch(() => {});
        await db.pgRun('DELETE FROM daily_attendance WHERE employee_id = $1', [id]).catch(() => {});
        await db.pgRun('DELETE FROM payroll_runs WHERE employee_id = $1', [id]).catch(() => {});
        await db.pgRun('DELETE FROM salary_advances WHERE employee_id = $1', [id]).catch(() => {});
        await db.pgRun('DELETE FROM employees WHERE id = $1 AND company_id = $2', [id, companyId]);

        res.json({ success: true, message: "Employee deleted" });
    } catch (err) {
        console.error('[employee delete]', err.message);
        res.status(500).json({ error: "Failed to delete employee: " + err.message });
    }
});

/**
 * 💰 PROCESS SALARY
 */
router.put('/:id/salary', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { month, working_days, present_days, deductions, advance_deducted } = req.body;
    const companyId = req.user.active_company_id;

    try {
        const employee = await db.pgGet("SELECT * FROM employees WHERE id = $1 AND company_id = $2", [id, companyId]);
        if (!employee) return res.status(404).json({ error: "Employee not found" });

        const baseSalary = parseFloat(employee.salary);
        const calculatedGross = (baseSalary / (working_days || 30)) * present_days;
        const netPay = calculatedGross - (deductions || 0) - (advance_deducted || 0);

        const sql = `
            INSERT INTO payroll_runs (company_id, employee_id, month_year, base_salary, attendance_days, gross_earnings, total_deductions, advance_deduction, net_pay, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PAID')
            RETURNING *
        `;
        const run = await db.pgGet(sql, [companyId, id, month, baseSalary, present_days, calculatedGross, deductions, advance_deducted, netPay]);

        // Ledger entries: Debit Salary Expense (6000 range), Credit Cash/Bank (1000 range)
        // Note: For now, we'll just log success. In a real run, this would call accountingEngine.postTransaction.

        res.json({ message: "Salary processed successfully", payroll: run });
    } catch (err) {
        console.error("Salary processing error:", err);
        res.status(500).json({ error: "Failed to process salary" });
    }
});

export default router;