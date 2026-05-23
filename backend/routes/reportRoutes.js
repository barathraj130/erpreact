// backend/routes/reportRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * 📊 SALES REGISTER
 */
router.get('/sales/register', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate, customer_id, show_name_sake = 'false' } = req.query;

    try {
        let where = "WHERE i.company_id = $1 AND COALESCE(i.is_deleted, false) = false";
        let params = [companyId];

        if (startDate && endDate) {
            where += " AND i.invoice_date >= $2::date AND i.invoice_date <= $3::date";
            params.push(startDate, endDate);
        }

        if (customer_id) {
            where += ` AND i.customer_id = $${params.length + 1}`;
            params.push(customer_id);
        }

        if (show_name_sake !== 'true') {
            where += " AND COALESCE(i.bill_purpose, '') != 'name_only'";
        }

        const sql = `
            SELECT
                i.*,
                u.username as customer_name,
                COALESCE(p_cash.amount, 0) as cash_collected,
                COALESCE(p_upi.amount, 0) as upi_collected,
                COALESCE(p_bank.amount, 0) as bank_collected
            FROM invoices i
            LEFT JOIN users u ON i.customer_id = u.id
            LEFT JOIN (SELECT invoice_id, SUM(amount) as amount FROM invoice_payments WHERE payment_method = 'CASH' GROUP BY invoice_id) p_cash ON i.id = p_cash.invoice_id
            LEFT JOIN (SELECT invoice_id, SUM(amount) as amount FROM invoice_payments WHERE payment_method = 'UPI' GROUP BY invoice_id) p_upi ON i.id = p_upi.invoice_id
            LEFT JOIN (SELECT invoice_id, SUM(amount) as amount FROM invoice_payments WHERE (payment_method = 'BANK' OR payment_method = 'NEFT') GROUP BY invoice_id) p_bank ON i.id = p_bank.invoice_id
            ${where}
            ORDER BY i.invoice_date DESC, i.id DESC
        `;

        let rows = await db.pgAll(sql, params);

        // AUTO-EXPAND: If no data in period, show ALL TIME
        if (rows.length === 0 && startDate && endDate) {
            const allTimeSql = sql.replace(/AND i\.invoice_date >= \$2::date AND i\.invoice_date <= \$3::date/, "");
            rows = await db.pgAll(allTimeSql, [companyId, ...(customer_id ? [customer_id] : [])]);
        }

        res.json(rows || []);
    } catch (err) {
        console.error("Sales register error:", err);
        res.json([]);
    }
});

/**
 * 🤝 CUSTOMER-WISE SALES
 */
router.get('/sales/customer-wise', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT
                u.username as customer_name,
                COUNT(i.id) as invoice_count,
                COALESCE(SUM(i.total_amount), 0) as total_sales,
                COALESCE(SUM(i.paid_amount), 0) as total_paid,
                COALESCE(SUM(i.total_amount - i.paid_amount), 0) as balance,
                MAX(i.invoice_date) as last_date
            FROM users u
            JOIN invoices i ON u.id = i.customer_id
            WHERE u.company_id = $1
              AND COALESCE(i.bill_purpose, '') != 'name_only'
              AND COALESCE(i.is_deleted, false) = false
              AND u.role = 'customer'
            GROUP BY u.id, u.username
            ORDER BY total_sales DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error("Customer sales error:", err);
        res.json([]);
    }
});

/**
 * 🍎 PRODUCT-WISE SALES
 */
router.get('/sales/product-wise', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT
                p.name as product_name,
                COALESCE(SUM(li.quantity), 0) as total_qty,
                COALESCE(AVG(li.unit_price), 0) as avg_price,
                COALESCE(SUM(li.line_total), 0) as revenue
            FROM invoice_line_items li
            JOIN invoices i ON li.invoice_id = i.id
            JOIN products p ON li.product_id = p.id
            WHERE i.company_id = $1
              AND COALESCE(i.bill_purpose, '') != 'name_only'
              AND COALESCE(i.is_deleted, false) = false
            GROUP BY p.id, p.name
            ORDER BY revenue DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error("Product sales error:", err);
        res.json([]);
    }
});

