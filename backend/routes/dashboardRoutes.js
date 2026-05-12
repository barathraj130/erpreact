// backend/routes/dashboardRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * 📊 DASHBOARD SUMMARY
 * Separation of Real TAX, Real NON-TAX, and Name-sake revenue
 */
// Helper for branch filtering (centralized)
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

router.get('/summary', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { filter: branchFilter } = getBranchFilter(req);

    console.log('Dashboard API called for company_id:', companyId, 'branchFilter:', branchFilter);

    try {
        // CASH: branch filter OK here (cash_ledger always has branch_id set)
        const cashSql = `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) as balance FROM cash_ledger WHERE company_id = $1`;
        const bankSql = `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) as balance FROM bank_ledger WHERE company_id = $1`;

        // REVENUE ALL TIME — no branch filter, no is_deleted filter (matches invoices page: WHERE company_id = $1)
        const totalRevSql = `
            SELECT COALESCE(SUM(total_amount), 0) as total_revenue
            FROM invoices
            WHERE company_id = $1
        `;

        // THIS MONTH only
        const monthRevSql = `
            SELECT COALESCE(SUM(total_amount), 0) as month_revenue
            FROM invoices
            WHERE company_id = $1
              AND invoice_date >= DATE_TRUNC('month', CURRENT_DATE)
              AND invoice_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
        `;

        // OUTSTANDING — matches invoices page logic exactly
        const outstandingSql = `
            SELECT COALESCE(SUM(total_amount - paid_amount), 0) as outstanding
            FROM invoices
            WHERE company_id = $1
              AND total_amount > paid_amount
        `;

        // SALES BREAKDOWN — no branch filter
        const salesBreakdownSql = `
            SELECT 
                COALESCE(SUM(CASE WHEN UPPER(TRIM(COALESCE(invoice_type,''))) IN ('TAX', 'TAX INVOICE', 'GST', 'TAXABLE', 'TAX_INVOICE') THEN total_amount ELSE 0 END), 0) as tax_sales,
                COALESCE(SUM(CASE WHEN UPPER(TRIM(COALESCE(invoice_type,''))) NOT IN ('TAX', 'TAX INVOICE', 'GST', 'TAXABLE', 'TAX_INVOICE') THEN total_amount ELSE 0 END), 0) as anon_sales
            FROM invoices
            WHERE company_id = $1
        `;

        const [cashRes, bankRes, totalRevRes, monthRevRes, outstandingRes, salesRes] = await Promise.all([
            db.pgGet(cashSql, [companyId]),
            db.pgGet(bankSql, [companyId]),
            db.pgGet(totalRevSql, [companyId]),
            db.pgGet(monthRevSql, [companyId]),
            db.pgGet(outstandingSql, [companyId]),
            db.pgGet(salesBreakdownSql, [companyId])
        ]);

        const availableCash = Number(cashRes?.balance || 0) + Number(bankRes?.balance || 0);

        const response = {
            available_cash: availableCash,
            total_revenue: parseFloat(totalRevRes?.total_revenue || 0),
            total_monthly_sales: parseFloat(monthRevRes?.month_revenue || 0),
            outstanding_receivables: parseFloat(outstandingRes?.outstanding || 0),
            sales_breakdown: {
                tax_sales: parseFloat(salesRes?.tax_sales || 0),
                anon_sales: parseFloat(salesRes?.anon_sales || 0),
                name_sake_sales: 0
            }
        };

        console.log('Dashboard final response:', response);
        res.json(response);

    } catch (err) {
        console.error("Dashboard summary error:", err);
        res.status(500).json({ error: "Failed to fetch dashboard summary" });
    }
});



/**
 * 📈 MONTHLY SALES TREND
 */
