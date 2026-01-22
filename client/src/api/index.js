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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  getMe: () => api.get('/auth/me')
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
  resetPassword: (id, newPassword) => api.post(`/users/${id}/reset-password`, { newPassword })
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
  approveApplication: (id, subscriptionMonths) =>
    api.post(`/super-admin/applications/${id}/approve`, { subscriptionMonths }),
  rejectApplication: (id, reason) =>
    api.post(`/super-admin/applications/${id}/reject`, { reason }),
  getTenants: (params) => api.get('/super-admin/tenants', { params }),
  getTenant: (id) => api.get(`/super-admin/tenants/${id}`),
  updateTenantStatus: (id, isActive) =>
    api.put(`/super-admin/tenants/${id}/status`, { isActive }),
  extendSubscription: (id, data) =>
    api.put(`/super-admin/tenants/${id}/subscription`, data),
  // Global Analytics
  getAnalytics: (params) => api.get('/super-admin/analytics', { params }),
  getRevenueByTenant: (params) => api.get('/super-admin/analytics/revenue-by-tenant', { params }),
  getSubscriptionHealth: () => api.get('/super-admin/analytics/subscription-health'),
  getStaffProductivity: (params) => api.get('/super-admin/analytics/staff-productivity', { params }),
  getIndustryPerformance: () => api.get('/super-admin/analytics/industry-performance'),
  getAnomalies: () => api.get('/super-admin/analytics/anomalies'),
  // Branch Requests
  getBranchRequests: (params) => api.get('/super-admin/branch-requests', { params }),
  approveBranchRequest: (id) => api.post(`/super-admin/branch-requests/${id}/approve`),
  rejectBranchRequest: (id, reason) => api.post(`/super-admin/branch-requests/${id}/reject`, { reason })
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

// Branches API
export const branchesAPI = {
  getAll: () => api.get('/branches'),
  getById: (id) => api.get(`/branches/${id}`),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
  setMain: (id) => api.post(`/branches/${id}/set-main`),
  getStats: (params) => api.get('/branches/stats/overview', { params }),
  // Branch Requests
  getRequests: (params) => api.get('/branches/requests/list', { params }),
  createRequest: (data) => api.post('/branches/requests', data),
  cancelRequest: (id) => api.delete(`/branches/requests/${id}`)
};

export default api;