/**
 * 📦 STOCK SUMMARY
 */
router.get('/inventory/summary', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT
                id, name, sku, current_stock, unit, cost_price as avg_cost,
                (current_stock * cost_price) as stock_value
            FROM products
            WHERE company_id = $1 AND COALESCE(is_deleted, false) = false
            ORDER BY current_stock DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error("Stock summary error:", err);
        res.json([]);
    }
});

/**
 * 💸 EXPENSES (Horizontal Bar Chart Data)
 */
router.get('/finance/expenses', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT ca.name as name, SUM(COALESCE(l.debit, 0) - COALESCE(l.credit, 0)) as amount
            FROM ledger_entries l
            JOIN chart_of_accounts ca ON l.account_id = ca.id
            WHERE l.company_id = $1 AND ca.account_type = 'EXPENSE'
            GROUP BY ca.name
            ORDER BY amount DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error("Finance expenses error:", err);
        res.json([]);
    }
});

/**
 * 📈 DASHBOARD STATS (Landing Summary)
 */
router.get('/dashboard-stats', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const [todaySales, todayPurchases, receivables, outputGst, inputGst, activeCustomers] = await Promise.all([
            db.pgGet(`SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE company_id = $1 AND DATE(invoice_date) = CURRENT_DATE AND COALESCE(bill_purpose,'') != 'name_only' AND COALESCE(is_deleted,false)=false`, [companyId]),
            db.pgGet(`SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_bills WHERE company_id = $1 AND DATE(bill_date) = CURRENT_DATE AND COALESCE(bill_purpose,'') != 'name_only'`, [companyId]).catch(() => ({ total: 0 })),
            db.pgGet(`SELECT COALESCE(SUM(GREATEST(0, total_amount - paid_amount)), 0) as total FROM invoices WHERE company_id = $1 AND COALESCE(bill_purpose,'') != 'name_only' AND COALESCE(is_deleted,false)=false AND COALESCE(status,'PENDING') != 'PAID'`, [companyId]),
            db.pgGet(`SELECT COALESCE(SUM(COALESCE(cgst_total,0) + COALESCE(sgst_total,0) + COALESCE(igst_total,0)), 0) as total FROM invoices WHERE company_id = $1 AND COALESCE(bill_purpose,'') != 'name_only' AND COALESCE(is_deleted,false)=false`, [companyId]),
            db.pgGet(`SELECT COALESCE(SUM(COALESCE(cgst_total,0) + COALESCE(sgst_total,0) + COALESCE(igst_total,0)), 0) as total FROM purchase_bills WHERE company_id = $1 AND COALESCE(bill_purpose,'') != 'name_only'`, [companyId]).catch(() => ({ total: 0 })),
            db.pgGet(`SELECT COUNT(*) as count FROM users WHERE company_id = $1 AND role = 'customer'`, [companyId]),
        ]);

        let cashBalance = 0;
        try {
            const [cashIn, cashOut, bankIn, bankOut] = await Promise.all([
                db.pgGet(`SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE company_id = $1 AND direction = 'in'`, [companyId]),
                db.pgGet(`SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE company_id = $1 AND direction = 'out'`, [companyId]),
                db.pgGet(`SELECT COALESCE(SUM(amount), 0) as total FROM bank_ledger WHERE company_id = $1 AND direction = 'in'`, [companyId]),
                db.pgGet(`SELECT COALESCE(SUM(amount), 0) as total FROM bank_ledger WHERE company_id = $1 AND direction = 'out'`, [companyId]),
            ]);
            cashBalance = (parseFloat(cashIn?.total || 0) - parseFloat(cashOut?.total || 0))
                        + (parseFloat(bankIn?.total || 0) - parseFloat(bankOut?.total || 0));
        } catch (_) { /* cash/bank ledger may be empty */ }

        res.json({
            today_sales:       parseFloat(todaySales?.total || 0),
            today_purchases:   parseFloat(todayPurchases?.total || 0),
            total_receivables: parseFloat(receivables?.total || 0),
            gst_liability:     parseFloat(outputGst?.total || 0) - parseFloat(inputGst?.total || 0),
            active_customers:  parseInt(activeCustomers?.count || 0),
            cash_balance:      cashBalance
        });
    } catch (err) {
        console.error("Dashboard stats error:", err);
        res.json({ today_sales: 0, today_purchases: 0, total_receivables: 0, gst_liability: 0, active_customers: 0, cash_balance: 0 });
    }
});

