// backend/routes/ledgerRoutes.js
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import * as supplierLedgerService from '../services/supplierLedgerService.js';
import { generateLedgerPdf } from '../utils/generateLedgerPDF.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_URL   = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
const LEDGERS_DIR   = path.join(__dirname, '../uploads/ledgers');

const router = express.Router();

/**
 * STEP 3 — Real ledger balance from PostgreSQL
 */
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    
    try {
        const sql = `
            SELECT 
                l.id as account_id, 
                l.name as account_name,
                l.opening_balance,
                l.is_dr as is_opening_dr,
                COALESCE(SUM(CASE WHEN t.type = 'DEBIT' THEN t.amount ELSE 0 END), 0) as total_debits,
                COALESCE(SUM(CASE WHEN t.type = 'CREDIT' THEN t.amount ELSE 0 END), 0) as total_credits
            FROM ledgers l
            LEFT JOIN transactions t ON l.id = t.ledger_id AND t.is_deleted = false
            WHERE l.company_id = $1 AND l.is_deleted = false
            GROUP BY l.id, l.name, l.opening_balance, l.is_dr
            ORDER BY l.name ASC
        `;
        
        const rows = await db.pgAll(sql, [companyId]);

        const ledgersWithBalance = rows.map(row => {
            const opening = Number(row.opening_balance || 0);
            const debits = Number(row.total_debits || 0);
            const credits = Number(row.total_credits || 0);
            
            let balance = row.is_opening_dr ? (opening + debits - credits) : (opening + credits - debits);
            
            return {
                account_id: row.account_id,
                account_name: row.account_name,
                total_debits: debits,
                total_credits: credits,
                balance: balance
            };
        });

        res.json(ledgersWithBalance);
    } catch (error) {
        console.error("Error fetching ledgers:", error.message);
        res.status(500).json({ error: "Failed to fetch ledgers." });
    }
});

// ── Live Cash & Bank balances (used by payment forms) ─────────────────────
router.get('/balance/current', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        // ── Self-heal step 0: fix NULL dates so they appear in date-filtered queries ──
        await db.pgRun(
            `UPDATE cash_ledger SET date = created_at::date
             WHERE company_id = $1 AND date IS NULL AND created_at IS NOT NULL`,
            [companyId]
        ).catch(()=>{});

        // Known inflow sources always count as positive regardless of stored direction
        // Self-heal: fix inflow sources stored with wrong direction='out'
        // NOTE: OPENING_BALANCE excluded — direction='out' is intentional when back-calculation
        // produces a negative needed value. Flipping it would destroy the balance correction.
        const INFLOW_SET = `'RECEIPT','INVOICE','Payment','payment','GIFT_CONTRIBUTION','LOAN_RECEIVED','LOAN_DISBURSEMENT'`;
        await Promise.all([
            db.pgRun(`UPDATE cash_ledger SET direction='in' WHERE company_id=$1 AND source IN (${INFLOW_SET}) AND direction='out' AND amount>0`, [companyId]).catch(()=>{}),
            db.pgRun(`UPDATE bank_ledger SET direction='in' WHERE company_id=$1 AND source IN (${INFLOW_SET}) AND direction='out' AND amount>0`, [companyId]).catch(()=>{}),
        ]);

        // ── Self-heal step 1: remove ALL auto-synced CUSTOMER_PAYMENT entries
        //    CUSTOMER_PAYMENT = money received into proprietor's personal account, NEVER company cash
        //    Delete those with reference_id IS NOT NULL (auto-synced) regardless of reference_type
        //    Also remove old source='CUSTOMER_PAYMENT' entries with reference_id=NULL (from old rebuild)
        await db.pgRun(`
            DELETE FROM cash_ledger
            WHERE company_id = $1
              AND source = 'CUSTOMER_PAYMENT'
              AND (
                reference_id IS NULL
                OR EXISTS (
                  SELECT 1 FROM transactions t
                  WHERE t.id = cash_ledger.reference_id AND t.type = 'CUSTOMER_PAYMENT'
                )
              )
        `, [companyId]).catch(()=>{});

        // ── Self-heal step 2: remove invoice-payment duplicates
        //    (already covered via invoice_id row; auto-synced duplicate has reference_id IS NOT NULL)
        await db.pgRun(`
            DELETE FROM cash_ledger
            WHERE company_id = $1
              AND reference_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM transactions t
                WHERE t.id = cash_ledger.reference_id
                  AND t.related_invoice_id IS NOT NULL
                  AND EXISTS (
                    SELECT 1 FROM cash_ledger cl2
                    WHERE cl2.company_id = $1
                      AND cl2.invoice_id = t.related_invoice_id
                      AND cl2.reference_id IS NULL
                  )
              )
        `, [companyId]).catch(()=>{});

        // ── Self-heal step 3: link invoice-creation entries to their transactions ──
        await db.pgRun(`
            UPDATE cash_ledger cl SET reference_id = t.id
            FROM transactions t
            WHERE cl.company_id = $1 AND cl.invoice_id IS NOT NULL AND cl.reference_id IS NULL
              AND t.company_id = $1 AND t.type = 'RECEIPT'
              AND t.related_invoice_id = cl.invoice_id AND ABS(t.amount) = cl.amount
        `, [companyId]).catch(()=>{});

        // ── Self-heal step 4a: remove cash_ledger entries whose transaction was marked excluded ──
        await db.pgRun(`
            DELETE FROM cash_ledger
            WHERE company_id = $1
              AND reference_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM transactions t
                WHERE t.id = cash_ledger.reference_id
                  AND t.bill_purpose = 'excluded'
              )
        `, [companyId]).catch(()=>{});

        // ── Self-heal step 4b: remove cash_ledger entries synced from PROPRIETOR_AC payments ──
        //    PROPRIETOR_AC payments go to proprietor's personal account, never company cash
        await db.pgRun(`
            DELETE FROM cash_ledger
            WHERE company_id = $1
              AND reference_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM transactions t
                WHERE t.id = cash_ledger.reference_id
                  AND COALESCE(t.meta->>'payment_method', '') = 'PROPRIETOR_AC'
              )
        `, [companyId]).catch(()=>{});

        // ── Self-heal step 4: sync RECEIPT transactions (company cash receipts) ──
        //    Skip transactions marked bill_purpose='excluded' (permanently deleted by user)
        //    Skip PROPRIETOR_AC payments — those go to proprietor's personal account, not company cash
        await db.pgRun(`
            INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date, reference_id)
            SELECT t.company_id, COALESCE(t.branch_id,1), t.type, t.amount, 'in',
                   COALESCE(t.date::date, t.transaction_date::date, CURRENT_DATE), t.id
            FROM transactions t
            WHERE t.company_id = $1
              AND t.type = 'RECEIPT'
              AND t.amount > 0
              AND COALESCE(t.bill_purpose, 'real') != 'excluded'
              AND COALESCE(t.meta->>'payment_method', '') != 'PROPRIETOR_AC'
              AND NOT EXISTS (SELECT 1 FROM cash_ledger cl WHERE cl.reference_id = t.id AND cl.company_id = $1)
        `, [companyId]).catch(()=>{});

        const branchId = req.query.branch_id ? parseInt(req.query.branch_id) : null;
        const branchFilter = branchId ? ` AND branch_id = ${branchId}` : '';

        const [cashRow, bankRow] = await Promise.all([
            db.pgGet(
                `SELECT COALESCE(SUM(CASE WHEN source IN (${INFLOW_SET}) THEN ABS(amount) WHEN direction='in' THEN amount ELSE -amount END), 0) AS balance
                 FROM cash_ledger WHERE company_id = $1${branchFilter}`,
                [companyId]
            ),
            db.pgGet(
                `SELECT COALESCE(SUM(CASE WHEN source IN (${INFLOW_SET}) THEN ABS(amount) WHEN direction='in' THEN amount ELSE -amount END), 0) AS balance
                 FROM bank_ledger WHERE company_id = $1${branchFilter}`,
                [companyId]
            ),
        ]);
        res.json({
            cash:  Number(cashRow?.balance  || 0),
            bank:  Number(bankRow?.balance  || 0),
        });
    } catch (err) {
        console.error('[balance/current]', err.message);
        res.status(500).json({ error: 'Failed to fetch balances' });
    }
});

