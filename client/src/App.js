import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BranchProvider } from './context/BranchContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import SuperAdminLayout from './components/SuperAdminLayout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ApplicationStatus from './pages/ApplicationStatus';
import Dashboard from './pages/Dashboard';
import CashierPOS from './pages/CashierPOS';
import Inventory from './pages/Inventory';
import Staff from './pages/Staff';
import Reports from './pages/Reports';
import Audit from './pages/Audit';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';
import SuperAdminDashboard from './pages/superadmin/Dashboard';
import SuperAdminApplications from './pages/superadmin/Applications';
import SuperAdminTenants from './pages/superadmin/Tenants';
import SuperAdminAnalytics from './pages/superadmin/Analytics';
import ManagerLayout from './components/ManagerLayout';
import OwnerLayout from './components/OwnerLayout';
import {
  ManagerDashboard,
  ManagerEmployees,
  ManagerCustomers,
  ManagerSales,
  ManagerInventory,
  ManagerRequests,
  ManagerExpenses
} from './pages/manager';
import {
  OwnerDashboard,
  OwnerSales,
  OwnerInventory,
  OwnerStaff,
  OwnerCustomers,
  OwnerRequests,
  OwnerExpenses,
  OwnerActivityLogs,
  OwnerReports,
  OwnerBranches,
  OwnerSettings
} from './pages/owner';
import './App.css';

// Role-based Dashboard component
const RoleBasedDashboard = () => {
  const { user, isCashier, isManager, isOwner } = useAuth();

  // Cashiers get the POS interface
  if (isCashier()) {
    return <CashierPOS />;
  }

  // Managers get redirected to manager dashboard
  if (isManager()) {
    return <Navigate to="/manager/dashboard" replace />;
  }

  // Owners get redirected to owner dashboard
  if (isOwner()) {
    return <Navigate to="/owner/dashboard" replace />;
  }

  // Fallback to regular dashboard
  return (
    <Layout>
      <Dashboard />
    </Layout>
  );
};

