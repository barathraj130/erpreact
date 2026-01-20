// frontend/src/api/userApi.ts

import { apiFetch } from '../utils/api';

// --- Type Definitions for Customer/Party ---

export interface Customer {
    id: number;
    username: string;
    nickname?: string; // <--- Added this optional property
    email: string;
    phone?: string;
    company?: string;
    initial_balance: number;
    remaining_balance: number; // Calculated field from backend SQL
    address_line1?: string;
    address_line2?: string;
    city_pincode?: string;
    state?: string;
    gstin?: string;
    state_code?: string;
    created_at: string;
}

interface ApiResponse {
    message: string;
    user?: Customer;
    id?: number;
}

// --- API Functions (CRUD) ---

/**
 * Fetches all non-admin users (Customers/Parties) for the active company.
 */
export const fetchCustomers = async (): Promise<Customer[]> => {
    const res = await apiFetch('/users'); 
    return res.json();
};

/**
 * Creates a new user/party and its associated accounting ledger.
 */
export const createCustomer = async (data: any): Promise<ApiResponse> => {
    const res = await apiFetch('/users', { 
        method: 'POST', 
        body: JSON.stringify(data) 
    });
    return res.json();
};

/**
 * Updates an existing user/party and its associated accounting ledger.
 */
export const updateCustomer = async (id: number, data: any): Promise<ApiResponse> => {
    const res = await apiFetch(`/users/${id}`, { 
        method: 'PUT', 
        body: JSON.stringify(data) 
    });
    return res.json();
};

/**
 * Deletes a user/party and its associated accounting ledger and links.
 */
export const deleteCustomer = async (id: number): Promise<ApiResponse> => {
    const res = await apiFetch(`/users/${id}`, { 
        method: 'DELETE',
    });
    return res.json();
};