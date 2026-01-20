// frontend/src/utils/api.ts

/**
 * Standard fetch options, excluding headers for controlled logic.
 */
interface FetchOptions extends Omit<RequestInit, 'headers'> {
    // Allows overriding headers, but default token injection happens automatically
    headers?: Record<string, string>; 
}

/**
 * A wrapper around the native fetch API to handle JWT authentication, 
 * base URL, and standardized JSON content types.
 * 
 * @param endpoint The API endpoint path (e.g., '/users/1').
 * @param options Standard FetchOptions.
 * @param isJsonRequest If true (default), sets Content-Type to application/json and stringifies the body.
 *                      Set to false for file uploads (FormData).
 */
export const apiFetch = async (
    endpoint: string, 
    options: FetchOptions = {},
    isJsonRequest: boolean = true // The critical third argument for file uploads
): Promise<Response> => {
    
    // --- 1. Base URL Configuration ---
    // The Vite proxy configuration ensures '/api' routes are directed to the backend.
    const API_BASE_URL = '/api'; 
    const url = `${API_BASE_URL}${endpoint}`;
    
    // --- 2. Authentication (JWT Token) ---
    const token = localStorage.getItem('erp-token');
    
    let defaultHeaders: Record<string, string> = {};

    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    // --- 3. Body and Content Type Handling ---
    let finalBody = options.body;
    
    if (isJsonRequest) {
        defaultHeaders['Content-Type'] = 'application/json';
        // If the body is a JS object/array, stringify it
        if (options.body && typeof options.body !== 'string' && !(options.body instanceof FormData)) {
            finalBody = JSON.stringify(options.body);
        }
    } 
    // If isJsonRequest is false (e.g., for FormData uploads), 
    // we intentionally do NOT set Content-Type, allowing the browser to manage it.

    // --- 4. Merge Headers ---
    // User-provided headers override defaults
    const headers = {
        ...defaultHeaders,
        ...options.headers,
    };

    // --- 5. Perform Fetch ---
    const res = await fetch(url, {
        ...options,
        body: finalBody,
        headers: headers,
    });
    
    // --- 6. Error Handling ---
    if (!res.ok) {
        let errorData: any = {};
        
        // Check if response content type is JSON before trying to parse
        const contentType = res.headers.get("content-type");
        const isResponseJson = contentType && contentType.includes("application/json");

        if (isResponseJson) {
            try {
                // Attempt to parse structured error response from backend
                errorData = await res.json();
            } catch (e) {
                // Ignore JSON parse error if status is bad but body is malformed
                console.error("Failed to parse error response JSON:", e);
            }
        }
        
        // Construct detailed error message
        const errorMessage = errorData.error || errorData.details || `HTTP Error ${res.status}: ${res.statusText}`;
        const error = new Error(errorMessage);
        
        // Attach status and details for specific UI handling if needed
        (error as any).status = res.status;
        (error as any).details = errorData.details;
        
        throw error;
    }

    return res;
};