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
  branch_id?: number | null;
  branch_name?: string | null;
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
  error?: string;
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
 * Fetches non-admin users (Customers/Parties) for the active company.
 *
 * By default, scoped to the requester's active branch (or company-wide if no
 * branch is active). Pass `{ scope: "all" }` to see every customer across all
 * branches, or `{ branchId }` to view a specific branch's customers.
 */
export const fetchCustomers = async (
  opts?: { scope?: "all"; branchId?: number },
): Promise<Customer[]> => {
  const params = new URLSearchParams();
  if (opts?.scope) params.set("scope", opts.scope);
  if (opts?.branchId != null) params.set("branch_id", String(opts.branchId));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiFetch(`/users${suffix}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Failed to load customers (${res.status})`);
  }
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
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Failed to create customer (${res.status})`);
  }
  return body;
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
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Failed to update customer (${res.status})`);
  }
  return body;
};

/**
 * Deletes a user/party and its associated accounting ledger and links.
 */
export const deleteCustomer = async (id: number, force = false): Promise<ApiResponse> => {
  const res = await apiFetch(`/users/${id}${force ? '?force=true' : ''}`, {
    method: "DELETE",
  });
  const body = await res.json().catch(() => ({}));
  // 400/409 with error message = safe warning (linked records), not a throw
  if (!res.ok && res.status !== 400 && res.status !== 409) {
    throw new Error(body?.error || `Failed to delete customer (${res.status})`);
  }
  return body;
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
