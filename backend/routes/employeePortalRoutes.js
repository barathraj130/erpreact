// backend/routes/employeePortalRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as db from "../database/pg.js";
import { jwtSecret } from "../config/jwtConfig.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

// Shift ends 18:00 — same rule as workAccountabilityDailyLog.js. No OT
// rate exists anywhere in the codebase (confirmed by investigation), so
// ot_amount always stays 0 until a rate is provided.
const SHIFT_END_MINUTES = 18 * 60;
const computeOtHours = (checkOutTime) => {
    if (!checkOutTime) return 0;
    const [h, m] = checkOutTime.split(":").map(Number);
    const minutes = h * 60 + (m || 0);
    return minutes <= SHIFT_END_MINUTES ? 0 : Number(((minutes - SHIFT_END_MINUTES) / 60).toFixed(2));
};

/**
 * 1. EMPLOYEE LOGIN
 * Credentials: username, password (hashed in DB)
 */
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await db.pgGet(`
            SELECT u.*, e.name, e.designation, e.salary as base_salary, e.company_id, c.company_name
            FROM users u
            JOIN employees e ON u.employee_id = e.id
            JOIN companies c ON e.company_id = c.id
            WHERE u.username = $1 AND u.employee_id IS NOT NULL
        `, [username]);

        if (!user) {
            return res.status(401).json({ error: "Invalid credentials or not an employee account" });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Generate Token
        const token = jwt.sign(
            { 
                userId: user.id, 
                employeeId: user.employee_id, 
                companyId: user.company_id,
                role: 'employee' 
            },
            jwtSecret,
            { expiresIn: "24h" }
        );

        res.json({
            token,
            employee: {
                id: user.employee_id,
                name: user.name,
                username: user.username,
                designation: user.designation,
                company: user.company_name
            }
        });
    } catch (err) {
        console.error("Employee Portal Login Error:", err);
        res.status(500).json({ error: "Login failed" });
    }
});

/**
 * AUTH MIDDLEWARE FOR EMPLOYEE PORTAL
 */
const employeeAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.employee = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
};

/**
 * 2. EMPLOYEE DASHBOARD DATA
 */
