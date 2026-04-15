// frontend/src/api/salesOrderApi.ts

import { apiFetch } from "../utils/api";

export interface SalesOrder {
  id: number;
  order_number: string;
  customer_id: number;
  order_date: string;
  total_value: number;
  status: "Draft" | "Confirmed" | "Shipped" | "Invoiced" | "Cancelled";
}

interface ApiResponse {
  message: string;
  order?: SalesOrder;
  id?: number;
}

/**
 * Fetches all sales orders.
 */
export const fetchSalesOrders = async (): Promise<SalesOrder[]> => {
  const res = await apiFetch("/sales-orders");
  return res.json();
};

/**
 * Creates a new sales order.
 */
export const createSalesOrder = async (data: any): Promise<ApiResponse> => {
  const res = await apiFetch("/sales-orders", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.json();
};

/**
 * Converts a sales order into an invoice.
 */
export const convertToInvoice = async (id: number): Promise<ApiResponse> => {
  const res = await apiFetch(`/sales-orders/${id}/convert-to-invoice`, {
    method: "POST",
  });
  return res.json();
};
