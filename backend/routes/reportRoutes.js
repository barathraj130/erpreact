// backend/routes/reportRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * 📊 SALES REGISTER
 * Features: Mode-wise split columns, Name-sake exclusion/inclusion, Customer filtering
 */
router.get('/sales/register', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { startDate, endDate, customer_id, tax_type, show_name_sake = 'false' } = req.query;

    try {
        let where = "WHERE i.company_id = $1";
        let params = [companyId];

        if (startDate && endDate) {
            where += " AND i.invoice_date >= $2::date AND i.invoice_date < $3::date + INTERVAL '1 day'";
            params.push(startDate, endDate);
        }

        if (customer_id) {
            where += ` AND i.customer_id = $${params.length + 1}`;
            params.push(customer_id);
        }

        if (show_name_sake !== 'true') {
            where += " AND i.bill_purpose != 'name_only'";
        }

        const sql = `
            SELECT 
                i.*,
                c.name as customer_name,
                COALESCE(p_cash.amount, 0) as cash_collected,
                COALESCE(p_upi.amount, 0) as upi_collected,
                COALESCE(p_bank.amount, 0) as bank_collected
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            LEFT JOIN (SELECT invoice_id, SUM(amount) as amount FROM payments WHERE mode = 'CASH' GROUP BY invoice_id) p_cash ON i.id = p_cash.invoice_id
            LEFT JOIN (SELECT invoice_id, SUM(amount) as amount FROM payments WHERE mode = 'UPI' GROUP BY invoice_id) p_upi ON i.id = p_upi.invoice_id
            LEFT JOIN (SELECT invoice_id, SUM(amount) as amount FROM payments WHERE mode = 'BANK' GROUP BY invoice_id) p_bank ON i.id = p_bank.invoice_id
            ${where}
            ORDER BY i.invoice_date DESC, i.id DESC
        `;

        const rows = await db.pgAll(sql, params);
        res.json(rows);
    } catch (err) {
        console.error("Sales register error:", err);
        res.status(500).json({ error: "Failed to generate sales register" });
    }
});

/**
 * 📦 GST SUMMARY
 * Monthly breakdown of Output vs Input tax
 */
router.get('/gst/summary', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { month, year } = req.query; // Format: 5, 2026

    try {
        const periodStart = `${year}-${month.toString().padStart(2, '0')}-01`;
        
        // Output Tax (from Sales)
        const outputSql = `
            SELECT 
                bill_purpose,
                SUM(total_cgst_amount) as cgst,
                SUM(total_sgst_amount) as sgst,
                SUM(total_igst_amount) as igst
            FROM invoices
            WHERE company_id = $1 AND DATE_TRUNC('month', invoice_date) = $2
            GROUP BY bill_purpose
        `;
        const outputRes = await db.pgAll(outputSql, [companyId, periodStart]);

        // Input Tax (from Purchases)
        const inputSql = `
            SELECT 
                SUM(cgst_total) as cgst,
                SUM(sgst_total) as sgst,
                SUM(igst_total) as igst
            FROM purchase_bills
            WHERE company_id = $1 AND DATE_TRUNC('month', bill_date) = $2
        `;
        const inputRes = await db.pgGet(inputSql, [companyId, periodStart]);

        res.json({
            output: outputRes,
            input: inputRes,
            period: periodStart
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to generate GST summary" });
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
                c.name as customer_name,
                COUNT(i.id) as total_invoices,
                SUM(i.total_amount) as total_amount,
                SUM(i.paid_amount) as paid,
                SUM(i.total_amount - i.paid_amount) as balance,
                MAX(i.invoice_date) as last_date
            FROM customers c
            JOIN invoices i ON c.id = i.customer_id
            WHERE c.company_id = $1 AND i.bill_purpose != 'name_only'
            GROUP BY c.id, c.name
            ORDER BY total_amount DESC
        `;
        const data = await db.pgAll(sql, [companyId]);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Failed to generate report" });
    }
});

/**
 * 📈 DASHBOARD STATS (Top Cards for Reports Landing Page)
 */
router.get('/dashboard-stats', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    try {
        const todaySales = await db.pgGet(`SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE company_id = $1 AND DATE(invoice_date) = CURRENT_DATE AND bill_purpose != 'name_only'`, [companyId]);
        const todayPurchases = await db.pgGet(`SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_bills WHERE company_id = $1 AND DATE(bill_date) = CURRENT_DATE AND bill_purpose != 'name_only'`, [companyId]);
        const cashPosition = await db.pgGet(`SELECT COALESCE(SUM(balance_amount), 0) as balance FROM invoices WHERE company_id = $1 AND balance_amount > 0 AND bill_purpose != 'name_only'`, [companyId]);
        
        const outputGst = await db.pgGet(`SELECT COALESCE(SUM(cgst_total + sgst_total + igst_total), 0) as total FROM invoices WHERE company_id = $1 AND bill_purpose != 'name_only'`, [companyId]);
        const inputGst = await db.pgGet(`SELECT COALESCE(SUM(cgst_total + sgst_total + igst_total), 0) as total FROM purchase_bills WHERE company_id = $1 AND bill_purpose != 'name_only'`, [companyId]);
        const gstLiability = (parseFloat(outputGst?.total || 0) - parseFloat(inputGst?.total || 0));

        const totalReceivables = await db.pgGet(`SELECT COALESCE(SUM(current_balance), 0) as balance FROM customers WHERE company_id = $1`, [companyId]);
        const activeCustomers = await db.pgGet(`SELECT COUNT(*) as count FROM customers WHERE company_id = $1`, [companyId]);

        res.json({
            today_sales: parseFloat(todaySales?.total || 0),
            today_purchases: parseFloat(todayPurchases?.total || 0),
            cash_balance: parseFloat(cashPosition?.balance || 0),
            gst_liability: gstLiability,
            total_receivables: parseFloat(totalReceivables?.balance || 0),
            active_customers: parseInt(activeCustomers?.count || 0)
        });
    } catch (err) {
        console.error("Dashboard stats error:", err);
        res.status(500).json({ error: "Failed to generate dashboard stats" });
    }
});

export default router;