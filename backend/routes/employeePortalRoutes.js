// backend/routes/employeePortalRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as db from "../database/pg.js";
import { jwtSecret } from "../config/jwtConfig.js";

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

export default router;
