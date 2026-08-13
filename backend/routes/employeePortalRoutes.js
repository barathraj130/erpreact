// backend/routes/employeePortalRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as db from "../database/pg.js";
import { jwtSecret } from "../config/jwtConfig.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

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
        const profile = await db.pgGet(`
            SELECT name, designation, salary as base_salary 
            FROM employees WHERE id = $1
        `, [employeeId]);

        // SALARY SUMMARY
        const salaries = await db.pgAll(`
            SELECT * FROM salaries 
            WHERE employee_id = $1 
            ORDER BY created_at DESC LIMIT 6
        `, [employeeId]);

        const currentMonthSalary = salaries[0] || null;
        
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

        // Total Advance Deducted (from salary payments)
        const advanceDeducted = await db.pgGet(`
            SELECT SUM(advance_deducted) as total FROM salaries 
            WHERE employee_id = $1
        `, [employeeId]);

        const totalTaken = Number(advanceTaken?.total || 0);
        const totalDeducted = Number(advanceDeducted?.total || 0);

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
                remaining: totalTaken - totalDeducted
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
