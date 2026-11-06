// frontend/src/context/AuthContext.jsx
// User authentication and session management context.

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load current user profile from backend
  const fetchUser = useCallback(async () => {
    try {
      const res = await authApi.getMe();
      if (res.data?.success) {
        setUser(res.data.data.user);
        setConnectedAccounts(res.data.data.connectedAccounts || []);
      }
    } catch {
      setUser(null);
      setConnectedAccounts([]);
      localStorage.removeItem('mm_token');
    } finally {
      setLoading(false);
    }
  }, []);

  // Check URL parameters for OAuth token callback and initialize
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');

    if (tokenFromUrl) {
      localStorage.setItem('mm_token', tokenFromUrl);
      // Clean up URL without triggering reloads
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    const token = localStorage.getItem('mm_token');
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  // Initiate Google OAuth login
  const loginWithGoogle = async () => {
    try {
      const res = await authApi.getGoogleAuthUrl();
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        // Fallback: navigate directly to the backend route
        window.location.href = '/api/auth/google';
      }
    } catch {
      window.location.href = '/api/auth/google';
    }
  };

  // Logout
  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('[AuthContext] Logout warning:', err.message);
    } finally {
      localStorage.removeItem('mm_token');
      setUser(null);
      setConnectedAccounts([]);
    }
  };

  const primaryAccount = connectedAccounts.find((a) => a.connectionStatus === 'connected') || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        connectedAccounts,
        primaryAccount,
        isAuthenticated: Boolean(user),
        loading,
        fetchUser,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
