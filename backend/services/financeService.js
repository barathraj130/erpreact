
import * as db from '../database/pg.js';

/**
 * LOAN HANDLING SERVICE
 */

export const createLoan = async (user, loanData) => {
    const client = await db.getClient();
    const companyId = user.active_company_id;
    const branchId = user.branch_id || 1;

    try {
        await client.query('BEGIN');

        const sanitizeInt = (val) => {
            const p = parseInt(val);
            return isNaN(p) ? null : p;
        };

        // 0. Ensure Lender exists or create it
        let lenderId = sanitizeInt(loanData.lender_id);
        if (!lenderId && loanData.lender_name) {
            const lRes = await client.query(
                "INSERT INTO lenders (company_id, lender_name, type, phone) VALUES ($1, $2, $3, $4) ON CONFLICT (lender_name, company_id) DO UPDATE SET phone=$4 RETURNING id",
                [companyId, loanData.lender_name, loanData.type || 'Bank', loanData.phone]
            );
            lenderId = lRes.rows[0].id;
        }

        // 1. Insert into loans table
        const loanSql = `
            INSERT INTO loans (
                company_id, branch_id, lender_id, party_name, party_type, 
                loan_direction, principal_amount, interest_rate, interest_type,
                start_date, duration_months, repayment_cycle, notes, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'ACTIVE')
            RETURNING *
        `;
        const loanRes = await client.query(loanSql, [
            companyId, 
            branchId, 
            lenderId, 
            loanData.party_name || loanData.lender_name || 'Lender', 
            loanData.party_type || loanData.type || 'BANK',
            loanData.loan_direction || 'BORROWED',
            loanData.principal_amount || loanData.principal,
            loanData.interest_rate,
            loanData.interest_type || 'SIMPLE',
            loanData.start_date,
            loanData.duration_months || 12,
            loanData.repayment_cycle || 'MONTHLY',
            loanData.notes
        ]);
        const loan = loanRes.rows[0];

        // 2. Double-Entry: Loan Disbursement
        // Debit: Cash/Bank (Asset)
        // Credit: Lender's Loan Payable Account (Liability)
        
        // Find the specific ledger account for this lender
        const lender = await client.query("SELECT lender_name FROM lenders WHERE id = $1", [lenderId]);
        const lenderName = lender.rows[0].lender_name;
        const ledgerRes = await client.query("SELECT id FROM ledgers WHERE company_id = $1 AND name = $2", [companyId, lenderName]);
        
        let lenderLedgerId = ledgerRes.rows[0]?.id;
        if (!lenderLedgerId) {
            const creditorsGroup = await client.query("SELECT id FROM ledger_groups WHERE (company_id = $1 OR company_id = 1) AND name = 'Sundry Creditors'", [companyId]);
            const gId = creditorsGroup.rows[0]?.id || 1;
            const newLedger = await client.query("INSERT INTO ledgers (company_id, name, group_id) VALUES ($1, $2, $3) RETURNING id", [companyId, lenderName + ' (Auto)', gId]);
            lenderLedgerId = newLedger.rows[0].id;
        }

        let bankAccountId = loanData.bank_account_id;
        if (!bankAccountId) {
            const defaultCash = await client.query("SELECT id FROM ledgers WHERE (company_id = $1 OR company_id = 1) AND name = 'Cash' LIMIT 1", [companyId]);
            bankAccountId = defaultCash.rows[0]?.id || 1;
        }
        
        const txSql = `
            INSERT INTO transactions (company_id, branch_id, transaction_date, date, reference_type, reference_id, description)
            VALUES ($1, $2, $3, $3, 'LOAN_DISBURSEMENT', $4, $5)
            RETURNING id
        `;
        const txRes = await client.query(txSql, [
            companyId, branchId, loanData.start_date, loan.id, `Loan disbursement from lender ID: ${loanData.lender_id}`
        ]);
        const transactionId = txRes.rows[0].id;

        // Debit Cash/Bank
        await client.query(`
            INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, description)
            VALUES ($1, $2, $3, 0, 'Loan amount received')
        `, [transactionId, bankAccountId, loanData.principal_amount]);

        // Credit Loan Payable
        await client.query(`
            INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, description)
            VALUES ($1, $2, 0, $3, 'Loan liability recorded')
        `, [transactionId, lenderLedgerId, loanData.principal_amount]);

        await client.query('COMMIT');
        return loan;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create Loan Error:', err);
        throw err;
    } finally {
        client.release();
    }
};

