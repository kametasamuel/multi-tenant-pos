import React, { useState, useEffect } from 'react';
import { ownerAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Users,
  Building2,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  X
} from 'lucide-react';

const Reports = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, currentBranch, isAllBranches, branches = [] }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pl');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  // Branch filter for drilling down when in "All Branches" mode
  const [branchFilter, setBranchFilter] = useState(null);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  // Report data
  const [plData, setPlData] = useState(null);
  const [branchComparison, setBranchComparison] = useState([]);
  const [productProfitability, setProductProfitability] = useState(null);
  const [staffPerformance, setStaffPerformance] = useState([]);

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
    // Set default date range to current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setDateRange({
      startDate: firstDay.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0]
    });
  }, []);

  useEffect(() => {
    if (dateRange.startDate && dateRange.endDate) {
      loadReportData();
    }
  }, [activeTab, dateRange, currentBranch, isAllBranches, branchFilter]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      // Create proper date range with time components
      const startOfDay = new Date(dateRange.startDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateRange.endDate);
      endOfDay.setHours(23, 59, 59, 999);

      const params = {
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString()
      };

      const effectiveBranchId = getEffectiveBranchId();
      if (effectiveBranchId) {
        params.branchId = effectiveBranchId;
      }

      switch (activeTab) {
        case 'pl':
          const plRes = await ownerAPI.getPLReport(params);
          setPlData(plRes.data);
          break;
        case 'branches':
          const branchRes = await ownerAPI.getBranchComparison(params);
          setBranchComparison(branchRes.data.branches || []);
          break;
        case 'products':
          const prodRes = await ownerAPI.getProductProfitability(params);
          setProductProfitability(prodRes.data);
          break;
        case 'staff':
          const staffRes = await ownerAPI.getStaffPerformance(params);
          setStaffPerformance(staffRes.data.staff || []);
          break;
      }
    } catch (error) {
      console.error('Failed to load report data:', error);
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

  const formatPercent = (value) => {
    return `${value.toFixed(1)}%`;
  };

  const tabs = [
    { id: 'pl', label: 'Profit & Loss', icon: DollarSign },
    { id: 'branches', label: 'Branch Comparison', icon: Building2 },
    { id: 'products', label: 'Product Profitability', icon: Package },
    { id: 'staff', label: 'Staff Performance', icon: Users }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black uppercase tracking-tight ${textClass}`}>Reports</h1>
          <div className="flex items-center gap-2 mt-1">
            <Building2 className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <p className={`text-sm ${mutedClass}`}>
              {isAllBranches ? 'All Branches' : currentBranch?.name || 'Select a branch'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm font-medium hover:border-slate-400 transition-colors`}
              >
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">{branchFilter ? branchFilter.name : 'All'}</span>
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

          <button
            onClick={loadReportData}
            className={`flex items-center gap-2 px-4 py-2.5 border ${borderClass} ${textClass} rounded-xl font-bold text-sm uppercase hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Date Filters */}
      <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Start Date</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className={`px-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            />
          </div>
          <div>
            <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>End Date</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className={`px-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={`${surfaceClass} rounded-2xl border ${borderClass}`}>
        <div className={`flex overflow-x-auto border-b ${borderClass}`}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-bold uppercase whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-slate-700 dark:text-slate-300 border-b-2 border-slate-700 dark:border-slate-300'
                    : mutedClass
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700 dark:border-slate-300"></div>
            </div>
          ) : (
            <>
              {/* P&L Statement */}
              {activeTab === 'pl' && plData && (
                <div className="space-y-6">
                  {/* Main P&L Card - Clean Flow */}
                  <div className={`rounded-2xl border-2 ${borderClass} overflow-hidden`}>
                    <div className={`px-6 py-4 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                      <h3 className={`text-sm font-black uppercase ${textClass}`}>Profit & Loss Statement</h3>
                      <p className={`text-xs ${mutedClass}`}>{plData.summary?.transactionCount || 0} transactions in this period</p>
                    </div>

                    {/* Revenue Section */}
                    <div className={`px-6 py-5 border-b ${borderClass}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                          <span className={`text-sm font-bold ${textClass}`}>Total Revenue</span>
                        </div>
                        <span className="text-xl font-black text-green-600">{formatCurrency(plData.summary?.totalRevenue || 0)}</span>
                      </div>
                    </div>

                    {/* COGS Deduction */}
                    <div className={`px-6 py-3 ${darkMode ? 'bg-slate-800/50' : 'bg-gray-50'} border-b ${borderClass}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-red-500 font-bold">−</span>
                          <span className={`text-sm ${mutedClass}`}>Cost of Goods Sold (COGS)</span>
                        </div>
                        <span className="text-sm font-medium text-red-500">{formatCurrency(plData.summary?.cogs || 0)}</span>
                      </div>
                    </div>

                    {/* Gross Profit */}
                    <div className={`px-6 py-4 border-b ${borderClass}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-blue-500 font-bold">=</span>
                          <span className={`text-sm font-bold ${textClass}`}>Gross Profit</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                            {formatPercent(plData.summary?.grossMargin || 0)} margin
                          </span>
                        </div>
                        <span className="text-lg font-black text-blue-600">{formatCurrency(plData.summary?.grossProfit || 0)}</span>
                      </div>
                    </div>

                    {/* Expenses Deduction */}
                    <div className={`px-6 py-3 ${darkMode ? 'bg-slate-800/50' : 'bg-gray-50'} border-b ${borderClass}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-red-500 font-bold">−</span>
                          <span className={`text-sm ${mutedClass}`}>Operating Expenses</span>
                        </div>
                        <span className="text-sm font-medium text-red-500">{formatCurrency(plData.summary?.totalExpenses || 0)}</span>
                      </div>
                    </div>

                    {/* Net Profit - Highlighted */}
                    <div className={`px-6 py-5 ${plData.summary?.netProfit >= 0 ? (darkMode ? 'bg-green-900/20' : 'bg-green-50') : (darkMode ? 'bg-red-900/20' : 'bg-red-50')}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${plData.summary?.netProfit >= 0 ? 'bg-green-500' : 'bg-red-500'}`}>
                            <span className="text-white text-xs font-bold">=</span>
                          </div>
                          <span className={`text-sm font-black uppercase ${textClass}`}>Net Profit</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            plData.summary?.netProfit >= 0
                              ? (darkMode ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-700')
                              : (darkMode ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-700')
                          }`}>
                            {formatPercent(plData.summary?.netMargin || 0)} margin
                          </span>
                        </div>
                        <span className={`text-2xl font-black ${plData.summary?.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(plData.summary?.netProfit || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Cards Row */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className={`${surfaceClass} p-4 rounded-xl border ${borderClass}`}>
                      <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Revenue</p>
                      <p className="text-lg font-black text-green-600">{formatCurrency(plData.summary?.totalRevenue || 0)}</p>
                    </div>
                    <div className={`${surfaceClass} p-4 rounded-xl border ${borderClass}`}>
                      <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>COGS</p>
                      <p className="text-lg font-black text-red-500">{formatCurrency(plData.summary?.cogs || 0)}</p>
                    </div>
                    <div className={`${surfaceClass} p-4 rounded-xl border ${borderClass}`}>
                      <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Expenses</p>
                      <p className="text-lg font-black text-red-500">{formatCurrency(plData.summary?.totalExpenses || 0)}</p>
                    </div>
                    <div className={`${surfaceClass} p-4 rounded-xl border ${borderClass}`}>
                      <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Net Profit</p>
                      <p className={`text-lg font-black ${plData.summary?.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(plData.summary?.netProfit || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Expenses by Category */}
                  {plData.expensesByCategory && plData.expensesByCategory.length > 0 && (
                    <div className={`rounded-xl border ${borderClass}`}>
                      <div className={`px-6 py-4 ${darkMode ? 'bg-slate-700' : 'bg-gray-50'} flex items-center justify-between`}>
                        <h3 className={`text-sm font-black uppercase ${textClass}`}>Expense Breakdown</h3>
                        <span className={`text-sm font-bold text-red-500`}>
                          Total: {formatCurrency(plData.summary?.totalExpenses || 0)}
                        </span>
                      </div>
                      <div className="p-6 space-y-4">
                        {plData.expensesByCategory.map((expense, index) => {
                          const totalExpenses = plData.summary?.totalExpenses || 1;
                          const percentage = (expense.amount / totalExpenses) * 100;
                          const maxAmount = Math.max(...plData.expensesByCategory.map(e => e.amount));
                          const barWidth = (expense.amount / maxAmount) * 100;
                          return (
                            <div key={index}>
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-medium ${textClass}`}>{expense.category}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-gray-100'} ${mutedClass}`}>
                                    {percentage.toFixed(1)}%
                                  </span>
                                </div>
                                <span className={`text-sm font-bold text-red-500`}>{formatCurrency(expense.amount)}</span>
                              </div>
                              <div className={`h-2.5 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-500"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* No Expenses Message */}
                  {(!plData.expensesByCategory || plData.expensesByCategory.length === 0) && (
                    <div className={`${surfaceClass} rounded-xl border ${borderClass} p-8 text-center`}>
                      <p className={`text-sm ${mutedClass}`}>No expenses recorded in this period</p>
                    </div>
                  )}
                </div>
              )}

              {/* Branch Comparison */}
              {activeTab === 'branches' && (
                <div className="space-y-6">
                  {branchComparison.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className={`${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
                          <tr>
                            <th className={`px-4 py-3 text-left text-xs font-black uppercase ${mutedClass}`}>Branch</th>
                            <th className={`px-4 py-3 text-right text-xs font-black uppercase ${mutedClass}`}>Revenue</th>
                            <th className={`px-4 py-3 text-right text-xs font-black uppercase ${mutedClass}`}>COGS</th>
                            <th className={`px-4 py-3 text-right text-xs font-black uppercase ${mutedClass}`}>Gross Profit</th>
                            <th className={`px-4 py-3 text-right text-xs font-black uppercase ${mutedClass}`}>Margin</th>
                            <th className={`px-4 py-3 text-right text-xs font-black uppercase ${mutedClass}`}>Transactions</th>
                            <th className={`px-4 py-3 text-right text-xs font-black uppercase ${mutedClass}`}>Avg Sale</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                          {branchComparison.map(branch => (
                            <tr key={branch.id}>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold ${textClass}`}>{branch.name}</span>
                                  {branch.isMain && (
                                    <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-bold uppercase rounded-full">
                                      Main
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className={`px-4 py-4 text-right font-medium ${textClass}`}>{formatCurrency(branch.revenue)}</td>
                              <td className={`px-4 py-4 text-right ${mutedClass}`}>{formatCurrency(branch.cogs)}</td>
                              <td className={`px-4 py-4 text-right font-bold ${branch.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(branch.grossProfit)}
                              </td>
                              <td className={`px-4 py-4 text-right ${mutedClass}`}>{formatPercent(branch.grossMargin)}</td>
                              <td className={`px-4 py-4 text-right ${mutedClass}`}>{branch.transactionCount}</td>
                              <td className={`px-4 py-4 text-right ${mutedClass}`}>{formatCurrency(branch.avgTransactionValue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Building2 className={`w-12 h-12 mx-auto ${mutedClass} mb-4`} />
                      <p className={`text-sm ${mutedClass}`}>No branch data available</p>
                    </div>
                  )}
                </div>
              )}

              {/* Product Profitability */}
              {activeTab === 'products' && productProfitability && (
                <div className="space-y-6">
                  {productProfitability.products && productProfitability.products.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className={`${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
                          <tr>
                            <th className={`px-4 py-3 text-left text-xs font-black uppercase ${mutedClass}`}>Product</th>
                            <th className={`px-4 py-3 text-right text-xs font-black uppercase ${mutedClass}`}>Qty Sold</th>
                            <th className={`px-4 py-3 text-right text-xs font-black uppercase ${mutedClass}`}>Revenue</th>
                            <th className={`px-4 py-3 text-right text-xs font-black uppercase ${mutedClass}`}>Cost</th>
                            <th className={`px-4 py-3 text-right text-xs font-black uppercase ${mutedClass}`}>Profit</th>
                            <th className={`px-4 py-3 text-right text-xs font-black uppercase ${mutedClass}`}>Margin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                          {productProfitability.products.map(product => (
                            <tr key={product.id}>
                              <td className="px-4 py-4">
                                <span className={`font-medium ${textClass}`}>{product.name}</span>
                              </td>
                              <td className={`px-4 py-4 text-right ${mutedClass}`}>{product.totalQuantity}</td>
                              <td className={`px-4 py-4 text-right font-medium ${textClass}`}>{formatCurrency(product.totalRevenue)}</td>
                              <td className={`px-4 py-4 text-right ${mutedClass}`}>{formatCurrency(product.totalCost)}</td>
                              <td className={`px-4 py-4 text-right font-bold ${product.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(product.grossProfit)}
                              </td>
                              <td className={`px-4 py-4 text-right ${mutedClass}`}>{formatPercent(product.grossMargin)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Package className={`w-12 h-12 mx-auto ${mutedClass} mb-4`} />
                      <p className={`text-sm ${mutedClass}`}>No product data available</p>
                    </div>
                  )}
                </div>
              )}

              {/* Staff Performance */}
              {activeTab === 'staff' && (
                <div className="space-y-6">
                  {staffPerformance.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className={`${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
                          <tr>
                            <th className={`px-4 py-3 text-left text-xs font-black uppercase ${mutedClass}`}>Staff</th>
                            <th className={`px-4 py-3 text-left text-xs font-black uppercase ${mutedClass}`}>Branch</th>
                            <th className={`px-4 py-3 text-right text-xs font-black uppercase ${mutedClass}`}>Total Sales</th>
                            <th className={`px-4 py-3 text-right text-xs font-black uppercase ${mutedClass}`}>Transactions</th>
                            <th className={`px-4 py-3 text-right text-xs font-black uppercase ${mutedClass}`}>Avg Sale</th>
                            <th className={`px-4 py-3 text-right text-xs font-black uppercase ${mutedClass}`}>Void Requests</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                          {staffPerformance.map((staff, index) => (
                            <tr key={staff.id}>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                    index === 0 ? 'bg-green-100 text-green-600 dark:bg-green-900/30' :
                                    index === 1 ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' :
                                    index === 2 ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30' :
                                    'bg-slate-100 text-slate-600 dark:bg-slate-700'
                                  }`}>
                                    {index + 1}
                                  </div>
                                  <div>
                                    <p className={`font-medium ${textClass}`}>{staff.name}</p>
                                    <p className={`text-xs ${mutedClass}`}>{staff.role}</p>
                                  </div>
                                </div>
                              </td>
                              <td className={`px-4 py-4 ${mutedClass}`}>{staff.branch}</td>
                              <td className={`px-4 py-4 text-right font-bold ${textClass}`}>{formatCurrency(staff.totalSales)}</td>
                              <td className={`px-4 py-4 text-right ${mutedClass}`}>{staff.transactionCount}</td>
                              <td className={`px-4 py-4 text-right ${mutedClass}`}>{formatCurrency(staff.avgTransactionValue)}</td>
                              <td className={`px-4 py-4 text-right ${staff.voidRequests > 5 ? 'text-red-500' : mutedClass}`}>
                                {staff.voidRequests}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Users className={`w-12 h-12 mx-auto ${mutedClass} mb-4`} />
                      <p className={`text-sm ${mutedClass}`}>No staff data available</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
