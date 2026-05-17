
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
            SELECT l.*,
                COALESCE(ln.lender_name, l.party_name, 'Unknown') AS lender_name,
                COALESCE(l.principal_outstanding, l.principal_amount) AS remaining_principal,
                COALESCE((
                    SELECT SUM(principal_component)
                    FROM loan_payments
                    WHERE loan_id = l.id AND company_id = $1
                ), 0) AS paid_principal,
                COALESCE((
                    SELECT SUM(total_amount)
                    FROM loan_payments
                    WHERE loan_id = l.id AND company_id = $1
                ), 0) AS total_paid,
                COALESCE((
                    SELECT SUM(interest_component)
                    FROM loan_payments
                    WHERE loan_id = l.id AND company_id = $1
                ), 0) AS total_interest_paid
            FROM loans l
            LEFT JOIN lenders ln ON l.lender_id = ln.id
            WHERE l.company_id = $1
            ORDER BY l.start_date DESC
        `, [companyId]);
        res.json(loans);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch loans' });
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
