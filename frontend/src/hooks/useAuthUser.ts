// frontend/src/hooks/useAuthUser.ts
import { useEffect, useState, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import { User, UserRole } from "../types";

const TOKEN_KEY = "erp-token";

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    window.location.href = "/login";
  }, []);

  const decodeAndSetUser = useCallback((token: string) => {
    try {
      const decoded = jwtDecode<any>(token);
      
      // The backend puts user data in a 'user' property of the payload
      const userData: User = decoded.user || decoded;
      
      // Check for expiry
      const currentTime = Date.now() / 1000;
      if (userData.exp && userData.exp < currentTime) {
        throw new Error("Token expired");
      }

      setUser(userData);
      setError(null);

      // Set up auto-logout timer
      if (userData.exp) {
        const timeout = (userData.exp - currentTime) * 1000;
        const timer = setTimeout(() => {
          console.warn("Session expired. Logging out...");
          logout();
        }, timeout);
        return () => clearTimeout(timer);
      }
    } catch (err: any) {
      console.error("JWT Decode Error:", err);
      setError(err.message || "Invalid session");
      logout();
    }
  }, [logout]);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      const cleanup = decodeAndSetUser(token);
      setLoading(false);
      return cleanup;
    } else {
      setLoading(false);
    }
  }, [decodeAndSetUser]);

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isStaff = user?.role === "staff" || user?.role === "branch_manager" || isAdmin;
  const isCustomer = user?.role === "customer";

  return { 
    user, 
    isAdmin, 
    isStaff, 
    isCustomer, 
    loading, 
    error, 
    logout 
  };
}
