
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
                COUNT(*) FILTER (WHERE paid_amount >= total_amount AND total_amount > 0) as paid_bills,
                COUNT(*) FILTER (WHERE paid_amount < total_amount) as pending_bills,
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

        // 4. Inventory Movement (R1)
        const inventoryMovement = await db.pgGet(`
            SELECT
                COALESCE(SUM(qty_in), 0)  as total_in,
                COALESCE(SUM(qty_out), 0) as total_out
            FROM inventory_movements
            WHERE company_id = $1
        `, [companyId]);

        // 5. Success Rate by Supplier & Product (R2)
        const supplierPerformance = await db.pgAll(`
            SELECT
                COALESCE(s.name, pb.supplier_name, 'Unknown') as name,
                COUNT(*) as total_bills,
                COUNT(*) FILTER (WHERE pb.paid_amount >= pb.total_amount AND pb.total_amount > 0) as paid_bills,
                ROUND((COUNT(*) FILTER (WHERE pb.paid_amount >= pb.total_amount AND pb.total_amount > 0)::numeric / NULLIF(COUNT(*), 0)) * 100) as success_rate,
                SUM(pb.total_amount) as order_volume
            FROM purchase_bills pb
            LEFT JOIN suppliers s ON s.id = pb.supplier_id
            WHERE pb.company_id = $1
            GROUP BY s.name, pb.supplier_name
            ORDER BY order_volume DESC
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
            suppliers,
            inventory: {
                in: parseInt(inventoryMovement.total_in || 0),
                out: parseInt(inventoryMovement.total_out || 0)
            },
            supplier_performance: supplierPerformance
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
        SELECT SUM(total_amount) as total FROM invoices WHERE company_id = $1 AND bill_purpose != 'name_only'
    `, [companyId]);
    
    // Use transactions table as cash proxy; cash_ledger table may not exist
    let cash = { balance: 0 };
    try {
        cash = await db.pgGet(`
            SELECT COALESCE(SUM(amount), 0) as balance
            FROM transactions
            WHERE company_id = $1
              AND bill_purpose != 'name_only'
              AND type IN ('RECEIPT', 'CASH_IN', 'PAYMENT_RECEIVED')
        `, [companyId]) || { balance: 0 };
    } catch (_) { /* table/column may not exist, default to 0 */ }

    const totalRevenue = parseFloat(sales?.total || 0);
    const totalExpense = procurement.metrics.total_outflow;
    // efficiency: what % of revenue is profit (capped 0-100)
    const efficiencyRatio = totalRevenue > 0 ? Math.max(0, (totalRevenue - totalExpense) / totalRevenue) : 0;
    const efficiencyPct = Math.min(100, efficiencyRatio * 100);

    // health = 40% fulfillment (paid bills ratio) + 60% efficiency — result 0–100
    const healthScore = Math.min(100, Math.round((procurement.success_rate * 0.4) + (efficiencyPct * 0.6)));

    return {
        health_score: healthScore,
        procurement,
        efficiency: Math.round(efficiencyPct),
        liquidity: parseFloat(cash?.balance || 0)
    };
};
