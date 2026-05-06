// frontend/src/api/productApi.ts

import { apiFetch } from "../utils/api";

// --- Type Definitions ---

export interface Product {
  id: number;
  company_id: number;
  name: string;
  sku: string | null;
  description: string | null;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  unit: string | null;
  hsn_code: string | null;
  supplier_name?: string | null;
  gst_percent?: number | null;
  min_stock: number;
  barcode: string | null;
  image_url?: string | null;
  is_active: number;
  updated_at: string;
  created_at: string;
}

export interface ScannedProductFields {
  product_name: string;
  sku: string;
  hsn_code: string;
  description: string;
  purchase_price: number;
  selling_price: number;
  quantity: number;
  unit: string;
  gst_percent: number;
  supplier_name: string;
  confidence?: number;
  amount?: number;
}

export interface ProductBillScanResponse extends ScannedProductFields {
  items: ScannedProductFields[];
  has_usable_data?: boolean;
  error?: string | null;
  message?: string | null;
  source_meta?: {
    amount: number;
    tax_amount: number;
    date: string | null;
    currency: string;
    is_simulated: boolean;
  };
}

interface ApiResponse {
  message: string;
  product?: Product;
  id?: number;
}

// --- Product CRUD Operations (/api/products) ---

/**
 * Fetches all products for the active company.
 */
export const fetchProducts = async (): Promise<Product[]> => {
  const res = await apiFetch("/products");
  return res.json();
};

export const createProduct = async (data: any): Promise<ApiResponse> => {
  const res = await apiFetch("/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
};

export const updateProduct = async (
  id: number,
  data: any,
): Promise<ApiResponse> => {
  const res = await apiFetch(`/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
};

export const scanProductFromBill = async (
  file: File,
): Promise<ProductBillScanResponse> => {
  const formData = new FormData();
  formData.append("bill", file);

  const res = await apiFetch(
    "/ai/scan",
    {
      method: "POST",
      body: formData,
    },
    false,
  );

  if (!res.ok) {
    let message = "Failed to scan bill.";
    try {
      const data = await res.json();
      message =
        data.error ||
        data.result?.error ||
        data.details ||
        message;
    } catch {
      message = await res.text();
    }
    throw new Error(message);
  }

  const data = await res.json();
  if (!data?.has_usable_data || !Array.isArray(data.items) || data.items.length === 0) {
    throw new Error(data?.error || data?.message || "No product details could be extracted from this bill.");
  }

  return data;
};

/**
 * Deletes a product by ID.
 */
export const deleteProduct = async (id: number): Promise<ApiResponse> => {
  // FIX: Corrected endpoint path to match the backend routes file name convention
  const res = await apiFetch(`/products/${id}`, {
    method: "DELETE",
  });
  return res.json();
};
