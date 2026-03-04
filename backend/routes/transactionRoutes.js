// backend/routes/transactionRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * Direct transaction routes
 */

// GET /api/transactions - Get all transactions (with optional filters)
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { lender_id, user_id, type, category } = req.query;

    console.log('📊 Transaction API called:', { companyId, lender_id, user_id, type, category });

    try {
        let sql = `
            SELECT t.*, 
                   l.lender_name, 
                   u.username as user_name,
                   ledg.name as ledger_name
            FROM transactions t
            LEFT JOIN lenders l ON t.lender_id = l.id
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN ledgers ledg ON t.ledger_id = ledg.id
            WHERE t.company_id = $1
        `;
        const params = [companyId];
        let paramCount = 2;

        if (lender_id) {
            sql += ` AND t.lender_id = $${paramCount++}`;
            params.push(lender_id);
        }
        if (user_id) {
            sql += ` AND t.user_id = $${paramCount++}`;
            params.push(user_id);
        }
        if (type) {
            sql += ` AND t.type = $${paramCount++}`;
            params.push(type);
        }
        if (category) {
            sql += ` AND t.category = $${paramCount++}`;
            params.push(category);
        }

        sql += ` ORDER BY t.date DESC, t.created_at DESC`;

        console.log('📊 SQL Query:', sql);
        console.log('📊 Params:', params);

        const rows = await db.pgAll(sql, params);
        
        console.log('📊 Rows returned:', rows?.length || 0);
        
        res.json(rows);
    } catch (err) {
        console.error("Fetch Transactions Error:", err);
        res.status(500).json({ error: "Failed to fetch transactions" });
    }
});

// POST /api/transactions - Create a general transaction
router.post('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { date, amount, description, category, user_id, lender_id, ledger_id, type } = req.body;

    if (!date || !amount || !description || !category || !type) {
        return res.status(400).json({ error: "Date, Amount, Description, Category and Type are required." });
    }

    const sql = `
        INSERT INTO transactions (company_id, user_id, lender_id, ledger_id, amount, description, category, type, date, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id
    `;
    const params = [
        companyId, 
        user_id || null, 
        lender_id || null, 
        ledger_id || null,
        amount, 
        description, 
        category, 
        type, // 'BILL', 'INVOICE', 'PAYMENT', 'RECEIPT', etc.
        date
    ];

    try {
        const result = await db.pgRun(sql, params);
        res.status(201).json({ success: true, id: result.rows[0].id, message: "Transaction recorded successfully." });
    } catch (error) {
        console.error("Error creating transaction:", error.message);
        res.status(500).json({ error: "Failed to record transaction." });
    }
});

export default router;