router.get("/dashboard", employeeAuth, async (req, res) => {
    const employeeId = req.employee.employeeId;

    try {
        // PROFILE & CURRENT SALARY
        // employees.salary only holds a rate for salary_type='monthly' — daily/weekly
        // workers store their rate in daily_rate/weekly_rate instead (employeeRoutes.js).
        const profile = await db.pgGet(`
            SELECT name, designation, salary_type,
                CASE LOWER(COALESCE(salary_type,'monthly'))
                    WHEN 'daily' THEN daily_rate
                    WHEN 'weekly' THEN weekly_rate
                    ELSE salary
                END AS base_salary
            FROM employees WHERE id = $1
        `, [employeeId]);

        // SALARY SUMMARY — daily-wage workers are paid via /hr/salary/daily/process,
        // which writes to daily_salary_payments, never the salaries table (that's
        // only populated by the monthly payroll run). Same gap class as the advance
        // balance bug: reading the wrong table returns "no record" for every
        // daily-wage employee even though they're being paid.
        const salaryType = (profile?.salary_type || "monthly").toLowerCase();
        let salaries = [];
        let currentMonthSalary = null;

        if (salaryType === "daily" || salaryType === "weekly") {
            const monthPayments = await db.pgAll(`
                SELECT payment_date, daily_wage AS net_pay, gross_wage, deduction
                FROM daily_salary_payments
                WHERE employee_id = $1 AND company_id = $2
                  AND to_char(payment_date, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')
                ORDER BY payment_date DESC
            `, [employeeId, req.employee.companyId]);
            if (monthPayments.length > 0) {
                const monthTotal = monthPayments.reduce((s, p) => s + Number(p.net_pay || 0), 0);
                const monthDeductions = monthPayments.reduce((s, p) => s + Number(p.deduction || 0), 0);
                currentMonthSalary = {
                    final_salary: monthTotal,
                    bonus: 0,
                    deductions: monthDeductions,
                    created_at: monthPayments[0].payment_date,
                };
            }
            salaries = monthPayments;
        } else {
            salaries = await db.pgAll(`
                SELECT * FROM salaries
                WHERE employee_id = $1
                ORDER BY created_at DESC LIMIT 6
            `, [employeeId]);
            currentMonthSalary = salaries[0] || null;
        }

        // PAYMENTS HISTORY
        const payments = await db.pgAll(`
            SELECT * FROM salary_payments 
            WHERE employee_id = $1 
            ORDER BY date DESC LIMIT 10
        `, [employeeId]);

        // ADVANCE SUMMARY
        // Total Advance Taken
        const advanceTaken = await db.pgGet(`
            SELECT SUM(amount) as total FROM salary_advances
            WHERE employee_id = $1
        `, [employeeId]);

        // Outstanding balance — same source of truth as the admin ledger
        // (hrRoutes.js /ledger/:employeeId): salary_advances.current_balance,
        // kept live by both payroll deductions AND daily-wage deductions
        // (advance_repayments). Summing salaries.advance_deducted here missed
        // daily-wage workers entirely, since their repayments never touch
        // the salaries table.
        const advanceRemaining = await db.pgGet(`
            SELECT SUM(COALESCE(current_balance, amount)) as total FROM salary_advances
            WHERE employee_id = $1 AND COALESCE(status,'ACTIVE') != 'RECOVERED'
        `, [employeeId]);

        const totalTaken = Number(advanceTaken?.total || 0);
        const remaining = Number(advanceRemaining?.total || 0);

        // ATTENDANCE STATS
        const attendanceCount = await db.pgGet(`
            SELECT COUNT(*) as present_days 
            FROM attendance_logs 
            WHERE employee_id = $1 
            AND to_char(date, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')
        `, [employeeId]);

        const presentDays = Number(attendanceCount?.present_days || 0);
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        // Assuming Sundays are off (roughly 4-5 days), working days ~ 25-26
        const workingDaysSoFar = Math.min(new Date().getDate(), 26); 
        const attendancePercent = workingDaysSoFar > 0 ? (presentDays / workingDaysSoFar) * 100 : 0;

        res.json({
            profile,
            salarySummary: {
                currentMonth: currentMonthSalary,
                history: salaries
            },
            stats: {
                attendancePercent: Math.round(attendancePercent),
                presentDays: presentDays
            },
            advanceSummary: {
                totalTaken: totalTaken,
                remaining: remaining
            },
            paymentHistory: payments
        });
    } catch (err) {
        console.error("Employee Dashboard Error:", err);
        res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
});

/**
 * ============================================================
 * GROUPS & GROUP ATTENDANCE — additive extension.
 * Reuses the existing employee_groups/group_members/group_attendance/
 * employee_attendance_summary tables (built earlier for Work
 * Accountability), addressed via the portal employee's linked
 * `users.id` (req.employee.userId), NOT attendance_logs. No new
 * tables, no existing table altered.
 * ============================================================
 */

router.get("/my-groups", employeeAuth, async (req, res) => {
    try {
        const today = new Date().toISOString().split("T")[0];
        const rows = await db.pgAll(
            `SELECT
                eg.id AS group_id,
                eg.name AS group_name,
                (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = eg.id AND gm2.is_active = true) AS member_count,
                ga.id AS attendance_id,
                ga.status,
                ga.marked_at,
                u.username AS marked_by_name
             FROM employee_groups eg
             JOIN group_members gm ON gm.group_id = eg.id AND gm.employee_id = $2 AND gm.is_active = true
             LEFT JOIN group_attendance ga ON ga.group_id = eg.id AND ga.attendance_date = $3
             LEFT JOIN users u ON u.id = ga.marked_by
             WHERE eg.company_id = $1 AND eg.is_active = true
             ORDER BY eg.name`,
            [req.employee.companyId, req.employee.userId, today]
        );
        res.json(rows);
    } catch (e) {
        console.error("portal my-groups error:", e.message);
        res.json([]);
    }
});

router.post("/mark-attendance", employeeAuth, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query("BEGIN");
        const { group_id, status, notes } = req.body;

        if (!group_id) throw new Error("Group required");
        if (!status || !["present", "absent", "half_day", "on_leave"].includes(status)) {
            throw new Error("Status required — present, absent, half_day or on_leave");
        }

        const member = await client.query(
            `SELECT id FROM group_members WHERE group_id = $1 AND employee_id = $2 AND is_active = true`,
            [group_id, req.employee.userId]
        );
        if (member.rows.length === 0) throw new Error("You are not a member of this group");

        const today = new Date().toISOString().split("T")[0];
        const existing = await client.query(
            `SELECT id, status FROM group_attendance WHERE group_id = $1 AND attendance_date = $2`,
            [group_id, today]
        );
        if (existing.rows.length > 0) {
            throw new Error(`Attendance already marked as ${existing.rows[0].status} for today.`);
        }

        const result = await client.query(
            `INSERT INTO group_attendance (company_id, group_id, attendance_date, status, marked_by, marked_at, notes)
             VALUES ($1,$2,$3,$4,$5,NOW(),$6) RETURNING *`,
            [req.employee.companyId, group_id, today, status, req.employee.userId, notes || null]
        );

        const members = await client.query(
            `SELECT employee_id FROM group_members WHERE group_id = $1 AND is_active = true`,
            [group_id]
        );
        const month = today.substring(0, 7);
        for (const m of members.rows) {
            await client.query(
                `INSERT INTO employee_attendance_summary
                    (company_id, employee_id, group_id, attendance_month, total_days, present_days, absent_days, half_days, leave_days)
                 VALUES ($1,$2,$3,$4,1,
                    CASE WHEN $5='present' THEN 1 ELSE 0 END,
                    CASE WHEN $5='absent' THEN 1 ELSE 0 END,
                    CASE WHEN $5='half_day' THEN 1 ELSE 0 END,
                    CASE WHEN $5='on_leave' THEN 1 ELSE 0 END)
                 ON CONFLICT (employee_id, group_id, attendance_month)
                 DO UPDATE SET
                    total_days = employee_attendance_summary.total_days + 1,
                    present_days = employee_attendance_summary.present_days + CASE WHEN $5='present' THEN 1 ELSE 0 END,
                    absent_days = employee_attendance_summary.absent_days + CASE WHEN $5='absent' THEN 1 ELSE 0 END,
                    half_days = employee_attendance_summary.half_days + CASE WHEN $5='half_day' THEN 1 ELSE 0 END,
                    leave_days = employee_attendance_summary.leave_days + CASE WHEN $5='on_leave' THEN 1 ELSE 0 END,
                    updated_at = NOW()`,
                [req.employee.companyId, m.employee_id, group_id, month, status]
            );
        }

        await client.query("COMMIT");
        res.json({ success: true, attendance: result.rows[0], members_marked: members.rows.length });
    } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        res.json({ success: false, error: e.message });
    } finally {
        client.release();
    }
});

