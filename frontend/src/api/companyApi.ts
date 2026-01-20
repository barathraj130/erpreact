// frontend/src/api/companyApi.ts

import { apiFetch } from '../utils/api';

export interface CompanyProfile {
    id: number;
    company_name: string;
    gstin: string | null;
    address_line1: string | null;
    city_pincode: string | null;
    state: string | null;
    phone: string | null;
    email: string | null;
    bank_name: string | null;
    bank_account_no: string | null;
    bank_ifsc_code: string | null;
    signature_url?: string | null;
}

export interface BankAccount {
    id: number;
    bank_name: string;
    account_number: string;
    ifsc_code: string;
    account_type: string;
    is_default: boolean | number;
}

/**
 * Fetches the current active company profile.
 * GET /api/company/profile
 */
export const fetchProfile = async (): Promise<CompanyProfile> => {
    const res = await apiFetch('/company/profile');
    if (!res.ok) {
        throw new Error('Failed to fetch company profile');
    }
    return res.json();
};

/**
 * Updates the company profile details.
 * PUT /api/company/profile
 */
export const updateProfile = async (data: Partial<CompanyProfile>): Promise<{ message: string }> => {
    const res = await apiFetch('/company/profile', {
        method: 'PUT',
        body: data, 
    });
    
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update profile');
    }
    
    return res.json();
};

/**
 * Fetches all additional bank accounts linked to the company.
 * GET /api/company/bank-accounts
 */
export const fetchBankAccounts = async (): Promise<BankAccount[]> => {
    const res = await apiFetch('/company/bank-accounts');
    return res.json();
};

/**
 * Creates a new bank account entry.
 * POST /api/company/bank-accounts
 */
export const createBankAccount = async (data: any): Promise<{ id: number; message: string }> => {
    const res = await apiFetch('/company/bank-accounts', {
        method: 'POST',
        body: data,
    });
    return res.json();
};

/**
 * Deletes a bank account entry.
 * DELETE /api/company/bank-accounts/:id
 */
export const deleteBankAccount = async (id: number): Promise<{ message: string }> => {
    const res = await apiFetch(`/company/bank-accounts/${id}`, {
        method: 'DELETE',
    });
    return res.json();
};