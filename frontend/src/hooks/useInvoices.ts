// frontend/src/hooks/useInvoices.ts

import { useCallback, useEffect, useState } from "react";
import { Invoice, fetchInvoices } from "../api/invoiceApi";

interface UseInvoicesState {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useInvoices = (): UseInvoicesState => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInvoices();
      // Sort locally by date for a consistent display (descending)
      const sortedData = data.sort(
        (a, b) =>
          new Date(b.invoice_date).getTime() -
          new Date(a.invoice_date).getTime(),
      );
      setInvoices(sortedData);
    } catch (err) {
      console.error("Failed to load invoices:", err);
      setError(
        err instanceof Error ? err.message : "Error fetching invoice data.",
      );
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { invoices, loading, error, refresh: loadData };
};
