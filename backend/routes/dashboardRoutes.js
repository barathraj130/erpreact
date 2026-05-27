// backend/routes/dashboardRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

// Always send no-cache so the browser never serves a stale dashboard response.
const noCache = (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
};

/**
 * 📊 DASHBOARD SUMMARY
 */
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
    noCache(res);
    const companyId = req.user.active_company_id;
    const { filter: branchFilter } = getBranchFilter(req);

    console.log('Dashboard API called for company_id:', companyId, 'branchFilter:', branchFilter);

    try {
        const cashSql = `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) as balance FROM cash_ledger WHERE company_id = $1`;
        const bankSql = `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) as balance FROM bank_ledger WHERE company_id = $1`;

        const totalRevSql = `
            SELECT COALESCE(SUM(total_amount), 0) as total_revenue
            FROM invoices
            WHERE company_id = $1
              AND COALESCE(is_deleted, false) = false
              AND COALESCE(bill_purpose, '') != 'name_only'
        `;

        const monthRevSql = `
            SELECT COALESCE(SUM(total_amount), 0) as month_revenue
            FROM invoices
            WHERE company_id = $1
              AND COALESCE(is_deleted, false) = false
              AND COALESCE(bill_purpose, '') != 'name_only'
              AND invoice_date >= DATE_TRUNC('month', CURRENT_DATE)
              AND invoice_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
        `;

        // True outstanding: opening balance + invoices − invoice_payments − CUSTOMER_PAYMENT transactions
        // Matches the formula used on the Customers page
        const outstandingSql = `
            SELECT COALESCE(SUM(GREATEST(0,
                COALESCE((u.meta->>'customer_opening_balance')::NUMERIC, COALESCE(u.initial_balance, 0))
                + COALESCE((
                    SELECT SUM(CASE WHEN UPPER(COALESCE(i2.invoice_type,'')) != 'SALES_RETURN'
                                    THEN i2.total_amount ELSE -i2.total_amount END)
                    FROM invoices i2
                    WHERE i2.customer_id = u.id AND i2.company_id = $1
                      AND COALESCE(i2.is_deleted, false) = false
                      AND COALESCE(i2.bill_purpose, '') != 'name_only'
                ), 0)
                - COALESCE((
                    SELECT SUM(ip.amount) FROM invoice_payments ip
                    JOIN invoices i3 ON i3.id = ip.invoice_id
                    WHERE i3.customer_id = u.id AND i3.company_id = $1
                      AND COALESCE(i3.is_deleted, false) = false
                ), 0)
                - COALESCE((
                    SELECT SUM(t.amount) FROM transactions t
                    WHERE t.reference_id = u.id AND t.company_id = $1
                      AND t.type = 'CUSTOMER_PAYMENT'
                ), 0)
            )), 0) as outstanding
            FROM users u
            WHERE u.role IN ('user','customer') AND u.company_id = $1
        `;

        const salesBreakdownSql = `
            SELECT
                COALESCE(SUM(CASE WHEN UPPER(TRIM(COALESCE(invoice_type,''))) IN ('TAX_INVOICE','TAX INVOICE','GST','TAXABLE','TAX') THEN total_amount ELSE 0 END), 0) as tax_sales,
                COALESCE(SUM(CASE WHEN UPPER(TRIM(COALESCE(invoice_type,''))) NOT IN ('TAX_INVOICE','TAX INVOICE','GST','TAXABLE','TAX') THEN total_amount ELSE 0 END), 0) as anon_sales
            FROM invoices
            WHERE company_id = $1
              AND COALESCE(is_deleted, false) = false
              AND COALESCE(bill_purpose, '') != 'name_only'
        `;

        // Count customers with positive outstanding balance (proper subquery, no HAVING)
        const outstandingCountSql = `
            SELECT COUNT(*) as cnt FROM (
                SELECT GREATEST(0,
                    COALESCE((u.meta->>'customer_opening_balance')::NUMERIC, COALESCE(u.initial_balance, 0))
                    + COALESCE((
                        SELECT SUM(CASE WHEN UPPER(COALESCE(i2.invoice_type,'')) != 'SALES_RETURN'
                                        THEN i2.total_amount ELSE -i2.total_amount END)
                        FROM invoices i2 WHERE i2.customer_id = u.id AND i2.company_id = $1
                          AND COALESCE(i2.is_deleted, false) = false
                          AND COALESCE(i2.bill_purpose, '') != 'name_only'
                    ), 0)
                    - COALESCE((
                        SELECT SUM(ip.amount) FROM invoice_payments ip
                        JOIN invoices i3 ON i3.id = ip.invoice_id
                        WHERE i3.customer_id = u.id AND i3.company_id = $1
                          AND COALESCE(i3.is_deleted, false) = false
                    ), 0)
                    - COALESCE((
                        SELECT SUM(t.amount) FROM transactions t
                        WHERE t.reference_id = u.id AND t.company_id = $1
                          AND t.type = 'CUSTOMER_PAYMENT'
                    ), 0)
                ) AS bal
                FROM users u
                WHERE u.role IN ('user','customer') AND u.company_id = $1
            ) x WHERE x.bal > 0
        `;

        const [cashRes, bankRes, totalRevRes, monthRevRes, outstandingRes, salesRes, outstandingCountRes] = await Promise.all([
            db.pgGet(cashSql, [companyId]),
            db.pgGet(bankSql, [companyId]),
            db.pgGet(totalRevSql, [companyId]),
            db.pgGet(monthRevSql, [companyId]),
            db.pgGet(outstandingSql, [companyId]),
            db.pgGet(salesBreakdownSql, [companyId]),
            db.pgGet(outstandingCountSql, [companyId])
        ]);

        const availableCash = Number(cashRes?.balance || 0) + Number(bankRes?.balance || 0);

        const response = {
            available_cash: availableCash,
            total_revenue: parseFloat(totalRevRes?.total_revenue || 0),
            total_monthly_sales: parseFloat(monthRevRes?.month_revenue || 0),
            outstanding_receivables: parseFloat(outstandingRes?.outstanding || 0),
            outstanding_customer_count: parseInt(outstandingCountRes?.cnt || 0),
            sales_breakdown: {
                tax_sales: parseFloat(salesRes?.tax_sales || 0),
                anon_sales: parseFloat(salesRes?.anon_sales || 0),
                name_sake_sales: 0
            }
        };

        console.log('Dashboard final response:', response);
        res.json(response);

    } catch (err) {
        console.error("Dashboard summary error:", err.message, err.stack);
        res.status(500).json({
            available_cash: 0,
            total_revenue: 0,
            total_monthly_sales: 0,
            outstanding_receivables: 0,
            outstanding_customer_count: 0,
            sales_breakdown: { tax_sales: 0, anon_sales: 0, name_sake_sales: 0 }
        });
    }
});


