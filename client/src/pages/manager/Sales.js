import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { salesAPI } from '../../api';
import { exportSales } from '../../utils/exportUtils';
import {
  Search,
  Clock,
  CreditCard,
  Banknote,
  Smartphone,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  User,
  X,
  Calendar,
  Filter,
  ChevronDown,
  Printer,
  Download,
  Building2
} from 'lucide-react';

const ManagerSales = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, bgClass }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [dateFilter, setDateFilter] = useState('today');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalProfit: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    cashTotal: 0,
    cardTotal: 0,
    momoTotal: 0
  });

  const currencySymbol = user?.currencySymbol || '$';

  useEffect(() => {
    loadSales();
  }, [dateFilter, customDateRange]);

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateFilter) {
      case 'today':
        return { startDate: today.toISOString() };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          startDate: yesterday.toISOString(),
          endDate: today.toISOString()
        };
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { startDate: weekAgo.toISOString() };
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return { startDate: monthAgo.toISOString() };
      case 'custom':
        if (customDateRange.start && customDateRange.end) {
          const endDate = new Date(customDateRange.end);
          endDate.setHours(23, 59, 59, 999);
          return {
            startDate: new Date(customDateRange.start).toISOString(),
            endDate: endDate.toISOString()
          };
        }
        return { startDate: today.toISOString() };
      default:
        return { startDate: today.toISOString() };
    }
  };

  const getFilterLabel = () => {
    switch (dateFilter) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case 'week': return 'Last 7 Days';
      case 'month': return 'Last 30 Days';
      case 'custom':
        if (customDateRange.start && customDateRange.end) {
          return `${new Date(customDateRange.start).toLocaleDateString()} - ${new Date(customDateRange.end).toLocaleDateString()}`;
        }
        return 'Custom Range';
      default: return 'Today';
    }
  };

  const loadSales = async () => {
    try {
      setLoading(true);
      const params = getDateRange();
      const response = await salesAPI.getAll(params);
      const allSales = response.data.sales || [];
      const completedSales = allSales.filter(s => s.paymentStatus === 'completed');

      setSales(allSales);

      // Calculate stats
      const totalRevenue = completedSales.reduce((sum, s) => sum + s.finalAmount, 0);
      const totalOrders = completedSales.length;

      // Calculate total profit (selling price - cost price for each item)
      const totalProfit = completedSales.reduce((sum, sale) => {
        const saleProfit = (sale.items || []).reduce((itemSum, item) => {
          const sellingPrice = item.unitPrice || item.product?.sellingPrice || 0;
          const costPrice = item.product?.costPrice || 0;
          const itemProfit = (sellingPrice - costPrice) * item.quantity;
          return itemSum + itemProfit;
        }, 0);
        return sum + saleProfit;
      }, 0);

      // Calculate by payment method
      const cashTotal = completedSales
        .filter(s => s.paymentMethod === 'CASH')
        .reduce((sum, s) => sum + s.finalAmount, 0);
      const cardTotal = completedSales
        .filter(s => s.paymentMethod === 'CARD')
        .reduce((sum, s) => sum + s.finalAmount, 0);
      const momoTotal = completedSales
        .filter(s => s.paymentMethod === 'MOMO')
        .reduce((sum, s) => sum + s.finalAmount, 0);
      const bankTransferTotal = completedSales
        .filter(s => s.paymentMethod === 'BANK_TRANSFER')
        .reduce((sum, s) => sum + s.finalAmount, 0);

      setStats({
        totalRevenue,
        totalProfit,
        totalOrders,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        cashTotal,
        cardTotal,
        momoTotal
      });
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Generate receipt data from a sale for reprinting
  const generateReceiptFromSale = (sale) => {
    const saleDate = new Date(sale.createdAt);
    const items = (sale.items || []).map(item => ({
      name: item.product?.name || 'Item',
      qty: item.quantity,
      sellingPrice: item.unitPrice || item.product?.sellingPrice || 0,
      stylist: item.worker || null
    }));

    const subtotal = items.reduce((sum, item) => sum + (item.sellingPrice * item.qty), 0);
    const isSplitPayment = sale.paymentMethod?.includes('_') || false;

    return {
      invoiceNo: sale.transactionNumber || sale.id.slice(-8),
      date: saleDate.toLocaleDateString(),
      time: saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      orderType: sale.orderType || 'Walk-in',
      isSplitPayment,
      method: sale.paymentMethod?.replace('_', ' + ') || 'Cash',
      payments: isSplitPayment
        ? sale.paymentMethod.split('_').reduce((acc, m) => ({ ...acc, [m]: sale.finalAmount / sale.paymentMethod.split('_').length }), {})
        : { [sale.paymentMethod || 'Cash']: sale.amountPaid || sale.finalAmount },
      items,
      customer: sale.customer || null,
      subtotal,
      total: sale.finalAmount,
      amountTendered: sale.amountPaid || sale.finalAmount,
      change: (sale.amountPaid || sale.finalAmount) - sale.finalAmount,
      cashier: sale.cashier?.fullName || 'Unknown'
    };
  };

  // Open receipt modal for reprinting
  const openReceiptModal = (sale) => {
    const receipt = generateReceiptFromSale(sale);
    setReceiptData(receipt);
    setShowReceiptModal(true);
  };

  const getPaymentIcon = (method) => {
    switch (method) {
      case 'CASH':
        return <Banknote className="w-3.5 h-3.5" />;
      case 'CARD':
        return <CreditCard className="w-3.5 h-3.5" />;
      case 'MOMO':
        return <Smartphone className="w-3.5 h-3.5" />;
      case 'BANK_TRANSFER':
        return <Building2 className="w-3.5 h-3.5" />;
      default:
        return <DollarSign className="w-3.5 h-3.5" />;
    }
  };

  const filteredSales = sales.filter(sale =>
    sale.transactionNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.cashier?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${textClass}`}>
            Shift Revenue
          </h1>
          <p className={`text-sm ${mutedClass} mt-1`}>
            {getFilterLabel()} transactions
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Button */}
          <button
            onClick={() => exportSales(sales, currencySymbol)}
            disabled={sales.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-xs font-bold uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
            title="Export to Excel"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          {/* Date Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`flex items-center gap-2 px-4 py-2.5 ${surfaceClass} border ${borderClass} rounded-xl text-xs font-bold uppercase ${textClass} hover:border-accent-500 transition-colors`}
            >
              <Calendar className="w-4 h-4" />
              {getFilterLabel()}
              <ChevronDown className="w-4 h-4" />
            </button>

            {showDatePicker && (
            <div className={`absolute right-0 top-full mt-2 ${surfaceClass} border ${borderClass} rounded-2xl p-4 shadow-xl z-50 min-w-[280px]`}>
              <div className="space-y-2 mb-4">
                {['today', 'yesterday', 'week', 'month'].map((filter) => (
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
                    {filter === 'yesterday' && 'Yesterday'}
                    {filter === 'week' && 'Last 7 Days'}
                    {filter === 'month' && 'Last 30 Days'}
                  </button>
                ))}
              </div>

              <div className={`border-t ${borderClass} pt-4`}>
                <p className={`text-[10px] font-black uppercase ${mutedClass} mb-2`}>Custom Range</p>
                <div className="space-y-2">
                  <div>
                    <label className={`text-[10px] font-bold ${mutedClass} block mb-1`}>Start Date</label>
                    <input
                      type="date"
                      value={customDateRange.start}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className={`w-full px-3 py-2 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} ${textClass} rounded-lg text-xs border ${borderClass}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[10px] font-bold ${mutedClass} block mb-1`}>End Date</label>
                    <input
                      type="date"
                      value={customDateRange.end}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className={`w-full px-3 py-2 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} ${textClass} rounded-lg text-xs border ${borderClass}`}
                    />
                  </div>
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
      </div>

      {/* Stats Summary - Moved to Top */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales Card */}
        <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-5`}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-accent-500" />
            <p className={`text-[10px] font-black uppercase ${mutedClass}`}>Total Sales</p>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-accent-500">{formatCurrency(stats.totalRevenue)}</p>
        </div>

        {/* Total Profit Card */}
        <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-5`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-positive-500" />
            <p className={`text-[10px] font-black uppercase ${mutedClass}`}>Total Profit</p>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-positive-500">{formatCurrency(stats.totalProfit)}</p>
          {stats.totalRevenue > 0 && (
            <p className={`text-[10px] ${mutedClass} mt-1`}>
              {((stats.totalProfit / stats.totalRevenue) * 100).toFixed(1)}% margin
            </p>
          )}
        </div>

        {/* Orders Card */}
        <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-5`}>
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag className="w-4 h-4 text-warning-500" />
            <p className={`text-[10px] font-black uppercase ${mutedClass}`}>Orders</p>
          </div>
          <p className="text-xl sm:text-2xl font-black text-warning-500">{stats.totalOrders}</p>
          <p className={`text-[10px] ${mutedClass} mt-1`}>Avg: {formatCurrency(stats.avgOrderValue)}</p>
        </div>

        {/* Payment Breakdown Card */}
        <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-5`}>
          <p className={`text-[10px] font-black uppercase ${mutedClass} mb-3`}>Payment Methods</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Banknote className="w-3.5 h-3.5 text-emerald-500" />
                <span className={`text-[10px] ${mutedClass}`}>Cash</span>
              </div>
              <span className="text-xs font-black text-emerald-500">{formatCurrency(stats.cashTotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                <span className={`text-[10px] ${mutedClass}`}>Card</span>
              </div>
              <span className="text-xs font-black text-blue-500">{formatCurrency(stats.cardTotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5 text-purple-500" />
                <span className={`text-[10px] ${mutedClass}`}>Momo</span>
              </div>
              <span className="text-xs font-black text-purple-500">{formatCurrency(stats.momoTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative w-full sm:w-80">
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search transactions..."
          className={`w-full ${surfaceClass} border ${borderClass} rounded-xl py-3 pl-11 pr-4 text-xs font-bold focus:outline-none focus:border-accent-500 ${textClass}`}
        />
      </div>

      {/* Sales Table */}
      <div className={`${surfaceClass} border ${borderClass} rounded-[32px] overflow-hidden shadow-sm`}>
        {filteredSales.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingBag className={`w-12 h-12 mx-auto mb-3 ${mutedClass} opacity-30`} />
            <p className={`text-sm font-bold ${textClass}`}>No sales found</p>
            <p className={`text-xs ${mutedClass}`}>
              {sales.length === 0 ? 'No sales recorded for this period' : 'Try adjusting your search'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold">
              <thead className={`${darkMode ? 'bg-slate-800' : 'bg-slate-50'} text-[10px] font-black uppercase ${mutedClass} tracking-widest`}>
                <tr className={`border-b ${borderClass}`}>
                  <th className="p-5 sm:p-6">Transaction</th>
                  <th className="p-5 sm:p-6">Cashier</th>
                  <th className="p-5 sm:p-6 hidden sm:table-cell">Details</th>
                  <th className="p-5 sm:p-6 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    onClick={() => setSelectedSale(sale)}
                    className={`border-b ${borderClass} last:border-b-0 cursor-pointer hover:bg-accent-50 ${darkMode ? 'hover:bg-slate-700/50' : ''} transition-colors`}
                  >
                    <td className="p-5 sm:p-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          sale.paymentStatus === 'voided'
                            ? darkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-negative-500'
                            : darkMode ? 'bg-accent-900/30 text-accent-400' : 'bg-accent-100 text-accent-600'
                        }`}>
                          {getPaymentIcon(sale.paymentMethod)}
                        </div>
                        <div>
                          <p className={`font-bold ${textClass}`}>#{sale.transactionNumber?.slice(-8)}</p>
                          <p className={`text-[10px] font-medium ${mutedClass} flex items-center gap-1`}>
                            <Clock className="w-3 h-3" />
                            {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-5 sm:p-6">
                      <p className={textClass}>{sale.cashier?.fullName || 'Unknown'}</p>
                      {sale.customer && (
                        <p className={`text-[10px] ${mutedClass}`}>
                          Customer: {sale.customer.name}
                        </p>
                      )}
                    </td>
                    <td className={`p-5 sm:p-6 hidden sm:table-cell ${mutedClass}`}>
                      {sale.items?.map(i => i.product?.name).filter(Boolean).join(', ').slice(0, 50) || 'No items'}
                      {(sale.items?.map(i => i.product?.name).filter(Boolean).join(', ').length || 0) > 50 && '...'}
                    </td>
                    <td className="p-5 sm:p-6 text-right">
                      <p className={`font-black ${sale.paymentStatus === 'voided' ? 'text-negative-500 line-through' : 'text-accent-500'}`}>
                        {formatCurrency(sale.finalAmount)}
                      </p>
                      {sale.paymentStatus === 'voided' && (
                        <span className="text-[8px] text-negative-500 uppercase">Voided</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedSale(null)}>
          <div
            className={`${surfaceClass} w-full max-w-md rounded-[32px] p-8 shadow-2xl border ${borderClass} relative`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedSale(null)}
              className={`absolute top-6 right-6 ${mutedClass} hover:text-negative-500`}
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                darkMode ? 'bg-accent-900/30' : 'bg-accent-100'
              }`}>
                <ShoppingBag className="w-8 h-8 text-accent-500" />
              </div>
              <h2 className={`text-xl font-black uppercase ${textClass}`}>Transaction Details</h2>
              <p className={`text-[10px] font-bold ${mutedClass} uppercase tracking-widest`}>
                #{selectedSale.transactionNumber?.slice(-8)}
              </p>
            </div>

            <div className={`${darkMode ? 'bg-slate-800' : 'bg-slate-50'} p-5 rounded-2xl space-y-4 mb-6`}>
              {/* Cashier */}
              <div className="flex justify-between text-[10px] font-bold">
                <span className={mutedClass}>CASHIER</span>
                <span className={textClass}>{selectedSale.cashier?.fullName || 'Unknown'}</span>
              </div>

              {/* Customer */}
              {selectedSale.customer && (
                <div className="flex justify-between text-[10px] font-bold">
                  <span className={mutedClass}>CUSTOMER</span>
                  <span className={textClass}>{selectedSale.customer.name}</span>
                </div>
              )}

              {/* Time */}
              <div className="flex justify-between text-[10px] font-bold">
                <span className={mutedClass}>TIME</span>
                <span className={textClass}>
                  {new Date(selectedSale.createdAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              {/* Payment Method */}
              <div className="flex justify-between text-[10px] font-bold">
                <span className={mutedClass}>PAYMENT</span>
                <span className={textClass}>{selectedSale.paymentMethod?.replace('_', ' ')}</span>
              </div>

              {/* Items */}
              <div className={`border-t pt-3 ${borderClass}`}>
                <p className={`text-[10px] font-black uppercase ${mutedClass} mb-2`}>Items</p>
                {selectedSale.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs py-1">
                    <span className={textClass}>{item.product?.name || 'Item'} x{item.quantity}</span>
                    <span className="text-accent-500 font-bold">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-baseline mb-4">
              <span className={`text-sm font-black uppercase ${mutedClass}`}>Total</span>
              <span className="text-3xl font-black text-accent-500">{formatCurrency(selectedSale.finalAmount)}</span>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  openReceiptModal(selectedSale);
                  setSelectedSale(null);
                }}
                className={`w-full py-3.5 ${surfaceClass} border ${borderClass} rounded-2xl font-bold text-[10px] uppercase flex items-center justify-center gap-2 hover:border-accent-500 transition-colors ${textClass}`}
              >
                <Printer className="w-4 h-4" /> Reprint Receipt
              </button>
              <button
                onClick={() => setSelectedSale(null)}
                className={`w-full py-4 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-2xl font-black text-[10px] uppercase`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close date picker */}
      {showDatePicker && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDatePicker(false)}
        />
      )}

      {/* Receipt Reprint Modal */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${surfaceClass} rounded-2xl w-full max-w-sm shadow-2xl max-h-[90vh] flex flex-col border ${borderClass}`}>
            {/* Modal Header */}
            <div className={`px-5 py-4 border-b ${borderClass} flex justify-between items-center`}>
              <h3 className={`text-sm font-black uppercase ${textClass}`}>Receipt</h3>
              <button
                onClick={() => setShowReceiptModal(false)}
                className={`p-1.5 rounded-lg ${mutedClass} hover:text-negative-500`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Content */}
            <div className="flex-1 overflow-y-auto p-5" style={{ scrollbarWidth: 'thin' }}>
              {/* Header - Business Info */}
              <div className="text-center mb-3">
                <h1 className={`text-sm font-black uppercase leading-tight ${textClass}`}>{user?.tenantName}</h1>
                <p className={`text-[8px] ${mutedClass} mt-0.5`}>{user?.tenant?.address || 'Business Address'}</p>
                <p className={`text-[8px] ${mutedClass}`}>Tel: {user?.tenant?.phone || '0000-000-000'}</p>
              </div>

              {/* Receipt Title */}
              <div className={`text-center py-2 border-y border-dashed ${borderClass} mb-3`}>
                <p className={`text-xs font-black uppercase tracking-wide ${textClass}`}>Sales Receipt</p>
              </div>

              {/* Transaction Details */}
              <div className={`text-[9px] space-y-0.5 mb-3`}>
                <div className="flex justify-between font-medium">
                  <span className={mutedClass}>Served by:</span>
                  <span className={textClass}>{receiptData.cashier}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className={mutedClass}>Date:</span>
                  <span className={textClass}>{receiptData.date} {receiptData.time}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className={mutedClass}>Order Type:</span>
                  <span className={textClass}>{receiptData.orderType || 'Walk-in'}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className={mutedClass}>Invoice #:</span>
                  <span className={`font-bold ${textClass}`}>{receiptData.invoiceNo}</span>
                </div>
                {receiptData.customer && (
                  <div className="flex justify-between font-medium">
                    <span className={mutedClass}>Customer:</span>
                    <span className={textClass}>{receiptData.customer.name}</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <table className="w-full text-[9px] mb-3">
                <thead>
                  <tr className={`border-y border-dashed ${borderClass} ${mutedClass} uppercase`}>
                    <th className="py-1.5 text-left w-6">Qty</th>
                    <th className="py-1.5 text-left">Description</th>
                    <th className="py-1.5 text-right w-14">Price</th>
                    <th className="py-1.5 text-right w-16">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptData.items.map((item, idx) => (
                    <tr key={idx} className={`border-b border-dotted ${borderClass}`}>
                      <td className="py-1.5 text-left">{item.qty}</td>
                      <td className="py-1.5 text-left">
                        <span className={textClass}>{item.name}</span>
                        {item.stylist && (
                          <span className={`block text-[7px] ${mutedClass}`}>by {item.stylist.fullName}</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right">{formatCurrency(item.sellingPrice)}</td>
                      <td className="py-1.5 text-right font-medium">{formatCurrency(item.sellingPrice * item.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className={`border-t border-dashed ${borderClass} pt-2 space-y-1`}>
                <div className="flex justify-between text-[9px] font-medium">
                  <span className={mutedClass}>Gross Total:</span>
                  <span className={textClass}>{formatCurrency(receiptData.subtotal)}</span>
                </div>
                <div className="flex justify-between text-[10px] font-black">
                  <span className={textClass}>Net Total:</span>
                  <span className="text-accent-600">{formatCurrency(receiptData.total)}</span>
                </div>
              </div>

              {/* Payment Info */}
              <div className={`border-t border-dashed ${borderClass} mt-2 pt-2 space-y-1`}>
                <div className="flex justify-between text-[9px] font-medium">
                  <span className={mutedClass}>Amount Paid:</span>
                  <span className={textClass}>{formatCurrency(receiptData.amountTendered)}</span>
                </div>
                {receiptData.change > 0 && (
                  <div className="flex justify-between text-[9px] font-bold">
                    <span className="text-green-600">Change:</span>
                    <span className="text-green-600">{formatCurrency(receiptData.change)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[9px] font-medium">
                  <span className={mutedClass}>Payment:</span>
                  <span className={textClass}>{receiptData.method}</span>
                </div>
              </div>

              {/* Thank You */}
              <div className={`text-center py-3 mt-2 border-t border-dashed ${borderClass}`}>
                <p className={`text-[9px] font-bold ${textClass}`}>Thank you for your patronage!</p>
                <p className={`text-[8px] ${mutedClass}`}>We appreciate your business</p>
              </div>

              {/* Footer */}
              <div className={`text-center pt-2 border-t ${borderClass}`}>
                <p className={`text-[7px] ${mutedClass}`}>Software by Kameta Samuel</p>
                <p className={`text-[7px] ${mutedClass}`}>+233 24 000 0000</p>
              </div>
            </div>

            {/* Modal Footer - Print Button */}
            <div className={`px-5 py-4 border-t ${borderClass}`}>
              <button
                onClick={() => {
                  window.print();
                  setShowReceiptModal(false);
                }}
                className={`w-full py-3 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2`}
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerSales;
