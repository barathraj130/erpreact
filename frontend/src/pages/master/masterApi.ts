// Standalone fetch helper for the Fluxora Master panel — deliberately does NOT
// use the shared apiFetch() from utils/api.ts, since that attaches the tenant
// "erp-token" automatically. The master panel is a completely separate
// credential system (master_token) and must never mix the two.
const port = 3000;
const hostname = window.location.hostname;
const API_BASE_URL = import.meta.env.VITE_API_URL || `http://${hostname}:${port}/api`;

type MasterFetchOptions = Omit<RequestInit, "body"> & { body?: BodyInit | Record<string, unknown> | null };

export const masterFetch = (path: string, options: MasterFetchOptions = {}) => {
  const token = localStorage.getItem("master_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  const body = options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body;
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers, body } as RequestInit);
};
