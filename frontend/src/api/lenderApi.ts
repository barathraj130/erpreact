
import { apiFetch } from "../utils/api";

export interface Lender {
  id: number;
  company_id: number;
  lender_name: string;
  lender_type: string; // Bank, Private Person, NBFC, Chit Company, Other
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  opening_balance: number;
  current_balance: number;
  total_borrowed?: number;
  total_repaid?: number;
  notes?: string;
}

export const fetchLenders = async (): Promise<Lender[]> => {
  const res = await apiFetch("/lenders");
  return res.json();
};

export const fetchLenderDetails = async (id: number): Promise<any> => {
  const res = await apiFetch(`/lenders/${id}`);
  return res.json();
};

export const createLender = async (data: any): Promise<any> => {
  const res = await apiFetch("/lenders", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.json();
};

export const deleteLender = async (id: number): Promise<any> => {
  const res = await apiFetch(`/lenders/${id}`, {
    method: "DELETE",
  });
  return res.json();
};
