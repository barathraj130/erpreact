// backend/routes/reportRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * 📊 REPORTS DASHBOARD STATS
 */
router.get('/dashboard-stats', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const today = new Date().toISOString().split('T')[0];

    try {
        // Today's Sales
        const salesSql = `SELECT SUM(total_amount) as total FROM invoices WHERE company_id = $1 AND DATE(created_at) = $2`;
        const sales = await db.pgGet(salesSql, [companyId, today]);

        // Today's Purchases
        const purchaseSql = `SELECT SUM(total_amount) as total FROM purchase_bills WHERE company_id = $1 AND DATE(bill_date) = $2`;
        const purchases = await db.pgGet(purchaseSql, [companyId, today]);

        // Cash Position (Cash Ledger Balance)
        const cashSql = `SELECT current_balance FROM chart_of_accounts WHERE (company_id = $1 OR company_id IS NULL) AND account_code = '1000'`;
        const cash = await db.pgGet(cashSql, [companyId]);

        // GST Liability (Output - Input)
        const gstSql = `
            SELECT 
                (SELECT COALESCE(SUM(total_tax), 0) FROM invoices WHERE company_id = $1 AND invoice_type = 'TAX_INVOICE') -
                (SELECT COALESCE(SUM(total_tax), 0) FROM purchase_bills WHERE company_id = $1) as liability
        `;
        const gst = await db.pgGet(gstSql, [companyId]);

        res.json({
            today_sales: parseFloat(sales?.total || 0),
            today_purchases: parseFloat(purchases?.total || 0),
            cash_balance: parseFloat(cash?.current_balance || 0),
            gst_liability: parseFloat(gst?.liability || 0)
        });
    } catch (err) {
        console.error("Dashboard Stats Error:", err);
        res.status(500).json({ error: "Report failed: " + err.message });
    }
});

/**
 * 📈 SALES REGISTER
 */
router.get('/sales/register', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate, taxType, branchId } = req.query;

    try {
        let sql = `
            SELECT 
                i.created_at as date,
                i.invoice_no,
                i.customer_name,
                i.taxable_amount,
                i.total_tax,
                i.total_amount,
                i.status,
                b.name as broker_name
            FROM invoices i
            LEFT JOIN brokers b ON i.broker_id = b.id
            WHERE i.company_id = $1
            AND DATE(i.created_at) BETWEEN $2 AND $3
        `;
        const params = [companyId, startDate, endDate];

        if (taxType && taxType !== 'all') {
            sql += ` AND i.invoice_type = $${params.length + 1}`;
            params.push(taxType === 'TAX' ? 'TAX_INVOICE' : 'RETAIL_BILL');
        }

        if (branchId && branchId !== 'all') {
            sql += ` AND i.branch_id = $${params.length + 1}`;
            params.push(branchId);
        }

        sql += ` ORDER BY i.created_at DESC`;

        const rows = await db.pgAll(sql, params);
        res.json(rows || []);
    } catch (err) {
        console.error("Report Error:", err);
        res.status(500).json({ error: "Report failed: " + err.message });
    }
});

/**
 * 📦 INVENTORY SUMMARY
 */
router.get('/inventory/summary', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;

    try {
        const sql = `
            SELECT 
                name, sku, current_stock, unit,
                COALESCE(cost_price, 0) as avg_cost,
                (current_stock * COALESCE(cost_price, 0)) as stock_value
            FROM products
            WHERE company_id = $1 AND is_deleted = false
            ORDER BY current_stock ASC
        `;
        const rows = await db.pgAll(sql, [companyId]);
        res.json(rows || []);
    } catch (err) {
        console.error("Report Error:", err);
        res.status(500).json({ error: "Report failed: " + err.message });
    }
});

/**
 * 📒 DAY BOOK
 */
router.get('/finance/day-book', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;

    try {
        const sql = `
            SELECT 
                created_at,
                entry_type,
                description,
                CASE WHEN is_debit THEN amount ELSE 0 END as debit,
                CASE WHEN NOT is_debit THEN amount ELSE 0 END as credit,
                id
            FROM ledger_entries
            WHERE company_id = $1
            AND DATE(created_at) BETWEEN $2 AND $3
            ORDER BY created_at ASC
        `;
        const rows = await db.pgAll(sql, [companyId, startDate, endDate]);
        res.json(rows || []);
    } catch (err) {
        console.error("Day Book Error:", err);
        res.status(500).json({ error: "Failed to fetch day book." });
    }
});

/**
 * ⚖️ TRIAL BALANCE
 */
