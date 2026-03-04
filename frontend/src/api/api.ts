// frontend/src/utils/api.ts

interface FetchOptions extends Omit<RequestInit, 'headers' | 'body'> {
    headers?: Record<string, string>;
    body?: any; 
}

// Ensure this matches your backend port
const API_BASE_URL = "http://localhost:3001/api";

export const apiFetch = async (
    endpoint: string,
    options: FetchOptions = {},
    isJsonRequest: boolean = true
): Promise<Response> => {

    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem("erp-token");

    let defaultHeaders: Record<string, string> = {};

    if (token && endpoint !== "/auth/login") {
        defaultHeaders["Authorization"] = `Bearer ${token}`;
    }

    let finalBody = options.body;

    if (isJsonRequest) {
        defaultHeaders["Content-Type"] = "application/json";
        if (
            options.body &&
            typeof options.body !== "string" &&
            !(options.body instanceof FormData)
        ) {
            finalBody = JSON.stringify(options.body);
        }
    }

    const headers = {
        ...defaultHeaders,
        ...options.headers,
    };

    try {
        const res = await fetch(url, {
            ...options,
            headers,
            body: finalBody as BodyInit,
            credentials: 'include',
        });

        // ✅ CRITICAL FIX: DO NOT AUTO-REDIRECT HERE.
        // Let the calling component handle the 401 error.
        // This stops the infinite loop.
        if (res.status === 401) {
            console.warn("⚠️ API returned 401 Unauthorized");
            // Optionally clear token, but do NOT reload page
            // localStorage.removeItem("erp-token"); 
        }

        return res;
    } catch (err: any) {
        console.error("❌ Network Request Failed:", err);
        throw new Error("Network Error: Is the backend running?");
    }
};