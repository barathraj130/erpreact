
import * as db from '../backend/database/pg.js';

async function runAudit() {
    try {
        console.log("Starting Financial Audit Calculation...");

        // 1. Get Core Stats
        const revenueData = await db.pgGet(`SELECT SUM(total_amount) as total FROM invoices`);
        const purchaseData = await db.pgGet(`SELECT SUM(total_amount) as total FROM purchase_bills`);
        const salaryData = await db.pgGet(`SELECT SUM(amount) as total FROM salary_payments`);
        
        const totalRevenue = parseFloat(revenueData?.total || 0);
        const totalPurchases = parseFloat(purchaseData?.total || 0);
        const totalSalaries = parseFloat(salaryData?.total || 0);
        
        // Net Income (Simplified)
        const netIncome = totalRevenue - totalPurchases - totalSalaries;
        const ebit = netIncome; // Assuming no interest/tax tracked separately yet

        // 2. Liquidity Stats
        const cashIn = await db.pgGet(`SELECT SUM(amount) as total FROM cash_ledger WHERE direction = 'IN'`);
        const cashOut = await db.pgGet(`SELECT SUM(amount) as total FROM cash_ledger WHERE direction = 'OUT'`);
        const cashBalance = parseFloat(cashIn?.total || 0) - parseFloat(cashOut?.total || 0);

        const bankIn = await db.pgGet(`SELECT SUM(amount) as total FROM bank_ledger WHERE direction = 'IN'`);
        const bankOut = await db.pgGet(`SELECT SUM(amount) as total FROM bank_ledger WHERE direction = 'OUT'`);
        const bankBalance = parseFloat(bankIn?.total || 0) - parseFloat(bankOut?.total || 0);

        const inventoryData = await db.pgGet(`SELECT SUM(selling_price * current_stock) as total FROM products`);
        const inventoryValue = parseFloat(inventoryData?.total || 0);

        const receivableData = await db.pgGet(`SELECT SUM(total_amount - paid_amount) as total FROM invoices`);
        const accountsReceivable = parseFloat(receivableData?.total || 0);

        const payableData = await db.pgGet(`SELECT SUM(total_amount - paid_amount) as total FROM purchase_bills`);
        const accountsPayable = parseFloat(payableData?.total || 0);

        const currentAssets = cashBalance + bankBalance + inventoryValue + accountsReceivable;
        const currentLiabilities = accountsPayable;

        // 3. Altman Z-Score Components (Private Company Model)
        // Z = 0.717A + 0.847B + 3.107C + 0.420D + 0.998E
        // A = Working Capital / Total Assets
        // B = Retained Earnings / Total Assets
        // C = EBIT / Total Assets
        // D = Market Value of Equity / Total Liabilities
        // E = Sales / Total Assets

        const totalAssets = currentAssets; // Assuming primarily current-asset based for now
        const totalLiabilities = currentLiabilities;
        const workingCapital = currentAssets - currentLiabilities;
        const retainedEarnings = netIncome; // Proxy for now
        const marketValueEquity = Math.max(0, totalAssets - totalLiabilities); // Book Value as Market Value proxy

        const A = totalAssets > 0 ? workingCapital / totalAssets : 0;
        const B = totalAssets > 0 ? retainedEarnings / totalAssets : 0;
        const C = totalAssets > 0 ? ebit / totalAssets : 0;
        const D = totalLiabilities > 0 ? marketValueEquity / totalLiabilities : 0;
        const E = totalAssets > 0 ? totalRevenue / totalAssets : 0;

        const zScore = (0.717 * A) + (0.847 * B) + (3.107 * C) + (0.420 * D) + (0.998 * E);

        // 4. Output Results
        const audit = {
            company_name: "Titan-X Operations",
            z_score: zScore.toFixed(2),
            current_ratio: (currentAssets / currentLiabilities).toFixed(2),
            quick_ratio: ((currentAssets - inventoryValue) / currentLiabilities).toFixed(2),
            net_profit_margin: totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(2) : "0",
            roa: totalAssets > 0 ? ((netIncome / totalAssets) * 100).toFixed(2) : "0",
            debt_to_equity: marketValueEquity > 0 ? (totalLiabilities / marketValueEquity).toFixed(2) : "N/A",
            asset_turnover: totalAssets > 0 ? (totalRevenue / totalAssets).toFixed(2) : "0",
            raw_data: {
                total_assets: totalAssets,
                total_liabilities: totalLiabilities,
                current_assets: currentAssets,
                current_liabilities: currentLiabilities,
                inventory: inventoryValue,
                total_revenue: totalRevenue,
                net_income: netIncome,
                ebit: ebit,
                retained_earnings: retainedEarnings,
                market_cap: marketValueEquity
            }
        };

        console.log("AUDIT_RESULT_START");
        console.log(JSON.stringify(audit, null, 2));
        console.log("AUDIT_RESULT_END");

        process.exit(0);
    } catch (err) {
        console.error("Audit script failed:", err);
        process.exit(1);
    }
}

runAudit();
