// frontend/src/hooks/useDataFetcher.ts

import { useCallback, useEffect, useState } from "react";

interface FetchState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Generalized hook for fetching and managing API data lists.
 * @param fetchFunction The asynchronous function that fetches the data (e.g., fetchCustomers).
 * @param initialData An optional array for initial state.
 * @returns {FetchState<T>} State including data, loading status, error, and a refresh function.
 */
export const useDataFetcher = <T>(
  fetchFunction: () => Promise<T[]>,
  initialData: T[] = [],
): FetchState<T> => {
  const [data, setData] = useState<T[]>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFunction();
      setData(result);
    } catch (err) {
      console.error("Data fetch error:", err);
      setError(
        err instanceof Error ? err.message : "An unknown fetch error occurred.",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchFunction]);

  useEffect(() => {
    fetchData();
  }, [fetchData, fetchCount]);

  // Function to manually trigger a re-fetch
  const refresh = () => setFetchCount((prev) => prev + 1);

  return { data, loading, error, refresh };
};
