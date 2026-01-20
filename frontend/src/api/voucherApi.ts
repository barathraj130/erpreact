// frontend/src/api/voucherApi.ts

import { apiFetch } from '../utils/api';

export interface Voucher {
    id: number;
    voucher_number: string;
    voucher_type: 'Payment' | 'Receipt' | 'Journal' | 'Contra';
    date: string;
    total_amount: number;
    notes: string;
}

/**
 * Fetches a list of vouchers.
 */
export const fetchVouchers = async (type?: Voucher['voucher_type']): Promise<Voucher[]> => {
    const query = type ? `?type=${type}` : '';
    const res = await apiFetch(`/voucher${query}`); 
    return res.json();
};

/**
 * Creates a new voucher (Payment, Receipt, Journal, Contra).
 */
export const createVoucher = async (data: any): Promise<{ id: number, message: string }> => {
    const res = await apiFetch('/voucher', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return res.json();
};