router.get('/groups', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const groups = await db.pgAll('SELECT * FROM ledger_groups WHERE company_id = $1 ORDER BY name', [companyId]);
        res.json(groups);
    } catch (error) {
        console.error("Error fetching ledger groups:", error.message);
        res.status(500).json({ error: "Failed to fetch groups." });
    }
});

router.get('/report/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.active_company_id;
    
    try {
        const ledger = await db.pgGet(`SELECT * FROM ledgers WHERE id = $1 AND company_id = $2`, [id, companyId]);
        if (!ledger) return res.status(404).json({ error: "Ledger not found" });

        const transactions = await db.pgAll(`
            SELECT * FROM transactions 
            WHERE ledger_id = $1 AND company_id = $2
            ORDER BY transaction_date ASC, created_at ASC
        `, [id, companyId]);

        res.json({ 
            ledger, 
            transactions,
            opening_balance: ledger.opening_balance 
        });
    } catch (err) {
        console.error("Ledger report error:", err);
        res.status(500).json({ error: "Failed to fetch report" });
    }
});// Helper for branch filtering (centralized)
const getBranchFilter = (req) => {
    const headerBranch = req.headers['x-branch-id'];
    const role = req.user.role;
    const userBranch = req.user.branch_id;

    if (headerBranch && headerBranch !== 'all' && headerBranch !== 'null' && !isNaN(Number(headerBranch))) {
        return { filter: 'branch_id = ' + Number(headerBranch), branchId: Number(headerBranch) };
    }
    if (role === 'admin' && (!headerBranch || headerBranch === 'all')) {
        return { filter: '1=1', branchId: 'ALL' };
    }
    if (userBranch) {
        return { filter: 'branch_id = ' + userBranch, branchId: userBranch };
    }
    return { filter: '1=1', branchId: 'ALL' };
};

/**
 * Idempotent self-heal/sync pass for cash_ledger — same statements GET /cash runs
 * on every load. Extracted so POST /set-opening-balance can run it FIRST and see
 * the exact same table state GET will see immediately after (the reload the
 * frontend triggers on save). Without this, a sync insert/delete landing between
 * the POST's calculation and the following GET silently shifts the displayed
 * balance away from what was just set.
 */
const syncCashLedger = async (companyId) => {
    await Promise.all([
        db.pgRun(`ALTER TABLE cash_ledger ADD COLUMN IF NOT EXISTS notes TEXT`).catch(() => {}),
        db.pgRun(`ALTER TABLE cash_ledger ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(100)`).catch(() => {}),
    ]);

    await db.pgRun(
        `UPDATE cash_ledger SET date = created_at::date
         WHERE company_id = $1 AND date IS NULL AND created_at IS NOT NULL`,
        [companyId]
    ).catch(()=>{});

    // NOTE: OPENING_BALANCE deliberately excluded — it's a signed back-calculated
    // adjustment (see set-opening-balance) and can legitimately be direction='out'.
    // Force-flipping it to 'in' here silently undoes that calculation on every load.
    await db.pgRun(
        `UPDATE cash_ledger SET direction='in'
         WHERE company_id=$1
           AND source IN ('RECEIPT','INVOICE','Payment','payment','GIFT_CONTRIBUTION','LOAN_RECEIVED','LOAN_DISBURSEMENT')
           AND direction='out' AND amount>0`,
        [companyId]
    ).catch(()=>{});

    await db.pgRun(`
        DELETE FROM cash_ledger
        WHERE company_id = $1
          AND source = 'CUSTOMER_PAYMENT'
          AND (
            reference_id IS NULL
            OR EXISTS (
              SELECT 1 FROM transactions t
              WHERE t.id = cash_ledger.reference_id AND t.type = 'CUSTOMER_PAYMENT'
            )
          )
    `, [companyId]).catch(()=>{});

    await db.pgRun(`
        DELETE FROM cash_ledger
        WHERE company_id = $1
          AND reference_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM transactions t
            WHERE t.id = cash_ledger.reference_id
              AND t.related_invoice_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM cash_ledger cl2
                WHERE cl2.company_id = $1
                  AND cl2.invoice_id = t.related_invoice_id
                  AND cl2.reference_id IS NULL
              )
          )
    `, [companyId]).catch(()=>{});

    await db.pgRun(`
        UPDATE cash_ledger cl
        SET reference_id = t.id
        FROM transactions t
        WHERE cl.company_id = $1
          AND cl.invoice_id IS NOT NULL
          AND cl.reference_id IS NULL
          AND t.company_id = $1
          AND t.type = 'RECEIPT'
          AND t.related_invoice_id = cl.invoice_id
          AND ABS(t.amount) = cl.amount
    `, [companyId]).catch(()=>{});

    await db.pgRun(`
        DELETE FROM cash_ledger
        WHERE company_id = $1
          AND reference_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM transactions t
            WHERE t.id = cash_ledger.reference_id
              AND t.bill_purpose = 'excluded'
          )
    `, [companyId]).catch(()=>{});

    await db.pgRun(`
        DELETE FROM cash_ledger
        WHERE company_id = $1
          AND reference_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM transactions t
            WHERE t.id = cash_ledger.reference_id
              AND COALESCE(t.meta->>'payment_method', '') = 'PROPRIETOR_AC'
          )
    `, [companyId]).catch(()=>{});

    await db.pgRun(`
        INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date, reference_id)
        SELECT t.company_id, COALESCE(t.branch_id, 1), t.type, t.amount, 'in',
               COALESCE(t.date::date, t.transaction_date::date, CURRENT_DATE), t.id
        FROM transactions t
        WHERE t.company_id = $1
          AND t.type = 'RECEIPT'
          AND t.amount > 0
          AND COALESCE(t.bill_purpose, 'real') != 'excluded'
          AND COALESCE(t.meta->>'payment_method', '') != 'PROPRIETOR_AC'
          AND NOT EXISTS (SELECT 1 FROM cash_ledger cl WHERE cl.reference_id = t.id AND cl.company_id = $1)
    `, [companyId]).catch(()=>{});

    await db.pgRun(`
        INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date, invoice_id)
        SELECT i.company_id, COALESCE(i.branch_id, 1), 'payment', ip.amount, 'in',
               COALESCE(ip.payment_date::date, i.invoice_date::date, CURRENT_DATE),
               i.id
        FROM invoice_payments ip
        JOIN invoices i ON i.id = ip.invoice_id
        WHERE i.company_id = $1
          AND UPPER(ip.payment_method) = 'CASH'
          AND ip.amount > 0
          AND NOT EXISTS (
            SELECT 1 FROM cash_ledger cl
            WHERE cl.company_id = $1
              AND cl.invoice_id = i.id
              AND cl.amount = ip.amount
              AND cl.date = COALESCE(ip.payment_date::date, i.invoice_date::date, CURRENT_DATE)
          )
    `, [companyId]).catch(()=>{});
};

