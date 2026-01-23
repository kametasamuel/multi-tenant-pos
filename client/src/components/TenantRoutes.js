import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BranchProvider } from '../context/BranchContext';
import PrivateRoute from './PrivateRoute';
import Layout from './Layout';
import ManagerLayout from './ManagerLayout';
import OwnerLayout from './OwnerLayout';
import SuperAdminLayout from './SuperAdminLayout';
import TenantLogin from '../pages/TenantLogin';
import Dashboard from '../pages/Dashboard';
import CashierPOS from '../pages/CashierPOS';
import Inventory from '../pages/Inventory';
import Staff from '../pages/Staff';
import Reports from '../pages/Reports';
import Audit from '../pages/Audit';
import Expenses from '../pages/Expenses';
import Settings from '../pages/Settings';
import SuperAdminDashboard from '../pages/superadmin/Dashboard';
import SuperAdminApplications from '../pages/superadmin/Applications';
import SuperAdminTenants from '../pages/superadmin/Tenants';
import SuperAdminAnalytics from '../pages/superadmin/Analytics';
import SuperAdminOversight from '../pages/superadmin/Oversight';
import SuperAdminSubscriptions from '../pages/superadmin/Subscriptions';
import SuperAdminBranchRequests from '../pages/superadmin/BranchRequests';
import SuperAdminPlatform from '../pages/superadmin/Platform';
import SuperAdminMarketIntelligence from '../pages/superadmin/MarketIntelligence';
import {
  ManagerDashboard,
  ManagerEmployees,
  ManagerCustomers,
  ManagerSales,
  ManagerInventory,
  ManagerRequests,
  ManagerExpenses
} from '../pages/manager';
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
} from '../pages/owner';

// Owner Routes with shared BranchProvider
const OwnerRoutes = () => {
  return (
    <BranchProvider>
      <Routes>
        <Route path="dashboard" element={<OwnerLayout><OwnerDashboard /></OwnerLayout>} />
        <Route path="sales" element={<OwnerLayout><OwnerSales /></OwnerLayout>} />
        <Route path="inventory" element={<OwnerLayout><OwnerInventory /></OwnerLayout>} />
        <Route path="staff" element={<OwnerLayout><OwnerStaff /></OwnerLayout>} />
        <Route path="customers" element={<OwnerLayout><OwnerCustomers /></OwnerLayout>} />
        <Route path="requests" element={<OwnerLayout><OwnerRequests /></OwnerLayout>} />
        <Route path="expenses" element={<OwnerLayout><OwnerExpenses /></OwnerLayout>} />
        <Route path="activity" element={<OwnerLayout><OwnerActivityLogs /></OwnerLayout>} />
        <Route path="reports" element={<OwnerLayout><OwnerReports /></OwnerLayout>} />
        <Route path="branches" element={<OwnerLayout><OwnerBranches /></OwnerLayout>} />
        <Route path="settings" element={<OwnerLayout><OwnerSettings /></OwnerLayout>} />
        <Route path="pos" element={<OwnerLayout><CashierPOS managerView={true} /></OwnerLayout>} />
      </Routes>
    </BranchProvider>
  );
};

// Role-based Dashboard component
const RoleBasedDashboard = () => {
  const { slug } = useParams();
  const { user, isCashier, isManager, isOwner } = useAuth();

  // Cashiers get the POS interface
  if (isCashier()) {
    return <CashierPOS />;
  }

  // Managers get redirected to manager dashboard
  if (isManager()) {
    return <Navigate to={`/${slug}/manager/dashboard`} replace />;
  }

  // Owners get redirected to owner dashboard
  if (isOwner()) {
    return <Navigate to={`/${slug}/owner/dashboard`} replace />;
  }

  // Fallback to regular dashboard
  return (
    <Layout>
      <Dashboard />
    </Layout>
  );
};

// Validates that logged-in user belongs to this tenant
const TenantGuard = ({ children }) => {
  const { slug } = useParams();
  const { user } = useAuth();

  // Super admin accessing /admin routes
  if (slug === 'admin' && user?.isSuperAdmin) {
    return children;
  }

  // Regular user - check tenant slug matches
  if (user && user.tenantSlug && user.tenantSlug !== slug) {
    // User is logged in but to a different tenant - redirect to their tenant
    return <Navigate to={`/${user.tenantSlug}/dashboard`} replace />;
  }

  return children;
};

