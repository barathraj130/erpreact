// frontend/src/hooks/useUsers.ts - module verified

import { useCallback, useEffect, useState } from "react";
import { Customer, fetchCustomers } from "../api/userApi";

interface UseUsersState {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Custom React Hook to fetch and manage the state of all customers/parties.
 * Replaces the monolithic usersDataCache loading logic.
 */
export const useUsers = (): UseUsersState => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomers();

      // Assuming the backend already filters out the 'admin' user.
      setCustomers(data);
    } catch (err) {
      console.error("Failed to load users:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while fetching user data.",
      );
      setCustomers([]); // Clear data on failure
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data only on initial component mount
  useEffect(() => {
    loadData();
  }, [loadData]); // Dependency array ensures hook runs only when loadData definition changes (i.e., rarely)

  return { customers, loading, error, refresh: loadData };
};
