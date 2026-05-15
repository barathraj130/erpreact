import * as db from '../database/pg.js';

/**
 * BROKER MASTER SERVICE
 */

export const createBroker = async (user, brokerData) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const companyId = user.active_company_id;

        // 1. Get or Create Group ID for Broker Payables
        let groupRes = await client.query("SELECT id FROM ledger_groups WHERE (company_id = $1 OR company_id = 1) AND name = 'Sundry Creditors'", [companyId]);
        if (!groupRes.rows[0]) {
            const insertGroup = await client.query(
                "INSERT INTO ledger_groups (company_id, name, nature, is_default) VALUES ($1, 'Sundry Creditors', 'Liability', TRUE) RETURNING id",
                [companyId]
            );
            groupRes = insertGroup;
        }
        const groupId = groupRes.rows[0].id;

        // 2. Insert Broker
        const sql = `
            INSERT INTO brokers (company_id, name, phone, address, broker_type, commission_rate)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const res = await client.query(sql, [
            companyId, brokerData.name, brokerData.phone, brokerData.address, 
            brokerData.broker_type || 'BOTH', brokerData.commission_rate || 0
        ]);
        const broker = res.rows[0];

        // 3. Create Ledger for this specific broker (if not exists)
        const ledgerName = broker.name + ' - Commission Payable';
        const ledgerCheck = await client.query("SELECT id FROM ledgers WHERE company_id = $1 AND name = $2", [companyId, ledgerName]);
        
        if (!ledgerCheck.rows[0]) {
            await client.query(
                `INSERT INTO ledgers (company_id, name, group_id, opening_balance, is_dr) VALUES ($1, $2, $3, $4, $5)`,
                [companyId, ledgerName, groupId, 0, 0]
            );
        }

        await client.query('COMMIT');
        return broker;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

export const getBrokers = async (companyId) => {
    return await db.pgAll('SELECT * FROM brokers WHERE company_id = $1 ORDER BY name ASC', [companyId]);
};

/**
 * COMMISSION RECORDING
 */

export const recordCommission = async (client, user, data) => {
    const companyId = user.active_company_id;
    const branchId = user.branch_id || 1;

    if (!data.broker_id || !data.line_items || data.line_items.length === 0) return 0;

    // 1. Fetch broker info
    const brokerRes = await client.query('SELECT * FROM brokers WHERE id = $1', [data.broker_id]);
    const broker = brokerRes.rows[0];
    if (!broker) return 0;

    // Fetch product rates for this broker
    const ratesRes = await client.query('SELECT product_id, commission_percentage FROM broker_product_rates WHERE broker_id = $1', [data.broker_id]);
    const productRates = {};
    ratesRes.rows.forEach(r => { productRates[r.product_id] = parseFloat(r.commission_percentage); });

    let totalCommissionAmount = 0;
    const lineBreakdown = [];

    // Calculate commission per product line
    for (const item of data.line_items) {
        const itemQty = parseFloat(item.quantity || item.qty || 0);
        const itemPrice = parseFloat(item.unit_price || item.price || item.rate || 0);
        const lineTotal = itemQty * itemPrice;

        // Rate precedence: line item specific -> product specific -> broker default
        let rate = item.commission_rate !== undefined ? parseFloat(item.commission_rate) : null;
        if (rate === null) {
            rate = productRates[item.product_id] !== undefined ? productRates[item.product_id] : parseFloat(broker.commission_rate || 0);
        }

        const lineCommission = (lineTotal * rate) / 100;
        totalCommissionAmount += lineCommission;

        lineBreakdown.push({
            product_id: item.product_id,
            qty: itemQty,
            unit_price: itemPrice,
            line_total: lineTotal,
            commission_rate: rate,
            commission_amount: lineCommission
        });
    }

    if (totalCommissionAmount <= 0) return 0;

    // 2. Create Transaction
    const txSql = `
        INSERT INTO transactions (company_id, branch_id, transaction_date, reference_type, reference_id, description)
        VALUES ($1, $2, $3, 'BROKER_COMMISSION', $4, $5)
        RETURNING id
    `;
    const txRes = await client.query(txSql, [
        companyId, branchId, data.date, data.bill_id, `Commission for ${data.bill_type} bill: #${data.bill_number}`
    ]);
    const transactionId = txRes.rows[0].id;

    // 3. Double Entry Ledgers
    // Get Expense Ledger
    let expGroupRes = await client.query("SELECT id FROM ledger_groups WHERE (company_id = $1 OR company_id = 1) AND name = 'Direct Expenses'", [companyId]);
    if (!expGroupRes.rows[0]) {
        const insertExpGroup = await client.query("INSERT INTO ledger_groups (company_id, name, nature, is_default) VALUES ($1, 'Direct Expenses', 'Expense', TRUE) RETURNING id", [companyId]);
        expGroupRes = insertExpGroup;
    }
    const expGroupId = expGroupRes.rows[0].id;

    let expLedgerRes = await client.query("SELECT id FROM ledgers WHERE company_id = $1 AND name = 'Broker Commission Expense'", [companyId]);
    if (!expLedgerRes.rows[0]) {
        const insertExpLedger = await client.query("INSERT INTO ledgers (company_id, name, group_id, opening_balance, is_dr) VALUES ($1, 'Broker Commission Expense', $2, 0, 1) RETURNING id", [companyId, expGroupId]);
        expLedgerRes = insertExpLedger;
    }
    const expenseLedgerId = expLedgerRes.rows[0].id;

    // Get Broker Payable Ledger
    const payableLedgerRes = await client.query("SELECT id FROM ledgers WHERE company_id = $1 AND name = $2", [companyId, broker.name + ' - Commission Payable']);
    let payableLedgerId = payableLedgerRes.rows[0] ? payableLedgerRes.rows[0].id : null;

    if (!payableLedgerId) {
        let credGroupRes = await client.query("SELECT id FROM ledger_groups WHERE (company_id = $1 OR company_id = 1) AND name = 'Sundry Creditors'", [companyId]);
        payableLedgerId = (await client.query("INSERT INTO ledgers (company_id, name, group_id, opening_balance, is_dr) VALUES ($1, $2, $3, 0, 0) RETURNING id", [companyId, broker.name + ' - Commission Payable', credGroupRes.rows[0].id])).rows[0].id;
    }

    // Debit: Commission Expense
    await client.query(`
        INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, description)
        VALUES ($1, $2, $3, 0, 'Commission Expense for bill')
    `, [transactionId, expenseLedgerId, totalCommissionAmount]);

    // Credit: Broker Payable
    await client.query(`
        INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, description)
        VALUES ($1, $2, 0, $3, $4)
    `, [transactionId, payableLedgerId, totalCommissionAmount, `Payable to Broker: ${broker.name}`]);

    // 4. Record in broker_commissions
    await client.query(`
        INSERT INTO broker_commissions (company_id, broker_id, transaction_id, bill_type, bill_id, bill_amount, commission_amount, line_items_breakdown)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [companyId, broker.id, transactionId, data.bill_type, data.bill_id, data.bill_amount, totalCommissionAmount, JSON.stringify(lineBreakdown)]);

    return totalCommissionAmount;
};

/**
 * BROKER PAYMENTS
 */

export const recordBrokerPayment = async (user, paymentData) => {
    const client = await db.getClient();
    const companyId = user.active_company_id;
    const branchId = user.branch_id || 1;

    try {
        await client.query('BEGIN');

        // Fetch Broker Ledger ID
        const brokerRes = await client.query('SELECT name FROM brokers WHERE id = $1', [paymentData.broker_id]);
        const payableLedgerRes = await client.query("SELECT id FROM ledgers WHERE company_id = $1 AND name = $2", [companyId, brokerRes.rows[0].name + ' - Commission Payable']);
        const payableLedgerId = payableLedgerRes.rows[0].id;

        // 1. Create Transaction
        const txSql = `
            INSERT INTO transactions (company_id, branch_id, transaction_date, reference_type, reference_id, description)
            VALUES ($1, $2, $3, 'BROKER_PAYMENT', $4, $5)
            RETURNING id
        `;
        const txRes = await client.query(txSql, [
            companyId, branchId, paymentData.payment_date, paymentData.broker_id, `Payment to Broker: ${brokerRes.rows[0].name}`
        ]);
        const transactionId = txRes.rows[0].id;

        // 2. Transaction Lines
        // Debit: Broker Payable (Liability reduction)
        await client.query(`
            INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, description)
            VALUES ($1, $2, $3, 0, 'Broker commission paid')
        `, [transactionId, payableLedgerId, paymentData.amount]);

        // Credit: Cash/Bank (Asset reduction)
        await client.query(`
            INSERT INTO transaction_lines (transaction_id, account_id, debit_amount, credit_amount, description)
            VALUES ($1, $2, 0, $3, 'Payment from bank/cash')
        `, [transactionId, paymentData.bank_account_id || 1, paymentData.amount]);

        await client.query('COMMIT');
        return { success: true, transactionId };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

/**
 * REPORTS & LEDGER
 */

export const getBrokerLedger = async (companyId, brokerId) => {
    const sql = `
        SELECT 
            t.transaction_date as date,
            t.description,
            bc.bill_type,
            bc.bill_amount,
            tl.debit_amount as paid,
            tl.credit_amount as earned
        FROM transactions t
        JOIN transaction_lines tl ON t.id = tl.transaction_id
        LEFT JOIN broker_commissions bc ON t.id = bc.transaction_id
        WHERE t.company_id = $1 
          AND (bc.broker_id = $2 OR (t.reference_type = 'BROKER_PAYMENT' AND t.reference_id = $2))
          AND tl.account_id IN (SELECT id FROM ledgers WHERE name LIKE '% - Commission Payable' AND company_id = $1)
        ORDER BY t.transaction_date DESC, t.id DESC
    `;
    return await db.pgAll(sql, [companyId, brokerId]);
};

export const getBrokerSummary = async (companyId) => {
    const sql = `
        SELECT 
            b.id, b.name, b.broker_type, b.commission_rate as default_rate,
            COALESCE(SUM(bc.commission_amount), 0) as total_earned,
            COALESCE((
                SELECT SUM(tl.debit_amount) 
                FROM transactions t 
                JOIN transaction_lines tl ON t.id = tl.transaction_id
                JOIN ledgers l ON tl.account_id = l.id
                WHERE t.company_id = $1 AND t.reference_type = 'BROKER_PAYMENT' AND t.reference_id = b.id AND l.name = (b.name || ' - Commission Payable')
            ), 0) as total_paid
        FROM brokers b
        LEFT JOIN broker_commissions bc ON b.id = bc.broker_id
        WHERE b.company_id = $1
        GROUP BY b.id
    `;
    return await db.pgAll(sql, [companyId]);
};

export const getBrokerProductRates = async (companyId, brokerId) => {
    const sql = `
        SELECT r.id, r.product_id, p.name as product_name, r.commission_percentage 
        FROM broker_product_rates r
        JOIN products p ON r.product_id = p.id
        WHERE r.broker_id = $1 AND r.company_id = $2
    `;
    return await db.pgAll(sql, [brokerId, companyId]);
};

export const setBrokerProductRate = async (companyId, brokerId, productId, percentage) => {
    const checkSql = `SELECT id FROM broker_product_rates WHERE broker_id = $1 AND product_id = $2`;
    const exists = await db.pgGet(checkSql, [brokerId, productId]);

    if (exists) {
        return await db.pgQuery(`UPDATE broker_product_rates SET commission_percentage = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [percentage, exists.id]);
    } else {
        return await db.pgQuery(`INSERT INTO broker_product_rates (company_id, broker_id, product_id, commission_percentage) VALUES ($1, $2, $3, $4) RETURNING *`, [companyId, brokerId, productId, percentage]);
    }
};

export const removeBrokerProductRate = async (companyId, id) => {
    await db.pgQuery(`DELETE FROM broker_product_rates WHERE id = $1 AND company_id = $2`, [id, companyId]);
};
