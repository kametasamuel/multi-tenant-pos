import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children, requireAdmin = false, requireOwner = false, requireSuperAdmin = false }) => {
  const { slug } = useParams();
  const { user, loading, isAdmin, isOwner, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Get the appropriate slug for redirects
  const getSlug = () => {
    if (user?.tenantSlug) return user.tenantSlug;
    if (user?.isSuperAdmin) return 'admin';
    return slug || 'admin';
  };

  const currentSlug = getSlug();

  if (!user) {
    return <Navigate to={`/${currentSlug}/login`} />;
  }

  // Super admin only route
  if (requireSuperAdmin && !isSuperAdmin()) {
    return <Navigate to={`/${currentSlug}/dashboard`} />;
  }

  // Owner only route (OWNER or ADMIN role)
  if (requireOwner && !isOwner()) {
    return <Navigate to={`/${currentSlug}/dashboard`} />;
  }

  // Admin route (includes super admin)
  if (requireAdmin && !isAdmin()) {
    return <Navigate to={`/${currentSlug}/dashboard`} />;
  }

  return children;
};

export default PrivateRoute;
