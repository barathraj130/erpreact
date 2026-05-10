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
        const groups = await db.pgAll('SELECT * FROM ledger_groups WHERE company_id = $1 AND is_deleted = false ORDER BY name', [companyId]);
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
        const ledger = await db.pgGet(`SELECT * FROM ledgers WHERE id = $1 AND company_id = $2 AND is_deleted = false`, [id, companyId]);
        if (!ledger) return res.status(404).json({ error: "Ledger not found" });

        const transactions = await db.pgAll(`
            SELECT * FROM transactions 
            WHERE ledger_id = $1 AND company_id = $2 AND is_deleted = false
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
});

router.get('/cash', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    let branchId = req.headers['x-branch-id'] || req.user.branch_id;
    const { startDate, endDate } = req.query;

    try {
        let sql = `SELECT * FROM cash_ledger WHERE company_id = $1 AND branch_id = $2 AND is_deleted = false`;
        let params = [companyId, branchId];
        let pIndex = 3;

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
    let branchId = req.headers['x-branch-id'] || req.user.branch_id;
    const { startDate, endDate } = req.query;

    try {
        let sql = `SELECT * FROM bank_ledger WHERE company_id = $1 AND branch_id = $2 AND is_deleted = false`;
        let params = [companyId, branchId];
        let pIndex = 3;

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
    const branchId = req.headers['x-branch-id'] || req.user.branch_id;

    try {

        let branchFilter = 'branch_id = $2';
        let queryParams = [companyId, branchId];

        // If branchId is not a valid number or is null/undefined, show consolidated
        if (!branchId || isNaN(Number(branchId)) || branchId === 'all' || branchId === 'null') {
            branchFilter = '1=1';
            queryParams = [companyId];
        }

        console.log(`📊 Health Summary [Co:${companyId} Br:${branchId}] using Filter: ${branchFilter}`);


        const cashRows = await db.pgAll(`SELECT direction, SUM(amount) as total FROM cash_ledger WHERE company_id=$1 AND ${branchFilter} AND is_deleted = false GROUP BY direction`, queryParams);
        let totalCash = 0;
        cashRows.forEach(r => { if(r.direction==='in') totalCash += Number(r.total); else totalCash -= Number(r.total); });

        const bankRows = await db.pgAll(`SELECT direction, SUM(amount) as total FROM bank_ledger WHERE company_id=$1 AND ${branchFilter} AND is_deleted = false GROUP BY direction`, queryParams);
        let totalBank = 0;
        bankRows.forEach(r => { if(r.direction==='in') totalBank += Number(r.total); else totalBank -= Number(r.total); });

        const invoiceRows = await db.pgAll(`
            SELECT 
                SUM(total_amount) as total_invoice,
                SUM(paid_amount) as total_payments
            FROM invoices WHERE company_id=$1 AND ${branchFilter} AND is_deleted = false
        `, queryParams);
        
        const totalSales = Number(invoiceRows[0]?.total_invoice || 0);
        const totalPayments = Number(invoiceRows[0]?.total_payments || 0);

        const txRows = await db.pgAll(`
            SELECT category, SUM(amount) as total
            FROM transactions
            WHERE company_id=$1 AND ${branchFilter} AND is_deleted = false
            GROUP BY category
        `, queryParams);

        let totalExpenses = 0;
        txRows.forEach(r => {
            if(r.category === 'EXPENSE') totalExpenses += Number(r.total);
        });

        const billRows = await db.pgAll(`
            SELECT SUM(total_amount) as total FROM purchase_bills WHERE company_id=$1 AND ${branchFilter} AND is_deleted = false
        `, queryParams);
        totalExpenses += Number(billRows[0]?.total || 0);

        res.json({
            baseMetrics: { totalCash, totalBank, totalSales, totalPayments, totalExpenses }
        });
    } catch (err) {
        console.error("Health summary error:", err);
        res.status(500).json({ error: "Failed to calculate health summary" });
    }
});

router.get('/supplier/:id', authMiddleware, async (req, res) => {
    try {
        const companyId = req.user?.active_company_id;
        const supplierId = req.params.id;
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
