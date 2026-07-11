// backend/routes/expenseEntryRoutes.js
// Strict, structured expense recording. Every entry is stored here with full
// audit detail (who paid whom, why, when) AND, unless payment_mode is
// 'personal', mirrored into cash_ledger/bank_ledger (source='EXPENSE') so it
// flows through the existing balance calculations and Expense Reports exactly
// like any other ledger entry — no separate reporting path needed.
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

const CATEGORY_GROUPS = [
    { group: 'Fixed Costs', items: [
        { key: 'rent', label: 'Rent', icon: '🏠' },
        { key: 'electricity', label: 'Electricity', icon: '⚡' },
        { key: 'water', label: 'Water', icon: '💧' },
        { key: 'internet', label: 'Internet & Phone', icon: '📶' },
        { key: 'insurance', label: 'Insurance', icon: '🛡️' },
    ]},
    { group: 'HR', items: [
        { key: 'daily_wage', label: 'Daily Wages', icon: '👷' },
        { key: 'salary', label: 'Salary', icon: '💼' },
        { key: 'advance', label: 'Salary Advance', icon: '🤝' },
        { key: 'bonus', label: 'Bonus / Incentive', icon: '🎁' },
        { key: 'staff_welfare', label: 'Staff Welfare', icon: '❤️' },
    ]},
    { group: 'Purchases', items: [
        { key: 'raw_material', label: 'Raw Material', icon: '🧵' },
        { key: 'packing', label: 'Packing Material', icon: '📦' },
        { key: 'consumables', label: 'Consumables', icon: '🧴' },
    ]},
    { group: 'Operations', items: [
        { key: 'transport', label: 'Transport / Freight', icon: '🚚' },
        { key: 'repair', label: 'Repair & Maintenance', icon: '🔧' },
        { key: 'printing', label: 'Printing & Stationery', icon: '🖨️' },
        { key: 'food', label: 'Food & Refreshments', icon: '🍽️' },
        { key: 'fuel', label: 'Fuel', icon: '⛽' },
    ]},
    { group: 'Finance', items: [
        { key: 'loan_emi', label: 'Loan EMI', icon: '🏦' },
        { key: 'bank_charges', label: 'Bank Charges', icon: '💳' },
        { key: 'interest', label: 'Interest Payment', icon: '📈' },
        { key: 'chit', label: 'Chit Payment', icon: '🪙' },
    ]},
    { group: 'Miscellaneous', items: [
        { key: 'misc', label: 'Miscellaneous', icon: '❔' },
        { key: 'donation', label: 'Donation / CSR', icon: '🤲' },
        { key: 'legal', label: 'Legal & Professional', icon: '⚖️' },
    ]},
];
const CATEGORY_LOOKUP = Object.fromEntries(CATEGORY_GROUPS.flatMap(g => g.items.map(i => [i.key, i])));
const VALID_CATEGORY_KEYS = new Set(Object.keys(CATEGORY_LOOKUP));
const BLOCKED_PAID_TO = new Set(['person', 'someone', 'misc', 'other', 'unknown', 'na', 'n/a', 'nobody']);

const ensureTable = async () => {
    await db.pgRun(`
        CREATE TABLE IF NOT EXISTS expense_entries (
            id               SERIAL PRIMARY KEY,
            company_id       INTEGER NOT NULL,
            branch_id        INTEGER,
            reference_number VARCHAR(50),
            expense_date     DATE NOT NULL,
            category         VARCHAR(50) NOT NULL,
            sub_category     VARCHAR(255) NOT NULL,
            amount           NUMERIC(14,2) NOT NULL,
            payment_mode     VARCHAR(20) NOT NULL,
            paid_to          VARCHAR(255) NOT NULL,
            contact_phone    VARCHAR(30),
            description      TEXT NOT NULL,
            receipt_number   VARCHAR(100),
            admin_notes      TEXT,
            status           VARCHAR(20) NOT NULL DEFAULT 'approved',
            recorded_by      INTEGER,
            cash_ledger_ref  INTEGER,
            bank_ledger_ref  INTEGER,
            created_at       TIMESTAMP DEFAULT NOW()
        )
    `).catch(() => {});
    await db.pgRun(`ALTER TABLE expense_entries ADD COLUMN IF NOT EXISTS approved_by INTEGER`).catch(() => {});
    await db.pgRun(`ALTER TABLE expense_entries ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`).catch(() => {});
};

// Admins are always approvers; anyone else needs the 'approve_expenses'
// module's Edit permission explicitly granted via Admin Setup > User
// Permissions. user_permissions may not have the module_key column yet in an
// environment that hasn't run the schema migration — treat that as "not an
// approver" rather than erroring.
async function isApprover(req) {
    if (req.user.role === 'admin' || req.user.role === 'superadmin') return true;
    try {
        const row = await db.pgGet(
            `SELECT can_edit FROM user_permissions WHERE user_id = $1 AND module_key = 'approve_expenses'`,
            [req.user.id]
        );
        return !!row?.can_edit;
    } catch {
        return false;
    }
}

