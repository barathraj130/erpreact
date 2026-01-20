// frontend/src/hooks/useAuthUser.ts
import { useEffect, useState } from "react";
import { getCurrentUser } from "../api/authApi";

export function useAuthUser() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function loadUser() {
            setLoading(true);
            try {
                const data = await getCurrentUser();
                if (isMounted) {
                    if (data) {
                        setUser(data);
                    } else {
                        // Only throw if data is explicitly null (meaning 401/404)
                        throw new Error("User not found");
                    }
                }
            } catch (err: any) {
                console.error("Auth Hook Error:", err);
                if (isMounted) setError(err.message || "Failed to load user");
                // Do NOT automatically clear token here to allow debugging
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        
        // Only load if token exists
        const token = localStorage.getItem("erp-token");
        if(token) {
            loadUser();
        } else {
            setLoading(false);
        }

        return () => { isMounted = false; };
    }, []);

    return { user, loading, error };
}