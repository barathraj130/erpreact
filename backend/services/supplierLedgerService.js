import * as db from "../database/pg.js";

const SUPPLIER_LEDGER_GROUP = "Sundry Creditors";

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function safeJson(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

export async function getSupplierById(client, supplierId, companyId) {
  const res = await client.query(
    `SELECT id, name, initial_payable_balance, current_balance
     FROM suppliers
     WHERE id = $1 AND company_id = $2`,
    [supplierId, companyId],
  );
  return res.rows[0];
}

async function getSupplierDerivedRows(companyId, supplierId, filters = {}) {
  const params = [parseInt(companyId), parseInt(supplierId)];
  const billConditions = ["pb.company_id = $1", "pb.supplier_id = $2", "COALESCE(pb.is_deleted, false) = false"];
  const txConditions = [
    "t.company_id = $1",
    "(t.lender_id = $2 OR (t.reference_type ILIKE 'supplier' AND t.reference_id = $2))"
  ];
  let idx = 3;

  if (filters.start_date) {
    billConditions.push(`pb.bill_date >= $${idx}`);
    txConditions.push(`t.date >= $${idx}`);
    params.push(filters.start_date);
    idx += 1;
  }

  if (filters.end_date) {
    billConditions.push(`pb.bill_date <= $${idx}`);
    txConditions.push(`t.date <= $${idx}`);
    params.push(filters.end_date);
    idx += 1;
  }

  // Build date filters for payment queries
  const payBillConditions = ["pb.company_id = $1", "pb.supplier_id = $2", "pb.paid_amount > 0", "COALESCE(pb.is_deleted, false) = false"];
  if (filters.start_date) payBillConditions.push(`pb.bill_date >= $3`);
  if (filters.end_date) payBillConditions.push(`pb.bill_date <= $${filters.start_date ? 4 : 3}`);

  // Fetch Bills from purchase_bills and Payments from two sources:
  // (a) purchase_bills.paid_amount (covers creation + PATCH /pay payments)
  // (b) transactions with reference_type = 'SUPPLIER_PAYMENT' (manual payments)
  // 4. Backdated entries linked to this supplier that represent a real bill
  //    or a real payment (not cash/bank balance, which backdated entries never
  //    touch — but what's owed to a SPECIFIC supplier is a running total of
  //    real bills and real payments, and a backdated payment is a real
  //    payment regardless of when it was entered). Only 'purchase' and the
  //    payment-shaped types are unambiguous enough to fold into the balance;
  //    other types (opening_balance, adjustment, other, …) stay reference-only
  //    (see the backdated_entries side list built in buildSupplierLedgerStatement).
  let backdatedRows = [];
  try {
    backdatedRows = await db.pgAll(
      `SELECT
         3000000000 + bt.id AS id,
         bt.transaction_date AS date,
         CASE WHEN bt.transaction_type = 'purchase' THEN 'BILL' ELSE 'PAYMENT' END AS type,
         'BACKDATED' AS category,
         bt.amount AS amount,
         bt.description AS description,
         bt.id AS related_id,
         NULL::TEXT AS reference_number,
         NULL::TEXT AS payment_method,
         bt.created_at AS sort_created_at
       FROM backdated_transactions bt
       WHERE bt.company_id = $1 AND bt.party_type = 'supplier' AND bt.party_id = $2
         AND bt.is_reversed = false
         AND bt.transaction_type IN ('purchase', 'payment_made', 'cash_out', 'bank_out', 'expense')`,
      [parseInt(companyId), parseInt(supplierId)],
    );
  } catch (e) { /* table may not exist yet */ }

  const rows = await db.pgAll(
    `SELECT * FROM (
       -- 1. Purchase Bills (credit — increases what we owe)
       SELECT
         pb.id,
         pb.bill_date AS date,
         'BILL' AS type,
         'PURCHASE' AS category,
         pb.total_amount AS amount,
         'Purchase Bill #' || pb.bill_number AS description,
         pb.id AS related_id,
         pb.bill_number AS reference_number,
         NULL::TEXT AS payment_method,
         pb.created_at AS sort_created_at
       FROM purchase_bills pb
       WHERE ${billConditions.join(" AND ")}

       UNION ALL

       -- 2. Payments via purchase bills (paid_amount on each bill — debit, reduces balance)
       SELECT
         2000000000 + pb.id AS id,
         pb.bill_date AS date,
         'PAYMENT' AS type,
         'BILL_PAYMENT' AS category,
         pb.paid_amount AS amount,
         'Payment for Bill #' || pb.bill_number AS description,
         pb.id AS related_id,
         pb.bill_number AS reference_number,
         NULL::TEXT AS payment_method,
         pb.created_at AS sort_created_at
       FROM purchase_bills pb
       WHERE ${payBillConditions.join(" AND ")}

       UNION ALL

       -- 3. Manual supplier payments via Transactions module
       SELECT
         1000000000 + t.id AS id,
         COALESCE(t.date, t.transaction_date, t.created_at::DATE) AS date,
         'PAYMENT' AS type,
         t.category AS category,
         t.amount AS amount,
         t.description AS description,
         t.id AS related_id,
         NULL::TEXT AS reference_number,
         NULL::TEXT AS payment_method,
         t.created_at AS sort_created_at
       FROM transactions t
       WHERE t.company_id = $1
         AND t.reference_type IN ('SUPPLIER_PAYMENT', 'supplier')
         AND t.reference_id::text = $2::text
         AND COALESCE(t.bill_purpose, 'real') != 'excluded'
     ) ledger_rows
     ORDER BY date ASC, sort_created_at ASC, id ASC`,
    params,
  );

  return [...rows, ...backdatedRows.map(r => ({ ...r, is_backdated: true }))]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || new Date(a.sort_created_at).getTime() - new Date(b.sort_created_at).getTime());
}

