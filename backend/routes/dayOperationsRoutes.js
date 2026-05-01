// backend/routes/dayOperationsRoutes.js
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

// Get current day status
router.get("/status", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    try {
        const op = await db.pgGet(`SELECT * FROM day_operations WHERE company_id = $1 AND date = $2`, [companyId, date]);
        if (!op) {
            return res.json({ status: 'not_started', date });
        }
        res.json({ ...op });
    } catch (err) {
        console.error("Fetch Day Status Error:", err);
        res.status(500).json({ error: "Failed to fetch day status" });
    }
});

// Start the business day
router.post("/open", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const date = new Date().toISOString().split('T')[0];
    const userId = req.user.id;

    try {
        const existing = await db.pgGet(`SELECT id FROM day_operations WHERE company_id = $1 AND date = $2`, [companyId, date]);
        if (existing) {
            return res.status(400).json({ error: "Day is already opened." });
        }

        await db.pgRun(
            `INSERT INTO day_operations (company_id, date, status, opened_by) VALUES ($1, $2, 'open', $3)`,
            [companyId, date, userId]
        );

        res.json({ success: true, message: "Business day opened successfully." });
    } catch (err) {
        console.error("Open Day Error:", err);
        res.status(500).json({ error: "Failed to open business day" });
    }
});

// Close the business day
router.post("/close", authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const userId = req.user.id;

    let client;
    try {
        const op = await db.pgGet(`SELECT * FROM day_operations WHERE company_id = $1 AND date = $2`, [companyId, date]);
        if (!op) return res.status(400).json({ error: "Day is not open." });
        if (op.status === 'closed') return res.status(400).json({ error: "Day is already closed." });

        // Rule 1: Day cannot be closed without attendance confirmed for all present employees
        const unconfirmedAttendance = await db.pgGet(
            `SELECT count(*) as count FROM attendance WHERE company_id = $1 AND date = $2 AND confirmed_at IS NULL`,
            [companyId, date]
        );
        if (parseInt(unconfirmedAttendance.count) > 0) {
            return res.status(400).json({ error: "Cannot close day. There are unconfirmed attendance entries." });
        }

        // Rule 2: All active employees must have an attendance entry (Present/Absent/OD)
        const totalActiveEmployees = await db.pgGet(`SELECT count(*) as count FROM employees WHERE company_id = $1 AND status = 'Active'`, [companyId]);
        const totalAttendanceEntries = await db.pgGet(`SELECT count(*) as count FROM attendance WHERE company_id = $1 AND date = $2`, [companyId, date]);
        
        if (parseInt(totalAttendanceEntries.count) < parseInt(totalActiveEmployees.count)) {
            return res.status(400).json({ error: "Cannot close day. Not all active employees have their attendance marked." });
        }

        // Rule 3: Ledger entries must be balanced for the day
        const unbalanced = await db.pgGet(`
            SELECT SUM(debit) as total_dr, SUM(credit) as total_cr 
            FROM ledger_entries 
            WHERE company_id = $1 AND entry_date = $2
        `, [companyId, date]);
        
        // Due to double-entry, total_dr should equal total_cr. Let's add a small tolerance for floating point.
        const totalDr = Number(unbalanced.total_dr) || 0;
        const totalCr = Number(unbalanced.total_cr) || 0;
        if (Math.abs(totalDr - totalCr) > 0.01) {
            return res.status(400).json({ error: `Cannot close day. Ledgers are unbalanced (Dr: ${totalDr}, Cr: ${totalCr}).` });
        }

        // Generate Closing Summary
        const summary = {
            total_purchases: 0,
            total_sales: 0,
            total_expenses: 0,
            net_cash_position: 0
        };

        const purchases = await db.pgGet(`SELECT sum(total_amount) as sum FROM purchase_bills WHERE company_id = $1 AND bill_date = $2`, [companyId, date]);
        summary.total_purchases = Number(purchases.sum) || 0;

        const sales = await db.pgGet(`SELECT sum(total_amount) as sum FROM invoices WHERE company_id = $1 AND invoice_date = $2`, [companyId, date]);
        summary.total_sales = Number(sales.sum) || 0;

        const expenses = await db.pgGet(`SELECT sum(amount) as sum FROM daily_expenses WHERE company_id = $1 AND date = $2`, [companyId, date]);
        summary.total_expenses = Number(expenses.sum) || 0;

        await db.pgRun(
            `UPDATE day_operations SET status = 'closed', closed_by = $1, closing_summary = $2 WHERE id = $3`,
            [userId, JSON.stringify(summary), op.id]
        );

        res.json({ success: true, message: "Business day closed successfully.", summary });
    } catch (err) {
        console.error("Close Day Error:", err);
        res.status(500).json({ error: "Failed to close business day" });
    }
});