router.get('/monthly-sales-trend', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT 
                TO_CHAR(DATE_TRUNC('month', invoice_date), 'Mon YY') as month,
                TO_CHAR(DATE_TRUNC('month', invoice_date), 'YYYY-MM-01') as month_date,
                COALESCE(SUM(total_amount), 0) as revenue,
                COUNT(*) as invoice_count
            FROM invoices
            WHERE company_id = $1
            GROUP BY DATE_TRUNC('month', invoice_date)
            ORDER BY DATE_TRUNC('month', invoice_date) ASC
        `;
        const trend = await db.pgAll(sql, [companyId]);
        console.log('Monthly trend result:', trend);
        res.json(trend);
    } catch (err) {
        console.error("Trend error:", err);
        res.status(500).json({ error: "Failed to fetch sales trend" });
    }
});

/**
 * 📊 TOP OUTSTANDING CUSTOMERS
 */
router.get('/outstanding-by-customer', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT 
                u.username as name,
                u.id as customer_id,
                COALESCE(SUM(i.total_amount - i.paid_amount), 0) as amount
            FROM users u
            JOIN invoices i ON i.customer_id = u.id
            WHERE i.company_id = $1
              AND (i.total_amount - i.paid_amount) > 0
            GROUP BY u.id, u.username
            ORDER BY amount DESC
            LIMIT 10
        `;
        const data = await db.pgAll(sql, [companyId]);
        console.log('Top outstanding customers:', data.length, 'records');
        res.json(data);
    } catch (err) {
        console.error("Outstanding error:", err);
        res.status(500).json({ error: "Failed to fetch outstanding data" });
    }
});

/**
 * 💸 EXPENSE BREAKDOWN
 */
router.get('/expense-breakdown', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        // Try ledger_entries EXPENSE accounts first
        let expenses = [];
        try {
            const ledgerSql = `
                SELECT 
                    ca.name as category,
                    SUM(COALESCE(l.debit, 0) - COALESCE(l.credit, 0)) as amount
                FROM ledger_entries l
                JOIN chart_of_accounts ca ON l.account_id = ca.id
                WHERE l.company_id = $1
                  AND UPPER(ca.account_type) = 'EXPENSE'
                GROUP BY ca.name
                HAVING SUM(COALESCE(l.debit, 0) - COALESCE(l.credit, 0)) > 0
                ORDER BY amount DESC
            `;
            expenses = await db.pgAll(ledgerSql, [companyId]);
        } catch(e) { expenses = []; }

        // Fallback: use purchase_bills as COGS proxy
        if (!expenses || expenses.length === 0) {
            try {
                const cogsSql = `
                    SELECT 'Purchases (COGS)' as category, COALESCE(SUM(total_amount), 0) as amount
                    FROM purchase_bills
                    WHERE company_id = $1
                `;
                const cogs = await db.pgGet(cogsSql, [companyId]);
                if (cogs && parseFloat(cogs.amount) > 0) expenses = [cogs];
            } catch(e) { expenses = []; }
        }

        console.log('Expense breakdown:', expenses.length, 'categories');
        res.json(expenses);
    } catch (err) {
        console.error("Expense breakdown error:", err);
        res.status(500).json({ error: "Failed to fetch expense breakdown" });
    }
});

/**
 * 📊 DASHBOARD KPIs (Used by Dashboard.tsx)
 */
router.get('/kpis', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { filter: branchFilter } = getBranchFilter(req);

    try {
        const salesSql = `
            SELECT 
                COALESCE(SUM(total_amount), 0) as monthly_sales,
                COALESCE(SUM(CASE WHEN invoice_type = 'TAX_INVOICE' THEN total_amount ELSE 0 END), 0) as tax_amount,
                COALESCE(SUM(CASE WHEN invoice_type = 'RETAIL_SALE' THEN total_amount ELSE 0 END), 0) as anon_amount
            FROM invoices
            WHERE company_id = $1 AND ${branchFilter}
              AND bill_purpose != 'name_only'
        `;
        const salesRes = await db.pgGet(salesSql, [companyId]);

        const outstandingSql = `
            SELECT 
                COALESCE(SUM(total_amount - paid_amount), 0) as outstanding_receivables
            FROM invoices 
            WHERE company_id = $1 AND ${branchFilter} 
              AND total_amount > paid_amount 
        `;
        const outstandingRes = await db.pgGet(outstandingSql, [companyId]);

        res.json({
            success: true,
            data: {
                monthly_sales: parseFloat(salesRes?.monthly_sales || 0),
                sales_breakdown: {
                    tax_amount: parseFloat(salesRes?.tax_amount || 0),
                    anon_amount: parseFloat(salesRes?.anon_amount || 0)
                },
                outstanding_receivables: parseFloat(outstandingRes?.outstanding_receivables || 0),
                outstanding_payables: 0 // Placeholder
            }
        });
    } catch (err) {
        console.error("Dashboard KPIs error:", err);
        res.status(500).json({ error: "Failed to fetch KPIs" });
    }
});

