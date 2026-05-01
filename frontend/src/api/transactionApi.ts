// frontend/src/api/transactionApi.ts

import { apiFetch } from "../utils/api";

export interface Transaction {
  id: number;
  date: string;
  amount: number;
  description: string;
  category: string;
  user_id: number | null;
  lender_id: number | null;
  related_invoice_id: number | null;
  type: string;
  user_name?: string;
  lender_name?: string;
  ledger_name?: string;
}

/**
 * Fetches a list of core transactions.
 */
export const fetchTransactions = async (
  params: {
    lender_id?: number;
    user_id?: number;
    type?: string;
    category?: string;
  } = {},
): Promise<Transaction[]> => {
  const query = new URLSearchParams(
    params as Record<string, string>,
  ).toString();
  const res = await apiFetch(`/transactions?${query}`);
  return res.json();
};

/**
 * Creates a direct entry transaction.
 */
export const createTransaction = async (
  data: any,
): Promise<{ id: number; message: string }> => {
  const res = await apiFetch("/transactions", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.json();
};