/**
 * ⚖️ TRIAL BALANCE
 */
router.get('/finance/trial-balance', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { filterType } = req.query;
    try {
        const { getTrialBalance } = await import('../utils/accountingEngine.js');
        const report = await getTrialBalance(companyId, filterType);
        res.json(report);
    } catch (err) {
        console.error("Trial balance error:", err);
        res.json({ accounts: [], totals: { debit: 0, credit: 0 } });
    }
});

/**
 * 📈 PROFIT & LOSS
 */
router.get('/finance/profit-loss', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate, filterType } = req.query;
    try {
        const { getProfitAndLoss } = await import('../utils/accountingEngine.js');
        const report = await getProfitAndLoss(companyId, null, startDate || '2000-01-01', endDate || '2099-12-31', filterType);
        res.json(report);
    } catch (err) {
        console.error("P&L error:", err);
        res.json({ income: [], expenses: [], net_profit: 0 });
    }
});

/**
 * 🏦 BALANCE SHEET
 */
router.get('/finance/balance-sheet', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { filterType } = req.query;
    try {
        const { getBalanceSheet } = await import('../utils/accountingEngine.js');
        const report = await getBalanceSheet(companyId, filterType);
        res.json(report);
    } catch (err) {
        console.error("Balance sheet error:", err);
        res.json({ assets: [], liabilities: [], equity: [] });
    }
});

/**
 * 📔 DAY BOOK
 */
router.get('/finance/day-book', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate, reference_id, reference_type } = req.query;
    try {
        let params = [companyId];
        let where = "WHERE l.company_id = $1";

        if (startDate && endDate) {
            where += ` AND l.entry_date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
            params.push(startDate, endDate);
        }

        if (reference_id) {
            where += ` AND t.reference_id = $${params.length + 1}`;
            params.push(reference_id);
        }

        if (reference_type) {
            where += ` AND UPPER(t.reference_type) = UPPER($${params.length + 1})`;
            params.push(reference_type);
        }

        const sql = `
            SELECT
                l.*,
                ca.name as account_name,
                t.reference_type,
                t.reference_id,
                COALESCE(tl.description, t.description) as description
            FROM ledger_entries l
            JOIN chart_of_accounts ca ON l.account_id = ca.id
            LEFT JOIN transactions t ON l.transaction_id = t.id
            LEFT JOIN transaction_lines tl ON l.transaction_id = tl.transaction_id
                AND l.account_id = tl.account_id
                AND l.debit = tl.debit_amount
                AND l.credit = tl.credit_amount
            ${where}
            ORDER BY l.entry_date DESC, l.id DESC
        `;
        const rows = await db.pgAll(sql, params);
        res.json(rows || []);
    } catch (err) {
        console.error("Day book error:", err);
        res.json([]);
    }
});

/**
 * 🧾 GST ITC REPORT
 */
router.get('/gst/itc', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const sql = `
            SELECT
                pb.id as bill_id, pb.bill_number, pb.bill_date, pb.supplier_name, s.gstin,
                COALESCE(pb.sub_total, 0) as taxable_amount,
                COALESCE(pb.cgst_total, 0) as cgst_total,
                COALESCE(pb.sgst_total, 0) as sgst_total,
                COALESCE(pb.igst_total, 0) as igst_total,
                COALESCE(pb.tax_total, 0) as eligible_itc
            FROM purchase_bills pb
            LEFT JOIN suppliers s ON pb.supplier_id = s.id
            WHERE pb.company_id = $1
              AND pb.bill_type = 'TAX'
              AND COALESCE(pb.is_deleted, false) = false
            ORDER BY pb.bill_date DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data || []);
    } catch (err) {
        console.error("ITC report error:", err);
        res.json([]);
    }
});

