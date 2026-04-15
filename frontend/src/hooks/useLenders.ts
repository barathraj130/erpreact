// frontend/src/hooks/useLenders.ts
// Resolves the TypeScript error in Suppliers.tsx

import { useCallback, useEffect, useState } from "react";
import { Lender, fetchLenders } from "../api/lenderApi";

interface UseLendersState {
  lenders: Lender[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Custom React Hook to fetch and manage the state of all Lenders/Suppliers.
 */
export const useLenders = (): UseLendersState => {
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLenders();
      setLenders(data);
    } catch (err) {
      console.error("Failed to load lenders:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while fetching supplier data.",
      );
      setLenders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data only on initial component mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  return { lenders, loading, error, refresh: loadData };
};
