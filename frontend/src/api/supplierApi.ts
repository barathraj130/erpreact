
import { apiFetch } from "../utils/api";

export interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  opening_balance: number;
  current_balance: number;
}

export const fetchSuppliers = async (): Promise<Supplier[]> => {
  const res = await apiFetch("/suppliers");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Failed to load suppliers (${res.status})`);
  }
  return res.json();
};

export const createSupplier = async (data: any): Promise<any> => {
  const res = await apiFetch("/suppliers", {
    method: "POST",
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Failed to create supplier (${res.status})`);
  }
  return body;
};

export const deleteSupplier = async (id: number): Promise<any> => {
  const res = await apiFetch(`/suppliers/${id}`, {
    method: "DELETE",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Delete failed");
  }
  return data;
};