/** Same idea as syncCashLedger, for bank_ledger — see GET /bank for the original inline version. */
const syncBankLedger = async (companyId) => {
    await Promise.all([
        db.pgRun(`ALTER TABLE bank_ledger ADD COLUMN IF NOT EXISTS notes TEXT`).catch(() => {}),
        db.pgRun(`ALTER TABLE bank_ledger ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(100)`).catch(() => {}),
        db.pgRun(`CREATE TABLE IF NOT EXISTS purchase_returns (
            id               SERIAL PRIMARY KEY,
            company_id       INTEGER NOT NULL,
            branch_id        INTEGER DEFAULT 1,
            return_number    VARCHAR(50),
            original_bill_id INTEGER,
            supplier_id      INTEGER,
            supplier_name    VARCHAR(255),
            return_date      DATE NOT NULL DEFAULT CURRENT_DATE,
            items            JSONB NOT NULL DEFAULT '[]',
            total_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
            notes            TEXT,
            created_by       INTEGER,
            created_at       TIMESTAMP DEFAULT NOW()
        )`).catch(() => {}),
    ]);

    await db.pgRun(
        `UPDATE bank_ledger SET date = created_at::date
         WHERE company_id = $1 AND date IS NULL AND created_at IS NOT NULL`,
        [companyId]
    ).catch(()=>{});

    await db.pgRun(
        `UPDATE bank_ledger SET direction='in'
         WHERE company_id=$1
           AND source IN ('RECEIPT','INVOICE','Payment','INVOICE_PAYMENT','GIFT_CONTRIBUTION','LOAN_RECEIVED','LOAN_DISBURSEMENT')
           AND direction='out' AND amount>0`,
        [companyId]
    ).catch(()=>{});

    await db.pgRun(`
        DELETE FROM bank_ledger
        WHERE company_id = $1
          AND source = 'INVOICE_PAYMENT'
          AND EXISTS (
            SELECT 1 FROM bank_ledger bl2
            WHERE bl2.company_id = $1
              AND bl2.invoice_id IS NOT NULL
              AND bl2.amount = bank_ledger.amount
              AND bl2.date = bank_ledger.date
          )
    `, [companyId]).catch(()=>{});

    await db.pgRun(`
        INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date, invoice_id)
        SELECT i.company_id, COALESCE(i.branch_id, 1), 'payment', ip.amount, 'in',
               UPPER(ip.payment_method), COALESCE(ip.reference_no, '-'),
               COALESCE(ip.payment_date::date, i.invoice_date::date, CURRENT_DATE),
               i.id
        FROM invoice_payments ip
        JOIN invoices i ON i.id = ip.invoice_id
        WHERE i.company_id = $1
          AND UPPER(ip.payment_method) IN ('BANK','UPI','CHEQUE','NEFT','RTGS','IMPS')
          AND ip.amount > 0
          AND NOT EXISTS (
            SELECT 1 FROM bank_ledger bl
            WHERE bl.company_id = $1
              AND bl.invoice_id = i.id
              AND bl.amount = ip.amount
              AND bl.date = COALESCE(ip.payment_date::date, i.invoice_date::date, CURRENT_DATE)
          )
    `, [companyId]).catch(()=>{});
};