const TenantRoutes = () => {
  const { slug } = useParams();
  const { user, isSuperAdmin } = useAuth();

  // Super admin routes
  if (slug === 'admin') {
    return (
      <Routes>
        <Route path="login" element={<TenantLogin />} />
        <Route
          path="dashboard"
          element={
            <PrivateRoute requireSuperAdmin>
              <SuperAdminLayout>
                <SuperAdminDashboard />
              </SuperAdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="applications"
          element={
            <PrivateRoute requireSuperAdmin>
              <SuperAdminLayout>
                <SuperAdminApplications />
              </SuperAdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="tenants"
          element={
            <PrivateRoute requireSuperAdmin>
              <SuperAdminLayout>
                <SuperAdminTenants />
              </SuperAdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="analytics"
          element={
            <PrivateRoute requireSuperAdmin>
              <SuperAdminLayout>
                <SuperAdminAnalytics />
              </SuperAdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="oversight"
          element={
            <PrivateRoute requireSuperAdmin>
              <SuperAdminLayout>
                <SuperAdminOversight />
              </SuperAdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="subscriptions"
          element={
            <PrivateRoute requireSuperAdmin>
              <SuperAdminLayout>
                <SuperAdminSubscriptions />
              </SuperAdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="branch-requests"
          element={
            <PrivateRoute requireSuperAdmin>
              <SuperAdminLayout>
                <SuperAdminBranchRequests />
              </SuperAdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="platform"
          element={
            <PrivateRoute requireSuperAdmin>
              <SuperAdminLayout>
                <SuperAdminPlatform />
              </SuperAdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="market-intelligence"
          element={
            <PrivateRoute requireSuperAdmin>
              <SuperAdminLayout>
                <SuperAdminMarketIntelligence />
              </SuperAdminLayout>
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to={`/admin/${user ? 'dashboard' : 'login'}`} replace />} />
      </Routes>
    );
  }

  // Regular tenant routes
  return (
    <TenantGuard>
      <Routes>
        {/* Login */}
        <Route path="login" element={<TenantLogin />} />

        {/* Dashboard - Role-based */}
        <Route
          path="dashboard"
          element={
            <PrivateRoute>
              <RoleBasedDashboard />
            </PrivateRoute>
          }
        />

        {/* Manager routes */}
        <Route
          path="manager/dashboard"
          element={
            <PrivateRoute>
              <ManagerLayout>
                <ManagerDashboard />
              </ManagerLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="manager/employees"
          element={
            <PrivateRoute>
              <ManagerLayout>
                <ManagerEmployees />
              </ManagerLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="manager/customers"
          element={
            <PrivateRoute>
              <ManagerLayout>
                <ManagerCustomers />
              </ManagerLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="manager/sales"
          element={
            <PrivateRoute>
              <ManagerLayout>
                <ManagerSales />
              </ManagerLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="manager/inventory"
          element={
            <PrivateRoute>
              <ManagerLayout>
                <ManagerInventory />
              </ManagerLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="manager/requests"
          element={
            <PrivateRoute>
              <ManagerLayout>
                <ManagerRequests />
              </ManagerLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="manager/expenses"
          element={
            <PrivateRoute>
              <ManagerLayout>
                <ManagerExpenses />
              </ManagerLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="manager/pos"
          element={
            <PrivateRoute>
              <ManagerLayout>
                <CashierPOS managerView={true} />
              </ManagerLayout>
            </PrivateRoute>
          }
        />

        {/* Owner routes - all wrapped in single BranchProvider */}
        <Route
          path="owner/*"
          element={
            <PrivateRoute requireOwner>
              <OwnerRoutes />
            </PrivateRoute>
          }
        />

        {/* Legacy routes (without /owner or /manager prefix) */}
        <Route
          path="inventory"
          element={
            <PrivateRoute requireAdmin>
              <Layout>
                <Inventory />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="staff"
          element={
            <PrivateRoute requireAdmin>
              <Layout>
                <Staff />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="reports"
          element={
            <PrivateRoute requireAdmin>
              <Layout>
                <Reports />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="expenses"
          element={
            <PrivateRoute requireAdmin>
              <Layout>
                <Expenses />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="audit"
          element={
            <PrivateRoute requireAdmin>
              <Layout>
                <Audit />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="settings"
          element={
            <PrivateRoute requireAdmin>
              <Layout>
                <Settings />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Default redirect to dashboard or login */}
        <Route path="*" element={<Navigate to={`/${slug}/${user ? 'dashboard' : 'login'}`} replace />} />
      </Routes>
    </TenantGuard>
  );
};

export default TenantRoutes;
