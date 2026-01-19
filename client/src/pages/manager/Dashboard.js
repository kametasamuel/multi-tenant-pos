import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { reportsAPI, productsAPI, salesAPI } from '../../api';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  AlertTriangle,
  Bell,
  Users,
  Package,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';

const ManagerDashboard = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, bgClass }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    todayRevenue: 0,
    todayOrders: 0,
    pendingRequests: 0,
    lowStockCount: 0,
    recentSales: [],
    topProducts: []
  });

  const currencySymbol = user?.currencySymbol || '$';

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [salesRes, productsRes] = await Promise.all([
        salesAPI.getAll({ startDate: today.toISOString() }),
        productsAPI.getAll()
      ]);

      const todaySales = salesRes.data.sales || [];
      const completedSales = todaySales.filter(s => s.paymentStatus === 'completed');
      const products = productsRes.data.products || [];
      const lowStock = products.filter(p =>
        p.category === 'PRODUCT' && p.stockQuantity <= (p.reorderLevel || 10)
      );

      // Calculate top products from today's sales
      const productSales = {};
      completedSales.forEach(sale => {
        sale.items?.forEach(item => {
          const name = item.product?.name || 'Unknown';
          if (!productSales[name]) {
            productSales[name] = { name, quantity: 0, revenue: 0 };
          }
          productSales[name].quantity += item.quantity;
          productSales[name].revenue += item.subtotal;
        });
      });
      const topProducts = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setDashboardData({
        todayRevenue: completedSales.reduce((sum, s) => sum + s.finalAmount, 0),
        todayOrders: completedSales.length,
        pendingRequests: 0, // Will be connected to actual requests later
        lowStockCount: lowStock.length,
        recentSales: completedSales.slice(0, 5),
        topProducts
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className={`text-xl sm:text-2xl font-black uppercase tracking-tighter ${textClass}`}>
          Welcome back, {user?.fullName?.split(' ')[0] || 'Manager'}
        </h1>
        <p className={`text-sm ${mutedClass}`}>
          Here's what's happening at your branch today
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Revenue */}
        <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-4 sm:p-5`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${darkMode ? 'bg-green-900/30' : 'bg-green-100'}`}>
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${mutedClass}`}>Today's Revenue</p>
          <p className={`text-lg sm:text-xl font-black ${textClass}`}>{formatCurrency(dashboardData.todayRevenue)}</p>
        </div>

        {/* Today's Orders */}
        <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-4 sm:p-5`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${darkMode ? 'bg-indigo-900/30' : 'bg-indigo-100'}`}>
              <ShoppingBag className="w-5 h-5 text-indigo-500" />
            </div>
            <span className={`text-xs font-bold ${mutedClass}`}>Orders</span>
          </div>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${mutedClass}`}>Total Orders</p>
          <p className={`text-lg sm:text-xl font-black ${textClass}`}>{dashboardData.todayOrders}</p>
        </div>

        {/* Pending Requests */}
        <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-4 sm:p-5`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${darkMode ? 'bg-orange-900/30' : 'bg-orange-100'}`}>
              <Bell className="w-5 h-5 text-orange-500" />
            </div>
            {dashboardData.pendingRequests > 0 && (
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            )}
          </div>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${mutedClass}`}>Pending Requests</p>
          <p className={`text-lg sm:text-xl font-black ${textClass}`}>{dashboardData.pendingRequests}</p>
        </div>

        {/* Low Stock */}
        <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-4 sm:p-5`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dashboardData.lowStockCount > 0 ? (darkMode ? 'bg-red-900/30' : 'bg-red-100') : (darkMode ? 'bg-slate-700' : 'bg-gray-100')}`}>
              <AlertTriangle className={`w-5 h-5 ${dashboardData.lowStockCount > 0 ? 'text-red-500' : mutedClass}`} />
            </div>
            {dashboardData.lowStockCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            )}
          </div>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${mutedClass}`}>Low Stock Items</p>
          <p className={`text-lg sm:text-xl font-black ${dashboardData.lowStockCount > 0 ? 'text-red-500' : textClass}`}>
            {dashboardData.lowStockCount}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/manager/pos"
          className="flex items-center gap-3 px-4 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors"
        >
          <ShoppingBag className="w-4 h-4" />
          <span className="text-xs font-bold uppercase">Make Sale</span>
        </Link>
        <Link
          to="/manager/employees"
          className={`flex items-center gap-3 px-4 py-3 ${surfaceClass} border ${borderClass} rounded-xl hover:border-indigo-500 transition-colors ${textClass}`}
        >
          <Users className="w-4 h-4" />
          <span className="text-xs font-bold uppercase">Employees</span>
        </Link>
        <Link
          to="/manager/inventory"
          className={`flex items-center gap-3 px-4 py-3 ${surfaceClass} border ${borderClass} rounded-xl hover:border-indigo-500 transition-colors ${textClass}`}
        >
          <Package className="w-4 h-4" />
          <span className="text-xs font-bold uppercase">Inventory</span>
        </Link>
        <Link
          to="/manager/requests"
          className={`flex items-center gap-3 px-4 py-3 ${surfaceClass} border ${borderClass} rounded-xl hover:border-indigo-500 transition-colors ${textClass}`}
        >
          <Bell className="w-4 h-4" />
          <span className="text-xs font-bold uppercase">Requests</span>
        </Link>
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-black uppercase tracking-tight ${textClass}`}>Recent Sales</h2>
            <Link to="/manager/sales" className="text-xs font-bold text-indigo-500 flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {dashboardData.recentSales.length === 0 ? (
              <div className={`text-center py-8 ${mutedClass}`}>
                <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No sales today yet</p>
              </div>
            ) : (
              dashboardData.recentSales.map((sale) => (
                <div key={sale.id} className={`flex items-center justify-between py-2 border-b ${borderClass} last:border-0`}>
                  <div>
                    <p className={`text-xs font-bold ${textClass}`}>#{sale.transactionNumber?.slice(-8)}</p>
                    <p className={`text-[10px] ${mutedClass} flex items-center gap-1`}>
                      <Clock className="w-3 h-3" />
                      {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black text-indigo-500`}>{formatCurrency(sale.finalAmount)}</p>
                    <p className={`text-[9px] ${mutedClass} capitalize`}>{sale.paymentMethod?.toLowerCase().replace('_', ' ')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-black uppercase tracking-tight ${textClass}`}>Top Products Today</h2>
          </div>
          <div className="space-y-3">
            {dashboardData.topProducts.length === 0 ? (
              <div className={`text-center py-8 ${mutedClass}`}>
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No sales data yet</p>
              </div>
            ) : (
              dashboardData.topProducts.map((product, index) => (
                <div key={product.name} className={`flex items-center gap-3 py-2 border-b ${borderClass} last:border-0`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-gray-100 text-gray-700' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    darkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-50 text-gray-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs font-bold ${textClass}`}>{product.name}</p>
                    <p className={`text-[10px] ${mutedClass}`}>{product.quantity} sold</p>
                  </div>
                  <p className="text-sm font-black text-indigo-500">{formatCurrency(product.revenue)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
