
import express from 'express';
import * as financeService from '../services/financeService.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import * as db from '../database/pg.js';
import { triggerN8N } from '../utils/triggerN8N.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const loans = await db.pgAll(`
            SELECT
                l.*,
                COALESCE(ln.lender_name, l.party_name, 'Unknown')  AS lender_name,
                COALESCE(ln.lender_type, l.party_type, 'Bank')      AS lender_type,
                ln.phone                                             AS lender_phone,
                COALESCE(l.loan_type, l.party_type, 'BANK')         AS loan_type,
                COALESCE(l.principal_outstanding, l.principal_amount) AS remaining_principal,
                COALESCE((
                    SELECT SUM(principal_component) FROM loan_payments
                    WHERE loan_id = l.id AND company_id = $1
                ), 0) AS paid_principal,
                COALESCE((
                    SELECT SUM(total_amount) FROM loan_payments
                    WHERE loan_id = l.id AND company_id = $1
                ), 0) AS total_paid,
                COALESCE((
                    SELECT SUM(interest_component) FROM loan_payments
                    WHERE loan_id = l.id AND company_id = $1
                ), 0) AS total_interest_paid
            FROM loans l
            LEFT JOIN lenders ln ON l.lender_id = ln.id
            WHERE l.company_id = $1
              AND (l.is_deleted IS NULL OR l.is_deleted = false)
            ORDER BY l.created_at DESC NULLS LAST, l.start_date DESC
        `, [companyId]);
        res.json(loans);
    } catch (err) {
        console.error('GET /loans error:', err);
        res.status(500).json({ error: 'Failed to fetch loans: ' + err.message });
    }
});

// FIX 2: Sync lender opening balances → loan records (runs once per lender with balance but no loan)
router.post('/sync-from-lenders', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');

        // Find lenders with opening_balance > 0 but no active loan
        const orphans = await client.query(`
            SELECT id, lender_name, lender_type, opening_balance, phone
            FROM lenders
            WHERE company_id = $1
              AND COALESCE(opening_balance, 0) > 0
              AND id NOT IN (
                  SELECT lender_id FROM loans
                  WHERE company_id = $1 AND lender_id IS NOT NULL
              )
        `, [companyId]);

        const created = [];
        for (const l of orphans.rows) {
            const loanType = (l.lender_type === 'Bank' || l.lender_type === 'BANK') ? 'BANK' : 'PRIVATE';
            const ins = await client.query(`
                INSERT INTO loans (
                    company_id, lender_id, party_name, party_type, loan_type,
                    loan_direction, principal_amount, principal_outstanding,
                    interest_rate, interest_type, start_date, duration_months,
                    repayment_cycle, status, notes
                ) VALUES ($1, $2, $3, $4, $5,
                    'BORROWED', $6, $6,
                    12, $7, CURRENT_DATE, 0,
                    $8, 'ACTIVE',
                    'Auto-created from lender opening balance')
                RETURNING id
            `, [
                companyId, l.id, l.lender_name,
                loanType, loanType,
                l.opening_balance,
                loanType === 'BANK' ? 'REDUCING' : 'FLAT',
                loanType === 'BANK' ? 'MONTHLY' : 'INDEFINITE'
            ]);
            // Best-effort set loan_type + principal_outstanding
            await client.query(`SAVEPOINT sp_sync_cols`);
            try {
                await client.query(
                    `UPDATE loans SET loan_type = $1, principal_outstanding = $2 WHERE id = $3`,
                    [loanType, l.opening_balance, ins.rows[0].id]
                );
                await client.query(`RELEASE SAVEPOINT sp_sync_cols`);
            } catch (_) {
                await client.query(`ROLLBACK TO SAVEPOINT sp_sync_cols`);
                await client.query(`RELEASE SAVEPOINT sp_sync_cols`);
            }
            created.push({ lender: l.lender_name, loan_id: ins.rows[0].id, amount: l.opening_balance });
        }

        await client.query('COMMIT');
        res.json({ synced: created.length, loans: created });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Sync lenders error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

router.post('/', authMiddleware, async (req, res) => {
    try {
        const loan = await financeService.createLoan(req.user, req.body);
        res.status(201).json(loan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/repayment', authMiddleware, async (req, res) => {
    try {
        const repayment = await financeService.recordLoanRepayment(req.user, req.body);
        res.status(201).json(repayment);

        // Fire n8n webhook (non-blocking, after response sent)
        try {
            const companyId = req.user.active_company_id;
            const loanInfo = await db.pgGet(
                `SELECT l.principal_amount, l.duration_months, ln.lender_name,
                        GREATEST(0, l.principal_amount - COALESCE((
                            SELECT SUM(principal_component) FROM loan_payments
                            WHERE loan_id = l.id AND company_id = $1
                        ), 0)) AS outstanding
                 FROM loans l
                 LEFT JOIN lenders ln ON l.lender_id = ln.id
                 WHERE l.id = $2 AND l.company_id = $1`,
                [companyId, req.body.loan_id]
            );
            await triggerN8N('erp-alert', {
                event_type:   'loan_due',
                lender_name:  loanInfo?.lender_name || 'Lender',
                emi_amount:   req.body.total_amount,
                due_date:     req.body.payment_date,
                outstanding:  loanInfo?.outstanding ?? 0,
            });
        } catch (e) {
            console.log('N8N loan trigger failed silently:', e.message);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:loanId/repayments', authMiddleware, async (req, res) => {
    try {
        const repayments = await db.pgAll(
            `SELECT * FROM loan_payments WHERE loan_id = $1 AND company_id = $2 ORDER BY payment_date DESC`,
            [req.params.loanId, req.user.active_company_id]
        );
        res.json(repayments);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch repayments' });
    }
});

router.get('/summary', authMiddleware, async (req, res) => {
    try {
        const summary = await financeService.getFinanceSummary(req.user.active_company_id);
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
});

export default router;
