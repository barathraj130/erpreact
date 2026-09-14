// backend/utils/employeeRequestActions.js
//
// Turns an approved Team Hub request (hub_forms: advance_request / expense_claim)
// into the same real records the existing admin-facing flows create — so an
// employee-submitted request that gets approved actually shows up in
// salary_advances / expense_entries and the books, instead of just flipping a
// status flag. Mirrors hrRoutes.js's POST /advance and expenseEntryRoutes.js's
// postExpenseLedgerEntry as closely as possible; kept separate rather than
// importing from those router files to avoid touching already-working code.
import { checkSufficientBalance } from './balanceCheck.js';
import { createTransactionInternal, getAccountByCode } from './accountingEngine.js';

/**
 * Creates a real salary advance for an employee, with the same ledger +
 * accounting effects as hrRoutes.js's POST /advance.
 * @returns {number} the new salary_advances.id
 */
export async function createAdvanceForEmployee(client, { companyId, branchId, employeeId, amount, date, reason, paymentMode, userId }) {
    const mode = (paymentMode || 'CASH').toUpperCase();
    const advanceDate = date || new Date().toISOString().split('T')[0];

    if (mode === 'CASH' || mode === 'BANK' || mode === 'UPI') {
        const chk = await checkSufficientBalance(client, companyId, mode.toLowerCase(), amount);
        if (!chk.sufficient) throw new Error(chk.message);
    }

    const advResult = await client.query(
        `INSERT INTO salary_advances
         (company_id, branch_id, employee_id, amount, advance_date, reason, current_balance, payment_method)
         VALUES ($1,$2,$3,$4,$5,$6,$4,$7) RETURNING id`,
        [companyId, branchId || null, employeeId, amount, advanceDate, reason || null, mode]
    );
    const advanceId = advResult.rows[0].id;

    if (mode === 'PROPRIETOR') {
        const { recordProprietorCapital } = await import('./proprietorLedger.js');
        await recordProprietorCapital(client, {
            companyId, branchId, userId, amount,
            description: `Salary Advance – employee #${employeeId} (via Team Hub request)`,
            referenceType: 'SALARY_ADVANCE',
        });
    } else if (mode === 'CASH') {
        await client.query(
            `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date, reference_id)
             VALUES ($1,$2,'salary_advance',$3,'out',$4,$5)`,
            [companyId, branchId, amount, advanceDate, advanceId]
        );
    } else {
        await client.query(
            `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, bank_name, transaction_id, date, reference_id)
             VALUES ($1,$2,'salary_advance',$3,'out',$4,$5,$6,$7)`,
            [companyId, branchId, amount, mode, `ADV-${advanceId}`, advanceDate, advanceId]
        );
    }

    // Best-effort double-entry: Debit Employee Advances (1150), Credit Cash/Bank/Proprietor's Capital (3000)
    try {
        const advanceAccount = await getAccountByCode(companyId, '1150');
        const creditAccount = await getAccountByCode(companyId, mode === 'PROPRIETOR' ? '3000' : (mode === 'CASH' ? '1000' : '1200'));
        if (advanceAccount && creditAccount) {
            await client.query('SAVEPOINT sp_hub_advance_accounting');
            try {
                await createTransactionInternal(client, {
                    company_id: companyId, branch_id: branchId, transaction_date: advanceDate,
                    reference_type: 'SALARY_ADVANCE', reference_id: advanceId,
                    description: `Salary Advance – employee #${employeeId} (via Team Hub request)`,
                    created_by: userId, bill_purpose: 'real',
                }, [
                    { account_id: advanceAccount.id, debit_amount: amount, credit_amount: 0, description: 'Advance via Team Hub request' },
                    { account_id: creditAccount.id, debit_amount: 0, credit_amount: amount, description: 'Advance via Team Hub request' },
                ]);
                await client.query('RELEASE SAVEPOINT sp_hub_advance_accounting');
            } catch (e) {
                await client.query('ROLLBACK TO SAVEPOINT sp_hub_advance_accounting');
                await client.query('RELEASE SAVEPOINT sp_hub_advance_accounting');
                console.warn('[employeeRequestActions] advance accounting skipped:', e.message);
            }
        }
    } catch (e) {
        console.warn('[employeeRequestActions] advance accounting skipped:', e.message);
    }

    return advanceId;
}

