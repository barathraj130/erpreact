// frontend/src/api/productApi.ts

import { apiFetch } from '../utils/api';

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
    min_stock: number;
    barcode: string | null;
    is_active: number; 
    updated_at: string;
    created_at: string;
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

export const createProduct = async (data: any): Promise<ApiResponse> => {
    const res = await apiFetch('/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return res.json();
};

export const updateProduct = async (id: number, data: any): Promise<ApiResponse> => {
    const res = await apiFetch(`/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
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