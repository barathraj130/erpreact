import { apiFetch } from "../utils/api";

export interface PurchaseBill {
  id: number;
  bill_number: string;
  supplier_name: string; // Joined from lenders table
  supplier_id?: number;
  bill_date: string;
  due_date: string;
  total_amount: number;
  status: "PAID" | "PENDING" | "OVERDUE";
  bill_type?: string;
  paid_amount?: number;
}

export const fetchPurchaseBills = async (): Promise<PurchaseBill[]> => {
  const res = await apiFetch("/purchase-bills");
  return res.json();
};

export const createPurchaseBill = async (data: any): Promise<any> => {
  const res = await apiFetch("/purchase-bills", {
    method: "POST",
    body: data,
  }, false);
  return res.json();
};
