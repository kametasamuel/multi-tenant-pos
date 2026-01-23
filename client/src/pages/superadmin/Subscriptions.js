import React, { useState, useEffect } from 'react';
import { superAdminAPI } from '../../api';
import {
  CreditCard,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  RefreshCw,
  Mail,
  ChevronRight,
  Plus,
  Edit,
  BarChart3,
  PieChart,
  Users
} from 'lucide-react';

const Subscriptions = ({
  darkMode = false,
  surfaceClass = 'bg-white',
  textClass = 'text-slate-900',
  mutedClass = 'text-slate-500',
  borderClass = 'border-slate-200'
}) => {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState({
    totalActive: 0,
    totalRevenue: 0,
    expiringThisWeek: 0,
    expiringThisMonth: 0,
    expired: 0,
    avgDuration: 0
  });
  const [healthData, setHealthData] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    search: ''
  });
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [extendModal, setExtendModal] = useState(null);
  const [extensionMonths, setExtensionMonths] = useState(3);
  const [adjustmentType, setAdjustmentType] = useState('extend'); // 'extend' or 'reduce'
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tenantsRes, healthRes] = await Promise.all([
        superAdminAPI.getTenants({ limit: 100 }),
        superAdminAPI.getSubscriptionHealth()
      ]);

      const tenantsList = tenantsRes.data.tenants || [];
      setTenants(tenantsList);
      setHealthData(healthRes.data);

      // Calculate stats
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const active = tenantsList.filter(t => t.isActive && new Date(t.subscriptionEnd) > now);
      const expiringWeek = tenantsList.filter(t => {
        const endDate = new Date(t.subscriptionEnd);
        return endDate > now && endDate <= weekFromNow;
      });
      const expiringMonth = tenantsList.filter(t => {
        const endDate = new Date(t.subscriptionEnd);
        return endDate > now && endDate <= monthFromNow;
      });
      const expired = tenantsList.filter(t => new Date(t.subscriptionEnd) <= now);

      setStats({
        totalActive: active.length,
        totalRevenue: active.length * 49.99, // Mock calculation
        expiringThisWeek: expiringWeek.length,
        expiringThisMonth: expiringMonth.length,
        expired: expired.length,
        avgDuration: 6 // Mock average months
      });

    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustSubscription = async () => {
    if (!extendModal) return;

    setAdjustLoading(true);
    setAdjustError('');

    try {
      const months = adjustmentType === 'reduce' ? -extensionMonths : extensionMonths;
      await superAdminAPI.extendSubscription(extendModal.id, { months });
      setExtendModal(null);
      setExtensionMonths(3);
      setAdjustmentType('extend');
      fetchData();
    } catch (error) {
      console.error('Error adjusting subscription:', error);
      setAdjustError(error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to adjust subscription');
    } finally {
      setAdjustLoading(false);
    }
  };

  const getSubscriptionStatus = (tenant) => {
    const now = new Date();
    const endDate = new Date(tenant.subscriptionEnd);
    const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) return { label: 'Expired', color: 'bg-red-100 text-red-700', days: daysRemaining };
    if (daysRemaining <= 7) return { label: 'Critical', color: 'bg-rose-100 text-rose-700', days: daysRemaining };
    if (daysRemaining <= 30) return { label: 'Expiring Soon', color: 'bg-amber-100 text-amber-700', days: daysRemaining };
    return { label: 'Active', color: 'bg-emerald-100 text-emerald-700', days: daysRemaining };
  };

  const filteredTenants = tenants.filter(tenant => {
    const status = getSubscriptionStatus(tenant);
    if (filters.status === 'active' && status.label === 'Expired') return false;
    if (filters.status === 'expiring' && !['Critical', 'Expiring Soon'].includes(status.label)) return false;
    if (filters.status === 'expired' && status.label !== 'Expired') return false;
    if (filters.search && !tenant.businessName.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const StatCard = ({ icon: Icon, label, value, subValue, color }) => (
    <div className={`${surfaceClass} rounded-2xl p-5 border ${borderClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className={`text-2xl font-black ${textClass}`}>{value}</p>
      <p className={`text-xs font-medium ${mutedClass} mt-1`}>{label}</p>
      {subValue && <p className={`text-xs ${mutedClass} mt-0.5`}>{subValue}</p>}
    </div>
  );

  if (loading) {
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
          <h1 className={`text-2xl font-black ${textClass}`}>Subscription Management</h1>
          <p className={`text-sm ${mutedClass}`}>Monitor and manage tenant subscriptions</p>
        </div>
        <button
          onClick={fetchData}
          className={`px-4 py-2 ${surfaceClass} border ${borderClass} rounded-xl text-sm font-bold ${textClass} hover:bg-slate-50 flex items-center gap-2`}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={CheckCircle}
          label="Active Subscriptions"
          value={stats.totalActive}
          color="bg-emerald-600"
        />
        <StatCard
          icon={DollarSign}
          label="Monthly Revenue"
          value={formatCurrency(stats.totalRevenue)}
          color="bg-indigo-600"
        />
        <StatCard
          icon={AlertTriangle}
          label="Expiring This Week"
          value={stats.expiringThisWeek}
          subValue="Needs attention"
          color="bg-rose-600"
        />
        <StatCard
          icon={Clock}
          label="Expiring This Month"
          value={stats.expiringThisMonth}
          color="bg-amber-500"
        />
        <StatCard
          icon={XCircle}
          label="Expired"
          value={stats.expired}
          subValue="Still active"
          color="bg-red-500"
        />
        <StatCard
          icon={Calendar}
          label="Average Duration"
          value={`${stats.avgDuration} months`}
          color="bg-purple-600"
        />
      </div>

      {/* Health Overview */}
      {healthData && (
        <div className={`${surfaceClass} rounded-2xl p-6 border ${borderClass}`}>
          <h3 className={`text-sm font-black uppercase ${mutedClass} mb-4`}>Subscription Health Overview</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-2">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="40" cy="40" r="35" fill="none" stroke={darkMode ? '#334155' : '#e2e8f0'} strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="35" fill="none" stroke="#10b981" strokeWidth="6"
                    strokeDasharray={`${(healthData.healthy / healthData.total) * 220} 220`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-lg font-bold ${textClass}`}>{healthData.healthy || 0}</span>
                </div>
              </div>
              <p className={`text-xs font-bold ${textClass}`}>Healthy</p>
              <p className={`text-xs ${mutedClass}`}>More than 30 days</p>
            </div>
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-2">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="40" cy="40" r="35" fill="none" stroke={darkMode ? '#334155' : '#e2e8f0'} strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="35" fill="none" stroke="#f59e0b" strokeWidth="6"
                    strokeDasharray={`${(healthData.warning / healthData.total) * 220} 220`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-lg font-bold ${textClass}`}>{healthData.warning || 0}</span>
                </div>
              </div>
              <p className={`text-xs font-bold ${textClass}`}>Warning</p>
              <p className={`text-xs ${mutedClass}`}>7-30 days remaining</p>
            </div>
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-2">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="40" cy="40" r="35" fill="none" stroke={darkMode ? '#334155' : '#e2e8f0'} strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="35" fill="none" stroke="#ef4444" strokeWidth="6"
                    strokeDasharray={`${(healthData.critical / healthData.total) * 220} 220`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-lg font-bold ${textClass}`}>{healthData.critical || 0}</span>
                </div>
              </div>
              <p className={`text-xs font-bold ${textClass}`}>Critical</p>
              <p className={`text-xs ${mutedClass}`}>Less than 7 days</p>
            </div>
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-2">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="40" cy="40" r="35" fill="none" stroke={darkMode ? '#334155' : '#e2e8f0'} strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="35" fill="none" stroke="#64748b" strokeWidth="6"
                    strokeDasharray={`${(healthData.expired / healthData.total) * 220} 220`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-lg font-bold ${textClass}`}>{healthData.expired || 0}</span>
                </div>
              </div>
              <p className={`text-xs font-bold ${textClass}`}>Expired</p>
              <p className={`text-xs ${mutedClass}`}>Past due</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
            <input
              type="text"
              placeholder="Search tenants..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className={`w-full pl-10 pr-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className={`px-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
          >
            <option value="all">All Subscriptions</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring Soon</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Tenants List */}
      <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={darkMode ? 'bg-slate-700' : 'bg-slate-50'}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Business</th>
                <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Industry</th>
                <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Status</th>
                <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Expires</th>
                <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Days Remaining</th>
                <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Users</th>
                <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTenants.map((tenant) => {
                const status = getSubscriptionStatus(tenant);
                return (
                  <tr key={tenant.id} className={`hover:${darkMode ? 'bg-slate-700' : 'bg-slate-50'} transition-colors`}>
                    <td className={`px-4 py-3`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${darkMode ? 'bg-slate-600' : 'bg-slate-100'} flex items-center justify-center`}>
                          <Building2 className={`w-5 h-5 ${mutedClass}`} />
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${textClass}`}>{tenant.businessName}</p>
                          <p className={`text-xs ${mutedClass}`}>{tenant.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-sm ${mutedClass}`}>{tenant.industryType || 'General'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${status.color}`}>
                        {status.label === 'Active' && <CheckCircle className="w-3 h-3" />}
                        {status.label === 'Expired' && <XCircle className="w-3 h-3" />}
                        {['Critical', 'Expiring Soon'].includes(status.label) && <AlertTriangle className="w-3 h-3" />}
                        {status.label}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-sm ${mutedClass}`}>{formatDate(tenant.subscriptionEnd)}</td>
                    <td className={`px-4 py-3 text-sm font-bold ${
                      status.days < 0 ? 'text-red-600' :
                      status.days <= 7 ? 'text-rose-600' :
                      status.days <= 30 ? 'text-amber-600' :
                      'text-emerald-600'
                    }`}>
                      {status.days < 0 ? `${Math.abs(status.days)} days overdue` : `${status.days} days`}
                    </td>
                    <td className={`px-4 py-3`}>
                      <div className="flex items-center gap-1">
                        <Users className={`w-4 h-4 ${mutedClass}`} />
                        <span className={`text-sm ${textClass}`}>{tenant._count?.users || 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setExtendModal(tenant);
                            setAdjustmentType('extend');
                            setExtensionMonths(3);
                          }}
                          className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3" />
                          Adjust
                        </button>
                        <button
                          onClick={() => setSelectedTenant(tenant)}
                          className={`p-2 ${mutedClass} hover:${textClass} rounded-lg`}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredTenants.length === 0 && (
          <div className="text-center py-12">
            <CreditCard className={`w-12 h-12 mx-auto mb-4 ${mutedClass}`} />
            <p className={`text-sm font-bold ${textClass}`}>No subscriptions found</p>
            <p className={`text-xs ${mutedClass}`}>Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* Adjust Subscription Modal */}
      {extendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${surfaceClass} rounded-2xl max-w-md w-full`}>
            <div className={`p-6 border-b ${borderClass}`}>
              <h3 className={`text-lg font-bold ${textClass}`}>Adjust Subscription</h3>
              <p className={`text-sm ${mutedClass}`}>{extendModal.businessName}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className={`text-xs font-bold uppercase ${mutedClass} mb-2`}>Current Expiry</p>
                <p className={`text-sm font-bold ${textClass}`}>{formatDate(extendModal.subscriptionEnd)}</p>
              </div>
              {/* Action Type Toggle */}
              <div>
                <label className={`text-xs font-bold uppercase ${mutedClass} mb-2 block`}>
                  Action
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAdjustmentType('extend')}
                    className={`flex-1 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                      adjustmentType === 'extend'
                        ? 'bg-emerald-600 text-white'
                        : `${surfaceClass} border ${borderClass} ${textClass}`
                    }`}
                  >
                    <Plus className="w-4 h-4 inline mr-1" />
                    Extend
                  </button>
                  <button
                    onClick={() => setAdjustmentType('reduce')}
                    className={`flex-1 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                      adjustmentType === 'reduce'
                        ? 'bg-red-600 text-white'
                        : `${surfaceClass} border ${borderClass} ${textClass}`
                    }`}
                  >
                    <TrendingDown className="w-4 h-4 inline mr-1" />
                    Reduce
                  </button>
                </div>
              </div>
              <div>
                <label className={`text-xs font-bold uppercase ${mutedClass} mb-2 block`}>
                  {adjustmentType === 'extend' ? 'Extension' : 'Reduction'} Period
                </label>
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
              <div className={`p-4 rounded-xl ${adjustmentType === 'reduce' ? (darkMode ? 'bg-red-900/30' : 'bg-red-50') : (darkMode ? 'bg-slate-700' : 'bg-slate-50')}`}>
                <p className={`text-xs font-bold uppercase ${mutedClass} mb-1`}>New Expiry Date</p>
                <p className={`text-lg font-bold ${adjustmentType === 'reduce' ? 'text-red-600' : textClass}`}>
                  {formatDate(new Date(new Date(extendModal.subscriptionEnd).getTime() + (adjustmentType === 'reduce' ? -1 : 1) * extensionMonths * 30 * 24 * 60 * 60 * 1000))}
                </p>
                {adjustmentType === 'reduce' && (
                  <p className="text-xs text-red-500 mt-1">⚠️ This will shorten the subscription period</p>
                )}
              </div>
              {adjustError && (
                <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-600 dark:text-red-400">{adjustError}</p>
                </div>
              )}
            </div>
            <div className={`flex items-center justify-end gap-3 p-6 border-t ${borderClass}`}>
              <button
                onClick={() => {
                  setExtendModal(null);
                  setAdjustmentType('extend');
                  setAdjustError('');
                }}
                disabled={adjustLoading}
                className={`px-4 py-2 ${surfaceClass} border ${borderClass} rounded-xl text-sm font-bold ${textClass} disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustSubscription}
                disabled={adjustLoading}
                className={`px-4 py-2 ${adjustmentType === 'reduce' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-xl text-sm font-bold disabled:opacity-50`}
              >
                {adjustLoading ? 'Processing...' : `${adjustmentType === 'extend' ? 'Extend' : 'Reduce'} Subscription`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tenant Detail Modal */}
      {selectedTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${surfaceClass} rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-6 border-b ${borderClass}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-lg font-bold ${textClass}`}>{selectedTenant.businessName}</h3>
                  <p className={`text-sm ${mutedClass}`}>{selectedTenant.email}</p>
                </div>
                <button
                  onClick={() => setSelectedTenant(null)}
                  className={`p-2 ${mutedClass} hover:${textClass} rounded-lg`}
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass}`}>Industry</p>
                  <p className={`text-sm font-bold ${textClass}`}>{selectedTenant.industryType || 'General'}</p>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass}`}>Status</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                    selectedTenant.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {selectedTenant.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass}`}>Subscription Started</p>
                  <p className={`text-sm ${textClass}`}>{formatDate(selectedTenant.subscriptionStart)}</p>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass}`}>Subscription Ends</p>
                  <p className={`text-sm ${textClass}`}>{formatDate(selectedTenant.subscriptionEnd)}</p>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass}`}>Total Users</p>
                  <p className={`text-sm font-bold ${textClass}`}>{selectedTenant._count?.users || 0}</p>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass}`}>Branches</p>
                  <p className={`text-sm font-bold ${textClass}`}>{selectedTenant._count?.branches || 1}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => {
                    setSelectedTenant(null);
                    setExtendModal(selectedTenant);
                    setAdjustmentType('extend');
                    setExtensionMonths(3);
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 flex items-center justify-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Adjust Subscription
                </button>
                <button className={`px-4 py-2 ${surfaceClass} border ${borderClass} rounded-xl text-sm font-bold ${textClass} flex items-center gap-2`}>
                  <Mail className="w-4 h-4" />
                  Contact
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscriptions;
