import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ownerAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import DateRangePicker from '../../components/DateRangePicker';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Users,
  Building2,
  AlertTriangle,
  Package,
  Clock,
  Award,
  BarChart3,
  ShieldAlert,
  ChevronRight,
  ChevronDown,
  X
} from 'lucide-react';

const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

const Dashboard = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, currentBranch, isAllBranches, branches = [] }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  // Branch filter for drilling down when in "All Branches" mode
  const [branchFilter, setBranchFilter] = useState(null);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  // Get the effective branchId for API calls
  const getEffectiveBranchId = () => {
    if (!isAllBranches && currentBranch) {
      return currentBranch.id;
    }
    if (isAllBranches && branchFilter) {
      return branchFilter.id;
    }
    return null;
  };

  // Reset branch filter when switching away from "All Branches" mode
  useEffect(() => {
    if (!isAllBranches) {
      setBranchFilter(null);
    }
  }, [isAllBranches]);

  useEffect(() => {
    loadData();
  }, [dateRange, currentBranch, isAllBranches, branchFilter]);

  // Auto-refresh every 30 seconds when page is visible
  useEffect(() => {
    const refreshData = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };

    const intervalId = setInterval(refreshData, AUTO_REFRESH_INTERVAL);

    // Handle visibility change - refresh when coming back to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [dateRange, currentBranch, isAllBranches, branchFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};

      // Set date range from picker
      const startOfDay = new Date(dateRange.startDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateRange.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      params.startDate = startOfDay.toISOString();
      params.endDate = endOfDay.toISOString();

      const effectiveBranchId = getEffectiveBranchId();
      if (effectiveBranchId) {
        params.branchId = effectiveBranchId;
      }

      const response = await ownerAPI.getDashboard(params);
      setData(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const alerts = data?.alerts || {};
  const branchPerformance = data?.branchPerformance || [];
  const staffLeaderboard = data?.staffLeaderboard || [];
  const hourlyTrend = data?.hourlyTrend || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-xl sm:text-2xl font-black uppercase tracking-tight ${textClass}`}>Command Center</h1>
          <div className="flex items-center gap-2 mt-1">
            <Building2 className={`w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            <p className={`text-sm ${mutedClass}`}>
              {isAllBranches ? 'All Branches' : currentBranch?.name || 'Select a branch'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Filter Chip - Only show when filter is active in All Branches mode */}
          {isAllBranches && branchFilter && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-bold">
              <span>Filtered: {branchFilter.name}</span>
              <button
                onClick={() => setBranchFilter(null)}
                className="hover:bg-slate-700 dark:hover:bg-slate-600 rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Branch Filter Dropdown - Only show in All Branches mode */}
          {isAllBranches && (
            <div className="relative">
              <button
                onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm font-medium hover:border-slate-400 transition-colors`}
              >
                <Building2 className="w-4 h-4" />
                <span>{branchFilter ? branchFilter.name : 'All Branches'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showBranchDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showBranchDropdown && (
                <div className={`absolute right-0 mt-2 w-56 ${surfaceClass} border ${borderClass} rounded-xl shadow-xl z-50 overflow-hidden`}>
                  <button
                    onClick={() => {
                      setBranchFilter(null);
                      setShowBranchDropdown(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 ${textClass} ${!branchFilter ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                  >
                    All Branches
                  </button>
                  {branches.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => {
                        setBranchFilter(branch);
                        setShowBranchDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 ${textClass} ${branchFilter?.id === branch.id ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                    >
                      {branch.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <DateRangePicker
            dateRange={dateRange}
            onDateChange={setDateRange}
            darkMode={darkMode}
            surfaceClass={surfaceClass}
            textClass={textClass}
            mutedClass={mutedClass}
            borderClass={borderClass}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className={`${surfaceClass} rounded-2xl p-4 sm:p-6 border ${borderClass}`}>
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] sm:text-xs font-bold uppercase ${mutedClass}`}>Total Revenue</p>
              <p className={`text-lg sm:text-2xl font-black ${textClass} truncate`}>{formatCurrency(stats.totalRevenue || 0)}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0 ml-2">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
          </div>
          <p className={`text-[10px] sm:text-xs ${mutedClass} mt-2`}>{stats.transactionCount || 0} transactions</p>
        </div>

        <div className={`${surfaceClass} rounded-2xl p-4 sm:p-6 border ${borderClass}`}>
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] sm:text-xs font-bold uppercase ${mutedClass}`}>Gross Profit</p>
              <p className={`text-lg sm:text-2xl font-black ${textClass} truncate`}>{formatCurrency(stats.grossProfit || 0)}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 ml-2">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
          </div>
          <p className={`text-[10px] sm:text-xs ${mutedClass} mt-2 hidden sm:block`}>COGS: {formatCurrency(stats.cogs || 0)}</p>
        </div>

        <div className={`${surfaceClass} rounded-2xl p-4 sm:p-6 border ${borderClass}`}>
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] sm:text-xs font-bold uppercase ${mutedClass}`}>Expenses</p>
              <p className={`text-lg sm:text-2xl font-black ${textClass} truncate`}>{formatCurrency(stats.totalExpenses || 0)}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 ml-2">
              <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className={`${surfaceClass} rounded-2xl p-4 sm:p-6 border ${borderClass}`}>
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] sm:text-xs font-bold uppercase ${mutedClass}`}>Net Profit</p>
              <p className={`text-lg sm:text-2xl font-black truncate ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(stats.netProfit || 0)}
              </p>
            </div>
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${stats.netProfit >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'} flex items-center justify-center shrink-0 ml-2`}>
              <Receipt className={`w-5 h-5 sm:w-6 sm:h-6 ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {(() => {
        const totalVoidAlerts = (alerts.pendingRequests || 0) + (alerts.suspiciousVoids?.length || 0);
        const hasAlerts = totalVoidAlerts > 0 ||
          alerts.lowStockCount > 0 ||
          alerts.outOfStockCount > 0 ||
          alerts.expiringSoonCount > 0 ||
          alerts.expiredCount > 0;

        if (!hasAlerts) return null;

        return (
          <div className={`${surfaceClass} rounded-2xl p-4 sm:p-6 border ${borderClass}`}>
            <h2 className={`text-xs sm:text-sm font-black uppercase ${textClass} mb-3 sm:mb-4 flex items-center gap-2`}>
              <AlertTriangle className={`w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              Alerts & Notifications
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {/* Combined Void Requests Alert - Clickable */}
              {totalVoidAlerts > 0 && (
                <div
                  onClick={() => navigate(`/${user?.tenantSlug}/owner/requests`)}
                  className="flex items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors group"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className={`text-xs sm:text-sm font-bold ${textClass}`}>
                        {totalVoidAlerts} Void Request{totalVoidAlerts !== 1 ? 's' : ''}
                      </p>
                      <p className={`text-[10px] sm:text-xs ${mutedClass} truncate`}>
                        {alerts.pendingRequests > 0 && `${alerts.pendingRequests} pending`}
                        {alerts.pendingRequests > 0 && alerts.suspiciousVoids?.length > 0 && ', '}
                        {alerts.suspiciousVoids?.length > 0 && `${alerts.suspiciousVoids.length} high-value`}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 ${mutedClass} group-hover:translate-x-1 transition-transform shrink-0`} />
                </div>
              )}

              {/* Low Stock Alert - Clickable to Inventory with filter */}
              {alerts.lowStockCount > 0 && (
                <div
                  onClick={() => navigate(`/${user?.tenantSlug}/owner/inventory`, { state: { filter: 'lowStock' } })}
                  className="flex items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors group"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Package className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 shrink-0" />
                    <div className="min-w-0">
                      <p className={`text-xs sm:text-sm font-bold ${textClass}`}>{alerts.lowStockCount} Low Stock</p>
                      <p className={`text-[10px] sm:text-xs ${mutedClass}`}>Below threshold</p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 ${mutedClass} group-hover:translate-x-1 transition-transform shrink-0`} />
                </div>
              )}

              {/* Out of Stock Alert - Clickable to Inventory with filter */}
              {alerts.outOfStockCount > 0 && (
                <div
                  onClick={() => navigate(`/${user?.tenantSlug}/owner/inventory`, { state: { filter: 'outOfStock' } })}
                  className="flex items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 rounded-xl cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors group"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Package className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 shrink-0" />
                    <div className="min-w-0">
                      <p className={`text-xs sm:text-sm font-bold ${textClass}`}>{alerts.outOfStockCount} Out of Stock</p>
                      <p className={`text-[10px] sm:text-xs ${mutedClass}`}>No inventory</p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 ${mutedClass} group-hover:translate-x-1 transition-transform shrink-0`} />
                </div>
              )}

              {/* Expiring Soon Alert - Clickable to Inventory with filter */}
              {alerts.expiringSoonCount > 0 && (
                <div
                  onClick={() => navigate(`/${user?.tenantSlug}/owner/inventory`, { state: { filter: 'expiringSoon' } })}
                  className="flex items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors group"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 shrink-0" />
                    <div className="min-w-0">
                      <p className={`text-xs sm:text-sm font-bold ${textClass}`}>{alerts.expiringSoonCount} Expiring Soon</p>
                      <p className={`text-[10px] sm:text-xs ${mutedClass}`}>Within 90 days</p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 ${mutedClass} group-hover:translate-x-1 transition-transform shrink-0`} />
                </div>
              )}

              {/* Expired Alert - Clickable to Inventory with filter */}
              {alerts.expiredCount > 0 && (
                <div
                  onClick={() => navigate(`/${user?.tenantSlug}/owner/inventory`, { state: { filter: 'expired' } })}
                  className="flex items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 bg-red-100 dark:bg-red-900/30 rounded-xl cursor-pointer hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors group"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-700 shrink-0" />
                    <div className="min-w-0">
                      <p className={`text-xs sm:text-sm font-bold ${textClass}`}>{alerts.expiredCount} Expired</p>
                      <p className={`text-[10px] sm:text-xs ${mutedClass}`}>Need removal</p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 ${mutedClass} group-hover:translate-x-1 transition-transform shrink-0`} />
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Branch Performance */}
        <div className={`${surfaceClass} rounded-2xl p-4 sm:p-6 border ${borderClass}`}>
          <h2 className={`text-xs sm:text-sm font-black uppercase ${textClass} mb-3 sm:mb-4 flex items-center gap-2`}>
            <Building2 className="w-4 h-4" />
            Branch Performance
          </h2>
          {branchPerformance.length > 0 ? (
            <div className="space-y-3">
              {branchPerformance.map((branch, index) => {
                const maxRevenue = Math.max(...branchPerformance.map(b => b.revenue), 1);
                const percentage = maxRevenue > 0 ? (branch.revenue / maxRevenue) * 100 : 0;
                const hasRevenue = branch.revenue > 0;
                return (
                  <div key={branch.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${textClass}`}>{branch.name}</span>
                        {branch.isMain && (
                          <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-bold uppercase rounded-full">
                            Main
                          </span>
                        )}
                      </div>
                      <span className={`text-sm font-bold ${hasRevenue ? 'text-green-600' : mutedClass}`}>
                        {formatCurrency(branch.revenue)}
                      </span>
                    </div>
                    <div className={`h-2.5 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          hasRevenue
                            ? 'bg-gradient-to-r from-green-500 to-green-600'
                            : (darkMode ? 'bg-slate-600' : 'bg-slate-300')
                        }`}
                        style={{ width: hasRevenue ? `${Math.max(percentage, 5)}%` : '5%' }}
                      />
                    </div>
                    <p className={`text-xs ${mutedClass}`}>
                      {branch.transactions} transaction{branch.transactions !== 1 ? 's' : ''}
                      {!hasRevenue && ' this period'}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Building2 className={`w-10 h-10 mx-auto ${mutedClass} opacity-30 mb-2`} />
              <p className={`text-sm ${mutedClass}`}>No branch data available</p>
              <p className={`text-xs ${mutedClass}`}>Branches will appear here once created</p>
            </div>
          )}
        </div>

        {/* Staff Leaderboard */}
        <div className={`${surfaceClass} rounded-2xl p-4 sm:p-6 border ${borderClass}`}>
          <h2 className={`text-xs sm:text-sm font-black uppercase ${textClass} mb-3 sm:mb-4 flex items-center gap-2`}>
            <Award className="w-4 h-4" />
            Staff Leaderboard
          </h2>
          {staffLeaderboard.length > 0 ? (
            <div className="space-y-3">
              {staffLeaderboard.map((staff, index) => (
                <div key={staff.id} className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 ? 'bg-green-100 text-green-600 dark:bg-green-900/30' :
                    index === 1 ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' :
                    index === 2 ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30' :
                    'bg-slate-100 text-slate-600 dark:bg-slate-700'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${textClass}`}>{staff.name}</p>
                    <p className={`text-xs ${mutedClass}`}>{staff.role} - {staff.transactionCount} sales</p>
                  </div>
                  <p className={`text-sm font-bold ${textClass}`}>{formatCurrency(staff.totalSales)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-sm ${mutedClass}`}>No sales data available</p>
          )}
        </div>
      </div>

      {/* Hourly Sales Trend */}
      <div className={`${surfaceClass} rounded-2xl p-4 sm:p-6 border ${borderClass}`}>
        <h2 className={`text-xs sm:text-sm font-black uppercase ${textClass} mb-3 sm:mb-4 flex items-center gap-2`}>
          <BarChart3 className="w-4 h-4" />
          Today's Hourly Sales
        </h2>
        {(() => {
          const totalHourlySales = hourlyTrend.reduce((sum, h) => sum + (h.sales || 0), 0);
          const maxSales = Math.max(...hourlyTrend.map(h => h.sales), 1);

          if (totalHourlySales === 0) {
            return (
              <div className="h-40 flex flex-col items-center justify-center">
                <BarChart3 className={`w-10 h-10 ${mutedClass} opacity-30 mb-2`} />
                <p className={`text-sm ${mutedClass}`}>No sales recorded today yet</p>
                <p className={`text-xs ${mutedClass}`}>Sales will appear here as they happen</p>
              </div>
            );
          }

          return (
            <div className="h-40 flex items-end gap-1">
              {hourlyTrend.slice(6, 22).map((hour) => {
                const height = (hour.sales / maxSales) * 100;
                const hasSales = hour.sales > 0;
                return (
                  <div key={hour.hour} className="flex-1 flex flex-col items-center gap-1">
                    {hasSales && (
                      <span className={`text-[9px] font-bold ${textClass}`}>
                        {formatCurrency(hour.sales)}
                      </span>
                    )}
                    <div className="w-full flex-1 flex items-end justify-center">
                      <div
                        className={`w-full rounded-t transition-all duration-300 ${
                          hasSales
                            ? (darkMode ? 'bg-green-500' : 'bg-green-600')
                            : (darkMode ? 'bg-slate-700' : 'bg-slate-200')
                        }`}
                        style={{ height: hasSales ? `${Math.max(height, 10)}%` : '8px' }}
                        title={`${hour.hour}:00 - ${formatCurrency(hour.sales)}`}
                      />
                    </div>
                    <span className={`text-[10px] ${mutedClass}`}>{hour.hour}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className={`${surfaceClass} rounded-2xl p-3 sm:p-4 border ${borderClass} text-center`}>
          <Users className={`w-5 h-5 sm:w-6 sm:h-6 mx-auto ${mutedClass}`} />
          <p className={`text-xl sm:text-2xl font-black ${textClass} mt-1 sm:mt-2`}>{stats.staffCount || 0}</p>
          <p className={`text-[10px] sm:text-xs ${mutedClass}`}>Total Staff</p>
        </div>
        <div className={`${surfaceClass} rounded-2xl p-3 sm:p-4 border ${borderClass} text-center`}>
          <Building2 className={`w-5 h-5 sm:w-6 sm:h-6 mx-auto ${mutedClass}`} />
          <p className={`text-xl sm:text-2xl font-black ${textClass} mt-1 sm:mt-2`}>{stats.branchCount || 0}</p>
          <p className={`text-[10px] sm:text-xs ${mutedClass}`}>Branches</p>
        </div>
        <div className={`${surfaceClass} rounded-2xl p-3 sm:p-4 border ${borderClass} text-center`}>
          <Receipt className={`w-5 h-5 sm:w-6 sm:h-6 mx-auto ${mutedClass}`} />
          <p className={`text-xl sm:text-2xl font-black ${textClass} mt-1 sm:mt-2`}>{stats.transactionCount || 0}</p>
          <p className={`text-[10px] sm:text-xs ${mutedClass}`}>Transactions</p>
        </div>
        <div className={`${surfaceClass} rounded-2xl p-3 sm:p-4 border ${borderClass} text-center`}>
          <TrendingUp className={`w-5 h-5 sm:w-6 sm:h-6 mx-auto ${mutedClass}`} />
          <p className={`text-lg sm:text-2xl font-black ${textClass} mt-1 sm:mt-2 truncate`}>
            {stats.transactionCount > 0 ? formatCurrency(stats.totalRevenue / stats.transactionCount) : formatCurrency(0)}
          </p>
          <p className={`text-[10px] sm:text-xs ${mutedClass}`}>Avg Transaction</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
