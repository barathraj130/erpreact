// backend/routes/reconciliationRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * Routes for Bank Reconciliation.
 */

// GET /api/reconciliation/:bankAccountId
router.get('/:bankAccountId', authMiddleware, async (req, res) => {
    const { bankAccountId } = req.params;
    const companyId = req.user.active_company_id;

    try {
        // Fetch Bank Ledger Entries linked to specific bank account
        const ledgerEntries = await db.pgAll(`
            SELECT * FROM bank_ledger 
            WHERE bank_account_id = $1 AND company_id = $2
            ORDER BY date DESC, created_at DESC
        `, [bankAccountId, companyId]);

        res.json({ 
            success: true,
            bank_account_id: bankAccountId,
            unmatched_transactions: ledgerEntries 
        });
    } catch (err) {
        console.error("Reconciliation fetch error:", err);
        res.status(500).json({ error: "Failed to fetch reconciliation data" });
    }
});

// POST /api/reconciliation/:bankAccountId/match
router.post('/:bankAccountId/match', authMiddleware, async (req, res) => {
    // Logic for matching transaction with bank statement line
    res.json({ success: true, message: "Transaction matched successfully." });
});

export default router;