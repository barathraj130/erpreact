// backend/routes/dashboardRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * 📊 DASHBOARD SUMMARY
 * Separation of Real TAX, Real NON-TAX, and Name-sake revenue
 */
router.get('/summary', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const branchId = req.user.branch_id;
    const isMain = req.user.role === 'admin';

    try {
        let branchFilter = isMain ? "" : "AND branch_id = " + branchId;

        // 1. Available Cash (Live)
        const cashSql = `SELECT COALESCE(SUM(current_balance), 0) as total FROM chart_of_accounts WHERE company_id = $1 AND account_code LIKE '10%'`;
        const cashRes = await db.pgGet(cashSql, [companyId]);

        // 2. Sales Breakdown (MTD)
        const salesSql = `
            SELECT 
                SUM(CASE WHEN invoice_type = 'TAX' AND bill_purpose != 'name_only' THEN total_amount ELSE 0 END) as tax_sales,
                SUM(CASE WHEN invoice_type = 'NON_TAX' AND bill_purpose != 'name_only' THEN total_amount ELSE 0 END) as anon_sales,
                SUM(CASE WHEN bill_purpose = 'name_only' THEN total_amount ELSE 0 END) as name_sake_sales
            FROM invoices
            WHERE company_id = $1 ${branchFilter}
              AND invoice_date >= DATE_TRUNC('month', CURRENT_DATE)
        `;
        const salesRes = await db.pgGet(salesSql, [companyId]);

        // 3. Pending Branch Requests
        const reqSql = `SELECT COUNT(*) as pending FROM inventory_movements WHERE company_id = $1 AND type = 'Transfer' AND note LIKE '%Pending%'`;
        const reqRes = await db.pgGet(reqSql, [companyId]);

        res.json({
            available_cash: parseFloat(cashRes.total),
            total_monthly_sales: parseFloat(salesRes.tax_sales || 0) + parseFloat(salesRes.anon_sales || 0),
            sales_breakdown: {
                tax_sales: parseFloat(salesRes.tax_sales || 0),
                anon_sales: parseFloat(salesRes.anon_sales || 0),
                name_sake_sales: parseFloat(salesRes.name_sake_sales || 0)
            },
            branch_requests_pending: parseInt(reqRes.pending || 0)
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
    try {
        const sql = `
            SELECT 
                TO_CHAR(invoice_date, 'Mon YYYY') as month,
                SUM(CASE WHEN bill_purpose != 'name_only' THEN total_amount ELSE 0 END) as real_revenue,
                SUM(CASE WHEN bill_purpose = 'name_only' THEN total_amount ELSE 0 END) as name_sake_revenue
            FROM invoices
            WHERE company_id = $1 AND invoice_date >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY month, DATE_TRUNC('month', invoice_date)
            ORDER BY DATE_TRUNC('month', invoice_date) ASC
        `;
        const trend = await db.pgAll(sql, [companyId]);
        res.json(trend);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch sales trend" });
    }
});

/**
 * 💸 EXPENSE BREAKDOWN
 */
router.get('/expense-breakdown', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        // Typically fetching from ledger entries or specialized expense table
        // For now, grouping by transaction description categories or expense-type accounts
        const sql = `
            SELECT 
                ca.name as category,
                SUM(ABS(l.amount)) as amount
            FROM ledger_entries l
            JOIN chart_of_accounts ca ON l.account_id = ca.id
            WHERE l.company_id = $1 
              AND ca.account_type = 'EXPENSE'
              AND l.date >= DATE_TRUNC('month', CURRENT_DATE)
            GROUP BY ca.name
            ORDER BY amount DESC
        `;
        const expenses = await db.pgAll(sql, [companyId]);
        res.json(expenses);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch expense breakdown" });
    }
});

export default router;
