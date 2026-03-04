// backend/routes/ledgerRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * Ledger Routes for Chart of Accounts (COA) and Ledger Management
 */

// GET /api/ledger/groups - Fetch all ledger groups (COA)
router.get('/groups', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const groups = await db.pgAll('SELECT * FROM ledger_groups WHERE company_id = $1 ORDER BY name', [companyId]);
        res.json(groups);
    } catch (error) {
        console.error("Error fetching ledger groups:", error.message);
        res.status(500).json({ error: "Failed to fetch groups." });
    }
});

// GET /api/ledger - Fetch all ledgers (with calculated balances)
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    
    try {
        const sql = `
            SELECT 
                l.id, l.name, l.opening_balance, l.is_dr,
                lg.name as group_name,
                (
                    SELECT COALESCE(SUM(CASE WHEN t.type = 'RECEIPT' OR t.type = 'INVOICE' THEN t.amount ELSE -t.amount END), 0)
                    FROM transactions t 
                    WHERE t.ledger_id = l.id
                ) as net_diff
            FROM ledgers l
            JOIN ledger_groups lg ON l.group_id = lg.id
            WHERE l.company_id = $1
            ORDER BY lg.name, l.name
        `;
        
        const ledgers = await db.pgAll(sql, [companyId]);

        // Calculate actual current balance
        const ledgersWithBalance = ledgers.map(l => {
            const initial = Number(l.opening_balance || 0);
            const net = Number(l.net_diff || 0);
            // Simplistic balance logic: if DR initial, add net. 
            // In real accounting, it depends on group nature (Asset vs Liability).
            // For now, presenting opening + net.
            return {
                ...l,
                current_balance: initial + net
            };
        });

        res.json(ledgersWithBalance);

    } catch (error) {
        console.error("Error fetching ledgers:", error.message);
        res.status(500).json({ error: "Failed to fetch ledgers." });
    }
});

// GET /api/ledger/report/:id - Fetch detailed transaction report for one ledger
router.get('/report/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.active_company_id;
    
    try {
        const ledger = await db.pgGet(`SELECT * FROM ledgers WHERE id = $1 AND company_id = $2`, [id, companyId]);
        if (!ledger) return res.status(404).json({ error: "Ledger not found" });

        const transactions = await db.pgAll(`
            SELECT * FROM transactions 
            WHERE ledger_id = $1 AND company_id = $2 
            ORDER BY date ASC, created_at ASC
        `, [id, companyId]);

        res.json({ 
            ledger, 
            transactions,
            opening_balance: ledger.opening_balance 
        });
    } catch (err) {
        console.error("Ledger report error:", err);
        res.status(500).json({ error: "Failed to fetch report" });
    }
});

export default router;