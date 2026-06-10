/**
 * Utility to auto-record proprietor transactions when personal account is used
 * for business payments. Inserts CAPITAL_INTRO entries into proprietor_transactions.
 *
 * reference_type values used for report filtering:
 *   PURCHASE_BILL, SALARY, SALARY_ADVANCE, DAILY_WAGE, WEEKLY_SALARY
 */

/**
 * Record that the proprietor personally funded a business expense (capital introduction).
 * @param {object} client - pg transaction client
 * @param {object} opts
 * @param {number} opts.companyId
 * @param {number} opts.branchId
 * @param {number} opts.userId - created_by
 * @param {number} opts.amount
 * @param {string} opts.description - human-readable note
 * @param {string} [opts.referenceType] - category for report filtering (PURCHASE_BILL, SALARY, etc.)
 * @param {number} [opts.referenceId] - optional linked record id
 */
export async function recordProprietorCapital(client, { companyId, branchId, userId, amount, description, referenceType, referenceId }) {
    await client.query(
        `INSERT INTO proprietor_transactions
             (company_id, branch_id, transaction_type, amount, payment_mode, transaction_date, notes, created_by, reference_type, reference_id)
         VALUES ($1, $2, 'CAPITAL_INTRO', $3, 'PERSONAL_ACCOUNT', CURRENT_DATE, $4, $5, $6, $7)`,
        [companyId, branchId, amount, `[Auto] ${description}`, userId, referenceType || null, referenceId || null]
    );
}
