import * as db from "../database/pg.js";

/**
 * Get Advanced Procurement Analytics
 */
export const getProcurementAnalytics = async (companyId) => {
    try {
        // 1. Purchase bill stats — use COALESCE for different column naming conventions
        const stats = await db.pgGet(`
            SELECT
                COUNT(*) as total_bills,
                COUNT(*) FILTER (WHERE COALESCE(is_deleted,false)=false) as active_bills,
                SUM(COALESCE(total_amount, grand_total, net_amount, 0)) as total_outflow,
                AVG(COALESCE(total_amount, grand_total, net_amount, 0)) as avg_bill_value,
                -- "paid" = fully settled via purchase_bill_payments
                COUNT(DISTINCT pb.id) FILTER (WHERE COALESCE(pbp.paid,0) >= COALESCE(total_amount, grand_total, net_amount, 0) AND COALESCE(total_amount, grand_total, net_amount, 0) > 0) as paid_bills
            FROM purchase_bills pb
            LEFT JOIN (
                SELECT purchase_bill_id, SUM(amount) as paid
                FROM purchase_bill_payments
                GROUP BY purchase_bill_id
            ) pbp ON pbp.purchase_bill_id = pb.id
            WHERE pb.company_id = $1 AND COALESCE(pb.is_deleted,false) = false
        `, [companyId]).catch(() => ({ total_bills: 0, paid_bills: 0, total_outflow: 0, avg_bill_value: 0 }));

        const totalBills = parseInt(stats?.total_bills || 0);
        const paidBills  = parseInt(stats?.paid_bills  || 0);
        const successRate = totalBills > 0 ? (paidBills / totalBills) * 100 : 0;

        // 2. Monthly Trend (Last 6 Months)
        const trend = await db.pgAll(`
            SELECT
                TO_CHAR(bill_date, 'Mon YYYY') as month,
                SUM(COALESCE(total_amount, grand_total, net_amount, 0)) as amount,
                COUNT(*) as count
            FROM purchase_bills
            WHERE company_id = $1
              AND COALESCE(is_deleted,false) = false
              AND bill_date >= NOW() - INTERVAL '6 months'
            GROUP BY month, DATE_TRUNC('month', bill_date)
            ORDER BY DATE_TRUNC('month', bill_date)
        `, [companyId]).catch(() => []);

        // 3. Top suppliers by spend
        const suppliers = await db.pgAll(`
            SELECT
                COALESCE(supplier_name, 'Unknown') as name,
                SUM(COALESCE(total_amount, grand_total, net_amount, 0)) as value,
                COUNT(*) as count
            FROM purchase_bills
            WHERE company_id = $1 AND COALESCE(is_deleted,false) = false
            GROUP BY supplier_name
            ORDER BY value DESC
            LIMIT 5
        `, [companyId]).catch(() => []);

        // 4. Inventory Movement — qty_in (purchases/stock-in) vs qty_out (sales/used)
        const inventoryMovement = await db.pgGet(`
            SELECT
                COALESCE(SUM(COALESCE(qty_in, 0)), 0)  as total_in,
                COALESCE(SUM(COALESCE(qty_out, 0)), 0) as total_out
            FROM inventory_movements
            WHERE company_id = $1
        `, [companyId]).catch(() => ({ total_in: 0, total_out: 0 }));

        // 5. Supplier performance (R2)
        const supplierPerformance = await db.pgAll(`
            SELECT
                COALESCE(s.name, pb.supplier_name, 'Unknown') as name,
                COUNT(*) as total_bills,
                COUNT(DISTINCT pb.id) FILTER (
                    WHERE COALESCE(pbp.paid,0) >= COALESCE(pb.total_amount, pb.grand_total, pb.net_amount, 0)
                      AND COALESCE(pb.total_amount, pb.grand_total, pb.net_amount, 0) > 0
                ) as paid_bills,
                ROUND(
                    COUNT(DISTINCT pb.id) FILTER (
                        WHERE COALESCE(pbp.paid,0) >= COALESCE(pb.total_amount, pb.grand_total, pb.net_amount, 0)
                          AND COALESCE(pb.total_amount, pb.grand_total, pb.net_amount, 0) > 0
                    )::numeric / NULLIF(COUNT(*), 0) * 100
                ) as success_rate,
                SUM(COALESCE(pb.total_amount, pb.grand_total, pb.net_amount, 0)) as order_volume
            FROM purchase_bills pb
            LEFT JOIN suppliers s ON s.id = pb.supplier_id
            LEFT JOIN (
                SELECT purchase_bill_id, SUM(amount) as paid
                FROM purchase_bill_payments
                GROUP BY purchase_bill_id
            ) pbp ON pbp.purchase_bill_id = pb.id
            WHERE pb.company_id = $1 AND COALESCE(pb.is_deleted,false) = false
            GROUP BY s.name, pb.supplier_name
            ORDER BY order_volume DESC
        `, [companyId]).catch(() => []);

        return {
            success_rate: Math.round(successRate),
            metrics: {
                total_bills: totalBills,
                paid_bills:  paidBills,
                pending_bills: totalBills - paidBills,
                total_outflow:  parseFloat(stats?.total_outflow  || 0),
                avg_bill_value: parseFloat(stats?.avg_bill_value || 0),
            },
            trend,
            suppliers,
            inventory: {
                in:  parseInt(inventoryMovement?.total_in  || 0),
                out: parseInt(inventoryMovement?.total_out || 0),
            },
            supplier_performance: supplierPerformance,
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

    // Total sales revenue
    const sales = await db.pgGet(`
        SELECT COALESCE(SUM(total_amount), 0) as total
        FROM invoices
        WHERE company_id = $1
          AND COALESCE(is_deleted, false) = false
          AND COALESCE(bill_purpose, '') != 'name_only'
    `, [companyId]).catch(() => ({ total: 0 }));

    // Fulfillment ratio — invoices fully paid vs total
    const fulfillment = await db.pgGet(`
        SELECT
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE status = 'PAID' OR paid_amount >= total_amount) as paid_count
        FROM invoices
        WHERE company_id = $1
          AND COALESCE(is_deleted, false) = false
          AND COALESCE(bill_purpose, '') != 'name_only'
    `, [companyId]).catch(() => ({ total_count: 0, paid_count: 0 }));

    // Actual cash + bank balance from ledgers
    const cashBalance = await db.pgGet(`
        SELECT
            COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END), 0) as balance
        FROM (
            SELECT direction, amount FROM cash_ledger WHERE company_id=$1 AND source != 'OPENING_BALANCE'
            UNION ALL
            SELECT direction, amount FROM bank_ledger WHERE company_id=$1 AND source != 'OPENING_BALANCE'
        ) combined
    `, [companyId]).catch(() => ({ balance: 0 }));

    const totalRevenue  = parseFloat(sales?.total || 0);
    const totalExpense  = procurement.metrics.total_outflow;
    const totalCount    = parseInt(fulfillment?.total_count || 0);
    const paidCount     = parseInt(fulfillment?.paid_count  || 0);
    const fulfillRate   = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;

    const efficiencyRatio = totalRevenue > 0 ? Math.max(0, (totalRevenue - totalExpense) / totalRevenue) : 0;
    const efficiencyPct   = Math.min(100, efficiencyRatio * 100);

    // health = 40% fulfillment + 60% efficiency — minimum 30 base so it's never 0 for active businesses
    const rawScore    = (fulfillRate * 0.4) + (efficiencyPct * 0.6);
    const healthScore = totalRevenue > 0 ? Math.min(100, Math.max(30, Math.round(rawScore))) : 0;

    return {
        health_score:  healthScore,
        procurement,
        efficiency:    Math.round(efficiencyPct),
        liquidity:     parseFloat(cashBalance?.balance || 0),
        fulfillment_rate: Math.round(fulfillRate),
    };
};
