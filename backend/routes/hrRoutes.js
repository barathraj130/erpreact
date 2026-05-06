// backend/routes/hrRoutes.js
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

// ==========================================
// 1. ADVANCE MANAGEMENT
// ==========================================

// Create New Advance
router.post("/advance", authMiddleware, async (req, res) => {
    const body = req.body || {};
    const { employee_id, amount, date, reason, repayment_type, installment_amount } = body;
    const companyId = req.user.active_company_id;

    try {
        await db.pgRun(
            `INSERT INTO salary_advances 
            (company_id, employee_id, amount, advance_date, reason, repayment_type, installment_amount, current_balance)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $3)`,
            [companyId, employee_id, amount, date, reason, repayment_type, installment_amount]
        );
        res.json({ success: true, message: "Advance recorded successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to record advance" });
    }
});

// Get Active Advances for Payroll Review
router.get("/advances/active", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT sa.*, e.name as employee_name, e.salary as base_salary
            FROM salary_advances sa
            JOIN employees e ON sa.employee_id = e.id
            WHERE sa.company_id = $1 AND sa.status = 'ACTIVE' AND sa.current_balance > 0
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch advances" });
    }
});

// GET EMPLOYEE ADVANCE LEDGER
router.get("/ledger/:employeeId", authMiddleware, async (req, res) => {
    const { employeeId } = req.params;
    const companyId = req.user.active_company_id;

    try {
        const advances = await db.pgAll(
            `SELECT id, advance_date as date, amount, reason as description, 'ADVANCE' as type 
             FROM salary_advances 
             WHERE employee_id=$1 AND company_id=$2`,
            [employeeId, companyId]
        );

        const repayments = await db.pgAll(
            `SELECT ar.id, ar.transaction_date as date, ar.amount_deducted as amount, 'Payroll Deduction' as description, 'REPAYMENT' as type
             FROM advance_repayments ar
             JOIN salary_advances sa ON ar.advance_id = sa.id
             WHERE sa.employee_id = $1`,
            [employeeId]
        );

        const ledger = [...advances, ...repayments].sort((a, b) => new Date(a.date) - new Date(b.date));

        let balance = 0;
        const ledgerWithBalance = ledger.map(entry => {
            if (entry.type === 'ADVANCE') {
                balance += Number(entry.amount);
            } else {
                balance -= Number(entry.amount);
            }
            return { ...entry, running_balance: balance };
        });

        res.json(ledgerWithBalance);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch ledger" });
    }
});

// ==========================================
// 2. ATTENDANCE (QR SYSTEM - ADMIN KIOSK)
// ==========================================

