import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { superAdminAPI } from '../../api';
import {
  LayoutDashboard,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  ArrowRight,
  Users,
  DollarSign,
  Activity,
  Eye,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Globe,
  Shield,
  XCircle,
  Timer,
  CreditCard,
  ExternalLink,
  Copy,
  Check,
  Calendar,
  Search
} from 'lucide-react';

const Dashboard = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, bgClass }) => {
  const [stats, setStats] = useState(null);
  const [recentApplications, setRecentApplications] = useState([]);
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAllData = useCallback(async () => {
    try {
      setRefreshing(true);
      setError('');

      // Fetch core data in parallel
      const [dashboardRes, tenantsRes, healthRes] = await Promise.allSettled([
        superAdminAPI.getDashboard(),
        superAdminAPI.getTenants({ limit: 10 }),
        superAdminAPI.getSubscriptionHealth()
      ]);

      if (dashboardRes.status === 'fulfilled') {
        setStats(dashboardRes.value.data.stats);
        setRecentApplications(dashboardRes.value.data.recentApplications || []);
        setExpiringSoon(dashboardRes.value.data.expiringSoon || []);
      }

      if (tenantsRes.status === 'fulfilled') {
        setTenants(tenantsRes.value.data.tenants || []);
      }

      if (healthRes.status === 'fulfilled' && healthRes.value.data.expiringTenants) {
        // Merge expiring tenants from health endpoint
        setExpiringSoon(prev => {
          const merged = [...prev, ...healthRes.value.data.expiringTenants];
          const unique = merged.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
          return unique.slice(0, 10);
        });
      }

      setLastUpdated(new Date());
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysUntil = (date) => {
    const days = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSlug(text);
      setTimeout(() => setCopiedSlug(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getFullUrl = (slug) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/${slug}/login`;
  };

  // Filter tenants by search
  const filteredTenants = tenants.filter(tenant =>
    tenant.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tenant.slug && tenant.slug.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className={`text-sm font-bold ${mutedClass}`}>Loading tenant management...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${textClass}`}>
            Tenant Management
          </h1>
          <p className={`text-sm ${mutedClass}`}>
            Manage applications, slugs, subscriptions, and tenant access
            {lastUpdated && (
              <span className="ml-2 text-xs">
                • Updated: {formatTime(lastUpdated)}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchAllData}
          disabled={refreshing}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase ${surfaceClass} border ${borderClass} ${textClass} hover:border-indigo-500 transition-colors`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Pending Applications - PRIORITY */}
        <Link
          to="/admin/applications?status=pending"
          className={`${surfaceClass} border ${stats?.pendingApplications > 0 ? 'border-amber-400 ring-2 ring-amber-100 dark:ring-amber-900/30' : borderClass} p-5 rounded-2xl hover:border-amber-500 transition-all group`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`w-12 h-12 ${stats?.pendingApplications > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : darkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-xl flex items-center justify-center`}>
              <Clock className={`w-6 h-6 ${stats?.pendingApplications > 0 ? 'text-amber-600' : mutedClass}`} />
            </div>
            <ChevronRight className={`w-5 h-5 ${mutedClass} group-hover:text-amber-500`} />
          </div>
          <p className={`text-3xl font-black ${stats?.pendingApplications > 0 ? 'text-amber-600' : textClass}`}>
            {stats?.pendingApplications || 0}
          </p>
          <p className={`text-xs font-bold uppercase ${mutedClass}`}>Pending Applications</p>
          {stats?.pendingApplications > 0 && (
            <p className="text-[10px] text-amber-600 font-bold mt-1">REQUIRES SLUG ASSIGNMENT</p>
          )}
        </Link>

        {/* Active Tenants */}
        <Link
          to="/admin/tenants?status=active"
          className={`${surfaceClass} border ${borderClass} p-5 rounded-2xl hover:border-indigo-500 transition-all group`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`w-12 h-12 ${darkMode ? 'bg-slate-700' : 'bg-indigo-50'} rounded-xl flex items-center justify-center`}>
              <Building2 className="w-6 h-6 text-indigo-600" />
            </div>
            <ChevronRight className={`w-5 h-5 ${mutedClass} group-hover:text-indigo-500`} />
          </div>
          <p className={`text-3xl font-black text-indigo-600`}>
            {stats?.activeTenants || 0}
          </p>
          <p className={`text-xs font-bold uppercase ${mutedClass}`}>Active Tenants</p>
        </Link>

        {/* Expiring Soon */}
        <Link
          to="/admin/subscriptions"
          className={`${surfaceClass} border ${expiringSoon.length > 0 ? 'border-orange-400 ring-2 ring-orange-100 dark:ring-orange-900/30' : borderClass} p-5 rounded-2xl hover:border-orange-500 transition-all group`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`w-12 h-12 ${expiringSoon.length > 0 ? 'bg-orange-100 dark:bg-orange-900/30' : darkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-xl flex items-center justify-center`}>
              <Timer className={`w-6 h-6 ${expiringSoon.length > 0 ? 'text-orange-600' : mutedClass}`} />
            </div>
            <ChevronRight className={`w-5 h-5 ${mutedClass} group-hover:text-orange-500`} />
          </div>
          <p className={`text-3xl font-black ${expiringSoon.length > 0 ? 'text-orange-600' : textClass}`}>
            {expiringSoon.length}
          </p>
          <p className={`text-xs font-bold uppercase ${mutedClass}`}>Expiring Soon</p>
          {expiringSoon.length > 0 && (
            <p className="text-[10px] text-orange-600 font-bold mt-1">NEEDS RENEWAL</p>
          )}
        </Link>

        {/* Inactive */}
        <Link
          to="/admin/tenants?status=inactive"
          className={`${surfaceClass} border ${borderClass} p-5 rounded-2xl hover:border-slate-500 transition-all group`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`w-12 h-12 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-xl flex items-center justify-center`}>
              <XCircle className={`w-6 h-6 ${mutedClass}`} />
            </div>
            <ChevronRight className={`w-5 h-5 ${mutedClass} group-hover:text-slate-500`} />
          </div>
          <p className={`text-3xl font-black ${textClass}`}>
            {stats?.inactiveTenants || 0}
          </p>
          <p className={`text-xs font-bold uppercase ${mutedClass}`}>Inactive Tenants</p>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Applications - Requires Slug Assignment */}
        <div className={`${surfaceClass} border ${borderClass} rounded-2xl overflow-hidden`}>
          <div className="flex items-center justify-between p-5 border-b border-dashed dark:border-slate-600">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              <h2 className={`text-sm font-black uppercase ${textClass}`}>Pending Applications</h2>
              {stats?.pendingApplications > 0 && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                  {stats.pendingApplications} WAITING
                </span>
              )}
            </div>
            <Link to="/admin/applications" className="text-xs font-bold text-indigo-500 hover:underline">
              View All
            </Link>
          </div>
          <div className="divide-y divide-dashed dark:divide-slate-600">
            {recentApplications.filter(app => app.status === 'PENDING').length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className={`w-12 h-12 mx-auto mb-3 text-emerald-500`} />
                <p className={`text-sm font-bold ${textClass}`}>All caught up!</p>
                <p className={`text-xs ${mutedClass}`}>No pending applications</p>
              </div>
            ) : (
              recentApplications.filter(app => app.status === 'PENDING').slice(0, 5).map((app) => (
                <Link
                  key={app.id}
                  to={`/admin/applications?id=${app.id}`}
                  className={`flex items-center justify-between p-4 hover:${darkMode ? 'bg-slate-700/50' : 'bg-amber-50'} transition-colors`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${textClass}`}>{app.businessName}</p>
                      <p className={`text-[10px] ${mutedClass}`}>{app.businessEmail}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase">
                      Assign Slug
                    </span>
                    <p className={`text-[10px] ${mutedClass} mt-1`}>{formatDate(app.createdAt)}</p>
                  </div>
                </Link>
              ))
            )}
            {stats?.pendingApplications > 5 && (
              <Link
                to="/admin/applications?status=pending"
                className={`block p-4 text-center text-xs font-bold text-amber-600 hover:${darkMode ? 'bg-slate-700' : 'bg-amber-50'} transition-colors`}
              >
                View {stats.pendingApplications - 5} More Pending →
              </Link>
            )}
          </div>
        </div>

        {/* Expiring Subscriptions */}
        <div className={`${surfaceClass} border ${borderClass} rounded-2xl overflow-hidden`}>
          <div className="flex items-center justify-between p-5 border-b border-dashed dark:border-slate-600">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-orange-500" />
              <h2 className={`text-sm font-black uppercase ${textClass}`}>Expiring Subscriptions</h2>
            </div>
            <Link to="/admin/subscriptions" className="text-xs font-bold text-indigo-500 hover:underline">
              Manage
            </Link>
          </div>
          <div className="divide-y divide-dashed dark:divide-slate-600">
            {expiringSoon.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className={`w-12 h-12 mx-auto mb-3 text-emerald-500`} />
                <p className={`text-sm font-bold ${textClass}`}>All subscriptions healthy</p>
                <p className={`text-xs ${mutedClass}`}>No renewals needed soon</p>
              </div>
            ) : (
              expiringSoon.slice(0, 5).map((tenant) => {
                const daysLeft = getDaysUntil(tenant.subscriptionEnd);
                return (
                  <Link
                    key={tenant.id}
                    to={`/admin/tenants/${tenant.id}`}
                    className={`flex items-center justify-between p-4 hover:${darkMode ? 'bg-slate-700/50' : 'bg-orange-50'} transition-colors`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${daysLeft <= 0 ? 'bg-red-100 dark:bg-red-900/30' : daysLeft <= 3 ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-amber-100 dark:bg-amber-900/30'} rounded-xl flex items-center justify-center`}>
                        <Timer className={`w-5 h-5 ${daysLeft <= 0 ? 'text-red-600' : daysLeft <= 3 ? 'text-orange-600' : 'text-amber-600'}`} />
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${textClass}`}>{tenant.businessName}</p>
                        <p className={`text-[10px] ${mutedClass}`}>Expires: {formatDate(tenant.subscriptionEnd)}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      daysLeft <= 0 ? 'bg-red-100 text-red-700' :
                      daysLeft <= 3 ? 'bg-orange-100 text-orange-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {daysLeft <= 0 ? 'EXPIRED' : `${daysLeft} DAY${daysLeft !== 1 ? 'S' : ''}`}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Active Tenants with Slugs */}
      <div className={`${surfaceClass} border ${borderClass} rounded-2xl overflow-hidden`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 border-b border-dashed dark:border-slate-600 gap-3">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-500" />
            <h2 className={`text-sm font-black uppercase ${textClass}`}>Tenant URLs & Access</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${mutedClass}`} />
              <input
                type="text"
                placeholder="Search tenants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-9 pr-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-xs focus:outline-none focus:border-indigo-500`}
              />
            </div>
            <Link to="/admin/tenants" className="text-xs font-bold text-indigo-500 hover:underline whitespace-nowrap">
              View All
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={darkMode ? 'bg-slate-700' : 'bg-slate-50'}>
              <tr>
                <th className={`px-4 py-3 text-left text-[10px] font-black uppercase ${mutedClass}`}>Business</th>
                <th className={`px-4 py-3 text-left text-[10px] font-black uppercase ${mutedClass}`}>URL Slug</th>
                <th className={`px-4 py-3 text-left text-[10px] font-black uppercase ${mutedClass}`}>Login URL</th>
                <th className={`px-4 py-3 text-center text-[10px] font-black uppercase ${mutedClass}`}>Status</th>
                <th className={`px-4 py-3 text-center text-[10px] font-black uppercase ${mutedClass}`}>Subscription</th>
                <th className={`px-4 py-3 text-center text-[10px] font-black uppercase ${mutedClass}`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <Building2 className={`w-10 h-10 mx-auto mb-3 ${mutedClass}`} />
                    <p className={`text-sm ${mutedClass}`}>
                      {searchQuery ? 'No tenants match your search' : 'No tenants yet'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => {
                  const daysLeft = getDaysUntil(tenant.subscriptionEnd);
                  return (
                    <tr key={tenant.id} className={`hover:${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'} transition-colors`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {tenant.businessLogo ? (
                            <img src={tenant.businessLogo} alt="" className="w-8 h-8 rounded-lg object-cover" />
                          ) : (
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`}>
                              <Building2 className={`w-4 h-4 ${mutedClass}`} />
                            </div>
                          )}
                          <div>
                            <p className={`text-sm font-bold ${textClass}`}>{tenant.businessName}</p>
                            <p className={`text-[10px] ${mutedClass}`}>
                              {tenant._count?.users || 0} users • {tenant._count?.products || 0} products
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {tenant.slug ? (
                          <code className={`px-2 py-1 rounded text-xs font-bold ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} ${textClass}`}>
                            /{tenant.slug}
                          </code>
                        ) : (
                          <span className="text-xs text-red-500 font-bold">NO SLUG</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {tenant.slug ? (
                          <div className="flex items-center gap-2">
                            <code className={`text-[10px] ${mutedClass} max-w-[200px] truncate`}>
                              {getFullUrl(tenant.slug)}
                            </code>
                            <button
                              onClick={() => copyToClipboard(getFullUrl(tenant.slug))}
                              className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors`}
                              title="Copy URL"
                            >
                              {copiedSlug === getFullUrl(tenant.slug) ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className={`w-3.5 h-3.5 ${mutedClass}`} />
                              )}
                            </button>
                            <a
                              href={getFullUrl(tenant.slug)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors`}
                              title="Open in new tab"
                            >
                              <ExternalLink className={`w-3.5 h-3.5 ${mutedClass}`} />
                            </a>
                          </div>
                        ) : (
                          <span className={`text-xs ${mutedClass}`}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tenant.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {tenant.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          daysLeft <= 0 ? 'bg-red-100 text-red-700' :
                          daysLeft <= 7 ? 'bg-orange-100 text-orange-700' :
                          daysLeft <= 30 ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {daysLeft <= 0 ? 'EXPIRED' : `${daysLeft}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          to={`/admin/tenants?id=${tenant.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          Manage
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {tenants.length > 10 && (
          <div className="p-4 border-t border-dashed dark:border-slate-600">
            <Link
              to="/admin/tenants"
              className={`flex items-center justify-center gap-2 w-full py-2 px-4 rounded-xl text-xs font-bold text-indigo-600 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors`}
            >
              View All Tenants
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-5`}>
        <p className={`text-[10px] font-black uppercase ${mutedClass} mb-4`}>Quick Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/admin/applications?status=pending"
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${borderClass} hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all group`}
          >
            <FileText className={`w-6 h-6 ${mutedClass} group-hover:text-amber-500`} />
            <span className={`text-xs font-bold ${textClass} text-center`}>Review Applications</span>
            <span className="text-[10px] text-amber-600 font-bold">Assign Slugs</span>
          </Link>
          <Link
            to="/admin/subscriptions"
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${borderClass} hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group`}
          >
            <CreditCard className={`w-6 h-6 ${mutedClass} group-hover:text-indigo-500`} />
            <span className={`text-xs font-bold ${textClass} text-center`}>Subscriptions</span>
            <span className={`text-[10px] ${mutedClass}`}>Extend / Renew</span>
          </Link>
          <Link
            to="/admin/tenants"
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${borderClass} hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group`}
          >
            <Building2 className={`w-6 h-6 ${mutedClass} group-hover:text-indigo-500`} />
            <span className={`text-xs font-bold ${textClass} text-center`}>All Tenants</span>
            <span className={`text-[10px] ${mutedClass}`}>Manage Access</span>
          </Link>
          <Link
            to="/admin/analytics"
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${borderClass} hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group`}
          >
            <Activity className={`w-6 h-6 ${mutedClass} group-hover:text-indigo-500`} />
            <span className={`text-xs font-bold ${textClass} text-center`}>Analytics</span>
            <span className={`text-[10px] ${mutedClass}`}>Platform Data</span>
          </Link>
        </div>
      </div>

      {/* System Status */}
      <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-5`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-500" />
            <h2 className={`text-xs font-black uppercase ${textClass}`}>System Status</h2>
          </div>
          <span className="flex items-center gap-1 text-emerald-500 text-xs font-bold">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Operational
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
            <p className={`text-lg font-black ${textClass}`}>{stats?.totalApplications || 0}</p>
            <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Total Applications</p>
          </div>
          <div className={`p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
            <p className={`text-lg font-black ${textClass}`}>{(stats?.activeTenants || 0) + (stats?.inactiveTenants || 0)}</p>
            <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Total Tenants</p>
          </div>
          <div className={`p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
            <p className={`text-lg font-black text-emerald-600`}>{stats?.activeTenants || 0}</p>
            <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Active</p>
          </div>
          <div className={`p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
            <p className={`text-lg font-black ${stats?.inactiveTenants > 0 ? 'text-red-600' : textClass}`}>{stats?.inactiveTenants || 0}</p>
            <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Inactive</p>
          </div>
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-4 right-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 rounded-xl shadow-lg z-50">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm font-bold text-red-700">{error}</p>
            <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