const AppRoutes = () => {
  const { user, loading, isSuperAdmin, isCashier, isManager, isOwner } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Determine default redirect based on user type
  const getDefaultRedirect = () => {
    if (!user) return '/login';
    if (isSuperAdmin()) return '/super-admin/dashboard';
    if (isOwner()) return '/owner/dashboard';
    if (isManager()) return '/manager/dashboard';
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
      <Route
        path="/super-admin/analytics"
        element={
          <PrivateRoute requireSuperAdmin>
            <SuperAdminLayout>
              <SuperAdminAnalytics />
            </SuperAdminLayout>
          </PrivateRoute>
        }
      />

      {/* Manager routes */}
      <Route
        path="/manager/dashboard"
        element={
          <PrivateRoute>
            <ManagerLayout>
              <ManagerDashboard />
            </ManagerLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/manager/employees"
        element={
          <PrivateRoute>
            <ManagerLayout>
              <ManagerEmployees />
            </ManagerLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/manager/customers"
        element={
          <PrivateRoute>
            <ManagerLayout>
              <ManagerCustomers />
            </ManagerLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/manager/sales"
        element={
          <PrivateRoute>
            <ManagerLayout>
              <ManagerSales />
            </ManagerLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/manager/inventory"
        element={
          <PrivateRoute>
            <ManagerLayout>
              <ManagerInventory />
            </ManagerLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/manager/requests"
        element={
          <PrivateRoute>
            <ManagerLayout>
              <ManagerRequests />
            </ManagerLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/manager/expenses"
        element={
          <PrivateRoute>
            <ManagerLayout>
              <ManagerExpenses />
            </ManagerLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/manager/pos"
        element={
          <PrivateRoute>
            <ManagerLayout>
              <CashierPOS managerView={true} />
            </ManagerLayout>
          </PrivateRoute>
        }
      />

      {/* Owner routes - wrapped in BranchProvider */}
      <Route
        path="/owner/dashboard"
        element={
          <PrivateRoute requireOwner>
            <BranchProvider>
              <OwnerLayout>
                <OwnerDashboard />
              </OwnerLayout>
            </BranchProvider>
          </PrivateRoute>
        }
      />
      <Route
        path="/owner/sales"
        element={
          <PrivateRoute requireOwner>
            <BranchProvider>
              <OwnerLayout>
                <OwnerSales />
              </OwnerLayout>
            </BranchProvider>
          </PrivateRoute>
        }
      />
      <Route
        path="/owner/inventory"
        element={
          <PrivateRoute requireOwner>
            <BranchProvider>
              <OwnerLayout>
                <OwnerInventory />
              </OwnerLayout>
            </BranchProvider>
          </PrivateRoute>
        }
      />
      <Route
        path="/owner/staff"
        element={
          <PrivateRoute requireOwner>
            <BranchProvider>
              <OwnerLayout>
                <OwnerStaff />
              </OwnerLayout>
            </BranchProvider>
          </PrivateRoute>
        }
      />
      <Route
        path="/owner/customers"
        element={
          <PrivateRoute requireOwner>
            <BranchProvider>
              <OwnerLayout>
                <OwnerCustomers />
              </OwnerLayout>
            </BranchProvider>
          </PrivateRoute>
        }
      />
      <Route
        path="/owner/requests"
        element={
          <PrivateRoute requireOwner>
            <BranchProvider>
              <OwnerLayout>
                <OwnerRequests />
              </OwnerLayout>
            </BranchProvider>
          </PrivateRoute>
        }
      />
      <Route
        path="/owner/expenses"
        element={
          <PrivateRoute requireOwner>
            <BranchProvider>
              <OwnerLayout>
                <OwnerExpenses />
              </OwnerLayout>
            </BranchProvider>
          </PrivateRoute>
        }
      />
      <Route
        path="/owner/activity"
        element={
          <PrivateRoute requireOwner>
            <BranchProvider>
              <OwnerLayout>
                <OwnerActivityLogs />
              </OwnerLayout>
            </BranchProvider>
          </PrivateRoute>
        }
      />
      <Route
        path="/owner/reports"
        element={
          <PrivateRoute requireOwner>
            <BranchProvider>
              <OwnerLayout>
                <OwnerReports />
              </OwnerLayout>
            </BranchProvider>
          </PrivateRoute>
        }
      />
      <Route
        path="/owner/branches"
        element={
          <PrivateRoute requireOwner>
            <BranchProvider>
              <OwnerLayout>
                <OwnerBranches />
              </OwnerLayout>
            </BranchProvider>
          </PrivateRoute>
        }
      />
      <Route
        path="/owner/settings"
        element={
          <PrivateRoute requireOwner>
            <BranchProvider>
              <OwnerLayout>
                <OwnerSettings />
              </OwnerLayout>
            </BranchProvider>
          </PrivateRoute>
        }
      />
      <Route
        path="/owner/pos"
        element={
          <PrivateRoute requireOwner>
            <BranchProvider>
              <OwnerLayout>
                <CashierPOS managerView={true} />
              </OwnerLayout>
            </BranchProvider>
          </PrivateRoute>
        }
      />

      {/* Dashboard - Role-based */}
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <RoleBasedDashboard />
          </PrivateRoute>
        }
      />

      {/* Inventory - Owner, Manager */}
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

      {/* Staff - Owner, Manager */}
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

      {/* Reports - Owner, Manager */}
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

      {/* Expenses - Owner, Manager */}
      <Route
        path="/expenses"
        element={
          <PrivateRoute requireAdmin>
            <Layout>
              <Expenses />
            </Layout>
          </PrivateRoute>
        }
      />

      {/* Audit - Owner only */}
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

      {/* Settings - Owner only */}
      <Route
        path="/settings"
        element={
          <PrivateRoute requireAdmin>
            <Layout>
              <Settings />
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
