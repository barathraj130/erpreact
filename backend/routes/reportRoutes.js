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
            where += " AND i.invoice_date BETWEEN $2 AND $3";
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

export default router;