/**
 * 📈 MONTHLY SALES TREND
 */
router.get('/monthly-sales-trend', authMiddleware, async (req, res) => {
    noCache(res);
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT
                TO_CHAR(DATE_TRUNC('month', invoice_date), 'Mon YY') as month,
                COALESCE(SUM(total_amount), 0) as revenue
            FROM invoices
            WHERE company_id = $1
              AND COALESCE(is_deleted, false) = false
              AND COALESCE(bill_purpose, '') != 'name_only'
            GROUP BY DATE_TRUNC('month', invoice_date)
            ORDER BY DATE_TRUNC('month', invoice_date) ASC
        `;
        const trend = await db.pgAll(sql, [companyId]);
        res.json(trend || []);
    } catch (err) {
        console.error("Trend error:", err);
        res.json([]);
    }
});

/**
 * 📊 TOP OUTSTANDING CUSTOMERS
 */
router.get('/outstanding-by-customer', authMiddleware, async (req, res) => {
    noCache(res);
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT x.name, x.amount FROM (
                SELECT
                    COALESCE(u.nickname, u.username) as name,
                    GREATEST(0,
                        COALESCE((u.meta->>'customer_opening_balance')::NUMERIC, COALESCE(u.initial_balance, 0))
                        + COALESCE((
                            SELECT SUM(CASE WHEN UPPER(COALESCE(i2.invoice_type,'')) != 'SALES_RETURN'
                                            THEN i2.total_amount ELSE -i2.total_amount END)
                            FROM invoices i2
                            WHERE i2.customer_id = u.id AND i2.company_id = $1
                              AND COALESCE(i2.is_deleted, false) = false
                              AND COALESCE(i2.bill_purpose, '') != 'name_only'
                        ), 0)
                        - COALESCE((
                            SELECT SUM(ip.amount) FROM invoice_payments ip
                            JOIN invoices i3 ON i3.id = ip.invoice_id
                            WHERE i3.customer_id = u.id AND i3.company_id = $1
                              AND COALESCE(i3.is_deleted, false) = false
                        ), 0)
                        - COALESCE((
                            SELECT SUM(t.amount) FROM transactions t
                            WHERE t.reference_id = u.id AND t.company_id = $1
                              AND t.type = 'CUSTOMER_PAYMENT'
                        ), 0)
                    ) as amount
                FROM users u
                WHERE u.role IN ('user','customer') AND u.company_id = $1
            ) x
            WHERE x.amount > 0
            ORDER BY x.amount DESC
            LIMIT 10
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error("Outstanding error:", err);
        res.json([]);
    }
});

/**
 * 💸 EXPENSE BREAKDOWN
 */
router.get('/expense-breakdown', authMiddleware, async (req, res) => {
    noCache(res);
    const companyId = req.user.active_company_id;
    try {
        const ledgerSql = `
            SELECT
                ca.name as category,
                SUM(COALESCE(le.debit, 0) - COALESCE(le.credit, 0)) as amount
            FROM ledger_entries le
            JOIN chart_of_accounts ca ON le.account_id = ca.id
            WHERE le.company_id = $1
              AND (ca.name ILIKE '%expense%' OR ca.name ILIKE '%salary%' OR ca.name ILIKE '%commission%')
            GROUP BY ca.name
            HAVING SUM(COALESCE(le.debit, 0) - COALESCE(le.credit, 0)) > 0
            ORDER BY amount DESC
        `;
        const expenses = await db.pgAll(ledgerSql, [companyId]);
        res.json(expenses && expenses.length > 0 ? expenses : [{ category: "No expenses recorded", amount: 0 }]);
    } catch (err) {
        console.error("Expense breakdown error:", err);
        res.json([{ category: "No expenses recorded", amount: 0 }]);
    }
});

/**
 * 📊 DASHBOARD KPIs
 */
router.get('/kpis', authMiddleware, async (req, res) => {
    noCache(res);
    const companyId = req.user.active_company_id;
    const { filter: branchFilter } = getBranchFilter(req);

    try {
        const salesSql = `
            SELECT
                COALESCE(SUM(total_amount), 0) as monthly_sales,
                COALESCE(SUM(CASE WHEN invoice_type = 'TAX_INVOICE' THEN total_amount ELSE 0 END), 0) as tax_amount,
                COALESCE(SUM(CASE WHEN invoice_type = 'RETAIL_SALE' THEN total_amount ELSE 0 END), 0) as anon_amount
            FROM invoices
            WHERE company_id = $1
              AND ${branchFilter}
              AND COALESCE(is_deleted, false) = false
              AND COALESCE(bill_purpose, '') != 'name_only'
        `;
        const salesRes = await db.pgGet(salesSql, [companyId]);

        const outstandingSql = `
            SELECT COALESCE(SUM(GREATEST(0, total_amount - paid_amount)), 0) as outstanding_receivables
            FROM invoices
            WHERE company_id = $1
              AND ${branchFilter}
              AND COALESCE(is_deleted, false) = false
              AND COALESCE(status, 'PENDING') != 'PAID'
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
                outstanding_payables: 0
            }
        });
    } catch (err) {
        console.error("Dashboard KPIs error:", err);
        res.json({
            success: true,
            data: { monthly_sales: 0, sales_breakdown: { tax_amount: 0, anon_amount: 0 }, outstanding_receivables: 0, outstanding_payables: 0 }
        });
    }
});

