import express from 'express';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import * as db from '../database/pg.js';

const router = express.Router();

// GET all cash transfers (branch transfers + bank↔cash ledger entries)
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        // Branch-to-branch transfers (stored in cash_transfers table)
        const branchRows = await db.pgAll(
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

        // Bank→Cash transfers: bank_ledger 'out' paired with cash_ledger 'in' (source = CASH_TRANSFER)
        const bankToCashRows = await db.pgAll(
            `SELECT bl.id,
                    bl.company_id,
                    bl.branch_id,
                    'BANK_TO_CASH' AS transfer_type,
                    bl.amount,
                    'CASH' AS payment_mode,
                    bl.date AS transfer_date,
                    bl.created_at,
                    NULL AS reference_no,
                    NULL AS notes,
                    NULL AS from_branch_name,
                    NULL AS to_branch_name
             FROM bank_ledger bl
             WHERE bl.company_id = $1
               AND bl.source = 'CASH_TRANSFER'
               AND bl.direction = 'out'
               AND bl.bank_name = 'Main Account'
             ORDER BY bl.date DESC, bl.created_at DESC`,
            [companyId]
        );

        // Cash→Bank transfers: cash_ledger 'out' where source = CASH_TRANSFER
        const cashToBankRows = await db.pgAll(
            `SELECT cl.id,
                    cl.company_id,
                    cl.branch_id,
                    'CASH_TO_BANK' AS transfer_type,
                    cl.amount,
                    'CASH' AS payment_mode,
                    cl.date AS transfer_date,
                    cl.created_at,
                    NULL AS reference_no,
                    NULL AS notes,
                    NULL AS from_branch_name,
                    NULL AS to_branch_name
             FROM cash_ledger cl
             WHERE cl.company_id = $1
               AND cl.source = 'CASH_TRANSFER'
               AND cl.direction = 'out'
             ORDER BY cl.date DESC, cl.created_at DESC`,
            [companyId]
        );

        // Merge and sort by date desc
        const all = [...branchRows, ...bankToCashRows, ...cashToBankRows]
            .sort((a, b) => new Date(b.transfer_date || b.created_at).getTime() - new Date(a.transfer_date || a.created_at).getTime());

        res.json(all);
    } catch (err) {
        console.error('Cash transfers fetch error:', err);
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
