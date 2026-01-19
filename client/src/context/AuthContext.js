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

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      if (savedToken && savedUser) {
        try {
          const response = await authAPI.getMe();
          setUser(response.data.user);
          setToken(savedToken);
        } catch (error) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const response = await authAPI.login(username, password);
      const { token: newToken, user: newUser } = response.data;

      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));

      setToken(newToken);
      setUser(newUser);

      return { success: true, user: newUser };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const isAdmin = () => user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.isSuperAdmin;
  const isOwner = () => user?.role === 'OWNER' || user?.role === 'ADMIN';
  const isManager = () => user?.role === 'MANAGER';
  const isCashier = () => user?.role === 'CASHIER';
  const isSuperAdmin = () => user?.isSuperAdmin === true;
  const canViewAnalytics = () => user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'MANAGER' || user?.isSuperAdmin;

  const value = {
    user,
    token,
    login,
    logout,
    isAdmin,
    isOwner,
    isManager,
    isCashier,
    isSuperAdmin,
    canViewAnalytics,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
