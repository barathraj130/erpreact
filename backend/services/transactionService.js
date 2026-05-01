// backend/services/transactionService.js
import * as db from '../database/pg.js';

/**
 * Handles the logic for any financial transaction in the system.
 * This is the SINGLE SOURCE OF TRUTH for all money movements.
 * 
 * @param {Object} txData - Transaction fields (type, amount, mode, company_id, etc.)
 * @param {Object} user - Authenticated user info
 */
export const processTransaction = async (txData, user) => {
    const client = await db.getClient();
    const companyId = user.active_company_id;
    const branchId = user.branch_id || 1;

    try {
        await client.query('BEGIN');

        // 1. Insert into Master Transactions table
        const txSql = `
            INSERT INTO transactions (
                company_id, branch_id, user_id, type, amount, 
                description, date, category, reference_type, reference_id,
                proof_url, bank_name, bank_ref_no, expense_category,
                created_at, transaction_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $7)
            RETURNING id
        `;
        const txParams = [
            companyId,
            branchId,
            user.id,
            txData.type,
            txData.amount,
            txData.description,
            txData.date,
            txData.category || txData.type,
            txData.reference_type,
            txData.reference_id,
            txData.proof_url || null,
            txData.bank_name || null,
            txData.bank_ref_no || null,
            txData.expense_category || null
        ];
        const txRes = await client.query(txSql, txParams);
        const transactionId = txRes.rows[0].id;

        // 2. Handle Cash/Bank Ledger Impact
        const direction = ['CUSTOMER_PAYMENT', 'RECEIPT'].includes(txData.type) ? 'in' : 'out';
        const mode = (txData.mode || 'CASH').toUpperCase();

        if (mode === 'CASH') {
            await client.query(`
                INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date, reference_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [companyId, branchId, txData.type, txData.amount, direction, txData.date, transactionId]);
        } else {
            await client.query(`
                INSERT INTO bank_ledger (
                    company_id, branch_id, bank_account_id, source, amount, direction, 
                    bank_name, transaction_id, date
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                companyId, 
                branchId, 
                txData.bank_account_id || null, // Capture specific bank account
                txData.type, 
                txData.amount, 
                direction, 
                txData.bank_name || 'Primary Bank', 
                txData.bank_ref_no || transactionId, 
                txData.date
            ]);
        }

        // 3. Handle Module Specific Ledger Impacts
        switch (txData.type) {
            case 'CUSTOMER_PAYMENT':
                if (txData.reference_id) {
                    await client.query(`
                        INSERT INTO customer_ledger (customer_id, company_id, date, type, description, credit, branch_id)
                        VALUES ($1, $2, $3, 'PAYMENT', $4, $5, $6)
                    `, [txData.reference_id, companyId, txData.date, txData.description, txData.amount, branchId]);
                }
                break;

            case 'EXPENSE_PAYMENT':
                // Create mandatory entry in expenses table
                await client.query(`
                    INSERT INTO expenses (transaction_id, company_id, branch_id, category, description, amount, expense_date)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [transactionId, companyId, branchId, txData.expense_category || 'General', txData.description, txData.amount, txData.date]);
                break;

            case 'SALARY_PAYMENT':
                if (txData.reference_id) {
                    await client.query(`
                        UPDATE salary_payments 
                        SET status = 'PAID', paid_date = $1, transaction_id = $2
                        WHERE id = $3 AND company_id = $4
                    `, [txData.date, transactionId, txData.reference_id, companyId]);
                }
                break;

            case 'ADVANCE_PAYMENT':
                if (txData.reference_id) {
                    await client.query(`
                        INSERT INTO employee_advances (employee_id, company_id, branch_id, amount, advance_date, description, status)
                        VALUES ($1, $2, $3, $4, $5, $6, 'Pending')
                    `, [txData.reference_id, companyId, branchId, txData.amount, txData.date, txData.description]);
                }
                break;

            case 'REFUND_PAYMENT':
                if (txData.reference_id) {
                    await client.query(`
                        INSERT INTO customer_ledger (customer_id, company_id, date, type, description, debit, branch_id)
                        VALUES ($1, $2, $3, 'REFUND', $4, $5, $6)
                    `, [txData.reference_id, companyId, txData.date, txData.description, txData.amount, branchId]);
                }
                break;
        }

        await client.query('COMMIT');
        return { success: true, transactionId };

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Transaction Processing Error:', err);
        throw err;
    } finally {
        client.release();
    }
};
