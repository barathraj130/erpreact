
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
  return res.json();
};

export const createSupplier = async (data: any): Promise<any> => {
  const res = await apiFetch("/suppliers", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.json();
};

export const deleteSupplier = async (id: number): Promise<any> => {
  const res = await apiFetch(`/suppliers/${id}`, {
    method: "DELETE",
  });
  return res.json();
};
