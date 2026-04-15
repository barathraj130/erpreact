// frontend/src/api/reconciliationApi.ts

import { apiFetch } from "../utils/api";

export interface BankStatementLine {
  date: string;
  description: string;
  amount: number;
  type: "Credit" | "Debit";
}

export interface ReconciliationResult {
  bank_statement: BankStatementLine[];
  unmatched_transactions: any[];
  reconciled_transactions: any[];
}

/**
 * Fetches unmatched transactions for a specific bank ledger.
 */
export const fetchReconciliationData = async (
  ledgerId: number,
): Promise<ReconciliationResult> => {
  const res = await apiFetch(`/reconciliation/${ledgerId}`);
  return res.json();
};

/**
 * Marks internal transaction IDs as reconciled against external statement lines.
 */
export const completeReconciliation = async (
  ledgerId: number,
  matchedTransactions: number[],
): Promise<{ message: string }> => {
  const res = await apiFetch(`/reconciliation/${ledgerId}/match`, {
    method: "POST",
    body: JSON.stringify({ matches: matchedTransactions }),
  });
  return res.json();
};
