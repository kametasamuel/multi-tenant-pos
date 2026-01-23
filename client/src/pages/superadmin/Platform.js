import React, { useState, useEffect, useCallback } from 'react';
import { platformAPI, superAdminAPI } from '../../api';
import {
  Settings,
  Layers,
  CreditCard,
  Shield,
  Clock,
  DollarSign,
  Users,
  Building2,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Save,
  Eye,
  EyeOff,
  UserCheck,
  Globe,
  Zap,
  Lock,
  Unlock,
  TrendingDown,
  TrendingUp,
  Calendar,
  Package,
  GitBranch,
  BarChart3,
  Heart,
  Percent,
  Database,
  PlayCircle,
  Copy,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Download,
  X
} from 'lucide-react';

const Platform = ({
  darkMode = false,
  surfaceClass = 'bg-white',
  textClass = 'text-slate-900',
  mutedClass = 'text-slate-500',
  borderClass = 'border-slate-200'
}) => {
  const [activeTab, setActiveTab] = useState('features');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Subscription Tiers
  const [tiers, setTiers] = useState([]);
  const [features, setFeatures] = useState([]);
  const [selectedTier, setSelectedTier] = useState(null);
  const [showTierModal, setShowTierModal] = useState(false);
  const [tierForm, setTierForm] = useState({
    name: '', description: '', monthlyPrice: 0, annualPrice: 0,
    maxUsers: 5, maxBranches: 1, maxProducts: 100, sortOrder: 0
  });

  // Grace Period
  const [gracePeriodTenants, setGracePeriodTenants] = useState([]);
  const [selectedGraceTenant, setSelectedGraceTenant] = useState(null);
  const [graceDays, setGraceDays] = useState(7);

  // Tax Config
  const [taxConfigs, setTaxConfigs] = useState([]);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [taxForm, setTaxForm] = useState({ country: 'GH', name: '', rate: 0, isCompound: false });
  const [pushTaxCountry, setPushTaxCountry] = useState('GH');
  const [pushTaxRate, setPushTaxRate] = useState(0);

  // Impersonation
  const [impersonationLogs, setImpersonationLogs] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [impersonateTenantId, setImpersonateTenantId] = useState('');
  const [impersonateReason, setImpersonateReason] = useState('');
  const [activeImpersonation, setActiveImpersonation] = useState(null);

  // Tenant Health
  const [tenantHealth, setTenantHealth] = useState([]);
  const [healthSummary, setHealthSummary] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tiersRes, featuresRes, tenantsRes] = await Promise.allSettled([
        platformAPI.getTiers(),
        platformAPI.getFeatures(),
        superAdminAPI.getTenants({ limit: 100 })
      ]);

      if (tiersRes.status === 'fulfilled') setTiers(tiersRes.value.data.tiers || []);
      if (featuresRes.status === 'fulfilled') setFeatures(featuresRes.value.data.features || []);
      if (tenantsRes.status === 'fulfilled') setTenants(tenantsRes.value.data.tenants || []);

    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Fetch tab-specific data
    const fetchTabData = async () => {
      try {
        if (activeTab === 'grace') {
          const res = await platformAPI.getGracePeriodTenants();
          setGracePeriodTenants(res.data.tenants || []);
        } else if (activeTab === 'tax') {
          const res = await platformAPI.getTaxConfigs();
          setTaxConfigs(res.data.taxConfigs || []);
        } else if (activeTab === 'impersonation') {
          const res = await platformAPI.getImpersonationLogs();
          setImpersonationLogs(res.data.logs || []);
        } else if (activeTab === 'health') {
          const res = await platformAPI.getTenantHealth();
          setTenantHealth(res.data.tenants || []);
          setHealthSummary(res.data.summary || null);
        }
      } catch (err) {
        console.error('Tab data fetch error:', err);
      }
    };
    fetchTabData();
  }, [activeTab]);

  const showMessage = (msg, isError = false) => {
    if (isError) {
      setError(msg);
      setTimeout(() => setError(''), 5000);
    } else {
      setSuccess(msg);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  // Seed defaults
  const handleSeedDefaults = async () => {
    setActionLoading(true);
    try {
      const res = await platformAPI.seedDefaults();
      showMessage(res.data.message);
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to seed defaults', true);
    } finally {
      setActionLoading(false);
    }
  };

  // Tier CRUD
  const handleSaveTier = async () => {
    setActionLoading(true);
    try {
      if (selectedTier) {
        await platformAPI.updateTier(selectedTier.id, tierForm);
        showMessage('Tier updated successfully');
      } else {
        await platformAPI.createTier(tierForm);
        showMessage('Tier created successfully');
      }
      setShowTierModal(false);
      setSelectedTier(null);
      setTierForm({ name: '', description: '', monthlyPrice: 0, annualPrice: 0, maxUsers: 5, maxBranches: 1, maxProducts: 100, sortOrder: 0 });
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to save tier', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTier = async (id) => {
    if (!window.confirm('Are you sure you want to delete this tier?')) return;
    setActionLoading(true);
    try {
      await platformAPI.deleteTier(id);
      showMessage('Tier deleted');
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to delete tier', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTierFeatures = async (tierId, featureIds) => {
    setActionLoading(true);
    try {
      await platformAPI.updateTierFeatures(tierId, featureIds);
      showMessage('Tier features updated');
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to update features', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignTier = async (tenantId, tierId) => {
    setActionLoading(true);
    try {
      await platformAPI.assignTierToTenant(tenantId, tierId);
      showMessage('Tier assigned to tenant');
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to assign tier', true);
    } finally {
      setActionLoading(false);
    }
  };

  // Grace period
  const handleSetGracePeriod = async () => {
    if (!selectedGraceTenant) return;
    setActionLoading(true);
    try {
      await platformAPI.setGracePeriod(selectedGraceTenant.id, graceDays);
      showMessage(`Grace period of ${graceDays} days set`);
      setSelectedGraceTenant(null);
      const res = await platformAPI.getGracePeriodTenants();
      setGracePeriodTenants(res.data.tenants || []);
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to set grace period', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnforceLockout = async () => {
    if (!window.confirm('This will deactivate all expired tenants. Continue?')) return;
    setActionLoading(true);
    try {
      const res = await platformAPI.enforceLockout();
      showMessage(res.data.message);
      const tenantsRes = await platformAPI.getGracePeriodTenants();
      setGracePeriodTenants(tenantsRes.data.tenants || []);
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to enforce lockout', true);
    } finally {
      setActionLoading(false);
    }
  };

  // Tax config
  const handleSaveTaxConfig = async () => {
    setActionLoading(true);
    try {
      await platformAPI.createTaxConfig(taxForm);
      showMessage('Tax configuration created');
      setShowTaxModal(false);
      setTaxForm({ country: 'GH', name: '', rate: 0, isCompound: false });
      const res = await platformAPI.getTaxConfigs();
      setTaxConfigs(res.data.taxConfigs || []);
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to save tax config', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePushTaxRates = async () => {
    if (!window.confirm(`Push ${pushTaxRate}% tax rate to all tenants in ${pushTaxCountry}?`)) return;
    setActionLoading(true);
    try {
      const res = await platformAPI.pushTaxRates(pushTaxCountry, pushTaxRate);
      showMessage(res.data.message);
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to push tax rates', true);
    } finally {
      setActionLoading(false);
    }
  };

  // Check for active impersonation on mount
  useEffect(() => {
    const storedImpersonation = localStorage.getItem('activeImpersonation');
    if (storedImpersonation) {
      try {
        setActiveImpersonation(JSON.parse(storedImpersonation));
      } catch (e) {
        localStorage.removeItem('activeImpersonation');
      }
    }
  }, []);

  // Impersonation
  const handleStartImpersonation = async () => {
    if (!impersonateTenantId || !impersonateReason) {
      showMessage('Select a tenant and provide a reason', true);
      return;
    }
    setActionLoading(true);
    try {
      const res = await platformAPI.startImpersonation(impersonateTenantId, impersonateReason);

      // Store impersonation data
      const impersonationData = {
        token: res.data.impersonationToken,
        logId: res.data.logId,
        tenant: res.data.tenant,
        startedAt: new Date().toISOString()
      };

      localStorage.setItem('activeImpersonation', JSON.stringify(impersonationData));
      localStorage.setItem('impersonationToken', res.data.impersonationToken);
      localStorage.setItem('impersonationLogId', res.data.logId);
      localStorage.setItem('originalToken', localStorage.getItem('token'));

      setActiveImpersonation(impersonationData);
      setImpersonateTenantId('');
      setImpersonateReason('');

      showMessage(`Impersonation session started for ${res.data.tenant.businessName}`);
      fetchData(); // Refresh logs
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to start impersonation', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenTenantDashboard = () => {
    if (!activeImpersonation) return;

    // Store impersonation token as the active token for the new tab
    const impersonationUrl = `/${activeImpersonation.tenant.slug}/owner/dashboard?impersonate=${activeImpersonation.token}`;
    window.open(impersonationUrl, '_blank');
  };

  const handleEndImpersonation = async () => {
    if (!activeImpersonation) return;

    setActionLoading(true);
    try {
      await platformAPI.endImpersonation(activeImpersonation.logId);

      // Clear impersonation data
      localStorage.removeItem('activeImpersonation');
      localStorage.removeItem('impersonationToken');
      localStorage.removeItem('impersonationLogId');

      setActiveImpersonation(null);
      showMessage('Impersonation session ended');
      fetchData(); // Refresh logs
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to end impersonation', true);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD'
    }).format(amount || 0);
  };

  const getDaysUntil = (date) => {
    return Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
  };

  const tabs = [
    { id: 'features', label: 'Feature Flags', icon: Zap },
    { id: 'grace', label: 'Grace Period', icon: Clock },
    { id: 'impersonation', label: 'Impersonation', icon: UserCheck },
    { id: 'health', label: 'Tenant Health', icon: Heart }
  ];

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
          <h1 className={`text-2xl font-black ${textClass}`}>Platform Infrastructure</h1>
          <p className={`text-sm ${mutedClass}`}>Manage features, grace periods, and tenant access</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSeedDefaults}
            disabled={actionLoading}
            className={`px-4 py-2 ${surfaceClass} border ${borderClass} rounded-xl text-sm font-bold ${textClass} hover:bg-slate-50 flex items-center gap-2`}
          >
            <Database className="w-4 h-4" />
            Seed Defaults
          </button>
          <button
            onClick={fetchData}
            className={`px-4 py-2 ${surfaceClass} border ${borderClass} rounded-xl text-sm font-bold ${textClass} hover:bg-slate-50 flex items-center gap-2`}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 rounded-xl text-emerald-700 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
        <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-bold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                  : `${mutedClass} hover:text-indigo-500`
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Feature Flags Tab */}
          {activeTab === 'features' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-bold ${textClass}`}>Platform Features</h3>
                <p className={`text-sm ${mutedClass}`}>{features.length} features defined</p>
              </div>

              {features.length === 0 ? (
                <div className="text-center py-12">
                  <Zap className={`w-12 h-12 mx-auto mb-4 ${mutedClass}`} />
                  <p className={`text-sm ${mutedClass}`}>No features defined yet</p>
                  <button onClick={handleSeedDefaults} className="mt-4 text-sm text-indigo-600 font-bold">
                    Seed Default Features
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Group by category */}
                  {Object.entries(
                    features.reduce((acc, f) => {
                      const cat = f.category || 'general';
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(f);
                      return acc;
                    }, {})
                  ).map(([category, categoryFeatures]) => (
                    <div key={category} className={`${surfaceClass} border ${borderClass} rounded-xl overflow-hidden`}>
                      <div className={`px-4 py-3 ${darkMode ? 'bg-slate-700' : 'bg-slate-50'} border-b ${borderClass}`}>
                        <h4 className={`text-sm font-bold uppercase ${textClass}`}>{category}</h4>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {categoryFeatures.map(feature => (
                          <div key={feature.id} className="flex items-center justify-between px-4 py-3">
                            <div>
                              <p className={`text-sm font-bold ${textClass}`}>{feature.name}</p>
                              <p className={`text-xs ${mutedClass}`}>{feature.description}</p>
                              <code className={`text-[10px] ${mutedClass}`}>{feature.code}</code>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              feature.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {feature.isActive ? 'Active' : 'Disabled'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Grace Period Tab */}
          {activeTab === 'grace' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-bold ${textClass}`}>Grace Period Management</h3>
                <button
                  onClick={handleEnforceLockout}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Enforce Lockout
                </button>
              </div>

              <div className={`p-4 rounded-xl ${darkMode ? 'bg-amber-900/20' : 'bg-amber-50'} border border-amber-200`}>
                <p className="text-sm text-amber-700">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  {gracePeriodTenants.length} tenant(s) have expired or are in grace period
                </p>
              </div>

              {gracePeriodTenants.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className={`w-12 h-12 mx-auto mb-4 text-emerald-500`} />
                  <p className={`text-sm ${textClass} font-bold`}>All subscriptions are active</p>
                  <p className={`text-xs ${mutedClass}`}>No tenants require grace period attention</p>
                </div>
              ) : (
                <div className={`${surfaceClass} border ${borderClass} rounded-xl overflow-hidden`}>
                  <table className="w-full">
                    <thead className={darkMode ? 'bg-slate-700' : 'bg-slate-50'}>
                      <tr>
                        <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Tenant</th>
                        <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Subscription End</th>
                        <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Grace End</th>
                        <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Status</th>
                        <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {gracePeriodTenants.map(tenant => (
                        <tr key={tenant.id}>
                          <td className="px-4 py-3">
                            <p className={`text-sm font-bold ${textClass}`}>{tenant.businessName}</p>
                            <p className={`text-xs ${mutedClass}`}>{tenant.slug || 'No slug'}</p>
                          </td>
                          <td className={`px-4 py-3 text-sm ${mutedClass}`}>{formatDate(tenant.subscriptionEnd)}</td>
                          <td className={`px-4 py-3 text-sm ${mutedClass}`}>{formatDate(tenant.gracePeriodEnd)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              tenant.isInGracePeriod ? 'bg-amber-100 text-amber-700' :
                              getDaysUntil(tenant.subscriptionEnd) < 0 ? 'bg-red-100 text-red-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {tenant.isInGracePeriod ? 'Grace Period' :
                               getDaysUntil(tenant.subscriptionEnd) < 0 ? 'Expired' : 'Active'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setSelectedGraceTenant(tenant)}
                              className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                            >
                              Set Grace
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Grace Period Modal */}
              {selectedGraceTenant && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className={`${surfaceClass} rounded-2xl max-w-md w-full p-6`}>
                    <h3 className={`text-lg font-bold ${textClass} mb-4`}>Set Grace Period</h3>
                    <p className={`text-sm ${mutedClass} mb-4`}>{selectedGraceTenant.businessName}</p>
                    <div className="mb-4">
                      <label className={`text-xs font-bold uppercase ${mutedClass} block mb-2`}>Grace Days</label>
                      <input
                        type="number"
                        value={graceDays}
                        onChange={(e) => setGraceDays(parseInt(e.target.value))}
                        min={1}
                        max={30}
                        className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedGraceTenant(null)}
                        className={`flex-1 px-4 py-2 border ${borderClass} rounded-xl text-sm font-bold ${textClass}`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSetGracePeriod}
                        disabled={actionLoading}
                        className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold"
                      >
                        Set Grace Period
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Impersonation Tab */}
          {activeTab === 'impersonation' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-bold ${textClass}`}>Admin Impersonation</h3>
              </div>

              {/* Active Impersonation Session */}
              {activeImpersonation && (
                <div className={`p-5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <Activity className="w-5 h-5 animate-pulse" />
                      <h4 className="text-sm font-bold">Active Impersonation Session</h4>
                    </div>
                    <span className="px-2 py-1 bg-emerald-200 text-emerald-800 text-xs font-bold rounded-full animate-pulse">
                      ACTIVE
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className={`text-xs font-bold uppercase ${mutedClass}`}>Tenant</p>
                      <p className={`text-sm font-bold ${textClass}`}>{activeImpersonation.tenant.businessName}</p>
                      <p className={`text-xs ${mutedClass}`}>/{activeImpersonation.tenant.slug}</p>
                    </div>
                    <div>
                      <p className={`text-xs font-bold uppercase ${mutedClass}`}>Started</p>
                      <p className={`text-sm ${textClass}`}>
                        {new Date(activeImpersonation.startedAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs font-bold uppercase ${mutedClass}`}>Session ID</p>
                      <p className={`text-xs ${mutedClass} font-mono`}>{activeImpersonation.logId.slice(0, 12)}...</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleOpenTenantDashboard}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Open Tenant Dashboard
                    </button>
                    <button
                      onClick={handleEndImpersonation}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      End Session
                    </button>
                  </div>
                  <p className="text-xs text-emerald-600 mt-3">
                    Click "Open Tenant Dashboard" to view the tenant's system as their owner. All actions are being logged.
                  </p>
                </div>
              )}

              {/* Start Impersonation - only show when no active session */}
              {!activeImpersonation && (
                <div className={`p-5 rounded-xl ${darkMode ? 'bg-amber-900/20' : 'bg-amber-50'} border border-amber-200`}>
                  <div className="flex items-center gap-2 text-amber-700 mb-4">
                    <Shield className="w-5 h-5" />
                    <h4 className="text-sm font-bold">Start Support Session</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={`text-xs font-bold uppercase ${mutedClass} block mb-1`}>Select Tenant</label>
                      <select
                        value={impersonateTenantId}
                        onChange={(e) => setImpersonateTenantId(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                      >
                        <option value="">Select a tenant...</option>
                        {tenants.map(tenant => (
                          <option key={tenant.id} value={tenant.id}>
                            {tenant.businessName} ({tenant.slug || 'no slug'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={`text-xs font-bold uppercase ${mutedClass} block mb-1`}>Reason</label>
                      <input
                        type="text"
                        value={impersonateReason}
                        onChange={(e) => setImpersonateReason(e.target.value)}
                        placeholder="Support ticket #123"
                        className={`w-full px-3 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={handleStartImpersonation}
                        disabled={actionLoading || !impersonateTenantId || !impersonateReason}
                        className="w-full px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <PlayCircle className="w-4 h-4" />
                        Start Session
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-amber-600 mt-3">
                    All actions during impersonation are logged for audit purposes.
                  </p>
                </div>
              )}

              {/* Impersonation Logs */}
              <div>
                <h4 className={`text-sm font-bold ${textClass} mb-3`}>Recent Impersonation Sessions</h4>
                {impersonationLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <UserCheck className={`w-12 h-12 mx-auto mb-3 ${mutedClass}`} />
                    <p className={`text-sm ${mutedClass}`}>No impersonation sessions recorded</p>
                  </div>
                ) : (
                  <div className={`${surfaceClass} border ${borderClass} rounded-xl overflow-hidden`}>
                    <table className="w-full">
                      <thead className={darkMode ? 'bg-slate-700' : 'bg-slate-50'}>
                        <tr>
                          <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Started</th>
                          <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Tenant</th>
                          <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Reason</th>
                          <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Duration</th>
                          <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {impersonationLogs.map(log => (
                          <tr key={log.id}>
                            <td className={`px-4 py-3 text-sm ${mutedClass}`}>{formatDate(log.startedAt)}</td>
                            <td className={`px-4 py-3 text-sm ${textClass}`}>{log.tenantId.slice(0, 8)}...</td>
                            <td className={`px-4 py-3 text-sm ${textClass}`}>{log.reason}</td>
                            <td className={`px-4 py-3 text-sm ${mutedClass}`}>
                              {log.endedAt
                                ? `${Math.round((new Date(log.endedAt) - new Date(log.startedAt)) / 60000)} min`
                                : 'Active'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                log.endedAt ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {log.endedAt ? 'Ended' : 'Active'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tenant Health Tab */}
          {activeTab === 'health' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-bold ${textClass}`}>Tenant Health & Churn Risk</h3>
              </div>

              {/* Summary Cards */}
              {healthSummary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                    <p className={`text-xs font-bold uppercase ${mutedClass}`}>Total Tenants</p>
                    <p className={`text-2xl font-black ${textClass}`}>{healthSummary.totalTenants}</p>
                  </div>
                  <div className={`p-4 rounded-xl bg-red-50 dark:bg-red-900/20`}>
                    <p className="text-xs font-bold uppercase text-red-600">Critical Risk</p>
                    <p className="text-2xl font-black text-red-600">{healthSummary.criticalRisk}</p>
                  </div>
                  <div className={`p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20`}>
                    <p className="text-xs font-bold uppercase text-orange-600">High Risk</p>
                    <p className="text-2xl font-black text-orange-600">{healthSummary.highRisk}</p>
                  </div>
                  <div className={`p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20`}>
                    <p className="text-xs font-bold uppercase text-amber-600">Medium Risk</p>
                    <p className="text-2xl font-black text-amber-600">{healthSummary.mediumRisk}</p>
                  </div>
                  <div className={`p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20`}>
                    <p className="text-xs font-bold uppercase text-emerald-600">Healthy</p>
                    <p className="text-2xl font-black text-emerald-600">{healthSummary.lowRisk}</p>
                  </div>
                </div>
              )}

              {/* Tenant Health Table */}
              {tenantHealth.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className={`w-12 h-12 mx-auto mb-4 ${mutedClass}`} />
                  <p className={`text-sm ${mutedClass}`}>No tenant health data available</p>
                </div>
              ) : (
                <div className={`${surfaceClass} border ${borderClass} rounded-xl overflow-hidden`}>
                  <table className="w-full">
                    <thead className={darkMode ? 'bg-slate-700' : 'bg-slate-50'}>
                      <tr>
                        <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Tenant</th>
                        <th className={`px-4 py-3 text-center text-xs font-bold uppercase ${mutedClass}`}>Health</th>
                        <th className={`px-4 py-3 text-center text-xs font-bold uppercase ${mutedClass}`}>Risk</th>
                        <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${mutedClass}`}>30d Trans.</th>
                        <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${mutedClass}`}>Change</th>
                        <th className={`px-4 py-3 text-center text-xs font-bold uppercase ${mutedClass}`}>Last Active</th>
                        <th className={`px-4 py-3 text-center text-xs font-bold uppercase ${mutedClass}`}>Sub. End</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {tenantHealth.map(tenant => (
                        <tr key={tenant.id} className={tenant.riskLevel === 'critical' ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                          <td className="px-4 py-3">
                            <p className={`text-sm font-bold ${textClass}`}>{tenant.businessName}</p>
                            <p className={`text-xs ${mutedClass}`}>{tenant.tier} • {tenant.userCount} users</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    tenant.healthScore >= 75 ? 'bg-emerald-500' :
                                    tenant.healthScore >= 60 ? 'bg-amber-500' :
                                    tenant.healthScore >= 40 ? 'bg-orange-500' :
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${tenant.healthScore}%` }}
                                />
                              </div>
                              <span className={`text-xs font-bold ${textClass}`}>{tenant.healthScore}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              tenant.riskLevel === 'critical' ? 'bg-red-100 text-red-700' :
                              tenant.riskLevel === 'high' ? 'bg-orange-100 text-orange-700' :
                              tenant.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {tenant.riskLevel.toUpperCase()}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-right text-sm font-bold ${textClass}`}>
                            {tenant.recentTransactions}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-sm font-bold flex items-center justify-end gap-1 ${
                              tenant.changePercent > 0 ? 'text-emerald-600' :
                              tenant.changePercent < 0 ? 'text-red-600' :
                              mutedClass
                            }`}>
                              {tenant.changePercent > 0 ? <TrendingUp className="w-3 h-3" /> :
                               tenant.changePercent < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                              {tenant.changePercent > 0 ? '+' : ''}{tenant.changePercent}%
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-center text-sm ${
                            tenant.daysSinceActivity > 14 ? 'text-red-600 font-bold' :
                            tenant.daysSinceActivity > 7 ? 'text-amber-600' :
                            mutedClass
                          }`}>
                            {tenant.daysSinceActivity === 999 ? 'Never' :
                             tenant.daysSinceActivity === 0 ? 'Today' :
                             `${tenant.daysSinceActivity}d ago`}
                          </td>
                          <td className={`px-4 py-3 text-center text-sm ${
                            tenant.daysUntilExpiry < 7 ? 'text-red-600 font-bold' :
                            tenant.daysUntilExpiry < 30 ? 'text-amber-600' :
                            mutedClass
                          }`}>
                            {tenant.daysUntilExpiry < 0 ? 'Expired' : `${tenant.daysUntilExpiry}d`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tier Modal */}
      {showTierModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${surfaceClass} rounded-2xl max-w-lg w-full p-6`}>
            <h3 className={`text-lg font-bold ${textClass} mb-4`}>
              {selectedTier ? 'Edit Tier' : 'Create Tier'}
            </h3>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className={`text-xs font-bold uppercase ${mutedClass} block mb-1`}>Name</label>
                <input
                  type="text"
                  value={tierForm.name}
                  onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                />
              </div>
              <div>
                <label className={`text-xs font-bold uppercase ${mutedClass} block mb-1`}>Description</label>
                <textarea
                  value={tierForm.description}
                  onChange={(e) => setTierForm({ ...tierForm, description: e.target.value })}
                  rows={2}
                  className={`w-full px-3 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-xs font-bold uppercase ${mutedClass} block mb-1`}>Monthly Price</label>
                  <input
                    type="number"
                    value={tierForm.monthlyPrice}
                    onChange={(e) => setTierForm({ ...tierForm, monthlyPrice: parseFloat(e.target.value) })}
                    step="0.01"
                    className={`w-full px-3 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                  />
                </div>
                <div>
                  <label className={`text-xs font-bold uppercase ${mutedClass} block mb-1`}>Annual Price</label>
                  <input
                    type="number"
                    value={tierForm.annualPrice}
                    onChange={(e) => setTierForm({ ...tierForm, annualPrice: parseFloat(e.target.value) })}
                    step="0.01"
                    className={`w-full px-3 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={`text-xs font-bold uppercase ${mutedClass} block mb-1`}>Max Users</label>
                  <input
                    type="number"
                    value={tierForm.maxUsers}
                    onChange={(e) => setTierForm({ ...tierForm, maxUsers: parseInt(e.target.value) })}
                    className={`w-full px-3 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                  />
                </div>
                <div>
                  <label className={`text-xs font-bold uppercase ${mutedClass} block mb-1`}>Max Branches</label>
                  <input
                    type="number"
                    value={tierForm.maxBranches}
                    onChange={(e) => setTierForm({ ...tierForm, maxBranches: parseInt(e.target.value) })}
                    className={`w-full px-3 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                  />
                </div>
                <div>
                  <label className={`text-xs font-bold uppercase ${mutedClass} block mb-1`}>Max Products</label>
                  <input
                    type="number"
                    value={tierForm.maxProducts}
                    onChange={(e) => setTierForm({ ...tierForm, maxProducts: parseInt(e.target.value) })}
                    className={`w-full px-3 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowTierModal(false);
                  setSelectedTier(null);
                }}
                className={`flex-1 px-4 py-2 border ${borderClass} rounded-xl text-sm font-bold ${textClass}`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTier}
                disabled={actionLoading || !tierForm.name}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Tier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Platform;
