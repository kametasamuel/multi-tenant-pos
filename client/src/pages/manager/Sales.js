import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { salesAPI } from '../../api';
import {
  Search,
  Calendar,
  Clock,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  User
} from 'lucide-react';

const ManagerSales = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, bgClass }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [dateFilter, setDateFilter] = useState('today');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0
  });

  const currencySymbol = user?.currencySymbol || '$';

  useEffect(() => {
    loadSales();
  }, [dateFilter]);

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
      default:
        return { startDate: today.toISOString() };
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

      setStats({
        totalRevenue,
        totalOrders,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0
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

  const getPaymentIcon = (method) => {
    switch (method) {
      case 'CASH':
        return <Banknote className="w-3.5 h-3.5" />;
      case 'CARD':
        return <CreditCard className="w-3.5 h-3.5" />;
      case 'MOBILE_MONEY':
        return <Smartphone className="w-3.5 h-3.5" />;
      default:
        return <DollarSign className="w-3.5 h-3.5" />;
    }
  };

  const filteredSales = sales.filter(sale =>
    sale.transactionNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.cashier?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-xl sm:text-2xl font-black uppercase tracking-tighter ${textClass}`}>
          Shift Revenue
        </h1>
        <p className={`text-sm ${mutedClass}`}>
          Track and analyze sales performance
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-500" />
            <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Total Revenue</p>
          </div>
          <p className={`text-lg sm:text-xl font-black text-green-500`}>{formatCurrency(stats.totalRevenue)}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag className="w-4 h-4 text-indigo-500" />
            <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Total Orders</p>
          </div>
          <p className={`text-lg sm:text-xl font-black text-indigo-500`}>{stats.totalOrders}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Avg. Order</p>
          </div>
          <p className={`text-lg sm:text-xl font-black text-orange-500`}>{formatCurrency(stats.avgOrderValue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by transaction ID or cashier..."
            className={`w-full ${bgClass} border ${borderClass} rounded-xl py-3 pl-11 pr-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${textClass}`}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' }
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setDateFilter(filter.id)}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase whitespace-nowrap transition-all ${
                dateFilter === filter.id
                  ? darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'
                  : `${surfaceClass} border ${borderClass} ${mutedClass} hover:border-indigo-500`
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sales List */}
      <div className="space-y-3">
        {filteredSales.length === 0 ? (
          <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-8 text-center`}>
            <ShoppingBag className={`w-12 h-12 mx-auto mb-3 ${mutedClass}`} />
            <p className={`text-sm font-bold ${textClass}`}>No sales found</p>
            <p className={`text-xs ${mutedClass}`}>
              {sales.length === 0 ? 'No sales recorded for this period' : 'Try adjusting your search'}
            </p>
          </div>
        ) : (
          filteredSales.map((sale) => {
            const isExpanded = selectedSale === sale.id;
            return (
              <div key={sale.id}>
                <div
                  onClick={() => setSelectedSale(isExpanded ? null : sale.id)}
                  className={`${surfaceClass} border ${isExpanded ? 'border-indigo-500 rounded-t-2xl border-b-0' : `${borderClass} rounded-2xl`} p-4 cursor-pointer hover:border-indigo-300 transition-colors`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        sale.paymentStatus === 'voided'
                          ? darkMode ? 'bg-red-900/30' : 'bg-red-100'
                          : darkMode ? 'bg-indigo-900/30' : 'bg-indigo-100'
                      }`}>
                        {getPaymentIcon(sale.paymentMethod)}
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${textClass}`}>
                          #{sale.transactionNumber?.slice(-8)}
                        </p>
                        <div className={`text-[10px] ${mutedClass} flex items-center gap-2`}>
                          <Clock className="w-3 h-3" />
                          {new Date(sale.createdAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`text-sm font-black ${sale.paymentStatus === 'voided' ? 'text-red-500 line-through' : 'text-indigo-500'}`}>
                          {formatCurrency(sale.finalAmount)}
                        </p>
                        <p className={`text-[9px] ${mutedClass} capitalize`}>
                          {sale.paymentMethod?.toLowerCase().replace('_', ' ')}
                        </p>
                      </div>
                      {isExpanded ? <ChevronUp className={`w-4 h-4 ${mutedClass}`} /> : <ChevronDown className={`w-4 h-4 ${mutedClass}`} />}
                    </div>
                  </div>
                  {sale.paymentStatus === 'voided' && (
                    <span className="mt-2 inline-block px-2 py-0.5 bg-red-100 text-red-600 text-[8px] font-bold rounded uppercase">
                      Voided
                    </span>
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className={`${surfaceClass} border border-indigo-500 border-t-0 rounded-b-2xl p-5 ${darkMode ? 'bg-slate-800/50' : 'bg-indigo-50/30'}`}>
                    {/* Cashier Info */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                        <User className={`w-4 h-4 ${mutedClass}`} />
                      </div>
                      <div>
                        <p className={`text-[10px] ${mutedClass}`}>Processed by</p>
                        <p className={`text-sm font-bold ${textClass}`}>{sale.cashier?.fullName || 'Unknown'}</p>
                      </div>
                    </div>

                    {/* Items */}
                    <div className={`border-t border-b ${borderClass} py-3 mb-3`}>
                      <p className={`text-[10px] font-bold uppercase ${mutedClass} mb-2`}>Items</p>
                      {sale.items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs py-1">
                          <span className={textClass}>{item.product?.name || 'Item'} x{item.quantity}</span>
                          <span className={mutedClass}>{formatCurrency(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className={mutedClass}>Subtotal</span>
                        <span className={textClass}>{formatCurrency(sale.totalAmount)}</span>
                      </div>
                      {sale.discountAmount > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className={mutedClass}>Discount</span>
                          <span className="text-red-500">-{formatCurrency(sale.discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black pt-2">
                        <span className={textClass}>Total</span>
                        <span className="text-indigo-500">{formatCurrency(sale.finalAmount)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ManagerSales;
