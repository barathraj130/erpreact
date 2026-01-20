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
    const { employee_id, amount, date, reason, repayment_type, installment_amount } = req.body;
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
        // 1. Get all Advances given (Debits to Employee)
        const advances = await db.pgAll(
            `SELECT id, advance_date as date, amount, reason as description, 'ADVANCE' as type 
             FROM salary_advances 
             WHERE employee_id=$1 AND company_id=$2`,
            [employeeId, companyId]
        );

        // 2. Get all Repayments made via Payroll (Credits to Employee)
        const repayments = await db.pgAll(
            `SELECT ar.id, ar.transaction_date as date, ar.amount_deducted as amount, 'Payroll Deduction' as description, 'REPAYMENT' as type
             FROM advance_repayments ar
             JOIN salary_advances sa ON ar.advance_id = sa.id
             WHERE sa.employee_id = $1`,
            [employeeId]
        );

        // 3. Merge and Sort by Date
        const ledger = [...advances, ...repayments].sort((a, b) => new Date(a.date) - new Date(b.date));

        // 4. Calculate Running Balance
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

// Mark Attendance via QR Scan (Admin Kiosk - requires auth)
router.post("/attendance/scan", authMiddleware, async (req, res) => {
    const { qr_token, status, work_assigned } = req.body;
    const companyId = req.user.active_company_id;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('en-US', { hour12: false });

    try {
        // Decode Token (Basic string split)
        const parts = qr_token.split('_');
        if (parts.length < 2) throw new Error("Invalid QR");

        const employeeId = parseInt(parts[1]);

        // Check if employee exists in this company
        const emp = await db.pgGet("SELECT id, name FROM employees WHERE id=$1 AND company_id=$2", [employeeId, companyId]);
        if (!emp) return res.status(404).json({ error: "Employee not found" });

        // Check if already checked in today
        const existing = await db.pgGet(
            `SELECT * FROM attendance_logs WHERE employee_id=$1 AND date=$2`,
            [employeeId, today]
        );

        if (existing) {
            // Update Check-out
            await db.pgRun(
                `UPDATE attendance_logs SET check_out_time=$1 WHERE id=$2`,
                [now, existing.id]
            );
            return res.json({ message: `Goodbye ${emp.name}! Check-out recorded.`, type: "OUT" });
        } else {
            // Create Check-in with Status & Work Assigned
            await db.pgRun(
                `INSERT INTO attendance_logs (company_id, employee_id, date, check_in_time, status, work_assigned)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    companyId,
                    employeeId,
                    today,
                    now,
                    status || 'PRESENT',
                    work_assigned || ''
                ]
            );
            return res.json({ message: `Welcome ${emp.name}! Marked as ${status || 'PRESENT'}.`, type: "IN" });
        }
    } catch (err) {
        console.error("Attendance Scan Error:", err);
        res.status(500).json({ error: "Scan failed or Invalid QR" });
    }
});

// ==========================================
// 3. MOBILE ATTENDANCE (QR Code from Phone)
// ==========================================

// POST /api/hr/attendance/mobile - Mark attendance from mobile phone (NO AUTH REQUIRED)
router.post("/attendance/mobile", async (req, res) => {
    const { qr_token, status, work_assigned, latitude, longitude } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('en-US', { hour12: false });

    try {
        // 1. Validate QR Token format: EMP_<id>_SECRET
        if (!qr_token || !qr_token.startsWith('EMP_')) {
            return res.status(400).json({ error: "Invalid QR Code" });
        }

        const parts = qr_token.split('_');
        if (parts.length < 3) {
            return res.status(400).json({ error: "Invalid QR Code format" });
        }

        const employeeId = parseInt(parts[1]);
        if (isNaN(employeeId)) {
            return res.status(400).json({ error: "Invalid Employee ID in QR" });
        }

        // 2. Find Employee
        const employee = await db.pgGet(
            "SELECT id, name, company_id, status FROM employees WHERE id = $1",
            [employeeId]
        );

        if (!employee) {
            return res.status(404).json({ error: "Employee not found" });
        }

        if (employee.status !== 'Active') {
            return res.status(403).json({ error: "Employee is not active" });
        }

        // 3. Check if already marked attendance today
        const existing = await db.pgGet(
            `SELECT * FROM attendance_logs WHERE employee_id = $1 AND date = $2`,
            [employeeId, today]
        );

        if (existing) {
            // Already checked in - this is a check-out
            if (existing.check_out_time) {
                return res.status(400).json({
                    error: "Attendance already marked for today",
                    message: `You checked in at ${existing.check_in_time} and out at ${existing.check_out_time}`
                });
            }

            // Update check-out time
            await db.pgRun(
                `UPDATE attendance_logs SET check_out_time = $1 WHERE id = $2`,
                [now, existing.id]
            );

            return res.json({
                success: true,
                message: `Good bye ${employee.name}! Check-out recorded at ${now}`,
                employee_name: employee.name,
                type: "CHECK_OUT",
                time: now
            });
        }

        // 4. Create new attendance record (Check-in)
        const validStatuses = ['PRESENT', 'OD', 'LEAVE', 'HALF_DAY'];
        const attendanceStatus = validStatuses.includes(status) ? status : 'PRESENT';

        // Try to insert with location, fallback to without location if columns don't exist
        try {
            await db.pgRun(
                `INSERT INTO attendance_logs (company_id, employee_id, date, check_in_time, status, work_assigned, method, latitude, longitude)
                 VALUES ($1, $2, $3, $4, $5, $6, 'QR_MOBILE', $7, $8)`,
                [
                    employee.company_id,
                    employeeId,
                    today,
                    now,
                    attendanceStatus,
                    work_assigned || '',
                    latitude || null,
                    longitude || null
                ]
            );
        } catch (insertErr) {
            // Fallback: Insert without location columns
            await db.pgRun(
                `INSERT INTO attendance_logs (company_id, employee_id, date, check_in_time, status, work_assigned, method)
                 VALUES ($1, $2, $3, $4, $5, $6, 'QR_MOBILE')`,
                [
                    employee.company_id,
                    employeeId,
                    today,
                    now,
                    attendanceStatus,
                    work_assigned || ''
                ]
            );
        }

        // Build response message based on status
        const statusMessages = {
            'PRESENT': `Welcome ${employee.name}! Marked as Present at ${now}`,
            'OD': `Welcome ${employee.name}! Marked as On Duty at ${now}`,
            'LEAVE': `${employee.name}, your leave has been recorded for today.`,
            'HALF_DAY': `Welcome ${employee.name}! Marked as Half Day at ${now}`
        };

        return res.json({
            success: true,
            message: statusMessages[attendanceStatus] || `Attendance marked for ${employee.name}`,
            employee_name: employee.name,
            type: "CHECK_IN",
            status: attendanceStatus,
            time: now
        });

    } catch (err) {
        console.error("Mobile Attendance Error:", err);
        return res.status(500).json({ error: "Failed to mark attendance. Please try again." });
    }
});

// ==========================================
// 4. GET ATTENDANCE RECORDS
// ==========================================

// Get Attendance for a specific date
router.get("/attendance", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
        const records = await db.pgAll(
            `SELECT a.*, e.name as employee_name, e.designation
             FROM attendance_logs a
             JOIN employees e ON a.employee_id = e.id
             WHERE a.company_id = $1 AND a.date = $2
             ORDER BY a.check_in_time ASC`,
            [companyId, targetDate]
        );
        res.json(records);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch attendance records" });
    }
});

// Get Monthly Attendance Summary
router.get("/attendance/summary", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { month } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    try {
        const summary = await db.pgAll(
            `SELECT 
                e.id as employee_id,
                e.name as employee_name,
                e.designation,
                COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END) as present_days,
                COUNT(CASE WHEN a.status = 'OD' THEN 1 END) as od_days,
                COUNT(CASE WHEN a.status = 'LEAVE' THEN 1 END) as leave_days,
                COUNT(CASE WHEN a.status = 'HALF_DAY' THEN 1 END) as half_days,
                COUNT(a.id) as total_days
             FROM employees e
             LEFT JOIN attendance_logs a ON e.id = a.employee_id AND to_char(a.date, 'YYYY-MM') = $2
             WHERE e.company_id = $1 AND e.status = 'Active'
             GROUP BY e.id, e.name, e.designation
             ORDER BY e.name`,
            [companyId, targetMonth]
        );
        res.json(summary);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch attendance summary" });
    }
});

// ==========================================
// 5. PAYROLL - MONTHLY, WEEKLY, DAILY
// ==========================================

// Generate Payroll Preview
router.post("/payroll/preview", authMiddleware, async (req, res) => {
    const { month_year } = req.body;
    const companyId = req.user.active_company_id;

    try {
        // Get all active employees
        const employees = await db.pgAll(
            `SELECT * FROM employees WHERE company_id=$1 AND status='Active'`,
            [companyId]
        );

        const payrollPreview = [];

        for (const emp of employees) {
            // 1. Get attendance for the month
            const attendance = await db.pgGet(
                `SELECT 
                    COUNT(CASE WHEN status IN ('PRESENT', 'OD') THEN 1 END) as working_days,
                    COUNT(CASE WHEN status = 'HALF_DAY' THEN 1 END) as half_days,
                    COUNT(CASE WHEN status = 'LEAVE' THEN 1 END) as leave_days
                 FROM attendance_logs 
                 WHERE employee_id=$1 AND to_char(date, 'YYYY-MM')=$2`,
                [emp.id, month_year]
            );

            const workingDays = Number(attendance?.working_days || 0);
            const halfDays = Number(attendance?.half_days || 0);
            const leaveDays = Number(attendance?.leave_days || 0);
            const effectiveDays = workingDays + (halfDays * 0.5);

            // 2. Calculate Gross based on salary type
            const baseSalary = Number(emp.salary) || 0;
            const salaryType = emp.salary_type || 'Monthly';

            let grossEarnings = 0;

            if (salaryType === 'Daily') {
                // Daily workers: Daily rate × Days worked
                grossEarnings = Math.round(baseSalary * effectiveDays);
            } else if (salaryType === 'Weekly') {
                // Weekly workers: (Weekly rate / 6) × Days worked (assuming 6-day work week)
                const dailyFromWeekly = baseSalary / 6;
                grossEarnings = Math.round(dailyFromWeekly * effectiveDays);
            } else {
                // Monthly workers: (Monthly salary / 30) × Days worked
                const dailyRate = baseSalary / 30;
                grossEarnings = Math.round(dailyRate * effectiveDays);
            }

            // 3. Get advance deductions
            let advanceDeduction = 0;
            let advanceId = null;

            const activeAdvance = await db.pgGet(
                `SELECT * FROM salary_advances 
                 WHERE employee_id=$1 AND status='ACTIVE' AND current_balance > 0
                 ORDER BY created_at ASC LIMIT 1`,
                [emp.id]
            );

            if (activeAdvance) {
                const bal = Number(activeAdvance.current_balance);
                const inst = Number(activeAdvance.installment_amount);
                advanceId = activeAdvance.id;

                if (activeAdvance.repayment_type === 'ONE_TIME') {
                    advanceDeduction = bal;
                } else if (activeAdvance.repayment_type === 'INSTALLMENT') {
                    advanceDeduction = Math.min(inst, bal);
                } else if (activeAdvance.repayment_type === 'DAILY') {
                    advanceDeduction = Math.min(inst * effectiveDays, bal);
                } else if (activeAdvance.repayment_type === 'MANUAL') {
                    advanceDeduction = 0; // Manual deduction - admin decides
                }
            }

            // 4. Safety Cap: Ensure No Negative Salary
            if (advanceDeduction > grossEarnings) {
                advanceDeduction = grossEarnings;
            }

            const netPay = grossEarnings - advanceDeduction;

            payrollPreview.push({
                employee: {
                    id: emp.id,
                    name: emp.name,
                    designation: emp.designation,
                    salary: baseSalary,
                    salary_type: salaryType
                },
                attendance: {
                    working_days: workingDays,
                    half_days: halfDays,
                    leave_days: leaveDays,
                    effective_days: effectiveDays
                },
                days_present: effectiveDays,
                gross: grossEarnings,
                deduction: advanceDeduction,
                net_pay: netPay,
                advance_id: advanceId,
                original_deduction: advanceDeduction,
                skipped: false
            });
        }

        res.json(payrollPreview);

    } catch (err) {
        console.error("Payroll Preview Error:", err);
        res.status(500).json({ error: "Calculation failed" });
    }
});

// Finalize Payroll
router.post("/payroll/finalize", authMiddleware, async (req, res) => {
    const { month_year, payroll_data } = req.body;
    const companyId = req.user.active_company_id;

    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');

        for (const item of payroll_data) {
            // 1. Insert Payroll Record
            await client.query(
                `INSERT INTO payroll_runs 
                (company_id, employee_id, month_year, base_salary, attendance_days, gross_earnings, total_deductions, advance_deduction, net_pay, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PAID')`,
                [
                    companyId,
                    item.employee.id,
                    month_year,
                    item.employee.salary,
                    item.days_present,
                    item.gross,
                    item.deduction,
                    item.deduction,
                    item.net_pay
                ]
            );

            // 2. If advance was deducted, record repayment and update balance
            if (item.advance_id && item.deduction > 0 && !item.skipped) {
                // Record repayment
                await client.query(
                    `INSERT INTO advance_repayments (advance_id, amount_deducted, transaction_date, type, notes)
                     VALUES ($1, $2, CURRENT_DATE, 'DEDUCTION', $3)`,
                    [item.advance_id, item.deduction, `Payroll deduction for ${month_year}`]
                );

                // Update advance balance
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
        res.json({ success: true, message: `Payroll for ${month_year} finalized successfully` });

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Payroll Finalize Error:", err);
        res.status(500).json({ error: "Failed to finalize payroll" });
    } finally {
        if (client) client.release();
    }
});

// Get Payroll History
router.get("/payroll/history", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { month_year } = req.query;

    try {
        let sql = `
            SELECT 
                pr.*,
                e.name as employee_name,
                e.designation,
                e.salary_type
            FROM payroll_runs pr
            JOIN employees e ON pr.employee_id = e.id
            WHERE pr.company_id = $1
        `;
        const params = [companyId];

        if (month_year) {
            sql += ` AND pr.month_year = $2`;
            params.push(month_year);
        }

        sql += ` ORDER BY pr.generated_at DESC LIMIT 100`;

        const history = await db.pgAll(sql, params);
        res.json(history);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch payroll history" });
    }
});

// ==========================================
// 6. MANUAL ATTENDANCE ENTRY (Admin)
// ==========================================

// Create/Update attendance manually
router.post("/attendance/manual", authMiddleware, async (req, res) => {
    const { employee_id, date, status, check_in_time, check_out_time, work_assigned } = req.body;
    const companyId = req.user.active_company_id;

    try {
        // Check if record exists
        const existing = await db.pgGet(
            `SELECT id FROM attendance_logs WHERE employee_id = $1 AND date = $2`,
            [employee_id, date]
        );

        if (existing) {
            // Update existing record
            await db.pgRun(
                `UPDATE attendance_logs 
                 SET status = $1, check_in_time = $2, check_out_time = $3, work_assigned = $4, method = 'MANUAL'
                 WHERE id = $5`,
                [status, check_in_time, check_out_time, work_assigned || '', existing.id]
            );
            res.json({ success: true, message: "Attendance updated" });
        } else {
            // Create new record
            await db.pgRun(
                `INSERT INTO attendance_logs (company_id, employee_id, date, status, check_in_time, check_out_time, work_assigned, method)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'MANUAL')`,
                [companyId, employee_id, date, status, check_in_time, check_out_time, work_assigned || '']
            );
            res.json({ success: true, message: "Attendance recorded" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save attendance" });
    }
});

// Delete attendance record
router.delete("/attendance/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.active_company_id;

    try {
        const result = await db.pgRun(
            `DELETE FROM attendance_logs WHERE id = $1 AND company_id = $2`,
            [id, companyId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Record not found" });
        }

        res.json({ success: true, message: "Attendance record deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete attendance" });
    }
});

export default router;