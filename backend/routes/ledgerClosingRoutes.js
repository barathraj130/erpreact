// backend/routes/ledgerClosingRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

// GET /api/ledger-closing/status/:date
router.get('/status/:date', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId = req.user.branch_id || 1;
    const { date } = req.params;

    try {
        const closed = await db.pgGet(`
            SELECT * FROM daily_ledger_closings 
            WHERE company_id = $1 AND branch_id = $2 AND closing_date = $3
        `, [companyId, branchId, date]);

        res.json({ is_closed: !!closed, details: closed || null });
    } catch (err) {
        console.error("Error checking closing status:", err);
        res.status(500).json({ error: "Failed to check closing status" });
    }
});

// POST /api/ledger-closing/close
router.post('/close', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId = req.user.branch_id || 1;
    const { date, notes } = req.body;

    if (!date) return res.status(400).json({ error: "Date is required" });

    try {
        // Calculate Closing Balances for Cash & Bank
        // 1. Cash Balance
        const cashRes = await db.pgAll(`
            SELECT direction, SUM(amount) as total 
            FROM cash_ledger 
            WHERE company_id = $1 AND branch_id = $2 AND date <= $3 
            GROUP BY direction
        `, [companyId, branchId, date]);
        
        let cash_in = 0, cash_out = 0;
        cashRes.forEach(r => {
            if (r.direction === 'in') cash_in += Number(r.total);
            if (r.direction === 'out') cash_out += Number(r.total);
        });
        const cash_closing_balance = cash_in - cash_out;

        // Save Cash Closing
        await db.pgRun(`
            INSERT INTO daily_ledger_closings (company_id, branch_id, closing_date, ledger_type, closing_balance, closed_by, notes)
            VALUES ($1, $2, $3, 'CASH', $4, $5, $6)
            ON CONFLICT (company_id, branch_id, closing_date, ledger_type) DO UPDATE 
            SET closing_balance = EXCLUDED.closing_balance, closed_by = EXCLUDED.closed_by, notes = EXCLUDED.notes
        `, [companyId, branchId, date, cash_closing_balance, req.user.id, notes]);

        // 2. Bank Balances (Per Bank Account)
        const bankAccounts = await db.pgAll(`SELECT id, bank_name FROM bank_details WHERE company_id = $1`, [companyId]);
        
        for (const bank of bankAccounts) {
            const bankRes = await db.pgAll(`
                SELECT direction, SUM(amount) as total 
                FROM bank_ledger 
                WHERE company_id = $1 AND branch_id = $2 AND bank_account_id = $3 AND date <= $4
                GROUP BY direction
            `, [companyId, branchId, bank.id, date]);

            let b_in = 0, b_out = 0;
            bankRes.forEach(r => {
                if (r.direction === 'in') b_in += Number(r.total);
                if (r.direction === 'out') b_out += Number(r.total);
            });
            const bank_closing_balance = b_in - b_out;

            await db.pgRun(`
                INSERT INTO daily_ledger_closings (company_id, branch_id, closing_date, ledger_type, bank_account_id, closing_balance, closed_by, notes)
                VALUES ($1, $2, $3, 'BANK', $4, $5, $6, $7)
                ON CONFLICT (company_id, branch_id, closing_date, ledger_type) DO UPDATE 
                SET closing_balance = EXCLUDED.closing_balance, closed_by = EXCLUDED.closed_by, notes = EXCLUDED.notes
            `, [companyId, branchId, date, bank.id, bank_closing_balance, req.user.id, notes]);
        }

        res.json({ success: true, message: "Ledgers for the day closed successfully." });
    } catch (err) {
        console.error("Error closing ledgers:", err);
        res.status(500).json({ error: "Failed to close ledgers" });
    }
});

export default router;
