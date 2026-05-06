// backend/services/dashboardService.js
import * as db from "../database/pg.js";
import { getBankSummary } from "./bankService.js";
import { getHRDashboard } from "./hrService.js";
import { getStockLevels } from "./inventoryService.js";
import { getCompanyLoans } from "./loanService.js";
import { getSalesSummary } from "./salesService.js";

/**
 * Get complete dashboard data
 */
export const getCompleteDashboard = async (companyId) => {
    try {
        const [
            bankSummary,
            loansSummary,
            salesSummary,
            stockLevels,
            hrDashboard
        ] = await Promise.all([
            getBankSummary(companyId),
            getCompanyLoans(companyId),
            getSalesSummary(companyId, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()),
            getStockLevels(companyId),
            getHRDashboard(companyId)
        ]);

        return {
            timestamp: new Date(),
            finance: {
                bank: bankSummary,
                loans: loansSummary,
                sales: salesSummary
            },
            operations: {
                inventory: stockLevels
            },
            hr: hrDashboard
        };
    } catch (err) {
        console.error("❌ Get dashboard error:", err);
        throw err;
    }
};

/**
 * Get financial dashboard
 */
export const getFinancialDashboard = async (companyId, startDate, endDate) => {
    try {
        // Income summary
        const income = await db.pgGet(
            `SELECT COALESCE(SUM(total_amount), 0) as amount
             FROM invoices
             WHERE company_id = $1 AND invoice_date BETWEEN $2 AND $3 AND status = 'PAID'`,
            [companyId, startDate, endDate]
        );

        // Expense summary
        const expenses = await db.pgAll(
            `SELECT 
                category,
                COALESCE(SUM(amount), 0) as amount
             FROM bank_transactions
             WHERE status = 'CATEGORIZED' AND transaction_date BETWEEN $1 AND $2
             GROUP BY category
             ORDER BY amount DESC`,
            [startDate, endDate]
        );

        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        // Cash balance
        const cashBalance = await db.pgGet(
            `SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance
             FROM bank_transactions
             WHERE status = 'CLEARED' AND transaction_date <= $1`,
            [endDate]
        );

        // Profit margin
        const netProfit = income.amount - totalExpenses;
        const profitMargin = income.amount > 0 ? (netProfit / income.amount) * 100 : 0;

        // Monthly trend
        const monthlyTrend = await db.pgAll(
            `SELECT 
                DATE_TRUNC('month', invoice_date)::date as month,
                COALESCE(SUM(total_amount), 0) as sales,
                COALESCE(SUM(tax_amount), 0) as tax
             FROM invoices
             WHERE company_id = $1 AND invoice_date BETWEEN $2 AND $3
             GROUP BY DATE_TRUNC('month', invoice_date)
             ORDER BY month`,
            [companyId, startDate, endDate]
        );

        return {
            summary: {
                total_income: income.amount,
                total_expenses: totalExpenses,
                net_profit: netProfit,
                profit_margin_percent: Math.round(profitMargin * 100) / 100,
                cash_balance: cashBalance.balance
            },
            expenses_by_category: expenses,
            monthly_trend: monthlyTrend
        };
    } catch (err) {
        console.error("❌ Get financial dashboard error:", err);
        throw err;
    }
};

/**
 * Get customer analytics
 */
export const getCustomerAnalytics = async (companyId) => {
    try {
        // Top customers
        const topCustomers = await db.pgAll(
            `SELECT 
                c.id, c.party_name,
                COUNT(i.id) as invoice_count,
                COALESCE(SUM(i.total_amount), 0) as total_sales,
                MAX(i.invoice_date) as last_purchase
             FROM parties c
             LEFT JOIN invoices i ON c.id = i.customer_id
             WHERE c.company_id = $1 AND c.party_type = 'CUSTOMER'
             GROUP BY c.id, c.party_name
             ORDER BY total_sales DESC
             LIMIT 10`,
            [companyId]
        );

        // Aging analysis
        const agingAnalysis = await db.pgAll(
            `SELECT 
                CASE 
                    WHEN CURRENT_DATE - i.due_date <= 30 THEN 'Current'
                    WHEN CURRENT_DATE - i.due_date <= 60 THEN '31-60 Days'
                    WHEN CURRENT_DATE - i.due_date <= 90 THEN '61-90 Days'
                    ELSE 'Over 90 Days'
                END as age_bucket,
                COUNT(*) as invoice_count,
                COALESCE(SUM(i.total_amount - COALESCE(
                    (SELECT SUM(amount_paid) FROM invoice_payments WHERE invoice_id = i.id), 0
                )), 0) as outstanding_amount
             FROM invoices i
             WHERE i.company_id = $1 AND i.status IN ('PARTIAL', 'SENT')
             GROUP BY age_bucket
             ORDER BY age_bucket`,
            [companyId]
        );

        return {
            top_customers: topCustomers,
            aging_analysis: agingAnalysis
        };
    } catch (err) {
        console.error("❌ Get customer analytics error:", err);
        return { top_customers: [], aging_analysis: [] };
    }
};

