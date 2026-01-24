import React, { useState, useEffect } from 'react';
import { superAdminAPI } from '../../api';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Users,
  ShoppingCart,
  Package,
  Activity,
  PieChart,
  RefreshCw,
  Store,
  Utensils,
  Briefcase,
  Hotel,
  MoreHorizontal,
  BarChart3,
  Percent,
  Target,
  Award,
  Zap,
  GitBranch
} from 'lucide-react';

// Updated to use the 4 main business categories
const BUSINESS_TYPES = {
  RETAIL: {
    label: 'Retail',
    icon: Store,
    color: 'bg-blue-500',
    textColor: 'text-blue-600'
  },
  FOOD_AND_BEVERAGE: {
    label: 'Food & Beverage',
    icon: Utensils,
    color: 'bg-orange-500',
    textColor: 'text-orange-600'
  },
  HOSPITALITY: {
    label: 'Hospitality',
    icon: Hotel,
    color: 'bg-purple-500',
    textColor: 'text-purple-600'
  },
  SERVICES: {
    label: 'Services',
    icon: Briefcase,
    color: 'bg-emerald-500',
    textColor: 'text-emerald-600'
  }
};

// Backward compatible icon mapping
const businessTypeIcons = {
  RETAIL: Store,
  FOOD_AND_BEVERAGE: Utensils,
  HOSPITALITY: Hotel,
  SERVICES: Briefcase,
  // Legacy mappings
  RESTAURANT: Utensils,
  SALON: Briefcase,
  OTHER: MoreHorizontal
};

