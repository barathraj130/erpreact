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
            `SELECT pt.*, pa.account_name as personal_account_name, pa.account_type as personal_account_type
             FROM proprietor_transactions pt
             LEFT JOIN personal_accounts pa ON pa.id = pt.personal_account_id
             WHERE pt.company_id = $1 ORDER BY pt.transaction_date DESC, pt.created_at DESC`,
            [companyId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch proprietor transactions' });
    }
});

// POST /drawings — Withdrawal (affects cash/bank ledger)
router.post('/drawings', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id || 1;
    const { amount, payment_mode, transaction_date, notes } = req.body;
    if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'Valid amount required' });

    const amt   = parseFloat(amount);
    const pMode = (payment_mode || 'CASH').toUpperCase();
    const tDate = transaction_date || new Date().toISOString().split('T')[0];

    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        const row = await client.query(
            `INSERT INTO proprietor_transactions (company_id, branch_id, transaction_type, amount, payment_mode, transaction_date, notes, created_by)
             VALUES ($1,$2,'DRAWINGS',$3,$4,$5,$6,$7) RETURNING *`,
            [companyId, branchId, amt, pMode, tDate, notes || null, req.user.id]
        );
        const record = row.rows[0];

        const cashAcct = await getAccountByCode(companyId, '1000');
        const bankAcct = await getAccountByCode(companyId, '1200') || cashAcct;
        const capAcct  = await getAccountByCode(companyId, '3000');
        const moneyAcct = pMode !== 'CASH' ? bankAcct : cashAcct;

        if (moneyAcct && capAcct) {
            await createTransactionInternal(client, {
                company_id: companyId, branch_id: branchId, transaction_date: tDate,
                reference_type: 'PROPRIETOR', reference_id: record.id,
                description: `Drawings (Withdrawal) via ${pMode}`, created_by: req.user.id, bill_purpose: 'real'
            }, [
                { account_id: capAcct.id, debit_amount: amt, credit_amount: 0, description: 'Drawings debit capital' },
                { account_id: moneyAcct.id, debit_amount: 0, credit_amount: amt, description: `Paid via ${pMode}` }
            ]);
        }

        if (pMode === 'CASH') {
            await client.query(
                `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date) VALUES ($1,$2,'PROPRIETOR',$3,'out',$4)`,
                [companyId, branchId, amt, tDate]
            );
        } else {
            await client.query(
                `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date) VALUES ($1,$2,'PROPRIETOR',$3,'out','Main Account',$4,$5)`,
                [companyId, branchId, amt, `PROP-${record.id}`, tDate]
            );
        }

        await client.query('COMMIT');
        res.status(201).json(record);
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Drawings error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

// POST /capital — Capital Introduction / Investment (affects cash/bank ledger)
router.post('/capital', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id || 1;
    const { amount, payment_mode, transaction_date, notes } = req.body;
    if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'Valid amount required' });

    const amt   = parseFloat(amount);
    const pMode = (payment_mode || 'CASH').toUpperCase();
    const tDate = transaction_date || new Date().toISOString().split('T')[0];

    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        const row = await client.query(
            `INSERT INTO proprietor_transactions (company_id, branch_id, transaction_type, amount, payment_mode, transaction_date, notes, created_by)
             VALUES ($1,$2,'CAPITAL_INTRO',$3,$4,$5,$6,$7) RETURNING *`,
            [companyId, branchId, amt, pMode, tDate, notes || null, req.user.id]
        );
        const record = row.rows[0];

        const cashAcct  = await getAccountByCode(companyId, '1000');
        const bankAcct  = await getAccountByCode(companyId, '1200') || cashAcct;
        const capAcct   = await getAccountByCode(companyId, '3000');
        const moneyAcct = pMode !== 'CASH' ? bankAcct : cashAcct;

        if (moneyAcct && capAcct) {
            await createTransactionInternal(client, {
                company_id: companyId, branch_id: branchId, transaction_date: tDate,
                reference_type: 'PROPRIETOR', reference_id: record.id,
                description: `Capital Introduction via ${pMode}`, created_by: req.user.id, bill_purpose: 'real'
            }, [
                { account_id: moneyAcct.id, debit_amount: amt, credit_amount: 0, description: `Capital received via ${pMode}` },
                { account_id: capAcct.id, debit_amount: 0, credit_amount: amt, description: 'Proprietor capital increase' }
            ]);
        }

        if (pMode === 'CASH') {
            await client.query(
                `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date) VALUES ($1,$2,'PROPRIETOR',$3,'in',$4)`,
                [companyId, branchId, amt, tDate]
            );
        } else {
            await client.query(
                `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date) VALUES ($1,$2,'PROPRIETOR',$3,'in','Main Account',$4,$5)`,
                [companyId, branchId, amt, `PROP-${record.id}`, tDate]
            );
        }

        await client.query('COMMIT');
        res.status(201).json(record);
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Capital intro error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

