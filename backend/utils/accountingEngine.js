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
            INSERT INTO transactions (company_id, branch_id, transaction_date, date, reference_type, reference_id, description, created_by, bill_purpose, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id;
        `;
        const txRes = await client.query(txSql, [
            txData.company_id,
            txData.branch_id,
            txData.transaction_date,
            txData.transaction_date, // Use same date for both columns
            txData.reference_type,
            txData.reference_id,
            txData.description,
            txData.created_by,
            txData.bill_purpose || 'real',
            'success'
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
            const sanitizeInt = (val) => {
                const p = parseInt(val);
                return isNaN(p) ? null : p;
            };

            await client.query(lineSql, [
                transactionId,
                sanitizeInt(line.account_id),
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
                INSERT INTO ledger_entries (company_id, branch_id, account_id, transaction_id, entry_date, debit, credit, running_balance, bill_purpose)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
            `;
            await client.query(ledgerSql, [
                txData.company_id,
                txData.branch_id,
                line.account_id,
                transactionId,
                txData.transaction_date,
                line.debit_amount || 0,
                line.credit_amount || 0,
                newRunningBalance,
                txData.bill_purpose || 'real'
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
export async function getProfitAndLoss(companyId, branchId, startDate, endDate, filterType = 'real') {
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
          AND l.bill_purpose = ANY($${params.length + 1})
          ${branchFilter}
        GROUP BY ca.account_type, ca.name
        ORDER BY ca.account_type;
    `;
    
    const purposes = filterType === 'all' ? ['real', 'name_only'] : 
                    (filterType === 'name_only' ? ['name_only'] : ['real']);

    const results = await db.pgAll(sql, [...params, purposes]);
    
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
    let account = await db.pgGet(sql, [companyId, code]);
    
    // Auto-seed missing essential accounts
    if (!account && companyId) {
        const defaults = {
            '1000': { name: 'Cash', type: 'ASSET' },
            '1100': { name: 'Accounts Receivable', type: 'ASSET' },
            '1200': { name: 'Bank Account', type: 'ASSET' },
            '1400': { name: 'Inventory', type: 'ASSET' },
            '2000': { name: 'Accounts Payable', type: 'LIABILITY' },
            '2100': { name: 'GST Payable', type: 'LIABILITY' },
            '2200': { name: 'GST Input (Purchases)', type: 'ASSET' },
            '3000': { name: 'Opening Stock Adj / Equity', type: 'EQUITY' },
            '4000': { name: 'Sales Revenue', type: 'INCOME' },
            '4200': { name: 'Sales Returns', type: 'INCOME' },
            '5000': { name: 'Purchases', type: 'EXPENSE' },
            '5100': { name: 'Discount Allowed', type: 'EXPENSE' },
            '5200': { name: 'Discount Received', type: 'INCOME' }
        };
        
        if (defaults[code]) {
            const { name, type } = defaults[code];
            try {
                await db.pgRun(
                    `INSERT INTO chart_of_accounts (company_id, account_code, name, account_type, opening_balance, current_balance)
                     VALUES ($1, $2, $3, $4, 0, 0) ON CONFLICT (company_id, account_code) DO NOTHING`,
                    [companyId, code, name, type]
                );
                account = await db.pgGet(sql, [companyId, code]);
            } catch (e) {
                console.error("Auto-seed account failed:", e);
            }
        }
    }
    return account;
}
/**
 * Generates a Balance Sheet Report
 */
export async function getBalanceSheet(companyId, filterType = 'real') {
    // Ensure core accounts exist before running the report
    const coreCodes = ['1000', '1100', '1400', '2100', '3000', '4000'];
    for (const code of coreCodes) {
        await getAccountByCode(companyId, code);
    }

    const purposes = filterType === 'all' ? ['real', 'name_only'] : 
                    (filterType === 'name_only' ? ['name_only'] : ['real']);

    const sql = `
        SELECT 
            ca.account_type,
            ca.name as account_name,
            (ca.opening_balance + COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)) as current_balance
        FROM chart_of_accounts ca
        LEFT JOIN ledger_entries l ON ca.id = l.account_id AND l.bill_purpose = ANY($2)
        WHERE (ca.company_id = $1 OR ca.company_id IS NULL)
          AND UPPER(ca.account_type) IN ('ASSET', 'LIABILITY', 'EQUITY')
        GROUP BY ca.id, ca.account_type, ca.name, ca.opening_balance
        ORDER BY ca.account_type, ca.name;
    `;
    const results = await db.pgAll(sql, [companyId, purposes]);
    
    const summary = results.reduce((acc, curr) => {
        if (curr.account_type === 'ASSET') acc.totalAssets += parseFloat(curr.current_balance);
        else acc.totalLiabilitiesEquity += parseFloat(curr.current_balance);
        return acc;
    }, { totalAssets: 0, totalLiabilitiesEquity: 0 });

    return { details: results, ...summary };
}
/**
 * Generates a Trial Balance Report
 */
export async function getTrialBalance(companyId, filterType = 'real') {
    const purposes = filterType === 'all' ? ['real', 'name_only'] : 
                    (filterType === 'name_only' ? ['name_only'] : ['real']);

    const sql = `
        SELECT 
            ca.name as account_name,
            ca.account_type,
            COALESCE(SUM(l.debit), 0) as total_debit,
            COALESCE(SUM(l.credit), 0) as total_credit,
            (ca.opening_balance + COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)) as closing_balance
        FROM chart_of_accounts ca
        LEFT JOIN ledger_entries l ON ca.id = l.account_id AND l.bill_purpose = ANY($2)
        WHERE (ca.company_id = $1 OR ca.company_id IS NULL)
        GROUP BY ca.id, ca.name, ca.account_type, ca.opening_balance
        ORDER BY ca.account_type, ca.name;
    `;
    
    const results = await db.pgAll(sql, [companyId, purposes]);
    
    const summary = results.reduce((acc, curr) => {
        acc.total_debits += parseFloat(curr.total_debit);
        acc.total_credits += parseFloat(curr.total_credit);
        return acc;
    }, { total_debits: 0, total_credits: 0 });

    return { details: results, ...summary };
}
