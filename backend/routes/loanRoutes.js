
import express from 'express';
import * as financeService from '../services/financeService.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import * as db from '../database/pg.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const loans = await db.pgAll(`
            SELECT l.*, ln.lender_name 
            FROM loans l 
            JOIN lenders ln ON l.lender_id = ln.id
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
