// frontend/src/api/userApi.ts

import { apiFetch } from "../utils/api";

// --- Type Definitions for Customer/Party ---

export interface Customer {
  id: number;
  username: string;
  nickname?: string; // <--- Added this optional property
  email: string;
  phone?: string;
  company?: string;
  initial_balance: number;
  remaining_balance: number; // Calculated field from backend SQL
  address_line1?: string;
  address_line2?: string;
  city_pincode?: string;
  state?: string;
  gstin?: string;
  state_code?: string;
  created_at: string;
}

interface ApiResponse {
  message: string;
  user?: Customer;
  id?: number;
}

export interface CustomerLedgerEntry {
  id: number;
  date: string;
  type: string;
  category: string;
  amount: number;
  debit: number;
  credit: number;
  description: string;
  invoice_number?: string | null;
  payment_method?: string | null;
  bank_name?: string | null;
  bank_transaction_id?: string | null;
  bank_timestamp?: string | null;
  running_balance: number;
}

export interface CustomerLedgerResponse {
  customer: {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    ledger_id?: number | null;
  };
  summary: {
    opening_balance: number;
    total_billed: number;
    total_paid: number;
    total_returns: number;
    pending_amount: number;
  };
  transactions: CustomerLedgerEntry[];
}

// --- API Functions (CRUD) ---

/**
 * Fetches all non-admin users (Customers/Parties) for the active company.
 */
export const fetchCustomers = async (): Promise<Customer[]> => {
  const res = await apiFetch("/users");
  return res.json();
};

/**
 * Creates a new user/party and its associated accounting ledger.
 */
export const createCustomer = async (data: any): Promise<ApiResponse> => {
  const res = await apiFetch("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.json();
};

/**
 * Updates an existing user/party and its associated accounting ledger.
 */
export const updateCustomer = async (
  id: number,
  data: any,
): Promise<ApiResponse> => {
  const res = await apiFetch(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.json();
};

/**
 * Deletes a user/party and its associated accounting ledger and links.
 */
export const deleteCustomer = async (id: number): Promise<ApiResponse> => {
  const res = await apiFetch(`/users/${id}`, {
    method: "DELETE",
  });
  return res.json();
};

export const fetchCustomerLedger = async (
  id: number,
  filters?: { start_date?: string; end_date?: string; payment_method?: string },
): Promise<CustomerLedgerResponse> => {
  const params = new URLSearchParams();
  if (filters?.start_date) params.set("start_date", filters.start_date);
  if (filters?.end_date) params.set("end_date", filters.end_date);
  if (filters?.payment_method) params.set("payment_method", filters.payment_method);

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiFetch(`/users/${id}/ledger${suffix}`);
  return res.json();
};
