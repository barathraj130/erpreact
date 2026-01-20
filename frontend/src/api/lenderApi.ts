// frontend/src/api/lenderApi.ts

import { apiFetch } from '../utils/api';

export interface Lender {
    id: number;
    company_id: number;
    lender_name: string; // The supplier/creditor name
    entity_type: string;
    phone?: string;
    email?: string;
    initial_payable_balance: number;
    remaining_balance: number; // Calculated field (Net Payable/Receivable)
}

interface ApiResponse {
    message: string;
    lender?: Lender;
    id?: number;
}

/**
 * Fetches all lenders (Suppliers/Creditors) for the active company.
 */
export const fetchLenders = async (): Promise<Lender[]> => {
    const res = await apiFetch('/lenders'); 
    return res.json();
};

/**
 * Creates a new lender/supplier and its associated accounting ledger.
 */
export const createLender = async (data: any): Promise<ApiResponse> => {
    const res = await apiFetch('/lenders', { 
        method: 'POST', 
        body: JSON.stringify(data) 
    });
    return res.json();
};

/**
 * Deletes a lender/supplier.
 */
export const deleteLender = async (id: number): Promise<ApiResponse> => {
    const res = await apiFetch(`/lenders/${id}`, { 
        method: 'DELETE',
    });
    return res.json();
};