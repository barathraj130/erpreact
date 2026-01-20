// frontend/src/api/invoiceApi.ts

import { apiFetch } from '../utils/api';

export interface Invoice {
    id: number;
    // --- Fields matching the corrected DB schema ---
    invoice_number: string;
    invoice_date: string; // The primary date field
    due_date: string;
    total_amount: number; // The primary total field
    // ----------------------------------------------
    
    customer_id: number;
    customer_name: string;
    paid_amount: number;
    // FIX: Added 'PENDING' to status enum to resolve TypeScript error
    status: 'Draft' | 'Sent' | 'Paid' | 'Partially Paid' | 'Overdue' | 'Void' | 'SALES_RETURN' | 'PENDING'; 
    invoice_type: 'TAX_INVOICE' | 'BILL_OF_SUPPLY' | 'SALES_RETURN' | 'PARTY_BILL' | 'NON_GST_RETAIL_BILL' | 'N/A';
    notes?: string | null;
}

export const fetchInvoices = async (): Promise<Invoice[]> => {
    // Calls the backend endpoint /api/invoice
    const res = await apiFetch('/invoice'); 
    return res.json();
};