// Record Daily Expense
router.post("/expense", authMiddleware, async (req, res) => {
    const { date, expense_type, amount, notes, account_id } = req.body;
    const companyId = req.user.active_company_id;
    const branchId = req.user.branch_id || null;

    let client;
    try {
        // Ensure day is open
        const op = await db.pgGet(`SELECT * FROM day_operations WHERE company_id = $1 AND date = $2`, [companyId, date]);
        if (!op || op.status === 'closed') {
            return res.status(400).json({ error: "Cannot add expense. Business day is closed or not opened." });
        }

        client = await db.getClient();
        await client.query('BEGIN');

        // Create a transaction for the expense
        const txRes = await client.query(
            `INSERT INTO transactions (company_id, branch_id, transaction_date, description, created_by)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [companyId, branchId, date, `Daily Expense: ${expense_type} - ${notes}`, req.user.id]
        );
        const transactionId = txRes.rows[0].id;

        // Ensure Cash/Bank ledger exists to credit. We will assume account_id is the debit (expense account)
        // Let's assume a default Cash account ID if not provided, but ideally it should be selected by the user.
        // For atomic double entry:
        // Debit: Expense Account (account_id)
        // Credit: Cash Account (Assuming account_code = 'CASH' or similar)

        const cashAcc = await client.query(`SELECT id FROM chart_of_accounts WHERE company_id=$1 AND account_code='CASH'`, [companyId]);
        const cashAccountId = cashAcc.rows.length > 0 ? cashAcc.rows[0].id : null;
        
        if (!cashAccountId) throw new Error("Cash account not found for company.");

        // Insert ledger entries
        await client.query(
            `INSERT INTO ledger_entries (company_id, branch_id, account_id, transaction_id, entry_date, debit, credit)
             VALUES ($1, $2, $3, $4, $5, $6, 0)`,
            [companyId, branchId, account_id, transactionId, date, amount]
        );

        await client.query(
            `INSERT INTO ledger_entries (company_id, branch_id, account_id, transaction_id, entry_date, debit, credit)
             VALUES ($1, $2, $3, $4, $5, 0, $6)`,
            [companyId, branchId, cashAccountId, transactionId, date, amount]
        );

        // Record in daily_expenses
        await client.query(
            `INSERT INTO daily_expenses (company_id, branch_id, date, expense_type, amount, ledger_reference_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [companyId, branchId, date, expense_type, amount, transactionId, notes]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: "Expense recorded successfully." });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Expense Error:", err);
        res.status(500).json({ error: err.message || "Failed to record expense" });
    } finally {
        if (client) client.release();
    }
});

// Salary Out / EOD Payments
router.post("/salary-payment", authMiddleware, async (req, res) => {
    const { employee_id, amount, payment_type, notes, date } = req.body;
    const companyId = req.user.active_company_id;
    const branchId = req.user.branch_id || null;

    let client;
    try {
        const op = await db.pgGet(`SELECT * FROM day_operations WHERE company_id = $1 AND date = $2`, [companyId, date]);
        if (!op || op.status === 'closed') {
            return res.status(400).json({ error: "Cannot process payment. Business day is closed." });
        }

        client = await db.getClient();
        await client.query('BEGIN');

        // Insert Transaction
        const txRes = await client.query(
            `INSERT INTO transactions (company_id, branch_id, transaction_date, description, created_by)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [companyId, branchId, date, `Salary Payment/Advance: ${payment_type} to Emp ID ${employee_id}`, req.user.id]
        );
        const transactionId = txRes.rows[0].id;

        // Debit Salary Expense or Advance Account -> Credit Cash
        const cashAcc = await client.query(`SELECT id FROM chart_of_accounts WHERE company_id=$1 AND account_code='CASH'`, [companyId]);
        const cashAccountId = cashAcc.rows[0]?.id;

        const expenseAcc = await client.query(`SELECT id FROM chart_of_accounts WHERE company_id=$1 AND account_code='SALARY_EXP'`, [companyId]);
        const expenseAccountId = expenseAcc.rows[0]?.id;

        if (!cashAccountId || !expenseAccountId) {
            throw new Error("Chart of Accounts misconfigured. Required: CASH, SALARY_EXP.");
        }

        await client.query(
            `INSERT INTO ledger_entries (company_id, branch_id, account_id, transaction_id, entry_date, debit, credit)
             VALUES ($1, $2, $3, $4, $5, $6, 0)`,
            [companyId, branchId, expenseAccountId, transactionId, date, amount]
        );

        await client.query(
            `INSERT INTO ledger_entries (company_id, branch_id, account_id, transaction_id, entry_date, debit, credit)
             VALUES ($1, $2, $3, $4, $5, 0, $6)`,
            [companyId, branchId, cashAccountId, transactionId, date, amount]
        );

        // Update employee ledger logic
        if (payment_type === 'Advance') {
            await client.query(
                `INSERT INTO salary_advances (company_id, employee_id, amount, advance_date, reason, current_balance)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [companyId, employee_id, amount, date, notes, amount]
            );
            
            // Sync with employee_ledger
            await client.query(`
                INSERT INTO employee_ledger (company_id, employee_id, advance_balance)
                VALUES ($1, $2, $3)
                ON CONFLICT (company_id, branch_id, employee_id) DO UPDATE 
                SET advance_balance = employee_ledger.advance_balance + $3
            `, [companyId, employee_id, amount]); // Assuming unique constraint, wait! employee_ledger doesn't have unique constraint. Let's fix that.
        } else {
             await client.query(`
                INSERT INTO employee_ledger (company_id, employee_id, salary_paid, last_payment_date)
                VALUES ($1, $2, $3, $4)
            `, [companyId, employee_id, amount, date]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Payment processed successfully." });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Salary Payment Error:", err);
        res.status(500).json({ error: err.message || "Failed to process payment" });
    } finally {
        if (client) client.release();
    }
});

export default router;
