import express from 'express';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import * as db from '../database/pg.js';

const router = express.Router();

// GET all cash transfers
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const rows = await db.pgAll(
            `SELECT ct.*,
                    fb.name AS from_branch_name,
                    tb.name AS to_branch_name
             FROM cash_transfers ct
             LEFT JOIN branches fb ON ct.from_branch_id = fb.id
             LEFT JOIN branches tb ON ct.to_branch_id   = tb.id
             WHERE ct.company_id = $1
             ORDER BY ct.transfer_date DESC, ct.created_at DESC`,
            [companyId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch cash transfers' });
    }
});

// POST — record branch handover or inter-branch transfer
router.post('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { from_branch_id, to_branch_id, transfer_type, amount, payment_mode, transfer_date, reference_no, notes } = req.body;

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: 'Valid amount required' });
    }

    const amt       = parseFloat(amount);
    const pMode     = (payment_mode || 'CASH').toUpperCase();
    const tType     = transfer_type || 'BRANCH_TO_MAIN';
    const fromBrId  = from_branch_id || req.user.branch_id || 1;
    const toBrId    = to_branch_id   || 1;

    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        const txDate = transfer_date || new Date();
        const brId = fromBrId;

        // BANK_TO_CASH / CASH_TO_BANK: only update ledgers, no branch record needed
        if (tType === 'BANK_TO_CASH') {
            await client.query(
                `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, date) VALUES ($1,$2,'CASH_TRANSFER',$3,'out','Main Account',$4)`,
                [companyId, brId, amt, txDate]
            );
            await client.query(
                `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date) VALUES ($1,$2,'CASH_TRANSFER',$3,'in',$4)`,
                [companyId, brId, amt, txDate]
            );
            await client.query('COMMIT');
            return res.status(201).json({ success: true, type: 'BANK_TO_CASH', amount: amt });
        }

        if (tType === 'CASH_TO_BANK') {
            await client.query(
                `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date) VALUES ($1,$2,'CASH_TRANSFER',$3,'out',$4)`,
                [companyId, brId, amt, txDate]
            );
            await client.query(
                `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, date) VALUES ($1,$2,'CASH_TRANSFER',$3,'in','Main Account',$4)`,
                [companyId, brId, amt, txDate]
            );
            await client.query('COMMIT');
            return res.status(201).json({ success: true, type: 'CASH_TO_BANK', amount: amt });
        }

        // Branch transfers: insert into cash_transfers table
        const row = await client.query(
            `INSERT INTO cash_transfers (company_id, from_branch_id, to_branch_id, transfer_type, amount, payment_mode, transfer_date, reference_no, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [companyId, fromBrId, toBrId, tType, amt, pMode, transfer_date || new Date(), reference_no || null, notes || null, req.user.id]
        );
        const record = row.rows[0];

        if (pMode === 'CASH') {
            // Branch-to-branch cash transfer
            await client.query(
                `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date) VALUES ($1,$2,'CASH_TRANSFER',$3,'out',$4)`,
                [companyId, fromBrId, amt, txDate]
            );
            await client.query(
                `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date) VALUES ($1,$2,'CASH_TRANSFER',$3,'in',$4)`,
                [companyId, toBrId, amt, txDate]
            );
        } else {
            await client.query(
                `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date) VALUES ($1,$2,'CASH_TRANSFER',$3,'out','Main Account',$4,$5)`,
                [companyId, fromBrId, amt, `TRF-${record.id}-OUT`, txDate]
            );
            await client.query(
                `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date) VALUES ($1,$2,'CASH_TRANSFER',$3,'in','Main Account',$4,$5)`,
                [companyId, toBrId, amt, `TRF-${record.id}-IN`, txDate]
            );
        }

        await client.query('COMMIT');
        res.status(201).json(record);
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Cash transfer error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

export default router;
