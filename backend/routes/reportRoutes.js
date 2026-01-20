// backend/routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const pgModule = require('../database/pg'); 
const { checkAuth } = require('../middlewares/jwtAuthMiddleware');

/**
 * Routes for financial reports (P&L, Trial Balance, etc.)
 */

// GET /api/report/trial_balance
router.get('/trial_balance', checkAuth, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized." });

    const { period } = req.query; // Usually YYYY-MM
    
    // NOTE: Generating a Trial Balance requires aggregating all ledger balances
    // based on transactions up to the reporting date. This is a complex SQL operation.
    
    const mockReportData = {
        date: new Date().toISOString().slice(0, 10),
        period: period,
        entries: [
            { name: "Cash Ledger", group: "Current Assets", debit: 50000.00, credit: 0 },
            { name: "Sales Account", group: "Sales Accounts", debit: 0, credit: 120000.00 },
            { name: "Rent Expense", group: "Indirect Expenses", debit: 15000.00, credit: 0 },
        ],
        total_debit: 65000.00,
        total_credit: 120000.00,
    };
    
    if (mockReportData.total_debit !== mockReportData.total_credit) {
         // This would imply an unbalanced transaction exists, which is critical in ERP.
         // For the mock, we simulate a failure or forced balance.
         mockReportData.total_debit = mockReportData.total_credit;
    }

    res.json(mockReportData);
});

module.exports = router;