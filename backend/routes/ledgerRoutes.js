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
        // Known inflow sources always count as positive regardless of stored direction
        // Self-heal: fix ALL inflow sources stored with wrong direction='out'
        const INFLOW_SET = `'OPENING_BALANCE','RECEIPT','CUSTOMER_PAYMENT','INVOICE','Payment','payment','GIFT_CONTRIBUTION','LOAN_RECEIVED','LOAN_DISBURSEMENT'`;
        await Promise.all([
            db.pgRun(`UPDATE cash_ledger SET direction='in' WHERE company_id=$1 AND source IN (${INFLOW_SET}) AND direction='out' AND amount>0`, [companyId]).catch(()=>{}),
            db.pgRun(`UPDATE bank_ledger SET direction='in' WHERE company_id=$1 AND source IN (${INFLOW_SET}) AND direction='out' AND amount>0`, [companyId]).catch(()=>{}),
        ]);
        // Remove any CUSTOMER_PAYMENT entries wrongly synced to cash_ledger
        // (ALL CUSTOMER_PAYMENT transactions are proprietor personal-account receipts, never company cash)
        await db.pgRun(`
            DELETE FROM cash_ledger
            WHERE company_id = $1
              AND reference_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM transactions t
                WHERE t.id = cash_ledger.reference_id
                  AND t.type = 'CUSTOMER_PAYMENT'
              )
        `, [companyId]).catch(()=>{});
        // Remove duplicate auto-synced entries for invoice payments already in cash_ledger via invoice_id
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
        // Link invoice-creation entries to their transactions so future syncs skip them
        await db.pgRun(`
            UPDATE cash_ledger cl SET reference_id = t.id
            FROM transactions t
            WHERE cl.company_id = $1 AND cl.invoice_id IS NOT NULL AND cl.reference_id IS NULL
              AND t.company_id = $1 AND t.type = 'RECEIPT'
              AND t.related_invoice_id = cl.invoice_id AND ABS(t.amount) = cl.amount
        `, [companyId]).catch(()=>{});
        // Sync only truly missing company-cash entries (exclude personal-account receipts)
        await db.pgRun(`
            INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date, reference_id)
            SELECT t.company_id, COALESCE(t.branch_id,1), t.type, t.amount, 'in',
                   COALESCE(t.date::date, t.transaction_date::date, CURRENT_DATE), t.id
            FROM transactions t
            WHERE t.company_id = $1
              AND t.type = 'RECEIPT'
              AND t.amount > 0
              AND NOT EXISTS (
                  SELECT 1 FROM cash_ledger cl WHERE cl.reference_id = t.id AND cl.company_id = $1
              )
        `, [companyId]).catch(()=>{});

        const [cashRow, bankRow] = await Promise.all([
            db.pgGet(
                `SELECT COALESCE(SUM(CASE WHEN source IN (${INFLOW_SET}) THEN ABS(amount) WHEN direction='in' THEN amount ELSE -amount END), 0) AS balance
                 FROM cash_ledger WHERE company_id = $1`,
                [companyId]
            ),
            db.pgGet(
                `SELECT COALESCE(SUM(CASE WHEN source IN (${INFLOW_SET}) THEN ABS(amount) WHEN direction='in' THEN amount ELSE -amount END), 0) AS balance
                 FROM bank_ledger WHERE company_id = $1`,
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


router.get('/cash', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    const { filter: branchFilter } = getBranchFilter(req);

    try {
        // Self-heal: fix ALL known inflow sources stored with wrong direction='out'
        await db.pgRun(
            `UPDATE cash_ledger SET direction='in'
             WHERE company_id=$1
               AND source IN ('OPENING_BALANCE','RECEIPT','CUSTOMER_PAYMENT','INVOICE','Payment','payment','GIFT_CONTRIBUTION','LOAN_RECEIVED','LOAN_DISBURSEMENT')
               AND direction='out' AND amount>0`,
            [companyId]
        ).catch(()=>{});

        // Auto-sync: deduplicate and fill cash_ledger from transactions
        // Step 1a: Remove personal-receipt entries (went to proprietor personal account, not company cash)
        await db.pgRun(`
            DELETE FROM cash_ledger
            WHERE company_id = $1
              AND reference_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM transactions t
                WHERE t.id = cash_ledger.reference_id
                  AND t.reference_type = 'PERSONAL_RECEIPT'
              )
        `, [companyId]).catch(()=>{});

        // Step 1b: Remove duplicate auto-synced entries for invoice payments already covered by invoice_id rows
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

        // Step 2: Link invoice-creation cash_ledger entries to their transactions
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

        // Step 3: Sync only truly missing company-cash entries (exclude personal-account receipts)
        await db.pgRun(`
            INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date, reference_id)
            SELECT t.company_id, COALESCE(t.branch_id, 1), t.type, t.amount, 'in',
                   COALESCE(t.date::date, t.transaction_date::date, CURRENT_DATE), t.id
            FROM transactions t
            WHERE t.company_id = $1
              AND t.type IN ('RECEIPT', 'CUSTOMER_PAYMENT')
              AND COALESCE(t.reference_type,'') != 'PERSONAL_RECEIPT'
              AND t.amount > 0
              AND NOT EXISTS (
                  SELECT 1 FROM cash_ledger cl
                  WHERE cl.reference_id = t.id AND cl.company_id = $1
              )
        `, [companyId]).catch(()=>{});

        // Opening balance = net of ALL cash transactions strictly BEFORE startDate
        // Known inflow sources always count as positive regardless of stored direction
        const INFLOW_SOURCES_SQL = `'OPENING_BALANCE','RECEIPT','CUSTOMER_PAYMENT','INVOICE','Payment','payment','GIFT_CONTRIBUTION','LOAN_RECEIVED','LOAN_DISBURSEMENT'`;
        const openingParams = [companyId];
        let openingSql = `
            SELECT COALESCE(SUM(CASE
                WHEN source IN (${INFLOW_SOURCES_SQL}) THEN ABS(amount)
                WHEN direction = 'in' THEN amount
                ELSE -amount
            END), 0) AS balance
            FROM cash_ledger
            WHERE company_id = $1 AND ${branchFilter}
        `;
        if (startDate) {
            openingSql += ` AND date < $${openingParams.length + 1}`;
            openingParams.push(startDate);
        }
        const openingRow = await db.pgGet(openingSql, openingParams);
        const opening_balance = Number(openingRow?.balance || 0);

        // Entries within the requested date range
        const params = [companyId];
        let sql = `SELECT * FROM cash_ledger WHERE company_id = $1 AND ${branchFilter}`;
        let pIndex = 2;
        if (startDate) { sql += ` AND date >= $${pIndex++}`; params.push(startDate); }
        if (endDate)   { sql += ` AND date <= $${pIndex++}`; params.push(endDate); }
        sql += ` ORDER BY date ASC, created_at ASC`;

        const INFLOW_SOURCES = ['OPENING_BALANCE', 'CUSTOMER_PAYMENT', 'RECEIPT', 'GIFT_CONTRIBUTION', 'LOAN_RECEIVED', 'LOAN_DISBURSEMENT', 'INVOICE', 'Payment'];
        const rawEntries = await db.pgAll(sql, params);
        // Correct direction for known inflow sources (fixes historically mis-recorded entries)
        // OPENING_BALANCE must always be 'in' regardless of how it was stored
        const entries = rawEntries.map(e => ({
            ...e,
            direction: INFLOW_SOURCES.includes(e.source) ? 'in' : e.direction
        }));
        res.json({ entries, opening_balance });
    } catch (err) {
        console.error("Cash ledger error:", err);
        res.status(500).json({ error: "Failed to fetch cash ledger" });
    }
});

router.get('/bank', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    const { filter: branchFilter } = getBranchFilter(req);

    try {
        // Self-heal: fix ALL known inflow sources stored with wrong direction='out'
        await db.pgRun(
            `UPDATE bank_ledger SET direction='in'
             WHERE company_id=$1
               AND source IN ('OPENING_BALANCE','RECEIPT','CUSTOMER_PAYMENT','INVOICE','Payment','GIFT_CONTRIBUTION','LOAN_RECEIVED','LOAN_DISBURSEMENT')
               AND direction='out' AND amount>0`,
            [companyId]
        ).catch(()=>{});

        // Opening balance = net of ALL bank transactions strictly BEFORE startDate
        // Known inflow sources always count as positive regardless of stored direction
        const INFLOW_SOURCES_SQL = `'OPENING_BALANCE','RECEIPT','CUSTOMER_PAYMENT','INVOICE','Payment','GIFT_CONTRIBUTION','LOAN_RECEIVED','LOAN_DISBURSEMENT'`;
        const openingParams = [companyId];
        let openingSql = `
            SELECT COALESCE(SUM(CASE
                WHEN source IN (${INFLOW_SOURCES_SQL}) THEN ABS(amount)
                WHEN direction = 'in' THEN amount
                ELSE -amount
            END), 0) AS balance
            FROM bank_ledger
            WHERE company_id = $1 AND ${branchFilter}
        `;
        if (startDate) {
            openingSql += ` AND date < $${openingParams.length + 1}`;
            openingParams.push(startDate);
        }
        const openingRow = await db.pgGet(openingSql, openingParams);
        const opening_balance = Number(openingRow?.balance || 0);

        // Entries within the requested date range
        const params = [companyId];
        let sql = `SELECT * FROM bank_ledger WHERE company_id = $1 AND ${branchFilter}`;
        let pIndex = 2;
        if (startDate) { sql += ` AND date >= $${pIndex++}`; params.push(startDate); }
        if (endDate)   { sql += ` AND date <= $${pIndex++}`; params.push(endDate); }
        sql += ` ORDER BY date ASC, created_at ASC`;

        const INFLOW_SOURCES = ['OPENING_BALANCE', 'CUSTOMER_PAYMENT', 'RECEIPT', 'GIFT_CONTRIBUTION', 'LOAN_RECEIVED', 'LOAN_DISBURSEMENT', 'INVOICE', 'Payment'];
        const rawEntries = await db.pgAll(sql, params);
        // OPENING_BALANCE must always be 'in' regardless of how it was stored
        const entries = rawEntries.map(e => ({
            ...e,
            direction: INFLOW_SOURCES.includes(e.source) ? 'in' : e.direction
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

        const INFLOW_SET = `'OPENING_BALANCE','RECEIPT','CUSTOMER_PAYMENT','INVOICE','Payment','GIFT_CONTRIBUTION','LOAN_RECEIVED','LOAN_DISBURSEMENT'`;
        const cashRows = await db.pgGet(`SELECT COALESCE(SUM(CASE WHEN source IN (${INFLOW_SET}) THEN ABS(amount) WHEN direction = 'in' THEN amount ELSE -amount END), 0) as balance FROM cash_ledger WHERE company_id=$1 AND ${branchFilter}`, queryParams);
        let totalCash = Number(cashRows?.balance || 0);

        const bankRows = await db.pgGet(`SELECT COALESCE(SUM(CASE WHEN source IN (${INFLOW_SET}) THEN ABS(amount) WHEN direction = 'in' THEN amount ELSE -amount END), 0) as balance FROM bank_ledger WHERE company_id=$1 AND ${branchFilter}`, queryParams);
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



        // Aggregation for Daily Chart (Current Month)
        const chartRows = await db.pgAll(`
            SELECT 
                DATE(date) as day,
                SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END) as expense
            FROM (
                SELECT date, amount, direction FROM cash_ledger WHERE company_id=$1 AND ${branchFilter}
                UNION ALL
                SELECT date, amount, direction FROM bank_ledger WHERE company_id=$1 AND ${branchFilter}
            ) as combined
            WHERE date >= date_trunc('month', CURRENT_DATE)
            GROUP BY DATE(date)
            ORDER BY DATE(date) ASC
        `, queryParams);

        res.json({
            baseMetrics: { totalCash, totalBank, totalSales, totalPayments, totalExpenses },
            chartData: chartRows.map(r => ({
                month: new Date(r.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                sales: Number(r.income),
                expenses: Number(r.expense),
                inflow: Number(r.income),
                outflow: Number(r.expense),
                payments: Number(r.income),
            })),
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

router.patch('/:id/archive', authMiddleware, async (req, res) => {
    try {
        await db.pgRun('UPDATE ledgers SET is_deleted = true, deleted_at = NOW() WHERE id = $1 AND company_id = $2', [req.params.id, req.user.active_company_id]);
        res.json({ message: "Archived successfully" });
    } catch (err) {
        res.status(500).json({ error: "Archive failed" });
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
