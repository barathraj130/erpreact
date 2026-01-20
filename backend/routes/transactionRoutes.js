// backend/routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const pgModule = require('../database/pg'); 
const { checkAuth } = require('../middlewares/jwtAuthMiddleware');

/**
 * Direct transaction routes (for manual journal/expense entry, bypassing complex invoice logic)
 */

// POST /api/transaction - Create a general (single-entry) transaction
router.post('/', checkAuth, async (req, res) => {
    const companyId = req.user?.active_company_id;
    if (!companyId) return res.status(401).json({ error: "Unauthorized." });

    const { date, amount, description, category, user_id, lender_id } = req.body;

    if (!date || !amount || !description || !category) {
        return res.status(400).json({ error: "Date, Amount, Description, and Category are required." });
    }

    const sql = `
        INSERT INTO transactions (company_id, user_id, lender_id, amount, description, category, date, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id
    `;
    const params = [companyId, user_id || null, lender_id || null, amount, description, category, date];

    try {
        const result = await pgModule.pgGet(sql, params);
        // NOTE: A real accounting system would create a corresponding double-entry voucher here.
        res.status(201).json({ id: result.id, message: "Transaction recorded successfully." });
    } catch (error) {
        console.error("Error creating transaction:", error.message);
        res.status(500).json({ error: "Failed to record transaction." });
    }
});

module.exports = router;