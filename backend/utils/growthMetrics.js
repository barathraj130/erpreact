// backend/utils/growthMetrics.js
import * as db from '../database/pg.js';

const PERIOD_CONFIG = {
    weekly:  { unit: 'week',  buckets: 12, labelFmt: 'DD Mon',   trendLabel: 'week-over-week' },
    monthly: { unit: 'month', buckets: 12, labelFmt: 'Mon YYYY', trendLabel: 'month-over-month' },
    annual:  { unit: 'year',  buckets: 5,  labelFmt: 'YYYY',     trendLabel: 'year-over-year' },
};

function resolvePeriod(period) {
    return PERIOD_CONFIG[period] ? period : 'monthly';
}

function joinSeriesByBucket(revenueRows, purchaseRows) {
    const purchaseByBucket = new Map(purchaseRows.map(r => [r.period_sort_key, parseFloat(r.value || 0)]));
    return revenueRows.map(r => ({
        period_label: r.period_label,
        period_sort: r.period_sort_key,
        value: parseFloat(r.value || 0) - (purchaseByBucket.get(r.period_sort_key) || 0),
    }));
}

/**
 * Aggregates real business numbers for a growth-study deck. Every figure returned
 * here comes straight from SQL — the AI layer only ever narrates these, never
 * invents them.
 */
