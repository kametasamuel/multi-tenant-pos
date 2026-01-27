import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
// Base URL for images (without /api)
export const IMAGE_BASE_URL = process.env.REACT_APP_IMAGE_URL || 'http://localhost:5000';

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
      // Skip redirect for login attempts - let the login form handle the error
      const requestUrl = error.config?.url || '';
      if (requestUrl.includes('/auth/login')) {
        return Promise.reject(error);
      }

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
  create: (data) => {
    // Check if data is FormData (has image), otherwise use JSON
    if (data instanceof FormData) {
      return api.post('/products', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return api.post('/products', data);
  },
  update: (id, data) => {
    // Check if data is FormData (has image), otherwise use JSON
    if (data instanceof FormData) {
      return api.put(`/products/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return api.put(`/products/${id}`, data);
  },
  getLowStock: () => api.get('/products/inventory/low-stock'),
  delete: (id) => api.delete(`/products/${id}`),
  // 86'd (temporarily unavailable) management
  toggle86: (id) => api.put(`/products/${id}/86`),
  get86d: () => api.get('/products/status/86d')
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
  getStaffPerformance: (params) => api.get('/reports/staff-performance', { params }),
  getStylistPerformance: (params) => api.get('/reports/stylist-performance', { params })
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
  // Stylist Performance (SERVICES/SALON business types)
  getStylistPerformance: (params) => api.get('/owner/reports/stylist-performance', { params }),
  // Settings
  getSettings: () => api.get('/owner/settings'),
  updateSettings: (data) => api.put('/owner/settings', data),
  // Logo Management
  uploadLogo: (formData) => api.post('/owner/settings/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteLogo: () => api.delete('/owner/settings/logo')
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

// Attendants API (Services Module)
export const attendantsAPI = {
  getAll: (params) => api.get('/attendants', { params }),
  getById: (id, params) => api.get(`/attendants/${id}`, { params }),
  create: (data) => api.post('/attendants', data),
  update: (id, data) => api.put(`/attendants/${id}`, data),
  delete: (id) => api.delete(`/attendants/${id}`),
  getPerformanceSummary: (params) => api.get('/attendants/performance/summary', { params }),
  uploadImage: (id, formData) => api.post(`/attendants/${id}/upload-image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
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

// Restaurant Tables API
export const tablesAPI = {
  getAll: (params) => api.get('/tables', { params }),
  getById: (id) => api.get(`/tables/${id}`),
  create: (data) => api.post('/tables', data),
  update: (id, data) => api.put(`/tables/${id}`, data),
  delete: (id) => api.delete(`/tables/${id}`),
  updateStatus: (id, status) => api.put(`/tables/${id}/status`, { status }),
  bulkCreate: (data) => api.post('/tables/bulk', data),
  updatePositions: (positions) => api.put('/tables/positions/update', { positions })
};

// Restaurant Orders API
export const ordersAPI = {
  getAll: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  getOpenTabs: (params) => api.get('/orders/open-tabs', { params }),
  create: (data) => api.post('/orders', data),
  addItems: (id, items) => api.post(`/orders/${id}/items`, { items }),
  updateStatus: (id, status) => api.put(`/orders/${id}/status`, { status }),
  updatePriority: (id, priority) => api.put(`/orders/${id}/priority`, { priority }),
  closeTab: (id, data) => api.put(`/orders/${id}/close`, data),
  cancel: (id, reason) => api.delete(`/orders/${id}`, { data: { reason } }),
  updateItem: (orderId, itemId, data) => api.put(`/orders/${orderId}/items/${itemId}`, data),
  removeItem: (orderId, itemId) => api.delete(`/orders/${orderId}/items/${itemId}`),
  // Table-level operations
  getTableSummary: (tableId) => api.get(`/orders/table/${tableId}/summary`),
  closeTable: (tableId, data) => api.put(`/orders/table/${tableId}/close`, data),
  refreshOrder: (id) => api.get(`/orders/${id}/refresh`),
  // Switch table and cancel request
  switchTable: (id, newTableId) => api.put(`/orders/${id}/switch-table`, { newTableId }),
  requestCancel: (id, reason) => api.post(`/orders/${id}/request-cancel`, { reason })
};

// Kitchen Display System API
export const kdsAPI = {
  getOrders: (params) => api.get('/kds/orders', { params }),
  getReadyOrders: (params) => api.get('/kds/orders/ready', { params }),
  getOrderDetails: (id) => api.get(`/kds/orders/${id}`),
  updateOrderStatus: (id, status) => api.put(`/kds/orders/${id}/status`, { status }),
  updateItemStatus: (id, status) => api.put(`/kds/items/${id}`, { status }),
  bumpOrder: (id) => api.post(`/kds/orders/${id}/bump`),
  recallOrder: (id, reason) => api.post(`/kds/orders/${id}/recall`, { reason }),
  getStats: (params) => api.get('/kds/stats', { params })
};

// Product Modifiers API
export const modifiersAPI = {
  getForProduct: (productId) => api.get(`/modifiers/products/${productId}/modifiers`),
  getAll: (params) => api.get('/modifiers', { params }),
  create: (productId, data) => api.post(`/modifiers/products/${productId}/modifiers`, data),
  update: (id, data) => api.put(`/modifiers/${id}`, data),
  delete: (id) => api.delete(`/modifiers/${id}`),
  reorder: (productId, modifierIds) => api.post('/modifiers/reorder', { productId, modifierIds }),
  copy: (sourceProductId, targetProductId) => api.post('/modifiers/copy', { sourceProductId, targetProductId })
};

// ============================================
// HOSPITALITY MODULE APIs
// ============================================

// Room Types & Rooms API
export const roomsAPI = {
  // Room Types
  getTypes: (params) => api.get('/rooms/types', { params }),
  getTypeById: (id) => api.get(`/rooms/types/${id}`),
  createType: (data) => api.post('/rooms/types', data),
  updateType: (id, data) => api.put(`/rooms/types/${id}`, data),
  deleteType: (id) => api.delete(`/rooms/types/${id}`),
  // Rooms
  getAll: (params) => api.get('/rooms', { params }),
  getById: (id) => api.get(`/rooms/${id}`),
  getAvailability: (params) => api.get('/rooms/availability', { params }),
  create: (data) => api.post('/rooms', data),
  bulkCreate: (data) => api.post('/rooms/bulk', data),
  update: (id, data) => api.put(`/rooms/${id}`, data),
  updateStatus: (id, data) => api.put(`/rooms/${id}/status`, data),
  delete: (id) => api.delete(`/rooms/${id}`),
  // Rate Plans
  getRatePlans: (roomTypeId) => api.get(`/rooms/types/${roomTypeId}/rates`),
  createRatePlan: (roomTypeId, data) => api.post(`/rooms/types/${roomTypeId}/rates`, data)
};

// Bookings API
export const bookingsAPI = {
  getAll: (params) => api.get('/bookings', { params }),
  getById: (id) => api.get(`/bookings/${id}`),
  getArrivals: (params) => api.get('/bookings/arrivals', { params }),
  getDepartures: (params) => api.get('/bookings/departures', { params }),
  getInHouse: (params) => api.get('/bookings/in-house', { params }),
  create: (data) => api.post('/bookings', data),
  update: (id, data) => api.put(`/bookings/${id}`, data),
  checkIn: (id, data) => api.post(`/bookings/${id}/check-in`, data),
  checkOut: (id, data) => api.post(`/bookings/${id}/check-out`, data),
  cancel: (id, reason) => api.post(`/bookings/${id}/cancel`, { reason }),
  markNoShow: (id) => api.post(`/bookings/${id}/no-show`)
};

// Guests API
export const guestsAPI = {
  search: (q) => api.get('/guests/search', { params: { q } }),
  getAll: (params) => api.get('/guests', { params }),
  getById: (id) => api.get(`/guests/${id}`),
  getVIP: () => api.get('/guests/vip'),
  getFrequent: (params) => api.get('/guests/frequent', { params }),
  create: (data) => api.post('/guests', data),
  update: (id, data) => api.put(`/guests/${id}`, data),
  updateVIPStatus: (id, vipStatus) => api.put(`/guests/${id}/vip`, { vipStatus }),
  delete: (id) => api.delete(`/guests/${id}`),
  merge: (keepGuestId, mergeGuestId) => api.post('/guests/merge', { keepGuestId, mergeGuestId })
};

// Folios API
export const foliosAPI = {
  getOpen: (params) => api.get('/folios/open', { params }),
  getById: (id) => api.get(`/folios/${id}`),
  getByBooking: (bookingId) => api.get(`/folios/booking/${bookingId}`),
  getPrintData: (id) => api.get(`/folios/${id}/print`),
  // Charges
  addCharge: (folioId, data) => api.post(`/folios/${folioId}/charges`, data),
  addQuickCharge: (folioId, type, roomNumber) => api.post(`/folios/${folioId}/charges/quick`, { type, roomNumber }),
  voidCharge: (chargeId, reason) => api.post(`/folios/charges/${chargeId}/void`, { reason }),
  // Payments
  addPayment: (folioId, data) => api.post(`/folios/${folioId}/payments`, data),
  voidPayment: (paymentId, reason) => api.post(`/folios/payments/${paymentId}/void`, { reason }),
  // Transfer
  transferCharges: (sourceChargeIds, targetFolioId) => api.post('/folios/transfer', { sourceChargeIds, targetFolioId })
};

// Housekeeping API
export const housekeepingAPI = {
  getTasks: (params) => api.get('/housekeeping/tasks', { params }),
  getPendingTasks: (params) => api.get('/housekeeping/pending', { params }),
  getRoomStatus: (params) => api.get('/housekeeping/room-status', { params }),
  getTaskById: (id) => api.get(`/housekeeping/tasks/${id}`),
  getStats: (params) => api.get('/housekeeping/stats', { params }),
  createTask: (data) => api.post('/housekeeping/tasks', data),
  bulkCreateTasks: (data) => api.post('/housekeeping/tasks/bulk', data),
  updateTask: (id, data) => api.put(`/housekeeping/tasks/${id}`, data),
  startTask: (id) => api.post(`/housekeeping/tasks/${id}/start`),
  completeTask: (id, notes) => api.post(`/housekeeping/tasks/${id}/complete`, { notes }),
  verifyTask: (id, approved, notes) => api.post(`/housekeeping/tasks/${id}/verify`, { approved, notes }),
  deleteTask: (id) => api.delete(`/housekeeping/tasks/${id}`)
};

export default api;
