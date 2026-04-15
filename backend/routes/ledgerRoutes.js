// backend/routes/ledgerRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';
import * as supplierLedgerService from '../services/supplierLedgerService.js';

const router = express.Router();

/**
 * Ledger Routes for Chart of Accounts (COA) and Ledger Management
 */

// GET /api/ledger/groups - Fetch all ledger groups (COA)
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

// GET /api/ledger - Fetch all ledgers (with calculated balances)
router.get('/', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    
    try {
        const sql = `
            SELECT 
                l.id, l.name, l.opening_balance, l.is_dr,
                lg.name as group_name,
                (
                    SELECT COALESCE(SUM(CASE WHEN t.type = 'RECEIPT' OR t.type = 'INVOICE' THEN t.amount ELSE -t.amount END), 0)
                    FROM transactions t 
                    WHERE t.ledger_id = l.id
                ) as net_diff
            FROM ledgers l
            JOIN ledger_groups lg ON l.group_id = lg.id
            WHERE l.company_id = $1
            ORDER BY lg.name, l.name
        `;
        
        const ledgers = await db.pgAll(sql, [companyId]);

        // Calculate actual current balance
        const ledgersWithBalance = ledgers.map(l => {
            const initial = Number(l.opening_balance || 0);
            const net = Number(l.net_diff || 0);
            // Simplistic balance logic: if DR initial, add net. 
            // In real accounting, it depends on group nature (Asset vs Liability).
            // For now, presenting opening + net.
            return {
                ...l,
                current_balance: initial + net
            };
        });

        res.json(ledgersWithBalance);

    } catch (error) {
        console.error("Error fetching ledgers:", error.message);
        res.status(500).json({ error: "Failed to fetch ledgers." });
    }
});

