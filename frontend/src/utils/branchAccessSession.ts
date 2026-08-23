// frontend/src/utils/branchAccessSession.ts
//
// A branch-access session (admin opening a branch's billing dashboard as its
// manager) is deliberately kept in sessionStorage, not localStorage.
// localStorage is shared across every tab on the same origin — writing the
// impersonation token there would silently overwrite the admin's own session
// in their original tab. sessionStorage is per-tab, so the new tab gets its
// own identity without touching the admin's real login anywhere else.
const TOKEN_KEY = "erp-branch-access-token";
const EXPIRES_KEY = "erp-branch-access-expires";

export function getBranchAccessToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiresAt = Number(sessionStorage.getItem(EXPIRES_KEY) || 0);
  if (!token || !expiresAt || Date.now() >= expiresAt) return null;
  return token;
}

export function setBranchAccessSession(token: string, expiresInMs: number): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EXPIRES_KEY, String(Date.now() + expiresInMs));
}

export function clearBranchAccessSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRES_KEY);
}