export async function getGrowthMetrics(companyId, period) {
    const resolved = resolvePeriod(period);
    const { unit, buckets, labelFmt } = PERIOD_CONFIG[resolved];
    const windowClause = `CURRENT_DATE - (${buckets} * INTERVAL '1 ${unit}')`;

    const [
        revenueRows,
        purchaseRows,
        customerRows,
        expenseBreakdown,
        salesData,
        purchaseData,
        receivablesData,
        payablesData,
        customerCount,
        prevSalesData,
        company,
    ] = await Promise.all([
        db.pgAll(`
            SELECT
                TO_CHAR(DATE_TRUNC('${unit}', invoice_date), '${labelFmt}') AS period_label,
                DATE_TRUNC('${unit}', invoice_date) AS period_sort_key,
                COALESCE(SUM(total_amount), 0) AS value
            FROM invoices
            WHERE company_id = $1
              AND COALESCE(is_deleted, false) = false
              AND COALESCE(bill_purpose, '') != 'name_only'
              AND invoice_date >= ${windowClause}
            GROUP BY period_sort_key
            ORDER BY period_sort_key ASC
        `, [companyId]).catch(() => []),

        db.pgAll(`
            SELECT
                DATE_TRUNC('${unit}', bill_date) AS period_sort_key,
                COALESCE(SUM(COALESCE(total_amount, grand_total, net_amount, 0)), 0) AS value
            FROM purchase_bills
            WHERE company_id = $1
              AND COALESCE(is_deleted, false) = false
              AND bill_date >= ${windowClause}
            GROUP BY period_sort_key
        `, [companyId]).catch(() => []),

        db.pgAll(`
            SELECT
                TO_CHAR(DATE_TRUNC('${unit}', created_at), '${labelFmt}') AS period_label,
                DATE_TRUNC('${unit}', created_at) AS period_sort_key,
                COUNT(*) AS value
            FROM users
            WHERE company_id = $1
              AND role = 'customer'
              AND created_at >= ${windowClause}
            GROUP BY period_sort_key, period_label
            ORDER BY period_sort_key ASC
        `, [companyId]).catch(() => []),

        db.pgAll(`
            SELECT
                COALESCE(NULLIF(expense_category,''), category, type) AS category,
                SUM(amount) AS value
            FROM transactions
            WHERE company_id = $1
              AND type IN ('EXPENSE','EXPENSE_PAYMENT','MISC_EXPENSE','PURCHASE','UTILITY','MAINTENANCE')
              AND COALESCE(date, created_at::date) >= ${windowClause}
            GROUP BY COALESCE(NULLIF(expense_category,''), category, type)
            ORDER BY value DESC
            LIMIT 8
        `, [companyId]).catch(() => []),

        db.pgGet(`
            SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(id) AS count
            FROM invoices
            WHERE company_id = $1
              AND COALESCE(is_deleted, false) = false
              AND COALESCE(bill_purpose, '') != 'name_only'
              AND invoice_date >= ${windowClause}
        `, [companyId]),

        db.pgGet(`
            SELECT COALESCE(SUM(COALESCE(total_amount, grand_total, net_amount, 0)), 0) AS total
            FROM purchase_bills
            WHERE company_id = $1
              AND COALESCE(is_deleted, false) = false
              AND bill_date >= ${windowClause}
        `, [companyId]).catch(() => ({ total: 0 })),

        db.pgGet(`
            SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount,0)), 0) AS total
            FROM invoices
            WHERE company_id = $1
              AND COALESCE(is_deleted, false) = false
              AND COALESCE(bill_purpose, '') != 'name_only'
        `, [companyId]),

        db.pgGet(`
            SELECT COALESCE(SUM(COALESCE(total_amount, grand_total, net_amount, 0)), 0) AS total
            FROM purchase_bills
            WHERE company_id = $1 AND COALESCE(is_deleted, false) = false
        `, [companyId]).catch(() => ({ total: 0 })),

        db.pgGet(`SELECT COUNT(*) AS count FROM users WHERE company_id = $1 AND role = 'customer'`, [companyId]),

        db.pgGet(`
            SELECT COALESCE(SUM(total_amount), 0) AS total
            FROM invoices
            WHERE company_id = $1
              AND COALESCE(is_deleted, false) = false
              AND COALESCE(bill_purpose, '') != 'name_only'
              AND invoice_date >= (${windowClause}) - (${buckets} * INTERVAL '1 ${unit}')
              AND invoice_date < ${windowClause}
        `, [companyId]),

        db.pgGet(`SELECT company_name FROM companies WHERE id = $1`, [companyId]).catch(() => null),
    ]);

    const revenueSeries = revenueRows.map(r => ({
        period_label: r.period_label,
        period_sort: r.period_sort_key,
        value: parseFloat(r.value || 0),
    }));
    const purchaseSeries = revenueRows.map(r => ({
        period_label: r.period_label,
        period_sort: r.period_sort_key,
        value: parseFloat((purchaseRows.find(p => String(p.period_sort_key) === String(r.period_sort_key)) || {}).value || 0),
    }));
    const grossProfitSeries = joinSeriesByBucket(revenueRows, purchaseRows);
    const newCustomerSeries = customerRows.map(r => ({
        period_label: r.period_label,
        period_sort: r.period_sort_key,
        value: parseInt(r.value || 0),
    }));

    const currentRevenue = parseFloat(salesData?.total || 0);
    const prevRevenue = parseFloat(prevSalesData?.total || 0);
    const revenueGrowthPct = prevRevenue > 0
        ? Number((((currentRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1))
        : null;
    const totalPurchases = parseFloat(purchaseData?.total || 0);
    const totalGrossProfit = currentRevenue - totalPurchases;
    const avgBucketRevenue = revenueSeries.length > 0
        ? currentRevenue / revenueSeries.length
        : 0;

    const [
        overdueReceivables, lowStockProducts, overduePayables, highAbsence,
    ] = await Promise.all([
        db.pgGet(`SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount,0)),0) AS total, COUNT(*) AS count FROM invoices WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND invoice_date < CURRENT_DATE - INTERVAL '60 days' AND total_amount - COALESCE(paid_amount,0) > 0`, [companyId]),
        db.pgGet(`SELECT COUNT(*) AS count, (SELECT COUNT(*) FROM products WHERE company_id=$1 AND COALESCE(is_deleted,false)=false) AS total FROM products WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND current_stock = 0`, [companyId]).catch(() => ({ count: 0, total: 0 })),
        db.pgGet(`SELECT COALESCE(SUM(COALESCE(total_amount,grand_total,net_amount,0)),0) AS total FROM purchase_bills WHERE company_id=$1 AND COALESCE(is_deleted,false)=false AND bill_date < CURRENT_DATE - INTERVAL '60 days'`, [companyId]).catch(() => ({ total: 0 })),
        db.pgGet(`SELECT COUNT(CASE WHEN UPPER(status)='ABSENT' THEN 1 END) AS absent, COUNT(id) AS total FROM attendance_logs WHERE company_id=$1 AND date >= CURRENT_DATE - INTERVAL '30 days'`, [companyId]).catch(() => ({ absent: 0, total: 0 })),
    ]);

    const getRiskLevel = (pct) => pct > 30 ? 'high' : pct > 15 ? 'medium' : 'low';
    const overdueRecPct = currentRevenue > 0 ? (parseFloat(overdueReceivables?.total || 0) / currentRevenue * 100) : 0;
    const stockoutPct = parseInt(lowStockProducts?.total || 0) > 0 ? (parseInt(lowStockProducts?.count || 0) / parseInt(lowStockProducts?.total || 1) * 100) : 0;
    const overduePayPct = totalPurchases > 0 ? (parseFloat(overduePayables?.total || 0) / totalPurchases * 100) : 0;
    const absencePct = parseInt(highAbsence?.total || 0) > 0 ? (parseInt(highAbsence?.absent || 0) / parseInt(highAbsence?.total || 1) * 100) : 0;

    return {
        period: resolved,
        bucket_count: buckets,
        company_name: company?.company_name || 'Company',
        generated_at: new Date().toISOString(),
        series: {
            revenue: revenueSeries,
            purchases: purchaseSeries,
            gross_profit: grossProfitSeries,
            new_customers: newCustomerSeries,
        },
        expense_breakdown: expenseBreakdown.map(e => ({ category: e.category || 'Other', value: parseFloat(e.value || 0) })),
        summary_kpis: {
            total_revenue: currentRevenue,
            total_purchases: totalPurchases,
            total_gross_profit: totalGrossProfit,
            revenue_growth_pct: revenueGrowthPct,
            avg_bucket_revenue: avgBucketRevenue,
            total_customers: parseInt(customerCount?.count || 0),
            new_customers_in_window: newCustomerSeries.reduce((sum, r) => sum + r.value, 0),
            receivables: parseFloat(receivablesData?.total || 0),
            payables: parseFloat(payablesData?.total || 0),
        },
        risk_indicators: [
            { indicator: 'Overdue Receivables', value: Number(overdueRecPct.toFixed(1)), unit: '%', risk_level: getRiskLevel(overdueRecPct), description: 'Receivables overdue > 60 days, as % of period revenue' },
            { indicator: 'Stockout Risk', value: Number(stockoutPct.toFixed(1)), unit: '%', risk_level: getRiskLevel(stockoutPct), description: 'Products with zero stock' },
            { indicator: 'Overdue Payables', value: Number(overduePayPct.toFixed(1)), unit: '%', risk_level: getRiskLevel(overduePayPct), description: 'Payables overdue > 60 days, as % of period purchases' },
            { indicator: 'Absence Rate', value: Number(absencePct.toFixed(1)), unit: '%', risk_level: getRiskLevel(absencePct), description: 'Employee absence rate (30 days)' },
        ],
    };
}
