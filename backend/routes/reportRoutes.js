// backend/routes/reportRoutes.js
import express from 'express';
import * as db from '../database/pg.js';
import authMiddleware from '../middlewares/jwtAuthMiddleware.js';

const router = express.Router();

/**
 * 📊 CONSOLIDATED FINANCIAL REPORT (Stage 10)
 * Aggregates data across all branches for the company.
 */
router.get('/consolidated/financials', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    const { branch_id } = req.query; // If provided, filters to branch. If null, consolidated.

    try {
        // 💰 REVENUE COLLATION with Tax vs Anon breakdown
        const revenueBreakdownSql = `
            SELECT 
                invoice_type, 
                SUM(total_amount) as total
            FROM invoices 
            WHERE company_id = $1
            ${branch_id ? ' AND branch_id = $2' : ''}
            GROUP BY invoice_type
        `;
        const revenueRows = await db.pgAll(revenueBreakdownSql, params);
        
        const breakdown = {
            tax_invoices: 0,
            anon_bills: 0
        };

        revenueRows.forEach(row => {
            if (row.invoice_type === 'TAX_INVOICE') {
                breakdown.tax_invoices = parseFloat(row.total || 0);
            } else {
                breakdown.anon_bills += parseFloat(row.total || 0);
            }
        });

        const totalRevenue = breakdown.tax_invoices + breakdown.anon_bills;

        let expenseSql = 'SELECT SUM(total_amount) as total FROM purchase_bills WHERE company_id = $1';
        if (branch_id) {
            expenseSql += ' AND branch_id = $2';
        }
        const expense = await db.pgGet(expenseSql, params);

        // 📦 INVENTORY COLLATION (Stage 5 Requirement)
        let inventorySql = 'SELECT SUM(current_stock) as total_stock, COUNT(*) as unique_items FROM products WHERE company_id = $1';
        if (branch_id) {
            inventorySql += ' AND branch_id = $2';
        }
        const inventory = await db.pgGet(inventorySql, params);

        res.json({
            scope: branch_id ? `Branch ID: ${branch_id}` : 'Consolidated (All Branches)',
            financials: {
                total_revenue: totalRevenue,
                total_tax_revenue: breakdown.tax_invoices,
                total_anon_revenue: breakdown.anon_bills,
                total_expense: parseFloat(expense?.total || 0),
                net_profit: totalRevenue - parseFloat(expense?.total || 0)
            },
            inventory: {
                total_stock_value: parseFloat(inventory?.total_stock || 0),
                item_count: parseInt(inventory?.unique_items || 0)
            },
            timestamp: new Date()
        });

    } catch (err) {
        console.error("Report Generation Error:", err);
        res.status(500).json({ error: "Failed to generate consolidated report." });
    }
});

/**
 * 🏥 BRANCH PERFORMANCE (Stage 10)
 */
router.get('/branches/performance', authMiddleware, async (req, res) => {
    const companyId = req.user.active_company_id;
    if (req.user.role?.toLowerCase() !== 'admin' && req.user.role?.toLowerCase() !== 'superadmin') {
        return res.status(403).json({ error: "Unauthorized. Admin only." });
    }

    try {
        const sql = `
            SELECT 
                b.branch_name,
                b.branch_code,
                COALESCE(SUM(i.total_amount), 0) as revenue,
                COUNT(DISTINCT i.id) as invoice_count
            FROM branches b
            LEFT JOIN invoices i ON b.id = i.branch_id
            WHERE b.company_id = $1
            GROUP BY b.id, b.branch_name, b.branch_code
            ORDER BY revenue DESC
        `;
        const performance = await db.pgAll(sql, [companyId]);
        res.json(performance);
    } catch (err) {
        console.error("Branch Performance Error:", err);
        res.status(500).json({ error: "Failed to fetch branch performance." });
    }
});

export default router;