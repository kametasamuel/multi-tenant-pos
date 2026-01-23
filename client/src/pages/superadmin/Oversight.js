import React, { useState, useEffect, useCallback } from 'react';
import { superAdminAPI } from '../../api';
import {
  Eye,
  AlertTriangle,
  Search,
  Filter,
  Calendar,
  DollarSign,
  XCircle,
  CheckCircle,
  Clock,
  User,
  Building2,
  Receipt,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  BarChart3,
  Activity,
  ShoppingCart,
  CreditCard,
  Banknote,
  Percent,
  UserX,
  Moon,
  Tag
} from 'lucide-react';

const Oversight = ({
  darkMode = false,
  surfaceClass = 'bg-white',
  textClass = 'text-slate-900',
  mutedClass = 'text-slate-500',
  borderClass = 'border-slate-200'
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [suspicious, setSuspicious] = useState(null);
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalRevenue: 0,
    totalVoided: 0,
    totalVoidedAmount: 0,
    voidRate: 0,
    highValueVoids: 0,
    suspiciousUsers: 0,
    unusualHours: 0,
    largeDiscounts: 0
  });
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    tenantId: '',
    isVoided: '',
    minAmount: '',
    maxAmount: '',
    paymentMethod: ''
  });
  const [tenants, setTenants] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 50 });
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      // Build params based on active tab and filters
      const params = {
        page: pagination.page,
        limit: 50,
        startDate: filters.startDate,
        endDate: filters.endDate
      };

      if (filters.tenantId) params.tenantId = filters.tenantId;
      if (filters.minAmount) params.minAmount = filters.minAmount;
      if (filters.maxAmount) params.maxAmount = filters.maxAmount;
      if (filters.paymentMethod) params.paymentMethod = filters.paymentMethod;

      // Set isVoided based on tab
      if (activeTab === 'voided') {
        params.isVoided = 'true';
      } else if (activeTab === 'all' && filters.isVoided) {
        params.isVoided = filters.isVoided;
      }

      // Fetch data in parallel
      const suspiciousParams = {
        startDate: filters.startDate,
        endDate: filters.endDate
      };
      if (filters.tenantId) suspiciousParams.tenantId = filters.tenantId;

      const [tenantsRes, transactionsRes, suspiciousRes] = await Promise.allSettled([
        superAdminAPI.getTenants({ limit: 100 }),
        superAdminAPI.getAllTransactions(params),
        superAdminAPI.getSuspiciousActivity(suspiciousParams)
      ]);

      // Process tenants
      if (tenantsRes.status === 'fulfilled') {
        setTenants(tenantsRes.value.data.tenants || []);
      }

      // Process transactions
      if (transactionsRes.status === 'fulfilled') {
        const data = transactionsRes.value.data;
        setTransactions(data.transactions || []);
        setPagination(prev => ({
          ...prev,
          pages: data.pagination?.pages || 1,
          total: data.pagination?.total || 0
        }));

        // Update stats from summary
        setStats(prev => ({
          ...prev,
          totalTransactions: data.summary?.transactionCount || 0,
          totalRevenue: data.summary?.totalRevenue || 0,
          totalDiscount: data.summary?.totalDiscount || 0
        }));
      }

      // Process suspicious activity
      if (suspiciousRes.status === 'fulfilled') {
        const suspData = suspiciousRes.value.data;
        setSuspicious(suspData);
        setStats(prev => ({
          ...prev,
          highValueVoids: suspData.summary?.highValueVoidCount || 0,
          suspiciousUsers: suspData.summary?.suspiciousUserCount || 0,
          unusualHours: suspData.summary?.unusualHoursCount || 0,
          largeDiscounts: suspData.summary?.largeDiscountCount || 0
        }));
      }

      // Fetch void stats separately
      const voidRes = await superAdminAPI.getVoidedSales({
        startDate: filters.startDate,
        endDate: filters.endDate,
        tenantId: filters.tenantId || undefined
      });

      if (voidRes.data) {
        setStats(prev => ({
          ...prev,
          totalVoided: voidRes.data.summary?.totalVoidCount || 0,
          totalVoidedAmount: voidRes.data.summary?.totalVoidedAmount || 0,
          voidRate: prev.totalTransactions > 0
            ? ((voidRes.data.summary?.totalVoidCount / (prev.totalTransactions + voidRes.data.summary?.totalVoidCount)) * 100).toFixed(2)
            : 0
        }));
      }

    } catch (err) {
      console.error('Error fetching oversight data:', err);
      setError('Failed to load oversight data. Some features may be unavailable.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, pagination.page, activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Reset page when tab or filters change
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [activeTab, filters.tenantId, filters.startDate, filters.endDate, filters.paymentMethod, filters.minAmount, filters.maxAmount]);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const formatCurrency = (amount, currency = 'NGN', symbol = null) => {
    // If symbol is provided, use manual formatting
    if (symbol) {
      return `${symbol}${Number(amount || 0).toLocaleString()}`;
    }
    // Otherwise use Intl formatter
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'NGN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount || 0);
    } catch {
      return `${amount || 0}`;
    }
  };

  // Helper to get formatted amount with tenant currency
  const formatTenantCurrency = (amount, tenant) => {
    if (tenant?.currencySymbol) {
      return `${tenant.currencySymbol}${Number(amount || 0).toLocaleString()}`;
    }
    return formatCurrency(amount, tenant?.currency);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const StatCard = ({ icon: Icon, label, value, subValue, color, trend, alert }) => (
    <div className={`${surfaceClass} rounded-2xl p-5 border ${alert ? 'border-red-300 ring-2 ring-red-100' : borderClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend !== undefined && trend !== 0 && (
          <div className={`flex items-center gap-1 text-xs font-bold ${trend > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <p className={`text-2xl font-black ${textClass}`}>{value}</p>
      <p className={`text-xs font-medium ${mutedClass} mt-1`}>{label}</p>
      {subValue && <p className={`text-xs ${mutedClass} mt-0.5`}>{subValue}</p>}
    </div>
  );

  // Get filtered data based on active tab
  const getDisplayData = () => {
    if (activeTab === 'suspicious' && suspicious) {
      return {
        highValueVoids: suspicious.highValueVoids || [],
        suspiciousUsers: suspicious.suspiciousUsers || [],
        unusualHours: suspicious.unusualHoursSales || [],
        largeDiscounts: suspicious.significantDiscounts || []
      };
    }
    return null;
  };

  const suspiciousData = getDisplayData();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className={`text-sm font-bold ${mutedClass}`}>Loading oversight data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black ${textClass}`}>Transaction Oversight</h1>
          <p className={`text-sm ${mutedClass}`}>Monitor all platform transactions and detect suspicious activity</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={refreshing}
            className={`px-4 py-2 ${surfaceClass} border ${borderClass} rounded-xl text-sm font-bold ${textClass} hover:bg-slate-50 flex items-center gap-2`}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className={`p-4 rounded-xl ${darkMode ? 'bg-red-900/20' : 'bg-red-50'} border border-red-200`}>
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={Receipt}
          label="Total Transactions"
          value={stats.totalTransactions.toLocaleString()}
          subValue={formatCurrency(stats.totalRevenue)}
          color="bg-indigo-600"
        />
        <StatCard
          icon={XCircle}
          label="Voided Sales"
          value={stats.totalVoided.toLocaleString()}
          subValue={formatCurrency(stats.totalVoidedAmount)}
          color="bg-red-500"
          alert={stats.totalVoided > 10}
        />
        <StatCard
          icon={Percent}
          label="Void Rate"
          value={`${stats.voidRate}%`}
          subValue="Platform average"
          color="bg-amber-500"
          alert={parseFloat(stats.voidRate) > 5}
        />
        <StatCard
          icon={DollarSign}
          label="High Value Voids"
          value={stats.highValueVoids}
          subValue="Above 500"
          color="bg-purple-600"
          alert={stats.highValueVoids > 0}
        />
        <StatCard
          icon={UserX}
          label="Suspicious Users"
          value={stats.suspiciousUsers}
          subValue="5+ voids in 7 days"
          color="bg-rose-600"
          alert={stats.suspiciousUsers > 0}
        />
        <StatCard
          icon={Moon}
          label="Odd Hours Sales"
          value={stats.unusualHours}
          subValue="11PM - 5AM"
          color="bg-slate-600"
          alert={stats.unusualHours > 0}
        />
      </div>

      {/* Filters */}
      <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className={`w-4 h-4 ${mutedClass}`} />
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className={`px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            />
            <span className={mutedClass}>to</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className={`px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            />
          </div>
          <select
            value={filters.tenantId}
            onChange={(e) => setFilters({ ...filters, tenantId: e.target.value })}
            className={`px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm min-w-[180px]`}
          >
            <option value="">All Tenants</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.businessName}</option>
            ))}
          </select>
          <select
            value={filters.paymentMethod}
            onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
            className={`px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
          >
            <option value="">All Payments</option>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="MOMO">MoMo</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
          <input
            type="number"
            placeholder="Min Amount"
            value={filters.minAmount}
            onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
            className={`px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm w-28`}
          />
          <input
            type="number"
            placeholder="Max Amount"
            value={filters.maxAmount}
            onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
            className={`px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm w-28`}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-1 overflow-x-auto">
        {[
          { id: 'all', label: 'All Transactions', count: pagination.total },
          { id: 'voided', label: 'Voided Sales', count: stats.totalVoided },
          { id: 'suspicious', label: 'Suspicious Activity', count: stats.highValueVoids + stats.suspiciousUsers }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white'
                : `${mutedClass} hover:${textClass}`
            }`}
          >
            {tab.label}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              activeTab === tab.id ? 'bg-white/20' : darkMode ? 'bg-slate-700' : 'bg-slate-100'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content based on active tab */}
      {activeTab === 'suspicious' ? (
        <div className="space-y-6">
          {/* High Value Voids */}
          {suspicious?.highValueVoids?.length > 0 && (
            <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
              <div className={`p-4 border-b ${borderClass} flex items-center gap-2`}>
                <DollarSign className="w-5 h-5 text-red-500" />
                <h3 className={`text-sm font-bold ${textClass}`}>High-Value Voids (&gt;500)</h3>
                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700`}>
                  {suspicious.highValueVoids.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={darkMode ? 'bg-slate-700' : 'bg-slate-50'}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Tenant</th>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Amount</th>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Cashier</th>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Voided By</th>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {suspicious.highValueVoids.map((sale) => (
                      <tr key={sale.id} className={`hover:${darkMode ? 'bg-slate-700' : 'bg-red-50'}`}>
                        <td className={`px-4 py-3 text-sm font-bold ${textClass}`}>
                          {sale.tenant?.businessName || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-sm font-black text-red-600">
                          {formatTenantCurrency(sale.finalAmount || sale.total, sale.tenant)}
                        </td>
                        <td className={`px-4 py-3 text-sm ${mutedClass}`}>
                          {sale.cashier?.fullName || 'Unknown'}
                        </td>
                        <td className={`px-4 py-3 text-sm ${textClass}`}>
                          {sale.voidedBy?.fullName || 'Unknown'}
                        </td>
                        <td className={`px-4 py-3 text-sm ${mutedClass}`}>
                          {formatDate(sale.voidedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Suspicious Users */}
          {suspicious?.suspiciousUsers?.length > 0 && (
            <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
              <div className={`p-4 border-b ${borderClass} flex items-center gap-2`}>
                <UserX className="w-5 h-5 text-amber-500" />
                <h3 className={`text-sm font-bold ${textClass}`}>Users with High Void Counts (7 days)</h3>
                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700`}>
                  {suspicious.suspiciousUsers.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={darkMode ? 'bg-slate-700' : 'bg-slate-50'}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Staff</th>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Tenant</th>
                      <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${mutedClass}`}>Void Count</th>
                      <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${mutedClass}`}>Total Voided</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {suspicious.suspiciousUsers.map((user, index) => (
                      <tr key={index} className={`hover:${darkMode ? 'bg-slate-700' : 'bg-amber-50'}`}>
                        <td className={`px-4 py-3`}>
                          <p className={`text-sm font-bold ${textClass}`}>{user.fullName}</p>
                          <p className={`text-xs ${mutedClass}`}>@{user.username}</p>
                        </td>
                        <td className={`px-4 py-3 text-sm ${mutedClass}`}>
                          {user.tenantName}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                            {user.voidCount} voids
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-black text-red-600">
                          {formatCurrency(user.totalVoidedAmount, user.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Unusual Hours */}
          {suspicious?.unusualHoursSales?.length > 0 && (
            <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
              <div className={`p-4 border-b ${borderClass} flex items-center gap-2`}>
                <Moon className="w-5 h-5 text-purple-500" />
                <h3 className={`text-sm font-bold ${textClass}`}>Unusual Hours Transactions (11PM - 5AM)</h3>
                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700`}>
                  {suspicious.unusualHoursSales.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={darkMode ? 'bg-slate-700' : 'bg-slate-50'}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Tenant</th>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Staff</th>
                      <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${mutedClass}`}>Amount</th>
                      <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${mutedClass}`}>Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {suspicious.unusualHoursSales.slice(0, 10).map((sale, index) => (
                      <tr key={index} className={`hover:${darkMode ? 'bg-slate-700' : 'bg-purple-50'}`}>
                        <td className={`px-4 py-3 text-sm font-bold ${textClass}`}>
                          {sale.tenantName}
                        </td>
                        <td className={`px-4 py-3 text-sm ${mutedClass}`}>
                          {sale.staffName}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-purple-600">
                          {formatCurrency(sale.finalAmount || sale.total, sale.currency)}
                        </td>
                        <td className={`px-4 py-3 text-right text-sm ${mutedClass}`}>
                          {formatDate(sale.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Large Discounts */}
          {suspicious?.significantDiscounts?.length > 0 && (
            <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
              <div className={`p-4 border-b ${borderClass} flex items-center gap-2`}>
                <Tag className="w-5 h-5 text-orange-500" />
                <h3 className={`text-sm font-bold ${textClass}`}>Large Discounts (&gt;30%)</h3>
                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700`}>
                  {suspicious.significantDiscounts.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={darkMode ? 'bg-slate-700' : 'bg-slate-50'}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Tenant</th>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Staff</th>
                      <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${mutedClass}`}>Sale Total</th>
                      <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${mutedClass}`}>Discount</th>
                      <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${mutedClass}`}>Discount %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {suspicious.significantDiscounts.slice(0, 10).map((sale, index) => (
                      <tr key={index} className={`hover:${darkMode ? 'bg-slate-700' : 'bg-orange-50'}`}>
                        <td className={`px-4 py-3 text-sm font-bold ${textClass}`}>
                          {sale.tenant?.businessName || 'Unknown'}
                        </td>
                        <td className={`px-4 py-3 text-sm ${mutedClass}`}>
                          {sale.cashier?.fullName || 'Unknown'}
                        </td>
                        <td className={`px-4 py-3 text-right text-sm ${textClass}`}>
                          {formatTenantCurrency(sale.finalAmount || sale.total, sale.tenant)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-orange-600">
                          {formatTenantCurrency(sale.discountAmount || sale.discount, sale.tenant)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                            {sale.discountPercent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state */}
          {(!suspicious?.highValueVoids?.length && !suspicious?.suspiciousUsers?.length &&
            !suspicious?.unusualHoursSales?.length && !suspicious?.significantDiscounts?.length) && (
            <div className={`${surfaceClass} rounded-2xl border ${borderClass} p-12 text-center`}>
              <CheckCircle className={`w-16 h-16 mx-auto mb-4 text-emerald-500`} />
              <p className={`text-lg font-bold ${textClass} mb-2`}>No Suspicious Activity Detected</p>
              <p className={`text-sm ${mutedClass}`}>
                All transactions within the selected date range appear normal.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Transactions Table */
        <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
          {transactions.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt className={`w-16 h-16 mx-auto mb-4 ${mutedClass}`} />
              <p className={`text-lg font-bold ${textClass}`}>No Transactions Found</p>
              <p className={`text-sm ${mutedClass}`}>Try adjusting your filters or date range.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={darkMode ? 'bg-slate-700' : 'bg-slate-50'}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Tenant</th>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Amount</th>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Status</th>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Payment</th>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Cashier</th>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Branch</th>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Date</th>
                      <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className={`hover:${darkMode ? 'bg-slate-700' : 'bg-slate-50'} transition-colors`}>
                        <td className={`px-4 py-3`}>
                          <p className={`text-sm font-bold ${textClass}`}>{tx.tenant?.businessName || 'Unknown'}</p>
                          <p className={`text-xs ${mutedClass}`}>{tx.tenant?.slug}</p>
                        </td>
                        <td className={`px-4 py-3`}>
                          <p className={`text-sm font-bold ${tx.paymentStatus === 'voided' ? 'text-red-600 line-through' : textClass}`}>
                            {formatTenantCurrency(tx.finalAmount || tx.total, tx.tenant)}
                          </p>
                          {(tx.discountAmount || tx.discount) > 0 && (
                            <p className="text-xs text-orange-600">-{formatTenantCurrency(tx.discountAmount || tx.discount, tx.tenant)} disc.</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                            tx.paymentStatus === 'voided'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {tx.paymentStatus === 'voided' ? (
                              <XCircle className="w-3 h-3" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                            {tx.paymentStatus === 'voided' ? 'VOIDED' : 'COMPLETED'}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm ${mutedClass}`}>
                          <div className="flex items-center gap-1">
                            {tx.paymentMethod === 'CASH' && <Banknote className="w-3 h-3" />}
                            {tx.paymentMethod === 'CARD' && <CreditCard className="w-3 h-3" />}
                            {tx.paymentMethod}
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-sm ${mutedClass}`}>
                          {tx.cashier?.fullName || 'Unknown'}
                        </td>
                        <td className={`px-4 py-3 text-sm ${mutedClass}`}>
                          {tx.branch?.name || 'Main'}
                        </td>
                        <td className={`px-4 py-3 text-sm ${mutedClass}`}>
                          {formatDate(tx.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedTransaction(tx)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className={`flex items-center justify-between px-4 py-3 border-t ${borderClass}`}>
                <p className={`text-sm ${mutedClass}`}>
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className={`p-2 rounded-lg ${surfaceClass} border ${borderClass} disabled:opacity-50`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className={`text-sm font-bold ${textClass}`}>
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.pages}
                    className={`p-2 rounded-lg ${surfaceClass} border ${borderClass} disabled:opacity-50`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${surfaceClass} rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-6 border-b ${borderClass} sticky top-0 ${surfaceClass}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-bold ${textClass}`}>Transaction Details</h3>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className={`p-2 ${mutedClass} hover:${textClass} rounded-lg`}
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Transaction Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass}`}>Tenant</p>
                  <p className={`text-sm font-bold ${textClass}`}>{selectedTransaction.tenant?.businessName}</p>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass}`}>Status</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                    selectedTransaction.paymentStatus === 'voided'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {selectedTransaction.paymentStatus === 'voided' ? 'VOIDED' : 'COMPLETED'}
                  </span>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass}`}>Total Amount</p>
                  <p className={`text-lg font-black ${selectedTransaction.paymentStatus === 'voided' ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatTenantCurrency(selectedTransaction.finalAmount || selectedTransaction.total, selectedTransaction.tenant)}
                  </p>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass}`}>Discount</p>
                  <p className={`text-sm ${textClass}`}>{formatTenantCurrency(selectedTransaction.discountAmount || selectedTransaction.discount || 0, selectedTransaction.tenant)}</p>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass}`}>Payment Method</p>
                  <p className={`text-sm ${textClass}`}>{selectedTransaction.paymentMethod}</p>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass}`}>Items</p>
                  <p className={`text-sm ${textClass}`}>{selectedTransaction.items?.length || 0} items</p>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass}`}>Cashier</p>
                  <p className={`text-sm ${textClass}`}>{selectedTransaction.cashier?.fullName || 'Unknown'}</p>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass}`}>Branch</p>
                  <p className={`text-sm ${textClass}`}>{selectedTransaction.branch?.name || 'Main'}</p>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass}`}>Customer</p>
                  <p className={`text-sm ${textClass}`}>{selectedTransaction.customer?.name || 'Walk-in'}</p>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass}`}>Date</p>
                  <p className={`text-sm ${textClass}`}>{formatDate(selectedTransaction.createdAt)}</p>
                </div>
              </div>

              {/* Items */}
              {selectedTransaction.items?.length > 0 && (
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass} mb-3`}>Items</p>
                  <div className={`rounded-xl border ${borderClass} overflow-hidden`}>
                    <table className="w-full">
                      <thead className={darkMode ? 'bg-slate-700' : 'bg-slate-50'}>
                        <tr>
                          <th className={`px-3 py-2 text-left text-xs font-bold uppercase ${mutedClass}`}>Product</th>
                          <th className={`px-3 py-2 text-right text-xs font-bold uppercase ${mutedClass}`}>Quantity</th>
                          <th className={`px-3 py-2 text-right text-xs font-bold uppercase ${mutedClass}`}>Price</th>
                          <th className={`px-3 py-2 text-right text-xs font-bold uppercase ${mutedClass}`}>Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {selectedTransaction.items.map((item, index) => (
                          <tr key={index}>
                            <td className={`px-3 py-2 text-sm ${textClass}`}>
                              {item.product?.name || 'Unknown Product'}
                            </td>
                            <td className={`px-3 py-2 text-sm text-right ${mutedClass}`}>
                              {item.quantity}
                            </td>
                            <td className={`px-3 py-2 text-sm text-right ${mutedClass}`}>
                              {formatTenantCurrency(item.unitPrice, selectedTransaction.tenant)}
                            </td>
                            <td className={`px-3 py-2 text-sm text-right font-bold ${textClass}`}>
                              {formatTenantCurrency(item.quantity * item.unitPrice, selectedTransaction.tenant)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Void Info */}
              {selectedTransaction.paymentStatus === 'voided' && (
                <div className={`p-4 rounded-xl ${darkMode ? 'bg-red-900/20' : 'bg-red-50'} border border-red-200`}>
                  <p className="text-xs font-bold uppercase text-red-600 mb-3">Void Information</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className={`text-xs ${mutedClass}`}>Voided By</p>
                      <p className={`text-sm font-bold ${textClass}`}>{selectedTransaction.voidedBy?.fullName || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className={`text-xs ${mutedClass}`}>Voided At</p>
                      <p className={`text-sm ${textClass}`}>{formatDate(selectedTransaction.voidedAt)}</p>
                    </div>
                    {selectedTransaction.voidReason && (
                      <div className="col-span-2">
                        <p className={`text-xs ${mutedClass}`}>Reason</p>
                        <p className={`text-sm ${textClass}`}>{selectedTransaction.voidReason}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Oversight;
