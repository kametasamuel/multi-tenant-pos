import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import SuperAdminLayout from './components/SuperAdminLayout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ApplicationStatus from './pages/ApplicationStatus';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Staff from './pages/Staff';
import Reports from './pages/Reports';
import Audit from './pages/Audit';
import SuperAdminDashboard from './pages/superadmin/Dashboard';
import SuperAdminApplications from './pages/superadmin/Applications';
import SuperAdminTenants from './pages/superadmin/Tenants';
import './App.css';

const AppRoutes = () => {
  const { user, loading, isSuperAdmin } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  // Determine default redirect based on user type
  const getDefaultRedirect = () => {
    if (!user) return '/login';
    if (isSuperAdmin()) return '/super-admin/dashboard';
    return '/dashboard';
  };

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={!user ? <Login /> : <Navigate to={getDefaultRedirect()} />}
      />
      <Route path="/signup" element={<Signup />} />
      <Route path="/application-status" element={<ApplicationStatus />} />

      {/* Super Admin routes */}
      <Route
        path="/super-admin/dashboard"
        element={
          <PrivateRoute requireSuperAdmin>
            <SuperAdminLayout>
              <SuperAdminDashboard />
            </SuperAdminLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/super-admin/applications"
        element={
          <PrivateRoute requireSuperAdmin>
            <SuperAdminLayout>
              <SuperAdminApplications />
            </SuperAdminLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/super-admin/tenants"
        element={
          <PrivateRoute requireSuperAdmin>
            <SuperAdminLayout>
              <SuperAdminTenants />
            </SuperAdminLayout>
          </PrivateRoute>
        }
      />

      {/* Regular tenant routes */}
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <PrivateRoute requireAdmin>
            <Layout>
              <Inventory />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/staff"
        element={
          <PrivateRoute requireAdmin>
            <Layout>
              <Staff />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <PrivateRoute requireAdmin>
            <Layout>
              <Reports />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/audit"
        element={
          <PrivateRoute requireAdmin>
            <Layout>
              <Audit />
            </Layout>
          </PrivateRoute>
        }
      />

      {/* Default route */}
      <Route path="/" element={<Navigate to={getDefaultRedirect()} />} />
      <Route path="*" element={<Navigate to={getDefaultRedirect()} />} />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
