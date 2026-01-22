import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children, requireAdmin = false, requireOwner = false, requireSuperAdmin = false }) => {
  const { user, loading, isAdmin, isOwner, isSuperAdmin } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Super admin only route
  if (requireSuperAdmin && !isSuperAdmin()) {
    return <Navigate to="/dashboard" />;
  }

  // Owner only route (OWNER or ADMIN role)
  if (requireOwner && !isOwner()) {
    return <Navigate to="/dashboard" />;
  }

  // Admin route (includes super admin)
  if (requireAdmin && !isAdmin()) {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

export default PrivateRoute;
