// backend/routes/payrollRoutes.js
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

/**
 * 1. PROCESS SALARY
 * Handles calculation, payment, ledger impact and expense recording.
 */
router.post("/process-salary", authMiddleware, async (req, res) => {
    const { employee_id, month, bonus, deductions, advance_deducted, mode, transaction_id, bank_name, date } = req.body;
    const companyId = req.user.active_company_id;
    const branchId = req.headers['x-branch-id'] || req.user.branch_id;

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Fetch employee base salary
        const emp = await client.query("SELECT salary, name FROM employees WHERE id = $1", [employee_id]);
        if (emp.rowCount === 0) throw new Error("Employee not found");
        const baseSalary = Number(emp.rows[0].salary);

        // Calculate Final Salary
        const finalSalary = baseSalary + Number(bonus || 0) - Number(deductions || 0) - Number(advance_deducted || 0);

        // 1. Record Salary
        const salaryInsert = await client.query(`
            INSERT INTO salaries (employee_id, month, base_salary, bonus, deductions, advance_deducted, final_salary, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'PAID')
            RETURNING id
        `, [employee_id, month, baseSalary, bonus || 0, deductions || 0, advance_deducted || 0, finalSalary]);
        
        const salaryId = salaryInsert.rows[0].id;

        // 2. Record Payment
        await client.query(`
            INSERT INTO salary_payments (employee_id, salary_id, amount, mode, transaction_id, bank_name, date)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [employee_id, salaryId, finalSalary, mode, transaction_id, bank_name, date || new Date()]);

        // 3. Financial Impact: Expense Module (Transactions table)
        const desc = `Salary payment for ${emp.rows[0].name} - ${month}`;
        await client.query(`
            INSERT INTO transactions (company_id, type, category, amount, date, description, created_at)
            VALUES ($1, 'PAYMENT', 'SALARY', $2, $3, $4, NOW())
        `, [companyId, finalSalary, date || new Date(), desc]);

        // 4. Financial Impact: Cash/Bank Ledger
        if (mode === 'Cash') {
            await client.query(`
                INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                VALUES ($1, $2, 'SALARY_PAYMENT', $3, 'out', $4)
            `, [companyId, branchId, finalSalary, date || new Date()]);
        } else if (mode === 'Bank') {
            await client.query(`
                INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date)
                VALUES ($1, $2, 'SALARY_PAYMENT', $3, 'out', $4, $5, $6)
            `, [companyId, branchId, finalSalary, bank_name, transaction_id, date || new Date()]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Salary processed and ledger updated" });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Salary Process Error:", err);
        res.status(500).json({ error: err.message || "Failed to process salary" });
    } finally {
        client.release();
    }
});

/**
 * 2. GIVE ADVANCE
 * Handles recording, ledger impact and expense recording.
 */
router.post("/give-advance", authMiddleware, async (req, res) => {
    const { employee_id, amount, date, note, mode, transaction_id, bank_name } = req.body;
    const companyId = req.user.active_company_id;
    const branchId = req.headers['x-branch-id'] || req.user.branch_id;

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const emp = await client.query("SELECT name FROM employees WHERE id = $1", [employee_id]);
        if (emp.rowCount === 0) throw new Error("Employee not found");

        // 1. Record Advance
        await client.query(`
            INSERT INTO salary_advances (company_id, branch_id, employee_id, amount, advance_date, reason, current_balance, status)
            VALUES ($1, $2, $3, $4, $5, $6, $4, 'ACTIVE')
        `, [companyId, branchId, employee_id, amount, date || new Date(), note]);

        // 2. Financial Impact: Expense Module
        const desc = `Salary Advance given to ${emp.rows[0].name}`;
        await client.query(`
            INSERT INTO transactions (company_id, type, category, amount, date, description, created_at)
            VALUES ($1, 'PAYMENT', 'ADVANCE', $2, $3, $4, NOW())
        `, [companyId, amount, date || new Date(), desc]);

        // 3. Financial Impact: Cash/Bank Ledger
        if (mode === 'Cash') {
            await client.query(`
                INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                VALUES ($1, $2, 'ADVANCE_PAYMENT', $3, 'out', $4)
            `, [companyId, branchId, amount, date || new Date()]);
        } else if (mode === 'Bank') {
            await client.query(`
                INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date)
                VALUES ($1, $2, 'ADVANCE_PAYMENT', $3, 'out', $4, $5, $6)
            `, [companyId, branchId, amount, bank_name, transaction_id, date || new Date()]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Advance given and ledger updated" });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Advance Give Error:", err);
        res.status(500).json({ error: err.message || "Failed to give advance" });
    } finally {
        client.release();
    }
});

export default router;