/**
 * Get supplier analytics
 */
export const getSupplierAnalytics = async (companyId) => {
    try {
        const topSuppliers = await db.pgAll(
            `SELECT 
                s.id, s.party_name,
                COUNT(pb.id) as purchase_count,
                COALESCE(SUM(pb.total_amount), 0) as total_purchases,
                MAX(pb.bill_date) as last_purchase
             FROM parties s
             LEFT JOIN purchase_bills pb ON s.id = pb.supplier_id
             WHERE s.company_id = $1 AND s.party_type = 'SUPPLIER'
             GROUP BY s.id, s.party_name
             ORDER BY total_purchases DESC
             LIMIT 10`,
            [companyId]
        );

        return { top_suppliers: topSuppliers };
    } catch (err) {
        console.error("❌ Get supplier analytics error:", err);
        return { top_suppliers: [] };
    }
};

/**
 * Get KPI summary
 */
export const getKPISummary = async (companyId) => {
    try {
        const startMonth = new Date();
        startMonth.setDate(1);
        const startOfYear = new Date(startMonth.getFullYear(), 0, 1);

        // Monthly sales
        const monthlySales = await db.pgGet(
            `SELECT COALESCE(SUM(total_amount), 0) as amount
             FROM invoices
             WHERE company_id = $1 AND invoice_date >= $2`,
            [companyId, startMonth]
        );

        // YTD sales
        const ytdSales = await db.pgGet(
            `SELECT COALESCE(SUM(total_amount), 0) as amount
             FROM invoices
             WHERE company_id = $1 AND invoice_date >= $2`,
            [companyId, startOfYear]
        );

        // Outstanding receivables
        const receivables = await db.pgGet(
            `SELECT COALESCE(SUM(total_amount - COALESCE(
                (SELECT SUM(amount_paid) FROM invoice_payments WHERE invoice_id = i.id), 0
            )), 0) as amount
             FROM invoices i
             WHERE i.company_id = $1 AND i.status IN ('PARTIAL', 'SENT')`,
            [companyId]
        );

        // Outstanding payables
        const payables = await db.pgGet(
            `SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) as amount
             FROM purchase_bills
             WHERE company_id = $1 AND status IN ('PARTIAL', 'PENDING', 'RECEIVED')`,
            [companyId]
        );

        // Active loans
        const activeLoans = await db.pgGet(
            `SELECT 
                COUNT(*) as count,
                COALESCE(SUM(loan_amount), 0) as total_amount
             FROM loans
             WHERE company_id = $1 AND status = 'ACTIVE'`,
            [companyId]
        );

        // Inventory turnover
        const avgDailyInventory = await db.pgGet(
            `SELECT COALESCE(AVG(valuation), 0) as amount
             FROM product_stock`,
            []
        );

        const cogs = await db.pgGet(
            `SELECT COALESCE(SUM(quantity * cost_per_unit), 0) as amount
             FROM stock_transactions
             WHERE entry_type = 'SALE' AND DATE_TRUNC('month', created_at)::date >= $1`,
            [startMonth]
        );

        const inventoryTurnover = avgDailyInventory.amount > 0 ? cogs.amount / avgDailyInventory.amount : 0;

        // Tax vs Anon breakdown for the month
        const salesBreakdown = await db.pgAll(
            `SELECT 
                invoice_type, 
                COALESCE(SUM(total_amount), 0) as amount
             FROM invoices
             WHERE company_id = $1 AND invoice_date >= $2
             GROUP BY invoice_type`,
            [companyId, startMonth]
        );

        const breakdown = {
            tax_amount: 0,
            anon_amount: 0
        };
        salesBreakdown.forEach(s => {
            if (s.invoice_type === 'TAX_INVOICE') breakdown.tax_amount = parseFloat(s.amount);
            else breakdown.anon_amount += parseFloat(s.amount);
        });

        return {
            monthly_sales: monthlySales.amount,
            ytd_sales: ytdSales.amount,
            sales_breakdown: breakdown,
            outstanding_receivables: receivables.amount,
            outstanding_payables: payables.amount,
            active_loans: activeLoans.count,
            total_loan_exposure: activeLoans.total_amount,
            inventory_turnover_ratio: Math.round(inventoryTurnover * 100) / 100
        };
    } catch (err) {
        console.error("❌ Get KPI summary error:", err);
        return {};
    }
};

export default {
    getCompleteDashboard,
    getFinancialDashboard,
    getCustomerAnalytics,
    getSupplierAnalytics,
    getKPISummary
};