router.get('/cash', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    const { filter: branchFilter } = getBranchFilter(req);

    try {
        await syncCashLedger(companyId);

        // Opening balance = OPENING_BALANCE entry (always, regardless of date) +
        // net of all other cash transactions strictly BEFORE startDate
        const INFLOW_SOURCES_SQL = `'RECEIPT','INVOICE','Payment','payment','INVOICE_PAYMENT','GIFT_CONTRIBUTION','LOAN_RECEIVED','LOAN_DISBURSEMENT'`;
        const openingParams = [companyId];
        let openingSql = `
            SELECT COALESCE(SUM(CASE
                WHEN source = 'OPENING_BALANCE' THEN (CASE WHEN direction = 'in' THEN amount ELSE -amount END)
                WHEN source IN (${INFLOW_SOURCES_SQL}) THEN ABS(amount)
                WHEN direction = 'in' THEN amount
                ELSE -amount
            END), 0) AS balance
            FROM cash_ledger
            WHERE company_id = $1 AND ${branchFilter}
            AND (source = 'OPENING_BALANCE'
        `;
        if (startDate) {
            openingSql += ` OR date < $${openingParams.length + 1}`;
            openingParams.push(startDate);
        } else {
            openingSql += ` OR 1=1`;
        }
        openingSql += `)`;
        const openingRow = await db.pgGet(openingSql, openingParams);
        const opening_balance = Number(openingRow?.balance || 0);

        // Entries within the requested date range — exclude OPENING_BALANCE (always in b/d)
        const params = [companyId];
        let sql = `
            SELECT cl.*,
              CASE
                WHEN cl.invoice_id IS NOT NULL THEN
                  (SELECT u.username FROM invoices i JOIN users u ON u.id = i.customer_id WHERE i.id = cl.invoice_id LIMIT 1)
                WHEN cl.reference_id IS NOT NULL AND cl.source = 'RECEIPT' THEN
                  (SELECT u.username FROM transactions t JOIN users u ON u.id = t.user_id WHERE t.id = cl.reference_id LIMIT 1)
                WHEN cl.source = 'PROPRIETOR' THEN 'Proprietor'
                WHEN cl.source = 'CASH_TRANSFER' AND cl.direction = 'in' THEN 'From Bank'
                WHEN cl.source = 'CASH_TRANSFER' AND cl.direction = 'out' THEN 'To Bank'
                WHEN cl.source IN ('EXPENSE','SALARY','WAGES','PURCHASE') AND cl.reference_id IS NOT NULL THEN
                  (SELECT COALESCE(t.description, t.type) FROM transactions t WHERE t.id = cl.reference_id LIMIT 1)
                ELSE NULL
              END AS party_name
            FROM cash_ledger cl
            WHERE cl.company_id = $1 AND ${branchFilter} AND cl.source != 'OPENING_BALANCE'`;
        let pIndex = 2;
        if (startDate) { sql += ` AND cl.date >= $${pIndex++}`; params.push(startDate); }
        if (endDate)   { sql += ` AND cl.date <= $${pIndex++}`; params.push(endDate); }
        sql += ` ORDER BY cl.date ASC, cl.created_at ASC`;

        // NOTE: CUSTOMER_PAYMENT excluded — purged in Step 1, never reaches direction mapping
        // NOTE: CASH_RECONCILIATION is also excluded — it can be 'in' (excess) or 'out' (shortage), direction field controls it
        const INFLOW_SOURCES = new Set(['OPENING_BALANCE', 'RECEIPT', 'GIFT_CONTRIBUTION', 'LOAN_RECEIVED', 'LOAN_DISBURSEMENT', 'INVOICE', 'Payment', 'payment', 'INVOICE_PAYMENT']);
        const rawEntries = await db.pgAll(sql, params);
        // Correct direction for known inflow sources (fixes historically mis-recorded entries)
        // OPENING_BALANCE must always be 'in' regardless of how it was stored
        const entries = rawEntries.map(e => ({
            ...e,
            direction: INFLOW_SOURCES.has(e.source) ? 'in' : e.direction
        }));
        res.json({ entries, opening_balance });
    } catch (err) {
        console.error("Cash ledger error:", err);
        res.status(500).json({ error: "Failed to fetch cash ledger" });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /ledger/cash-reconciliation
// Record a daily cash count variance (excess or shortage)
// Body: { date, actual_cash, notes }
// Reads current computer balance up to and including `date`, computes variance,
// inserts one cash_ledger entry with source='CASH_RECONCILIATION'
// ══════════════════════════════════════════════════════════════════════════════
router.post('/cash-reconciliation', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId  = req.user.branch_id || 1;
    const { date, actual_cash, notes } = req.body;

    if (!date || actual_cash === undefined || actual_cash === null || actual_cash === '') {
        return res.status(400).json({ error: 'date and actual_cash are required' });
    }
    const actualCash = Number(actual_cash);
    if (isNaN(actualCash) || actualCash < 0) {
        return res.status(400).json({ error: 'actual_cash must be a non-negative number' });
    }

    try {
        // Compute computer balance up to and including the given date (exclude existing CASH_RECONCILIATION for that date to avoid double-count)
        const INFLOW_SOURCES_SQL = `'OPENING_BALANCE','RECEIPT','INVOICE','Payment','payment','GIFT_CONTRIBUTION','LOAN_RECEIVED','LOAN_DISBURSEMENT'`;
        const balRow = await db.pgGet(
            `SELECT COALESCE(SUM(CASE
                WHEN source IN (${INFLOW_SOURCES_SQL}) THEN ABS(amount)
                WHEN direction = 'in' THEN amount
                ELSE -amount
             END), 0) AS balance
             FROM cash_ledger
             WHERE company_id = $1
               AND date <= $2
               AND source != 'CASH_RECONCILIATION'`,
            [companyId, date]
        );
        const computerBalance = Number(balRow?.balance || 0);
        const variance = actualCash - computerBalance;   // positive = excess, negative = shortage

        if (variance === 0) {
            return res.json({ success: true, message: 'Balances match — no adjustment needed', computer_balance: computerBalance, actual_cash: actualCash, variance: 0 });
        }

        // Delete any existing reconciliation for the same date (re-reconcile is idempotent)
        await db.pgRun(
            `DELETE FROM cash_ledger WHERE company_id = $1 AND date = $2 AND source = 'CASH_RECONCILIATION'`,
            [companyId, date]
        );

        const direction = variance > 0 ? 'in' : 'out';
        const amount    = Math.abs(variance);

        await db.pgRun(
            `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
             VALUES ($1, $2, 'CASH_RECONCILIATION', $3, $4, $5)`,
            [companyId, branchId, amount, direction, date]
        );

        res.json({
            success: true,
            message: variance > 0 ? `Excess of ₹${amount.toFixed(2)} recorded` : `Shortage of ₹${amount.toFixed(2)} recorded`,
            computer_balance: computerBalance,
            actual_cash:      actualCash,
            variance,
            direction,
        });
    } catch (err) {
        console.error('[cash-reconciliation]', err.message);
        res.status(500).json({ error: 'Failed to record cash reconciliation' });
    }
});

router.get('/bank', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    const { filter: branchFilter } = getBranchFilter(req);

    try {
        await syncBankLedger(companyId);

        // Opening balance = OPENING_BALANCE entry (always, regardless of date) +
        // net of all other bank transactions strictly BEFORE startDate
        const INFLOW_SOURCES_SQL = `'RECEIPT','INVOICE','Payment','payment','INVOICE_PAYMENT','GIFT_CONTRIBUTION','LOAN_RECEIVED','LOAN_DISBURSEMENT'`;
        const openingParams = [companyId];
        let openingSql = `
            SELECT COALESCE(SUM(CASE
                WHEN source = 'OPENING_BALANCE' THEN (CASE WHEN direction = 'in' THEN amount ELSE -amount END)
                WHEN source IN (${INFLOW_SOURCES_SQL}) THEN ABS(amount)
                WHEN direction = 'in' THEN amount
                ELSE -amount
            END), 0) AS balance
            FROM bank_ledger
            WHERE company_id = $1 AND ${branchFilter}
            AND (source = 'OPENING_BALANCE'
        `;
        if (startDate) {
            openingSql += ` OR date < $${openingParams.length + 1}`;
            openingParams.push(startDate);
        } else {
            openingSql += ` OR 1=1`;
        }
        openingSql += `)`;
        const openingRow = await db.pgGet(openingSql, openingParams);
        const opening_balance = Number(openingRow?.balance || 0);

        // Entries within the requested date range — exclude OPENING_BALANCE (always in b/d)
        const params = [companyId];
        let sql = `
            SELECT bl.*,
              CASE
                WHEN bl.invoice_id IS NOT NULL THEN
                  (SELECT u.username FROM invoices i JOIN users u ON u.id = i.customer_id WHERE i.id = bl.invoice_id LIMIT 1)
                WHEN bl.source = 'CUSTOMER_PAYMENT' AND bl.reference_id IS NOT NULL THEN
                  (SELECT u.username FROM transactions t JOIN users u ON u.id = t.user_id WHERE t.id = bl.reference_id LIMIT 1)
                WHEN bl.source = 'PROPRIETOR' THEN 'Proprietor'
                WHEN bl.source = 'CASH_TRANSFER' AND bl.direction = 'in' THEN 'From Cash'
                WHEN bl.source = 'CASH_TRANSFER' AND bl.direction = 'out' THEN 'To Cash'
                WHEN bl.source = 'PURCHASE_RETURN' AND bl.reference_id IS NOT NULL THEN
                  (SELECT pr.supplier_name FROM purchase_returns pr WHERE pr.id = bl.reference_id LIMIT 1)
                WHEN bl.source IN ('EXPENSE','SALARY','WAGES','PURCHASE') AND bl.reference_id IS NOT NULL THEN
                  (SELECT COALESCE(t.description, t.type) FROM transactions t WHERE t.id = bl.reference_id LIMIT 1)
                ELSE NULL
              END AS party_name
            FROM bank_ledger bl
            WHERE bl.company_id = $1 AND ${branchFilter} AND bl.source != 'OPENING_BALANCE'`;
        let pIndex = 2;
        if (startDate) { sql += ` AND bl.date >= $${pIndex++}`; params.push(startDate); }
        if (endDate)   { sql += ` AND bl.date <= $${pIndex++}`; params.push(endDate); }
        sql += ` ORDER BY bl.date ASC, bl.created_at ASC`;

        const INFLOW_SOURCES = new Set(['OPENING_BALANCE', 'RECEIPT', 'GIFT_CONTRIBUTION', 'LOAN_RECEIVED', 'LOAN_DISBURSEMENT', 'INVOICE', 'Payment', 'payment', 'INVOICE_PAYMENT']);
        const rawEntries = await db.pgAll(sql, params);
        // OPENING_BALANCE must always be 'in' regardless of how it was stored
        const entries = rawEntries.map(e => ({
            ...e,
            direction: INFLOW_SOURCES.has(e.source) ? 'in' : e.direction
        }));
        res.json({ entries, opening_balance });
    } catch (err) {
        console.error("Bank ledger error:", err);
        res.status(500).json({ error: "Failed to fetch bank ledger" });
    }
});

