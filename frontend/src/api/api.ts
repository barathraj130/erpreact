// frontend/src/api/api.ts
import { getAccessToken } from '../hooks/useSecureAuth';

const port = 3001;
const hostname = window.location.hostname;
const API_BASE_URL = `http://${hostname}:${port}/api`;

export const apiFetch = async (
  endpoint: string,
  options: any = {},
  isJsonRequest: boolean = true,
): Promise<Response> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAccessToken();

  let defaultHeaders: Record<string, string> = {
    "X-Branch-Id": localStorage.getItem("branch_id") || "1"
  };

  if (token) {
    defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  let finalBody = options.body;
  if (isJsonRequest && options.body && !(options.body instanceof FormData)) {
    defaultHeaders["Content-Type"] = "application/json";
    finalBody = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    ...options,
    headers: { ...defaultHeaders, ...options.headers },
    body: finalBody,
    credentials: "include", // Required for httpOnly cookies
  });

  if (res.status === 401 && !endpoint.includes('/jwt-auth/refresh')) {
    console.warn("Session expired or invalid");
    // The useSecureAuth hook's refresh mechanism should handle this, 
    // but if it fails, the user will eventually be logged out by the state change.
  }

  return res;
};
