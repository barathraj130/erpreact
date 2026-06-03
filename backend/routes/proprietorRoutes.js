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

        // ── Update customer ledger: CREDIT (payment received reduces outstanding) ──
        if (customerId) {
            try {
                await client.query(
                    `INSERT INTO customer_ledger (customer_id, company_id, branch_id, date, type, description, credit)
                     VALUES ($1,$2,$3,$4,'PERSONAL_RECEIPT',$5,$6)`,
                    [customerId, companyId, branchId, tDate,
                     `Payment received via proprietor personal account${notes ? ' - ' + notes : ''}`,
                     amt]
                );
            } catch (ledgerErr) {
                console.warn('customer_ledger personal-receipt insert skipped:', ledgerErr.message);
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
