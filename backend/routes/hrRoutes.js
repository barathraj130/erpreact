// backend/routes/hrRoutes.js
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";
import { triggerN8N } from "../utils/triggerN8N.js";
import { checkSufficientBalance } from "../utils/balanceCheck.js";
import { sendWelcomeWhatsApp } from "../utils/sendWelcomeWhatsApp.js";
import { sendWhatsApp, notifyOwner } from "../utils/whatsapp.js";

const router = express.Router();

// ==========================================
// 1. ADVANCE MANAGEMENT
// ==========================================

// Create New Advance — with payment method, ledger entry, and transaction
router.post("/advance", authMiddleware, async (req, res) => {
    const body = req.body || {};
    const {
        employee_id, amount, date, reason,
        repayment_type, installment_amount,
        payment_method = 'CASH',   // CASH | BANK | UPI
        bank_name      = null,
        reference_no   = null,
        is_opening_balance = false, // true = existing advance, skip ledger/balance check
    } = body;
    const companyId  = req.user.active_company_id;
    const branchId   = req.user.branch_id || 1;
    const advanceAmt = Number(amount) || 0;
    const advanceDate = date || new Date().toISOString().split('T')[0];
    const pMethod    = (payment_method || 'CASH').toUpperCase();
    const isOpening  = Boolean(is_opening_balance);

    let client;
    try {
        client = await db.getClient();

        // ── Balance pre-check — skipped for opening/existing advances ────────
        if (!isOpening) {
            const balCheck = await checkSufficientBalance(client, companyId, pMethod, advanceAmt);
            if (!balCheck.sufficient) {
                client.release();
                client = null;
                return res.status(422).json({
                    error: balCheck.message,
                    currentBalance: balCheck.currentBalance,
                    shortfall: balCheck.shortfall,
                    accountName: balCheck.accountName,
                });
            }
        }

        await client.query('BEGIN');

        // 1. Insert salary advance record
        const advResult = await client.query(
            `INSERT INTO salary_advances
             (company_id, employee_id, amount, advance_date, reason,
              repayment_type, installment_amount, current_balance,
              payment_method, bank_name, reference_no)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$3,$8,$9,$10)
             RETURNING id`,
            [companyId, employee_id, advanceAmt, advanceDate,
             (isOpening ? '[Opening] ' : '') + (reason || ''),
             repayment_type, installment_amount || 0,
             isOpening ? 'OPENING' : pMethod,
             bank_name || null, reference_no || null]
        );
        const advanceId = advResult.rows[0].id;

        // 2. Record cash/bank ledger outflow — SKIPPED for opening balances
        //    (the cash was given before the system was set up; no ledger impact)
        if (!isOpening) {
            if (pMethod === 'CASH') {
                await client.query(
                    `INSERT INTO cash_ledger
                     (company_id, branch_id, source, amount, direction, date, reference_id)
                     VALUES ($1,$2,'salary_advance',$3,'out',$4,$5)`,
                    [companyId, branchId, advanceAmt, advanceDate, advanceId]
                );
            } else {
                // BANK or UPI
                await client.query(
                    `INSERT INTO bank_ledger
                     (company_id, branch_id, source, amount, direction,
                      bank_name, transaction_id, date, reference_id)
                     VALUES ($1,$2,'salary_advance',$3,'out',$4,$5,$6,$7)`,
                    [companyId, branchId, advanceAmt,
                     bank_name || pMethod, reference_no || `ADV-${advanceId}`,
                     advanceDate, advanceId]
                );
            }
        }

        // 3. Record in transactions table for audit trail
        await client.query(
            `INSERT INTO transactions
             (company_id, branch_id, type, amount, transaction_date,
              description, reference_type, reference_id, created_by, status)
             VALUES ($1,$2,'SALARY_ADVANCE',$3,$4,$5,'SALARY_ADVANCE',$6,$7,'success')`,
            [companyId, branchId, advanceAmt, advanceDate,
             isOpening
                ? `Existing Advance (Opening) — ${reason || 'No reason'}`
                : `Salary Advance — ${reason || 'No reason'} [${pMethod}]`,
             advanceId, req.user.id]
        ).catch(() => {}); // non-fatal if transactions table schema differs

        await client.query('COMMIT');
        res.json({
            success: true,
            message: isOpening
                ? "Existing advance recorded (no ledger entry — cash already given)"
                : "Advance recorded and ledger updated",
        });

        // WhatsApp alert to owner (non-blocking)
        try {
            const { notifyOwner } = await import('../utils/whatsapp.js');
            const emp = await db.pgGet(`SELECT name FROM employees WHERE id = $1`, [employee_id]);
            const pendingRow = await db.pgGet(
                `SELECT COALESCE(SUM(current_balance), 0) AS total FROM salary_advances WHERE employee_id = $1 AND status = 'ACTIVE'`,
                [employee_id]
            );
            await notifyOwner(
`💸 Advance Given!

Employee: ${emp?.name || employee_id}
Amount:   ₹${advanceAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Purpose:  ${reason || 'Not specified'}
Mode:     ${pMethod}
Pending:  ₹${Number(pendingRow?.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
        } catch (_) {}

    } catch (err) {
        if (client) { try { await client.query('ROLLBACK'); } catch (_) {} }
        console.error('[advance]', err.message);
        res.status(500).json({ error: "Failed to record advance: " + err.message });
    } finally {
        if (client) { try { client.release(); } catch (_) {} }
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
            `SELECT id, advance_date as date, amount, reason as description, 'ADVANCE' as type,
                    payment_method, bank_name, reference_no
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

        // Fire n8n webhook + WhatsApp per employee (non-blocking)
        const { notifyOwner } = await import('../utils/whatsapp.js').catch(() => ({ notifyOwner: async () => {} }));
        for (const item of payroll_data) {
            triggerN8N('erp-alert', {
                event_type:    'salary_processed',
                employee_name: item.employee?.name || 'Employee',
                salary_amount: item.net_pay,
                month:         month_year,
                payment_mode:  item.payment_mode || 'CASH',
            });
        }
        // Single summary WhatsApp to owner
        try {
            const totalNet = payroll_data.reduce((s, i) => s + (Number(i.net_pay) || 0), 0);
            const fmt = (n) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            await notifyOwner(
`💰 Payroll Processed!

Month:     ${month_year}
Employees: ${payroll_data.length}
Total Net: ₹${fmt(totalNet)}
Status:    PAID ✅`);
        } catch (_) {}
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

// ==========================================
// 6. DAILY ATTENDANCE WITH WAGE CALCULATION
// ==========================================

// Ensure daily_attendance and weekly_salary tables exist (lazy-create in case migration hasn't run)
const ensureWeeklyTables = async () => {
    await db.pgRun(`
        CREATE TABLE IF NOT EXISTS daily_attendance (
            id               SERIAL PRIMARY KEY,
            company_id       INTEGER NOT NULL,
            employee_id      INTEGER REFERENCES employees(id),
            attendance_date  DATE NOT NULL,
            status           VARCHAR(20) DEFAULT 'present',
            working_hours    NUMERIC(4,2) DEFAULT 8,
            daily_wage       NUMERIC(12,2) DEFAULT 0,
            overtime_hours   NUMERIC(4,2) DEFAULT 0,
            overtime_amount  NUMERIC(12,2) DEFAULT 0,
            notes            TEXT,
            branch_id        INTEGER,
            created_at       TIMESTAMP DEFAULT NOW(),
            UNIQUE(employee_id, attendance_date)
        )
    `).catch(() => {});
    await db.pgRun(`
        CREATE TABLE IF NOT EXISTS weekly_salary (
            id               SERIAL PRIMARY KEY,
            company_id       INTEGER NOT NULL,
            employee_id      INTEGER REFERENCES employees(id),
            week_start       DATE NOT NULL,
            week_end         DATE NOT NULL,
            total_days       INTEGER DEFAULT 0,
            present_days     INTEGER DEFAULT 0,
            absent_days      INTEGER DEFAULT 0,
            half_days        INTEGER DEFAULT 0,
            gross_salary     NUMERIC(12,2) DEFAULT 0,
            advance_deducted NUMERIC(12,2) DEFAULT 0,
            net_salary       NUMERIC(12,2) DEFAULT 0,
            payment_mode     VARCHAR(20) DEFAULT 'cash',
            status           VARCHAR(20) DEFAULT 'pending',
            paid_at          TIMESTAMP,
            notes            TEXT,
            created_at       TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => {});
    await db.pgRun(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_type VARCHAR(20) DEFAULT 'monthly'`).catch(() => {});
    await db.pgRun(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(12,2) DEFAULT 0`).catch(() => {});
    await db.pgRun(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS weekly_rate NUMERIC(12,2) DEFAULT 0`).catch(() => {});
    await db.pgRun(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS working_days_per_week INTEGER DEFAULT 6`).catch(() => {});
};

// POST /hr/attendance/daily — mark and calculate daily wage
router.post("/attendance/daily", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { employee_id, attendance_date, status = 'present', working_hours = 8, notes } = req.body;
    if (!employee_id || !attendance_date) return res.status(400).json({ error: "employee_id and attendance_date required" });

    try {
        await ensureWeeklyTables();
        const emp = await db.pgGet(`SELECT * FROM employees WHERE id = $1 AND company_id = $2`, [employee_id, companyId]);
        if (!emp) return res.status(404).json({ error: "Employee not found" });

        const s = (status || 'present').toLowerCase();
        let dailyWage = 0;
        const salaryType = (emp.salary_type || 'monthly').toLowerCase();

        if (salaryType === 'daily') {
            const rate = Number(emp.daily_rate) || 0;
            dailyWage = s === 'present' ? rate : s === 'half_day' ? rate / 2 : 0;
        } else if (salaryType === 'weekly') {
            const weeklyDays = Number(emp.working_days_per_week) || 6;
            const rate = (Number(emp.weekly_rate) || 0) / weeklyDays;
            dailyWage = s === 'present' ? rate : s === 'half_day' ? rate / 2 : 0;
        } else {
            // monthly — divide by 26 standard working days
            const rate = (Number(emp.salary) || 0) / 26;
            dailyWage = s === 'present' ? rate : s === 'half_day' ? rate / 2 : 0;
        }

        // Write to daily_attendance (wages table)
        await db.pgRun(`
            INSERT INTO daily_attendance
              (company_id, employee_id, attendance_date, status, working_hours, daily_wage, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (employee_id, attendance_date)
            DO UPDATE SET status=$4, working_hours=$5, daily_wage=$6, notes=$7
        `, [companyId, employee_id, attendance_date, s, working_hours, dailyWage, notes || null]);

        // Also sync to attendance_logs so the Attendance page stays in sync
        const alStatus = s === 'present' ? 'Present' : s === 'half_day' ? 'HALF_DAY' : 'Absent';
        const alHours = Number(working_hours) || (s === 'present' ? 8 : s === 'half_day' ? 4 : 0);
        const existingLog = await db.pgGet(`SELECT id FROM attendance_logs WHERE employee_id=$1 AND date=$2`, [employee_id, attendance_date]);
        if (existingLog) {
            await db.pgRun(`UPDATE attendance_logs SET status=$1, working_hours=$2, method='DAILY_WAGE' WHERE id=$3`,
                [alStatus, alHours, existingLog.id]).catch(() => {});
        } else {
            await db.pgRun(
                `INSERT INTO attendance_logs (company_id, employee_id, date, status, working_hours, method)
                 VALUES ($1,$2,$3,$4,$5,'DAILY_WAGE')`,
                [companyId, employee_id, attendance_date, alStatus, alHours]).catch(() => {});
        }

        res.json({ success: true, daily_wage: dailyWage,
            message: `${emp.name} marked ${s} — ₹${dailyWage.toFixed(2)}` });
    } catch (err) {
        console.error('[daily-attendance]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /hr/salary/daily/summary?date=2026-05-22
router.get("/salary/daily/summary", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    try {
        await ensureWeeklyTables();

        // Read from BOTH tables:
        // - attendance_logs  (used by Attendance page — PRESENT, ABSENT, OD, LEAVE, HALF_DAY)
        // - daily_attendance (used by Daily Wage mark buttons — present, absent, half_day)
        // Prefer daily_attendance if it exists, fall back to attendance_logs
        const rows = await db.pgAll(`
            SELECT
                e.id,
                e.name,
                e.designation,
                COALESCE(e.salary_type, 'monthly')  AS salary_type,
                COALESCE(e.salary, 0)               AS monthly_salary,
                COALESCE(e.weekly_rate, 0)          AS weekly_rate,
                COALESCE(e.daily_rate, 0)           AS daily_rate,
                COALESCE(e.working_days_per_week, 6) AS working_days_per_week,

                -- Status: prefer daily_attendance, else normalise attendance_logs
                COALESCE(
                    da.status,
                    CASE LOWER(al.status)
                        WHEN 'present'  THEN 'present'
                        WHEN 'half_day' THEN 'half_day'
                        WHEN 'od'       THEN 'present'
                        WHEN 'leave'    THEN 'absent'
                        ELSE NULL
                    END
                ) AS status,

                -- Working hours: prefer daily_attendance
                COALESCE(da.working_hours,
                    CASE LOWER(al.status) WHEN 'half_day' THEN 4 WHEN 'present' THEN 8 WHEN 'od' THEN 8 ELSE 0 END
                ) AS working_hours,

                -- Daily wage: prefer daily_attendance stored value,
                -- else compute from salary_type and attendance_logs status
                COALESCE(
                    da.daily_wage,
                    CASE
                        WHEN al.status IS NULL THEN 0
                        WHEN LOWER(e.salary_type) = 'daily'
                             THEN CASE LOWER(al.status)
                                    WHEN 'present'  THEN COALESCE(e.daily_rate, 0)
                                    WHEN 'od'       THEN COALESCE(e.daily_rate, 0)
                                    WHEN 'half_day' THEN COALESCE(e.daily_rate, 0) / 2
                                    ELSE 0 END
                        WHEN LOWER(e.salary_type) = 'weekly'
                             THEN CASE LOWER(al.status)
                                    WHEN 'present'  THEN COALESCE(e.weekly_rate, 0) / NULLIF(COALESCE(e.working_days_per_week,6),0)
                                    WHEN 'od'       THEN COALESCE(e.weekly_rate, 0) / NULLIF(COALESCE(e.working_days_per_week,6),0)
                                    WHEN 'half_day' THEN (COALESCE(e.weekly_rate, 0) / NULLIF(COALESCE(e.working_days_per_week,6),0)) / 2
                                    ELSE 0 END
                        ELSE -- monthly: salary / 26
                            CASE LOWER(al.status)
                                WHEN 'present'  THEN COALESCE(e.salary, 0) / 26
                                WHEN 'od'       THEN COALESCE(e.salary, 0) / 26
                                WHEN 'half_day' THEN COALESCE(e.salary, 0) / 52
                                ELSE 0 END
                    END
                ) AS daily_wage

            FROM employees e
            LEFT JOIN daily_attendance da
              ON da.employee_id = e.id AND da.attendance_date = $2
            LEFT JOIN attendance_logs al
              ON al.employee_id = e.id AND al.date = $2
            WHERE e.company_id = $1
              AND COALESCE(e.status, 'Active') = 'Active'
            ORDER BY e.name ASC
        `, [companyId, date]);

        const totalWage = rows.reduce((s, r) => s + Number(r.daily_wage || 0), 0);
        res.json({ date, employees: rows, total_daily_wage: totalWage });
    } catch (err) {
        console.error('[daily-summary]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /hr/salary/daily/process — pay all present employees for a given date
router.post("/salary/daily/process", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id || 1;
    const { date, employees: empList } = req.body;
    if (!date || !empList?.length) return res.status(400).json({ error: "date and employees required" });

    let client;
    try {
        await ensureWeeklyTables();
        // Ensure daily_salary_payments table exists
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
        // Add columns if table existed without them
        await db.pgRun(`ALTER TABLE daily_salary_payments ADD COLUMN IF NOT EXISTS gross_wage NUMERIC(12,2) DEFAULT 0`).catch(() => {});
        await db.pgRun(`ALTER TABLE daily_salary_payments ADD COLUMN IF NOT EXISTS deduction NUMERIC(12,2) DEFAULT 0`).catch(() => {});

        client = await db.getClient();
        await client.query('BEGIN');

        const results = [];
        for (const p of empList) {
            const emp = await db.pgGet(`SELECT * FROM employees WHERE id=$1 AND company_id=$2`, [p.employee_id, companyId]);
            if (!emp) continue;

            const grossWage = Number(p.gross_wage || p.daily_wage) || 0;
            const deduction = Number(p.deduction) || 0;
            const wage      = Number(p.daily_wage) || 0; // net pay (already reduced by deduction on frontend)
            const pMode     = (p.payment_mode || 'cash').toUpperCase();

            if (wage <= 0) continue; // skip absent / zero-wage

            // Balance check
            const { checkSufficientBalance } = await import('../utils/balanceCheck.js');
            const bal = await checkSufficientBalance(client, companyId, pMode, wage);
            if (!bal.sufficient) {
                await client.query('ROLLBACK');
                client.release(); client = null;
                return res.status(422).json({ error: `Insufficient ${pMode} balance for ${emp.name}. Available: ₹${bal.currentBalance}` });
            }

            // Record payment
            await client.query(`
                INSERT INTO daily_salary_payments (company_id, employee_id, payment_date, daily_wage, gross_wage, deduction, payment_mode, status)
                VALUES ($1,$2,$3,$4,$5,$6,$7,'paid')
                ON CONFLICT (employee_id, payment_date) DO UPDATE
                  SET gross_wage=$5, deduction=$6, daily_wage=$4, payment_mode=$7, status='paid', created_at=NOW()
            `, [companyId, p.employee_id, date, wage, grossWage, deduction, pMode.toLowerCase()]);

            // Ledger deduction
            if (pMode === 'CASH') {
                await client.query(
                    `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                     VALUES ($1,$2,'daily_wage',$3,'out',$4)`,
                    [companyId, branchId, wage, date]);
            } else {
                await client.query(
                    `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, date)
                     VALUES ($1,$2,'daily_wage',$3,'out','Main Account',$4)`,
                    [companyId, branchId, wage, date]);
            }

            results.push({ employee_id: p.employee_id, name: emp.name, wage });

            // WhatsApp to employee
            if (emp.phone) {
                sendWhatsApp(String(emp.phone),
`Dear ${emp.name},
Your daily wage has been paid.
Date: ${date}
Gross: ₹${grossWage.toLocaleString('en-IN')}${deduction > 0 ? `\nDeduction: −₹${deduction.toLocaleString('en-IN')}` : ''}
Net Paid: ₹${wage.toLocaleString('en-IN')} (${pMode})
Thank you! 🙏
JBS Knit Wear`).catch(() => {});
            }
        }

        await client.query('COMMIT');

        const totalPaid = results.reduce((s, r) => s + r.wage, 0);
        notifyOwner(`💰 Daily Wages Paid!\nDate: ${date}\nEmployees: ${results.length}\nTotal: ₹${totalPaid.toLocaleString('en-IN')}`).catch(() => {});

        res.json({ success: true, processed: results.length, total_paid: totalPaid, results });
    } catch (err) {
        if (client) { try { await client.query('ROLLBACK'); } catch (_) {} }
        console.error('[daily-process]', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) { try { client.release(); } catch (_) {} }
    }
});

// ==========================================
// 7. WEEKLY SALARY (SATURDAY PAYROLL)
// ==========================================

// POST /hr/salary/weekly/calculate — preview, no payment yet
router.post("/salary/weekly/calculate", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { week_end } = req.body; // Saturday date e.g. "2026-05-24"
    if (!week_end) return res.status(400).json({ error: "week_end (Saturday date) required" });

    const weekEnd   = new Date(week_end);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 5); // Mon to Sat = 6 days
    const wsStr = weekStart.toISOString().split('T')[0];
    const weStr = weekEnd.toISOString().split('T')[0];

    try {
        await ensureWeeklyTables();

        // Include both weekly AND daily employees — both get Saturday payout
        const employees = await db.pgAll(`
            SELECT * FROM employees
            WHERE company_id = $1
              AND COALESCE(status, 'Active') = 'Active'
              AND LOWER(COALESCE(salary_type,'monthly')) IN ('weekly','daily')
        `, [companyId]);

        const results = [];
        for (const emp of employees) {
            // Try attendance from daily_attendance table first
            let att = null;
            try {
                att = await db.pgGet(`
                    SELECT
                      COUNT(*) FILTER (WHERE status = 'present')  as present_days,
                      COUNT(*) FILTER (WHERE status = 'absent')   as absent_days,
                      COUNT(*) FILTER (WHERE status = 'half_day') as half_days,
                      COALESCE(SUM(daily_wage), 0)                as gross_salary
                    FROM daily_attendance
                    WHERE employee_id = $1
                      AND attendance_date BETWEEN $2 AND $3
                `, [emp.id, wsStr, weStr]);
            } catch (_) { att = null; }

            const adv = await db.pgGet(`
                SELECT COALESCE(SUM(current_balance), 0) as total_advance
                FROM salary_advances
                WHERE employee_id = $1
                  AND status = 'ACTIVE'
                  AND current_balance > 0
            `, [emp.id]).catch(() => null);

            const presentDays    = Number(att?.present_days)  || 0;
            const absentDays     = Number(att?.absent_days)   || 0;
            const halfDays       = Number(att?.half_days)     || 0;
            const grossSalary    = Number(att?.gross_salary)  || 0;
            const advanceBalance = Number(adv?.total_advance) || 0;
            const salaryType     = (emp.salary_type || 'monthly').toLowerCase();
            const workingDays    = Number(emp.working_days_per_week) || 6;

            results.push({
                employee_id:          emp.id,
                employee_name:        emp.name,
                phone:                emp.phone,
                designation:          emp.designation,
                salary_type:          salaryType,
                weekly_rate:          Number(emp.weekly_rate) || 0,
                daily_rate:           Number(emp.daily_rate)  || 0,
                salary:               Number(emp.salary)      || 0,
                working_days_per_week: workingDays,
                week_start:           wsStr,
                week_end:             weStr,
                present_days:         presentDays,
                absent_days:          absentDays,
                half_days:            halfDays,
                gross_salary:         grossSalary,
                advance_balance:      advanceBalance,   // ← field name frontend uses
                net_salary:           Math.max(0, grossSalary - advanceBalance),
            });
        }

        res.json({ success: true, week_start: wsStr, week_end: weStr, employees: results });
    } catch (err) {
        console.error('[weekly-calculate]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /hr/salary/weekly/process — finalise and pay
router.post("/salary/weekly/process", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id || 1;
    const { week_end, employees: empDecisions, payments: legacyPayments } = req.body;
    // Accept either 'employees' (new) or 'payments' (old field name)
    const decisions = empDecisions || legacyPayments || [];
    if (!decisions.length) return res.status(400).json({ error: "No employees provided" });
    if (!week_end) return res.status(400).json({ error: "week_end required" });

    const weekEnd   = new Date(week_end);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 5);
    const wsStr = weekStart.toISOString().split('T')[0];
    const weStr = weekEnd.toISOString().split('T')[0];

    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        await ensureWeeklyTables();
        const results = [];
        for (const p of decisions) {
            const emp = await db.pgGet(`SELECT * FROM employees WHERE id = $1 AND company_id = $2`, [p.employee_id, companyId]);
            if (!emp) continue;

            const pMode = (p.payment_mode || 'cash').toUpperCase();

            // Re-fetch attendance for this employee for the week
            let att = null;
            try {
                att = await db.pgGet(`
                    SELECT
                      COUNT(*) FILTER (WHERE status = 'present')  as present_days,
                      COUNT(*) FILTER (WHERE status = 'absent')   as absent_days,
                      COUNT(*) FILTER (WHERE status = 'half_day') as half_days,
                      COALESCE(SUM(daily_wage), 0)                as gross_salary
                    FROM daily_attendance
                    WHERE employee_id = $1 AND attendance_date BETWEEN $2 AND $3
                `, [emp.id, wsStr, weStr]);
            } catch (_) { att = null; }

            const grossSalary = Number(att?.gross_salary) || 0;

            // Advance balance from salary_advances
            const advRow = await db.pgGet(`
                SELECT COALESCE(SUM(current_balance), 0) as total
                FROM salary_advances
                WHERE employee_id = $1 AND status = 'ACTIVE' AND current_balance > 0
            `, [emp.id]).catch(() => null);
            const advanceBalance = Number(advRow?.total) || 0;

            const advDeducted = p.deduct_advance ? Math.min(advanceBalance, grossSalary) : 0;
            const netSalary   = Math.max(0, grossSalary - advDeducted);

            // Balance check
            if (netSalary > 0) {
                const balCheck = await checkSufficientBalance(client, companyId, pMode, netSalary);
                if (!balCheck.sufficient) {
                    await client.query('ROLLBACK');
                    client.release(); client = null;
                    return res.status(422).json({
                        error: `Insufficient ${pMode} balance for ${emp.name}. Available: ₹${balCheck.currentBalance}` });
                }
            }

            // Insert weekly_salary record
            const wkRow = await client.query(`
                INSERT INTO weekly_salary
                  (company_id, employee_id, week_start, week_end,
                   total_days, present_days, absent_days, half_days,
                   gross_salary, advance_deducted, net_salary,
                   payment_mode, status, paid_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'paid',NOW())
                RETURNING id
            `, [companyId, p.employee_id, wsStr, weStr,
                (Number(att?.present_days) + Number(att?.absent_days) + Number(att?.half_days)) || 6,
                Number(att?.present_days) || 0, Number(att?.absent_days) || 0, Number(att?.half_days) || 0,
                grossSalary, advDeducted, netSalary, pMode.toLowerCase()]);

            const wkId = wkRow.rows[0].id;

            // Ledger: cash or bank out
            if (netSalary > 0) {
                if (pMode === 'CASH') {
                    await client.query(
                        `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date, reference_id)
                         VALUES ($1,$2,'weekly_salary',$3,'out',CURRENT_DATE,$4)`,
                        [companyId, branchId, netSalary, wkId]);
                } else {
                    await client.query(
                        `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, date, reference_id)
                         VALUES ($1,$2,'weekly_salary',$3,'out',$4,CURRENT_DATE,$5)`,
                        [companyId, branchId, netSalary, 'Main Account', wkId]);
                }
            }

            // Update advance balance if deducted
            if (advDeducted > 0) {
                await client.query(`
                    UPDATE salary_advances
                    SET current_balance = GREATEST(0, current_balance - $1),
                        status = CASE WHEN (current_balance - $1) <= 0 THEN 'RECOVERED' ELSE status END
                    WHERE employee_id = $2 AND status = 'ACTIVE' AND current_balance > 0
                `, [advDeducted, p.employee_id]);
            }

            results.push({ employee_id: p.employee_id, name: emp.name, net_salary: netSalary });

            // WhatsApp to employee
            if (emp.phone) {
                const msg =
`Dear ${emp.name},

💰 Weekly Salary Credited!

Period: ${wsStr} to ${weStr}
Days Present: ${Number(att?.present_days) || 0} days
Gross Salary: ₹${grossSalary.toLocaleString('en-IN')}${advDeducted > 0 ? `\nAdvance Deducted: −₹${advDeducted.toLocaleString('en-IN')}` : ''}
Net Paid: ₹${netSalary.toLocaleString('en-IN')}
Mode: ${pMode}

Thank you! 🙏
JBS Knit Wear
📞 8148232205`;
                sendWhatsApp(emp.phone, msg).catch(() => {});
            }
        }

        await client.query('COMMIT');

        const totalNet = results.reduce((s, r) => s + (Number(r.net_salary) || 0), 0);

        // Owner summary WhatsApp
        notifyOwner(
`💰 Weekly Salaries Processed!

Week: ${week_end}
Employees Paid: ${results.length}
Total Amount: ₹${totalNet.toLocaleString('en-IN')}`
        ).catch(() => {});

        res.json({ success: true, processed: results.length, total_paid: totalNet, message: `Processed ${results.length} weekly salaries`, results });
    } catch (err) {
        if (client) { try { await client.query('ROLLBACK'); } catch (_) {} }
        console.error('[weekly-process]', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) { try { client.release(); } catch (_) {} }
    }
});

// GET /hr/salary/weekly/history?employee_id=1
router.get("/salary/weekly/history", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { employee_id } = req.query;
    try {
        await ensureWeeklyTables();
        const rows = await db.pgAll(`
            SELECT ws.*, e.name as employee_name
            FROM weekly_salary ws
            JOIN employees e ON e.id = ws.employee_id
            WHERE ws.company_id = $1
              ${employee_id ? 'AND ws.employee_id = $2' : ''}
            ORDER BY ws.week_end DESC LIMIT 100
        `, employee_id ? [companyId, employee_id] : [companyId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;