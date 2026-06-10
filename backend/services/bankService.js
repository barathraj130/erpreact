// backend/services/bankService.js
import * as db from "../database/pg.js";
import { logAction } from "./auditLogService.js";

/**
 * Add bank account
 */
export const addBankAccount = async (companyId, accountData) => {
    const {
        account_name,
        account_number,
        bank_name,
        ifsc_code,
        account_type, // "savings", "current", "checking"
        opening_balance = 0,
        is_primary = false,
        user_id
    } = accountData;

    try {
        const account = await db.pgRun(
            `INSERT INTO bank_accounts 
             (company_id, account_name, account_number, bank_name, ifsc_code, account_type, opening_balance, is_primary)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, account_name, account_number`,
            [companyId, account_name, account_number, bank_name, ifsc_code, account_type, opening_balance, is_primary]
        );

        await logAction({
            user_id,
            company_id: companyId,
            module: "FINANCE",
            action: "CREATE_BANK_ACCOUNT",
            resource_type: "bank_account",
            resource_id: account.id,
            new_data: accountData,
            status: "success"
        });

        return account;
    } catch (err) {
        console.error("❌ Add bank account error:", err);
        throw err;
    }
};

/**
 * Get bank accounts for company
 */
export const getBankAccounts = async (companyId) => {
    try {
        const accounts = await db.pgAll(
            `SELECT * FROM bank_accounts 
             WHERE company_id = $1 AND is_active = TRUE
             ORDER BY is_primary DESC, created_at DESC`,
            [companyId]
        );

        return accounts;
    } catch (err) {
        console.error("❌ Get bank accounts error:", err);
        return [];
    }
};

/**
 * Import transactions (CSV/Excel)
 * Format: Date, Description, Amount, Type (IN/OUT)
 */
export const importTransactions = async (companyId, bankAccountId, transactions, userId) => {
    try {
        const imported = [];

        for (const txn of transactions) {
            const {
                transaction_date,
                description,
                amount,
                type, // "debit" or "credit"
                reference_no = null,
                remarks = null
            } = txn;

            // Check for duplicate
            const exists = await db.pgGet(
                `SELECT id FROM bank_transactions 
                 WHERE bank_account_id = $1 AND transaction_date = $2 AND amount = $3 AND description = $4`,
                [bankAccountId, transaction_date, amount, description]
            );

            if (!exists) {
                const transaction = await db.pgRun(
                    `INSERT INTO bank_transactions 
                     (bank_account_id, transaction_date, description, amount, type, reference_no, remarks, status)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING_CATEGORIZATION')
                     RETURNING id`,
                    [bankAccountId, transaction_date, description, amount, type, reference_no, remarks]
                );

                imported.push(transaction);
            }
        }

        // Log import
        await logAction({
            user_id: userId,
            company_id: companyId,
            module: "FINANCE",
            action: "IMPORT_TRANSACTIONS",
            resource_type: "bank_transaction",
            resource_id: bankAccountId,
            new_data: { imported_count: imported.length },
            status: "success"
        });

        return { imported_count: imported.length, transactions: imported };
    } catch (err) {
        console.error("❌ Import transactions error:", err);
        throw err;
    }
};

/**
 * Auto-categorize transactions using AI/patterns
 */
export const categorizTransaction = async (transactionId, category, subCategory = null) => {
    try {
        const transaction = await db.pgRun(
            `UPDATE bank_transactions 
             SET category = $1, sub_category = $2, status = 'CATEGORIZED', updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [category, subCategory, transactionId]
        );

        return transaction;
    } catch (err) {
        console.error("❌ Categorize transaction error:", err);
        throw err;
    }
};

/**
 * Get uncategorized transactions
 */
export const getUncategorizedTransactions = async (bankAccountId) => {
    try {
        const transactions = await db.pgAll(
            `SELECT * FROM bank_transactions 
             WHERE bank_account_id = $1 AND status = 'PENDING_CATEGORIZATION'
             ORDER BY transaction_date DESC`,
            [bankAccountId]
        );

        return transactions;
    } catch (err) {
        console.error("❌ Get uncategorized transactions error:", err);
        return [];
    }
};

/**
 * Bank reconciliation - match statements with general ledger
 */
export const reconcileBank = async (bankAccountId, reconciliationData, userId) => {
    const {
        statement_balance,
        statement_date,
        cleared_transactions
    } = reconciliationData;

    try {
        // Calculate book balance
        const bookBalance = await db.pgGet(
            `SELECT 
                COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as balance
             FROM bank_transactions
             WHERE bank_account_id = $1 AND status = 'CATEGORIZED'`,
            [bankAccountId]
        );

        const difference = statement_balance - bookBalance.balance;

        const reconciliation = await db.pgRun(
            `INSERT INTO bank_reconciliations 
             (bank_account_id, statement_balance, book_balance, difference, reconciliation_date, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [
                bankAccountId,
                statement_balance,
                bookBalance.balance,
                difference,
                statement_date,
                difference === 0 ? "RECONCILED" : "PENDING"
            ]
        );

        // Mark cleared transactions
        for (const txnId of cleared_transactions) {
            await db.pgRun(
                "UPDATE bank_transactions SET status = 'CLEARED' WHERE id = $1",
                [txnId]
            );
        }

        await logAction({
            user_id: userId,
            company_id: (await db.pgGet("SELECT company_id FROM bank_accounts WHERE id = $1", [bankAccountId])).company_id,
            module: "FINANCE",
            action: "RECONCILE_BANK",
            resource_type: "bank_reconciliation",
            resource_id: reconciliation.id,
            new_data: reconciliationData,
            status: "success"
        });

        return {
            reconciliation_id: reconciliation.id,
            statement_balance,
            book_balance: bookBalance.balance,
            difference,
            status: difference === 0 ? "RECONCILED" : "PENDING"
        };
    } catch (err) {
        console.error("❌ Reconcile bank error:", err);
        throw err;
    }
};

/**
 * Get bank summary dashboard
 */
export const getBankSummary = async (companyId) => {
    try {
        const accounts = await db.pgAll(
            `SELECT 
                ba.id,
                ba.account_name,
                ba.account_number,
                ba.bank_name,
                COALESCE(SUM(CASE WHEN bt.type = 'credit' THEN bt.amount ELSE -bt.amount END), 0) as balance
             FROM bank_accounts ba
             LEFT JOIN bank_transactions bt ON ba.id = bt.bank_account_id AND bt.status = 'CLEARED'
             WHERE ba.company_id = $1 AND ba.is_active = TRUE
             GROUP BY ba.id, ba.account_name, ba.account_number, ba.bank_name`,
            [companyId]
        );

        const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

        // Recent transactions
        const recentTxns = await db.pgAll(
            `SELECT bt.*, ba.account_name 
             FROM bank_transactions bt
             JOIN bank_accounts ba ON bt.bank_account_id = ba.id
             WHERE ba.company_id = $1
             ORDER BY bt.transaction_date DESC LIMIT 10`,
            [companyId]
        );

        return {
            accounts,
            total_balance: totalBalance,
            recent_transactions: recentTxns
        };
    } catch (err) {
        console.error("❌ Get bank summary error:", err);
        return { accounts: [], total_balance: 0, recent_transactions: [] };
    }
};

export default {
    addBankAccount,
    getBankAccounts,
    importTransactions,
    categorizTransaction,
    getUncategorizedTransactions,
    reconcileBank,
    getBankSummary
};
