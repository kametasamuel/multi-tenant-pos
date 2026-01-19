import React, { useState, useEffect } from 'react';
import { superAdminAPI } from '../../api';
import {
  TrendingUp,
  DollarSign,
  Building2,
  Users,
  ShoppingCart,
  Package,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Activity,
  PieChart,
  RefreshCcw,
  Calendar,
  Store,
  Utensils,
  Scissors,
  Pill,
  Tv,
  Shirt,
  MoreHorizontal
} from 'lucide-react';

const businessTypeIcons = {
  RETAIL: Store,
  RESTAURANT: Utensils,
  SALON: Scissors,
  PHARMACY: Pill,
  GROCERY: ShoppingCart,
  ELECTRONICS: Tv,
  CLOTHING: Shirt,
  OTHER: MoreHorizontal
};

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [subscriptionHealth, setSubscriptionHealth] = useState(null);
  const [industryPerformance, setIndustryPerformance] = useState([]);
  const [staffProductivity, setStaffProductivity] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
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
        staffRes,
        anomaliesRes
      ] = await Promise.all([
        superAdminAPI.getAnalytics({ startDate: startDate.toISOString() }),
        superAdminAPI.getSubscriptionHealth(),
        superAdminAPI.getIndustryPerformance(),
        superAdminAPI.getStaffProductivity({ startDate: startDate.toISOString(), limit: 10 }),
        superAdminAPI.getAnomalies()
      ]);

      setAnalytics(analyticsRes.data);
      setSubscriptionHealth(subscriptionRes.data);
      setIndustryPerformance(industryRes.data.industryPerformance || []);
      setStaffProductivity(staffRes.data.staffProductivity || []);
      setAnomalies(anomaliesRes.data);
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount / 100); // Assuming amounts are in cents
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="text-sm text-gray-500">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const stats = analytics?.stats || {};
  const subHealth = subscriptionHealth?.summary || {};

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Global Analytics</h1>
                <p className="text-sm text-gray-500">Platform-wide insights and metrics</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
              </select>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCcw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Revenue */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">{formatCurrency(stats.totalRevenue || 0)}</p>
            <p className="text-sm text-gray-500">Total Revenue</p>
          </div>

          {/* Total Transactions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">{formatNumber(stats.totalTransactions || 0)}</p>
            <p className="text-sm text-gray-500">Total Transactions</p>
          </div>

          {/* Active Tenants */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Building2 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">{stats.activeTenants || 0}</p>
            <p className="text-sm text-gray-500">Active Tenants</p>
          </div>

          {/* Total Users */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Users className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">{formatNumber(stats.totalUsers || 0)}</p>
            <p className="text-sm text-gray-500">Total Staff</p>
          </div>
        </div>

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Subscription Health */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Subscription Health
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-center gap-6 flex-wrap">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-2">
                    <span className="text-2xl font-bold text-green-600">{subHealth.healthy || 0}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-600">Healthy</p>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                    <span className="text-2xl font-bold text-amber-600">{subHealth.expiringSoon || 0}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-600">Expiring Soon</p>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mb-2">
                    <span className="text-2xl font-bold text-orange-600">{subHealth.expiringThisMonth || 0}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-600">This Month</p>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-2">
                    <span className="text-2xl font-bold text-red-600">{subHealth.expired || 0}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-600">Expired</p>
                </div>
              </div>

              {/* Expiring Tenants List */}
              {subscriptionHealth?.expiringTenants?.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Attention Required</h4>
                  <div className="space-y-2">
                    {subscriptionHealth.expiringTenants.slice(0, 5).map((tenant) => {
                      const Icon = businessTypeIcons[tenant.businessType] || Building2;
                      const daysLeft = Math.ceil((new Date(tenant.subscriptionEnd) - new Date()) / (1000 * 60 * 60 * 24));
                      return (
                        <div key={tenant.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-900">{tenant.businessName}</span>
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            daysLeft <= 0 ? 'bg-red-100 text-red-700' :
                            daysLeft <= 7 ? 'bg-amber-100 text-amber-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {daysLeft <= 0 ? 'Expired' : `${daysLeft} days left`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top Staff Productivity */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Top Staff Performance
              </h2>
            </div>
            <div className="divide-y divide-gray-200">
              {staffProductivity.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  No staff data available
                </div>
              ) : (
                staffProductivity.slice(0, 5).map((staff, index) => (
                  <div key={staff.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        index === 0 ? 'bg-amber-100 text-amber-700' :
                        index === 1 ? 'bg-gray-200 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{staff.name}</p>
                        <p className="text-xs text-gray-500">{staff.tenant} - {staff.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{staff.currencySymbol}{(staff.totalSales / 100).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{staff.transactionCount} txns</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Industry Performance & Anomalies */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Industry Performance */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-indigo-600" />
                Industry Performance
              </h2>
            </div>
            <div className="divide-y divide-gray-200">
              {industryPerformance.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  No industry data available
                </div>
              ) : (
                industryPerformance.map((industry, index) => {
                  const Icon = businessTypeIcons[industry.businessType] || Building2;
                  return (
                    <div key={industry.businessType} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-indigo-600" />
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">{industry.businessType}</p>
                          <p className="text-xs text-gray-500">
                            {industry.tenantCount} tenants | {industry.totalTransactions} txns
                          </p>
                        </div>
                      </div>
                      <p className="font-semibold text-gray-900">{formatCurrency(industry.totalRevenue)}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Anomalies / Flags */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Anomalies & Flags
              </h2>
              {anomalies.summary && (
                <span className="text-xs font-medium px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                  {anomalies.summary.total} issues
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {!anomalies.anomalies || anomalies.anomalies.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Activity className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-gray-500">No anomalies detected</p>
                  <p className="text-xs text-gray-400 mt-1">System is running smoothly</p>
                </div>
              ) : (
                anomalies.anomalies.map((anomaly, index) => (
                  <div key={index} className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        anomaly.severity === 'HIGH' ? 'bg-red-500' :
                        anomaly.severity === 'MEDIUM' ? 'bg-amber-500' :
                        'bg-blue-500'
                      }`}></div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900">{anomaly.tenantName}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            anomaly.severity === 'HIGH' ? 'bg-red-100 text-red-700' :
                            anomaly.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {anomaly.severity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{anomaly.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{anomaly.type.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Recent Sales */}
        {analytics?.recentSales?.length > 0 && (
          <div className="mt-8 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-600" />
                Recent Transactions
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Tenant</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Cashier</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-600">Amount</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analytics.recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{sale.tenant}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{sale.cashier}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(sale.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(sale.date).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
