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
    `SELECT id, lender_name, entity_type, initial_payable_balance, current_balance
     FROM lenders
     WHERE id = $1 AND company_id = $2`,
    [supplierId, companyId],
  );
  return res.rows[0];
}

async function getSupplierDerivedRows(companyId, supplierId, filters = {}) {
  const params = [companyId, supplierId];
  const billConditions = ["pb.company_id = $1", "pb.supplier_id = $2"];
  const txConditions = ["t.company_id = $1", "t.lender_id = $2"];
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

  // Fetch Bills from purchase_bills and Payments from transactions (where lender_id matches)
  return db.pgAll(
    `SELECT * FROM (
       -- 1. Purchase Bills
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

       -- 2. Payments (from transactions table)
       SELECT
         1000000000 + t.id AS id,
         t.date AS date,
         t.type AS type,
         t.category AS category,
         t.amount AS amount,
         t.description AS description,
         t.id AS related_id,
         NULL::TEXT AS reference_number,
         (t.meta->>'payment_method') AS payment_method,
         t.created_at AS sort_created_at
       FROM transactions t
       WHERE ${txConditions.join(" AND ")}
     ) ledger_rows
     ORDER BY date ASC, sort_created_at ASC, id ASC`,
    params,
  );
}

export async function buildSupplierLedgerStatement(companyId, supplierId, filters = {}) {
  const supplier = await db.pgGet(
    `SELECT id, lender_name, email, phone, initial_payable_balance, current_balance
     FROM lenders
     WHERE id = $1 AND company_id = $2`,
    [supplierId, companyId],
  );

  if (!supplier) return null;

  const openingBalance = toNumber(supplier.initial_payable_balance);
  const rows = await getSupplierDerivedRows(companyId, supplierId, filters);

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

  return {
    supplier: {
      id: supplier.id,
      name: supplier.lender_name,
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
  };
}
