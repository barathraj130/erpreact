// backend/routes/accountingRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import { checkModule } from '../middlewares/subscriptionMiddleware.js';
import { createTransaction, getProfitAndLoss } from '../utils/accountingEngine.js';

const router = express.Router();

// All accounting routes require 'finance' module
router.use(authMiddleware);
router.use(checkModule('finance'));

/* ============================================================
   1. CHART OF ACCOUNTS
============================================================ */

// Get accounts with hierarchy
router.get('/accounts', async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const sql = `
            SELECT * FROM chart_of_accounts 
            WHERE company_id = $1 OR company_id IS NULL 
            ORDER BY account_code;
        `;
        const accounts = await db.pgAll(sql, [companyId]);
        res.json(accounts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new account
router.post('/accounts', async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const { account_code, name, account_type, parent_account_id, opening_balance } = req.body;
        
        const sql = `
            INSERT INTO chart_of_accounts (company_id, account_code, name, account_type, parent_account_id, opening_balance, current_balance)
            VALUES ($1, $2, $3, $4, $5, $6, $6)
            RETURNING *;
        `;
        const account = await db.pgGet(sql, [companyId, account_code, name, account_type, parent_account_id, opening_balance || 0]);
        res.json(account);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ============================================================
   2. TRANSACTIONS
============================================================ */

// Create a Manual Journal Entry or Transaction
router.post('/transactions', async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const branchId = req.body.branch_id || req.user.branch_id; // Use provided branch or user's default
        
        const txData = {
            company_id: companyId,
            branch_id: branchId,
            transaction_date: req.body.transaction_date,
            reference_type: req.body.reference_type || 'JOURNAL',
            reference_id: req.body.reference_id,
            description: req.body.description,
            created_by: req.user.id
        };

        const lines = req.body.lines; // Expected: [{ account_id, debit_amount, credit_amount, description }]

        const result = await createTransaction(txData, lines);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get transactions (paged)
router.get('/transactions', async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const sql = `
            SELECT t.*, u.username as creator_name
            FROM transactions t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.company_id = $1
            ORDER BY t.transaction_date DESC, t.id DESC
            LIMIT 50;
        `;
        const txs = await db.pgAll(sql, [companyId]);
        res.json(txs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ============================================================
   3. REPORTS
============================================================ */

router.get('/reports/profit-loss', async (req, res) => {
    try {
        const { start_date, end_date, branch_id } = req.query;
        const companyId = req.user.active_company_id;
        
        const report = await getProfitAndLoss(companyId, branch_id, start_date, end_date);
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Balance Sheet (Simplified for demonstration)
router.get('/reports/balance-sheet', async (req, res) => {
    try {
        const companyId = req.user.active_company_id;
        const sql = `
            SELECT account_type, name, current_balance 
            FROM chart_of_accounts 
            WHERE company_id = $1 AND account_type IN ('ASSET', 'LIABILITY', 'EQUITY')
            ORDER BY account_type, account_code;
        `;
        const results = await db.pgAll(sql, [companyId]);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
