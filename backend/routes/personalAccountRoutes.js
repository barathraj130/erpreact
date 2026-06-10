import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

// Ensure table exists (handles production DBs that haven't run migrations)
const ensureTable = async () => {
    await db.pgRun(`
        CREATE TABLE IF NOT EXISTS personal_accounts (
            id             SERIAL PRIMARY KEY,
            company_id     INTEGER NOT NULL,
            account_name   VARCHAR(100) NOT NULL,
            account_type   VARCHAR(20) NOT NULL DEFAULT 'upi',
            upi_id         VARCHAR(100),
            bank_name      VARCHAR(100),
            account_number VARCHAR(100),
            ifsc_code      VARCHAR(50),
            holder_name    VARCHAR(100),
            notes          TEXT,
            is_active      BOOLEAN DEFAULT true,
            created_at     TIMESTAMP DEFAULT NOW(),
            updated_at     TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => {});
    // Add personal_account_id to proprietor_transactions if missing
    await db.pgRun(`ALTER TABLE proprietor_transactions ADD COLUMN IF NOT EXISTS personal_account_id INTEGER`).catch(() => {});
    await db.pgRun(`ALTER TABLE proprietor_transactions ADD COLUMN IF NOT EXISTS party_name VARCHAR(255)`).catch(() => {});
    await db.pgRun(`ALTER TABLE proprietor_transactions ADD COLUMN IF NOT EXISTS reference_id INTEGER`).catch(() => {});
    await db.pgRun(`ALTER TABLE proprietor_transactions ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50)`).catch(() => {});
};

router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        await ensureTable();
        const rows = await db.pgAll(`
            SELECT pa.*,
                COALESCE(SUM(CASE WHEN pt.transaction_type IN ('PERSONAL_RECEIPT') THEN pt.amount ELSE 0 END), 0) as total_received,
                COALESCE(SUM(CASE WHEN pt.transaction_type IN ('PERSONAL_PAYMENT') THEN pt.amount ELSE 0 END), 0) as total_paid
            FROM personal_accounts pa
            LEFT JOIN proprietor_transactions pt ON pt.personal_account_id = pa.id AND pt.company_id = $1
            WHERE pa.company_id = $1
            GROUP BY pa.id
            ORDER BY pa.is_active DESC, pa.account_name ASC
        `, [companyId]);
        res.json(rows);
    } catch (err) {
        console.error('Personal accounts fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch personal accounts' });
    }
});

router.post('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { account_name, account_type, upi_id, bank_name, account_number, ifsc_code, holder_name, notes } = req.body;
    if (!account_name) return res.status(400).json({ error: 'account_name is required' });
    try {
        await ensureTable();
        const row = await db.pgGet(`
            INSERT INTO personal_accounts (company_id, account_name, account_type, upi_id, bank_name, account_number, ifsc_code, holder_name, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
        `, [companyId, account_name, account_type || 'upi', upi_id || null, bank_name || null, account_number || null, ifsc_code || null, holder_name || null, notes || null]);
        res.status(201).json(row);
    } catch (err) {
        console.error('Personal account create error:', err);
        res.status(500).json({ error: err.message || 'Failed to create personal account' });
    }
});

router.put('/:id', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { id } = req.params;
    const fields = ['account_name', 'account_type', 'upi_id', 'bank_name', 'account_number', 'ifsc_code', 'holder_name', 'notes', 'is_active'];
    const updates = [];
    const values = [];
    fields.forEach(f => {
        if (req.body[f] !== undefined) {
            updates.push(`${f} = $${values.length + 1}`);
            values.push(req.body[f]);
        }
    });
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push(`updated_at = NOW()`);
    values.push(id, companyId);
    try {
        const row = await db.pgGet(
            `UPDATE personal_accounts SET ${updates.join(', ')} WHERE id = $${values.length - 1} AND company_id = $${values.length} RETURNING *`,
            values
        );
        res.json(row);
    } catch (err) {
        console.error('Personal account update error:', err);
        res.status(500).json({ error: 'Failed to update personal account' });
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        await db.pgRun(`DELETE FROM personal_accounts WHERE id = $1 AND company_id = $2`, [req.params.id, companyId]);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete' });
    }
});

export default router;
