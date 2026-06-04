
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
        const lenderNameRaw = loanData.lender_name || loanData.party_name;
        if (!lenderId && lenderNameRaw) {
            // Auto-create lender if name provided but no ID
            const lRes = await client.query(
                "INSERT INTO lenders (company_id, lender_name, type, phone) VALUES ($1, $2, $3, $4) ON CONFLICT (lender_name, company_id) DO UPDATE SET phone=EXCLUDED.phone RETURNING id",
                [companyId, lenderNameRaw, loanData.type || 'Bank', loanData.phone || null]
            );
            lenderId = lRes.rows[0].id;
        }
        // If still no lenderId, create a placeholder so the loan shows in the list
        if (!lenderId) {
            const lRes = await client.query(
                "INSERT INTO lenders (company_id, lender_name, type) VALUES ($1, $2, $3) ON CONFLICT (lender_name, company_id) DO UPDATE SET type=EXCLUDED.type RETURNING id",
                [companyId, 'Unknown Lender', 'Private']
            );
            lenderId = lRes.rows[0].id;
        }

        // 1. Insert into loans table
        const loanType = (loanData.loan_type || loanData.party_type || loanData.type || 'BANK').toUpperCase();
        const isPrivate = loanType === 'PRIVATE';
        const principal = parseFloat(loanData.principal_amount || loanData.principal || 0);

        // Use only original columns for the INSERT so it works even before schema migration runs.
        // New columns (loan_type, principal_outstanding) are updated below via a best-effort UPDATE.
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
            loanType,
            loanData.loan_direction || 'BORROWED',
            principal,
            loanData.interest_rate,
            loanData.interest_type || (isPrivate ? 'FLAT' : 'REDUCING'),
            loanData.start_date,
            isPrivate ? 0 : (loanData.duration_months || 12),
            isPrivate ? 'INDEFINITE' : (loanData.repayment_cycle || 'MONTHLY'),
            loanData.notes
        ]);

        // Best-effort: update new columns added by migration.
        // Must use SAVEPOINT — a bare .catch() inside a BEGIN tx still poisons the transaction.
        const downPayment         = parseFloat(loanData.down_payment         || 0);
        const outstandingInterest = parseFloat(loanData.outstanding_interest || 0);
        // Remaining principal after any down-payment already made on this existing loan
        const principalOutstanding = Math.max(0, principal - downPayment);

        await client.query(`SAVEPOINT sp_loan_new_cols`);
        try {
            await client.query(
                `UPDATE loans SET loan_type = $1, principal_outstanding = $2 WHERE id = $3`,
                [loanType, principalOutstanding, loanRes.rows[0].id]
            );
            await client.query(`RELEASE SAVEPOINT sp_loan_new_cols`);
        } catch (_) {
            await client.query(`ROLLBACK TO SAVEPOINT sp_loan_new_cols`);
            await client.query(`RELEASE SAVEPOINT sp_loan_new_cols`);
        }

        // Best-effort: save existing-loan extra fields if columns exist
        await client.query(`SAVEPOINT sp_loan_existing_extras`);
        try {
            await client.query(`
                ALTER TABLE loans
                    ADD COLUMN IF NOT EXISTS down_payment         NUMERIC(15,2) DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS outstanding_interest NUMERIC(15,2) DEFAULT 0
            `);
            await client.query(
                `UPDATE loans SET down_payment = $1, outstanding_interest = $2 WHERE id = $3`,
                [downPayment, outstandingInterest, loanRes.rows[0].id]
            );
            await client.query(`RELEASE SAVEPOINT sp_loan_existing_extras`);
        } catch (_) {
            await client.query(`ROLLBACK TO SAVEPOINT sp_loan_existing_extras`);
            await client.query(`RELEASE SAVEPOINT sp_loan_existing_extras`);
        }

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
            // Use ON CONFLICT so a second attempt (or race) doesn't violate unique constraint
            const newLedger = await client.query(
                `INSERT INTO ledgers (company_id, name, group_id) VALUES ($1, $2, $3)
                 ON CONFLICT (company_id, name) DO UPDATE SET group_id = EXCLUDED.group_id
                 RETURNING id`,
                [companyId, lenderName + ' (Auto)', gId]
            );
            lenderLedgerId = newLedger.rows[0].id;
        }

        let bankAccountId = loanData.bank_account_id;
        if (!bankAccountId) {
            const defaultCash = await client.query("SELECT id FROM ledgers WHERE (company_id = $1 OR company_id = 1) AND name = 'Cash' LIMIT 1", [companyId]);
            bankAccountId = defaultCash.rows[0]?.id || 1;
        }
        
        // Payments array — how the loan was received (one or more modes)
        const paymentsReceived = Array.isArray(loanData.payments) && loanData.payments.length > 0
            ? loanData.payments.filter(p => parseFloat(p.amount) > 0)
            : [{ method: loanData.payment_mode || 'BANK', amount: principal }];

        const cashAcc = await getAccountByCode(companyId, '1000');
        const loanAcc = await getAccountByCode(companyId, '2000');
        const isExisting = loanData.is_existing_loan === true || loanData.is_existing_loan === 'true';

        if (cashAcc && loanAcc && principal > 0 && !isExisting) {
            // Build debit lines — one per payment mode
            const txLines = paymentsReceived.map(p => {
                const m = (p.method || 'CASH').toUpperCase();
                const acctId = (m === 'BANK' || m === 'UPI') ? (cashAcc.id) : cashAcc.id;
                return { account_id: acctId, debit_amount: parseFloat(p.amount), credit_amount: 0, description: `Loan received via ${m}` };
            });
            // Single credit — full liability
            txLines.push({ account_id: loanAcc.id, debit_amount: 0, credit_amount: principal, description: 'Loan liability recorded' });

            await createTransactionInternal(client, {
                company_id: companyId,
                branch_id: branchId,
                transaction_date: loanData.start_date || new Date(),
                reference_type: 'LOAN_DISBURSEMENT',
                reference_id: loan.id,
                description: `Loan received from ${loanData.lender_name || 'Lender'}`,
                created_by: user.id,
                lender_id: lenderId,
                amount: principal
            }, txLines);

            // Write each mode to its ledger and save loan_receipts
            for (const p of paymentsReceived) {
                const m = (p.method || 'CASH').toUpperCase();
                const amt = parseFloat(p.amount);
                if (m === 'BANK' || m === 'UPI') {
                    await client.query(
                        `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, date)
                         VALUES ($1,$2,'LOAN_RECEIVED',$3,'in','Main Account',$4)`,
                        [companyId, branchId, amt, loanData.start_date || new Date()]
                    );
                } else {
                    await client.query(
                        `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                         VALUES ($1,$2,'LOAN_RECEIVED',$3,'in',$4)`,
                        [companyId, branchId, amt, loanData.start_date || new Date()]
                    );
                }
                // Save receipt — SAVEPOINT so a missing table doesn't abort the main tx
                await client.query(`SAVEPOINT sp_loan_receipt`);
                try {
                    await client.query(
                        `INSERT INTO loan_receipts (loan_id, method, amount) VALUES ($1,$2,$3)`,
                        [loan.id, m, amt]
                    );
                    await client.query(`RELEASE SAVEPOINT sp_loan_receipt`);
                } catch (_) {
                    await client.query(`ROLLBACK TO SAVEPOINT sp_loan_receipt`);
                    await client.query(`RELEASE SAVEPOINT sp_loan_receipt`);
                }
            }
        }

        // FIX 6: Sync lender outstanding balance after loan creation
        if (loan.lender_id) {
            await client.query(`SAVEPOINT sp_lender_sync_create`);
            try {
                await client.query(`
                    UPDATE lenders SET current_balance = (
                        SELECT COALESCE(SUM(COALESCE(principal_outstanding, principal_amount)), 0)
                        FROM loans
                        WHERE lender_id = $1 AND status = 'ACTIVE'
                          
                    ) WHERE id = $1
                `, [loan.lender_id]);
                await client.query(`RELEASE SAVEPOINT sp_lender_sync_create`);
            } catch (_) {
                await client.query(`ROLLBACK TO SAVEPOINT sp_lender_sync_create`);
                await client.query(`RELEASE SAVEPOINT sp_lender_sync_create`);
            }
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

        const paymentType = paymentData.payment_type || 'emi';
        let interestComp = parseFloat(paymentData.interest_component || 0);
        let principalComp = parseFloat(paymentData.principal_component || 0);
        const total = parseFloat(paymentData.total_amount || 0);

        // Enforce split for typed payments
        if (paymentType === 'interest') {
            interestComp = total;
            principalComp = 0;
        } else if (paymentType === 'principal') {
            principalComp = total;
            interestComp = 0;
        }

        // 1. Insert into loan_payments (SAVEPOINT guards against missing payment_type column)
        let payment;
        await client.query(`SAVEPOINT sp_loan_payment_insert`);
        try {
            const paymentRes = await client.query(`
                INSERT INTO loan_payments (
                    company_id, loan_id, payment_date, total_amount,
                    interest_component, principal_component, payment_mode, notes, payment_type
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `, [
                companyId, paymentData.loan_id, paymentData.payment_date, total,
                interestComp, principalComp, paymentData.payment_mode || 'CASH', paymentData.notes, paymentType
            ]);
            payment = paymentRes.rows[0];
            await client.query(`RELEASE SAVEPOINT sp_loan_payment_insert`);
        } catch (e) {
            await client.query(`ROLLBACK TO SAVEPOINT sp_loan_payment_insert`);
            await client.query(`RELEASE SAVEPOINT sp_loan_payment_insert`);
            // Retry without payment_type column (older schema)
            const paymentRes = await client.query(`
                INSERT INTO loan_payments (
                    company_id, loan_id, payment_date, total_amount,
                    interest_component, principal_component, payment_mode, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [
                companyId, paymentData.loan_id, paymentData.payment_date, total,
                interestComp, principalComp, paymentData.payment_mode || 'CASH', paymentData.notes
            ]);
            payment = paymentRes.rows[0];
        }

        // 2. Reduce principal_outstanding for principal payments (best-effort — column may not exist yet)
        if (principalComp > 0) {
            await client.query(`SAVEPOINT sp_principal_update`);
            try {
                await client.query(`
                    UPDATE loans SET
                        principal_outstanding = GREATEST(0, COALESCE(principal_outstanding, principal_amount) - $1),
                        status = CASE WHEN GREATEST(0, COALESCE(principal_outstanding, principal_amount) - $1) <= 0 THEN 'CLOSED' ELSE 'ACTIVE' END
                    WHERE id = $2
                `, [principalComp, paymentData.loan_id]);
                await client.query(`RELEASE SAVEPOINT sp_principal_update`);
            } catch (_) {
                await client.query(`ROLLBACK TO SAVEPOINT sp_principal_update`);
                await client.query(`RELEASE SAVEPOINT sp_principal_update`);
            }
        }

        // 3. Double-Entry (best-effort — SAVEPOINT so ledger insert doesn't block repayment)
        await client.query(`SAVEPOINT sp_loan_accounting`);
        try {
            const cashAcc = await getAccountByCode(companyId, '1000');
            const loanAcc = await getAccountByCode(companyId, '2000');
            const interestAcc = await getAccountByCode(companyId, '5000');

            if (cashAcc && loanAcc) {
                const remainder = Math.max(0, total - interestComp - principalComp);
                const txLines = [];

                if (interestComp > 0) {
                    // Use interest expense account if exists, otherwise debit loan account
                    const intAccId = interestAcc ? interestAcc.id : loanAcc.id;
                    txLines.push({ account_id: intAccId, debit_amount: interestComp, credit_amount: 0, description: 'Interest expense' });
                }
                if (principalComp > 0) {
                    txLines.push({ account_id: loanAcc.id, debit_amount: principalComp, credit_amount: 0, description: 'Principal repayment' });
                }
                if (remainder > 0) {
                    txLines.push({ account_id: loanAcc.id, debit_amount: remainder, credit_amount: 0, description: 'Loan payment (other)' });
                }
                // Credit side: cash/bank paid out
                txLines.push({ account_id: cashAcc.id, debit_amount: 0, credit_amount: total, description: 'Payment from bank/cash' });

                await createTransactionInternal(client, {
                    company_id: companyId,
                    branch_id: branchId,
                    transaction_date: paymentData.payment_date || new Date(),
                    reference_type: 'LOAN_REPAYMENT',
                    reference_id: payment.id,
                    description: `Loan repayment for loan ID: ${paymentData.loan_id}`,
                    created_by: user.id,
                    amount: total
                }, txLines);
            }
            await client.query(`RELEASE SAVEPOINT sp_loan_accounting`);
        } catch (accErr) {
            console.warn('[loan repayment] accounting entry skipped:', accErr.message);
            await client.query(`ROLLBACK TO SAVEPOINT sp_loan_accounting`);
            await client.query(`RELEASE SAVEPOINT sp_loan_accounting`);
        }

        // 4. Update cash/bank ledger (best-effort — SAVEPOINT so schema mismatch doesn't block repayment)
        await client.query(`SAVEPOINT sp_loan_ledger`);
        try {
            const payMode = (paymentData.payment_mode || 'CASH').toUpperCase();
            const cashAmt = parseFloat(paymentData.cash_amount || 0);
            const bankAmt = parseFloat(paymentData.bank_amount || 0);

            if (cashAmt > 0 || bankAmt > 0) {
                // Split payment
                if (cashAmt > 0) {
                    await client.query(
                        `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                         VALUES ($1, $2, 'LOAN_REPAYMENT', $3, 'out', $4)`,
                        [companyId, branchId, cashAmt, paymentData.payment_date]
                    );
                }
                if (bankAmt > 0) {
                    await client.query(
                        `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, date)
                         VALUES ($1, $2, 'LOAN_REPAYMENT', $3, 'out', 'Main Account', $4)`,
                        [companyId, branchId, bankAmt, paymentData.payment_date]
                    );
                }
            } else if (payMode === 'BANK' || payMode === 'UPI') {
                await client.query(
                    `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, date)
                     VALUES ($1, $2, 'LOAN_REPAYMENT', $3, 'out', 'Main Account', $4)`,
                    [companyId, branchId, total, paymentData.payment_date]
                );
            } else {
                await client.query(
                    `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
                     VALUES ($1, $2, 'LOAN_REPAYMENT', $3, 'out', $4)`,
                    [companyId, branchId, total, paymentData.payment_date]
                );
            }
            await client.query(`RELEASE SAVEPOINT sp_loan_ledger`);
        } catch (ledgerErr) {
            console.warn('[loan repayment] cash/bank ledger update skipped:', ledgerErr.message);
            await client.query(`ROLLBACK TO SAVEPOINT sp_loan_ledger`);
            await client.query(`RELEASE SAVEPOINT sp_loan_ledger`);
        }

        // FIX 6: Sync lender outstanding balance after every repayment
        await client.query(`SAVEPOINT sp_lender_sync_repay`);
        try {
            const loanRow = await client.query(`SELECT lender_id FROM loans WHERE id = $1`, [paymentData.loan_id]);
            const lenderId = loanRow.rows[0]?.lender_id;
            if (lenderId) {
                await client.query(`
                    UPDATE lenders SET current_balance = (
                        SELECT COALESCE(SUM(COALESCE(principal_outstanding, principal_amount)), 0)
                        FROM loans
                        WHERE lender_id = $1 AND status = 'ACTIVE'
                          
                    ) WHERE id = $1
                `, [lenderId]);
            }
            await client.query(`RELEASE SAVEPOINT sp_lender_sync_repay`);
        } catch (_) {
            await client.query(`ROLLBACK TO SAVEPOINT sp_lender_sync_repay`);
            await client.query(`RELEASE SAVEPOINT sp_lender_sync_repay`);
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