// Best-effort category mapping from the Team Hub expense_claim form's free-text
// "expense_type" dropdown to expenseEntryRoutes.js's fixed category keys.
const EXPENSE_TYPE_TO_CATEGORY = {
    travel: 'transport',
    food: 'food',
    communication: 'misc',
    stationery: 'printing',
    other: 'misc',
};

/**
 * Creates a real expense entry for an employee's claim, with the same
 * ledger + accounting effects as expenseEntryRoutes.js.
 * @returns {number} the new expense_entries.id
 */
export async function createExpenseForEmployee(client, { companyId, branchId, employeeName, expenseType, amount, date, description, paymentMode, userId }) {
    const mode = (paymentMode || 'cash').toLowerCase();
    const expenseDate = date || new Date().toISOString().split('T')[0];
    const category = EXPENSE_TYPE_TO_CATEGORY[(expenseType || '').toLowerCase()] || 'misc';

    let cashLedgerRef = null;
    let bankLedgerRef = null;
    if (mode === 'cash') {
        const chk = await checkSufficientBalance(client, companyId, 'cash', amount);
        if (!chk.sufficient) throw new Error(chk.message);
        const r = await client.query(
            `INSERT INTO cash_ledger (company_id, branch_id, source, amount, direction, date)
             VALUES ($1,$2,'EXPENSE',$3,'out',$4) RETURNING id`,
            [companyId, branchId || 1, amount, expenseDate]
        );
        cashLedgerRef = r.rows[0]?.id || null;
    } else if (mode === 'bank' || mode === 'upi') {
        const chk = await checkSufficientBalance(client, companyId, mode, amount);
        if (!chk.sufficient) throw new Error(chk.message);
        const r = await client.query(
            `INSERT INTO bank_ledger (company_id, branch_id, source, amount, direction, date)
             VALUES ($1,$2,'EXPENSE',$3,'out',$4) RETURNING id`,
            [companyId, branchId || 1, amount, expenseDate]
        );
        bankLedgerRef = r.rows[0]?.id || null;
    }
    // 'personal' → no ledger entry, company cash/bank untouched (same as expenseEntryRoutes.js)

    const entryRes = await client.query(
        `INSERT INTO expense_entries
            (company_id, branch_id, reference_number, expense_date, category, sub_category,
             amount, payment_mode, paid_to, description, status, recorded_by, cash_ledger_ref, bank_ledger_ref,
             approved_by, approved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'approved',$11,$12,$13,$11,NOW())
         RETURNING id`,
        [companyId, branchId || 1, `HUB-${Date.now()}`, expenseDate, category, expenseType || 'Other',
         amount, mode, employeeName || 'Employee', description || `Expense claim: ${expenseType || 'Other'}`,
         userId, cashLedgerRef, bankLedgerRef]
    );
    const entryId = entryRes.rows[0].id;

    if (mode === 'cash' || mode === 'bank' || mode === 'upi') {
        try {
            const expenseAccount = await getAccountByCode(companyId, '5900');
            const creditAccount = await getAccountByCode(companyId, mode === 'cash' ? '1000' : '1200');
            if (expenseAccount && creditAccount) {
                await client.query('SAVEPOINT sp_hub_expense_accounting');
                try {
                    await createTransactionInternal(client, {
                        company_id: companyId, branch_id: branchId || 1, transaction_date: expenseDate,
                        reference_type: 'EXPENSE_ENTRY', reference_id: entryId,
                        description: `Expense claim via Team Hub – ${expenseType || 'Other'}`,
                        created_by: userId, bill_purpose: 'real',
                    }, [
                        { account_id: expenseAccount.id, debit_amount: amount, credit_amount: 0, description: 'Expense via Team Hub request' },
                        { account_id: creditAccount.id, debit_amount: 0, credit_amount: amount, description: 'Expense via Team Hub request' },
                    ]);
                    await client.query('RELEASE SAVEPOINT sp_hub_expense_accounting');
                } catch (e) {
                    await client.query('ROLLBACK TO SAVEPOINT sp_hub_expense_accounting');
                    await client.query('RELEASE SAVEPOINT sp_hub_expense_accounting');
                    console.warn('[employeeRequestActions] expense accounting skipped:', e.message);
                }
            }
        } catch (e) {
            console.warn('[employeeRequestActions] expense accounting skipped:', e.message);
        }
    }

    return entryId;
}
