// frontend/src/hooks/useSecureAuth.ts
import { useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { User } from '../types';

let memoryToken: string | null = null; // Memory-only storage

export function useSecureAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/jwt-auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (res.ok) {
        const data = await res.json();
        memoryToken = data.accessToken;
        const decoded: any = jwtDecode(memoryToken!);
        setUser(decoded.user);
        
        // Schedule next refresh 1 min before expiry
        const expiry = decoded.exp * 1000;
        const timeout = expiry - Date.now() - 60000;
        setTimeout(refresh, Math.max(timeout, 0));
        
        return memoryToken;
      } else {
        throw new Error("Refresh failed");
      }
    } catch (err) {
      memoryToken = null;
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      await refresh();
      setLoading(false);
    };
    initAuth();
  }, [refresh]);

  const logout = async () => {
    await fetch('/api/jwt-auth/logout', { method: 'POST' });
    memoryToken = null;
    setUser(null);
    window.location.href = '/login';
  };

  return {
    user,
    accessToken: memoryToken,
    loading,
    isAdmin: user?.role === 'admin' || user?.role === 'superadmin',
    logout
  };
}

export const getAccessToken = () => memoryToken;
