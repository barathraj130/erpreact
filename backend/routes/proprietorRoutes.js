import express from 'express';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import * as db from '../database/pg.js';
import { createTransactionInternal, getAccountByCode } from '../utils/accountingEngine.js';

const router = express.Router();

// GET all proprietor transactions
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const rows = await db.pgAll(
            `SELECT * FROM proprietor_transactions WHERE company_id = $1 ORDER BY transaction_date DESC, created_at DESC`,
            [companyId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch proprietor transactions' });
    }
});

// POST — record withdrawal or investment
router.post('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id || 1;
    const { transaction_type, amount, payment_mode, transaction_date, notes } = req.body;

    if (!['WITHDRAWAL', 'INVESTMENT'].includes(transaction_type)) {
        return res.status(400).json({ error: 'transaction_type must be WITHDRAWAL or INVESTMENT' });
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: 'Valid amount required' });
    }

    const amt = parseFloat(amount);
    const pMode = (payment_mode || 'CASH').toUpperCase();

    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        const row = await client.query(
            `INSERT INTO proprietor_transactions (company_id, branch_id, transaction_type, amount, payment_mode, transaction_date, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [companyId, branchId, transaction_type, amt, pMode, transaction_date || new Date(), notes || null, req.user.id]
        );
        const record = row.rows[0];

        // Double-entry: cash/bank ↔ proprietor capital account
        const cashAcct  = await getAccountByCode(companyId, '1000');
        const bankAcct  = await getAccountByCode(companyId, '1200') || cashAcct;
        const capAcct   = await getAccountByCode(companyId, '3000'); // Owner's Equity / Capital

        const moneyAcct = pMode !== 'CASH' ? bankAcct : cashAcct;

        if (moneyAcct && capAcct) {
            const isInvestment = transaction_type === 'INVESTMENT';
            await createTransactionInternal(client, {
                company_id:       companyId,
                branch_id:        branchId,
                transaction_date: transaction_date || new Date(),
                reference_type:   'PROPRIETOR',
                reference_id:     record.id,
                description:      `Proprietor ${transaction_type} - ${pMode}`,
                created_by:       req.user.id,
                bill_purpose:     'real'
            }, [
                // Investment: DR Cash/Bank, CR Capital
                // Withdrawal: DR Capital, CR Cash/Bank
                {
                    account_id:    isInvestment ? moneyAcct.id : capAcct.id,
                    debit_amount:  amt,
                    credit_amount: 0,
                    description:   isInvestment ? `Investment received via ${pMode}` : `Withdrawal by proprietor`
                },
                {
                    account_id:    isInvestment ? capAcct.id : moneyAcct.id,
                    debit_amount:  0,
                    credit_amount: amt,
                    description:   isInvestment ? `Proprietor capital increase` : `Paid via ${pMode}`
                }
            ]);
        }

        // Update cash/bank ledger for real-time balance tracking
        const direction = transaction_type === 'INVESTMENT' ? 'in' : 'out';
        if (pMode === 'CASH') {
            await client.query(
                `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date) VALUES ($1,$2,'PROPRIETOR',$3,$4,$5)`,
                [companyId, branchId, amt, direction, transaction_date || new Date()]
            );
        } else {
            await client.query(
                `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date) VALUES ($1,$2,'PROPRIETOR',$3,$4,'Main Account',$5,$6)`,
                [companyId, branchId, amt, direction, `PROP-${record.id}`, transaction_date || new Date()]
            );
        }

        await client.query('COMMIT');
        res.status(201).json(record);
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Proprietor transaction error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

export default router;
