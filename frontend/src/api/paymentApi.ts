// frontend/src/api/paymentApi.ts
import { apiFetch } from "../utils/api";

export interface Payment {
    id: number;
    invoice_id: number;
    amount: number;
    payment_date: string;
    payment_method: string;
    reference_no?: string;
    notes?: string;
    created_at: string;
    created_by?: number;
    invoice_number?: string;
    customer_name?: string;
}

export interface PaymentSummary {
    invoice_id: number;
    invoice_number: string;
    invoice_total: number;
    total_paid: number;
    balance_due: number;
    payment_count: number;
    payments: Payment[];
    status: 'PAID' | 'PARTIAL' | 'UNPAID';
}

export interface CreatePaymentData {
    invoice_id: number;
    amount: number;
    payment_date?: string;
    payment_method?: string;
    reference_no?: string;
    notes?: string;
}

// Get all payments
export const fetchPayments = async (filters?: {
    invoice_id?: number;
    customer_id?: number;
    start_date?: string;
    end_date?: string;
    payment_method?: string;
}): Promise<Payment[]> => {
    const params = new URLSearchParams();
    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.append(key, String(value));
            }
        });
    }
    
    const queryString = params.toString();
    const url = `/payments${queryString ? `?${queryString}` : ''}`;
    
    const res = await apiFetch(url);
    if (!res.ok) throw new Error("Failed to fetch payments");
    return res.json();
};

// Get payments for specific invoice
export const fetchInvoicePayments = async (invoiceId: number): Promise<PaymentSummary> => {
    const res = await apiFetch(`/payments/invoice/${invoiceId}`);
    if (!res.ok) throw new Error("Failed to fetch invoice payments");
    return res.json();
};

// Create payment
export const createPayment = async (data: CreatePaymentData): Promise<{
    message: string;
    payment: Payment;
    invoice_status: string;
    new_balance_due: number;
}> => {
    const res = await apiFetch("/payments", {
        method: "POST",
        body: data
    });
    
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create payment");
    }
    return res.json();
};

// Update payment
export const updatePayment = async (
    paymentId: number, 
    data: Partial<CreatePaymentData>
): Promise<{ message: string; payment: Payment }> => {
    const res = await apiFetch(`/payments/${paymentId}`, {
        method: "PUT",
        body: data
    });
    
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update payment");
    }
    return res.json();
};

// Delete payment
export const deletePayment = async (paymentId: number): Promise<{
    message: string;
    invoice_id: number;
    new_balance_due: number;
    new_status: string;
}> => {
    const res = await apiFetch(`/payments/${paymentId}`, {
        method: "DELETE"
    });
    
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete payment");
    }
    return res.json();
};

// Get payment summary
export const fetchPaymentSummary = async (): Promise<{
    by_method: Array<{ payment_method: string; count: number; total: number }>;
    daily_totals: Array<{ date: string; count: number; total: number }>;
    totals: { total_payments: number; total_received: number };
}> => {
    const res = await apiFetch("/payments/summary");
    if (!res.ok) throw new Error("Failed to fetch payment summary");
    return res.json();
};