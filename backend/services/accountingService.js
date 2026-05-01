// backend/services/accountingService.js
import * as db from "../database/pg.js";
import { logAction } from "./auditLogService.js";

/**
 * Create journal entry
 */
export const createJournalEntry = async (companyId, entryData, userId) => {
    const {
        entry_date,
        entry_number,
        description,
        reference_type = null, // "invoice", "payment", "bank_transfer", etc.
        reference_id = null,
        narration = null,
        line_items // [{account_id, debit, credit, description}]
    } = entryData;

    try {
        // Verify double-entry (debit = credit)
        const totalDebit = line_items.reduce((sum, item) => sum + (item.debit || 0), 0);
        const totalCredit = line_items.reduce((sum, item) => sum + (item.credit || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error("Journal entry not balanced: debits must equal credits");
        }

        // Create journal entry header
        const entry = await db.pgRun(
            `INSERT INTO journal_entries
             (company_id, entry_date, entry_number, description, reference_type, reference_id, narration, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'POSTED')
             RETURNING id`,
            [companyId, entry_date, entry_number, description, reference_type, reference_id, narration]
        );

        // Create line items and post to ledger
        for (const item of line_items) {
            // Insert journal line item
            const lineItem = await db.pgRun(
                `INSERT INTO journal_line_items
                 (journal_entry_id, account_id, debit, credit, description)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [entry.id, item.account_id, item.debit || 0, item.credit || 0, item.description]
            );

            // Post to general ledger
            await postToLedger(item.account_id, entry.id, item.debit || 0, item.credit || 0, entry_date);
        }

        await logAction({
            user_id: userId,
            company_id: companyId,
            module: "FINANCE",
            action: "CREATE_JOURNAL_ENTRY",
            resource_type: "journal_entry",
            resource_id: entry.id,
            new_data: entryData,
            status: "success"
        });

        return { id: entry.id, entry_number, total_debit: totalDebit, total_credit: totalCredit };
    } catch (err) {
        console.error("❌ Create journal entry error:", err);
        throw err;
    }
};

/**
 * Post to general ledger
 */
export const postToLedger = async (accountId, journalEntryId, debit, credit, postDate) => {
    try {
        await db.pgRun(
            `INSERT INTO general_ledger
             (account_id, journal_entry_id, debit, credit, post_date)
             VALUES ($1, $2, $3, $4, $5)`,
            [accountId, journalEntryId, debit, credit, postDate]
        );

        // Update account balance
        const ledgerSummary = await db.pgGet(
            `SELECT 
                COALESCE(SUM(debit), 0) as total_debit,
                COALESCE(SUM(credit), 0) as total_credit
             FROM general_ledger
             WHERE account_id = $1`,
            [accountId]
        );

        const balance = ledgerSummary.total_debit - ledgerSummary.total_credit;

        await db.pgRun(
            `UPDATE coa 
             SET balance = $1, last_posted_date = NOW()
             WHERE id = $2`,
            [balance, accountId]
        );
    } catch (err) {
        console.error("❌ Post to ledger error:", err);
        throw err;
    }
};

/**
 * Generate Profit & Loss statement
 */
export const generateProfitLoss = async (companyId, startDate, endDate) => {
    try {
        // Get all revenue accounts
        const revenues = await db.pgAll(
            `SELECT 
                c.id, c.account_name, c.account_code,
                COALESCE(SUM(gl.credit - gl.debit), 0) as amount
             FROM coa c
             LEFT JOIN general_ledger gl ON c.id = gl.account_id
             WHERE c.company_id = $1 
             AND c.account_type = 'REVENUE'
             AND gl.post_date BETWEEN $2 AND $3
             GROUP BY c.id, c.account_name, c.account_code`,
            [companyId, startDate, endDate]
        );

        // Get all expense accounts
        const expenses = await db.pgAll(
            `SELECT 
                c.id, c.account_name, c.account_code,
                COALESCE(SUM(gl.debit - gl.credit), 0) as amount
             FROM coa c
             LEFT JOIN general_ledger gl ON c.id = gl.account_id
             WHERE c.company_id = $1 
             AND c.account_type = 'EXPENSE'
             AND gl.post_date BETWEEN $2 AND $3
             GROUP BY c.id, c.account_name, c.account_code`,
            [companyId, startDate, endDate]
        );

        const totalRevenue = revenues.reduce((sum, acc) => sum + acc.amount, 0);
        const totalExpense = expenses.reduce((sum, acc) => sum + acc.amount, 0);
        const netProfit = totalRevenue - totalExpense;

        return {
            period: { start: startDate, end: endDate },
            revenues: { details: revenues, total: totalRevenue },
            expenses: { details: expenses, total: totalExpense },
            net_profit: netProfit
        };
    } catch (err) {
        console.error("❌ Generate P&L error:", err);
        throw err;
    }
};

/**
 * Generate Balance Sheet
 */
export const generateBalanceSheet = async (companyId, asOfDate) => {
    try {
        // Assets
        const assets = await db.pgAll(
            `SELECT 
                c.id, c.account_name, c.account_code, c.balance,
                c.account_category
             FROM coa c
             WHERE c.company_id = $1 
             AND c.account_type = 'ASSET'
             AND c.is_active = TRUE
             ORDER BY c.account_category, c.account_name`,
            [companyId]
        );

        // Liabilities
        const liabilities = await db.pgAll(
            `SELECT 
                c.id, c.account_name, c.account_code, c.balance,
                c.account_category
             FROM coa c
             WHERE c.company_id = $1 
             AND c.account_type = 'LIABILITY'
             AND c.is_active = TRUE
             ORDER BY c.account_category, c.account_name`,
            [companyId]
        );

        // Equity
        const equity = await db.pgAll(
            `SELECT 
                c.id, c.account_name, c.account_code, c.balance,
                c.account_category
             FROM coa c
             WHERE c.company_id = $1 
             AND c.account_type = 'EQUITY'
             AND c.is_active = TRUE
             ORDER BY c.account_category, c.account_name`,
            [companyId]
        );

        const totalAssets = assets.reduce((sum, acc) => sum + acc.balance, 0);
        const totalLiabilities = liabilities.reduce((sum, acc) => sum + acc.balance, 0);
        const totalEquity = equity.reduce((sum, acc) => sum + acc.balance, 0);

        return {
            as_of_date: asOfDate,
            assets: { details: assets, total: totalAssets },
            liabilities: { details: liabilities, total: totalLiabilities },
            equity: { details: equity, total: totalEquity },
            validation: {
                balanced: Math.abs((totalAssets) - (totalLiabilities + totalEquity)) < 0.01,
                total_assets: totalAssets,
                total_liabilities_equity: totalLiabilities + totalEquity
            }
        };
    } catch (err) {
        console.error("❌ Generate Balance Sheet error:", err);
        throw err;
    }
};

/**
 * Generate Cash Flow Statement
 */
export const generateCashFlowStatement = async (companyId, startDate, endDate) => {
    try {
        // Operating activities
        const operatingCash = await db.pgGet(
            `SELECT COALESCE(SUM(gl.debit - gl.credit), 0) as amount
             FROM general_ledger gl
             JOIN coa c ON gl.account_id = c.id
             WHERE c.company_id = $1 
             AND c.account_type = 'OPERATING'
             AND gl.post_date BETWEEN $2 AND $3`,
            [companyId, startDate, endDate]
        );

        // Investing activities
        const investingCash = await db.pgGet(
            `SELECT COALESCE(SUM(gl.debit - gl.credit), 0) as amount
             FROM general_ledger gl
             JOIN coa c ON gl.account_id = c.id
             WHERE c.company_id = $1 
             AND c.account_type = 'INVESTING'
             AND gl.post_date BETWEEN $2 AND $3`,
            [companyId, startDate, endDate]
        );

        // Financing activities
        const financingCash = await db.pgGet(
            `SELECT COALESCE(SUM(gl.debit - gl.credit), 0) as amount
             FROM general_ledger gl
             JOIN coa c ON gl.account_id = c.id
             WHERE c.company_id = $1 
             AND c.account_type = 'FINANCING'
             AND gl.post_date BETWEEN $2 AND $3`,
            [companyId, startDate, endDate]
        );

        const netCashFlow = (operatingCash.amount || 0) + (investingCash.amount || 0) + (financingCash.amount || 0);

        return {
            period: { start: startDate, end: endDate },
            operating_cash_flow: operatingCash.amount || 0,
            investing_cash_flow: investingCash.amount || 0,
            financing_cash_flow: financingCash.amount || 0,
            net_change_in_cash: netCashFlow
        };
    } catch (err) {
        console.error("❌ Generate Cash Flow error:", err);
        throw err;
    }
};

/**
 * Get trial balance
 */
export const getTrialBalance = async (companyId, asOfDate) => {
    try {
        const accounts = await db.pgAll(
            `SELECT 
                c.id, c.account_name, c.account_code, c.account_type,
                COALESCE(SUM(gl.debit), 0) as total_debit,
                COALESCE(SUM(gl.credit), 0) as total_credit
             FROM coa c
             LEFT JOIN general_ledger gl ON c.id = gl.account_id
             AND gl.post_date <= $2
             WHERE c.company_id = $1 AND c.is_active = TRUE
             GROUP BY c.id, c.account_name, c.account_code, c.account_type
             ORDER BY c.account_code`,
            [companyId, asOfDate]
        );

        const totalDebits = accounts.reduce((sum, acc) => sum + acc.total_debit, 0);
        const totalCredits = accounts.reduce((sum, acc) => sum + acc.total_credit, 0);

        return {
            as_of_date: asOfDate,
            accounts,
            totals: {
                total_debits: totalDebits,
                total_credits: totalCredits,
                balanced: Math.abs(totalDebits - totalCredits) < 0.01
            }
        };
    } catch (err) {
        console.error("❌ Get trial balance error:", err);
        throw err;
    }
};

export default {
    createJournalEntry,
    postToLedger,
    generateProfitLoss,
    generateBalanceSheet,
    generateCashFlowStatement,
    getTrialBalance
};