// Posts the ledger entry for an approved expense — shared by the auto-approve
// path (POST /) and the explicit approval path (POST /:id/approve).
async function postExpenseLedgerEntry({ companyId, branchId, paymentMode, amount, date }) {
    if (paymentMode === 'cash') {
        const inserted = await db.pgGet(
            `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
             VALUES ($1, $2, 'EXPENSE', $3, 'out', $4) RETURNING id`,
            [companyId, branchId || 1, amount, date]
        );
        return { cashLedgerRef: inserted?.id || null, bankLedgerRef: null };
    }
    if (paymentMode === 'bank' || paymentMode === 'upi') {
        const inserted = await db.pgGet(
            `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, date)
             VALUES ($1, $2, 'EXPENSE', $3, 'out', $4) RETURNING id`,
            [companyId, branchId || 1, amount, date]
        );
        return { cashLedgerRef: null, bankLedgerRef: inserted?.id || null };
    }
    // 'personal' → no ledger entry, company cash/bank untouched
    return { cashLedgerRef: null, bankLedgerRef: null };
}

// Local (server timezone) calendar date as YYYY-MM-DD — plain string comparison
// avoids the classic bug where `new Date("2026-07-09")` parses as UTC midnight,
// which is later than local midnight in timezones ahead of UTC (e.g. IST),
// making "today" look like a future date.
function todayLocalStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function validateExpense(body) {
    const errors = {};
    const { expense_date, category, sub_category, amount, payment_mode, paid_to, description } = body;

    if (!expense_date) errors.expense_date = 'Required';
    else if (expense_date > todayLocalStr()) errors.expense_date = 'Cannot be a future date';

    if (!category || !VALID_CATEGORY_KEYS.has(category)) errors.category = 'Select a valid category';

    if (!sub_category || sub_category.trim().length < 3) errors.sub_category = 'Minimum 3 characters required';

    const amt = parseFloat(amount);
    if (!amt || isNaN(amt) || amt <= 0) errors.amount = 'Enter a valid amount';

    if (!['cash', 'bank', 'upi', 'personal'].includes(payment_mode)) errors.payment_mode = 'Select a valid payment mode';

    const paidToNorm = (paid_to || '').trim().toLowerCase();
    if (!paid_to || paid_to.trim().length < 3) errors.paid_to = 'Minimum 3 characters required';
    else if (BLOCKED_PAID_TO.has(paidToNorm)) errors.paid_to = 'Please enter the actual name of the person or business';

    if (!description || description.trim().length < 20) errors.description = 'Minimum 20 characters required';

    return errors;
}

async function generateReferenceNumber(companyId, expenseDate) {
    const year = new Date(expenseDate).getFullYear();
    const row = await db.pgGet(
        `SELECT COUNT(*) AS cnt FROM expense_entries WHERE company_id = $1 AND EXTRACT(YEAR FROM expense_date) = $2`,
        [companyId, year]
    );
    const seq = String(Number(row?.cnt || 0) + 1).padStart(5, '0');
    return `EXP/${year}/${seq}`;
}

// GET /expense-entries/categories — grouped category list for the form dropdown
router.get('/categories', authMiddleware, (req, res) => {
    res.json({ groups: CATEGORY_GROUPS });
});

// GET /expense-entries/can-approve — does the current user have approval rights?
// Used by the frontend to show/hide the Approve action.
router.get('/can-approve', authMiddleware, async (req, res) => {
    res.json({ canApprove: await isApprover(req) });
});