// POST /personal-receipt — Customer paid to personal account
//   → records in proprietor_transactions
//   → credits customer_ledger (reduces what customer owes)
router.post('/personal-receipt', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id || 1;
    const { amount, personal_account_id, party_id, party_name, reference_id, reference_type, transaction_date, notes } = req.body;
    if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'Valid amount required' });
    if (!personal_account_id) return res.status(400).json({ error: 'personal_account_id is required' });

    const amt       = parseFloat(amount);
    const tDate     = transaction_date || new Date().toISOString().split('T')[0];
    // party_id from frontend (customer id); fall back to reference_id for backward compat
    const customerId = party_id ? parseInt(party_id) : (reference_id ? parseInt(reference_id) : null);

    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        const row = await client.query(
            `INSERT INTO proprietor_transactions
             (company_id, branch_id, transaction_type, amount, payment_mode, transaction_date, notes, created_by,
              personal_account_id, party_name, reference_id, reference_type)
             VALUES ($1,$2,'PERSONAL_RECEIPT',$3,'PERSONAL',$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [companyId, branchId, amt, tDate, notes || null, req.user.id,
             personal_account_id, party_name || null, customerId, 'customer']
        );
        const record = row.rows[0];

        // ── Update customer ledger via transactions table (what the ledger UI reads) ──
        if (customerId) {
            try {
                await client.query(
                    `INSERT INTO transactions
                       (company_id, branch_id, transaction_date, reference_type, reference_id,
                        description, created_by, user_id, amount, type, category, date, bill_purpose)
                     VALUES ($1,$2,$3,'PERSONAL_RECEIPT',$4,$5,$6,$4,$7,'CUSTOMER_PAYMENT','PAYMENT',$8,'real')`,
                    [companyId, branchId, tDate, customerId,
                     `Payment received via proprietor personal account${notes ? ' - ' + notes : ''}`,
                     req.user.id, amt, tDate]
                );
            } catch (ledgerErr) {
                console.warn('transactions personal-receipt insert skipped:', ledgerErr.message);
            }
        }

        await client.query('COMMIT');
        res.status(201).json(record);
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Personal receipt error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

// POST /personal-payment — Paid supplier from personal account
//   → records in proprietor_transactions
//   → reduces supplier current_balance (payment made reduces what we owe supplier)
router.post('/personal-payment', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id || 1;
    const { amount, personal_account_id, party_id, party_name, reference_id, reference_type, transaction_date, notes } = req.body;
    if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'Valid amount required' });
    if (!personal_account_id) return res.status(400).json({ error: 'personal_account_id is required' });

    const amt        = parseFloat(amount);
    const tDate      = transaction_date || new Date().toISOString().split('T')[0];
    const supplierId = party_id ? parseInt(party_id) : (reference_id ? parseInt(reference_id) : null);

    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        const row = await client.query(
            `INSERT INTO proprietor_transactions
             (company_id, branch_id, transaction_type, amount, payment_mode, transaction_date, notes, created_by,
              personal_account_id, party_name, reference_id, reference_type)
             VALUES ($1,$2,'PERSONAL_PAYMENT',$3,'PERSONAL',$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [companyId, branchId, amt, tDate, notes || null, req.user.id,
             personal_account_id, party_name || null, supplierId, 'supplier']
        );
        const record = row.rows[0];

        // ── Update supplier balance: reduce what we owe (payment made) ──
        if (supplierId) {
            await client.query(
                `UPDATE suppliers
                 SET current_balance = GREATEST(0, current_balance - $1)
                 WHERE id = $2 AND company_id = $3`,
                [amt, supplierId, companyId]
            );
        }

        await client.query('COMMIT');
        res.status(201).json(record);
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Personal payment error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

// POST /sync-customer-ledger — Backfill missing customer_ledger credits for old PERSONAL_RECEIPT entries
router.post('/sync-customer-ledger', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id || 1;
    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        // Fetch ALL PERSONAL_RECEIPT transactions for this company
        const allReceipts = await client.query(`
            SELECT pt.id, pt.amount, pt.transaction_date, pt.party_name, pt.reference_id, pt.notes
            FROM proprietor_transactions pt
            WHERE pt.company_id = $1
              AND pt.transaction_type = 'PERSONAL_RECEIPT'
        `, [companyId]);

        const inserted = [];

        for (const row of allReceipts.rows) {
            let customerId = row.reference_id ? parseInt(row.reference_id) : null;

            // If reference_id is missing but party_name exists, look up customer by name
            if (!customerId && row.party_name) {
                const custRow = await client.query(
                    `SELECT id FROM users WHERE company_id = $1 AND LOWER(username) = LOWER($2) LIMIT 1`,
                    [companyId, row.party_name.trim()]
                );
                if (custRow.rows.length > 0) {
                    customerId = custRow.rows[0].id;
                    // Also patch the proprietor_transactions row so future syncs work faster
                    await client.query(
                        `UPDATE proprietor_transactions SET reference_id = $1, reference_type = 'customer' WHERE id = $2`,
                        [customerId, row.id]
                    );
                }
            }

            if (!customerId) continue; // Can't resolve customer — skip

            // Check if a transactions entry already exists for this proprietor receipt
            const exists = await client.query(`
                SELECT 1 FROM transactions
                WHERE company_id = $1
                  AND reference_id = $2
                  AND type = 'CUSTOMER_PAYMENT'
                  AND reference_type = 'PERSONAL_RECEIPT'
                  AND amount = $3
                  AND date = $4
                LIMIT 1
            `, [companyId, customerId, row.amount, row.transaction_date]);

            if (exists.rows.length > 0) continue; // Already present — skip

            await client.query(
                `INSERT INTO transactions
                   (company_id, branch_id, transaction_date, reference_type, reference_id,
                    description, user_id, amount, type, category, date, bill_purpose)
                 VALUES ($1,$2,$3,'PERSONAL_RECEIPT',$4,$5,$4,$6,'CUSTOMER_PAYMENT','PAYMENT',$7,'real')`,
                [companyId, branchId, row.transaction_date, customerId,
                 `Payment received via proprietor personal account${row.notes ? ' - ' + row.notes : ''}`,
                 row.amount, row.transaction_date]
            );
            inserted.push({ id: row.id, party_name: row.party_name, amount: row.amount, date: row.transaction_date });
        }

        await client.query('COMMIT');
        res.json({ synced: inserted.length, entries: inserted });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Sync customer ledger error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

// PUT /:id — Edit a proprietor transaction (amount, date, notes, payment_mode)
router.put('/:id', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { id } = req.params;
    const { amount, transaction_date, notes, payment_mode, personal_account_id, party_id, party_name } = req.body;

    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        const existing = await client.query(
            `SELECT * FROM proprietor_transactions WHERE id = $1 AND company_id = $2`,
            [id, companyId]
        );
        if (existing.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const tx = existing.rows[0];
        const newAmt = amount ? parseFloat(amount) : parseFloat(tx.amount);
        const newDate = transaction_date || tx.transaction_date;
        const newNotes = notes !== undefined ? notes : tx.notes;
        const newMode = payment_mode || tx.payment_mode;
        const newPAId = personal_account_id ? parseInt(personal_account_id) : tx.personal_account_id;
        const customerId = party_id ? parseInt(party_id) : tx.reference_id;
        const newPartyName = party_name !== undefined ? party_name : tx.party_name;

        await client.query(
            `UPDATE proprietor_transactions
             SET amount = $1, transaction_date = $2, notes = $3, payment_mode = $4,
                 personal_account_id = $5, party_name = $6, reference_id = $7, updated_at = NOW()
             WHERE id = $8 AND company_id = $9`,
            [newAmt, newDate, newNotes, newMode, newPAId, newPartyName, customerId, id, companyId]
        );

        // If it's a PERSONAL_RECEIPT, update the transactions entry too
        if (tx.transaction_type === 'PERSONAL_RECEIPT' && customerId) {
            await client.query(
                `UPDATE transactions
                 SET amount = $1, transaction_date = $2, date = $2, description = $3
                 WHERE company_id = $4 AND reference_id = $5
                   AND type = 'CUSTOMER_PAYMENT' AND reference_type = 'PERSONAL_RECEIPT'`,
                [newAmt, newDate,
                 `Payment received via proprietor personal account${newNotes ? ' - ' + newNotes : ''}`,
                 companyId, customerId]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Proprietor update error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

// DELETE /:id — Delete a proprietor transaction
router.delete('/:id', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { id } = req.params;

    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        const existing = await client.query(
            `SELECT * FROM proprietor_transactions WHERE id = $1 AND company_id = $2`,
            [id, companyId]
        );
        if (existing.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const tx = existing.rows[0];

        // If PERSONAL_RECEIPT, remove the linked customer ledger entry too
        if (tx.transaction_type === 'PERSONAL_RECEIPT' && tx.reference_id) {
            await client.query(
                `DELETE FROM transactions
                 WHERE company_id = $1 AND reference_id = $2
                   AND type = 'CUSTOMER_PAYMENT' AND reference_type = 'PERSONAL_RECEIPT'
                   AND amount = $3`,
                [companyId, tx.reference_id, tx.amount]
            );
        }

        await client.query(
            `DELETE FROM proprietor_transactions WHERE id = $1 AND company_id = $2`,
            [id, companyId]
        );

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Proprietor delete error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
    }
});

// Backward-compat POST / (maps WITHDRAWAL→drawings, INVESTMENT→capital)
router.post('/', authMiddleware, async (req, res) => {
    const { transaction_type } = req.body;
    if (transaction_type === 'WITHDRAWAL') {
        req.url = '/drawings';
        return router.handle(Object.assign(req, { url: '/drawings', path: '/drawings', method: 'POST' }), res, () => {});
    }
    if (transaction_type === 'INVESTMENT') {
        req.url = '/capital';
        return router.handle(Object.assign(req, { url: '/capital', path: '/capital', method: 'POST' }), res, () => {});
    }
    return res.status(400).json({ error: 'Use /drawings or /capital instead' });
});

export default router;