router.get("/my-attendance", employeeAuth, async (req, res) => {
    try {
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const daily = await db.pgAll(
            `SELECT ga.attendance_date, ga.status, ga.notes, eg.name AS group_name, u.username AS marked_by_name
             FROM group_attendance ga
             JOIN group_members gm ON gm.group_id = ga.group_id AND gm.employee_id = $1 AND gm.is_active = true
             JOIN employee_groups eg ON eg.id = ga.group_id
             LEFT JOIN users u ON u.id = ga.marked_by
             WHERE TO_CHAR(ga.attendance_date, 'YYYY-MM') = $2 AND ga.company_id = $3
             ORDER BY ga.attendance_date DESC`,
            [req.employee.userId, month, req.employee.companyId]
        );
        const monthSummary = await db.pgGet(
            `SELECT COALESCE(SUM(total_days),0) AS total_days, COALESCE(SUM(present_days),0) AS present_days,
                    COALESCE(SUM(absent_days),0) AS absent_days, COALESCE(SUM(half_days),0) AS half_days, COALESCE(SUM(leave_days),0) AS leave_days
             FROM employee_attendance_summary WHERE employee_id = $1 AND company_id = $2 AND attendance_month = $3`,
            [req.employee.userId, req.employee.companyId, month]
        );
        const allTime = await db.pgGet(
            `SELECT COALESCE(SUM(total_days),0) AS total_days, COALESCE(SUM(present_days),0) AS present_days, COALESCE(SUM(absent_days),0) AS absent_days
             FROM employee_attendance_summary WHERE employee_id = $1 AND company_id = $2`,
            [req.employee.userId, req.employee.companyId]
        );
        res.json({ month, daily_records: daily, month_summary: monthSummary || {}, all_time_summary: allTime || {} });
    } catch (e) {
        console.error("portal my-attendance error:", e.message);
        res.json({ daily_records: [], month_summary: {}, all_time_summary: {} });
    }
});

