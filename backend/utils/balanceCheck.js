/**
 * balanceCheck.js
 * Reusable balance validation for all outgoing payment routes.
 * Uses cash_ledger / bank_ledger (direction: 'in'/'out') as source of truth.
 *
 * Returns:
 *   { sufficient, currentBalance, accountName, shortfall, message }
 */

export async function checkSufficientBalance(client, companyId, paymentMode, requiredAmount) {
    const mode   = (paymentMode || 'cash').toLowerCase();
    const amount = Number(requiredAmount) || 0;

    // Personal account → skip balance check (no impact on business ledger)
    if (mode === 'personal') {
        return { sufficient: true, currentBalance: 0, accountName: 'Personal', shortfall: 0, message: '✅ Personal account — no balance check' };
    }

    let currentBalance = 0;
    let accountName    = '';

    if (mode === 'cash') {
        const r = await client.query(
            `SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END), 0) AS balance
             FROM cash_ledger WHERE company_id = $1`,
            [companyId]
        );
        currentBalance = Number(r.rows[0].balance) || 0;
        accountName    = 'Cash';

    } else {
        // BANK or UPI → bank_ledger
        const r = await client.query(
            `SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END), 0) AS balance
             FROM bank_ledger WHERE company_id = $1`,
            [companyId]
        );
        currentBalance = Number(r.rows[0].balance) || 0;
        accountName    = mode === 'upi' ? 'Bank (UPI)' : 'Bank';
    }

    const sufficient = currentBalance >= amount;
    const shortfall  = sufficient ? 0 : amount - currentBalance;

    const fmt = (n) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

    return {
        sufficient,
        currentBalance,
        accountName,
        shortfall,
        message: sufficient
            ? `✅ Sufficient ${accountName} balance`
            : `❌ Insufficient ${accountName} balance!\nAvailable: ₹${fmt(currentBalance)}\nRequired:  ₹${fmt(amount)}\nShortfall: ₹${fmt(shortfall)}`,
    };
}
