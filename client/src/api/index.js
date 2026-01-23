import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Get user info before clearing
      const userStr = localStorage.getItem('user');
      let redirectUrl = '/';

      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          const slug = user.tenantSlug || (user.isSuperAdmin ? 'admin' : null);
          if (slug) {
            redirectUrl = `/${slug}/login`;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = redirectUrl;
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (username, password, tenantSlug) => api.post('/auth/login', { username, password, tenantSlug }),
  getMe: () => api.get('/auth/me'),
  getTenantBySlug: (slug) => api.get(`/auth/tenant/${slug}`),
  requestPasswordReset: (email, tenantSlug) => api.post('/auth/forgot-password', { email, tenantSlug }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword })
};

// Products API
export const productsAPI = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  getLowStock: () => api.get('/products/inventory/low-stock')
};

// Sales API
export const salesAPI = {
  getAll: (params) => api.get('/sales', { params }),
  getById: (id) => api.get(`/sales/${id}`),
  create: (data) => api.post('/sales', data),
  void: (id) => api.delete(`/sales/${id}`)
};

// Expenses API
export const expensesAPI = {
  getAll: (params) => api.get('/expenses', { params }),
  getById: (id) => api.get(`/expenses/${id}`),
  create: (data) => api.post('/expenses', data)
};

// Reports API
export const reportsAPI = {
  getDashboard: (params) => api.get('/reports/dashboard', { params }),
  getDailySales: (params) => api.get('/reports/daily-sales', { params }),
  getSalesTrends: (params) => api.get('/reports/sales-trends', { params }),
  getStaffPerformance: (params) => api.get('/reports/staff-performance', { params })
};

// Users API
export const usersAPI = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  resetPassword: (id, newPassword) => api.post(`/users/${id}/reset-password`, { newPassword }),
  uploadImage: (id, formData) => api.post(`/users/${id}/upload-image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteImage: (id) => api.delete(`/users/${id}/image`),
  // Profile (self-service)
  getProfile: () => api.get('/users/me/profile'),
  updateProfile: (data) => api.put('/users/me/profile', data),
  uploadProfileImage: (formData) => api.post('/users/me/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteProfileImage: () => api.delete('/users/me/image')
};

// Tenants API
export const tenantsAPI = {
  getCurrent: () => api.get('/tenants/current'),
  updateSubscription: (data) => api.put('/tenants/subscription', data)
};

// Audit API
export const auditAPI = {
  getAll: (params) => api.get('/audit', { params })
};

// Security Requests API
export const securityRequestsAPI = {
  getAll: (params) => api.get('/security-requests', { params }),
  getById: (id) => api.get(`/security-requests/${id}`),
  create: (data) => api.post('/security-requests', data),
  approve: (id) => api.post(`/security-requests/${id}/approve`),
  reject: (id) => api.post(`/security-requests/${id}/reject`)
};

// Customers API
export const customersAPI = {
  search: (q) => api.get('/customers/search', { params: { q } }),
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`)
};

