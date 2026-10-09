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
  category?: string | null;
  location?: string | null;
  is_active: number;
  updated_at: string;
  created_at: string;
  is_auto_created?: boolean;
  auto_created_from_invoice_id?: number | null;
  cost_price_pending?: boolean;
  cost_price_updated_at?: string | null;
  pending_review?: boolean;
  is_set?: boolean;
  branch_id?: number | null;
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
export const fetchProducts = async (opts?: { includePending?: boolean }): Promise<Product[]> => {
  // includePending: see products still awaiting admin confirmation (created via
  // quick-add with no exact name match) — only the admin Inventory page and the
  // Purchase Bill product picker should pass this; every Sales/customer-facing
  // caller leaves it out so an unreviewed duplicate never shows up for sale.
  const res = await apiFetch(`/products${opts?.includePending ? "?include_pending=true" : ""}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Failed to load products (${res.status})`);
  }
  return res.json();
};

/** Confirms a pending-review product as genuinely new (clears pending_review). */
export const confirmPendingProduct = async (id: number): Promise<ApiResponse> => {
  const res = await apiFetch(`/products/${id}/confirm`, { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Failed to confirm product (${res.status})`);
  }
  return body;
};

export interface CreateSetPayload {
  set_product_id?: number | null;
  set_name?: string;
  branch_id: number;
  sets_qty: number;
  components: { product_id: number; qty_per_set: number }[];
}

export interface CreateSetResponse {
  success: boolean;
  message?: string;
  error?: string;
  set_product_id?: number;
  set_stock?: number;
  components_leftover?: { product_id: number; name: string; current_stock: number }[];
}

/**
 * Assembles N units of a "Set" product out of loose component stock
 * (e.g. 1000 tops + 800 pants → 700 sets, leaving 300 tops + 100 pants).
 */
export const createSet = async (payload: CreateSetPayload): Promise<CreateSetResponse> => {
  const res = await apiFetch(`/products/create-set`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Failed to create set (${res.status})`);
  }
  return body;
};

export const createProduct = async (data: any): Promise<ApiResponse> => {
  const res = await apiFetch("/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Failed to create product (${res.status})`);
  }
  return body;
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
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Failed to update product (${res.status})`);
  }
  return body;
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
  const res = await apiFetch(`/products/${id}/archive`, {
    method: "PATCH",
  });
  return res.json();
};
