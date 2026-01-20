// backend/routes/ledgerRoutes.js
const express = require('express');
const router = express.Router();
const pgModule = require('../database/pg'); 
const { checkAuth } = require('../middlewares/jwtAuthMiddleware');

/**
 * Ledger Routes for Chart of Accounts (COA) and Ledger Management
 */

// Helper function to calculate current balance (Debit minus Credit)
const calculateLedgerBalance = async (ledgerId, companyId) => {
    const balanceSql = `
        SELECT 
            l.opening_balance, 
            l.is_dr,
            COALESCE(SUM(CASE WHEN t.type = 'Debit' THEN t.amount ELSE -t.amount END), 0) AS net_transaction_amount
        FROM ledgers l
        LEFT JOIN transactions t ON l.id = t.ledger_id -- Assume transactions table is linked to ledger
        WHERE l.id = $1 AND l.company_id = $2
        GROUP BY l.id
    `;
    
    // NOTE: Since the current transactions table structure provided doesn't link directly to ledgers,
    // we assume a joined view or a more complex query based on the voucher system.
    // We will simplify and mock the complex balance calculation here.
    return 10000; // Mock current balance
};


// GET /api/ledger/groups - Fetch all ledger groups (COA)
router.get('/groups', checkAuth, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized." });

    try {
        const groups = await pgModule.pgAll('SELECT * FROM ledger_groups WHERE company_id = $1 ORDER BY name', [companyId]);
        res.json(groups);
    } catch (error) {
        console.error("Error fetching ledger groups:", error.message);
        res.status(500).json({ error: "Failed to fetch groups." });
    }
});

// GET /api/ledger - Fetch all ledgers (with calculated balances)
router.get('/', checkAuth, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized." });
    
    try {
        // This is a simplified query; full accounting logic would require summing related transactions/vouchers.
        const sql = `
            SELECT 
                l.id, l.name, l.opening_balance, l.is_dr,
                lg.name as group_name
            FROM ledgers l
            JOIN ledger_groups lg ON l.group_id = lg.id
            WHERE l.company_id = $1
            ORDER BY lg.name, l.name
        `;
        
        const ledgers = await pgModule.pgAll(sql, [companyId]);

        // Mock balance calculation for demonstration
        const ledgersWithBalance = ledgers.map(l => ({
            ...l,
            current_balance: l.opening_balance + Math.floor(Math.random() * 5000) - 2000 // Mock
        }));

        res.json(ledgersWithBalance);

    } catch (error) {
        console.error("Error fetching ledgers:", error.message);
        res.status(500).json({ error: "Failed to fetch ledgers." });
    }
});

// GET /api/ledger/report/:id - Fetch detailed transaction report for one ledger
router.get('/report/:id', checkAuth, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized." });
    
    // NOTE: Requires complex join between ledgers, transactions, and vouchers
    res.json({ ledger_id: id, transactions: [], balance: 0 }); // Mock empty report
});

module.exports = router;