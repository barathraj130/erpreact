// frontend/src/utils/api.ts

interface FetchOptions extends Omit<RequestInit, "headers" | "body"> {
  headers?: Record<string, string>;
  body?: any;
}

const port = 3000;
const hostname = window.location.hostname;
const API_BASE_URL =
  import.meta.env.VITE_API_URL || `http://${hostname}:${port}/api`;

// Prevents multiple concurrent refresh attempts
let isRefreshing = false;

/**
 * Attempt a silent token refresh using the stored refresh token.
 * Returns the new access token string on success, or null on failure.
 */
const tryRefreshToken = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem("erp-refresh-token");
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.accessToken) {
        localStorage.setItem("erp-token", data.accessToken);
        return data.accessToken;
      }
    }
  } catch {
    // Network error during refresh — fall through
  }

  return null;
};

/**
 * Clear all auth state and redirect to login.
 */
const forceLogout = () => {
  localStorage.removeItem("erp-token");
  localStorage.removeItem("erp-refresh-token");
  // Use replace so the user can't navigate back to the expired page
  window.location.replace("/login");
};

export const apiFetch = async (
  endpoint: string,
  options: FetchOptions = {},
  isJsonRequest: boolean = true,
  _isRetry: boolean = false, // internal flag — prevents infinite refresh loops
): Promise<Response> => {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem("erp-token");
  const branchId = localStorage.getItem("active-branch-id");

  let defaultHeaders: Record<string, string> = {};

  // Don't send token on login endpoint to prevent header-size issues from stale tokens
  if (token && endpoint !== "/auth/login") {
    defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  if (branchId) {
    defaultHeaders["x-branch-id"] = branchId;
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

    if (res.status === 401 && !_isRetry && endpoint !== "/auth/login") {
      console.warn(`⚠️ API 401 Unauthorized for ${endpoint} — attempting token refresh`);

      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await tryRefreshToken();
        isRefreshing = false;

        if (newToken) {
          // Retry the original request once with the refreshed token
          console.info("🔄 Token refreshed — retrying request");
          return apiFetch(endpoint, options, isJsonRequest, true);
        }
      }

      // Refresh failed or no refresh token — session is truly dead
      console.warn("🔒 Session expired and refresh failed — redirecting to login");
      forceLogout();
    }

    return res;
  } catch (err: any) {
    console.error("❌ Network Request Failed:", err);
    // Throwing error allows the calling component (App.tsx) to display the "Network Error" screen
    throw new Error("Network Error: Is the backend running?");
  }
};