/**
 * ============================================================
 * MY ADVANCES — read-only ledger for the logged-in employee,
 * sourced from the existing salary_advances table (keyed to
 * employees.id, which req.employee.employeeId already is).
 * ============================================================
 */
router.get("/my-advances", employeeAuth, async (req, res) => {
    try {
        const advances = await db.pgAll(
            `SELECT id, amount, advance_date, reason, repayment_type, installment_amount, current_balance, status, created_at
             FROM salary_advances WHERE employee_id = $1 AND company_id = $2 ORDER BY advance_date DESC`,
            [req.employee.employeeId, req.employee.companyId]
        );
        const totals = advances.reduce(
            (acc, a) => ({
                total_given: acc.total_given + Number(a.amount || 0),
                total_outstanding: acc.total_outstanding + Number(a.current_balance || 0),
            }),
            { total_given: 0, total_outstanding: 0 }
        );
        res.json({ advances, summary: totals });
    } catch (e) {
        console.error("portal my-advances error:", e.message);
        res.json({ advances: [], summary: {} });
    }
});

/**
 * ============================================================
 * MY JOBS & DAILY LOGS — corrected permission model: the employee
 * (not admin) records reached/check-in/check-out and EOD product
 * counts for jobs assigned to their own group(s). Admin's role is
 * limited to allotting jobs to groups (workAccountabilityDailyLog.js)
 * and confirming the submitted report. Reuses the same
 * work_job_groups/work_daily_logs/work_daily_log_items tables via
 * req.employee.userId (== users.id, the group_members.employee_id
 * FK target) — no new tables, no existing table altered.
 * ============================================================
 */

// Jobs assigned to any group this employee is an active member of,
// with today's log status for each.
router.get("/my-jobs", employeeAuth, async (req, res) => {
    try {
        const today = new Date().toISOString().split("T")[0];
        const rows = await db.pgAll(
            `SELECT j.id AS job_id, j.title, j.status AS job_status, eg.id AS group_id, eg.name AS group_name,
                    wdl.id AS today_log_id, wdl.reached_status AS today_reached_status,
                    wdl.admin_confirmed AS today_confirmed,
                    sdt.mistake_pcs_allowed
             FROM group_members gm
             JOIN employee_groups eg ON eg.id = gm.group_id AND gm.employee_id = $1 AND gm.is_active = true
             JOIN work_job_groups wjg ON wjg.group_id = eg.id AND wjg.is_active = true
             JOIN jobs j ON j.id = wjg.job_id AND j.company_id = $2
             LEFT JOIN work_daily_logs wdl ON wdl.job_id = j.id AND wdl.group_id = eg.id AND wdl.log_date = $3
             LEFT JOIN work_job_details wjd ON wjd.job_id = j.id
             LEFT JOIN supplier_deal_terms sdt ON sdt.supplier_id = wjd.supplier_id
             WHERE eg.company_id = $2
             ORDER BY j.title, eg.name`,
            [req.employee.userId, req.employee.companyId, today]
        );
        res.json(rows);
    } catch (e) {
        console.error("portal my-jobs error:", e.message);
        res.json([]);
    }
});