router.get('/finance/trial-balance', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;

    try {
        const sql = `
            SELECT 
                name as ledger_name,
                opening_balance as opening,
                (SELECT COALESCE(SUM(debit), 0) FROM ledger_entries WHERE account_id = l.id) as debit,
                (SELECT COALESCE(SUM(credit), 0) FROM ledger_entries WHERE account_id = l.id) as credit,
                current_balance as closing
            FROM chart_of_accounts l
            WHERE company_id = $1 OR company_id IS NULL
            ORDER BY name ASC
        `;
        const rows = await db.pgAll(sql, [companyId]);
        res.json(rows || []);
    } catch (err) {
        console.error("Trial Balance Error:", err);
        res.status(500).json({ error: "Failed to fetch trial balance." });
    }
});

/**
 * 📈 CUSTOMER-WISE SALES SUMMARY
 */
router.get('/sales/customer-wise', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;

    try {
        const sql = `
            SELECT 
                COALESCE(u.nickname, u.username) as customer_name,
                COUNT(i.id) as invoice_count,
                SUM(i.total_amount) as total_sales,
                SUM(i.paid_amount) as total_paid,
                SUM(i.total_amount - i.paid_amount) as balance,
                MAX(i.invoice_date) as last_date
            FROM invoices i
            JOIN users u ON i.customer_id = u.id
            WHERE i.company_id = $1
            AND i.invoice_date BETWEEN $2 AND $3
            GROUP BY u.nickname, u.username, i.customer_id
            ORDER BY total_sales DESC
        `;
        const rows = await db.pgAll(sql, [companyId, startDate, endDate]);
        res.json(rows || []);
    } catch (err) {
        console.error("Customer Sales Error:", err);
        res.status(500).json({ error: "Failed to fetch customer sales." });
    }
});

/**
 * 🛒 PURCHASE REGISTER
 */
router.get('/purchase/register', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate, taxType } = req.query;

    try {
        let sql = `
            SELECT 
                bill_date as date,
                bill_number as bill_no,
                supplier_name,
                sub_total as taxable_amount,
                tax_total as total_tax,
                total_amount,
                status
            FROM purchase_bills
            WHERE company_id = $1
            AND bill_date BETWEEN $2 AND $3
        `;
        const params = [companyId, startDate, endDate];

        if (taxType && taxType !== 'all') {
            sql += ` AND bill_type = $${params.length + 1}`;
            params.push(taxType);
        }

        sql += ` ORDER BY bill_date DESC`;

        const rows = await db.pgAll(sql, params);
        res.json(rows || []);
    } catch (err) {
        console.error("Purchase Register Error:", err);
        res.status(500).json({ error: "Failed to fetch purchase register." });
    }
});

/**
 * 🤝 SUPPLIER-WISE PURCHASE SUMMARY
 */
router.get('/purchase/supplier-wise', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;

    try {
        const sql = `
            SELECT 
                supplier_name,
                COUNT(*) as bill_count,
                SUM(total_amount) as total_purchase,
                SUM(total_amount) as total_paid,
                0 as balance
            FROM purchase_bills
            WHERE company_id = $1
            AND bill_date BETWEEN $2 AND $3
            GROUP BY supplier_name
            ORDER BY total_purchase DESC
        `;
        const rows = await db.pgAll(sql, [companyId, startDate, endDate]);
        res.json(rows || []);
    } catch (err) {
        console.error("Supplier Purchase Error:", err);
        res.status(500).json({ error: "Failed to fetch supplier purchase." });
    }
});

/**
 * 💵 PAYMENT COLLECTION REPORT
 */
router.get('/sales/payment-collection', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;

    try {
        const sql = `
            SELECT 
                le.created_at as date,
                l.name as customer_name,
                'Transfer' as method,
                'Voucher #' || le.id as reference,
                le.amount
            FROM ledger_entries le
            JOIN ledgers l ON le.ledger_id = l.id
            JOIN ledger_groups lg ON l.group_id = lg.id
            WHERE le.company_id = $1
            AND lg.name = 'Sundry Debtors'
            AND le.is_debit = FALSE
            AND DATE(le.created_at) BETWEEN $2 AND $3
            ORDER BY le.created_at DESC
        `;
        const rows = await db.pgAll(sql, [companyId, startDate, endDate]);
        res.json(rows || []);
    } catch (err) {
        console.error("Payment Collection Error:", err);
        res.status(500).json({ error: "Failed to fetch payment collection." });
    }
});

/**
 * 🧾 GST SUMMARY REPORT
 */