// Applications API (Public)
export const applicationsAPI = {
  signup: (data) => api.post('/applications/signup', data),
  uploadLogo: (id, file) => {
    const formData = new FormData();
    formData.append('logo', file);
    return api.post(`/applications/${id}/upload-logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getStatus: (id) => api.get(`/applications/${id}/status`),
  getStatusByEmail: (email) => api.get('/applications/status-by-email', { params: { email } })
};

// Super Admin API
export const superAdminAPI = {
  getDashboard: () => api.get('/super-admin/dashboard'),
  getApplications: (params) => api.get('/super-admin/applications', { params }),
  getApplication: (id) => api.get(`/super-admin/applications/${id}`),
  checkSlugAvailability: (slug) => api.get(`/super-admin/check-slug/${slug}`),
  approveApplication: (id, slug, subscriptionMonths) =>
    api.post(`/super-admin/applications/${id}/approve`, { slug, subscriptionMonths }),
  rejectApplication: (id, reason) =>
    api.post(`/super-admin/applications/${id}/reject`, { reason }),
  getTenants: (params) => api.get('/super-admin/tenants', { params }),
  getTenant: (id) => api.get(`/super-admin/tenants/${id}`),
  getTenantFullData: (id) => api.get(`/super-admin/tenants/${id}/full-data`),
  updateTenantStatus: (id, isActive) =>
    api.put(`/super-admin/tenants/${id}/status`, { isActive }),
  extendSubscription: (id, data) =>
    api.put(`/super-admin/tenants/${id}/subscription`, data),
  updateTenantSlug: (id, slug) =>
    api.put(`/super-admin/tenants/${id}/slug`, { slug }),
  deleteTenant: (id, confirmationName) =>
    api.delete(`/super-admin/tenants/${id}`, { data: { confirmationName } }),
  deleteBranch: (id, data) =>
    api.delete(`/super-admin/branches/${id}`, { data }),
  setMainBranch: (id) =>
    api.post(`/super-admin/branches/${id}/set-main`),
  // Global Analytics
  getAnalytics: (params) => api.get('/super-admin/analytics', { params }),
  getRevenueByTenant: (params) => api.get('/super-admin/analytics/revenue-by-tenant', { params }),
  getSubscriptionHealth: () => api.get('/super-admin/analytics/subscription-health'),
  getStaffProductivity: (params) => api.get('/super-admin/analytics/staff-productivity', { params }),
  getIndustryPerformance: () => api.get('/super-admin/analytics/industry-performance'),
  getAnomalies: () => api.get('/super-admin/analytics/anomalies'),
  // Oversight - All Transactions
  getAllTransactions: (params) => api.get('/super-admin/oversight/transactions', { params }),
  getVoidedSales: (params) => api.get('/super-admin/oversight/voids', { params }),
  getSuspiciousActivity: (params) => api.get('/super-admin/oversight/suspicious', { params }),
  // Branch Requests
  getBranchRequests: (params) => api.get('/super-admin/branch-requests', { params }),
  approveBranchRequest: (id) => api.post(`/super-admin/branch-requests/${id}/approve`),
  rejectBranchRequest: (id, reason) => api.post(`/super-admin/branch-requests/${id}/reject`, { reason })
};

// Platform API (Infrastructure Management)
export const platformAPI = {
  // Subscription Tiers
  getTiers: () => api.get('/platform/tiers'),
  createTier: (data) => api.post('/platform/tiers', data),
  updateTier: (id, data) => api.put(`/platform/tiers/${id}`, data),
  deleteTier: (id) => api.delete(`/platform/tiers/${id}`),
  assignTierToTenant: (tenantId, tierId) => api.put(`/platform/tenants/${tenantId}/tier`, { tierId }),

  // Features
  getFeatures: () => api.get('/platform/features'),
  createFeature: (data) => api.post('/platform/features', data),
  updateTierFeatures: (tierId, featureIds) => api.put(`/platform/tiers/${tierId}/features`, { featureIds }),
  checkFeatureAccess: (code) => api.get(`/platform/check-feature/${code}`),

  // Grace Period
  getGracePeriodTenants: () => api.get('/platform/grace-period/tenants'),
  setGracePeriod: (tenantId, graceDays) => api.put(`/platform/tenants/${tenantId}/grace-period`, { graceDays }),
  enforceLockout: () => api.post('/platform/grace-period/enforce'),

  // Tax Configuration
  getTaxConfigs: (params) => api.get('/platform/tax-configs', { params }),
  createTaxConfig: (data) => api.post('/platform/tax-configs', data),
  updateTaxConfig: (id, data) => api.put(`/platform/tax-configs/${id}`, data),
  pushTaxRates: (country, taxRate) => api.post('/platform/tax-configs/push', { country, taxRate }),

  // Admin Impersonation
  startImpersonation: (tenantId, reason) => api.post('/platform/impersonate', { tenantId, reason }),
  endImpersonation: (logId, actionsPerformed) => api.post(`/platform/impersonate/${logId}/end`, { actionsPerformed }),
  getImpersonationLogs: (params) => api.get('/platform/impersonation-logs', { params }),

  // Tenant Health
  getTenantHealth: () => api.get('/platform/tenant-health'),

  // Seed Defaults
  seedDefaults: () => api.post('/platform/seed-defaults')
};

// Market Intelligence API
export const marketIntelligenceAPI = {
  // Product Affinity & Basket Analysis
  getBasketAnalysis: (params) => api.get('/market-intelligence/basket-analysis', { params }),

  // Brand Market Share
  getBrandShare: (params) => api.get('/market-intelligence/brand-share', { params }),

  // Geospatial Spending Analysis
  getSpendingByLocation: (params) => api.get('/market-intelligence/spending-by-location', { params }),

  // Peak Hours Analysis
  getPeakHours: (params) => api.get('/market-intelligence/peak-hours', { params }),

  // Price Elasticity
  getPriceElasticity: (params) => api.get('/market-intelligence/price-elasticity', { params }),

  // Data Export (Data-as-a-Service)
  exportSummary: (params) => api.get('/market-intelligence/export/summary', { params }),
  exportTrends: (params) => api.get('/market-intelligence/export/trends', { params }),

  // Download CSV
  downloadSummaryCSV: async (period = 30) => {
    const response = await api.get('/market-intelligence/export/summary', {
      params: { period, format: 'csv' },
      responseType: 'blob'
    });
    return response;
  }
};

// Owner API
export const ownerAPI = {
  // Dashboard
  getDashboard: (params) => api.get('/owner/dashboard', { params }),
  // Staff Management
  getStaff: (params) => api.get('/owner/staff', { params }),
  createStaff: (data) => api.post('/owner/staff', data),
  updateStaff: (id, data) => api.put(`/owner/staff/${id}`, data),
  resetStaffPassword: (id, newPassword) => api.post(`/owner/staff/${id}/reset-password`, { newPassword }),
  uploadStaffImage: (id, formData) => api.post(`/users/${id}/upload-image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteStaffImage: (id) => api.delete(`/users/${id}/image`),
  // Activity Logs
  getActivity: (params) => api.get('/owner/activity', { params }),
  exportActivity: (params) => api.get('/owner/activity/export', { params, responseType: 'blob' }),
  // Reports
  getPLReport: (params) => api.get('/owner/reports/pl', { params }),
  getBranchComparison: (params) => api.get('/owner/reports/branch-comparison', { params }),
  getProductProfitability: (params) => api.get('/owner/reports/product-profitability', { params }),
  getStaffPerformance: (params) => api.get('/owner/reports/staff-performance', { params }),
  // Settings
  getSettings: () => api.get('/owner/settings'),
  updateSettings: (data) => api.put('/owner/settings', data)
};

// Stock Transfers API (Retail Module)
export const stockTransfersAPI = {
  getAll: (params) => api.get('/stock-transfers', { params }),
  getById: (id) => api.get(`/stock-transfers/${id}`),
  create: (data) => api.post('/stock-transfers', data),
  ship: (id) => api.post(`/stock-transfers/${id}/ship`),
  receive: (id, items) => api.post(`/stock-transfers/${id}/receive`, { items }),
  cancel: (id) => api.post(`/stock-transfers/${id}/cancel`)
};

// Categories API (Retail Module)
export const categoriesAPI = {
  getAll: (params) => api.get('/categories', { params }),
  getById: (id) => api.get(`/categories/${id}`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
  reorder: (categories) => api.put('/categories/reorder', { categories })
};

// Stock Adjustments API (Retail Module)
export const stockAdjustmentsAPI = {
  getAll: (params) => api.get('/stock-adjustments', { params }),
  getSummary: (params) => api.get('/stock-adjustments/summary', { params }),
  getById: (id) => api.get(`/stock-adjustments/${id}`),
  getByProduct: (productId, params) => api.get(`/stock-adjustments/product/${productId}`, { params }),
  create: (data) => api.post('/stock-adjustments', data),
  bulkCount: (data) => api.post('/stock-adjustments/bulk', data)
};

// Branches API
export const branchesAPI = {
  getAll: () => api.get('/branches'),
  getById: (id) => api.get(`/branches/${id}`),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
  setMain: (id) => api.post(`/branches/${id}/set-main`),
  delete: (id, data) => api.delete(`/branches/${id}`, { data }),
  getStats: (params) => api.get('/branches/stats/overview', { params }),
  // Branch Requests
  getRequests: (params) => api.get('/branches/requests/list', { params }),
  createRequest: (data) => api.post('/branches/requests', data),
  cancelRequest: (id) => api.delete(`/branches/requests/${id}`)
};

export default api;
