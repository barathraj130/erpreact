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

async function getCustomerDerivedRows(companyId, customerId, filters = {}) {
  const params = [companyId, customerId];
  const invoiceConditions = ["i.company_id = $1", "i.customer_id = $2"];
  const paymentConditions = ["i.company_id = $1", "i.customer_id = $2"];
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

  return db.pgAll(
    `SELECT * FROM (
       SELECT
         i.id,
         i.invoice_date AS date,
         CASE WHEN UPPER(COALESCE(i.invoice_type, '')) = 'SALES_RETURN' THEN 'RETURN' ELSE 'INVOICE' END AS type,
         CASE WHEN UPPER(COALESCE(i.invoice_type, '')) = 'SALES_RETURN' THEN 'CREDIT_NOTE' ELSE 'SALES' END AS category,
         i.total_amount AS amount,
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
     ) ledger_rows
     ORDER BY date ASC, sort_created_at ASC, id ASC`,
    params,
  );
}

async function getCustomerTotals(companyId, customerId) {
  const invoiceTotals = await db.pgGet(
    `SELECT
       COALESCE(SUM(CASE WHEN UPPER(COALESCE(invoice_type, '')) <> 'SALES_RETURN' THEN total_amount ELSE 0 END), 0) AS total_billed,
       COALESCE(SUM(CASE WHEN UPPER(COALESCE(invoice_type, '')) = 'SALES_RETURN' THEN total_amount ELSE 0 END), 0) AS total_returns
     FROM invoices
     WHERE company_id = $1 AND customer_id = $2`,
    [companyId, customerId],
  );

  const paymentTotals = await db.pgGet(
    `SELECT COALESCE(SUM(p.amount), 0) AS total_paid
     FROM invoice_payments p
     JOIN invoices i ON i.id = p.invoice_id
     WHERE i.company_id = $1 AND i.customer_id = $2`,
    [companyId, customerId],
  );

  return {
    total_billed: toNumber(invoiceTotals?.total_billed),
    total_returns: toNumber(invoiceTotals?.total_returns),
    total_paid: toNumber(paymentTotals?.total_paid),
  };
}

export async function recomputeCustomerBalance(client, customerId, companyId) {
  const snapshot = await ensureCustomerLedgerMetadata(client, customerId, companyId);
  const openingBalance = toNumber(snapshot.openingBalance);

  const invoiceTotals = await client.query(
    `SELECT
       COALESCE(SUM(CASE WHEN UPPER(COALESCE(invoice_type, '')) <> 'SALES_RETURN' THEN total_amount ELSE 0 END), 0) AS total_billed,
       COALESCE(SUM(CASE WHEN UPPER(COALESCE(invoice_type, '')) = 'SALES_RETURN' THEN total_amount ELSE 0 END), 0) AS total_returns
     FROM invoices
     WHERE company_id = $1 AND customer_id = $2`,
    [companyId, customerId],
  );

  const paymentTotals = await client.query(
    `SELECT COALESCE(SUM(p.amount), 0) AS total_paid
     FROM invoice_payments p
     JOIN invoices i ON i.id = p.invoice_id
     WHERE i.company_id = $1 AND i.customer_id = $2`,
    [companyId, customerId],
  );

  const billed = toNumber(invoiceTotals.rows[0]?.total_billed);
  const returned = toNumber(invoiceTotals.rows[0]?.total_returns);
  const paid = toNumber(paymentTotals.rows[0]?.total_paid);
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
  },
) {
  const resolved = ledgerId ? { ledgerId } : await ensureCustomerLedgerMetadata(client, customerId, companyId);
  const eventDate = date || new Date().toISOString().split("T")[0];
  const payload = JSON.stringify(safeJson(meta));

  const result = await client.query(
    `INSERT INTO transactions (
       company_id, branch_id, transaction_date, reference_type, reference_id,
       description, created_by, user_id, ledger_id, amount, type, category,
       date, related_invoice_id, meta, created_at
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9, $10, $11, $12,
       $13, $14, $15, NOW()
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
