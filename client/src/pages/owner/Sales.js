import React, { useState, useEffect } from 'react';
import { salesAPI, reportsAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { exportSales } from '../../utils/exportUtils';
import {
  BarChart3,
  DollarSign,
  Receipt,
  TrendingUp,
  Calendar,
  Search,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CreditCard,
  Banknote,
  Smartphone,
  Download,
  Building2,
  ChevronDown
} from 'lucide-react';

const Sales = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, currentBranch, isAllBranches, branches = [] }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
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
  }, [pagination.page, dateRange, currentBranch, isAllBranches, branchFilter]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Create proper date range with time components
      const startOfDay = new Date(dateRange.startDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateRange.endDate);
      endOfDay.setHours(23, 59, 59, 999);

      const params = {
        page: pagination.page,
        limit: 20,
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString()
      };

      const effectiveBranchId = getEffectiveBranchId();
      if (effectiveBranchId) {
        params.branchId = effectiveBranchId;
      }

      const [salesRes, statsRes] = await Promise.all([
        salesAPI.getAll(params),
        reportsAPI.getDashboard(params)
      ]);

      setSales(salesRes.data.sales || []);
      setPagination(prev => ({
        ...prev,
        total: salesRes.data.pagination?.total || 0,
        pages: salesRes.data.pagination?.pages || 0
      }));
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to load sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.currency || 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentIcon = (method) => {
    switch (method) {
      case 'CASH': return Banknote;
      case 'CARD': return CreditCard;
      case 'MOBILE_MONEY': return Smartphone;
      default: return DollarSign;
    }
  };

  const getPaymentLabel = (method) => {
    switch (method) {
      case 'CASH': return 'Cash';
      case 'CARD': return 'Card';
      case 'MOBILE_MONEY': return 'Mobile Money';
      case 'SPLIT_CASH_MOMO': return 'Split';
      default: return method;
    }
  };

  const filteredSales = sales.filter(sale =>
    sale.transactionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.cashier?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black uppercase tracking-tight ${textClass}`}>Sales & Revenue</h1>
          <p className={`text-sm ${mutedClass}`}>
            {isAllBranches ? 'All branches' : currentBranch?.name || 'Select a branch'} - Sales overview
          </p>
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
            onClick={() => exportSales(sales, user?.currencySymbol || '$')}
            disabled={sales.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
            title="Export to Excel"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={loadData}
            className={`flex items-center gap-2 px-4 py-2.5 border ${borderClass} ${textClass} rounded-xl font-bold text-sm uppercase hover:bg-gray-50 dark:hover:bg-slate-700`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-bold uppercase ${mutedClass}`}>Total Sales</p>
                <p className={`text-2xl font-black ${textClass}`}>{formatCurrency(stats.totalSales || 0)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-bold uppercase ${mutedClass}`}>Transactions</p>
                <p className={`text-2xl font-black ${textClass}`}>{stats.transactionCount || 0}</p>
              </div>
              <Receipt className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-bold uppercase ${mutedClass}`}>Avg Transaction</p>
                <p className={`text-2xl font-black ${textClass}`}>
                  {formatCurrency(stats.transactionCount > 0 ? stats.totalSales / stats.transactionCount : 0)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-slate-500" />
            </div>
          </div>
          <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-bold uppercase ${mutedClass}`}>Gross Profit</p>
                <p className={`text-2xl font-black text-green-600`}>{formatCurrency(stats.grossProfit || 0)}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Calendar className={`w-4 h-4 ${mutedClass}`} />
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className={`px-3 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            />
            <span className={mutedClass}>to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className={`px-3 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            />
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            />
          </div>
        </div>
      </div>

      {/* Sales Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
        </div>
      ) : (
        <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`px-4 py-3 text-left text-xs font-black uppercase ${mutedClass}`}>Transaction</th>
                  <th className={`px-4 py-3 text-left text-xs font-black uppercase ${mutedClass}`}>Date</th>
                  <th className={`px-4 py-3 text-left text-xs font-black uppercase ${mutedClass}`}>Cashier</th>
                  <th className={`px-4 py-3 text-left text-xs font-black uppercase ${mutedClass}`}>Payment</th>
                  <th className={`px-4 py-3 text-right text-xs font-black uppercase ${mutedClass}`}>Amount</th>
                  <th className={`px-4 py-3 text-left text-xs font-black uppercase ${mutedClass}`}>Status</th>
                  <th className={`px-4 py-3 text-right text-xs font-black uppercase ${mutedClass}`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700">
                {filteredSales.map(sale => {
                  const PaymentIcon = getPaymentIcon(sale.paymentMethod);
                  return (
                    <tr key={sale.id} className={sale.paymentStatus === 'voided' ? 'opacity-50' : ''}>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-mono font-bold ${textClass}`}>{sale.transactionNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${mutedClass}`}>{formatDate(sale.createdAt)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${textClass}`}>{sale.cashier?.fullName || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PaymentIcon className={`w-4 h-4 ${mutedClass}`} />
                          <span className={`text-sm ${textClass}`}>{getPaymentLabel(sale.paymentMethod)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-bold ${textClass}`}>{formatCurrency(sale.finalAmount)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                          sale.paymentStatus === 'completed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {sale.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedSale(sale)}
                          className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
                        >
                          <Eye className={`w-4 h-4 ${mutedClass}`} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredSales.length === 0 && (
            <div className="p-12 text-center">
              <Receipt className={`w-12 h-12 mx-auto ${mutedClass} mb-4`} />
              <p className={`text-sm ${mutedClass}`}>No sales found</p>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className={`flex items-center justify-between px-4 py-3 border-t ${borderClass}`}>
              <p className={`text-sm ${mutedClass}`}>
                Page {pagination.page} of {pagination.pages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className={`p-2 rounded-lg disabled:opacity-50 ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                  className={`p-2 rounded-lg disabled:opacity-50 ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sale Details Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${surfaceClass} rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-lg font-black uppercase ${textClass}`}>Sale Details</h2>
              <button onClick={() => setSelectedSale(null)} className={`p-2 rounded-lg ${mutedClass} hover:bg-gray-100 dark:hover:bg-slate-700`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
                <p className={`text-xs ${mutedClass} uppercase font-bold mb-1`}>Transaction #</p>
                <p className={`text-lg font-mono font-bold ${textClass}`}>{selectedSale.transactionNumber}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`text-xs ${mutedClass} uppercase font-bold mb-1`}>Date</p>
                  <p className={`text-sm ${textClass}`}>{formatDate(selectedSale.createdAt)}</p>
                </div>
                <div>
                  <p className={`text-xs ${mutedClass} uppercase font-bold mb-1`}>Cashier</p>
                  <p className={`text-sm ${textClass}`}>{selectedSale.cashier?.fullName}</p>
                </div>
                <div>
                  <p className={`text-xs ${mutedClass} uppercase font-bold mb-1`}>Payment</p>
                  <p className={`text-sm ${textClass}`}>{getPaymentLabel(selectedSale.paymentMethod)}</p>
                </div>
                <div>
                  <p className={`text-xs ${mutedClass} uppercase font-bold mb-1`}>Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                    selectedSale.paymentStatus === 'completed'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {selectedSale.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div>
                <p className={`text-xs ${mutedClass} uppercase font-bold mb-2`}>Items</p>
                <div className={`rounded-xl border ${borderClass} divide-y dark:divide-slate-700`}>
                  {selectedSale.items?.map((item, index) => (
                    <div key={index} className="p-3 flex justify-between">
                      <div>
                        <p className={`text-sm font-medium ${textClass}`}>{item.product?.name}</p>
                        <p className={`text-xs ${mutedClass}`}>x{item.quantity} @ {formatCurrency(item.unitPrice)}</p>
                      </div>
                      <p className={`text-sm font-bold ${textClass}`}>{formatCurrency(item.subtotal)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
                <div className="flex justify-between mb-2">
                  <span className={mutedClass}>Subtotal</span>
                  <span className={textClass}>{formatCurrency(selectedSale.totalAmount)}</span>
                </div>
                {selectedSale.discountAmount > 0 && (
                  <div className="flex justify-between mb-2">
                    <span className={mutedClass}>Discount</span>
                    <span className="text-red-500">-{formatCurrency(selectedSale.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-dashed dark:border-slate-600">
                  <span className={`font-bold ${textClass}`}>Total</span>
                  <span className={`font-bold text-lg ${textClass}`}>{formatCurrency(selectedSale.finalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
