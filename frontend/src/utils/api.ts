// frontend/src/utils/api.ts

interface FetchOptions extends Omit<RequestInit, 'headers' | 'body'> {
    headers?: Record<string, string>;
    body?: any; 
}

const API_BASE_URL = "http://localhost:3000/api";

export const apiFetch = async (
    endpoint: string,
    options: FetchOptions = {},
    isJsonRequest: boolean = true
): Promise<Response> => {

    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem("erp-token");

    let defaultHeaders: Record<string, string> = {};

    if (token) {
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
        });

        // ✅ CRITICAL: Do NOT redirect here. 
        // Just log the warning so we can see it in the console.
        if (res.status === 401) {
            console.warn(`⚠️ API 401 Unauthorized for ${endpoint}`);
        }

        return res;
    } catch (err: any) {
        console.error("❌ Network Request Failed:", err);
        // Throwing error allows the calling component (App.tsx) to display the "Network Error" screen
        throw new Error("Network Error: Is the backend running?");
    }
};