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
    const { filter: branchFilter, branchId } = getBranchFilter(req);

    try {
        // 1. Available Cash
        const cashSql = `SELECT direction, SUM(amount) as total FROM cash_ledger WHERE company_id = $1 AND ${branchFilter} AND is_deleted = false GROUP BY direction`;
        const bankSql = `SELECT direction, SUM(amount) as total FROM bank_ledger WHERE company_id = $1 AND ${branchFilter} AND is_deleted = false GROUP BY direction`;
        
        const [cashRes, bankRes] = await Promise.all([
            db.pgAll(cashSql, [companyId]),
            db.pgAll(bankSql, [companyId])
        ]);

        let availableCash = 0;
        cashRes.forEach(r => { if(r.direction === 'in') availableCash += Number(r.total); else availableCash -= Number(r.total); });
        bankRes.forEach(r => { if(r.direction === 'in') availableCash += Number(r.total); else availableCash -= Number(r.total); });

        // 2. Sales Breakdown
        const salesSql = `
            SELECT 
                SUM(CASE WHEN invoice_type = 'TAX' AND bill_purpose != 'name_only' THEN total_amount ELSE 0 END) as tax_sales,
                SUM(CASE WHEN invoice_type = 'NON_TAX' AND bill_purpose != 'name_only' THEN total_amount ELSE 0 END) as anon_sales,
                SUM(CASE WHEN bill_purpose = 'name_only' THEN total_amount ELSE 0 END) as name_sake_sales
            FROM invoices
            WHERE company_id = $1 AND ${branchFilter}
              AND invoice_date >= DATE_TRUNC('month', CURRENT_DATE)
        `;
        const salesRes = await db.pgGet(salesSql, [companyId]);

        const txIncomeSql = `
            SELECT SUM(amount) as total
            FROM transactions
            WHERE company_id = $1 AND ${branchFilter}
              AND type IN ('RECEIPT', 'INCOME')
              AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
              AND is_deleted = false
        `;
        const txIncomeRes = await db.pgGet(txIncomeSql, [companyId]);

        const totalMonthlySales = parseFloat(salesRes?.tax_sales || 0) + 
                                  parseFloat(salesRes?.anon_sales || 0) + 
                                  parseFloat(txIncomeRes?.total || 0);

        // 3. Pending Branch Requests
        const reqSql = `SELECT COUNT(*) as pending FROM inventory_movements WHERE company_id = $1 AND type = 'Transfer' AND note LIKE '%Pending%'`;
        const reqRes = await db.pgGet(reqSql, [companyId]);

        res.json({
            available_cash: availableCash,
            total_monthly_sales: totalMonthlySales,
            sales_breakdown: {
                tax_sales: parseFloat(salesRes?.tax_sales || 0),
                anon_sales: parseFloat(salesRes?.anon_sales || 0) + parseFloat(txIncomeRes?.total || 0),
                name_sake_sales: parseFloat(salesRes?.name_sake_sales || 0)
            },
            branch_requests_pending: parseInt(reqRes?.pending || 0),
            debugInfo: { companyId, branchId, filter: branchFilter }
        });


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
    const { filter: branchFilter } = getBranchFilter(req);

    try {
        const sql = `
            SELECT 
                TO_CHAR(invoice_date, 'Mon YYYY') as month,
                SUM(CASE WHEN bill_purpose != 'name_only' THEN total_amount ELSE 0 END) as real_revenue,
                SUM(CASE WHEN bill_purpose = 'name_only' THEN total_amount ELSE 0 END) as name_sake_revenue
            FROM invoices
            WHERE company_id = $1 AND ${branchFilter} AND invoice_date >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY month, DATE_TRUNC('month', invoice_date)
            ORDER BY DATE_TRUNC('month', invoice_date) ASC
        `;
        const trend = await db.pgAll(sql, [companyId]);
        res.json(trend);
    } catch (err) {
        console.error("Trend error:", err);
        res.status(500).json({ error: "Failed to fetch sales trend" });
    }
});

/**
 * 💸 EXPENSE BREAKDOWN
 */
router.get('/expense-breakdown', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { filter: branchFilter } = getBranchFilter(req);

    try {
        const sql = `
            SELECT 
                ca.name as category,
                SUM(ABS(l.amount)) as amount
            FROM ledger_entries l
            JOIN chart_of_accounts ca ON l.account_id = ca.id
            WHERE l.company_id = $1 
              AND ${branchFilter.replace('branch_id', 'l.branch_id')}
              AND ca.account_type = 'EXPENSE'
              AND l.date >= DATE_TRUNC('month', CURRENT_DATE)
            GROUP BY ca.name
            ORDER BY amount DESC
        `;
        const expenses = await db.pgAll(sql, [companyId]);
        res.json(expenses);
    } catch (err) {
        console.error("Expense breakdown error:", err);
        res.status(500).json({ error: "Failed to fetch expense breakdown" });
    }
});

export default router;
