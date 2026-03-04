// backend/utils/accountingEngine.js
import * as db from '../database/pg.js';

/**
 * Creates a financial transaction with double-entry validation.
 * @param {Object} txData - { company_id, branch_id, transaction_date, reference_type, reference_id, description, created_by }
 * @param {Array} lines - Array of { account_id, debit_amount, credit_amount, description }
 */
export async function createTransaction(txData, lines) {
    const client = await db.getClient();
    
    try {
        await client.query('BEGIN');

        // 1. Validate Double Entry Rule: Sum(Debit) = Sum(Credit)
        const totalDebit = lines.reduce((sum, line) => sum + parseFloat(line.debit_amount || 0), 0);
        const totalCredit = lines.reduce((sum, line) => sum + parseFloat(line.credit_amount || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.001) {
            throw new Error(`Double-entry validation failed: Total Debit (${totalDebit}) must equal Total Credit (${totalCredit})`);
        }

        // 2. Insert Transaction Header
        const txSql = `
            INSERT INTO transactions (company_id, branch_id, transaction_date, reference_type, reference_id, description, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id;
        `;
        const txRes = await client.query(txSql, [
            txData.company_id,
            txData.branch_id,
            txData.transaction_date,
            txData.reference_type,
            txData.reference_id,
            txData.description,
            txData.created_by
        ]);
        const transactionId = txRes.rows[0].id;

        // 3. Process each line item
        for (const line of lines) {
            // A. Insert Transaction Line
            const lineSql = `
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, description)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id;
            `;
            await client.query(lineSql, [
                transactionId,
                line.account_id,
                line.debit_amount || 0,
                line.credit_amount || 0,
                line.description
            ]);

            // B. Update Account Current Balance
            // Rule: Increase current_balance by (Debit - Credit)
            // Note: Different account types treat Dr/Cr differently for reporting, but for raw balance tracking:
            const balanceChange = parseFloat(line.debit_amount || 0) - parseFloat(line.credit_amount || 0);
            const updateAccountSql = `
                UPDATE chart_of_accounts 
                SET current_balance = current_balance + $1 
                WHERE id = $2;
            `;
            await client.query(updateAccountSql, [balanceChange, line.account_id]);

            // C. Insert Ledger Entry (Running Balance tracking)
            const getLatestBalanceSql = `
                SELECT running_balance FROM ledger_entries 
                WHERE account_id = $1 
                ORDER BY entry_date DESC, id DESC LIMIT 1;
            `;
            const latestBalRes = await client.query(getLatestBalanceSql, [line.account_id]);
            const previousBalance = latestBalRes.rows[0] ? parseFloat(latestBalRes.rows[0].running_balance) : 0;
            const newRunningBalance = previousBalance + balanceChange;

            const ledgerSql = `
                INSERT INTO ledger_entries (company_id, branch_id, account_id, transaction_id, entry_date, debit, credit, running_balance)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
            `;
            await client.query(ledgerSql, [
                txData.company_id,
                txData.branch_id,
                line.account_id,
                transactionId,
                txData.transaction_date,
                line.debit_amount || 0,
                line.credit_amount || 0,
                newRunningBalance
            ]);
        }

        await client.query('COMMIT');
        return { success: true, transactionId };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Accounting Engine Error:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Generates a Profit & Loss Report
 */
export async function getProfitAndLoss(companyId, branchId, startDate, endDate) {
    let params = [companyId, startDate, endDate];
    let branchFilter = branchId ? `AND l.branch_id = $4` : '';
    if (branchId) params.push(branchId);

    const sql = `
        SELECT 
            ca.account_type,
            ca.name as account_name,
            SUM(l.debit) as total_debit,
            SUM(l.credit) as total_credit,
            CASE 
                WHEN ca.account_type = 'INCOME' THEN SUM(l.credit) - SUM(l.debit)
                WHEN ca.account_type = 'EXPENSE' THEN SUM(l.debit) - SUM(l.credit)
                ELSE 0 
            END as net_impact
        FROM ledger_entries l
        JOIN chart_of_accounts ca ON l.account_id = ca.id
        WHERE l.company_id = $1 
          AND l.entry_date BETWEEN $2 AND $3
          AND ca.account_type IN ('INCOME', 'EXPENSE')
          ${branchFilter}
        GROUP BY ca.account_type, ca.name
        ORDER BY ca.account_type;
    `;
    
    const results = await db.pgAll(sql, params);
    
    const summary = results.reduce((acc, curr) => {
        if (curr.account_type === 'INCOME') acc.totalIncome += parseFloat(curr.net_impact);
        if (curr.account_type === 'EXPENSE') acc.totalExpense += parseFloat(curr.net_impact);
        return acc;
    }, { totalIncome: 0, totalExpense: 0 });

    return { 
        details: results, 
        netProfit: summary.totalIncome - summary.totalExpense,
        ...summary
    };
}

/**
 * Helper to fetch account info by code for a company
 */
export async function getAccountByCode(companyId, code) {
    const sql = `SELECT id, account_type FROM chart_of_accounts WHERE (company_id = $1 OR company_id IS NULL) AND account_code = $2 LIMIT 1;`;
    return await db.pgGet(sql, [companyId, code]);
}
