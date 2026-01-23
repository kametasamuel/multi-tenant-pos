import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { superAdminAPI } from '../../api';
import {
  Building2,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Package,
  ShoppingCart,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  CalendarPlus,
  RefreshCw,
  Eye,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  GitBranch,
  Shield,
  Settings,
  BarChart3,
  ChevronDown,
  Plus,
  ExternalLink,
  Download,
  Database,
  FileText,
  Receipt,
  Percent,
  PieChart,
  Target,
  UserCheck,
  CreditCard,
  ArrowUpRight,
  Layers,
  Globe,
  Trash2
} from 'lucide-react';

const Tenants = ({
  darkMode = false,
  surfaceClass = 'bg-white',
  textClass = 'text-slate-900',
  mutedClass = 'text-slate-500',
  borderClass = 'border-slate-200'
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tenants, setTenants] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantFullData, setTenantFullData] = useState(null);
  const [loadingFullData, setLoadingFullData] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extensionMonths, setExtensionMonths] = useState(3);
  const [actionLoading, setActionLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('overview');
  const [editSlug, setEditSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState({ checking: false, available: null, error: null });
  const [savingSlug, setSavingSlug] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [statusToggleTenant, setStatusToggleTenant] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [branchDeleteModal, setBranchDeleteModal] = useState({ show: false, branch: null });
  const [branchDeleteConfirm, setBranchDeleteConfirm] = useState('');
  const [branchTransferTo, setBranchTransferTo] = useState('');
  const [deletingBranch, setDeletingBranch] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    expiringWeek: 0
  });

  const currentStatus = searchParams.get('status') || 'all';
  const currentPage = parseInt(searchParams.get('page')) || 1;
  const tenantIdParam = searchParams.get('id');

  useEffect(() => {
    fetchTenants();
  }, [currentStatus, currentPage]);

  // Auto-open tenant detail if ID is in URL
  useEffect(() => {
    if (tenantIdParam && !loading) {
      // Find tenant in list or fetch directly
      const tenant = tenants.find(t => t.id === tenantIdParam);
      if (tenant) {
        setSelectedTenant(tenant);
        fetchTenantFullData(tenantIdParam);
        setShowDetailModal(true);
      } else {
        // Fetch tenant directly if not in current list
        superAdminAPI.getTenant(tenantIdParam).then(res => {
          setSelectedTenant(res.data.tenant || res.data);
          fetchTenantFullData(tenantIdParam);
          setShowDetailModal(true);
        }).catch(err => {
          console.error('Failed to load tenant:', err);
        });
      }
      // Clear the ID param from URL after opening
      searchParams.delete('id');
      setSearchParams(searchParams, { replace: true });
    }
  }, [tenantIdParam, loading, tenants]);

  const fetchTenants = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page: currentPage, limit: 10 };
      if (currentStatus !== 'all') {
        params.status = currentStatus;
      }
      if (searchTerm) {
        params.search = searchTerm;
      }
      const response = await superAdminAPI.getTenants(params);
      setTenants(response.data.tenants);
      setPagination(response.data.pagination);

      // Fetch all for stats
      const allResponse = await superAdminAPI.getTenants({ limit: 1000 });
      const allTenants = allResponse.data.tenants || [];
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      setStats({
        total: allTenants.length,
        active: allTenants.filter(t => t.isActive).length,
        inactive: allTenants.filter(t => !t.isActive).length,
        expiringWeek: allTenants.filter(t => {
          const endDate = new Date(t.subscriptionEnd || t.subscriptionEndDate);
          return endDate > now && endDate <= weekFromNow;
        }).length
      });
    } catch (err) {
      setError('Failed to load tenants');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantFullData = async (tenantId) => {
    setLoadingFullData(true);
    try {
      const response = await superAdminAPI.getTenantFullData(tenantId);
      console.log('Tenant full data response:', response.data);
      if (response.data && response.data.tenant) {
        setTenantFullData(response.data);
      } else {
        console.error('Invalid tenant full data response:', response.data);
        setTenantFullData(null);
      }
    } catch (err) {
      console.error('Failed to load full tenant data:', err);
      // Fallback to basic data
      setTenantFullData(null);
    } finally {
      setLoadingFullData(false);
    }
  };

  const handleOpenDetail = async (tenant) => {
    setSelectedTenant(tenant);
    setDetailTab('overview');
    setEditSlug(tenant.slug || '');
    setSlugStatus({ checking: false, available: null, error: null });
    setTenantFullData(null); // Clear previous data before loading new
    setShowDetailModal(true);
    await fetchTenantFullData(tenant.id);
  };

  // Generate suggested slug from business name
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);
  };

  // Check slug availability with debounce
  const checkSlugAvailability = async (slugValue, currentTenantSlug) => {
    if (!slugValue || slugValue.length < 3) {
      setSlugStatus({ checking: false, available: null, error: 'Slug must be at least 3 characters' });
      return;
    }
    if (slugValue.length > 30) {
      setSlugStatus({ checking: false, available: null, error: 'Slug must be at most 30 characters' });
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slugValue)) {
      setSlugStatus({ checking: false, available: null, error: 'Only lowercase letters, numbers, and hyphens allowed' });
      return;
    }
    if (/^-|-$/.test(slugValue)) {
      setSlugStatus({ checking: false, available: null, error: 'Slug cannot start or end with a hyphen' });
      return;
    }
    const reserved = ['admin', 'api', 'www', 'app', 'dashboard', 'login', 'signup', 'super-admin'];
    if (reserved.includes(slugValue)) {
      setSlugStatus({ checking: false, available: false, error: 'This slug is reserved' });
      return;
    }
    // If it's the same as current slug, it's available
    if (slugValue === currentTenantSlug) {
      setSlugStatus({ checking: false, available: true, error: null });
      return;
    }

    setSlugStatus({ checking: true, available: null, error: null });
    try {
      const response = await superAdminAPI.checkSlugAvailability(slugValue);
      setSlugStatus({ checking: false, available: response.data.available, error: null });
    } catch (err) {
      setSlugStatus({ checking: false, available: true, error: null });
    }
  };

  // Handle slug input change
  const handleSlugChange = (value) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setEditSlug(sanitized);
    // Debounced check
    clearTimeout(window.slugCheckTimeout);
    window.slugCheckTimeout = setTimeout(() => {
      checkSlugAvailability(sanitized, selectedTenant?.slug);
    }, 500);
  };

  // Save slug
  const handleSaveSlug = async () => {
    if (!selectedTenant || !editSlug || slugStatus.available !== true) return;
    setSavingSlug(true);
    try {
      await superAdminAPI.updateTenantSlug(selectedTenant.id, editSlug);
      // Update local state
      setSelectedTenant(prev => ({ ...prev, slug: editSlug }));
      fetchTenants();
      setSlugStatus({ checking: false, available: true, error: null });
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to update slug';
      setSlugStatus({ checking: false, available: false, error: message });
    } finally {
      setSavingSlug(false);
    }
  };

  const handleStatusFilter = (status) => {
    if (status === 'all') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', status);
    }
    searchParams.set('page', '1');
    setSearchParams(searchParams);
  };

  const handlePageChange = (page) => {
    searchParams.set('page', page.toString());
    setSearchParams(searchParams);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    searchParams.set('page', '1');
    setSearchParams(searchParams);
    fetchTenants();
  };

  const handleToggleStatus = (tenant) => {
    setStatusToggleTenant(tenant);
    setShowStatusConfirm(true);
  };

  const confirmToggleStatus = async () => {
    if (!statusToggleTenant) return;
    setActionLoading(true);
    try {
      await superAdminAPI.updateTenantStatus(statusToggleTenant.id, !statusToggleTenant.isActive);
      setShowStatusConfirm(false);
      setStatusToggleTenant(null);
      fetchTenants();
      // Refresh tenant data if modal is open
      if (showDetailModal && selectedTenant?.id === statusToggleTenant.id) {
        fetchTenantFullData(statusToggleTenant.id);
      }
    } catch (err) {
      setError('Failed to update tenant status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExtendSubscription = async () => {
    if (!selectedTenant) return;
    setActionLoading(true);
    try {
      await superAdminAPI.extendSubscription(selectedTenant.id, { months: extensionMonths });
      setShowExtendModal(false);
      setSelectedTenant(null);
      setExtensionMonths(3);
      fetchTenants();
    } catch (err) {
      setError('Failed to extend subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTenant = async () => {
    if (!selectedTenant || deleteConfirmName.toLowerCase() !== selectedTenant.businessName.toLowerCase()) return;
    setDeleting(true);
    try {
      await superAdminAPI.deleteTenant(selectedTenant.id, deleteConfirmName);
      setShowDeleteModal(false);
      setShowDetailModal(false);
      setSelectedTenant(null);
      setTenantFullData(null);
      setDeleteConfirmName('');
      fetchTenants();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete tenant');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteBranchAdmin = (branch) => {
    setBranchDeleteModal({ show: true, branch });
    setBranchDeleteConfirm('');
    setBranchTransferTo('');
  };

  const handleSetMainBranchAdmin = async (branch) => {
    if (!branch || branch.isMain) return;

    try {
      setActionLoading(true);
      await superAdminAPI.setMainBranch(branch.id);
      // Refresh tenant data
      if (selectedTenant) {
        await fetchTenantFullData(selectedTenant.id);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set main branch');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDeleteBranchAdmin = async () => {
    const branch = branchDeleteModal.branch;
    if (!branch || branchDeleteConfirm.toLowerCase() !== branch.name.toLowerCase()) return;

    setDeletingBranch(true);
    try {
      const result = await superAdminAPI.deleteBranch(branch.id, {
        confirmName: branchDeleteConfirm,
        transferTo: branchTransferTo || undefined
      });
      setBranchDeleteModal({ show: false, branch: null });
      setBranchDeleteConfirm('');
      setBranchTransferTo('');

      // Show info about new main branch if applicable
      if (result.data?.newMainBranch) {
        setError(''); // Clear any errors
      }

      // Refresh tenant data
      if (selectedTenant) {
        await fetchTenantFullData(selectedTenant.id);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete branch');
    } finally {
      setDeletingBranch(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Use tenant's currency when viewing tenant details, otherwise default
  const formatCurrency = (amount, tenantData = null) => {
    const currency = tenantData?.currency || selectedTenant?.currency || tenantFullData?.tenant?.currency || 'USD';
    const symbol = tenantData?.currencySymbol || selectedTenant?.currencySymbol || tenantFullData?.tenant?.currencySymbol || '$';

    // Try using Intl if currency is valid
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount || 0);
    } catch {
      // Fallback with symbol
      return `${symbol}${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount || 0)}`;
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return (num || 0).toLocaleString();
  };

  const getSubscriptionStatus = (endDate) => {
    const end = new Date(endDate);
    const daysLeft = Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { bg: 'bg-red-100', text: 'text-red-700', label: 'Expired', days: daysLeft };
    if (daysLeft <= 7) return { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Critical', days: daysLeft };
    if (daysLeft <= 30) return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Expiring Soon', days: daysLeft };
    return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Active', days: daysLeft };
  };

  const StatCard = ({ icon: Icon, label, value, color, onClick, isActive }) => (
    <button
      onClick={onClick}
      className={`${surfaceClass} rounded-2xl p-5 border ${isActive ? 'border-indigo-500 ring-2 ring-indigo-200' : borderClass} text-left transition-all hover:shadow-md w-full`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className={`text-2xl font-black ${textClass}`}>{value}</p>
      <p className={`text-xs font-medium ${mutedClass} mt-1`}>{label}</p>
    </button>
  );

  if (loading && tenants.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black ${textClass}`}>Tenant Governance</h1>
          <p className={`text-sm ${mutedClass}`}>Full data access and management for all tenants</p>
        </div>
        <button
          onClick={fetchTenants}
          className={`px-4 py-2 ${surfaceClass} border ${borderClass} rounded-xl text-sm font-bold ${textClass} hover:bg-slate-50 flex items-center gap-2`}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label="Total Tenants"
          value={stats.total}
          color="bg-indigo-600"
          onClick={() => handleStatusFilter('all')}
          isActive={currentStatus === 'all'}
        />
        <StatCard
          icon={CheckCircle}
          label="Active"
          value={stats.active}
          color="bg-emerald-600"
          onClick={() => handleStatusFilter('active')}
          isActive={currentStatus === 'active'}
        />
        <StatCard
          icon={XCircle}
          label="Inactive"
          value={stats.inactive}
          color="bg-slate-500"
          onClick={() => handleStatusFilter('inactive')}
          isActive={currentStatus === 'inactive'}
        />
        <StatCard
          icon={AlertTriangle}
          label="Expiring This Week"
          value={stats.expiringWeek}
          color="bg-amber-500"
        />
      </div>

      {/* Expiring Alert */}
      {stats.expiringWeek > 0 && (
        <div className={`${darkMode ? 'bg-amber-900/20' : 'bg-amber-50'} border border-amber-200 rounded-2xl p-4`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-700">
                {stats.expiringWeek} Tenant{stats.expiringWeek !== 1 ? 's' : ''} Expiring This Week
              </p>
              <p className="text-xs text-amber-600">
                Contact these tenants to renew their subscriptions
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
            <input
              type="text"
              placeholder="Search by business name, email, or industry..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            />
          </div>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className={`${darkMode ? 'bg-red-900/20' : 'bg-red-50'} border border-red-200 rounded-xl p-4 text-red-700`}>
          {error}
        </div>
      )}

      {/* Tenants List */}
      <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
        {tenants.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className={`w-12 h-12 mx-auto mb-4 ${mutedClass}`} />
            <p className={`text-sm font-bold ${textClass}`}>No tenants found</p>
            <p className={`text-xs ${mutedClass}`}>
              {searchTerm ? 'Try a different search term' : 'Tenants will appear here when approved'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={darkMode ? 'bg-slate-700' : 'bg-slate-50'}>
                <tr>
                  <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Business</th>
                  <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Status</th>
                  <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Subscription</th>
                  <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Resources</th>
                  <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {tenants.map((tenant) => {
                  const subStatus = getSubscriptionStatus(tenant.subscriptionEnd || tenant.subscriptionEndDate);
                  return (
                    <tr key={tenant.id} className={`hover:${darkMode ? 'bg-slate-700' : 'bg-slate-50'} transition-colors ${!tenant.isActive ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {tenant.businessLogo ? (
                            <img src={tenant.businessLogo} alt={tenant.businessName} className="w-10 h-10 rounded-xl object-cover" />
                          ) : (
                            <div className={`w-10 h-10 rounded-xl ${darkMode ? 'bg-slate-600' : 'bg-slate-100'} flex items-center justify-center`}>
                              <Building2 className={`w-5 h-5 ${mutedClass}`} />
                            </div>
                          )}
                          <div>
                            <p className={`text-sm font-bold ${textClass}`}>{tenant.businessName}</p>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${mutedClass} capitalize`}>{tenant.businessType?.toLowerCase() || 'retail'}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${darkMode ? 'bg-slate-600' : 'bg-slate-200'} font-mono`}>
                                {tenant.currencySymbol || '$'}{tenant.currency || 'USD'}
                              </span>
                              {tenant.slug && (
                                <span className="text-xs text-indigo-600 font-mono">/{tenant.slug}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                          tenant.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {tenant.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {tenant.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className={`text-sm font-bold ${textClass}`}>
                            {formatDate(tenant.subscriptionEnd || tenant.subscriptionEndDate)}
                          </p>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${subStatus.bg} ${subStatus.text}`}>
                            <Clock className="w-3 h-3" />
                            {subStatus.days < 0 ? `${Math.abs(subStatus.days)}d overdue` : `${subStatus.days}d left`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-3">
                          <span className={`inline-flex items-center gap-1 text-xs ${mutedClass}`} title="Users">
                            <Users className="w-3 h-3" />{tenant._count?.users || 0}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-xs ${mutedClass}`} title="Products">
                            <Package className="w-3 h-3" />{tenant._count?.products || 0}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-xs ${mutedClass}`} title="Branches">
                            <GitBranch className="w-3 h-3" />{tenant._count?.branches || 1}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-xs ${mutedClass}`} title="Sales">
                            <ShoppingCart className="w-3 h-3" />{tenant._count?.sales || 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenDetail(tenant)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-bold text-xs flex items-center gap-1"
                            title="Full Data Access"
                          >
                            <Database className="w-4 h-4" />
                            Access
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setShowExtendModal(true);
                            }}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Extend Subscription"
                          >
                            <CalendarPlus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(tenant)}
                            disabled={actionLoading}
                            className={`p-2 rounded-lg transition-colors ${
                              tenant.isActive ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={tenant.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {tenant.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className={`flex items-center justify-between px-4 py-3 border-t ${borderClass}`}>
            <p className={`text-sm ${mutedClass}`}>
              Page {currentPage} of {pagination.pages} ({pagination.total} total)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg ${surfaceClass} border ${borderClass} disabled:opacity-50`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className={`text-sm font-bold ${textClass}`}>Page {currentPage}</span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === pagination.pages}
                className={`p-2 rounded-lg ${surfaceClass} border ${borderClass} disabled:opacity-50`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Full Tenant Data Access Modal */}
      {showDetailModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${surfaceClass} rounded-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col`}>
            {/* Header */}
            <div className={`p-6 border-b ${borderClass} shrink-0`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {selectedTenant.businessLogo ? (
                    <img src={selectedTenant.businessLogo} alt={selectedTenant.businessName} className="w-14 h-14 rounded-xl object-cover" />
                  ) : (
                    <div className={`w-14 h-14 rounded-xl ${darkMode ? 'bg-slate-600' : 'bg-slate-100'} flex items-center justify-center`}>
                      <Building2 className={`w-7 h-7 ${mutedClass}`} />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={`text-xl font-black ${textClass}`}>{selectedTenant.businessName}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                        selectedTenant.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {selectedTenant.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-sm ${mutedClass}`}>{selectedTenant.industryType || 'General'}</span>
                      {selectedTenant.slug && (
                        <span className="text-sm text-indigo-600 font-mono flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          /{selectedTenant.slug}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedTenant(null);
                    setTenantFullData(null);
                  }}
                  className={`p-2 ${mutedClass} hover:${textClass} rounded-lg`}
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 mt-4 overflow-x-auto">
                {[
                  { id: 'overview', label: 'Overview', icon: BarChart3 },
                  { id: 'financials', label: 'Financials', icon: DollarSign },
                  { id: 'staff', label: 'Staff', icon: Users },
                  { id: 'products', label: 'Products', icon: Package },
                  { id: 'branches', label: 'Branches', icon: GitBranch },
                  { id: 'settings', label: 'Settings', icon: Settings }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setDetailTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${
                      detailTab === tab.id
                        ? 'bg-indigo-600 text-white'
                        : `${mutedClass} hover:bg-slate-100`
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingFullData ? (
                <div className="flex items-center justify-center h-48">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <>
                  {/* Overview Tab */}
                  {detailTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Quick Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-emerald-50'}`}>
                          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Total Revenue</p>
                          <p className="text-2xl font-black text-emerald-600">{formatCurrency(tenantFullData?.financials?.revenue || 0)}</p>
                        </div>
                        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-indigo-50'}`}>
                          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Transactions</p>
                          <p className={`text-2xl font-black ${textClass}`}>{formatNumber(tenantFullData?.financials?.transactionCount || 0)}</p>
                        </div>
                        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-purple-50'}`}>
                          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Average Order</p>
                          <p className={`text-2xl font-black ${textClass}`}>{formatCurrency(tenantFullData?.financials?.averageTransaction || 0)}</p>
                        </div>
                        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-red-50'}`}>
                          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Void Rate</p>
                          <p className={`text-2xl font-black ${parseFloat(tenantFullData?.financials?.voidRate || 0) > 5 ? 'text-red-600' : textClass}`}>
                            {tenantFullData?.financials?.voidRate || 0}%
                          </p>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className={`${surfaceClass} rounded-xl border ${borderClass} p-4`}>
                        <h4 className={`text-sm font-bold ${textClass} mb-3`}>Business Information</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="flex items-center gap-2">
                            <Mail className={`w-4 h-4 ${mutedClass}`} />
                            <span className={`text-sm ${textClass}`}>{selectedTenant.businessEmail}</span>
                          </div>
                          {selectedTenant.businessPhone && (
                            <div className="flex items-center gap-2">
                              <Phone className={`w-4 h-4 ${mutedClass}`} />
                              <span className={`text-sm ${textClass}`}>{selectedTenant.businessPhone}</span>
                            </div>
                          )}
                          {selectedTenant.businessAddress && (
                            <div className="flex items-center gap-2">
                              <MapPin className={`w-4 h-4 ${mutedClass}`} />
                              <span className={`text-sm ${textClass}`}>{selectedTenant.businessAddress}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className={`w-4 h-4 ${mutedClass}`} />
                            <span className={`text-sm ${textClass}`}>Joined: {formatDate(selectedTenant.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Resources Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className={`p-4 rounded-xl border ${borderClass}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Users className={`w-4 h-4 ${mutedClass}`} />
                            <span className={`text-xs font-bold uppercase ${mutedClass}`}>Staff</span>
                          </div>
                          <p className={`text-xl font-black ${textClass}`}>{tenantFullData?.tenant?.users?.length || 0}</p>
                        </div>
                        <div className={`p-4 rounded-xl border ${borderClass}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Package className={`w-4 h-4 ${mutedClass}`} />
                            <span className={`text-xs font-bold uppercase ${mutedClass}`}>Products</span>
                          </div>
                          <p className={`text-xl font-black ${textClass}`}>{tenantFullData?.inventory?.totalProducts || 0}</p>
                        </div>
                        <div className={`p-4 rounded-xl border ${borderClass}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <GitBranch className={`w-4 h-4 ${mutedClass}`} />
                            <span className={`text-xs font-bold uppercase ${mutedClass}`}>Branches</span>
                          </div>
                          <p className={`text-xl font-black ${textClass}`}>{tenantFullData?.tenant?.branches?.length || 1}</p>
                        </div>
                        <div className={`p-4 rounded-xl border ${borderClass}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className={`w-4 h-4 ${mutedClass}`} />
                            <span className={`text-xs font-bold uppercase ${mutedClass}`}>Low Stock</span>
                          </div>
                          <p className={`text-xl font-black ${tenantFullData?.inventory?.lowStockCount > 0 ? 'text-amber-600' : textClass}`}>
                            {tenantFullData?.inventory?.lowStockCount || 0}
                          </p>
                        </div>
                      </div>

                      {/* Top Products */}
                      {tenantFullData?.topProducts?.length > 0 && (
                        <div className={`${surfaceClass} rounded-xl border ${borderClass} overflow-hidden`}>
                          <div className={`p-4 border-b ${borderClass}`}>
                            <h4 className={`text-sm font-bold ${textClass}`}>Top Products (30 days)</h4>
                          </div>
                          <div className="divide-y divide-slate-100 dark:divide-slate-700">
                            {tenantFullData.topProducts.slice(0, 5).map((product, index) => (
                              <div key={product.id} className="flex items-center justify-between p-3">
                                <div className="flex items-center gap-3">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    index === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {index + 1}
                                  </span>
                                  <span className={`text-sm font-bold ${textClass}`}>{product.name}</span>
                                </div>
                                <div className="text-right">
                                  <p className={`text-sm font-bold ${textClass}`}>{product.unitsSold} units</p>
                                  <p className={`text-xs ${mutedClass}`}>{formatCurrency(product.revenue)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Financials Tab */}
                  {detailTab === 'financials' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-emerald-50'}`}>
                          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Revenue</p>
                          <p className="text-2xl font-black text-emerald-600">{formatCurrency(tenantFullData?.financials?.revenue || 0)}</p>
                        </div>
                        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-red-50'}`}>
                          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Expenses</p>
                          <p className="text-2xl font-black text-red-600">{formatCurrency(tenantFullData?.financials?.expenses || 0)}</p>
                        </div>
                        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-indigo-50'}`}>
                          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Net Profit</p>
                          <p className={`text-2xl font-black ${(tenantFullData?.financials?.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(tenantFullData?.financials?.netProfit || 0)}
                          </p>
                        </div>
                        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-orange-50'}`}>
                          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Discounts Given</p>
                          <p className="text-2xl font-black text-orange-600">{formatCurrency(tenantFullData?.financials?.discounts || 0)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className={`p-4 rounded-xl border ${borderClass}`}>
                          <p className={`text-xs font-bold uppercase ${mutedClass} mb-1`}>Voided Amount</p>
                          <p className="text-xl font-black text-red-600">{formatCurrency(tenantFullData?.financials?.voidedAmount || 0)}</p>
                          <p className={`text-xs ${mutedClass}`}>{tenantFullData?.financials?.voidCount || 0} voided transactions</p>
                        </div>
                        <div className={`p-4 rounded-xl border ${borderClass}`}>
                          <p className={`text-xs font-bold uppercase ${mutedClass} mb-1`}>Expense Count</p>
                          <p className={`text-xl font-black ${textClass}`}>{tenantFullData?.financials?.expenseCount || 0}</p>
                        </div>
                      </div>

                      {/* Daily Sales Trend */}
                      {tenantFullData?.dailySales?.length > 0 && (
                        <div className={`${surfaceClass} rounded-xl border ${borderClass} overflow-hidden`}>
                          <div className={`p-4 border-b ${borderClass}`}>
                            <h4 className={`text-sm font-bold ${textClass}`}>Daily Sales (Last 30 Days)</h4>
                          </div>
                          <div className="p-4 overflow-x-auto">
                            <div className="flex items-end gap-1 h-32 min-w-max">
                              {tenantFullData.dailySales.slice().reverse().map((day, index) => {
                                const maxRevenue = Math.max(...tenantFullData.dailySales.map(d => parseFloat(d.revenue) || 0));
                                const height = maxRevenue > 0 ? ((parseFloat(day.revenue) || 0) / maxRevenue) * 100 : 0;
                                return (
                                  <div key={index} className="flex flex-col items-center gap-1 w-8">
                                    <div
                                      className="w-6 bg-indigo-500 rounded-t transition-all"
                                      style={{ height: `${Math.max(height, 4)}%` }}
                                      title={`${formatDate(day.date)}: ${formatCurrency(day.revenue)}`}
                                    />
                                    <span className={`text-[8px] ${mutedClass} -rotate-45`}>
                                      {new Date(day.date).getDate()}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Staff Tab */}
                  {detailTab === 'staff' && (
                    <div className="space-y-4">
                      {/* Staff Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-purple-50'}`}>
                          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Owners</p>
                          <p className="text-2xl font-black text-purple-600">
                            {tenantFullData?.tenant?.users?.filter(u => u.role === 'OWNER').length || 0}
                          </p>
                        </div>
                        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-indigo-50'}`}>
                          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Managers</p>
                          <p className="text-2xl font-black text-indigo-600">
                            {tenantFullData?.tenant?.users?.filter(u => u.role === 'MANAGER').length || 0}
                          </p>
                        </div>
                        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Cashiers</p>
                          <p className={`text-2xl font-black ${textClass}`}>
                            {tenantFullData?.tenant?.users?.filter(u => u.role === 'CASHIER').length || 0}
                          </p>
                        </div>
                        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-emerald-50'}`}>
                          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Active</p>
                          <p className="text-2xl font-black text-emerald-600">
                            {tenantFullData?.tenant?.users?.filter(u => u.isActive).length || 0}
                          </p>
                        </div>
                      </div>

                      {/* Staff Info Box */}
                      <div className={`p-4 rounded-xl ${darkMode ? 'bg-amber-900/20' : 'bg-amber-50'} border border-amber-200`}>
                        <div className="flex items-center gap-2 text-amber-700 mb-2">
                          <Shield className="w-4 h-4" />
                          <span className="text-sm font-bold">Login Credentials</span>
                        </div>
                        <p className={`text-xs ${darkMode ? 'text-amber-300' : 'text-amber-600'}`}>
                          Passwords are securely hashed and cannot be viewed. Users can login with the username shown below.
                          Default passwords follow the pattern: Role@123 (e.g., Owner@123, Manager@123, Cashier@123)
                        </p>
                      </div>

                      {tenantFullData?.tenant?.users?.length > 0 ? (
                        <div className={`${surfaceClass} rounded-xl border ${borderClass} overflow-hidden`}>
                          <table className="w-full">
                            <thead className={darkMode ? 'bg-slate-700' : 'bg-slate-50'}>
                              <tr>
                                <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Full Name</th>
                                <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Username</th>
                                <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Role</th>
                                <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Branch</th>
                                <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Status</th>
                                <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Joined</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                              {tenantFullData.tenant.users.map(user => (
                                <tr key={user.id} className={`${!user.isActive ? 'opacity-50' : ''}`}>
                                  <td className="px-4 py-3">
                                    <p className={`text-sm font-bold ${textClass}`}>{user.fullName}</p>
                                  </td>
                                  <td className="px-4 py-3">
                                    <code className={`px-2 py-1 rounded text-xs font-mono ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} ${textClass}`}>
                                      {user.username}
                                    </code>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                      user.role === 'OWNER' || user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                                      user.role === 'MANAGER' ? 'bg-indigo-100 text-indigo-700' :
                                      'bg-slate-100 text-slate-700'
                                    }`}>
                                      {user.role === 'ADMIN' ? 'OWNER' : user.role}
                                    </span>
                                  </td>
                                  <td className={`px-4 py-3 text-sm ${mutedClass}`}>
                                    {user.branch?.name || 'Main'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                                      user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                      {user.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                  <td className={`px-4 py-3 text-sm ${mutedClass}`}>
                                    {formatDate(user.createdAt)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Users className={`w-12 h-12 mx-auto mb-3 ${mutedClass}`} />
                          <p className={`text-sm ${mutedClass}`}>No staff data available</p>
                        </div>
                      )}

                      {/* Staff Performance */}
                      {tenantFullData?.staffPerformance?.length > 0 && (
                        <div className={`${surfaceClass} rounded-xl border ${borderClass} overflow-hidden`}>
                          <div className={`p-4 border-b ${borderClass}`}>
                            <h4 className={`text-sm font-bold ${textClass}`}>Staff Performance (30 days)</h4>
                          </div>
                          <table className="w-full">
                            <thead className={darkMode ? 'bg-slate-700' : 'bg-slate-50'}>
                              <tr>
                                <th className={`px-4 py-2 text-left text-xs font-bold uppercase ${mutedClass}`}>Staff</th>
                                <th className={`px-4 py-2 text-right text-xs font-bold uppercase ${mutedClass}`}>Sales</th>
                                <th className={`px-4 py-2 text-right text-xs font-bold uppercase ${mutedClass}`}>Revenue</th>
                                <th className={`px-4 py-2 text-right text-xs font-bold uppercase ${mutedClass}`}>Voids</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                              {tenantFullData.staffPerformance.map((staff, index) => (
                                <tr key={index}>
                                  <td className="px-4 py-2">
                                    <p className={`text-sm font-bold ${textClass}`}>{staff.fullName}</p>
                                  </td>
                                  <td className={`px-4 py-2 text-right text-sm ${textClass}`}>{staff.salesCount}</td>
                                  <td className="px-4 py-2 text-right text-sm font-bold text-emerald-600">
                                    {formatCurrency(staff.revenue)}
                                  </td>
                                  <td className={`px-4 py-2 text-right text-sm ${staff.voidCount > 5 ? 'text-red-600 font-bold' : mutedClass}`}>
                                    {staff.voidCount}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Products Tab */}
                  {detailTab === 'products' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-indigo-50'}`}>
                          <p className={`text-xs font-bold uppercase ${mutedClass}`}>Total Products</p>
                          <p className={`text-xl font-black ${textClass}`}>{tenantFullData?.inventory?.totalProducts || 0}</p>
                        </div>
                        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-emerald-50'}`}>
                          <p className={`text-xs font-bold uppercase ${mutedClass}`}>Total Units</p>
                          <p className={`text-xl font-black ${textClass}`}>{formatNumber(tenantFullData?.inventory?.totalUnits || 0)}</p>
                        </div>
                        <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-amber-50'}`}>
                          <p className={`text-xs font-bold uppercase ${mutedClass}`}>Low Stock</p>
                          <p className={`text-xl font-black ${tenantFullData?.inventory?.lowStockCount > 0 ? 'text-amber-600' : textClass}`}>
                            {tenantFullData?.inventory?.lowStockCount || 0}
                          </p>
                        </div>
                      </div>

                      {tenantFullData?.tenant?.products?.length > 0 ? (
                        <div className={`${surfaceClass} rounded-xl border ${borderClass} overflow-hidden`}>
                          <table className="w-full">
                            <thead className={darkMode ? 'bg-slate-700' : 'bg-slate-50'}>
                              <tr>
                                <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Product</th>
                                <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${mutedClass}`}>Cost</th>
                                <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${mutedClass}`}>Price</th>
                                <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${mutedClass}`}>Stock</th>
                                <th className={`px-4 py-3 text-center text-xs font-bold uppercase ${mutedClass}`}>Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                              {tenantFullData.tenant.products.slice(0, 20).map(product => (
                                <tr key={product.id}>
                                  <td className="px-4 py-3">
                                    <p className={`text-sm font-bold ${textClass}`}>{product.name}</p>
                                    <p className={`text-xs ${mutedClass}`}>{product.sku}</p>
                                  </td>
                                  <td className={`px-4 py-3 text-right text-sm ${mutedClass}`}>
                                    {formatCurrency(product.costPrice)}
                                  </td>
                                  <td className={`px-4 py-3 text-right text-sm font-bold ${textClass}`}>
                                    {formatCurrency(product.sellingPrice)}
                                  </td>
                                  <td className={`px-4 py-3 text-right text-sm ${
                                    product.quantity <= product.lowStockThreshold ? 'text-amber-600 font-bold' : textClass
                                  }`}>
                                    {product.quantity}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                      product.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                      {product.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Package className={`w-12 h-12 mx-auto mb-3 ${mutedClass}`} />
                          <p className={`text-sm ${mutedClass}`}>No product data available</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Branches Tab */}
                  {detailTab === 'branches' && (
                    <div className="space-y-4">
                      {tenantFullData?.tenant?.branches?.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {tenantFullData.tenant.branches.map(branch => (
                            <div key={branch.id} className={`p-4 rounded-xl border ${borderClass}`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <GitBranch className={`w-5 h-5 ${branch.isMain ? 'text-indigo-600' : mutedClass}`} />
                                  <span className={`text-sm font-bold ${textClass}`}>{branch.name}</span>
                                  {branch.isMain && (
                                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">Main</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                    branch.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {branch.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                  {!branch.isMain && (
                                    <button
                                      onClick={() => handleSetMainBranchAdmin(branch)}
                                      disabled={actionLoading}
                                      className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                                      title="Set as Main Branch"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {tenantFullData?.tenant?.branches?.length > 1 && (
                                    <button
                                      onClick={() => handleDeleteBranchAdmin(branch)}
                                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Delete Branch"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {branch.address && (
                                <p className={`text-xs ${mutedClass} mb-2`}>{branch.address}</p>
                              )}
                              <div className="flex items-center gap-4">
                                <span className={`text-xs ${mutedClass}`}>
                                  <Users className="w-3 h-3 inline mr-1" />
                                  {branch._count?.users || 0} staff
                                </span>
                                <span className={`text-xs ${mutedClass}`}>
                                  <ShoppingCart className="w-3 h-3 inline mr-1" />
                                  {branch._count?.sales || 0} sales
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <GitBranch className={`w-12 h-12 mx-auto mb-3 ${mutedClass}`} />
                          <p className={`text-sm ${mutedClass}`}>No branch data available</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Settings Tab */}
                  {detailTab === 'settings' && (
                    <div className="space-y-6">
                      {/* URL Slug Section */}
                      <div className={`${surfaceClass} rounded-xl border ${borderClass} p-5`}>
                        <div className="flex items-center gap-2 mb-4">
                          <Globe className="w-5 h-5 text-indigo-500" />
                          <h4 className={`text-sm font-black uppercase ${textClass}`}>URL Slug & Access</h4>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className={`text-xs font-bold uppercase ${mutedClass} mb-2 block`}>
                              Tenant URL Slug
                            </label>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 relative">
                                <div className="flex items-center">
                                  <span className={`px-3 py-3 rounded-l-xl border-l border-t border-b ${borderClass} ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} ${mutedClass} text-sm`}>
                                    yourdomain.com/
                                  </span>
                                  <input
                                    type="text"
                                    value={editSlug}
                                    onChange={(e) => handleSlugChange(e.target.value)}
                                    placeholder="business-name"
                                    className={`flex-1 px-4 py-3 rounded-r-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm font-mono ${
                                      slugStatus.available === true && editSlug !== selectedTenant?.slug ? 'border-emerald-500 ring-1 ring-emerald-200' :
                                      slugStatus.available === false || slugStatus.error ? 'border-red-500 ring-1 ring-red-200' : ''
                                    }`}
                                  />
                                </div>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  {slugStatus.checking && (
                                    <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                                  )}
                                  {!slugStatus.checking && slugStatus.available === true && (
                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                  )}
                                  {!slugStatus.checking && (slugStatus.available === false || slugStatus.error) && (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={handleSaveSlug}
                                disabled={savingSlug || !editSlug || slugStatus.available !== true || editSlug === selectedTenant?.slug}
                                className="px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                              >
                                {savingSlug ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  'Save'
                                )}
                              </button>
                            </div>
                            {slugStatus.error && (
                              <p className="text-xs text-red-500 mt-1">{slugStatus.error}</p>
                            )}
                            {slugStatus.available === true && editSlug !== selectedTenant?.slug && !slugStatus.error && (
                              <p className="text-xs text-emerald-600 mt-1">This slug is available</p>
                            )}
                            {slugStatus.available === false && !slugStatus.error && (
                              <p className="text-xs text-red-500 mt-1">This slug is already taken</p>
                            )}
                          </div>

                          {!selectedTenant?.slug && (
                            <div className={`p-3 rounded-lg ${darkMode ? 'bg-amber-900/20' : 'bg-amber-50'} border border-amber-200`}>
                              <div className="flex items-center gap-2 text-amber-700">
                                <AlertTriangle className="w-4 h-4" />
                                <p className="text-xs font-bold">No slug assigned</p>
                              </div>
                              <p className={`text-xs ${mutedClass} mt-1`}>
                                This tenant cannot access the system until a URL slug is assigned.
                              </p>
                              <button
                                onClick={() => {
                                  const suggested = generateSlug(selectedTenant.businessName);
                                  setEditSlug(suggested);
                                  checkSlugAvailability(suggested, selectedTenant?.slug);
                                }}
                                className="mt-2 text-xs font-bold text-amber-700 hover:text-amber-800"
                              >
                                Generate Suggested Slug →
                              </button>
                            </div>
                          )}

                          {editSlug && slugStatus.available && (
                            <div className={`p-3 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-slate-50'} border ${borderClass}`}>
                              <p className={`text-xs font-bold uppercase ${mutedClass} mb-1`}>Tenant Login URL</p>
                              <p className={`text-sm font-mono ${textClass}`}>
                                yourdomain.com/<span className="text-indigo-600 font-bold">{editSlug}</span>/login
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Subscription Info */}
                      <div className={`${surfaceClass} rounded-xl border ${borderClass} p-5`}>
                        <div className="flex items-center gap-2 mb-4">
                          <CreditCard className="w-5 h-5 text-indigo-500" />
                          <h4 className={`text-sm font-black uppercase ${textClass}`}>Subscription</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className={`text-xs ${mutedClass}`}>Start Date</p>
                            <p className={`text-sm font-bold ${textClass}`}>{formatDate(selectedTenant?.subscriptionStart)}</p>
                          </div>
                          <div>
                            <p className={`text-xs ${mutedClass}`}>End Date</p>
                            <p className={`text-sm font-bold ${textClass}`}>{formatDate(selectedTenant?.subscriptionEnd || selectedTenant?.subscriptionEndDate)}</p>
                          </div>
                          <div>
                            <p className={`text-xs ${mutedClass}`}>Status</p>
                            {(() => {
                              const status = getSubscriptionStatus(selectedTenant?.subscriptionEnd || selectedTenant?.subscriptionEndDate);
                              return (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${status.bg} ${status.text}`}>
                                  {status.label}
                                </span>
                              );
                            })()}
                          </div>
                          <div>
                            <p className={`text-xs ${mutedClass}`}>Days Remaining</p>
                            <p className={`text-sm font-bold ${textClass}`}>
                              {getSubscriptionStatus(selectedTenant?.subscriptionEnd || selectedTenant?.subscriptionEndDate).days}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setShowExtendModal(true);
                          }}
                          className="mt-4 w-full px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 flex items-center justify-center gap-2"
                        >
                          <CalendarPlus className="w-4 h-4" />
                          Extend Subscription
                        </button>
                      </div>

                      {/* Tenant Status */}
                      <div className={`${surfaceClass} rounded-xl border ${borderClass} p-5`}>
                        <div className="flex items-center gap-2 mb-4">
                          <Shield className="w-5 h-5 text-indigo-500" />
                          <h4 className={`text-sm font-black uppercase ${textClass}`}>Access Control</h4>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`text-sm font-bold ${textClass}`}>Tenant Status</p>
                            <p className={`text-xs ${mutedClass}`}>
                              {selectedTenant?.isActive ? 'Tenant can access the system' : 'Tenant access is disabled'}
                            </p>
                          </div>
                          <button
                            onClick={() => handleToggleStatus(selectedTenant)}
                            disabled={actionLoading}
                            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${
                              selectedTenant?.isActive
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            }`}
                          >
                            {selectedTenant?.isActive ? (
                              <>
                                <ToggleRight className="w-4 h-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-4 h-4" />
                                Activate
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Danger Zone */}
                      <div className={`${surfaceClass} rounded-xl border-2 border-red-300 p-5`}>
                        <div className="flex items-center gap-2 mb-4">
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                          <h4 className="text-sm font-black uppercase text-red-600">Danger Zone</h4>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`text-sm font-bold ${textClass}`}>Delete Tenant</p>
                            <p className={`text-xs ${mutedClass}`}>
                              Permanently delete this tenant and all their data. This action cannot be undone.
                            </p>
                          </div>
                          <button
                            onClick={() => setShowDeleteModal(true)}
                            className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete Tenant
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Extend Subscription Modal */}
      {showExtendModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${surfaceClass} rounded-2xl max-w-md w-full`}>
            <div className={`p-6 border-b ${borderClass}`}>
              <h3 className={`text-lg font-bold ${textClass}`}>Extend Subscription</h3>
              <p className={`text-sm ${mutedClass}`}>{selectedTenant.businessName}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`text-xs font-bold uppercase ${mutedClass} block mb-2`}>Extension Period</label>
                <select
                  value={extensionMonths}
                  onChange={(e) => setExtensionMonths(parseInt(e.target.value))}
                  className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                >
                  <option value={1}>1 Month</option>
                  <option value={3}>3 Months</option>
                  <option value={6}>6 Months</option>
                  <option value={12}>12 Months</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowExtendModal(false);
                    setSelectedTenant(null);
                  }}
                  className={`flex-1 px-4 py-3 border ${borderClass} rounded-xl text-sm font-bold ${textClass}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExtendSubscription}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Extending...' : 'Extend'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Toggle Confirmation Modal */}
      {showStatusConfirm && statusToggleTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${surfaceClass} rounded-2xl max-w-md w-full`}>
            <div className={`p-6 border-b ${borderClass}`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  statusToggleTenant.isActive ? 'bg-red-100' : 'bg-emerald-100'
                }`}>
                  {statusToggleTenant.isActive ? (
                    <ToggleRight className="w-6 h-6 text-red-600" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-emerald-600" />
                  )}
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${textClass}`}>
                    {statusToggleTenant.isActive ? 'Deactivate' : 'Activate'} Tenant
                  </h3>
                  <p className={`text-sm ${mutedClass}`}>{statusToggleTenant.businessName}</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className={`text-sm ${textClass} mb-6`}>
                {statusToggleTenant.isActive ? (
                  <>
                    Are you sure you want to <span className="font-bold text-red-600">deactivate</span> this tenant?
                    They will no longer be able to access the system.
                  </>
                ) : (
                  <>
                    Are you sure you want to <span className="font-bold text-emerald-600">activate</span> this tenant?
                    They will regain full access to the system.
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowStatusConfirm(false);
                    setStatusToggleTenant(null);
                  }}
                  className={`flex-1 px-4 py-3 border ${borderClass} rounded-xl text-sm font-bold ${textClass}`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmToggleStatus}
                  disabled={actionLoading}
                  className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 ${
                    statusToggleTenant.isActive
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {actionLoading ? 'Processing...' : (statusToggleTenant.isActive ? 'Deactivate' : 'Activate')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Tenant Confirmation Modal */}
      {showDeleteModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${surfaceClass} rounded-2xl max-w-md w-full`}>
            <div className={`p-6 border-b ${borderClass}`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${textClass}`}>Delete Tenant</h3>
                  <p className={`text-sm ${mutedClass}`}>{selectedTenant.businessName}</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-red-900/20' : 'bg-red-50'} border border-red-200 mb-4`}>
                <p className="text-sm text-red-700 font-bold mb-2">Warning: This action cannot be undone!</p>
                <p className="text-xs text-red-600">
                  This will permanently delete:
                </p>
                <ul className="text-xs text-red-600 list-disc list-inside mt-1">
                  <li>All users and staff accounts</li>
                  <li>All products and inventory</li>
                  <li>All sales and transactions</li>
                  <li>All expenses and financial data</li>
                  <li>All customers and their records</li>
                  <li>All branches and settings</li>
                </ul>
              </div>

              <div className="mb-4">
                <label className={`text-xs font-bold uppercase ${mutedClass} block mb-2`}>
                  Type "{selectedTenant.businessName}" to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder="Type business name to confirm"
                  className={`w-full px-4 py-3 rounded-xl border ${
                    deleteConfirmName.toLowerCase() === selectedTenant.businessName.toLowerCase()
                      ? 'border-red-500 ring-1 ring-red-200'
                      : borderClass
                  } ${surfaceClass} ${textClass} text-sm`}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmName('');
                  }}
                  className={`flex-1 px-4 py-3 border ${borderClass} rounded-xl text-sm font-bold ${textClass}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTenant}
                  disabled={deleting || deleteConfirmName.toLowerCase() !== selectedTenant.businessName.toLowerCase()}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Forever
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Branch Confirmation Modal */}
      {branchDeleteModal.show && branchDeleteModal.branch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${surfaceClass} rounded-2xl max-w-md w-full`}>
            <div className={`p-6 border-b ${borderClass}`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <GitBranch className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${textClass}`}>Delete Branch</h3>
                  <p className={`text-sm ${mutedClass}`}>{branchDeleteModal.branch.name}</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-red-900/20' : 'bg-red-50'} border border-red-200 mb-4`}>
                <p className="text-sm text-red-700 font-bold mb-2">This will permanently delete this branch.</p>
                {branchDeleteModal.branch.isMain && (
                  <div className={`mt-2 p-3 rounded-lg ${darkMode ? 'bg-amber-900/20' : 'bg-amber-50'} border border-amber-200`}>
                    <p className="text-xs text-amber-700 font-bold">This is the main branch</p>
                    <p className="text-xs text-amber-600 mt-1">
                      Another branch will be automatically promoted to main branch after deletion.
                    </p>
                  </div>
                )}
                {((branchDeleteModal.branch._count?.users || 0) > 0 || (branchDeleteModal.branch._count?.sales || 0) > 0) && (
                  <div className="mt-2">
                    <p className="text-xs text-red-600 mb-1">This branch has:</p>
                    <ul className="text-xs text-red-600 list-disc list-inside">
                      <li>{branchDeleteModal.branch._count?.users || 0} staff members</li>
                      <li>{branchDeleteModal.branch._count?.sales || 0} sales records</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Transfer Selection */}
              {(branchDeleteModal.branch.isMain || (branchDeleteModal.branch._count?.users || 0) > 0 || (branchDeleteModal.branch._count?.sales || 0) > 0) && (
                <div className="mb-4">
                  <label className={`text-xs font-bold uppercase ${mutedClass} block mb-2`}>
                    Transfer data to {branchDeleteModal.branch.isMain ? '(will become new main branch)' : '*'}
                  </label>
                  <select
                    value={branchTransferTo}
                    onChange={(e) => setBranchTransferTo(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                  >
                    <option value="">Auto-select (oldest active branch)</option>
                    {tenantFullData?.tenant?.branches
                      ?.filter(b => b.id !== branchDeleteModal.branch.id && b.isActive)
                      .map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.isMain ? '(Main)' : ''}
                        </option>
                      ))
                    }
                  </select>
                </div>
              )}

              <div className="mb-4">
                <label className={`text-xs font-bold uppercase ${mutedClass} block mb-2`}>
                  Type "{branchDeleteModal.branch.name}" to confirm
                </label>
                <input
                  type="text"
                  value={branchDeleteConfirm}
                  onChange={(e) => setBranchDeleteConfirm(e.target.value)}
                  placeholder="Type branch name to confirm"
                  className={`w-full px-4 py-3 rounded-xl border ${
                    branchDeleteConfirm.toLowerCase() === branchDeleteModal.branch.name.toLowerCase()
                      ? 'border-red-500 ring-1 ring-red-200'
                      : borderClass
                  } ${surfaceClass} ${textClass} text-sm`}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setBranchDeleteModal({ show: false, branch: null });
                    setBranchDeleteConfirm('');
                    setBranchTransferTo('');
                  }}
                  className={`flex-1 px-4 py-3 border ${borderClass} rounded-xl text-sm font-bold ${textClass}`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteBranchAdmin}
                  disabled={deletingBranch || branchDeleteConfirm.toLowerCase() !== branchDeleteModal.branch.name.toLowerCase()}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deletingBranch ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Branch
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tenants;
