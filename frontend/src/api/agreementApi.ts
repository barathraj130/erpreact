// frontend/src/api/agreementApi.ts

import { apiFetch } from '../utils/api';

export interface BusinessAgreement {
    id: number;
    company_id: number;
    lender_id: number;
    agreement_type: 'LOAN' | 'CHIT' | 'LEASE';
    total_amount: number;
    interest_rate: number;
    emi_amount: number;
    duration_months: number;
    start_date: string;
    status: 'Active' | 'Closed' | 'Settled';
    details?: string;
}

interface ApiResponse {
    message: string;
    agreement?: BusinessAgreement;
    id?: number;
}

/**
 * Fetches all business agreements (loans, chits, etc.).
 */
export const fetchAgreements = async (): Promise<BusinessAgreement[]> => {
    const res = await apiFetch('/business-agreements'); 
    return res.json();
};

/**
 * Creates a new agreement.
 */
export const createAgreement = async (data: any): Promise<ApiResponse> => {
    const res = await apiFetch('/business-agreements', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return res.json();
};