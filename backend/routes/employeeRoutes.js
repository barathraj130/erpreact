// backend/routes/employeeRoutes.js
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

// GET EMPLOYEES WITHOUT LOGIN ACCOUNT
router.get("/unlinked", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT e.id, e.name, e.email, e.designation 
            FROM employees e
            LEFT JOIN users u ON e.id = u.employee_id
            WHERE e.company_id = $1 AND u.id IS NULL
            ORDER BY e.name ASC
        `;
        const result = await db.pgAll(sql, [companyId]);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch unlinked employees" });
    }
});

// GET ALL EMPLOYEES WITH STATS
router.get("/", authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const sql = `
            SELECT 
                e.*,
                u.username as portal_username,
                COALESCE(sa.balance, 0) as advance_balance,
                COALESCE(att.days_present, 0) as days_present
            FROM employees e
            LEFT JOIN users u ON e.id = u.employee_id
            LEFT JOIN (
                SELECT employee_id, SUM(current_balance) as balance 
                FROM salary_advances 
                WHERE status = 'ACTIVE' 
                GROUP BY employee_id
            ) sa ON e.id = sa.employee_id
            LEFT JOIN (
                SELECT employee_id, COUNT(*) as days_present
                FROM attendance_logs
                WHERE to_char(date, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')
                GROUP BY employee_id
            ) att ON e.id = att.employee_id
            WHERE e.company_id = $1 
            ORDER BY e.name ASC
        `;
        const result = await db.pgAll(sql, [companyId]);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch employees" });
    }
});

// CREATE EMPLOYEE
router.post("/", authMiddleware, async (req, res) => {
    // ✅ Added salary_type
    const { name, designation, email, phone, salary, salary_type, joining_date, status } = req.body;
    const companyId = req.user.active_company_id;

    try {
        const sql = `
            INSERT INTO employees (company_id, name, designation, email, phone, salary, salary_type, joining_date, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `;
        const result = await db.pgRun(sql, [
            companyId, name, designation, email, phone, 
            salary || 0, salary_type || 'Monthly', joining_date || new Date(), status || 'Active'
        ]);
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create employee" });
    }
});

// UPDATE EMPLOYEE
router.put("/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    // ✅ Added salary_type
    const { name, designation, email, phone, salary, salary_type, joining_date, status } = req.body;
    const companyId = req.user.active_company_id;

    try {
        const sql = `
            UPDATE employees 
            SET name=$1, designation=$2, email=$3, phone=$4, salary=$5, salary_type=$6, joining_date=$7, status=$8
            WHERE id=$9 AND company_id=$10
        `;
        await db.pgRun(sql, [
            name, designation, email, phone, salary, salary_type, joining_date, status, id, companyId
        ]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update employee" });
    }
});

// DELETE EMPLOYEE
router.delete("/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.active_company_id;

    try {
        await db.pgRun("DELETE FROM employees WHERE id=$1 AND company_id=$2", [id, companyId]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete employee" });
    }
});

export default router;