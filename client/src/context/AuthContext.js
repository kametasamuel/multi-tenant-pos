import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      // Check for impersonation token in URL
      const urlParams = new URLSearchParams(window.location.search);
      const impersonateToken = urlParams.get('impersonate');

      if (impersonateToken) {
        // Use impersonation token
        try {
          localStorage.setItem('token', impersonateToken);
          localStorage.setItem('isImpersonating', 'true');
          setToken(impersonateToken);
          setIsImpersonating(true);

          const response = await authAPI.getMe();
          const impersonatedUser = { ...response.data.user, isImpersonating: true };
          setUser(impersonatedUser);
          localStorage.setItem('user', JSON.stringify(impersonatedUser));

          // Remove impersonate param from URL without refresh
          const url = new URL(window.location.href);
          url.searchParams.delete('impersonate');
          window.history.replaceState({}, '', url.pathname);
        } catch (err) {
          setError('Impersonation failed. Please try again.');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('isImpersonating');
        }
        setLoading(false);
        return;
      }

      // Normal auth init
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      const savedImpersonating = localStorage.getItem('isImpersonating') === 'true';

      if (savedToken && savedUser) {
        try {
          const response = await authAPI.getMe();
          setUser(response.data.user);
          setToken(savedToken);
          setIsImpersonating(savedImpersonating);
        } catch (err) {
          // Session expired or invalid - clear and continue (not an error state)
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('isImpersonating');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username, password, tenantSlug = null) => {
    try {
      const response = await authAPI.login(username, password, tenantSlug);

      if (!response.data) {
        return { success: false, error: 'Invalid server response' };
      }

      const { token: newToken, user: newUser } = response.data;

      if (!newToken || !newUser) {
        return { success: false, error: 'Invalid credentials or server error' };
      }

      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));

      setToken(newToken);
      setUser(newUser);

      return { success: true, user: newUser };
    } catch (err) {
      // Return the specific error from the server if available
      const serverError = err.response?.data?.error;
      const serverMessage = err.response?.data?.message;
      const errorMsg = serverError || serverMessage || 'Invalid username or password';
      setError(errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isImpersonating');
    setToken(null);
    setUser(null);
    setIsImpersonating(false);
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.getMe();
      const updatedUser = response.data.user;
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (err) {
      setError('Failed to refresh user data');
      return null;
    }
  };

  const isAdmin = () => user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.isSuperAdmin;
  const isOwner = () => user?.role === 'OWNER' || user?.role === 'ADMIN';
  const isManager = () => user?.role === 'MANAGER';
  const isCashier = () => user?.role === 'CASHIER';
  const isKitchen = () => user?.role === 'KITCHEN';
  const isSuperAdmin = () => user?.isSuperAdmin === true;
  const canViewAnalytics = () => user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'MANAGER' || user?.isSuperAdmin;
  const clearError = () => setError(null);

  // Business type helpers for salon/services features
  const businessType = user?.businessType || null;
  const isServicesType = () => ['SERVICES', 'SALON'].includes(user?.businessType);
  const hasStylistFeature = () => isServicesType();

  const value = {
    user,
    token,
    login,
    logout,
    refreshUser,
    isAdmin,
    isOwner,
    isManager,
    isCashier,
    isKitchen,
    isSuperAdmin,
    canViewAnalytics,
    businessType,
    isServicesType,
    hasStylistFeature,
    loading,
    isImpersonating,
    error,
    clearError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