/**
 * 💰 DASHBOARD FINANCE (Used by Dashboard.tsx)
 */
router.get('/finance', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { filter: branchFilter } = getBranchFilter(req);

    try {
        const cashSql = `
            SELECT 
                SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END) as balance
            FROM cash_ledger
            WHERE company_id = $1 AND ${branchFilter}
        `;
        const bankSql = `
            SELECT 
                SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END) as balance
            FROM bank_ledger
            WHERE company_id = $1 AND ${branchFilter}
        `;
        
        const [cashRes, bankRes] = await Promise.all([
            db.pgGet(cashSql, [companyId]),
            db.pgGet(bankSql, [companyId])
        ]);

        const expenseSql = `
            SELECT ca.name as category, SUM(COALESCE(l.debit, 0) - COALESCE(l.credit, 0)) as amount
            FROM ledger_entries l
            JOIN chart_of_accounts ca ON l.account_id = ca.id
            WHERE l.company_id = $1 
              AND ${branchFilter.replace('branch_id', 'l.branch_id')}
              AND ca.account_type = 'EXPENSE'
              AND l.entry_date >= DATE_TRUNC('month', CURRENT_DATE)
            GROUP BY ca.name
        `;
        const expenses = await db.pgAll(expenseSql, [companyId]);

        const trendSql = `
            SELECT 
                DATE_TRUNC('month', invoice_date) as month,
                COALESCE(SUM(total_amount), 0) as sales
            FROM invoices
            WHERE company_id = $1 AND ${branchFilter} 
              AND invoice_date >= CURRENT_DATE - INTERVAL '12 months'
              AND bill_purpose != 'name_only'
            GROUP BY DATE_TRUNC('month', invoice_date) 
            ORDER BY DATE_TRUNC('month', invoice_date) ASC
        `;
        const trend = await db.pgAll(trendSql, [companyId]);

        res.json({
            success: true,
            data: {
                summary: {
                    cash_balance: parseFloat(cashRes?.balance || 0),
                    total_income: parseFloat(bankRes?.balance || 0),
                    net_profit: parseFloat(cashRes?.balance || 0) + parseFloat(bankRes?.balance || 0)
                },
                expenses_by_category: expenses,
                monthly_trend: trend
            }
        });
    } catch (err) {
        console.error("Dashboard finance error:", err);
        res.status(500).json({ error: "Failed to fetch finance data" });
    }
});

/**
 * 🏢 BRANCH OVERVIEW
 */
router.get('/branch-overview', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const branches = await db.pgAll(`
            SELECT b.id, b.branch_name, b.branch_code,
                   (SELECT COUNT(*) FROM products p WHERE p.company_id = $1) as total_products,
                   (SELECT COUNT(*) FROM products p WHERE p.company_id = $1 AND p.stock_quantity < 10) as low_stock_count
            FROM branches b
            WHERE b.company_id = $1
        `, [companyId]);

        res.json({
            success: true,
            data: {
                pending_requests_count: 0,
                branch_metrics: branches.map(b => ({
                    ...b,
                    stock_value: 0
                }))
            }
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch branch overview" });
    }
});


export default router;
