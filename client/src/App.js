import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfflineProvider } from './context/OfflineContext';
import TenantRoutes from './components/TenantRoutes';
import Signup from './pages/Signup';
import ApplicationStatus from './pages/ApplicationStatus';
import ResetPassword from './pages/ResetPassword';
import './App.css';

// Landing page - redirects to appropriate location
const LandingRedirect = () => {
  const { user, loading, isSuperAdmin, isOwner, isManager } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If user is logged in, redirect to their tenant dashboard
  if (user) {
    const slug = user.tenantSlug || (user.isSuperAdmin ? 'admin' : null);

    if (slug) {
      if (user.isSuperAdmin) {
        return <Navigate to="/admin/dashboard" replace />;
      } else if (isOwner()) {
        return <Navigate to={`/${slug}/owner/dashboard`} replace />;
      } else if (isManager()) {
        return <Navigate to={`/${slug}/manager/dashboard`} replace />;
      } else {
        return <Navigate to={`/${slug}/dashboard`} replace />;
      }
    }
  }

  // Not logged in - show a landing page or redirect to signup
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
          <span className="text-4xl">💼</span>
        </div>
        <h1 className="text-3xl font-black text-white mb-3">Smart POS</h1>
        <p className="text-slate-400 mb-8">
          Business management system for retail, salons, restaurants and more.
        </p>
        <div className="space-y-3">
          <a
            href="/signup"
            className="block w-full py-3 px-6 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-colors"
          >
            Start Your Business
          </a>
          <a
            href="/admin/login"
            className="block w-full py-3 px-6 bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-600 transition-colors"
          >
            Admin Login
          </a>
        </div>
        <p className="text-slate-500 text-sm mt-8">
          Already have an account? Use your business URL to login.
        </p>
      </div>
    </div>
  );
};

const AppRoutes = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/signup" element={<Signup />} />
      <Route path="/application-status" element={<ApplicationStatus />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Legacy routes - redirect to new format */}
      <Route path="/login" element={<Navigate to="/admin/login" replace />} />
      <Route path="/super-admin/*" element={<Navigate to="/admin/dashboard" replace />} />

      {/* Tenant routes (/:slug/*) */}
      <Route path="/:slug/*" element={<TenantRoutes />} />

      {/* Root - Landing page */}
      <Route path="/" element={<LandingRedirect />} />

      {/* Catch all - redirect to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <OfflineProvider>
          <AppRoutes />
        </OfflineProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