/**
 * Recompute suppliers.current_balance from scratch (opening balance + all
 * bills - all still-valid payments) and persist it, instead of trusting the
 * incremental +/- mutations scattered across purchaseBillRoutes.js and
 * transactionService.js — any one of those missing its reversal (e.g. a
 * deleted SUPPLIER_PAYMENT transaction) leaves current_balance permanently
 * wrong otherwise. Call this after anything that changes a supplier's bills
 * or payments, and on every ledger view so it self-heals like the cash/bank
 * ledgers already do.
 */
export async function recomputeSupplierBalance(companyId, supplierId) {
  const cId = parseInt(companyId);
  const sId = parseInt(supplierId);
  const supplier = await db.pgGet(
    `SELECT opening_balance FROM suppliers WHERE id = $1 AND company_id = $2`,
    [sId, cId],
  );
  if (!supplier) return null;

  const rows = await getSupplierDerivedRows(cId, sId, {});
  let balance = toNumber(supplier.opening_balance);
  for (const row of rows) {
    const amount = toNumber(row.amount);
    balance += row.type === "BILL" ? amount : -amount;
  }

  await db.pgRun(
    `UPDATE suppliers SET current_balance = $1 WHERE id = $2 AND company_id = $3`,
    [balance, sId, cId],
  );
  return balance;
}

export async function buildSupplierLedgerStatement(companyId, supplierId, filters = {}) {
  const cId = parseInt(companyId);
  const sId = parseInt(supplierId);
  const supplier = await db.pgGet(
    `SELECT id, name, email, phone, opening_balance as initial_payable_balance, current_balance
     FROM suppliers
     WHERE id = $1 AND company_id = $2`,
    [sId, cId],
  );

  if (!supplier) return null;

  const openingBalance = toNumber(supplier.initial_payable_balance);
  const rows = await getSupplierDerivedRows(cId, sId, filters);

  let runningBalance = openingBalance;
  const statement = rows.map((row) => {
    const amount = toNumber(row.amount);
    
    // In a supplier ledger (Liability):
    // Bill (Purchase) INCREASES balance (CR)
    // Payment DECREASES balance (DR)
    
    const isCredit = row.type === "BILL"; // Purchase increases debt
    const debit = isCredit ? 0 : amount;
    const credit = isCredit ? amount : 0;

    runningBalance += credit;
    runningBalance -= debit;

    return {
      ...row,
      amount,
      debit,
      credit,
      running_balance: runningBalance,
    };
  });

  // Calculate totals
  const totalBilled = statement.filter(r => r.type === 'BILL').reduce((sum, r) => sum + r.amount, 0);
  const totalPaid = statement.filter(r => r.type !== 'BILL').reduce((sum, r) => sum + r.amount, 0);

  // Backdated entries for this supplier that AREN'T one of the bill/payment
  // types already folded into rows/totals/running_balance above (those are
  // shown inline in the main table with an is_backdated badge instead).
  // These remaining ones (opening_balance, adjustment, other, …) are too
  // ambiguous to safely count toward what's owed, so they stay reference-only.
  let backdatedEntries = [];
  try {
    backdatedEntries = await db.pgAll(
      `SELECT id, transaction_date, transaction_type, amount, description, backdated_reason
       FROM backdated_transactions
       WHERE company_id = $1 AND party_type = 'supplier' AND party_id = $2 AND is_reversed = false
         AND transaction_type NOT IN ('purchase', 'payment_made', 'cash_out', 'bank_out', 'expense')
       ORDER BY transaction_date DESC`,
      [cId, sId],
    );
  } catch (e) { /* table may not exist yet */ }

  return {
    supplier: {
      id: supplier.id,
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
    },
    summary: {
      opening_balance: openingBalance,
      total_billed: totalBilled,
      total_paid: totalPaid,
      total_returns: 0, // Placeholder
      pending_amount: runningBalance,
    },
    transactions: statement,
    backdated_entries: backdatedEntries,
  };
}