// Minimal, read-only product list for the EOD item dropdown — GET
// /api/products requires the admin auth scheme (authMiddleware) and
// can't be reached with an employee-portal token, so this proxies the
// same products table with just the fields the form needs.
router.get("/products-lite", employeeAuth, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT id, name, pieces_per_bundle FROM products
             WHERE company_id = $1 AND is_active = 1 AND is_deleted = false
             ORDER BY name`,
            [req.employee.companyId]
        );
        res.json(rows);
    } catch (e) {
        console.error("portal products-lite error:", e.message);
        res.json([]);
    }
});

// Create today's (or a given date's) daily log for one of the employee's
// own job+group assignments. Ownership is enforced via group_members,
// not a trusted client-supplied group_id.
router.post("/my-daily-logs", employeeAuth, async (req, res) => {
    try {
        const { job_id, group_id, log_date, reached_status, check_in_time, check_out_time, notes } = req.body;
        if (!job_id || !group_id || !log_date || !reached_status) {
            return res.json({ success: false, error: "job_id, group_id, log_date and reached_status are required" });
        }
        if (!["yes", "no", "partial"].includes(reached_status)) {
            return res.json({ success: false, error: "reached_status must be yes, no or partial" });
        }

        const membership = await db.pgGet(
            `SELECT id FROM group_members WHERE group_id = $1 AND employee_id = $2 AND is_active = true`,
            [group_id, req.employee.userId]
        );
        if (!membership) return res.json({ success: false, error: "You are not a member of this group" });

        const assigned = await db.pgGet(
            `SELECT id FROM work_job_groups WHERE job_id = $1 AND group_id = $2 AND company_id = $3 AND is_active = true`,
            [job_id, group_id, req.employee.companyId]
        );
        if (!assigned) return res.json({ success: false, error: "This group is not assigned to this job" });

        const members = await db.pgAll(`SELECT employee_id FROM group_members WHERE group_id = $1 AND is_active = true`, [group_id]);
        const memberSnapshot = members.map((m) => m.employee_id);
        const otHours = computeOtHours(check_out_time);

        const result = await db.pgRun(
            `INSERT INTO work_daily_logs
                (company_id, job_id, group_id, log_date, marked_by_user_id, reached_status,
                 check_in_time, check_out_time, ot_hours, ot_amount, member_snapshot, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11)
             RETURNING *`,
            [req.employee.companyId, job_id, group_id, log_date, req.employee.userId, reached_status, check_in_time || null, check_out_time || null, otHours, JSON.stringify(memberSnapshot), notes || null]
        );
        res.json({ success: true, log: result.rows[0], member_count: memberSnapshot.length });
    } catch (e) {
        if (e.message?.includes("duplicate key")) return res.json({ success: false, error: "A log already exists for this job, group and date." });
        console.error("portal daily log create error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// Employee's own log detail + items + supplier deal term (for the
// mistake-pcs warning), ownership-checked.
router.get("/my-daily-logs/:id", employeeAuth, async (req, res) => {
    try {
        const log = await db.pgGet(
            `SELECT wdl.*, eg.name AS group_name, j.title AS job_title
             FROM work_daily_logs wdl
             JOIN employee_groups eg ON eg.id = wdl.group_id
             JOIN jobs j ON j.id = wdl.job_id
             WHERE wdl.id = $1 AND wdl.company_id = $2 AND wdl.marked_by_user_id = $3`,
            [req.params.id, req.employee.companyId, req.employee.userId]
        );
        if (!log) return res.status(404).json({ error: "Log not found" });

        const items = await db.pgAll(`SELECT * FROM work_daily_log_items WHERE daily_log_id = $1 ORDER BY sort_order, id`, [log.id]);
        const supplier = await db.pgGet(
            `SELECT wjd.supplier_id, s.name AS supplier_name, sdt.mistake_pcs_allowed, sdt.fresh_only_strict
             FROM work_job_details wjd
             LEFT JOIN suppliers s ON s.id = wjd.supplier_id
             LEFT JOIN supplier_deal_terms sdt ON sdt.supplier_id = wjd.supplier_id
             WHERE wjd.job_id = $1`,
            [log.job_id]
        );
        res.json({ log, items, supplier: supplier || null });
    } catch (e) {
        console.error("portal daily log detail error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// Replaces all product line items for the employee's own log (upsert:
// delete then insert). Blocked once admin has confirmed the report.
router.post("/my-daily-logs/:id/items", employeeAuth, async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query("BEGIN");
        const { items } = req.body;
        if (!Array.isArray(items)) throw new Error("items array required");

        const log = await client.query(
            `SELECT * FROM work_daily_logs WHERE id = $1 AND company_id = $2 AND marked_by_user_id = $3`,
            [req.params.id, req.employee.companyId, req.employee.userId]
        );
        if (!log.rows[0]) throw new Error("Log not found");
        if (log.rows[0].admin_confirmed) throw new Error("This log is already confirmed — items can no longer be edited");

        await client.query(`DELETE FROM work_daily_log_items WHERE daily_log_id = $1`, [req.params.id]);

        let totalFresh = 0, totalMistake = 0;
        let sortOrder = 0;
        for (const item of items) {
            await client.query(
                `INSERT INTO work_daily_log_items (daily_log_id, product_id, product_name_snapshot, bundle_count, pcs_per_bundle, fresh_pcs, mistake_pcs, mistake_pcs_note, sort_order)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [req.params.id, item.product_id || null, item.product_name_snapshot, Number(item.bundle_count) || 0, Number(item.pcs_per_bundle) || 0, Number(item.fresh_pcs) || 0, Number(item.mistake_pcs) || 0, item.mistake_pcs_note || null, sortOrder++]
            );
            totalFresh += Number(item.fresh_pcs) || 0;
            totalMistake += Number(item.mistake_pcs) || 0;
        }

        await client.query(`UPDATE work_daily_logs SET fresh_pcs = $1, mistake_pcs = $2, updated_at = NOW() WHERE id = $3`, [totalFresh, totalMistake, req.params.id]);

        const jobDetails = await client.query(
            `SELECT sdt.mistake_pcs_allowed FROM work_job_details wjd
             LEFT JOIN supplier_deal_terms sdt ON sdt.supplier_id = wjd.supplier_id
             WHERE wjd.job_id = $1`,
            [log.rows[0].job_id]
        );
        const mistakeAllowed = jobDetails.rows[0]?.mistake_pcs_allowed ?? false;
        const warning = !mistakeAllowed && totalMistake > 0
            ? "This supplier's deal terms are Fresh Only — mistake pcs were recorded but won't count toward the converted purchase quantity."
            : null;

        await client.query("COMMIT");
        res.json({ success: true, item_count: items.length, total_fresh: totalFresh, total_mistake: totalMistake, warning });
    } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        res.json({ success: false, error: e.message });
    } finally {
        client.release();
    }
});