router.get('/gst/summary', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;

    try {
        const sql = `
            SELECT 
                TO_CHAR(date, 'YYYY-MM') as month,
                SUM(output_cgst) as output_cgst,
                SUM(output_sgst) as output_sgst,
                SUM(input_cgst) as input_cgst,
                SUM(input_sgst) as input_sgst,
                (SUM(output_cgst) + SUM(output_sgst) - SUM(input_cgst) - SUM(input_sgst)) as net_liability
            FROM (
                SELECT invoice_date as date, cgst_total as output_cgst, sgst_total as output_sgst, 0 as input_cgst, 0 as input_sgst 
                FROM invoices WHERE company_id = $1 AND invoice_type = 'TAX_INVOICE'
                UNION ALL
                SELECT bill_date as date, 0, 0, cgst_total, sgst_total 
                FROM purchase_bills WHERE company_id = $1
            ) as combined
            WHERE DATE(date) BETWEEN $2 AND $3
            GROUP BY month
            ORDER BY month DESC
        `;
        const rows = await db.pgAll(sql, [companyId, startDate, endDate]);
        res.json(rows || []);
    } catch (err) {
        console.error("GST Summary Error:", err);
        res.status(500).json({ error: "Failed to fetch GST summary." });
    }
});

/**
 * 📥 ITC REPORT
 */
router.get('/gst/itc', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;

    try {
        const sql = `
            SELECT 
                supplier_name,
                bill_number as bill_no,
                bill_date as date,
                sub_total as taxable_amount,
                tax_total,
                (SELECT gstin FROM lenders WHERE name = supplier_name LIMIT 1) as gstin
            FROM purchase_bills
            WHERE company_id = $1
            AND bill_date BETWEEN $2 AND $3
            AND total_tax > 0
            ORDER BY bill_date DESC
        `;
        const rows = await db.pgAll(sql, [companyId, startDate, endDate]);
        res.json(rows || []);
    } catch (err) {
        console.error("ITC Report Error:", err);
        res.status(500).json({ error: "Failed to fetch ITC report." });
    }
});

/**
 * 🏃 STOCK MOVEMENT REPORT
 */
router.get('/inventory/movement', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;

    try {
        const sql = `
            SELECT 
                m.created_at as date,
                p.name as product_name,
                m.type,
                m.reference_type || ' #' || m.reference_id as reference,
                m.qty_in,
                m.qty_out,
                0 as balance
            FROM inventory_movements m
            JOIN products p ON m.product_id = p.id
            WHERE m.company_id = $1
            AND m.created_at BETWEEN $2 AND $3
            ORDER BY m.created_at DESC
        `;
        const rows = await db.pgAll(sql, [companyId, startDate, endDate]);
        res.json(rows || []);
    } catch (err) {
        console.error("Stock Movement Error:", err);
        res.status(500).json({ error: "Failed to fetch stock movement." });
    }
});

/**
 * 👥 HR ATTENDANCE REPORT
 */
router.get('/hr/attendance', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate } = req.query;

    try {
        const sql = `
            SELECT 
                e.name,
                COUNT(CASE WHEN status = 'Present' THEN 1 END) as present_days,
                COUNT(CASE WHEN status = 'Absent' THEN 1 END) as absent_days,
                COUNT(CASE WHEN status = 'OD' THEN 1 END) as od_days,
                ROUND(COUNT(CASE WHEN status = 'Present' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)) as pct
            FROM attendance a
            JOIN employees e ON a.employee_id = e.id
            WHERE e.company_id = $1
            AND date BETWEEN $2 AND $3
            GROUP BY e.name
            ORDER BY pct DESC
        `;
        const rows = await db.pgAll(sql, [companyId, startDate, endDate]);
        res.json(rows || []);
    } catch (err) {
        console.error("Attendance Report Error:", err);
        res.status(500).json({ error: "Failed to fetch attendance report." });
    }
});

/**
 * 💹 PROFIT & LOSS REPORT
 */
router.get('/finance/profit-loss', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate, branchId } = req.query;
    try {
        const { getProfitAndLoss } = await import('../utils/accountingEngine.js');
        const data = await getProfitAndLoss(companyId, branchId, startDate || '2000-01-01', endDate || '2099-12-31');
        res.json(data);
    } catch (err) {
        console.error("P&L Error:", err);
        res.status(500).json({ error: "Failed to fetch P&L report: " + err.message });
    }
});

/**
 * 📊 BALANCE SHEET REPORT
 */
router.get('/finance/balance-sheet', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const { getBalanceSheet } = await import('../utils/accountingEngine.js');
        const data = await getBalanceSheet(companyId);
        res.json(data);
    } catch (err) {
        console.error("Balance Sheet Error:", err);
        res.status(500).json({ error: "Failed to fetch balance sheet: " + err.message });
    }
});

export default router;