// GET /api/ledger/report/:id - Fetch detailed transaction report for one ledger
router.get('/report/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.active_company_id;
    
    try {
        const ledger = await db.pgGet(`SELECT * FROM ledgers WHERE id = $1 AND company_id = $2`, [id, companyId]);
        if (!ledger) return res.status(404).json({ error: "Ledger not found" });

        const transactions = await db.pgAll(`
            SELECT * FROM transactions 
            WHERE ledger_id = $1 AND company_id = $2 
            ORDER BY date ASC, created_at ASC
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

/* =======================================
   CASH AND BANK LEDGER ENDPOINTS
======================================= */

// GET /api/ledger/cash
router.get('/cash', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId = req.headers['x-branch-id'] || req.user.branch_id;
    const { startDate, endDate } = req.query;

    try {
        let sql = `SELECT * FROM cash_ledger WHERE company_id = $1 AND branch_id = $2`;
        let params = [companyId, branchId];
        let pIndex = 3;

        if (startDate) {
            sql += ` AND date >= $${pIndex++}`;
            params.push(startDate);
        }
        if (endDate) {
            sql += ` AND date <= $${pIndex++}`;
            params.push(endDate);
        }
        sql += ` ORDER BY date ASC, created_at ASC`;

        // Calculate opening balance before startDate
        let openingBalance = 0;
        if (startDate) {
            const obSql = `SELECT direction, SUM(amount) as total FROM cash_ledger WHERE company_id = $1 AND branch_id = $2 AND date < $3 GROUP BY direction`;
            const obRows = await db.pgAll(obSql, [companyId, branchId, startDate]);
            let cin = 0, cout = 0;
            obRows.forEach(r => {
                if (r.direction === 'in') cin += Number(r.total);
                if (r.direction === 'out') cout += Number(r.total);
            });
            openingBalance = cin - cout;
        } else {
            // If no date range is provided, the running opening balance is theoretically 0
            openingBalance = 0;
        }

        const entries = await db.pgAll(sql, params);
        res.json({ entries, opening_balance: openingBalance });
    } catch (err) {
        console.error("Cash ledger error:", err);
        res.status(500).json({ error: "Failed to fetch cash ledger" });
    }
});

// GET /api/ledger/bank
router.get('/bank', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId = req.headers['x-branch-id'] || req.user.branch_id;
    const { startDate, endDate } = req.query;

    try {
        let sql = `SELECT * FROM bank_ledger WHERE company_id = $1 AND branch_id = $2`;
        let params = [companyId, branchId];
        let pIndex = 3;

        if (startDate) {
            sql += ` AND date >= $${pIndex++}`;
            params.push(startDate);
        }
        if (endDate) {
            sql += ` AND date <= $${pIndex++}`;
            params.push(endDate);
        }
        sql += ` ORDER BY date ASC, created_at ASC`;

        // Calculate opening balance before startDate
        let openingBalance = 0;
        if (startDate) {
            const obSql = `SELECT direction, SUM(amount) as total FROM bank_ledger WHERE company_id = $1 AND branch_id = $2 AND date < $3 GROUP BY direction`;
            const obRows = await db.pgAll(obSql, [companyId, branchId, startDate]);
            let cin = 0, cout = 0;
            obRows.forEach(r => {
                if (r.direction === 'in') cin += Number(r.total);
                if (r.direction === 'out') cout += Number(r.total);
            });
            openingBalance = cin - cout;
        }

        const entries = await db.pgAll(sql, params);
        res.json({ entries, opening_balance: openingBalance });
    } catch (err) {
        console.error("Bank ledger error:", err);
        res.status(500).json({ error: "Failed to fetch bank ledger" });
    }
});
// GET /api/ledger/health-summary
router.get('/health-summary', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId = req.headers['x-branch-id'] || req.user.branch_id;

    try {
        // Cash & Bank
        const cashRows = await db.pgAll(`SELECT direction, SUM(amount) as total FROM cash_ledger WHERE company_id=$1 AND branch_id=$2 GROUP BY direction`, [companyId, branchId]);
        let totalCash = 0;
        cashRows.forEach(r => { if(r.direction==='in') totalCash += Number(r.total); else totalCash -= Number(r.total); });

        const bankRows = await db.pgAll(`SELECT direction, SUM(amount) as total FROM bank_ledger WHERE company_id=$1 AND branch_id=$2 GROUP BY direction`, [companyId, branchId]);
        let totalBank = 0;
        bankRows.forEach(r => { if(r.direction==='in') totalBank += Number(r.total); else totalBank -= Number(r.total); });

        // Sales, Invoices & Payments
        const invoiceRows = await db.pgAll(`
            SELECT 
                SUM(total_amount) as total_invoice,
                SUM(paid_amount) as total_payments
            FROM invoices WHERE company_id=$1 AND branch_id=$2
        `, [companyId, branchId]);
        
        const totalSales = Number(invoiceRows[0]?.total_invoice || 0); // Equivalent to total_invoice
        const totalPayments = Number(invoiceRows[0]?.total_payments || 0);

        // Expenses & Returns from transactions
        const txRows = await db.pgAll(`
            SELECT category, SUM(amount) as total
            FROM transactions
            WHERE company_id=$1 AND branch_id=$2
            GROUP BY category
        `, [companyId, branchId]);

        let totalExpenses = 0;
        let totalReturns = 0;
        txRows.forEach(r => {
            if(r.category === 'EXPENSE') totalExpenses += Number(r.total);
            if(r.category === 'RETURN') totalReturns += Number(r.total);
        });

        // Also add purchase bills to expenses
        const billRows = await db.pgAll(`
            SELECT SUM(total_amount) as total FROM purchase_bills WHERE company_id=$1 AND branch_id=$2
        `, [companyId, branchId]);
        totalExpenses += Number(billRows[0]?.total || 0);

        // Chart Data: Monthly Sales vs Expenses
        const monthlyRows = await db.pgAll(`
            SELECT 
                TO_CHAR(date, 'YYYY-MM') as month,
                SUM(CASE WHEN type='INVOICE' OR category='RECEIPT' THEN amount ELSE 0 END) as monthly_payments,
                SUM(CASE WHEN category='SALES' THEN amount ELSE 0 END) as monthly_sales,
                SUM(CASE WHEN category='EXPENSE' OR category='BILL' THEN amount ELSE 0 END) as monthly_expenses
            FROM transactions 
            WHERE company_id=$1 AND branch_id=$2 AND date >= CURRENT_DATE - INTERVAL '6 months'
            GROUP BY TO_CHAR(date, 'YYYY-MM')
            ORDER BY month ASC
        `, [companyId, branchId]);

        // If transactions aren't mapped properly to SALES, let's also aggregate from invoices
        const invoiceMonthlyRows = await db.pgAll(`
            SELECT 
                TO_CHAR(created_at, 'YYYY-MM') as month,
                SUM(total_amount) as monthly_sales
            FROM invoices 
            WHERE company_id=$1 AND branch_id=$2 AND created_at >= CURRENT_DATE - INTERVAL '6 months'
            GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        `, [companyId, branchId]);

        // Merge monthly data simply
        let chartDataMap = {};
        monthlyRows.forEach(r => {
            chartDataMap[r.month] = {
                month: r.month,
                sales: Number(r.monthly_sales || 0),
                expenses: Number(r.monthly_expenses || 0),
                payments: Number(r.monthly_payments || 0)
            };
        });

        invoiceMonthlyRows.forEach(r => {
            if(!chartDataMap[r.month]) {
                chartDataMap[r.month] = { month: r.month, sales: 0, expenses: 0, payments: 0 };
            }
            // Add invoice totals mapping exactly as actual real business logic
            chartDataMap[r.month].sales += Number(r.monthly_sales || 0);
        });

        let chartData = Object.values(chartDataMap).sort((a,b) => a.month.localeCompare(b.month));

        res.json({
            baseMetrics: {
                totalCash,
                totalBank,
                totalSales,
                totalPayments,
                totalExpenses,
                totalReturns
            },
            chartData
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
        const filters = {
            start_date: req.query.start_date,
            end_date: req.query.end_date
        };

        const statement = await supplierLedgerService.buildSupplierLedgerStatement(companyId, supplierId, filters);
        
        if (!statement) {
            return res.status(404).json({ error: "Supplier not found" });
        }

        res.json(statement);
    } catch (err) {
        console.error("Supplier ledger error:", err);
        res.status(500).json({ error: "Failed to fetch supplier ledger statement" });
    }
});

export default router;
