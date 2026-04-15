
import * as db from "../database/pg.js";

/**
 * Get Advanced Procurement Analytics
 */
export const getProcurementAnalytics = async (companyId) => {
    try {
        // 1. Success Rate (Completed via PAID status)
        const stats = await db.pgGet(`
            SELECT 
                COUNT(*) as total_bills,
                COUNT(*) FILTER (WHERE status = 'PAID') as paid_bills,
                COUNT(*) FILTER (WHERE status = 'PENDING') as pending_bills,
                SUM(total_amount) as total_outflow,
                AVG(total_amount) as avg_bill_value
            FROM purchase_bills
            WHERE company_id = $1
        `, [companyId]);

        const totalBills = parseInt(stats.total_bills || 0);
        const paidBills = parseInt(stats.paid_bills || 0);
        const successRate = totalBills > 0 ? (paidBills / totalBills) * 100 : 0;

        // 2. Monthly Trend (Last 6 Months)
        const trend = await db.pgAll(`
            SELECT 
                TO_CHAR(bill_date, 'Mon YYYY') as month,
                SUM(total_amount) as amount,
                COUNT(*) as count
            FROM purchase_bills
            WHERE company_id = $1 AND bill_date >= NOW() - INTERVAL '6 months'
            GROUP BY month, DATE_TRUNC('month', bill_date)
            ORDER BY DATE_TRUNC('month', bill_date)
        `, [companyId]);

        // 3. Category Distribution (Mocking category based on product_type if available, or just Top Suppliers)
        const suppliers = await db.pgAll(`
            SELECT 
                supplier_name as name, 
                SUM(total_amount) as value,
                COUNT(*) as count
            FROM purchase_bills
            WHERE company_id = $1
            GROUP BY supplier_name
            ORDER BY value DESC
            LIMIT 5
        `, [companyId]);

        return {
            success_rate: Math.round(successRate),
            metrics: {
                total_bills: totalBills,
                paid_bills: paidBills,
                pending_bills: parseInt(stats.pending_bills || 0),
                total_outflow: parseFloat(stats.total_outflow || 0),
                avg_bill_value: parseFloat(stats.avg_bill_value || 0)
            },
            trend,
            suppliers
        };
    } catch (err) {
        console.error("Analytics Error:", err);
        throw err;
    }
};

/**
 * Global Health Score (Futuristic Metric)
 */
export const getWorldClassMetrics = async (companyId) => {
    const procurement = await getProcurementAnalytics(companyId);
    
    // Revenue Health
    const sales = await db.pgGet(`
        SELECT SUM(total_amount) as total FROM invoices WHERE company_id = $1
    `, [companyId]);
    
    const cash = await db.pgGet(`
        SELECT 
            SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END) as balance
        FROM cash_ledger
        WHERE company_id = $1
    `, [companyId]);

    const totalRevenue = parseFloat(sales?.total || 1);
    const totalExpense = procurement.metrics.total_outflow;
    const efficiency = totalRevenue > 0 ? (totalRevenue - totalExpense) / totalRevenue : 0;

    return {
        health_score: Math.round((procurement.success_rate * 0.4) + (efficiency * 60)),
        procurement,
        efficiency: Math.round(efficiency * 100),
        liquidity: parseFloat(cash?.balance || 0)
    };
};