/**
 * ============================================================
 * ADMIN — head-office control. Uses the MAIN erp-token/authMiddleware
 * (admin is logged into the regular ERP, not the employee portal).
 * ============================================================
 */
const requirePortalAdmin = (req, res, next) => {
    if (!["admin", "superadmin"].includes((req.user?.role || "").toLowerCase())) {
        return res.status(403).json({ error: "Admin only" });
    }
    next();
};

// List employees who already have a portal login (users.employee_id IS NOT NULL)
router.get("/admin/portal-employees", authMiddleware, requirePortalAdmin, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT u.id AS user_id, u.username, u.role, u.is_active, e.id AS employee_id, e.name, e.designation, e.phone,
                    COALESCE((SELECT SUM(current_balance) FROM salary_advances sa WHERE sa.employee_id = e.id AND sa.status = 'ACTIVE'), 0) AS outstanding_advance
             FROM users u
             JOIN employees e ON e.id = u.employee_id
             WHERE e.company_id = $1
             ORDER BY e.name`,
            [req.user.active_company_id]
        );
        res.json(rows);
    } catch (e) {
        console.error("admin portal-employees error:", e.message);
        res.json([]);
    }
});

// Portal-employees who are on duty TODAY, per the existing attendance_logs
// table (status IN PRESENT/OD/HALF_DAY — the same set Attendance.tsx's own
// "present" count already uses, and the exact table that page actually
// writes to via /hr/attendance/manual — NOT the separate, unused
// `attendance` table this query originally and incorrectly joined).
// Employees with no attendance_logs row marked yet today are excluded
// (not yet confirmed present). Today's date is computed the same way the
// frontend computes it (UTC-based toISOString) and passed as a parameter,
// rather than trusting Postgres's CURRENT_DATE, so the two can never
// disagree over timezone. Read-only; attendance_logs is never written
// to here.
router.get("/admin/on-duty-employees", authMiddleware, requirePortalAdmin, async (req, res) => {
    try {
        const today = new Date().toISOString().split("T")[0];
        const rows = await db.pgAll(
            `SELECT u.id, u.username, u.role, a.status AS attendance_status
             FROM users u
             JOIN employees e ON e.id = u.employee_id
             JOIN attendance_logs a ON a.employee_id = e.id AND a.date = $2
             WHERE e.company_id = $1 AND a.status IN ('PRESENT', 'OD', 'HALF_DAY')
             ORDER BY u.username`,
            [req.user.active_company_id, today]
        );
        res.json(rows);
    } catch (e) {
        console.error("admin on-duty-employees error:", e.message);
        res.json([]);
    }
});

// Employees who exist in `employees` but don't have a portal login yet
router.get("/admin/unlinked-employees", authMiddleware, requirePortalAdmin, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT e.id, e.name, e.designation, e.phone
             FROM employees e
             WHERE e.company_id = $1 AND NOT EXISTS (SELECT 1 FROM users u WHERE u.employee_id = e.id)
             ORDER BY e.name`,
            [req.user.active_company_id]
        );
        res.json(rows);
    } catch (e) {
        console.error("admin unlinked-employees error:", e.message);
        res.json([]);
    }
});

