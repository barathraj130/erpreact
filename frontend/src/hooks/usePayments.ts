// frontend/src/hooks/usePayments.ts
import { useCallback, useEffect, useState } from "react";
import {
    createPayment,
    CreatePaymentData,
    deletePayment,
    fetchInvoicePayments,
    fetchPayments,
    fetchPaymentSummary,
    Payment,
    PaymentSummary,
    updatePayment
} from "../api/paymentApi";

interface UsePaymentsOptions {
    invoiceId?: number;
    autoFetch?: boolean;
}

export const usePayments = (options: UsePaymentsOptions = {}) => {
    const { invoiceId, autoFetch = true } = options;
    
    const [payments, setPayments] = useState<Payment[]>([]);
    const [invoicePayments, setInvoicePayments] = useState<PaymentSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadPayments = useCallback(async (filters?: {
        invoice_id?: number;
        customer_id?: number;
        start_date?: string;
        end_date?: string;
        payment_method?: string;
    }) => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchPayments(filters);
            setPayments(data);
            return data;
        } catch (err: any) {
            setError(err.message);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const loadInvoicePayments = useCallback(async (invId: number) => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchInvoicePayments(invId);
            setInvoicePayments(data);
            return data;
        } catch (err: any) {
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const addPayment = useCallback(async (data: CreatePaymentData) => {
        setLoading(true);
        setError(null);
        try {
            const result = await createPayment(data);
            if (data.invoice_id) {
                await loadInvoicePayments(data.invoice_id);
            }
            return result;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [loadInvoicePayments]);

    const editPayment = useCallback(async (paymentId: number, data: Partial<CreatePaymentData>) => {
        setLoading(true);
        setError(null);
        try {
            const result = await updatePayment(paymentId, data);
            if (invoicePayments?.invoice_id) {
                await loadInvoicePayments(invoicePayments.invoice_id);
            }
            return result;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [invoicePayments, loadInvoicePayments]);

    const removePayment = useCallback(async (paymentId: number) => {
        setLoading(true);
        setError(null);
        try {
            const result = await deletePayment(paymentId);
            if (result.invoice_id) {
                await loadInvoicePayments(result.invoice_id);
            }
            return result;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [loadInvoicePayments]);

    useEffect(() => {
        if (autoFetch && invoiceId) {
            loadInvoicePayments(invoiceId);
        }
    }, [autoFetch, invoiceId, loadInvoicePayments]);

    return {
        payments,
        invoicePayments,
        loading,
        error,
        loadPayments,
        loadInvoicePayments,
        addPayment,
        editPayment,
        removePayment,
        totalPaid: invoicePayments?.total_paid || 0,
        balanceDue: invoicePayments?.balance_due || 0,
        paymentStatus: invoicePayments?.status || 'UNPAID'
    };
};

export const usePaymentSummary = () => {
    const [summary, setSummary] = useState<{
        by_method: Array<{ payment_method: string; count: number; total: number }>;
        daily_totals: Array<{ date: string; count: number; total: number }>;
        totals: { total_payments: number; total_received: number };
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadSummary = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchPaymentSummary();
            setSummary(data);
            return data;
        } catch (err: any) {
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSummary();
    }, [loadSummary]);

    return { summary, loading, error, refresh: loadSummary };
};

export default usePayments;