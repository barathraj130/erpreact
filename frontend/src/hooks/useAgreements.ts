// frontend/src/hooks/useAgreements.ts

import { useCallback, useEffect, useState } from 'react';
import { BusinessAgreement, fetchAgreements } from '../api/agreementApi';

interface UseAgreementsState {
    agreements: BusinessAgreement[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

/**
 * Custom React Hook to fetch and manage the state of all Business Agreements (Loans, Chits).
 */
export const useAgreements = (): UseAgreementsState => {
    const [agreements, setAgreements] = useState<BusinessAgreement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAgreements();
            setAgreements(data);
        } catch (err) {
            console.error("Failed to load agreements:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred while fetching agreement data.");
            setAgreements([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]); 

    return { agreements, loading, error, refresh: loadData };
};