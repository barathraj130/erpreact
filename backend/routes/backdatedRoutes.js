// backend/routes/backdatedRoutes.js
//
// Backdated transaction entries — historical corrections that show up in
// past reports for their real date, but never touch the live cash/bank
// balance. Deliberately kept separate from cash_ledger/bank_ledger and the
// opening-balance adjustment mechanism those use (the source of a long
// string of balance-drift bugs) — this table is additive-only, and
// affects_balance is always false, so the live balance can never be
// disturbed by anything in this file, by construction rather than by
// compensation.
//
// New file only — no existing route file, table or API response touched.
import express from "express";
import * as db from "../database/pg.js";
import authMiddleware from "../middlewares/jwtAuthMiddleware.js";

const router = express.Router();

const requireAdmin = (req, res, next) => {
    if (!['admin', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin only — backdated entries require admin access' });
    }
    next();
};

// Self-heals on first use, same pattern used throughout this codebase
// (e.g. ensureExpenseEntriesTable in transactionRoutes.js) — no migration
// runner in this project, schema is created lazily on demand.
let tablesEnsured = false;
const ensureBackdatedTables = async () => {
    if (tablesEnsured) return;
    await db.pgRun(`
        CREATE TABLE IF NOT EXISTS backdated_transactions (
            id                   SERIAL PRIMARY KEY,
            company_id           INTEGER NOT NULL,
            branch_id            INTEGER REFERENCES branches(id),
            transaction_type     VARCHAR(30) NOT NULL
                CHECK (transaction_type IN (
                    'cash_in','cash_out','bank_in','bank_out','sale','purchase',
                    'expense','payment_received','payment_made','opening_balance',
                    'adjustment','other'
                )),
            transaction_date     DATE NOT NULL,
            amount               NUMERIC(14,2) NOT NULL,
            description          TEXT NOT NULL,
            reference_number     VARCHAR(100),
            party_name           VARCHAR(200),
            party_type           VARCHAR(20)
                CHECK (party_type IN ('customer','supplier','employee','other') OR party_type IS NULL),
            party_id             INTEGER,
            account_type         VARCHAR(20) DEFAULT 'cash'
                CHECK (account_type IN ('cash','bank')),
            bank_account_name    VARCHAR(100),
            payment_mode         VARCHAR(30) DEFAULT 'cash',
            category             VARCHAR(100),
            affects_reports      BOOLEAN DEFAULT true,
            affects_balance      BOOLEAN DEFAULT false,
            backdated_reason     TEXT NOT NULL,
            backdated_by         INTEGER REFERENCES users(id),
            backdated_at         TIMESTAMP DEFAULT NOW(),
            approved_by          INTEGER REFERENCES users(id),
            approved_at          TIMESTAMP,
            approval_status      VARCHAR(20) DEFAULT 'approved'
                CHECK (approval_status IN ('pending','approved','rejected')),
            is_reversed          BOOLEAN DEFAULT false,
            reversed_by          INTEGER REFERENCES users(id),
            reversed_at          TIMESTAMP,
            reversal_reason      TEXT,
            original_transaction_id INTEGER,
            notes                TEXT,
            created_at           TIMESTAMP DEFAULT NOW(),
            updated_at           TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => {});
    await db.pgRun(`
        CREATE TABLE IF NOT EXISTS backdated_audit (
            id                        SERIAL PRIMARY KEY,
            company_id                INTEGER NOT NULL,
            backdated_transaction_id  INTEGER REFERENCES backdated_transactions(id),
            action                    VARCHAR(50) NOT NULL,
            done_by                   INTEGER REFERENCES users(id),
            done_by_name              VARCHAR(200),
            previous_data             JSONB,
            new_data                  JSONB,
            ip_address                VARCHAR(50),
            notes                     TEXT,
            created_at                TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => {});
    await db.pgRun(`CREATE INDEX IF NOT EXISTS idx_bd_company_date ON backdated_transactions(company_id, transaction_date)`).catch(() => {});
    await db.pgRun(`CREATE INDEX IF NOT EXISTS idx_bd_type ON backdated_transactions(transaction_type, company_id)`).catch(() => {});
    await db.pgRun(`CREATE INDEX IF NOT EXISTS idx_bd_party ON backdated_transactions(party_id, party_type)`).catch(() => {});
    await db.pgRun(`CREATE INDEX IF NOT EXISTS idx_bd_branch ON backdated_transactions(branch_id, transaction_date)`).catch(() => {});
    await db.pgRun(`CREATE INDEX IF NOT EXISTS idx_bd_audit ON backdated_audit(backdated_transaction_id)`).catch(() => {});
    tablesEnsured = true;
};

const logBackdatedAudit = async (client, companyId, transactionId, action, doneBy, doneByName, prevData, newData, ip) => {
    await client.query(`
        INSERT INTO backdated_audit (
            company_id, backdated_transaction_id, action, done_by, done_by_name,
            previous_data, new_data, ip_address
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [
        companyId, transactionId, action, doneBy, doneByName,
        prevData ? JSON.stringify(prevData) : null,
        newData ? JSON.stringify(newData) : null,
        ip
    ]);
};

// ── POST /api/backdated/create ──────────────────────────────────────────
router.post('/create', authMiddleware, requireAdmin, async (req, res) => {
    await ensureBackdatedTables();
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const {
            transaction_type, transaction_date, amount, description,
            reference_number, party_name, party_type, party_id,
            account_type, bank_account_name, payment_mode, category,
            backdated_reason, branch_id, notes
        } = req.body;

        if (!transaction_type) throw new Error('Transaction type required');
        if (!transaction_date) throw new Error('Transaction date required');
        if (!amount || parseFloat(amount) <= 0) throw new Error('Amount must be greater than zero');
        if (!description) throw new Error('Description required');
        if (!backdated_reason || backdated_reason.trim().length < 5) {
            throw new Error('Backdated reason required — explain why this was not entered at the time');
        }

        const entryDate = new Date(transaction_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (entryDate >= today) {
            throw new Error('Backdated entries must be for a past date — use normal entry for today or future');
        }

        const companyId = req.user.active_company_id;

        const result = await client.query(`
            INSERT INTO backdated_transactions (
                company_id, branch_id, transaction_type, transaction_date,
                amount, description, reference_number,
                party_name, party_type, party_id,
                account_type, bank_account_name, payment_mode, category,
                affects_reports, affects_balance,
                backdated_reason, backdated_by, backdated_at,
                approval_status, notes
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
                true, false,
                $15,$16,NOW(),'approved',$17
            ) RETURNING *
        `, [
            companyId,
            branch_id || req.user.branch_id || null,
            transaction_type,
            transaction_date,
            parseFloat(amount),
            description,
            reference_number || null,
            party_name || null,
            party_type || null,
            party_id || null,
            account_type || 'cash',
            bank_account_name || null,
            payment_mode || 'cash',
            category || null,
            backdated_reason.trim(),
            req.user.id,
            notes || null
        ]);

        const transaction = result.rows[0];

        await logBackdatedAudit(
            client, companyId, transaction.id, 'created',
            req.user.id, req.user.username,
            null, transaction, req.ip
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            transaction_id: transaction.id,
            message: `Backdated entry recorded for ${transaction_date}. It will appear in historical reports but does NOT affect current balance.`,
            warning: 'This entry is marked as backdated. Current ledger balance unchanged.',
            transaction
        });
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Backdated create error:', e.message);
        res.json({ success: false, error: e.message });
    } finally {
        client.release();
    }
});

// ── GET /api/backdated/list ──────────────────────────────────────────────
router.get('/list', authMiddleware, requireAdmin, async (req, res) => {
    await ensureBackdatedTables();
    try {
        const companyId = req.user.active_company_id;
        const { from, to, type, branch_id } = req.query;

        let where = 'WHERE bt.company_id=$1 AND bt.is_reversed=false';
        const params = [companyId];
        let pc = 1;

        if (from) { pc++; where += ` AND bt.transaction_date>=$${pc}`; params.push(from); }
        if (to) { pc++; where += ` AND bt.transaction_date<=$${pc}`; params.push(to); }
        if (type) { pc++; where += ` AND bt.transaction_type=$${pc}`; params.push(type); }
        if (branch_id) { pc++; where += ` AND bt.branch_id=$${pc}`; params.push(branch_id); }

        const transactions = await db.pgAll(`
            SELECT bt.*,
                u.username AS backdated_by_name,
                a.username AS approved_by_name,
                b.branch_name AS branch_name
            FROM backdated_transactions bt
            LEFT JOIN users u ON u.id=bt.backdated_by
            LEFT JOIN users a ON a.id=bt.approved_by
            LEFT JOIN branches b ON b.id=bt.branch_id
            ${where}
            ORDER BY bt.transaction_date DESC, bt.created_at DESC
        `, params);

        const summary = await db.pgGet(`
            SELECT
                COUNT(*) AS total_entries,
                COALESCE(SUM(CASE WHEN transaction_type IN ('cash_in','bank_in','sale','payment_received') THEN amount ELSE 0 END),0) AS total_credits,
                COALESCE(SUM(CASE WHEN transaction_type IN ('cash_out','bank_out','purchase','expense','payment_made') THEN amount ELSE 0 END),0) AS total_debits,
                COUNT(DISTINCT transaction_date) AS dates_affected,
                MIN(transaction_date) AS earliest_date,
                MAX(transaction_date) AS latest_date
            FROM backdated_transactions
            WHERE company_id=$1 AND is_reversed=false
        `, [companyId]);

        res.json({ transactions, summary: summary || {} });
    } catch (e) {
        console.error('[backdated/list]', e.message);
        res.json({ transactions: [], summary: {} });
    }
});

// ── GET /api/backdated/report — for report integration ──────────────────
router.get('/report', authMiddleware, async (req, res) => {
    await ensureBackdatedTables();
    try {
        const companyId = req.user.active_company_id;
        const { from, to, account_type, branch_id } = req.query;

        if (!from || !to) {
            return res.json({ entries: [], total_credit: 0, total_debit: 0, net: 0 });
        }

        let where = `WHERE bt.company_id=$1
            AND bt.transaction_date BETWEEN $2 AND $3
            AND bt.affects_reports=true
            AND bt.is_reversed=false
            AND bt.approval_status='approved'`;
        const params = [companyId, from, to];
        let pc = 3;

        if (account_type) { pc++; where += ` AND bt.account_type=$${pc}`; params.push(account_type); }
        if (branch_id) { pc++; where += ` AND bt.branch_id=$${pc}`; params.push(branch_id); }

        const entries = await db.pgAll(`
            SELECT bt.*,
                u.username AS entered_by,
                b.branch_name AS branch_name
            FROM backdated_transactions bt
            LEFT JOIN users u ON u.id=bt.backdated_by
            LEFT JOIN branches b ON b.id=bt.branch_id
            ${where}
            ORDER BY bt.transaction_date ASC, bt.created_at ASC
        `, params);

        const totals = entries.reduce((acc, t) => {
            const isCredit = ['cash_in', 'bank_in', 'sale', 'payment_received', 'opening_balance'].includes(t.transaction_type);
            if (isCredit) acc.total_credit += parseFloat(t.amount || 0);
            else acc.total_debit += parseFloat(t.amount || 0);
            return acc;
        }, { total_credit: 0, total_debit: 0 });

        res.json({
            entries,
            total_credit: totals.total_credit,
            total_debit: totals.total_debit,
            net: totals.total_credit - totals.total_debit
        });
    } catch (e) {
        console.error('[backdated/report]', e.message);
        res.json({ entries: [], total_credit: 0, total_debit: 0, net: 0 });
    }
});

// ── POST /api/backdated/reverse/:id ──────────────────────────────────────
router.post('/reverse/:id', authMiddleware, requireAdmin, async (req, res) => {
    await ensureBackdatedTables();
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const { reversal_reason } = req.body;
        if (!reversal_reason || reversal_reason.trim().length < 5) {
            throw new Error('Reversal reason required');
        }

        const companyId = req.user.active_company_id;

        const txRes = await client.query(
            'SELECT * FROM backdated_transactions WHERE id=$1 AND company_id=$2',
            [req.params.id, companyId]
        );
        const tx = txRes.rows[0];
        if (!tx) throw new Error('Transaction not found');
        if (tx.is_reversed) throw new Error('This entry is already reversed');

        await client.query(`
            UPDATE backdated_transactions SET
                is_reversed=true,
                reversed_by=$1,
                reversed_at=NOW(),
                reversal_reason=$2,
                updated_at=NOW()
            WHERE id=$3
        `, [req.user.id, reversal_reason, req.params.id]);

        await logBackdatedAudit(
            client, companyId, tx.id, 'reversed',
            req.user.id, req.user.username,
            tx, { is_reversed: true, reversal_reason }, req.ip
        );

        await client.query('COMMIT');

        res.json({ success: true, message: 'Backdated entry reversed — it will no longer appear in reports' });
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        res.json({ success: false, error: e.message });
    } finally {
        client.release();
    }
});

// ── GET /api/backdated/:id — single entry with audit trail ──────────────
router.get('/:id', authMiddleware, requireAdmin, async (req, res) => {
    await ensureBackdatedTables();
    try {
        const companyId = req.user.active_company_id;

        const [transaction, auditTrail] = await Promise.all([
            db.pgGet(`
                SELECT bt.*,
                    u.username AS backdated_by_name,
                    a.username AS approved_by_name,
                    rv.username AS reversed_by_name,
                    b.branch_name AS branch_name
                FROM backdated_transactions bt
                LEFT JOIN users u ON u.id=bt.backdated_by
                LEFT JOIN users a ON a.id=bt.approved_by
                LEFT JOIN users rv ON rv.id=bt.reversed_by
                LEFT JOIN branches b ON b.id=bt.branch_id
                WHERE bt.id=$1 AND bt.company_id=$2
            `, [req.params.id, companyId]),
            db.pgAll(`
                SELECT ba.*, u.username AS done_by_name
                FROM backdated_audit ba
                LEFT JOIN users u ON u.id=ba.done_by
                WHERE ba.backdated_transaction_id=$1
                ORDER BY ba.created_at ASC
            `, [req.params.id])
        ]);

        if (!transaction) return res.json({ error: 'Not found' });

        res.json({ transaction, audit_trail: auditTrail });
    } catch (e) {
        res.json({ error: e.message });
    }
});

export default router;