// Create a portal login for an existing employees row
router.post("/admin/create-login", authMiddleware, requirePortalAdmin, async (req, res) => {
    try {
        const { employee_id, username, password, role } = req.body;
        if (!employee_id || !username || !password) {
            return res.json({ success: false, error: "employee_id, username and password are required" });
        }

        const employee = await db.pgGet(`SELECT * FROM employees WHERE id = $1 AND company_id = $2`, [employee_id, req.user.active_company_id]);
        if (!employee) return res.json({ success: false, error: "Employee not found" });

        const already = await db.pgGet(`SELECT id FROM users WHERE employee_id = $1`, [employee_id]);
        if (already) return res.json({ success: false, error: "This employee already has a login" });

        const taken = await db.pgGet(`SELECT id FROM users WHERE username = $1`, [username]);
        if (taken) return res.json({ success: false, error: "Username already taken" });

        const hash = await bcrypt.hash(password, 10);
        const result = await db.pgRun(
            `INSERT INTO users (company_id, branch_id, active_company_id, username, email, password_hash, role, employee_id, is_active)
             VALUES ($1,$2,$1,$3,$4,$5,$6,$7,true) RETURNING id, username, role`,
            [req.user.active_company_id, employee.branch_id || null, username, employee.email || null, hash, role || "field_employee", employee_id]
        );

        res.json({ success: true, user: result.rows[0] });
    } catch (e) {
        console.error("admin create-login error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// Bulk-create a portal login for every employee who doesn't have one yet.
// Username is name+employeeId (guaranteed unique even for duplicate names).
// Email is {name}@jbs.com and password is the employee's own name, per
// explicit choice for this tenant's internal daily-wage-staff system —
// credentials are returned once in the response for the admin to
// distribute; they are never logged or stored anywhere in plain text.
const slugifyUsername = (name, employeeId) => {
    const base = (name || "employee").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "employee";
    return `${base}${employeeId}`;
};

const slugifyEmailLocalPart = (name) => (name || "employee").toLowerCase().replace(/[^a-z0-9]/g, "") || "employee";

router.post("/admin/create-logins-bulk", authMiddleware, requirePortalAdmin, async (req, res) => {
    try {
        const unlinked = await db.pgAll(
            `SELECT e.* FROM employees e
             WHERE e.company_id = $1 AND NOT EXISTS (SELECT 1 FROM users u WHERE u.employee_id = e.id)
             ORDER BY e.name`,
            [req.user.active_company_id]
        );

        if (unlinked.length === 0) {
            return res.json({ success: true, created: [], message: "Every employee already has a login." });
        }

        const created = [];
        const failed = [];
        for (const employee of unlinked) {
            try {
                const username = slugifyUsername(employee.name, employee.id);
                const taken = await db.pgGet(`SELECT id FROM users WHERE username = $1`, [username]);
                if (taken) { failed.push({ name: employee.name, error: "username collision" }); continue; }

                const password = (employee.name || "").trim();
                if (!password) { failed.push({ name: employee.name, error: "employee has no name to use as password" }); continue; }
                const email = `${slugifyEmailLocalPart(employee.name)}@jbs.com`;
                const hash = await bcrypt.hash(password, 10);
                const result = await db.pgRun(
                    `INSERT INTO users (company_id, branch_id, active_company_id, username, email, password_hash, role, employee_id, is_active)
                     VALUES ($1,$2,$1,$3,$4,$5,'field_employee',$6,true) RETURNING id, username, email`,
                    [req.user.active_company_id, employee.branch_id || null, username, email, hash, employee.id]
                );
                created.push({ employee_id: employee.id, employee_name: employee.name, user_id: result.rows[0].id, username: result.rows[0].username, email: result.rows[0].email, password });
            } catch (innerErr) {
                failed.push({ name: employee.name, error: innerErr.message });
            }
        }

        res.json({ success: true, created, failed, message: `Created ${created.length} login${created.length === 1 ? "" : "s"}${failed.length ? `, ${failed.length} failed` : ""}.` });
    } catch (e) {
        console.error("admin bulk create-login error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// Give a salary advance — writes to the existing salary_advances table
router.post("/admin/advances", authMiddleware, requirePortalAdmin, async (req, res) => {
    try {
        const { employee_id, amount, reason, advance_date, repayment_type } = req.body;
        if (!employee_id || !amount || !reason) {
            return res.json({ success: false, error: "employee_id, amount and reason are required" });
        }
        if (parseFloat(amount) <= 0) return res.json({ success: false, error: "Amount must be greater than zero" });

        const employee = await db.pgGet(`SELECT id, branch_id FROM employees WHERE id = $1 AND company_id = $2`, [employee_id, req.user.active_company_id]);
        if (!employee) return res.json({ success: false, error: "Employee not found" });

        const result = await db.pgRun(
            `INSERT INTO salary_advances (company_id, branch_id, employee_id, amount, advance_date, reason, repayment_type, current_balance, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$4,'ACTIVE') RETURNING *`,
            [req.user.active_company_id, employee.branch_id || null, employee_id, parseFloat(amount), advance_date || new Date().toISOString().split("T")[0], reason, repayment_type || "salary_deduction"]
        );
        res.json({ success: true, advance: result.rows[0] });
    } catch (e) {
        console.error("admin give-advance error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

// List all advances (admin overview)
router.get("/admin/advances", authMiddleware, requirePortalAdmin, async (req, res) => {
    try {
        const rows = await db.pgAll(
            `SELECT sa.*, e.name AS employee_name FROM salary_advances sa
             JOIN employees e ON e.id = sa.employee_id
             WHERE sa.company_id = $1 ORDER BY sa.advance_date DESC`,
            [req.user.active_company_id]
        );
        res.json(rows);
    } catch (e) {
        console.error("admin advances list error:", e.message);
        res.json([]);
    }
});

// Record a repayment against an advance — decrements current_balance directly
// (avoids writing to advance_repayments, whose full column set is unverified)
router.post("/admin/advances/:id/repay", authMiddleware, requirePortalAdmin, async (req, res) => {
    try {
        const { amount } = req.body;
        const repaid = parseFloat(amount);
        if (!repaid || repaid <= 0) return res.json({ success: false, error: "Valid repayment amount required" });

        const advance = await db.pgGet(`SELECT * FROM salary_advances WHERE id = $1 AND company_id = $2`, [req.params.id, req.user.active_company_id]);
        if (!advance) return res.json({ success: false, error: "Advance not found" });

        const newBalance = Math.max(0, Number(advance.current_balance || 0) - repaid);
        const newStatus = newBalance <= 0 ? "CLOSED" : "ACTIVE";

        await db.pgRun(`UPDATE salary_advances SET current_balance = $1, status = $2 WHERE id = $3`, [newBalance, newStatus, req.params.id]);
        res.json({ success: true, new_balance: newBalance, status: newStatus });
    } catch (e) {
        console.error("admin repay-advance error:", e.message);
        res.json({ success: false, error: e.message });
    }
});

export default router;
