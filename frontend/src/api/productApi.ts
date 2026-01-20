// frontend/src/api/productApi.ts

import { apiFetch } from '../utils/api';

// --- Type Definitions ---

export interface Product {
    id: number;
    company_id: number;
    product_name: string;
    sku: string | null;
    description: string | null;
    cost_price: number;
    sale_price: number;
    current_stock: number;
    unit_id: number | null; 
    unit_name: string | null; 
    hsn_acs_code: string | null;
    low_stock_threshold: number;
    reorder_level: number;
    is_active: number; 
    image_url: string | null;
    updated_at: string;
    created_at: string;
    preferred_supplier_name?: string;
    preferred_supplier_purchase_price?: number;
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
    const res = await apiFetch('/products'); 
    return res.json();
};

/**
 * Deletes a product by ID.
 */
export const deleteProduct = async (id: number): Promise<ApiResponse> => {
    // FIX: Corrected endpoint path to match the backend routes file name convention
    const res = await apiFetch(`/products/${id}`, {
        method: 'DELETE',
    });
    return res.json();
};