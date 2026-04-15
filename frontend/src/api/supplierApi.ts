import { apiFetch } from "../utils/api";

// We call it 'Supplier' in the frontend, matching the DB fields
export interface Supplier {
  id: number;
  lender_name: string; // The backend field name
  entity_type: string;
  phone?: string;
  email?: string;
  initial_payable_balance: number;
  remaining_balance: number;
  created_at?: string;
}

export const fetchSuppliers = async (): Promise<Supplier[]> => {
  // Connects to the existing backend route
  const res = await apiFetch("/lenders");
  return res.json();
};

export const createSupplier = async (data: any): Promise<any> => {
  // Map the form data to match backend expectations (lender_name)
  const payload = {
    lender_name: data.supplier_name,
    phone: data.phone,
    email: data.email,
    initial_payable_balance: data.initial_payable_balance,
    entity_type: "Supplier",
  };

  const res = await apiFetch("/lenders", {
    method: "POST",
    // ✅ FIX: Cast payload to 'any' or stringify manually if needed,
    // but since apiFetch handles object bodies, casting to 'any' suppresses the type error.
    body: payload as any,
  });
  return res.json();
};

export const deleteSupplier = async (id: number): Promise<any> => {
  const res = await apiFetch(`/lenders/${id}`, {
    method: "DELETE",
  });
  return res.json();
};