const Analytics = ({
  darkMode = false,
  surfaceClass = 'bg-white',
  textClass = 'text-slate-900',
  mutedClass = 'text-slate-500',
  borderClass = 'border-slate-200'
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [subscriptionHealth, setSubscriptionHealth] = useState(null);
  const [industryPerformance, setIndustryPerformance] = useState([]);
  const [topTenants, setTopTenants] = useState([]);
  const [dateRange, setDateRange] = useState('30');

  useEffect(() => {
    fetchAllAnalytics();
  }, [dateRange]);

  const fetchAllAnalytics = async () => {
    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      const [
        analyticsRes,
        subscriptionRes,
        industryRes,
        topTenantsRes
      ] = await Promise.all([
        superAdminAPI.getAnalytics({ startDate: startDate.toISOString() }),
        superAdminAPI.getSubscriptionHealth(),
        superAdminAPI.getIndustryPerformance(),
        superAdminAPI.getRevenueByTenant({ limit: 5 })
      ]);

      setAnalytics(analyticsRes.data);
      setSubscriptionHealth(subscriptionRes.data);
      setIndustryPerformance(industryRes.data.industryPerformance || []);
      setTopTenants(topTenantsRes.data.tenants || []);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllAnalytics();
    setRefreshing(false);
  };

  const formatCurrency = (amount) => {
    const value = typeof amount === 'number' ? amount : 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value / 100);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0);
  };

  const StatCard = ({ icon: Icon, label, value, subValue, color, trend }) => (
    <div className={`${surfaceClass} rounded-2xl p-5 border ${borderClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className={`text-2xl font-black ${textClass}`}>{value}</p>
      <p className={`text-xs font-medium ${mutedClass} mt-1`}>{label}</p>
      {subValue && <p className={`text-xs ${mutedClass}`}>{subValue}</p>}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const stats = analytics?.stats || {};
  const subHealth = subscriptionHealth?.summary || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black ${textClass}`}>Global Analytics</h1>
          <p className={`text-sm ${mutedClass}`}>Platform-wide insights and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className={`px-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm font-bold`}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`px-4 py-2 ${surfaceClass} border ${borderClass} rounded-xl text-sm font-bold ${textClass} hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50`}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={formatCurrency(stats.totalRevenue || 0)}
          color="bg-emerald-600"
        />
        <StatCard
          icon={ShoppingCart}
          label="Transactions"
          value={formatNumber(stats.totalTransactions || 0)}
          color="bg-indigo-600"
        />
        <StatCard
          icon={Building2}
          label="Active Tenants"
          value={stats.activeTenants || 0}
          color="bg-purple-600"
        />
        <StatCard
          icon={Users}
          label="Total Staff"
          value={formatNumber(stats.totalUsers || 0)}
          color="bg-amber-500"
        />
        <StatCard
          icon={Package}
          label="Products Listed"
          value={formatNumber(stats.totalProducts || 0)}
          color="bg-cyan-600"
        />
        <StatCard
          icon={GitBranch}
          label="Branches"
          value={formatNumber(stats.totalBranches || 0)}
          color="bg-rose-600"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Target className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className={`text-lg font-bold ${textClass}`}>{formatCurrency((stats.totalRevenue || 0) / (stats.totalTransactions || 1))}</p>
              <p className={`text-xs ${mutedClass}`}>Average Order Value</p>
            </div>
          </div>
        </div>
        <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className={`text-lg font-bold ${textClass}`}>{Math.round((stats.totalTransactions || 0) / parseInt(dateRange))}/day</p>
              <p className={`text-xs ${mutedClass}`}>Daily Transactions</p>
            </div>
          </div>
        </div>
        <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Percent className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className={`text-lg font-bold ${textClass}`}>{((stats.voidedTransactions || 0) / (stats.totalTransactions || 1) * 100).toFixed(1)}%</p>
              <p className={`text-xs ${mutedClass}`}>Void Rate</p>
            </div>
          </div>
        </div>
        <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Award className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className={`text-lg font-bold ${textClass}`}>{formatCurrency((stats.totalRevenue || 0) / (stats.activeTenants || 1))}</p>
              <p className={`text-xs ${mutedClass}`}>Revenue per Tenant</p>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription Health */}
        <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${borderClass} flex items-center justify-between`}>
            <h2 className={`text-sm font-bold uppercase ${mutedClass} flex items-center gap-2`}>
              <Activity className="w-4 h-4" />
              Subscription Health
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="relative w-16 h-16 mx-auto mb-2">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" fill="none" stroke={darkMode ? '#334155' : '#e2e8f0'} strokeWidth="6" />
                    <circle
                      cx="32" cy="32" r="28" fill="none" stroke="#10b981" strokeWidth="6"
                      strokeDasharray={`${((subHealth.healthy || 0) / (subHealth.total || 1)) * 176} 176`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-sm font-bold ${textClass}`}>{subHealth.healthy || 0}</span>
                  </div>
                </div>
                <p className={`text-xs font-bold ${textClass}`}>Healthy</p>
                <p className={`text-[10px] ${mutedClass}`}>30+ days</p>
              </div>
              <div className="text-center">
                <div className="relative w-16 h-16 mx-auto mb-2">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" fill="none" stroke={darkMode ? '#334155' : '#e2e8f0'} strokeWidth="6" />
                    <circle
                      cx="32" cy="32" r="28" fill="none" stroke="#f59e0b" strokeWidth="6"
                      strokeDasharray={`${((subHealth.expiringSoon || 0) / (subHealth.total || 1)) * 176} 176`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-sm font-bold ${textClass}`}>{subHealth.expiringSoon || 0}</span>
                  </div>
                </div>
                <p className={`text-xs font-bold ${textClass}`}>Warning</p>
                <p className={`text-[10px] ${mutedClass}`}>7-30 days</p>
              </div>
              <div className="text-center">
                <div className="relative w-16 h-16 mx-auto mb-2">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" fill="none" stroke={darkMode ? '#334155' : '#e2e8f0'} strokeWidth="6" />
                    <circle
                      cx="32" cy="32" r="28" fill="none" stroke="#ef4444" strokeWidth="6"
                      strokeDasharray={`${((subHealth.expiringThisMonth || 0) / (subHealth.total || 1)) * 176} 176`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-sm font-bold ${textClass}`}>{subHealth.expiringThisMonth || 0}</span>
                  </div>
                </div>
                <p className={`text-xs font-bold ${textClass}`}>Critical</p>
                <p className={`text-[10px] ${mutedClass}`}>Less than 7d</p>
              </div>
              <div className="text-center">
                <div className="relative w-16 h-16 mx-auto mb-2">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" fill="none" stroke={darkMode ? '#334155' : '#e2e8f0'} strokeWidth="6" />
                    <circle
                      cx="32" cy="32" r="28" fill="none" stroke="#64748b" strokeWidth="6"
                      strokeDasharray={`${((subHealth.expired || 0) / (subHealth.total || 1)) * 176} 176`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-sm font-bold ${textClass}`}>{subHealth.expired || 0}</span>
                  </div>
                </div>
                <p className={`text-xs font-bold ${textClass}`}>Expired</p>
                <p className={`text-[10px] ${mutedClass}`}>Past due</p>
              </div>
            </div>

            {/* Expiring Tenants List */}
            {subscriptionHealth?.expiringTenants?.length > 0 && (
              <div className={`mt-6 pt-4 border-t border-dashed ${borderClass}`}>
                <p className={`text-xs font-bold uppercase ${mutedClass} mb-3`}>Attention Required</p>
                <div className="space-y-2">
                  {subscriptionHealth.expiringTenants.slice(0, 4).map((tenant) => {
                    const Icon = businessTypeIcons[tenant.businessType] || Building2;
                    const daysLeft = Math.ceil((new Date(tenant.subscriptionEnd) - new Date()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={tenant.id} className={`flex items-center justify-between p-2 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${mutedClass}`} />
                          <span className={`text-sm font-bold ${textClass}`}>{tenant.businessName}</span>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          daysLeft <= 0 ? 'bg-red-100 text-red-700' :
                          daysLeft <= 7 ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {daysLeft <= 0 ? 'Expired' : `${daysLeft}d left`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Performing Tenants */}
        <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${borderClass}`}>
            <h2 className={`text-sm font-bold uppercase ${mutedClass} flex items-center gap-2`}>
              <Award className="w-4 h-4" />
              Top Performing Tenants
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {topTenants.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Building2 className={`w-8 h-8 mx-auto mb-2 ${mutedClass}`} />
                <p className={`text-sm ${mutedClass}`}>No tenant data available</p>
              </div>
            ) : (
              topTenants.map((tenant, index) => (
                <div key={tenant.id} className={`px-6 py-4 flex items-center justify-between hover:${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-amber-100 text-amber-700' :
                      index === 1 ? 'bg-slate-200 text-slate-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      darkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <p className={`text-sm font-bold ${textClass}`}>{tenant.businessName}</p>
                      <p className={`text-xs ${mutedClass}`}>{tenant.industryType || 'General'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${textClass}`}>{formatCurrency(tenant.totalRevenue)}</p>
                    <p className={`text-xs ${mutedClass}`}>{tenant.transactionCount} sales</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Industry Performance & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Industry Performance */}
        <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${borderClass}`}>
            <h2 className={`text-sm font-bold uppercase ${mutedClass} flex items-center gap-2`}>
              <PieChart className="w-4 h-4" />
              Industry Performance
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {industryPerformance.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <BarChart3 className={`w-8 h-8 mx-auto mb-2 ${mutedClass}`} />
                <p className={`text-sm ${mutedClass}`}>No industry data available</p>
              </div>
            ) : (
              industryPerformance.map((industry) => {
                const typeConfig = BUSINESS_TYPES[industry.businessType] || { label: industry.businessType, icon: Building2, color: 'bg-slate-500', textColor: 'text-slate-600' };
                const Icon = typeConfig.icon;
                const maxRevenue = Math.max(...industryPerformance.map(i => i.totalRevenue || 0));
                const percentage = maxRevenue > 0 ? ((industry.totalRevenue || 0) / maxRevenue) * 100 : 0;

                return (
                  <div key={industry.businessType} className={`px-6 py-4 hover:${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${typeConfig.color} flex items-center justify-center`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${textClass}`}>{typeConfig.label}</p>
                          <p className={`text-xs ${mutedClass}`}>
                            {industry.tenantCount} tenants
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${textClass}`}>{formatCurrency(industry.totalRevenue)}</p>
                        <p className={`text-xs ${mutedClass}`}>{industry.totalTransactions} transactions</p>
                      </div>
                    </div>
                    <div className={`h-1.5 rounded-full ${darkMode ? 'bg-slate-600' : 'bg-slate-100'}`}>
                      <div
                        className={`h-full rounded-full ${typeConfig.color}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${borderClass}`}>
            <h2 className={`text-sm font-bold uppercase ${mutedClass} flex items-center gap-2`}>
              <ShoppingCart className="w-4 h-4" />
              Recent Transactions
            </h2>
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {!analytics?.recentSales || analytics.recentSales.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <ShoppingCart className={`w-8 h-8 mx-auto mb-2 ${mutedClass}`} />
                <p className={`text-sm ${mutedClass}`}>No recent transactions</p>
              </div>
            ) : (
              analytics.recentSales.slice(0, 8).map((sale) => (
                <div key={sale.id} className={`px-6 py-4 flex items-center justify-between hover:${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                  <div>
                    <p className={`text-sm font-bold ${textClass}`}>{sale.tenant}</p>
                    <p className={`text-xs ${mutedClass}`}>{sale.cashier}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${textClass}`}>{formatCurrency(sale.amount)}</p>
                    <p className={`text-xs ${mutedClass}`}>
                      {new Date(sale.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
