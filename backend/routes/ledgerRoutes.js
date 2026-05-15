// backend/routes/ledgerRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import * as supplierLedgerService from '../services/supplierLedgerService.js';

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
        let sql = `SELECT * FROM cash_ledger WHERE company_id = $1 AND ${branchFilter}`;
        const params = [companyId];

        let pIndex = params.length + 1;

        if (startDate) { sql += ` AND date >= $${pIndex++}`; params.push(startDate); }
        if (endDate) { sql += ` AND date <= $${pIndex++}`; params.push(endDate); }
        sql += ` ORDER BY date ASC, created_at ASC`;

        const entries = await db.pgAll(sql, params);
        res.json({ entries });
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
        let sql = `SELECT * FROM bank_ledger WHERE company_id = $1 AND ${branchFilter}`;
        const params = [companyId];

        let pIndex = params.length + 1;

        if (startDate) { sql += ` AND date >= $${pIndex++}`; params.push(startDate); }
        if (endDate) { sql += ` AND date <= $${pIndex++}`; params.push(endDate); }
        sql += ` ORDER BY date ASC, created_at ASC`;

        const entries = await db.pgAll(sql, params);
        res.json({ entries });
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

        const cashRows = await db.pgGet(`SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) as balance FROM cash_ledger WHERE company_id=$1 AND ${branchFilter}`, queryParams);
        let totalCash = Number(cashRows?.balance || 0);

        const bankRows = await db.pgGet(`SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) as balance FROM bank_ledger WHERE company_id=$1 AND ${branchFilter}`, queryParams);
        let totalBank = Number(bankRows?.balance || 0);

        const invoiceRows = await db.pgAll(`
            SELECT 
                COALESCE(SUM(total_amount), 0) as total_invoice,
                COALESCE(SUM(paid_amount), 0) as total_payments
            FROM invoices WHERE company_id=$1 AND ${branchFilter} AND bill_purpose != 'name_only'
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
            // Add non-invoice income to totalSales
            if (['RECEIPT', 'INCOME'].includes(r.type)) {
                totalSales += amt;
            }
        });
        const billRows = await db.pgAll(`
            SELECT SUM(total_amount) as total FROM purchase_bills WHERE company_id=$1 AND ${branchFilter}
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

export default router;
