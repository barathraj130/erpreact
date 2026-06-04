import * as db from "../database/pg.js";

const CUSTOMER_LEDGER_GROUP = "Sundry Debtors";

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function safeJson(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function normalizeMethod(value) {
  return String(value || "").trim().toUpperCase();
}

function isReturnInvoice(invoiceType) {
  return normalizeMethod(invoiceType) === "SALES_RETURN";
}

export async function getCustomerById(client, customerId, companyId) {
  const res = await client.query(
    `SELECT id, username, role, initial_balance, meta
     FROM users
     WHERE id = $1 AND company_id = $2 AND role IN ('user', 'customer')`,
    [customerId, companyId],
  );
  return res.rows[0];
}

export async function ensureCustomerLedgerGroup(client, companyId) {
  const existing = await client.query(
    `SELECT id FROM ledger_groups WHERE company_id = $1 AND name = $2 LIMIT 1`,
    [companyId, CUSTOMER_LEDGER_GROUP],
  );

  if (existing.rows[0]) return existing.rows[0].id;

  const created = await client.query(
    `INSERT INTO ledger_groups (company_id, name, nature, is_default)
     VALUES ($1, $2, 'Asset', TRUE)
     RETURNING id`,
    [companyId, CUSTOMER_LEDGER_GROUP],
  );

  return created.rows[0].id;
}

export async function ensureCustomerLedgerMetadata(client, customerId, companyId) {
  const customer = await getCustomerById(client, customerId, companyId);
  if (!customer) throw new Error("Customer not found");

  const meta = safeJson(customer.meta);
  const groupId = await ensureCustomerLedgerGroup(client, companyId);

  let ledgerId = toNumber(meta.customer_ledger_id, null);
  const ledgerName = `${customer.username} [Customer #${customer.id}]`;

  if (ledgerId) {
    await client.query(
      `UPDATE ledgers SET name = $1, group_id = $2 WHERE id = $3 AND company_id = $4`,
      [ledgerName, groupId, ledgerId, companyId],
    );
  } else {
    const existingLedger = await client.query(
      `SELECT id FROM ledgers WHERE company_id = $1 AND name = $2 LIMIT 1`,
      [companyId, ledgerName],
    );

    if (existingLedger.rows[0]) {
      ledgerId = existingLedger.rows[0].id;
    } else {
      const createdLedger = await client.query(
        `INSERT INTO ledgers (company_id, name, group_id, opening_balance, is_dr)
         VALUES ($1, $2, $3, 0, 1)
         RETURNING id`,
        [companyId, ledgerName, groupId],
      );
      ledgerId = createdLedger.rows[0].id;
    }
  }

  const openingBalance = toNumber(meta.customer_opening_balance, toNumber(customer.initial_balance));
  const nextMeta = {
    ...meta,
    customer_ledger_id: ledgerId,
    customer_opening_balance: openingBalance,
  };

  await client.query(`UPDATE users SET meta = $1 WHERE id = $2`, [JSON.stringify(nextMeta), customerId]);

  return { customer: { ...customer, meta: nextMeta }, ledgerId, openingBalance };
}

async function getSalesReturnRows(companyId, customerId) {
  try {
    return await db.pgAll(
      `SELECT
         3000000000 + sr.id AS id,
         sr.return_date            AS date,
         'RETURN'                  AS type,
         'CREDIT_NOTE'             AS category,
         sr.total_amount           AS amount,
         'Sales Return ' || sr.return_number ||
           CASE WHEN sr.original_invoice_number IS NOT NULL
                THEN ' (against ' || sr.original_invoice_number || ')'
                ELSE '' END       AS description,
         sr.original_invoice_id   AS related_invoice_id,
         sr.original_invoice_number AS invoice_number,
         NULL::TEXT               AS payment_method,
         NULL::TEXT               AS bank_name,
         NULL::TEXT               AS bank_transaction_id,
         NULL::TIMESTAMP          AS bank_timestamp,
         sr.created_at            AS sort_created_at
       FROM sales_returns sr
       WHERE sr.company_id = $1 AND sr.customer_id = $2`,
      [companyId, customerId],
    );
  } catch (e) {
    return []; // table may not exist yet
  }
}

async function getCustomerDerivedRows(companyId, customerId, filters = {}) {
  const params = [companyId, customerId];
  const invoiceConditions = ["i.company_id = $1", "i.customer_id = $2", "COALESCE(i.is_deleted, false) = false"];
  const paymentConditions = ["i.company_id = $1", "i.customer_id = $2", "COALESCE(i.is_deleted, false) = false"];
  let idx = 3;

  if (filters.start_date) {
    invoiceConditions.push(`i.invoice_date >= $${idx}`);
    paymentConditions.push(`p.payment_date >= $${idx}`);
    params.push(filters.start_date);
    idx += 1;
  }

  if (filters.end_date) {
    invoiceConditions.push(`i.invoice_date <= $${idx}`);
    paymentConditions.push(`p.payment_date <= $${idx}`);
    params.push(filters.end_date);
    idx += 1;
  }

  if (filters.payment_method) {
    paymentConditions.push(`UPPER(COALESCE(p.payment_method, '')) = $${idx}`);
    params.push(normalizeMethod(filters.payment_method));
    idx += 1;
  }

  // Direct customer payments recorded via Transactions page
  const txConditions = ["t.company_id = $1", "t.reference_id = $2", "t.type = 'CUSTOMER_PAYMENT'"];
  if (filters.start_date) txConditions.push(`t.transaction_date >= $3`);
  if (filters.end_date)   txConditions.push(`t.transaction_date <= $${filters.start_date ? 4 : 3}`);

  const rows = await db.pgAll(
    `SELECT * FROM (
       SELECT
         i.id,
         i.invoice_date AS date,
         CASE WHEN UPPER(COALESCE(i.invoice_type, '')) = 'SALES_RETURN' THEN 'RETURN' ELSE 'INVOICE' END AS type,
         CASE WHEN UPPER(COALESCE(i.invoice_type, '')) = 'SALES_RETURN' THEN 'CREDIT_NOTE' ELSE 'SALES' END AS category,
         CASE
           WHEN UPPER(COALESCE(i.invoice_type,'')) IN ('NON_TAX_INVOICE','RETAIL_SALE','GIFTED_ITEM','NSB_INVOICE')
           THEN COALESCE(i.sub_total, i.total_amount)
           ELSE COALESCE(
             (SELECT SUM(li.line_total) FROM invoice_line_items li WHERE li.invoice_id = i.id),
             i.total_amount
           )
         END AS amount,
         CASE
           WHEN UPPER(COALESCE(i.invoice_type, '')) = 'SALES_RETURN' THEN 'Credit note #' || i.invoice_number
           ELSE 'Invoice #' || i.invoice_number
         END AS description,
         i.id AS related_invoice_id,
         i.invoice_number,
         NULL::TEXT AS payment_method,
         NULL::TEXT AS bank_name,
         NULL::TEXT AS bank_transaction_id,
         NULL::TIMESTAMP AS bank_timestamp,
         i.created_at AS sort_created_at
       FROM invoices i
       WHERE ${invoiceConditions.join(" AND ")}

       UNION ALL

       SELECT
         1000000000 + p.id AS id,
         p.payment_date AS date,
         'RECEIPT' AS type,
         'PAYMENT' AS category,
         p.amount AS amount,
         'Payment for Invoice #' || i.invoice_number AS description,
         i.id AS related_invoice_id,
         i.invoice_number,
         UPPER(COALESCE(p.payment_method, '')) AS payment_method,
         CASE WHEN UPPER(COALESCE(p.payment_method, '')) = 'BANK' THEN COALESCE(NULLIF(split_part(COALESCE(p.notes, ''), 'bank_name:', 2), ''), NULL) ELSE NULL END AS bank_name,
         CASE WHEN UPPER(COALESCE(p.payment_method, '')) = 'BANK' THEN COALESCE(NULLIF(split_part(COALESCE(p.notes, ''), 'bank_txn:', 2), ''), p.reference_no) ELSE NULL END AS bank_transaction_id,
         NULL::TIMESTAMP AS bank_timestamp,
         p.created_at AS sort_created_at
       FROM invoice_payments p
       JOIN invoices i ON i.id = p.invoice_id
       WHERE ${paymentConditions.join(" AND ")}

       UNION ALL

       SELECT
         2000000000 + t.id AS id,
         COALESCE(t.transaction_date, t.date) AS date,
         'RECEIPT' AS type,
         'PAYMENT' AS category,
         t.amount AS amount,
         COALESCE(t.description, 'Direct Payment') AS description,
         NULL::INTEGER AS related_invoice_id,
         NULL::TEXT AS invoice_number,
         NULL::TEXT AS payment_method,
         NULL::TEXT AS bank_name,
         NULL::TEXT AS bank_transaction_id,
         NULL::TIMESTAMP AS bank_timestamp,
         t.created_at AS sort_created_at
       FROM transactions t
       WHERE t.company_id = $1 AND t.reference_id = $2 AND t.type = 'CUSTOMER_PAYMENT'
     ) ledger_rows
     ORDER BY date ASC, sort_created_at ASC, id ASC`,
    params,
  );

  // Also fetch from sales_returns table (may not exist on older DBs)
  const srRows = await getSalesReturnRows(companyId, customerId);

  // Merge and sort by date
  const all = [...rows, ...srRows].sort((a, b) => {
    const da = new Date(a.date), db2 = new Date(b.date);
    if (da - db2 !== 0) return da - db2;
    return (new Date(a.sort_created_at) - new Date(b.sort_created_at));
  });
  return all;
}

async function getCustomerTotals(companyId, customerId) {
  const invoiceTotals = await db.pgGet(
    `SELECT
       COALESCE(SUM(CASE WHEN UPPER(COALESCE(i.invoice_type, '')) <> 'SALES_RETURN'
         THEN CASE
           WHEN UPPER(COALESCE(i.invoice_type,'')) IN ('NON_TAX_INVOICE','RETAIL_SALE','GIFTED_ITEM','NSB_INVOICE')
           THEN COALESCE(i.sub_total, i.total_amount)
           ELSE COALESCE((SELECT SUM(li.line_total) FROM invoice_line_items li WHERE li.invoice_id = i.id), i.total_amount)
         END ELSE 0 END), 0) AS total_billed,
       COALESCE(SUM(CASE WHEN UPPER(COALESCE(i.invoice_type, '')) = 'SALES_RETURN'
         THEN COALESCE((SELECT SUM(li.line_total) FROM invoice_line_items li WHERE li.invoice_id = i.id), i.total_amount)
         ELSE 0 END), 0) AS total_returns
     FROM invoices i
     WHERE i.company_id = $1 AND i.customer_id = $2 AND COALESCE(i.is_deleted, false) = false`,
    [companyId, customerId],
  );

  const paymentTotals = await db.pgGet(
    `SELECT COALESCE(SUM(p.amount), 0) AS total_paid
     FROM invoice_payments p
     JOIN invoices i ON i.id = p.invoice_id
     WHERE i.company_id = $1 AND i.customer_id = $2 AND COALESCE(i.is_deleted, false) = false`,
    [companyId, customerId],
  );

  const directPaymentTotals = await db.pgGet(
    `SELECT COALESCE(SUM(amount), 0) AS total_direct
     FROM transactions
     WHERE company_id = $1 AND reference_id = $2 AND type = 'CUSTOMER_PAYMENT'`,
    [companyId, customerId],
  );

  // Also sum from sales_returns table
  let srReturnsTotal = 0;
  try {
    const srTotals = await db.pgGet(
      `SELECT COALESCE(SUM(total_amount), 0) AS sr_total FROM sales_returns WHERE company_id = $1 AND customer_id = $2`,
      [companyId, customerId],
    );
    srReturnsTotal = toNumber(srTotals?.sr_total);
  } catch (e) { /* table may not exist yet */ }

  return {
    total_billed: toNumber(invoiceTotals?.total_billed),
    total_returns: toNumber(invoiceTotals?.total_returns) + srReturnsTotal,
    total_paid: toNumber(paymentTotals?.total_paid) + toNumber(directPaymentTotals?.total_direct),
  };
}

export async function recomputeCustomerBalance(client, customerId, companyId) {
  const snapshot = await ensureCustomerLedgerMetadata(client, customerId, companyId);
  const openingBalance = toNumber(snapshot.openingBalance);

  const invoiceTotals = await client.query(
    `SELECT
       COALESCE(SUM(CASE WHEN UPPER(COALESCE(i.invoice_type, '')) <> 'SALES_RETURN'
         THEN CASE
           WHEN UPPER(COALESCE(i.invoice_type,'')) IN ('NON_TAX_INVOICE','RETAIL_SALE','GIFTED_ITEM','NSB_INVOICE')
           THEN COALESCE(i.sub_total, i.total_amount)
           ELSE COALESCE((SELECT SUM(li.line_total) FROM invoice_line_items li WHERE li.invoice_id = i.id), i.total_amount)
         END ELSE 0 END), 0) AS total_billed,
       COALESCE(SUM(CASE WHEN UPPER(COALESCE(i.invoice_type, '')) = 'SALES_RETURN'
         THEN COALESCE((SELECT SUM(li.line_total) FROM invoice_line_items li WHERE li.invoice_id = i.id), i.total_amount)
         ELSE 0 END), 0) AS total_returns
     FROM invoices i
     WHERE i.company_id = $1 AND i.customer_id = $2 AND COALESCE(i.is_deleted, false) = false`,
    [companyId, customerId],
  );

  const paymentTotals = await client.query(
    `SELECT COALESCE(SUM(p.amount), 0) AS total_paid
     FROM invoice_payments p
     JOIN invoices i ON i.id = p.invoice_id
     WHERE i.company_id = $1 AND i.customer_id = $2 AND COALESCE(i.is_deleted, false) = false`,
    [companyId, customerId],
  );

  const billed = toNumber(invoiceTotals.rows[0]?.total_billed);
  let returned = toNumber(invoiceTotals.rows[0]?.total_returns);
  const paid = toNumber(paymentTotals.rows[0]?.total_paid);

  // Add sales_returns table totals
  try {
    const srTotals = await client.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS sr_total FROM sales_returns WHERE company_id = $1 AND customer_id = $2`,
      [companyId, customerId],
    );
    returned += toNumber(srTotals.rows[0]?.sr_total);
  } catch (e) { /* table may not exist yet */ }

  const outstanding = openingBalance + billed - paid - returned;

  await client.query(`UPDATE users SET initial_balance = $1 WHERE id = $2`, [outstanding, customerId]);

  return {
    opening_balance: openingBalance,
    total_billed: billed,
    total_paid: paid,
    total_returns: returned,
    pending_amount: outstanding,
    ledger_id: snapshot.ledgerId,
  };
}

export async function createCustomerLedgerEvent(
  client,
  {
    companyId,
    branchId,
    customerId,
    type,
    category,
    amount,
    date,
    description,
    relatedInvoiceId = null,
    referenceType = null,
    referenceId = null,
    createdBy = null,
    ledgerId = null,
    meta = {},
    bill_purpose = 'real',
  },
) {
  const resolved = ledgerId ? { ledgerId } : await ensureCustomerLedgerMetadata(client, customerId, companyId);
  const eventDate = date || new Date().toISOString().split("T")[0];
  const payload = JSON.stringify(safeJson(meta));

  const result = await client.query(
    `INSERT INTO transactions (
       company_id, branch_id, transaction_date, reference_type, reference_id,
       description, created_by, user_id, ledger_id, amount, type, category,
       date, related_invoice_id, meta, bill_purpose, created_at
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9, $10, $11, $12,
       $13, $14, $15, $16, NOW()
     )
     RETURNING *`,
    [
      companyId,
      branchId || 1,
      eventDate,
      referenceType,
      referenceId,
      description,
      createdBy,
      customerId,
      resolved.ledgerId,
      amount,
      type,
      category,
      eventDate,
      relatedInvoiceId,
      payload,
      bill_purpose || 'real'
    ],
  );

  return result.rows[0];
}

export async function deleteCustomerLedgerEvents(client, filters) {
  const clauses = ["company_id = $1", "user_id = $2"];
  const params = [filters.companyId, filters.customerId];
  let idx = 3;

  if (filters.type) {
    clauses.push(`type = $${idx++}`);
    params.push(filters.type);
  }
  if (filters.category) {
    clauses.push(`category = $${idx++}`);
    params.push(filters.category);
  }
  if (filters.relatedInvoiceId !== undefined) {
    if (filters.relatedInvoiceId === null) {
      clauses.push("related_invoice_id IS NULL");
    } else {
      clauses.push(`related_invoice_id = $${idx++}`);
      params.push(filters.relatedInvoiceId);
    }
  }
  if (filters.referenceId !== undefined) {
    if (filters.referenceId === null) {
      clauses.push("reference_id IS NULL");
    } else {
      clauses.push(`reference_id = $${idx++}`);
      params.push(filters.referenceId);
    }
  }

  await client.query(`DELETE FROM transactions WHERE ${clauses.join(" AND ")}`, params);
}

export async function buildCustomerLedgerStatement(companyId, customerId, filters = {}) {
  const customer = await db.pgGet(
    `SELECT id, username, email, phone, initial_balance, meta
     FROM users
     WHERE id = $1 AND company_id = $2 AND role IN ('user', 'customer')`,
    [customerId, companyId],
  );

  if (!customer) return null;

  const meta = safeJson(customer.meta);
  const openingBalance = toNumber(meta.customer_opening_balance, toNumber(customer.initial_balance));
  const totals = await getCustomerTotals(companyId, customerId);
  const rows = await getCustomerDerivedRows(companyId, customerId, filters);

  let runningBalance = openingBalance;
  const statement = rows.map((row) => {
    const amount = toNumber(row.amount);
    const returnEntry = row.type === "RETURN";
    const invoiceEntry = row.type === "INVOICE";
    const debit = invoiceEntry ? amount : 0;
    const credit = invoiceEntry ? 0 : amount;

    runningBalance += debit;
    runningBalance -= credit;

    return {
      ...row,
      amount,
      debit,
      credit,
      running_balance: runningBalance,
      payment_method: row.payment_method || null,
      bank_name:
        row.payment_method === "BANK" && row.bank_name
          ? row.bank_name.split("|")[0].trim() || null
          : null,
      bank_transaction_id:
        row.payment_method === "BANK" && row.bank_transaction_id
          ? row.bank_transaction_id.split("|")[0].trim() || null
          : null,
      bank_timestamp: row.bank_timestamp || null,
      description: returnEntry && row.invoice_number
        ? `Return / Credit note for Invoice #${row.invoice_number}`
        : row.description,
    };
  });

  return {
    customer: {
      id: customer.id,
      name: customer.username,
      email: customer.email,
      phone: customer.phone,
      ledger_id: toNumber(meta.customer_ledger_id, null),
    },
    summary: {
      opening_balance: openingBalance,
      total_billed: totals.total_billed,
      total_paid: totals.total_paid,
      total_returns: totals.total_returns,
      pending_amount: openingBalance + totals.total_billed - totals.total_paid - totals.total_returns,
    },
    transactions: statement,
  };
}