router.get('/health-summary', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { filter: branchFilter, branchId } = getBranchFilter(req);
    const queryParams = [companyId];


    try {
        console.log(`📊 Health Summary [Co:${companyId}] using Filter: ${branchFilter}`);

        // ── Clean up duplicates before balance calc (same logic as bank ledger GET) ──
        await db.pgRun(`
            DELETE FROM bank_ledger
            WHERE company_id = $1
              AND source = 'INVOICE_PAYMENT'
              AND EXISTS (
                SELECT 1 FROM bank_ledger bl2
                WHERE bl2.company_id = $1
                  AND bl2.invoice_id IS NOT NULL
                  AND bl2.amount = bank_ledger.amount
                  AND bl2.date = bank_ledger.date
              )
        `, [companyId]).catch(()=>{});

        await db.pgRun(`
            DELETE FROM cash_ledger
            WHERE company_id = $1
              AND source = 'CUSTOMER_PAYMENT'
              AND (reference_id IS NULL OR EXISTS (
                SELECT 1 FROM transactions t
                WHERE t.id = cash_ledger.reference_id AND t.type = 'CUSTOMER_PAYMENT'
              ))
        `, [companyId]).catch(()=>{});

        // Use same INFLOW_SET as balance/current — no CUSTOMER_PAYMENT, includes lowercase 'payment'
        const INFLOW_SET = `'OPENING_BALANCE','RECEIPT','INVOICE','Payment','payment','GIFT_CONTRIBUTION','LOAN_RECEIVED','LOAN_DISBURSEMENT','INVOICE_PAYMENT'`;
        const cashRows = await db.pgGet(`SELECT COALESCE(SUM(CASE WHEN source IN (${INFLOW_SET}) THEN ABS(amount) WHEN direction = 'in' THEN amount ELSE -amount END), 0) as balance FROM cash_ledger WHERE company_id=$1 AND ${branchFilter}`, queryParams);
        let totalCash = Number(cashRows?.balance || 0);

        const bankRows = await db.pgGet(`SELECT COALESCE(SUM(CASE WHEN source = 'OPENING_BALANCE' THEN (CASE WHEN direction='in' THEN amount ELSE -amount END) WHEN source IN (${INFLOW_SET}) THEN ABS(amount) WHEN direction = 'in' THEN amount ELSE -amount END), 0) as balance FROM bank_ledger WHERE company_id=$1 AND ${branchFilter}`, queryParams);
        let totalBank = Number(bankRows?.balance || 0);

        const invoiceRows = await db.pgAll(`
            SELECT
                COALESCE(SUM(total_amount), 0) as total_invoice,
                COALESCE(SUM(paid_amount), 0) as total_payments
            FROM invoices
            WHERE company_id=$1 AND ${branchFilter}
              AND COALESCE(is_deleted, false) = false
              AND bill_purpose != 'name_only'
        `, queryParams);

        let totalSales = Number(invoiceRows[0]?.total_invoice || 0);
        let totalPayments = Number(invoiceRows[0]?.total_payments || 0);

        const txRows = await db.pgAll(`
            SELECT type, category, SUM(amount) as total
            FROM transactions
            WHERE company_id=$1 AND ${branchFilter}
            GROUP BY type, category
        `, queryParams);

        let totalExpenses = 0;
        txRows.forEach(r => {
            const amt = Number(r.total);
            if (['EXPENSE', 'EXPENSE_PAYMENT', 'PURCHASE'].includes(r.type)) {
                totalExpenses += amt;
            }
            // NOTE: RECEIPT/INCOME are customer payments — already captured in
            // paid_amount on invoices. Do NOT add them to totalSales or they
            // inflate INFLOW and RECEIVABLES with double-counted amounts.
        });

        const billRows = await db.pgAll(`
            SELECT SUM(total_amount) as total
            FROM purchase_bills
            WHERE company_id=$1 AND ${branchFilter}
              AND COALESCE(is_deleted, false) = false
        `, queryParams);
        totalExpenses += Number(billRows[0]?.total || 0);



        // ── Daily Sales from invoices (last 30 days) ──
        const dailySalesRows = await db.pgAll(`
            SELECT
                DATE(invoice_date) AS day,
                COALESCE(SUM(total_amount), 0) AS sales
            FROM invoices
            WHERE company_id=$1 AND ${branchFilter}
              AND COALESCE(is_deleted, false) = false
              AND bill_purpose != 'name_only'
              AND invoice_date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE(invoice_date)
            ORDER BY day ASC
        `, queryParams);

        // ── Daily Expenses from transactions (last 30 days) ──
        const dailyExpenseRows = await db.pgAll(`
            SELECT
                DATE(COALESCE(date, created_at::date)) AS day,
                COALESCE(SUM(amount), 0) AS expenses
            FROM transactions
            WHERE company_id=$1 AND ${branchFilter}
              AND type IN ('EXPENSE','EXPENSE_PAYMENT','SALARY','WAGES','DAILY_WAGE')
              AND COALESCE(date, created_at::date) >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY 1
            ORDER BY 1 ASC
        `, queryParams);

        // ── Daily Cash Flow — exclude OPENING_BALANCE & CASH_TRANSFER ──
        const dailyCashFlowRows = await db.pgAll(`
            SELECT
                DATE(date) AS day,
                SUM(CASE WHEN direction = 'in'  THEN amount ELSE 0 END) AS inflow,
                SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END) AS outflow
            FROM (
                SELECT date, amount, direction FROM cash_ledger
                WHERE company_id=$1 AND ${branchFilter}
                  AND source NOT IN ('OPENING_BALANCE','CASH_TRANSFER')
                  AND date >= CURRENT_DATE - INTERVAL '30 days'
                UNION ALL
                SELECT date, amount, direction FROM bank_ledger
                WHERE company_id=$1 AND ${branchFilter}
                  AND source NOT IN ('OPENING_BALANCE','CASH_TRANSFER')
                  AND date >= CURRENT_DATE - INTERVAL '30 days'
            ) AS combined
            WHERE date IS NOT NULL
            GROUP BY DATE(date)
            ORDER BY day ASC
        `, queryParams);

        // Merge daily sales + expenses into one array keyed by date
        const salesByDay = {};
        const expensesByDay = {};
        dailySalesRows.forEach(r => { salesByDay[String(r.day)] = Number(r.sales); });
        dailyExpenseRows.forEach(r => { expensesByDay[String(r.day)] = Number(r.expenses); });
        const allSalesDays = Array.from(new Set([
            ...Object.keys(salesByDay),
            ...Object.keys(expensesByDay)
        ])).sort();
        const salesChartData = allSalesDays.map(day => ({
            month: new Date(day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
            sales: salesByDay[day] || 0,
            expenses: expensesByDay[day] || 0,
        }));

        const cashFlowChartData = dailyCashFlowRows.map(r => ({
            month: new Date(r.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
            inflow: Number(r.inflow),
            outflow: Number(r.outflow),
        }));

        res.json({
            baseMetrics: { totalCash, totalBank, totalSales, totalPayments, totalExpenses },
            salesChartData,
            cashFlowChartData,
            // Legacy field kept for any other consumers
            chartData: salesChartData,
            debugInfo: {
                companyId,
                branchId: branchId || 'ALL',
                filter: branchFilter
            }
        });


    } catch (err) {
        console.error("Health summary error:", err);
        res.status(500).json({ error: "Failed to calculate health summary" });
    }
});

router.get('/party/:type/:id', authMiddleware, async (req, res) => {
    const { type, id } = req.params;
    const companyId = parseInt(req.user?.active_company_id || req.user?.company_id);
    
    try {
        // 1. Find the Account ID for this party
        // This is a simplified mapping. In a real system, you'd have a column in users/suppliers table for account_id.
        // For now, we'll search by name or a specific naming convention.
        
        let partyName = "";
        if (type === 'supplier') {
            const s = await db.pgGet("SELECT name FROM suppliers WHERE id = $1 AND company_id = $2", [id, companyId]);
            partyName = s?.name;
        } else if (type === 'customer') {
            const c = await db.pgGet("SELECT username FROM users WHERE id = $1 AND company_id = $2", [id, companyId]);
            partyName = c?.username;
        } else if (type === 'lender') {
            const l = await db.pgGet("SELECT name FROM lenders WHERE id = $1 AND company_id = $2", [id, companyId]);
            partyName = l?.name;
        } else if (type === 'employee') {
            const e = await db.pgGet("SELECT name FROM employees WHERE id = $1 AND company_id = $2", [id, companyId]);
            partyName = e?.name;
        }

        if (!partyName) return res.status(404).json({ error: "Party not found" });

        // Search COA for this party
        const account = await db.pgGet(
            "SELECT id, name, account_type, opening_balance FROM chart_of_accounts WHERE company_id = $1 AND name ILIKE $2 LIMIT 1",
            [companyId, `%${partyName}%`]
        );

        if (!account) {
            return res.json({ 
                summary: { opening_balance: 0, total_debit: 0, total_credit: 0, balance: 0 },
                transactions: [],
                party_name: partyName,
                message: "No accounting record found for this party yet."
            });
        }

        const entries = await db.pgAll(
            `SELECT l.*, t.description as tx_desc, t.reference_type, t.reference_id
             FROM ledger_entries l
             LEFT JOIN transactions t ON l.transaction_id = t.id
             WHERE l.account_id = $1 AND l.company_id = $2
             ORDER BY l.entry_date ASC, l.id ASC`,
            [account.id, companyId]
        );

        const totalDebit = entries.reduce((sum, e) => sum + parseFloat(e.debit), 0);
        const totalCredit = entries.reduce((sum, e) => sum + parseFloat(e.credit), 0);
        
        // For Liability (Supplier/Lender): Balance = Opening + Credit - Debit
        // For Asset (Customer): Balance = Opening + Debit - Credit
        const isLiability = ['LIABILITY', 'EQUITY'].includes(account.account_type.toUpperCase());
        const opening = parseFloat(account.opening_balance || 0);
        const balance = isLiability ? (opening + totalCredit - totalDebit) : (opening + totalDebit - totalCredit);

        res.json({
            party_name: partyName,
            account_name: account.name,
            summary: {
                opening_balance: opening,
                total_debit: totalDebit,
                total_credit: totalCredit,
                balance: balance
            },
            transactions: entries
        });

    } catch (err) {
        console.error("Party ledger error:", err);
        res.status(500).json({ error: "Failed to fetch party ledger" });
    }
});

router.get('/supplier/:id', authMiddleware, async (req, res) => {
    try {
        const companyId = parseInt(req.user?.active_company_id || req.user?.company_id);
        const supplierId = parseInt(req.params.id);
        const statement = await supplierLedgerService.buildSupplierLedgerStatement(companyId, supplierId, req.query);
        if (!statement) return res.status(404).json({ error: "Supplier not found" });
        res.json(statement);
    } catch (err) {
        console.error("Supplier ledger error:", err);
        res.status(500).json({ error: "Failed to fetch supplier ledger" });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE /ledger/party/entry/:entryId
// Permanently delete a party ledger entry (customer / supplier / lender / employee)
// Deletes the ledger_entry row + the entire parent transaction + all sibling entries
// ══════════════════════════════════════════════════════════════════════════════
router.delete('/party/entry/:entryId', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const entryId   = parseInt(req.params.entryId);
    try {
        // Find the ledger_entry and its parent transaction
        const entry = await db.pgGet(
            `SELECT le.id, le.transaction_id, t.reference_type
             FROM ledger_entries le
             LEFT JOIN transactions t ON t.id = le.transaction_id
             WHERE le.id = $1 AND le.company_id = $2`,
            [entryId, companyId]
        );
        if (!entry) return res.status(404).json({ error: 'Entry not found' });

        const txId = entry.transaction_id;

        if (txId) {
            // Delete ALL ledger_entries for this transaction (double-entry siblings)
            await db.pgRun(`DELETE FROM ledger_entries WHERE transaction_id = $1 AND company_id = $2`, [txId, companyId]);
            // Remove from cash/bank ledger if synced
            await db.pgRun(`DELETE FROM cash_ledger WHERE reference_id = $1 AND company_id = $2`, [txId, companyId]).catch(() => {});
            await db.pgRun(`DELETE FROM bank_ledger WHERE reference_id = $1 AND company_id = $2`, [txId, companyId]).catch(() => {});
            // Mark transaction excluded to prevent self-heal re-sync
            await db.pgRun(`UPDATE transactions SET bill_purpose = 'excluded' WHERE id = $1 AND company_id = $2`, [txId, companyId]);
        } else {
            // Orphan entry — delete just this row
            await db.pgRun(`DELETE FROM ledger_entries WHERE id = $1 AND company_id = $2`, [entryId, companyId]);
        }

        res.json({ success: true, message: 'Entry permanently deleted' });
    } catch (err) {
        console.error('[party ledger delete]', err.message);
        res.status(500).json({ error: 'Failed to delete entry' });
    }
});

router.patch('/:id/archive', authMiddleware, async (req, res) => {
    try {
        await db.pgRun('UPDATE ledgers SET is_deleted = true, deleted_at = NOW() WHERE id = $1 AND company_id = $2', [req.params.id, req.user.active_company_id]);
        res.json({ message: "Archived successfully" });
    } catch (err) {
        res.status(500).json({ error: "Archive failed" });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /ledger/set-opening-balance  — set current balance to the desired value
// Back-calculates: needed = desired - netOthers, stores as OPENING_BALANCE entry.
// This ensures: OPENING_BALANCE + all other entries = desired (current balance).
// ══════════════════════════════════════════════════════════════════════════════
router.post('/set-opening-balance', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { ledger_type, amount, date } = req.body;
    if (!['CASH', 'BANK'].includes(ledger_type)) {
        return res.status(400).json({ error: 'ledger_type must be CASH or BANK' });
    }
    const desired = parseFloat(amount);
    if (isNaN(desired) || desired < 0) {
        return res.status(400).json({ error: 'amount must be a valid non-negative number' });
    }
    const tbl = ledger_type === 'BANK' ? 'bank_ledger' : 'cash_ledger';
    const balDate = date || '2020-01-01';
    const { filter: branchFilter, branchId } = getBranchFilter(req);
    const branchIdVal = typeof branchId === 'number' ? branchId : 1;

    // Use identical formula (and identical date scoping) to the display query so
    // netOthers matches exactly — otherwise the balance shown right after saving
    // silently disagrees with what was just set.
    const INFLOW_SRC = `'RECEIPT','INVOICE','Payment','payment','INVOICE_PAYMENT','GIFT_CONTRIBUTION','LOAN_RECEIVED','LOAN_DISBURSEMENT'`;

    try {
        // Run the SAME self-heal/sync pass GET /cash|bank runs on every load, so
        // netOthers is computed against the exact table state the frontend's
        // post-save reload will see — otherwise a sync insert landing between this
        // save and that reload silently shifts the displayed balance again.
        if (ledger_type === 'BANK') {
            await syncBankLedger(companyId);
        } else {
            await syncCashLedger(companyId);
        }

        // Compute net of all non-OPENING transactions strictly BEFORE balDate — the
        // display query (GET /ledger/cash|bank) only folds pre-startDate entries into
        // "opening balance", so entries on/after balDate must be excluded here too.
        const othersRow = await db.pgGet(
            `SELECT COALESCE(SUM(CASE
                WHEN source IN (${INFLOW_SRC}) THEN ABS(amount)
                WHEN direction='in' THEN amount
                ELSE -amount
             END), 0) AS net
             FROM ${tbl} WHERE company_id = $1 AND ${branchFilter} AND source != 'OPENING_BALANCE'
               AND date < $2`,
            [companyId, balDate]
        );
        const netOthers = parseFloat(othersRow?.net || 0);
        const needed = desired - netOthers;

        // Remove existing OPENING_BALANCE entries for this company+branch
        await db.pgRun(
            `DELETE FROM ${tbl} WHERE company_id = $1 AND source = 'OPENING_BALANCE'`,
            [companyId]
        );

        // Insert back-calculated opening entry with branch_id so display query finds it
        if (Math.abs(needed) > 0.001) {
            await db.pgRun(
                `INSERT INTO ${tbl} (company_id, branch_id, source, amount, direction, date)
                 VALUES ($1, $2, 'OPENING_BALANCE', $3, $4, $5)`,
                [companyId, branchIdVal, Math.abs(needed), needed >= 0 ? 'in' : 'out', balDate]
            );
        }

        res.json({ success: true, message: `Balance set to ₹${desired.toFixed(2)}`, debug: { netOthers, needed, branchFilter } });
    } catch (err) {
        console.error('[set-opening-balance]', err.message);
        res.status(500).json({ error: 'Failed to set opening balance' });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// TEMPORARY DIAGNOSTIC — GET /ledger/debug-opening?ledger_type=CASH&date=YYYY-MM-DD
// Dumps raw state so we can see exactly what's stored instead of inferring from
// arithmetic. Safe to remove once the opening-balance display bug is found.
// ══════════════════════════════════════════════════════════════════════════════
router.get('/debug-opening', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const ledger_type = (req.query.ledger_type === 'BANK') ? 'BANK' : 'CASH';
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const tbl = ledger_type === 'BANK' ? 'bank_ledger' : 'cash_ledger';
    const { filter: branchFilter, branchId } = getBranchFilter(req);
    const INFLOW_SOURCES_SQL = `'RECEIPT','INVOICE','Payment','payment','INVOICE_PAYMENT','GIFT_CONTRIBUTION','LOAN_RECEIVED','LOAN_DISBURSEMENT'`;

    try {
        // Every OPENING_BALANCE row in this table, for ANY company/branch — to catch
        // stale rows the DELETE might have missed due to a company_id/branch mismatch.
        const allOpeningRows = await db.pgAll(
            `SELECT id, company_id, branch_id, source, amount, direction, date, created_at
             FROM ${tbl} WHERE source = 'OPENING_BALANCE' ORDER BY id`
        );

        const rowCount = await db.pgGet(
            `SELECT COUNT(*)::int AS n FROM ${tbl} WHERE company_id = $1 AND ${branchFilter}`,
            [companyId]
        );

        // Exact same netOthers formula/scoping as POST /set-opening-balance
        const netOthersRow = await db.pgGet(
            `SELECT COALESCE(SUM(CASE
                WHEN source IN (${INFLOW_SOURCES_SQL}) THEN ABS(amount)
                WHEN direction='in' THEN amount
                ELSE -amount
             END), 0) AS net
             FROM ${tbl} WHERE company_id = $1 AND ${branchFilter} AND source != 'OPENING_BALANCE'
               AND date < $2`,
            [companyId, date]
        );

        // Exact same opening_balance formula/scoping as GET /cash|bank
        const openingRow = await db.pgGet(
            `SELECT COALESCE(SUM(CASE
                WHEN source = 'OPENING_BALANCE' THEN (CASE WHEN direction = 'in' THEN amount ELSE -amount END)
                WHEN source IN (${INFLOW_SOURCES_SQL}) THEN ABS(amount)
                WHEN direction = 'in' THEN amount
                ELSE -amount
            END), 0) AS balance
            FROM ${tbl}
            WHERE company_id = $1 AND ${branchFilter}
            AND (source = 'OPENING_BALANCE' OR date < $2)`,
            [companyId, date]
        );

        res.json({
            companyId,
            branchId,
            branchFilter,
            ledger_type,
            date,
            rowCountForThisCompanyBranch: rowCount?.n,
            allOpeningBalanceRowsInTable: allOpeningRows,
            netOthers_matchingPostFormula: parseFloat(netOthersRow?.net || 0),
            opening_balance_matchingGetFormula: parseFloat(openingRow?.balance || 0),
        });
    } catch (err) {
        console.error('[debug-opening]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE /ledger/entry/:table/:id  — permanently remove a cash or bank ledger row
// table must be 'cash' or 'bank'
// Only allows deleting entries that are not OPENING_BALANCE
// ══════════════════════════════════════════════════════════════════════════════
router.delete('/entry/:table/:id', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { table, id } = req.params;
    const tbl = table === 'bank' ? 'bank_ledger' : 'cash_ledger';
    if (table !== 'cash' && table !== 'bank') {
        return res.status(400).json({ error: 'table must be cash or bank' });
    }
    try {
        const entry = await db.pgGet(
            `SELECT id, source, reference_id FROM ${tbl} WHERE id = $1 AND company_id = $2`,
            [id, companyId]
        );
        if (!entry) return res.status(404).json({ error: 'Entry not found' });
        if (entry.source === 'OPENING_BALANCE') {
            return res.status(400).json({ error: 'Cannot delete opening balance entry. Use Admin Setup to change it.' });
        }
        // Delete the ledger row
        await db.pgRun(`DELETE FROM ${tbl} WHERE id = $1 AND company_id = $2`, [id, companyId]);
        // If this row was synced from a transaction (reference_id is set), mark that transaction
        // as bill_purpose='excluded' so self-heal step 4 never re-adds it to cash_ledger
        if (entry.reference_id) {
            await db.pgRun(
                `UPDATE transactions SET bill_purpose = 'excluded' WHERE id = $1 AND company_id = $2`,
                [entry.reference_id, companyId]
            ).catch(() => {});
        }
        res.json({ success: true, message: 'Entry permanently deleted' });
    } catch (err) {
        console.error('[ledger delete]', err.message);
        res.status(500).json({ error: 'Failed to delete entry' });
    }
});

// ── helper: fetch ledger data for any party type ─────────────────────────────
async function fetchPartyLedgerData(companyId, type, id) {
    let partyName = '', phone = '';

    if (type === 'customer') {
        const r = await db.pgGet('SELECT username AS name, phone FROM users WHERE id=$1 AND company_id=$2', [id, companyId]);
        partyName = r?.name || ''; phone = r?.phone || '';
    } else if (type === 'supplier') {
        const r = await db.pgGet('SELECT name, phone FROM suppliers WHERE id=$1 AND company_id=$2', [id, companyId]);
        partyName = r?.name || ''; phone = r?.phone || '';
    } else if (type === 'lender') {
        const r = await db.pgGet('SELECT name, phone FROM lenders WHERE id=$1 AND company_id=$2', [id, companyId]);
        partyName = r?.name || ''; phone = r?.phone || '';
    } else if (type === 'employee') {
        const r = await db.pgGet('SELECT name, phone FROM employees WHERE id=$1 AND company_id=$2', [id, companyId]);
        partyName = r?.name || ''; phone = r?.phone || '';
    } else if (type === 'broker') {
        const r = await db.pgGet('SELECT name, phone FROM brokers WHERE id=$1 AND company_id=$2', [id, companyId]);
        partyName = r?.name || ''; phone = r?.phone || '';
    }

    if (!partyName) return null;

    // Fetch from COA-based ledger_entries
    const account = await db.pgGet(
        'SELECT id, name, account_type, opening_balance FROM chart_of_accounts WHERE company_id=$1 AND name ILIKE $2 LIMIT 1',
        [companyId, `%${partyName}%`]
    );

    let entries = [], summary = { opening_balance: 0, total_debit: 0, total_credit: 0, balance: 0 };

    if (account) {
        entries = await db.pgAll(
            `SELECT l.entry_date, t.description as tx_desc, t.reference_type, l.debit, l.credit, l.running_balance
             FROM ledger_entries l
             LEFT JOIN transactions t ON l.transaction_id = t.id
             WHERE l.account_id=$1 AND l.company_id=$2
             ORDER BY l.entry_date ASC, l.id ASC`,
            [account.id, companyId]
        );
        const totalDebit  = entries.reduce((s, e) => s + parseFloat(e.debit  || 0), 0);
        const totalCredit = entries.reduce((s, e) => s + parseFloat(e.credit || 0), 0);
        const isLiability = ['LIABILITY','EQUITY'].includes((account.account_type || '').toUpperCase());
        const opening     = parseFloat(account.opening_balance || 0);
        summary = {
            opening_balance: opening,
            total_debit:  totalDebit,
            total_credit: totalCredit,
            balance: isLiability ? (opening + totalCredit - totalDebit) : (opening + totalDebit - totalCredit),
        };
    }

    return { partyName, phone, entries, summary };
}

/* ============================================================
   GET /ledgers/party/:type/:id/pdf — download ledger PDF
============================================================ */
router.get('/party/:type/:id/pdf', authMiddleware, async (req, res) => {
    const { type, id } = req.params;
    const companyId = parseInt(req.user?.active_company_id || req.user?.company_id);
    try {
        const data = await fetchPartyLedgerData(companyId, type, id);
        if (!data) return res.status(404).json({ error: 'Party not found' });

        const pdfBuffer = await generateLedgerPdf({
            partyName: data.partyName,
            partyType: type.charAt(0).toUpperCase() + type.slice(1),
            entries:   data.entries,
            summary:   data.summary,
            phone:     data.phone,
        });

        res.set({
            'Content-Type':        'application/pdf',
            'Content-Disposition': `attachment; filename="${type}_Ledger_${data.partyName.replace(/\s+/g,'_')}.pdf"`,
            'Content-Length':      pdfBuffer.length,
        });
        res.end(pdfBuffer);
    } catch (err) {
        console.error('[Ledger PDF]', err.message);
        res.status(500).json({ error: 'PDF generation failed: ' + err.message });
    }
});

/* ============================================================
   POST /ledgers/party/:type/:id/send-whatsapp — send via WA
============================================================ */
router.post('/party/:type/:id/send-whatsapp', authMiddleware, async (req, res) => {
    const { type, id } = req.params;
    const companyId = parseInt(req.user?.active_company_id || req.user?.company_id);
    try {
        const data = await fetchPartyLedgerData(companyId, type, id);
        if (!data) return res.status(404).json({ error: 'Party not found' });
        if (!data.phone) return res.status(400).json({ error: `No phone number found for this ${type}` });

        const pdfBuffer = await generateLedgerPdf({
            partyName: data.partyName,
            partyType: type.charAt(0).toUpperCase() + type.slice(1),
            entries:   data.entries,
            summary:   data.summary,
            phone:     data.phone,
        });

        const filename = `${type}_Ledger_${data.partyName.replace(/\s+/g,'_')}_${Date.now()}.pdf`;
        // Also save to disk for the download endpoint (best-effort)
        try {
            if (!fs.existsSync(LEDGERS_DIR)) fs.mkdirSync(LEDGERS_DIR, { recursive: true });
            fs.writeFileSync(path.join(LEDGERS_DIR, filename), pdfBuffer);
        } catch (_) { /* disk write optional on Railway */ }

        // Send via WhatsApp (non-blocking after response)
        res.json({ success: true, message: `Ledger sent to ${data.partyName} (${data.phone}) on WhatsApp` });

        try {
            const { sendWhatsApp, sendWhatsAppFile } = await import('../utils/whatsapp.js');
            const dateStr = new Date().toLocaleDateString('en-IN');
            await sendWhatsApp(data.phone,
`Dear ${data.partyName},

📊 Please find your ledger statement attached.

Period: ${dateStr}
Total Debit:  ₹${(data.summary.total_debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Total Credit: ₹${(data.summary.total_credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Balance:      ₹${Math.abs(data.summary.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}

For any queries contact:
JBS Knit Wear, Tiruppur
📞 8148232205`);
            // Send buffer as base64 — no public URL dependency
            await sendWhatsAppFile(data.phone, pdfBuffer,
                `${type}_Ledger_${data.partyName.replace(/\s+/g,'_')}_${dateStr.replace(/\//g,'-')}.pdf`,
                `Ledger Statement — ${data.partyName}`
            );
            console.log(`[Ledger PDF] sent to ${data.phone}: ${filename}`);
        } catch (waErr) {
            console.log('[Ledger WhatsApp] silent fail:', waErr.message);
        }

    } catch (err) {
        console.error('[Ledger WhatsApp]', err.message);
        res.status(500).json({ error: 'Failed: ' + err.message });
    }
});

export default router;
