// frontend/src/api/transactionApi.ts

import { apiFetch } from '../utils/api';

export interface Transaction {
    id: number;
    date: string;
    amount: number;
    description: string;
    category: string;
    user_id: number | null;
    lender_id: number | null;
    related_invoice_id: number | null;
    type: 'Debit' | 'Credit'; // Derived from accounting logic
}

/**
 * Fetches a list of core transactions (often used for ledger viewing).
 */
export const fetchTransactions = async (params: { ledgerId?: number, startDate?: string, endDate?: string } = {}): Promise<Transaction[]> => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    const res = await apiFetch(`/transaction?${query}`); 
    return res.json();
};

/**
 * Creates a direct entry transaction (e.g., petty cash expense).
 */
export const createTransaction = async (data: any): Promise<{ id: number, message: string }> => {
    const res = await apiFetch('/transaction', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return res.json();
};