/**
 * 💰 DASHBOARD FINANCE
 */
router.get('/finance', authMiddleware, async (req, res) => {
    noCache(res);
    const companyId = req.user.active_company_id;
    const { filter: branchFilter } = getBranchFilter(req);

    try {
        const cashSql = `
            SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) as balance
            FROM cash_ledger
            WHERE company_id = $1 AND ${branchFilter}
        `;
        const bankSql = `
            SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) as balance
            FROM bank_ledger
            WHERE company_id = $1 AND ${branchFilter}
        `;

        const [cashRes, bankRes] = await Promise.all([
            db.pgGet(cashSql, [companyId]),
            db.pgGet(bankSql, [companyId])
        ]);

        let expenses = [];
        try {
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
            expenses = await db.pgAll(expenseSql, [companyId]) || [];
        } catch (_) { /* ledger_entries may be empty — safe */ }

        let trend = [];
        try {
            const trendSql = `
                SELECT
                    DATE_TRUNC('month', invoice_date) as month,
                    COALESCE(SUM(total_amount), 0) as sales
                FROM invoices
                WHERE company_id = $1
                  AND ${branchFilter}
                  AND COALESCE(is_deleted, false) = false
                  AND invoice_date >= CURRENT_DATE - INTERVAL '12 months'
                  AND COALESCE(bill_purpose, '') != 'name_only'
                GROUP BY DATE_TRUNC('month', invoice_date)
                ORDER BY DATE_TRUNC('month', invoice_date) ASC
            `;
            trend = await db.pgAll(trendSql, [companyId]) || [];
        } catch (_) { /* invoices may be empty — safe */ }

        const cashBal = parseFloat(cashRes?.balance || 0);
        const bankBal = parseFloat(bankRes?.balance || 0);

        res.json({
            success: true,
            data: {
                summary: {
                    cash_balance: cashBal,
                    total_income: bankBal,
                    net_profit: cashBal + bankBal
                },
                expenses_by_category: expenses,
                monthly_trend: trend
            }
        });
    } catch (err) {
        console.error("Dashboard finance error:", err);
        res.json({
            success: true,
            data: { summary: { cash_balance: 0, total_income: 0, net_profit: 0 }, expenses_by_category: [], monthly_trend: [] }
        });
    }
});

/**
 * 🏢 BRANCH OVERVIEW
 */
router.get('/branch-overview', authMiddleware, async (req, res) => {
    noCache(res);
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
                branch_metrics: (branches || []).map(b => ({ ...b, stock_value: 0 }))
            }
        });
    } catch (err) {
        console.error("Branch overview error:", err);
        res.json({ success: true, data: { pending_requests_count: 0, branch_metrics: [] } });
    }
});

export default router;