export const recordLoanRepayment = async (user, paymentData) => {
    const client = await db.getClient();
    const companyId = user.active_company_id;
    const branchId = user.branch_id || 1;

    try {
        await client.query('BEGIN');

        // 1. Insert into loan_payments
        const paymentSql = `
            INSERT INTO loan_payments (
                company_id, loan_id, payment_date, total_amount, 
                interest_component, principal_component, payment_mode, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        const paymentRes = await client.query(paymentSql, [
            companyId, paymentData.loan_id, paymentData.payment_date, paymentData.total_amount,
            paymentData.interest_component || 0, paymentData.principal_component || 0,
            paymentData.payment_mode || 'CASH', paymentData.notes
        ]);
        const payment = paymentRes.rows[0];

        // 2. Double-Entry
        // Debit: Interest Expense
        // Debit: Lender's Loan Payable (for principal)
        // Credit: Cash/Bank
        
        // Find the specific ledger account for this lender via loan
        const lenderLedgerRes = await client.query(`
            SELECT led.id 
            FROM ledgers led
            JOIN lenders ln ON led.name = ln.lender_name
            JOIN loans lo ON lo.lender_id = ln.id
            WHERE lo.id = $1 AND led.company_id = $2
        `, [paymentData.loan_id, companyId]);
        const lenderLedgerId = lenderLedgerRes.rows[0]?.id || 10;
        
        const txSql = `
            INSERT INTO transactions (company_id, branch_id, transaction_date, reference_type, reference_id, description)
            VALUES ($1, $2, $3, 'LOAN_REPAYMENT', $4, $5)
            RETURNING id
        `;
        const txRes = await client.query(txSql, [
            companyId, branchId, paymentData.payment_date, payment.id, `Loan repayment for loan ID: ${paymentData.loan_id}`
        ]);
        const transactionId = txRes.rows[0].id;

        // Debit Interest Expense
        if (paymentData.interest_component > 0) {
            await client.query(`
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, description)
                VALUES ($1, $2, $3, 0, 'Interest expense')
            `, [transactionId, paymentData.interest_expense_account_id || 20, paymentData.interest_component]);
        }

        // Debit Loan Payable (Principal)
        if (paymentData.principal_component > 0) {
            await client.query(`
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, description)
                VALUES ($1, $2, $3, 0, 'Principal repayment')
            `, [transactionId, lenderLedgerId, paymentData.principal_component]);
        }

        // Credit Cash/Bank
        await client.query(`
            INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, description)
            VALUES ($1, $2, 0, $3, 'Payment from bank/cash')
        `, [transactionId, paymentData.bank_account_id || 1, paymentData.total_amount]);

        await client.query('COMMIT');
        return payment;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Loan Repayment Error:', err);
        throw err;
    } finally {
        client.release();
    }
};

/**
 * CHIT FUND HANDLING SERVICE
 */

export const createChitGroup = async (user, chitData) => {
    const client = await db.getClient();
    const companyId = user.active_company_id;
    const branchId = user.branch_id || 1;

    try {
        const sql = `
            INSERT INTO chit_groups (
                company_id, branch_id, group_name, total_value, 
                monthly_installment, duration_months, start_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const res = await client.query(sql, [
            companyId, branchId, chitData.group_name, chitData.total_value,
            chitData.monthly_installment, chitData.duration_months, chitData.start_date
        ]);
        return res.rows[0];
    } catch (err) {
        console.error('Create Chit Group Error:', err);
        throw err;
    } finally {
        client.release();
    }
};

export const recordChitInstallment = async (user, installmentData) => {
    const client = await db.getClient();
    const companyId = user.active_company_id;
    const branchId = user.branch_id || 1;

    try {
        await client.query('BEGIN');

        // 1. Insert installment
        const sql = `
            INSERT INTO chit_installments (
                company_id, chit_group_id, payment_date, amount, 
                is_auction_won, auction_amount_received, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const res = await client.query(sql, [
            companyId, installmentData.chit_group_id, installmentData.payment_date, installmentData.amount,
            installmentData.is_auction_won || false, installmentData.auction_amount_received || 0, installmentData.notes
        ]);
        const installment = res.rows[0];

        // 2. Double-Entry
        const txSql = `
            INSERT INTO transactions (company_id, branch_id, transaction_date, reference_type, reference_id, description)
            VALUES ($1, $2, $3, 'CHIT_INSTALLMENT', $4, $5)
            RETURNING id
        `;
        const txRes = await client.query(txSql, [
            companyId, branchId, installmentData.payment_date, installment.id, `Chit installment for group ID: ${installmentData.chit_group_id}`
        ]);
        const transactionId = txRes.rows[0].id;

        if (installmentData.is_auction_won) {
            // Receipt: Won auction
            // Debit: Cash (Asset)
            // Credit: Chit Fund Asset (Asset)
            
            await client.query(`
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, description)
                VALUES ($1, $2, $3, 0, 'Chit auction payout received')
            `, [transactionId, installmentData.bank_account_id || 1, installmentData.auction_amount_received]);

            await client.query(`
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, description)
                VALUES ($1, $2, 0, $3, 'Chit asset reduced by payout')
            `, [transactionId, installmentData.chit_asset_account_id || 30, installmentData.auction_amount_received]);

        } else {
            // Payment: Monthly installment
            // Debit: Chit Fund Asset (Asset)
            // Credit: Cash (Asset)
            
            await client.query(`
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, description)
                VALUES ($1, $2, $3, 0, 'Chit installment paid')
            `, [transactionId, installmentData.chit_asset_account_id || 30, installmentData.amount]);

            await client.query(`
                INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, description)
                VALUES ($1, $2, 0, $3, 'Payment from bank/cash')
            `, [transactionId, installmentData.bank_account_id || 1, installmentData.amount]);
        }

        await client.query('COMMIT');
        return installment;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Chit Installment Error:', err);
        throw err;
    } finally {
        client.release();
    }
};

export const getFinanceSummary = async (companyId) => {
    try {
        const loanLiability = await db.pgGet(`
            SELECT SUM(principal_amount) as total FROM loans WHERE company_id = $1 AND status = 'ACTIVE'
        `, [companyId]);

        const chitCommitment = await db.pgGet(`
            SELECT SUM(monthly_installment) as total FROM chit_groups WHERE company_id = $1 AND status = 'ACTIVE'
        `, [companyId]);

        return {
            total_loan_liability: loanLiability.total || 0,
            total_chit_commitment: chitCommitment.total || 0,
            next_payment_due: null // Logic to find nearest due date
        };
    } catch (err) {
        console.error('Finance Summary Error:', err);
        return { total_loan_liability: 0, total_chit_commitment: 0 };
    }
};