// GET /expense-entries — list with filters, for the Expense List page
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { from, to, category, branch_id } = req.query;
    try {
        await ensureTable();
        const params = [companyId];
        let sql = `
            SELECT e.*, u.username AS recorded_by_name, b.branch_name, au.username AS approved_by_name
            FROM expense_entries e
            LEFT JOIN users u ON u.id = e.recorded_by
            LEFT JOIN users au ON au.id = e.approved_by
            LEFT JOIN branches b ON b.id = e.branch_id
            WHERE e.company_id = $1
        `;
        let i = 2;
        if (from) { sql += ` AND e.expense_date >= $${i++}`; params.push(from); }
        if (to) { sql += ` AND e.expense_date <= $${i++}`; params.push(to); }
        if (category) { sql += ` AND e.category = $${i++}`; params.push(category); }
        if (branch_id) { sql += ` AND e.branch_id = $${i++}`; params.push(parseInt(branch_id)); }
        sql += ` ORDER BY e.expense_date DESC, e.created_at DESC LIMIT 500`;

        const rows = await db.pgAll(sql, params);
        const data = rows.map(r => ({
            ...r,
            category_label: CATEGORY_LOOKUP[r.category]?.label || r.category,
            category_icon: CATEGORY_LOOKUP[r.category]?.icon || '📦',
            ledger_posted: !!(r.cash_ledger_ref || r.bank_ledger_ref),
        }));
        res.json({ data });
    } catch (err) {
        console.error('[expense-entries GET]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /expense-entries/:id — single entry with ledger-posting proof, for the expanded row / audit trail
router.get('/:id', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        await ensureTable();
        const row = await db.pgGet(`
            SELECT e.*, u.username AS recorded_by_name, b.branch_name, au.username AS approved_by_name
            FROM expense_entries e
            LEFT JOIN users u ON u.id = e.recorded_by
            LEFT JOIN users au ON au.id = e.approved_by
            LEFT JOIN branches b ON b.id = e.branch_id
            WHERE e.id = $1 AND e.company_id = $2
        `, [req.params.id, companyId]);
        if (!row) return res.status(404).json({ error: 'Not found' });

        let ledgerEntry = null;
        if (row.cash_ledger_ref) {
            ledgerEntry = await db.pgGet(`SELECT id, date, created_at, 'cash' AS ledger_type FROM cash_ledger WHERE id = $1`, [row.cash_ledger_ref]);
        } else if (row.bank_ledger_ref) {
            ledgerEntry = await db.pgGet(`SELECT id, date, created_at, 'bank' AS ledger_type FROM bank_ledger WHERE id = $1`, [row.bank_ledger_ref]);
        }
        res.json({
            ...row,
            category_label: CATEGORY_LOOKUP[row.category]?.label || row.category,
            category_icon: CATEGORY_LOOKUP[row.category]?.icon || '📦',
            ledger_entry: ledgerEntry,
        });
    } catch (err) {
        console.error('[expense-entries GET :id]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /expense-entries — record a new expense. If the recording user is an
// approver (admin, or explicitly granted 'approve_expenses' edit permission),
// it's auto-approved and posted to cash_ledger/bank_ledger immediately (unless
// payment_mode is 'personal', which never touches company ledgers). Otherwise
// it's held as 'pending' — no ledger entry — until someone with approval
// rights approves it via POST /:id/approve.
router.post('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId = req.user.branch_id || req.body.branch_id || null;
    const userId = req.user.id;

    const errors = validateExpense(req.body);
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ error: 'Validation failed', fields: errors });
    }

    const { expense_date, category, sub_category, amount, payment_mode, paid_to, contact_phone, description, receipt_number, admin_notes } = req.body;
    const amt = parseFloat(amount);

    try {
        await ensureTable();
        const referenceNumber = await generateReferenceNumber(companyId, expense_date);
        const approver = await isApprover(req);

        let cashLedgerRef = null;
        let bankLedgerRef = null;
        if (approver) {
            ({ cashLedgerRef, bankLedgerRef } = await postExpenseLedgerEntry({
                companyId, branchId, paymentMode: payment_mode, amount: amt, date: expense_date,
            }));
        }

        const status = approver ? 'approved' : 'pending';
        const approvedBy = approver ? userId : null;

        const row = await db.pgGet(
            `INSERT INTO expense_entries
                (company_id, branch_id, reference_number, expense_date, category, sub_category,
                 amount, payment_mode, paid_to, contact_phone, description, receipt_number,
                 admin_notes, status, recorded_by, cash_ledger_ref, bank_ledger_ref, approved_by, approved_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,${approver ? 'NOW()' : 'NULL'})
             RETURNING *`,
            [companyId, branchId, referenceNumber, expense_date, category, sub_category.trim(),
             amt, payment_mode, paid_to.trim(), contact_phone || null, description.trim(),
             receipt_number || null, admin_notes || null, status, userId, cashLedgerRef, bankLedgerRef, approvedBy]
        );

        res.json({ success: true, data: row });
    } catch (err) {
        console.error('[expense-entries POST]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /expense-entries/:id/approve — approve a pending expense: posts the
// held-back ledger entry now and marks who approved it. Only callable by an
// approver (admin, or explicit 'approve_expenses' permission).
router.post('/:id/approve', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const userId = req.user.id;

    try {
        if (!(await isApprover(req))) {
            return res.status(403).json({ error: 'You do not have permission to approve expenses' });
        }

        await ensureTable();
        const entry = await db.pgGet(
            `SELECT * FROM expense_entries WHERE id = $1 AND company_id = $2`,
            [req.params.id, companyId]
        );
        if (!entry) return res.status(404).json({ error: 'Not found' });
        if (entry.status === 'approved') return res.status(400).json({ error: 'Already approved' });

        const { cashLedgerRef, bankLedgerRef } = await postExpenseLedgerEntry({
            companyId, branchId: entry.branch_id, paymentMode: entry.payment_mode,
            amount: entry.amount, date: entry.expense_date,
        });

        const row = await db.pgGet(
            `UPDATE expense_entries
             SET status = 'approved', approved_by = $1, approved_at = NOW(),
                 cash_ledger_ref = $2, bank_ledger_ref = $3
             WHERE id = $4 AND company_id = $5
             RETURNING *`,
            [userId, cashLedgerRef, bankLedgerRef, req.params.id, companyId]
        );

        res.json({ success: true, data: row });
    } catch (err) {
        console.error('[expense-entries approve]', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