router.post("/attendance/scan", authMiddleware, async (req, res) => {
    const body = req.body || {};
    const { qr_token, status, work_assigned } = body;
    const companyId = req.user.active_company_id;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('en-US', { hour12: false });

    try {
        const parts = qr_token.split('_');
        if (parts.length < 2) throw new Error("Invalid QR");
        const employeeId = parseInt(parts[1]);

        const emp = await db.pgGet("SELECT id, name FROM employees WHERE id=$1 AND company_id=$2", [employeeId, companyId]);
        if (!emp) return res.status(404).json({ error: "Employee not found" });

        const existing = await db.pgGet(
            `SELECT * FROM attendance_logs WHERE employee_id=$1 AND date=$2`,
            [employeeId, today]
        );

        if (existing) {
            await db.pgRun(`UPDATE attendance_logs SET check_out_time=$1 WHERE id=$2`, [now, existing.id]);
            return res.json({ message: `Goodbye ${emp.name}! Check-out recorded.`, type: "OUT" });
        } else {
            await db.pgRun(
                `INSERT INTO attendance_logs (company_id, employee_id, date, check_in_time, status, work_assigned)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [companyId, employeeId, today, now, status || 'PRESENT', work_assigned || '']
            );
            return res.json({ message: `Welcome ${emp.name}! Marked as ${status || 'PRESENT'}.`, type: "IN" });
        }
    } catch (err) {
        console.error("Attendance Scan Error:", err);
        res.status(500).json({ error: "Scan failed or Invalid QR" });
    }
});

// ==========================================
// 3. MOBILE ATTENDANCE (NO AUTH)
// ==========================================

router.post("/attendance/mobile", async (req, res) => {
    const { qr_token, status, work_assigned, latitude, longitude } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('en-US', { hour12: false });

    try {
        if (!qr_token || !qr_token.startsWith('EMP_')) return res.status(400).json({ error: "Invalid QR" });
        const parts = qr_token.split('_');
        const employeeId = parseInt(parts[1]);

        const employee = await db.pgGet("SELECT id, name, company_id, status FROM employees WHERE id = $1", [employeeId]);
        if (!employee || employee.status !== 'Active') return res.status(404).json({ error: "Employee inactive/not found" });

        const existing = await db.pgGet(`SELECT * FROM attendance_logs WHERE employee_id = $1 AND date = $2`, [employeeId, today]);

        if (existing) {
            if (existing.check_out_time) return res.status(400).json({ error: "Attendance already completed" });
            await db.pgRun(`UPDATE attendance_logs SET check_out_time = $1 WHERE id = $2`, [now, existing.id]);
            return res.json({ success: true, message: `Goodbye ${employee.name}!`, type: "CHECK_OUT" });
        }

        await db.pgRun(
            `INSERT INTO attendance_logs (company_id, employee_id, date, check_in_time, status, work_assigned, method)
             VALUES ($1, $2, $3, $4, $5, $6, 'QR_MOBILE')`,
            [employee.company_id, employeeId, today, now, status || 'PRESENT', work_assigned || '']
        );

        return res.json({ success: true, message: `Welcome ${employee.name}!`, type: "CHECK_IN" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to mark attendance" });
    }
});

// ==========================================
// 4. REPORTS & SUMMARY
// ==========================================

router.get("/attendance", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    try {
        const records = await db.pgAll(
            `SELECT a.*, e.name as employee_name, e.designation FROM attendance_logs a
             JOIN employees e ON a.employee_id = e.id
             WHERE a.company_id = $1 AND a.date = $2 ORDER BY a.check_in_time ASC`,
            [companyId, targetDate]
        );
        res.json(records);
    } catch (err) { res.status(500).json({ error: "Error" }); }
});

router.get("/attendance/summary", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { month } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    try {
        const summary = await db.pgAll(
            `SELECT e.id as employee_id, e.name as employee_name, e.designation,
                COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END) as present_days,
                COUNT(CASE WHEN a.status = 'OD' THEN 1 END) as od_days,
                COUNT(CASE WHEN a.status = 'LEAVE' THEN 1 END) as leave_days,
                COUNT(CASE WHEN a.status = 'HALF_DAY' THEN 1 END) as half_days
             FROM employees e
             LEFT JOIN attendance_logs a ON e.id = a.employee_id AND to_char(a.date, 'YYYY-MM') = $2
             WHERE e.company_id = $1 AND e.status = 'Active'
             GROUP BY e.id, e.name, e.designation`,
            [companyId, targetMonth]
        );
        res.json(summary);
    } catch (err) { res.status(500).json({ error: "Error" }); }
});

// ==========================================
// 5. PAYROLL (FIXED TRANSACTION)
// ==========================================

router.post("/payroll/preview", authMiddleware, async (req, res) => {
    const { month_year } = req.body;
    const companyId = req.user.active_company_id;

    try {
        const employees = await db.pgAll(`SELECT * FROM employees WHERE company_id=$1 AND status='Active'`, [companyId]);
        const payrollPreview = [];

        for (const emp of employees) {
            const attendance = await db.pgGet(
                `SELECT COUNT(CASE WHEN status IN ('PRESENT', 'OD') THEN 1 END) as working_days,
                        COUNT(CASE WHEN status = 'HALF_DAY' THEN 1 END) as half_days
                 FROM attendance_logs WHERE employee_id=$1 AND to_char(date, 'YYYY-MM')=$2`,
                [emp.id, month_year]
            );

            const effectiveDays = Number(attendance?.working_days || 0) + (Number(attendance?.half_days || 0) * 0.5);
            const baseSalary = Number(emp.salary) || 0;
            const salaryType = emp.salary_type || 'Monthly';

            let grossEarnings = 0;
            if (salaryType === 'Daily') grossEarnings = Math.round(baseSalary * effectiveDays);
            else if (salaryType === 'Weekly') grossEarnings = Math.round((baseSalary / 6) * effectiveDays);
            else grossEarnings = Math.round((baseSalary / 30) * effectiveDays);

            let advanceDeduction = 0;
            let advanceId = null;
            const activeAdvance = await db.pgGet(
                `SELECT * FROM salary_advances WHERE employee_id=$1 AND status='ACTIVE' AND current_balance > 0 LIMIT 1`,
                [emp.id]
            );

            if (activeAdvance) {
                advanceId = activeAdvance.id;
                if (activeAdvance.repayment_type === 'ONE_TIME') advanceDeduction = Number(activeAdvance.current_balance);
                else advanceDeduction = Math.min(Number(activeAdvance.installment_amount), Number(activeAdvance.current_balance));
            }

            if (advanceDeduction > grossEarnings) advanceDeduction = grossEarnings;

            payrollPreview.push({
                employee: { id: emp.id, name: emp.name, designation: emp.designation, salary: baseSalary, salary_type: salaryType },
                days_present: effectiveDays,
                gross: grossEarnings,
                deduction: advanceDeduction,
                net_pay: grossEarnings - advanceDeduction,
                advance_id: advanceId,
                original_deduction: advanceDeduction,
                skipped: false
            });
        }
        res.json(payrollPreview);
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.post("/payroll/finalize", authMiddleware, async (req, res) => {
    const { month_year, payroll_data } = req.body;
    const companyId = req.user.active_company_id;

    let client;
    try {
        client = await db.getClient(); // FIX: Transaction safety helper
        await client.query('BEGIN');

        for (const item of payroll_data) {
            await client.query(
                `INSERT INTO payroll_runs 
                (company_id, employee_id, month_year, base_salary, attendance_days, gross_earnings, total_deductions, advance_deduction, net_pay, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PAID')`,
                [companyId, item.employee.id, month_year, item.employee.salary, item.days_present, item.gross, item.deduction, item.deduction, item.net_pay]
            );

            if (item.advance_id && item.deduction > 0 && !item.skipped) {
                await client.query(
                    `INSERT INTO advance_repayments (advance_id, amount_deducted, transaction_date, type, notes)
                     VALUES ($1, $2, CURRENT_DATE, 'DEDUCTION', $3)`,
                    [item.advance_id, item.deduction, `Payroll deduction for ${month_year}`]
                );

                await client.query(
                    `UPDATE salary_advances 
                     SET current_balance = current_balance - $1,
                         status = CASE WHEN current_balance - $1 <= 0 THEN 'CLOSED' ELSE status END
                     WHERE id = $2`,
                    [item.deduction, item.advance_id]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Payroll finalized` });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Failed to finalize payroll" });
    } finally {
        if (client) client.release();
    }
});

router.get("/payroll/history", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const history = await db.pgAll(
            `SELECT pr.*, e.name as employee_name FROM payroll_runs pr
             JOIN employees e ON pr.employee_id = e.id WHERE pr.company_id = $1 ORDER BY pr.generated_at DESC`,
            [companyId]
        );
        res.json(history);
    } catch (err) { res.status(500).json({ error: "Error" }); }
});

// ==========================================
// 6. MANUAL ATTENDANCE ENTRY (Admin)
// ==========================================

router.post("/attendance/manual", authMiddleware, async (req, res) => {
    const body = req.body || {};
    const { employee_id, date, status, check_in_time, check_out_time, work_assigned } = body;
    const companyId = req.user.active_company_id;

    try {
        const existing = await db.pgGet(`SELECT id FROM attendance_logs WHERE employee_id = $1 AND date = $2`, [employee_id, date]);

        if (existing) {
            await db.pgRun(
                `UPDATE attendance_logs SET status = $1, check_in_time = $2, check_out_time = $3, work_assigned = $4, method = 'MANUAL' WHERE id = $5`,
                [status, check_in_time, check_out_time, work_assigned || '', existing.id]
            );
            res.json({ success: true, message: "Attendance updated" });
        } else {
            await db.pgRun(
                `INSERT INTO attendance_logs (company_id, employee_id, date, status, check_in_time, check_out_time, work_assigned, method)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'MANUAL')`,
                [companyId, employee_id, date, status, check_in_time, check_out_time, work_assigned || '']
            );
            res.json({ success: true, message: "Attendance recorded" });
        }
    } catch (err) {
        console.error("❌ Attendance Error:", err);
        res.status(500).json({ error: err.message || "Failed to process attendance" });
    }
});

router.delete("/attendance/:id", authMiddleware, async (req, res) => {
    try {
        await db.pgRun(`DELETE FROM attendance_logs WHERE id = $1 AND company_id = $2`, [req.params.id, req.user.active_company_id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Error" }); }
});

export default router;