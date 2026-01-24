import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { productsAPI, salesAPI, usersAPI, expensesAPI, securityRequestsAPI, reportsAPI } from '../../api';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Package,
  ArrowRight,
  Clock,
  BarChart3,
  Calendar,
  Filter,
  AlertCircle,
  Timer,
  Award,
  ChevronDown,
  UserCog
} from 'lucide-react';

const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

const ManagerDashboard = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, bgClass }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isServicesType = ['SERVICES', 'SALON'].includes(user?.businessType);

  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('today');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [attendantPerformance, setAttendantPerformance] = useState({ performance: [], totals: {} });
  const [dashboardData, setDashboardData] = useState({
    todayRevenue: 0,
    todayProfit: 0,
    totalExpenses: 0,
    netProfit: 0,
    todayOrders: 0,
    pendingRequests: 0,
    lowStockCount: 0,
    expiringCount: 0,
    expiredCount: 0,
    expiringProducts: [],
    expiredProducts: [],
    recentSales: [],
    topProducts: [],
    leastProducts: [],
    topDays: [],
    staffStats: []
  });

  const currency = user?.currency || 'USD';

  useEffect(() => {
    loadDashboardData();
  }, [dateFilter, customDateRange]);

  // Auto-refresh every 30 seconds when page is visible
  useEffect(() => {
    const refreshData = () => {
      if (document.visibilityState === 'visible') {
        loadDashboardData();
      }
    };

    const intervalId = setInterval(refreshData, AUTO_REFRESH_INTERVAL);

    // Handle visibility change - refresh when coming back to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadDashboardData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [dateFilter, customDateRange]);

  const getDateRange = () => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (dateFilter) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        if (customDateRange.start && customDateRange.end) {
          startDate = new Date(customDateRange.start);
          endDate = new Date(customDateRange.end);
          endDate.setHours(23, 59, 59, 999);
        }
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }

    return { startDate, endDate };
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange();

      const apiCalls = [
        salesAPI.getAll({ startDate: startDate.toISOString(), endDate: endDate.toISOString() }),
        productsAPI.getAll(),
        usersAPI.getAll().catch(() => ({ data: { users: [] } })),
        expensesAPI.getAll({ startDate: startDate.toISOString(), endDate: endDate.toISOString() }).catch(() => ({ data: { expenses: [] } })),
        securityRequestsAPI.getAll({ status: 'PENDING' }).catch(() => ({ data: { requests: [] } }))
      ];

      // Add attendant performance call if business is SERVICES type
      if (isServicesType) {
        apiCalls.push(reportsAPI.getStylistPerformance({ startDate: startDate.toISOString(), endDate: endDate.toISOString() }).catch(() => ({ data: { performance: [], totals: {} } })));
      }

      const results = await Promise.all(apiCalls);
      const [salesRes, productsRes, staffRes, expensesRes, requestsRes] = results;

      // Handle attendant performance if available
      if (isServicesType && results[5]) {
        setAttendantPerformance(results[5].data);
      }

      const sales = salesRes.data.sales || [];
      const completedSales = sales.filter(s => s.paymentStatus === 'completed');
      const products = productsRes.data.products || [];
      const staff = staffRes.data.users || [];
      const expenses = expensesRes.data.expenses || [];
      const pendingRequests = requestsRes.data.requests || [];

      // Low stock items
      const lowStock = products.filter(p =>
        p.type === 'PRODUCT' && p.stockQuantity <= (p.reorderLevel || 10)
      );

      // Expiring products (within 3 months)
      const now = new Date();
      const threeMonthsFromNow = new Date();
      threeMonthsFromNow.setMonth(now.getMonth() + 3);

      const expiringProducts = products.filter(p => {
        if (!p.expiryDate) return false;
        const expiryDate = new Date(p.expiryDate);
        return expiryDate > now && expiryDate <= threeMonthsFromNow;
      }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

      // Expired products
      const expiredProducts = products.filter(p => {
        if (!p.expiryDate) return false;
        return new Date(p.expiryDate) < now;
      }).sort((a, b) => new Date(b.expiryDate) - new Date(a.expiryDate));

      // Calculate product performance
      const productSales = {};
      completedSales.forEach(sale => {
        sale.items?.forEach(item => {
          const name = item.product?.name || 'Unknown';
          const id = item.product?.id || name;
          if (!productSales[id]) {
            productSales[id] = { id, name, quantity: 0, revenue: 0 };
          }
          productSales[id].quantity += item.quantity;
          productSales[id].revenue += item.subtotal;
        });
      });

      const sortedProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue);
      const topProducts = sortedProducts.slice(0, 5);
      const leastProducts = sortedProducts.length > 5
        ? sortedProducts.slice(-5).reverse()
        : sortedProducts.slice().reverse().slice(0, 5);

      // Calculate top performing days
      const dayStats = {};
      completedSales.forEach(sale => {
        const day = new Date(sale.createdAt).toLocaleDateString('en-US', { weekday: 'long' });
        if (!dayStats[day]) {
          dayStats[day] = { day, orders: 0, revenue: 0 };
        }
        dayStats[day].orders += 1;
        dayStats[day].revenue += sale.finalAmount;
      });
      const topDays = Object.values(dayStats)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 7);

      // Calculate staff performance
      const staffSales = {};
      completedSales.forEach(sale => {
        const staffId = sale.createdById || sale.createdBy?.id;
        const staffName = sale.createdBy?.fullName || 'Unknown';
        if (!staffSales[staffId]) {
          staffSales[staffId] = {
            id: staffId,
            name: staffName,
            customers: 0,
            totalSales: 0,
            transactions: 0
          };
        }
        staffSales[staffId].customers += sale.customer ? 1 : 0;
        staffSales[staffId].totalSales += sale.finalAmount;
        staffSales[staffId].transactions += 1;
      });
      const staffStats = Object.values(staffSales)
        .sort((a, b) => b.totalSales - a.totalSales);

      // Calculate total revenue
      const totalRevenue = completedSales.reduce((sum, s) => sum + s.finalAmount, 0);

      // Calculate gross profit from sales (revenue - cost of goods sold)
      const grossProfit = completedSales.reduce((sum, sale) => {
        const saleProfit = (sale.items || []).reduce((itemSum, item) => {
          const sellingPrice = item.unitPrice || item.product?.sellingPrice || 0;
          const costPrice = item.product?.costPrice || 0;
          const itemProfit = (sellingPrice - costPrice) * item.quantity;
          return itemSum + itemProfit;
        }, 0);
        return sum + saleProfit;
      }, 0);

      // Calculate total expenses
      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

      // Calculate net profit (gross profit - expenses)
      const netProfit = grossProfit - totalExpenses;

      setDashboardData({
        todayRevenue: totalRevenue,
        todayProfit: grossProfit,
        totalExpenses,
        netProfit,
        todayOrders: completedSales.length,
        pendingRequests: pendingRequests.length,
        lowStockCount: lowStock.length,
        expiringCount: expiringProducts.length,
        expiredCount: expiredProducts.length,
        expiringProducts: expiringProducts.slice(0, 5),
        expiredProducts: expiredProducts.slice(0, 5),
        recentSales: completedSales.slice(0, 5),
        topProducts,
        leastProducts,
        topDays,
        staffStats
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getFilterLabel = () => {
    switch (dateFilter) {
      case 'today': return 'Today';
      case 'week': return 'Last 7 Days';
      case 'month': return 'Last 30 Days';
      case 'quarter': return 'Last 3 Months';
      case 'custom': return customDateRange.start && customDateRange.end
        ? `${new Date(customDateRange.start).toLocaleDateString()} - ${new Date(customDateRange.end).toLocaleDateString()}`
        : 'Custom Range';
      default: return 'Today';
    }
  };

  const getDaysUntilExpiry = (expiryDate) => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Mission Control Header with Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${textClass}`}>
            Mission Control
          </h1>
          <p className={`text-sm ${mutedClass} mt-1`}>
            {user?.tenantName} • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Date Filter */}
        <div className="relative">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`flex items-center gap-2 px-4 py-2.5 ${surfaceClass} border ${borderClass} rounded-xl text-xs font-bold uppercase ${textClass} hover:border-accent-500 transition-colors`}
          >
            <Filter className="w-4 h-4" />
            {getFilterLabel()}
            <ChevronDown className="w-4 h-4" />
          </button>

          {showDatePicker && (
            <div className={`absolute right-0 top-full mt-2 ${surfaceClass} border ${borderClass} rounded-2xl p-4 shadow-xl z-50 min-w-[280px]`}>
              <div className="space-y-2 mb-4">
                {['today', 'week', 'month', 'quarter'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setDateFilter(filter);
                      setShowDatePicker(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold uppercase transition-colors ${
                      dateFilter === filter
                        ? 'bg-accent-500 text-white'
                        : `${mutedClass} hover:${textClass} hover:bg-slate-100 dark:hover:bg-slate-700`
                    }`}
                  >
                    {filter === 'today' && 'Today'}
                    {filter === 'week' && 'Last 7 Days'}
                    {filter === 'month' && 'Last 30 Days'}
                    {filter === 'quarter' && 'Last 3 Months'}
                  </button>
                ))}
              </div>

              <div className={`border-t ${borderClass} pt-4`}>
                <p className={`text-[10px] font-black uppercase ${mutedClass} mb-2`}>Custom Range</p>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className={`w-full px-3 py-2 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} ${textClass} rounded-lg text-xs border ${borderClass}`}
                  />
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className={`w-full px-3 py-2 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} ${textClass} rounded-lg text-xs border ${borderClass}`}
                  />
                  <button
                    onClick={() => {
                      if (customDateRange.start && customDateRange.end) {
                        setDateFilter('custom');
                        setShowDatePicker(false);
                      }
                    }}
                    disabled={!customDateRange.start || !customDateRange.end}
                    className="w-full py-2.5 bg-accent-500 text-white rounded-xl text-xs font-bold uppercase disabled:opacity-50"
                  >
                    Apply Custom Range
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Stats Cards - Revenue & Profit */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {/* Total Sales Card */}
        <div
          onClick={() => navigate(`/${user?.tenantSlug}/manager/sales`)}
          className={`${surfaceClass} border ${borderClass} p-3 sm:p-5 lg:p-6 rounded-2xl sm:rounded-[28px] cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-accent-500 hover:shadow-xl group`}
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent-500" />
            <p className={`text-[8px] sm:text-[10px] font-black uppercase ${mutedClass} tracking-widest`}>Total Sales</p>
          </div>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-accent-500 truncate">{formatCurrency(dashboardData.todayRevenue)}</h3>
          <p className={`text-[9px] sm:text-[10px] ${mutedClass} mt-0.5 sm:mt-1`}>{dashboardData.todayOrders} orders</p>
        </div>

        {/* Gross Profit Card */}
        <div
          onClick={() => navigate(`/${user?.tenantSlug}/manager/sales`)}
          className={`${surfaceClass} border ${borderClass} p-3 sm:p-5 lg:p-6 rounded-2xl sm:rounded-[28px] cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-positive-500 hover:shadow-xl group`}
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-positive-500" />
            <p className={`text-[8px] sm:text-[10px] font-black uppercase ${mutedClass} tracking-widest`}>Gross Profit</p>
          </div>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-positive-500 truncate">{formatCurrency(dashboardData.todayProfit)}</h3>
          {dashboardData.todayRevenue > 0 && (
            <p className={`text-[9px] sm:text-[10px] ${mutedClass} mt-0.5 sm:mt-1`}>
              {((dashboardData.todayProfit / dashboardData.todayRevenue) * 100).toFixed(1)}% margin
            </p>
          )}
        </div>

        {/* Expenses Card */}
        <div
          onClick={() => navigate(`/${user?.tenantSlug}/manager/expenses`)}
          className={`${surfaceClass} border ${borderClass} p-3 sm:p-5 lg:p-6 rounded-2xl sm:rounded-[28px] cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-negative-500 hover:shadow-xl group`}
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-negative-500" />
            <p className={`text-[8px] sm:text-[10px] font-black uppercase ${mutedClass} tracking-widest`}>Expenses</p>
          </div>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-negative-500 truncate">-{formatCurrency(dashboardData.totalExpenses)}</h3>
          <p className={`text-[9px] sm:text-[10px] ${mutedClass} mt-0.5 sm:mt-1`}>Period expenses</p>
        </div>

        {/* Net Profit Card */}
        <div className={`${surfaceClass} border ${dashboardData.netProfit >= 0 ? 'border-emerald-500/50' : 'border-negative-500/50'} p-3 sm:p-5 lg:p-6 rounded-2xl sm:rounded-[28px]`}>
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <BarChart3 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${dashboardData.netProfit >= 0 ? 'text-emerald-500' : 'text-negative-500'}`} />
            <p className={`text-[8px] sm:text-[10px] font-black uppercase ${mutedClass} tracking-widest`}>Net Profit</p>
          </div>
          <h3 className={`text-lg sm:text-xl lg:text-2xl font-black truncate ${dashboardData.netProfit >= 0 ? 'text-emerald-500' : 'text-negative-500'}`}>
            {dashboardData.netProfit >= 0 ? '' : '-'}{formatCurrency(Math.abs(dashboardData.netProfit))}
          </h3>
          <p className={`text-[9px] sm:text-[10px] ${mutedClass} mt-0.5 sm:mt-1`}>After expenses</p>
        </div>
      </div>

      {/* Secondary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Pending Authorizations Card */}
        <div
          onClick={() => navigate(`/${user?.tenantSlug}/manager/requests`)}
          className={`${surfaceClass} border ${borderClass} p-4 sm:p-6 rounded-2xl sm:rounded-[28px] cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-negative-500 hover:shadow-xl group`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-[9px] sm:text-[10px] font-black uppercase ${mutedClass} mb-1 tracking-widest`}>Pending Authorizations</p>
              <h3 className={`text-xl sm:text-2xl font-black ${dashboardData.pendingRequests > 0 ? 'text-negative-500' : textClass}`}>
                {dashboardData.pendingRequests} Requests
              </h3>
              <p className={`text-[9px] sm:text-[10px] ${mutedClass} mt-1`}>Awaiting approval</p>
            </div>
            <ArrowRight className={`w-4 h-4 sm:w-5 sm:h-5 ${mutedClass} group-hover:text-negative-500 transition-colors`} />
          </div>
        </div>

        {/* Inventory Alerts Card */}
        <div
          onClick={() => navigate(`/${user?.tenantSlug}/manager/inventory`, { state: { filter: 'lowStock' } })}
          className={`${surfaceClass} border ${borderClass} p-4 sm:p-6 rounded-2xl sm:rounded-[28px] cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-warning-500 hover:shadow-xl group`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-[9px] sm:text-[10px] font-black uppercase ${mutedClass} mb-1 tracking-widest`}>Inventory Alerts</p>
              <h3 className={`text-xl sm:text-2xl font-black ${dashboardData.lowStockCount > 0 ? 'text-warning-500' : textClass}`}>
                {dashboardData.lowStockCount} Items Low
              </h3>
              <p className={`text-[9px] sm:text-[10px] ${mutedClass} mt-1`}>Below reorder level</p>
            </div>
            <ArrowRight className={`w-4 h-4 sm:w-5 sm:h-5 ${mutedClass} group-hover:text-warning-500 transition-colors`} />
          </div>
        </div>
      </div>

      {/* Expiry Alerts Row */}
      {(dashboardData.expiringCount > 0 || dashboardData.expiredCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Expiring Soon Alert */}
          {dashboardData.expiringCount > 0 && (
            <div
              onClick={() => navigate(`/${user?.tenantSlug}/manager/inventory`, { state: { filter: 'expiringSoon' } })}
              className={`${surfaceClass} border border-yellow-500/50 p-5 rounded-[28px] cursor-pointer hover:border-yellow-500 transition-colors`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                  <Timer className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className={`text-sm font-black uppercase ${textClass}`}>Expiring Soon</h3>
                  <p className={`text-[10px] ${mutedClass}`}>{dashboardData.expiringCount} products within 3 months</p>
                </div>
              </div>
              <div className="space-y-2">
                {dashboardData.expiringProducts.map((product) => {
                  const daysLeft = getDaysUntilExpiry(product.expiryDate);
                  return (
                    <div key={product.id} className={`flex items-center justify-between py-2 px-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-yellow-50'}`}>
                      <span className={`text-xs font-bold ${textClass}`}>{product.name}</span>
                      <span className={`text-[10px] font-bold ${daysLeft <= 30 ? 'text-negative-500' : daysLeft <= 60 ? 'text-warning-500' : 'text-yellow-600'}`}>
                        {daysLeft} days left
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Expired Products Alert */}
          {dashboardData.expiredCount > 0 && (
            <div
              onClick={() => navigate(`/${user?.tenantSlug}/manager/inventory`, { state: { filter: 'expired' } })}
              className={`${surfaceClass} border border-negative-500/50 p-5 rounded-[28px] cursor-pointer hover:border-negative-500 transition-colors`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-negative-100 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-negative-600" />
                </div>
                <div>
                  <h3 className={`text-sm font-black uppercase ${textClass}`}>Expired Products</h3>
                  <p className={`text-[10px] ${mutedClass}`}>{dashboardData.expiredCount} products need attention</p>
                </div>
              </div>
              <div className="space-y-2">
                {dashboardData.expiredProducts.map((product) => (
                  <div key={product.id} className={`flex items-center justify-between py-2 px-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-negative-50'}`}>
                    <span className={`text-xs font-bold ${textClass}`}>{product.name}</span>
                    <span className="text-[10px] font-bold text-negative-500">
                      Expired {new Date(product.expiryDate).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analytics Grid */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Performing Products */}
        <div className={`${surfaceClass} border ${borderClass} rounded-2xl sm:rounded-[28px] p-4 sm:p-6 shadow-sm`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-positive-500" />
              <h2 className={`text-sm font-black uppercase tracking-tight ${textClass}`}>Top Products</h2>
            </div>
            <span className={`text-[10px] font-bold uppercase ${mutedClass}`}>{getFilterLabel()}</span>
          </div>
          <div className="space-y-3">
            {dashboardData.topProducts.length === 0 ? (
              <div className={`text-center py-10 ${mutedClass}`}>
                <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-xs font-bold uppercase">No sales data</p>
              </div>
            ) : (
              dashboardData.topProducts.map((product, index) => (
                <div key={product.id} className={`flex items-center gap-4 py-3 border-b ${borderClass} last:border-0`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-gray-100 text-gray-700' :
                    index === 2 ? 'bg-warning-100 text-warning-700' :
                    darkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-50 text-gray-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs font-bold ${textClass}`}>{product.name}</p>
                    <p className={`text-[10px] ${mutedClass}`}>{product.quantity} sold</p>
                  </div>
                  <p className="text-sm font-black text-positive-500">{formatCurrency(product.revenue)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Least Performing Products */}
        <div className={`${surfaceClass} border ${borderClass} rounded-2xl sm:rounded-[28px] p-4 sm:p-6 shadow-sm`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-negative-500" />
              <h2 className={`text-sm font-black uppercase tracking-tight ${textClass}`}>Slow Moving</h2>
            </div>
            <span className={`text-[10px] font-bold uppercase ${mutedClass}`}>{getFilterLabel()}</span>
          </div>
          <div className="space-y-3">
            {dashboardData.leastProducts.length === 0 ? (
              <div className={`text-center py-10 ${mutedClass}`}>
                <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-xs font-bold uppercase">No sales data</p>
              </div>
            ) : (
              dashboardData.leastProducts.map((product, index) => (
                <div key={product.id} className={`flex items-center gap-4 py-3 border-b ${borderClass} last:border-0`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${darkMode ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>
                    {dashboardData.topProducts.length - dashboardData.leastProducts.length + index + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs font-bold ${textClass}`}>{product.name}</p>
                    <p className={`text-[10px] ${mutedClass}`}>{product.quantity} sold</p>
                  </div>
                  <p className={`text-sm font-black ${mutedClass}`}>{formatCurrency(product.revenue)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Second Row Analytics */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Performing Days */}
        <div className={`${surfaceClass} border ${borderClass} rounded-2xl sm:rounded-[28px] p-4 sm:p-6 shadow-sm`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent-500" />
              <h2 className={`text-sm font-black uppercase tracking-tight ${textClass}`}>Best Days</h2>
            </div>
            <span className={`text-[10px] font-bold uppercase ${mutedClass}`}>{getFilterLabel()}</span>
          </div>
          <div className="space-y-3">
            {dashboardData.topDays.length === 0 ? (
              <div className={`text-center py-10 ${mutedClass}`}>
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-xs font-bold uppercase">No sales data</p>
              </div>
            ) : (
              dashboardData.topDays.map((day, index) => (
                <div key={day.day} className={`flex items-center gap-4 py-3 border-b ${borderClass} last:border-0`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                    index === 0 ? 'bg-accent-100 text-accent-700' :
                    darkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-50 text-gray-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs font-bold ${textClass}`}>{day.day}</p>
                    <p className={`text-[10px] ${mutedClass}`}>{day.orders} orders</p>
                  </div>
                  <p className="text-sm font-black text-accent-500">{formatCurrency(day.revenue)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Staff Performance */}
        <div className={`${surfaceClass} border ${borderClass} rounded-2xl sm:rounded-[28px] p-4 sm:p-6 shadow-sm`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-500" />
              <h2 className={`text-sm font-black uppercase tracking-tight ${textClass}`}>Staff Performance</h2>
            </div>
            <span className={`text-[10px] font-bold uppercase ${mutedClass}`}>{getFilterLabel()}</span>
          </div>
          <div className="space-y-3">
            {dashboardData.staffStats.length === 0 ? (
              <div className={`text-center py-10 ${mutedClass}`}>
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-xs font-bold uppercase">No sales data</p>
              </div>
            ) : (
              dashboardData.staffStats.slice(0, 5).map((staff, index) => (
                <div key={staff.id} className={`flex items-center gap-4 py-3 border-b ${borderClass} last:border-0`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                    index === 0 ? 'bg-purple-100 text-purple-700' :
                    index === 1 ? 'bg-gray-100 text-gray-700' :
                    index === 2 ? 'bg-warning-100 text-warning-700' :
                    darkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-50 text-gray-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs font-bold ${textClass}`}>{staff.name}</p>
                    <p className={`text-[10px] ${mutedClass}`}>
                      {staff.transactions} sales • {staff.customers} customers
                    </p>
                  </div>
                  <p className="text-sm font-black text-purple-500">{formatCurrency(staff.totalSales)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Attendant Performance - Only for SERVICES/SALON businesses */}
      {isServicesType && attendantPerformance.performance && attendantPerformance.performance.length > 0 && (
        <div className={`${surfaceClass} border ${borderClass} rounded-2xl sm:rounded-[28px] p-4 sm:p-6 shadow-sm`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <UserCog className="w-4 h-4 text-pink-500" />
              <h2 className={`text-sm font-black uppercase tracking-tight ${textClass}`}>Attendant Performance</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className={`text-[9px] ${mutedClass} uppercase`}>Commission</p>
                <p className="text-sm font-bold text-green-500">{formatCurrency(attendantPerformance.totals?.totalCommission || 0)}</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {attendantPerformance.performance.slice(0, 5).map((item, index) => (
              <div key={item.attendant?.id || index} className={`flex items-center gap-4 py-3 border-b ${borderClass} last:border-0`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                  index === 0 ? 'bg-pink-100 text-pink-700' :
                  index === 1 ? 'bg-gray-100 text-gray-700' :
                  index === 2 ? 'bg-warning-100 text-warning-700' :
                  darkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-50 text-gray-500'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className={`text-xs font-bold ${textClass}`}>{item.attendant?.fullName || 'Unknown'}</p>
                  <p className={`text-[10px] ${mutedClass}`}>
                    {item.serviceCount} services • {item.attendant?.commissionRate || 0}% rate
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-pink-500">{formatCurrency(item.totalSales)}</p>
                  <p className={`text-[10px] ${mutedClass}`}>Earned: {formatCurrency(item.commission)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className={`${surfaceClass} border ${borderClass} rounded-2xl sm:rounded-[28px] p-4 sm:p-6 shadow-sm`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-sm font-black uppercase tracking-tight ${textClass}`}>Recent Transactions</h2>
          <Link to={`/${user?.tenantSlug}/manager/sales`} className="text-xs font-bold text-accent-500 flex items-center gap-1 hover:underline">
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-3">
          {dashboardData.recentSales.length === 0 ? (
            <div className={`text-center py-10 ${mutedClass}`}>
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-xs font-bold uppercase">No sales yet</p>
            </div>
          ) : (
            dashboardData.recentSales.map((sale) => (
              <div key={sale.id} className={`flex items-center justify-between py-3 border-b ${borderClass} last:border-0`}>
                <div>
                  <p className={`text-xs font-bold ${textClass}`}>#{sale.transactionNumber?.slice(-8)}</p>
                  <p className={`text-[10px] ${mutedClass} flex items-center gap-1`}>
                    <Clock className="w-3 h-3" />
                    {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {sale.customer && <span className="ml-2">• {sale.customer.name}</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-black text-accent-500`}>{formatCurrency(sale.finalAmount)}</p>
                  <p className={`text-[9px] ${mutedClass} capitalize`}>{sale.paymentMethod?.toLowerCase().replace('_', ' ')}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Click outside to close date picker */}
      {showDatePicker && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDatePicker(false)}
        />
      )}
    </div>
  );
};

export default ManagerDashboard;