/**
 * 🧾 GSTR-1 SUMMARY — Intra-state (CGST+SGST) vs Inter-state (IGST)
 */
router.get('/gst/gstr1-summary', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;
    try {
        let dateFilter = '';
        const params = [companyId];
        if (startDate && endDate) {
            dateFilter = `AND invoice_date BETWEEN $2::date AND $3::date`;
            params.push(startDate, endDate);
        }

        const sql = `
            SELECT
                supply_type,
                COUNT(*)                         AS invoice_count,
                COALESCE(SUM(sub_total), 0)      AS taxable_value,
                COALESCE(SUM(cgst_total), 0)     AS cgst,
                COALESCE(SUM(sgst_total), 0)     AS sgst,
                COALESCE(SUM(igst_total), 0)     AS igst,
                COALESCE(SUM(tax_total), 0)      AS total_gst,
                COALESCE(SUM(total_amount), 0)   AS total_value
            FROM (
                SELECT *,
                    CASE
                        WHEN UPPER(COALESCE(gst_type,'')) IN ('INTER_STATE','IGST') THEN 'Inter-state (IGST)'
                        ELSE 'Intra-state (CGST+SGST)'
                    END AS supply_type
                FROM invoices
                WHERE company_id = $1
                  AND COALESCE(invoice_type,'') = 'TAX_INVOICE'
                  AND COALESCE(is_deleted, false) = false
                  AND COALESCE(bill_purpose, '') != 'name_only'
                  ${dateFilter}
            ) sub
            GROUP BY supply_type
            ORDER BY supply_type
        `;
        const rows = await db.pgAll(sql, params);

        // Also fetch line-item level breakdown grouped by HSN + GST rate
        const hsnSql = `
            SELECT
                COALESCE(li.hsn_code, 'N/A')        AS hsn_code,
                li.gst_rate,
                CASE
                    WHEN UPPER(COALESCE(i.gst_type,'')) IN ('INTER_STATE','IGST') THEN 'IGST'
                    ELSE 'CGST+SGST'
                END                                  AS gst_category,
                COUNT(DISTINCT i.id)                 AS invoice_count,
                COALESCE(SUM(li.taxable_amount), 0)  AS taxable_value,
                COALESCE(SUM(li.cgst_amount), 0)     AS cgst,
                COALESCE(SUM(li.sgst_amount), 0)     AS sgst,
                COALESCE(SUM(li.igst_amount), 0)     AS igst
            FROM invoice_line_items li
            JOIN invoices i ON li.invoice_id = i.id
            WHERE i.company_id = $1
              AND COALESCE(i.invoice_type,'') = 'TAX_INVOICE'
              AND COALESCE(i.is_deleted, false) = false
              AND COALESCE(i.bill_purpose, '') != 'name_only'
              ${dateFilter}
            GROUP BY li.hsn_code, li.gst_rate, gst_category
            ORDER BY taxable_value DESC
        `;
        const hsnRows = await db.pgAll(hsnSql, params).catch(() => []);

        res.json({ success: true, data: { summary: rows || [], hsn_breakdown: hsnRows || [] } });
    } catch (err) {
        console.error("GSTR-1 summary error:", err);
        res.json({ success: true, data: { summary: [], hsn_breakdown: [] } });
    }
});

export default router;
