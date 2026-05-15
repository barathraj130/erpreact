
import * as db from '../database/pg.js';
import { createTransactionInternal, getAccountByCode } from '../utils/accountingEngine.js';

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
        
        // Accounting
        const cashAcc = await getAccountByCode(companyId, '1000');
        const loanAcc = await getAccountByCode(companyId, '2000'); // Accounts Payable / Loan

        if (cashAcc && loanAcc) {
            await createTransactionInternal(client, {
                company_id: companyId,
                branch_id: branchId,
                transaction_date: loanData.start_date || new Date(),
                reference_type: 'LOAN_DISBURSEMENT',
                reference_id: loan.id,
                description: `Loan disbursement from ${loanData.lender_name || 'Lender'}`,
                created_by: user.id
            }, [
                { account_id: cashAcc.id, debit_amount: loanData.principal_amount || loanData.principal, credit_amount: 0, description: 'Loan amount received' },
                { account_id: loanAcc.id, debit_amount: 0, credit_amount: loanData.principal_amount || loanData.principal, description: 'Loan liability recorded' }
            ]);
        }

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
        const cashAcc = await getAccountByCode(companyId, '1000');
        const loanAcc = await getAccountByCode(companyId, '2000');
        const interestAcc = await getAccountByCode(companyId, '5000');

        if (cashAcc && loanAcc) {
            const interest = parseFloat(paymentData.interest_component || 0);
            const principal = parseFloat(paymentData.principal_component || 0);
            const total = parseFloat(paymentData.total_amount || 0);
            // Any amount not split into components goes to loan payable
            const remainder = Math.max(0, total - interest - principal);

            const txLines = [];
            if (interest > 0 && interestAcc) {
                txLines.push({ account_id: interestAcc.id, debit_amount: interest, credit_amount: 0, description: 'Interest expense' });
            }
            if (principal > 0) {
                txLines.push({ account_id: loanAcc.id, debit_amount: principal, credit_amount: 0, description: 'Principal repayment' });
            }
            if (remainder > 0) {
                txLines.push({ account_id: loanAcc.id, debit_amount: remainder, credit_amount: 0, description: 'Loan payment (other)' });
            }
            // Credit cash = total (guaranteed to equal sum of debits above)
            txLines.push({ account_id: cashAcc.id, debit_amount: 0, credit_amount: total, description: 'Payment from bank/cash' });

            await createTransactionInternal(client, {
                company_id: companyId,
                branch_id: branchId,
                transaction_date: paymentData.payment_date || new Date(),
                reference_type: 'LOAN_REPAYMENT',
                reference_id: payment.id,
                description: `Loan repayment for loan ID: ${paymentData.loan_id}`,
                created_by: user.id
            }, txLines);
        }

        // 3. Update cash/bank ledger so Financial Ledgers page shows the outflow
        const payMode = (paymentData.payment_mode || 'CASH').toUpperCase();
        if (payMode === 'BANK') {
            await client.query(
                `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, date)
                 VALUES ($1, $2, 'LOAN_REPAYMENT', $3, 'out', 'Main Account', $4)`,
                [companyId, branchId, paymentData.total_amount, paymentData.payment_date]
            );
        } else {
            await client.query(
                `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                 VALUES ($1, $2, 'LOAN_REPAYMENT', $3, 'out', $4)`,
                [companyId, branchId, paymentData.total_amount, paymentData.payment_date]
            );
        }

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
        // Accounting
        const cashAcc = await getAccountByCode(companyId, '1000');
        const chitAcc = await getAccountByCode(companyId, '1400'); // Use Inventory/Asset code for Chit

        if (cashAcc && chitAcc) {
            const txLines = [];
            if (installmentData.is_auction_won) {
                txLines.push({ account_id: cashAcc.id, debit_amount: installmentData.auction_amount_received, credit_amount: 0, description: 'Chit auction payout received' });
                txLines.push({ account_id: chitAcc.id, debit_amount: 0, credit_amount: installmentData.auction_amount_received, description: 'Chit asset reduced by payout' });
            } else {
                txLines.push({ account_id: chitAcc.id, debit_amount: installmentData.amount, credit_amount: 0, description: 'Chit installment paid' });
                txLines.push({ account_id: cashAcc.id, debit_amount: 0, credit_amount: installmentData.amount, description: 'Payment from bank/cash' });
            }

            await createTransactionInternal(client, {
                company_id: companyId,
                branch_id: branchId,
                transaction_date: installmentData.payment_date || new Date(),
                reference_type: 'CHIT_INSTALLMENT',
                reference_id: installment.id,
                description: `Chit installment for group ID: ${installmentData.chit_group_id}`,
                created_by: user.id
            }, txLines);
        }

        // 3. Write to cash/bank ledger for Financial Ledgers visibility
        const chitPayMode = (installmentData.payment_mode || 'CASH').toUpperCase();
        if (!installmentData.is_auction_won) {
            // Paying installment = cash OUT
            if (chitPayMode === 'BANK') {
                await client.query(
                    `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, date)
                     VALUES ($1, $2, 'CHIT_INSTALLMENT', $3, 'out', 'Main Account', $4)`,
                    [companyId, branchId, installmentData.amount, installmentData.payment_date]
                );
            } else {
                await client.query(
                    `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                     VALUES ($1, $2, 'CHIT_INSTALLMENT', $3, 'out', $4)`,
                    [companyId, branchId, installmentData.amount, installmentData.payment_date]
                );
            }
        } else if (installmentData.auction_amount_received > 0) {
            // Auction won = cash IN
            if (chitPayMode === 'BANK') {
                await client.query(
                    `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, date)
                     VALUES ($1, $2, 'CHIT_AUCTION', $3, 'in', 'Main Account', $4)`,
                    [companyId, branchId, installmentData.auction_amount_received, installmentData.payment_date]
                );
            } else {
                await client.query(
                    `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                     VALUES ($1, $2, 'CHIT_AUCTION', $3, 'in', $4)`,
                    [companyId, branchId, installmentData.auction_amount_received, installmentData.payment_date]
                );
            }
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
