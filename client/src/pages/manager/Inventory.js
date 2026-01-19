import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { productsAPI } from '../../api';
import {
  Search,
  Package,
  AlertTriangle,
  CheckCircle,
  Bell,
  Filter
} from 'lucide-react';

const ManagerInventory = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, bgClass }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStock, setFilterStock] = useState('all'); // all, low, out, ok
  const [notifying, setNotifying] = useState(null);

  const currencySymbol = user?.currencySymbol || '$';

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await productsAPI.getAll();
      // Only show physical products, not services
      setProducts((response.data.products || []).filter(p => p.category === 'PRODUCT'));
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStockStatus = (product) => {
    if (product.stockQuantity === 0) return 'out';
    if (product.stockQuantity <= (product.reorderLevel || 10)) return 'low';
    return 'ok';
  };

  const getStockBadge = (product) => {
    const status = getStockStatus(product);
    switch (status) {
      case 'out':
        return (
          <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-red-100 text-red-600">
            Out of Stock
          </span>
        );
      case 'low':
        return (
          <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-orange-100 text-orange-600">
            Low Stock ({product.stockQuantity})
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-green-100 text-green-600">
            In Stock ({product.stockQuantity})
          </span>
        );
    }
  };

  const notifyOwner = async (product) => {
    setNotifying(product.id);
    try {
      // Simulate API call to notify owner
      await new Promise(resolve => setTimeout(resolve, 500));
      alert(`Owner has been notified about low stock for ${product.name}`);
    } catch (error) {
      console.error('Error notifying owner:', error);
    } finally {
      setNotifying(null);
    }
  };

  const categories = ['All', ...new Set(products.map(p => p.category))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || p.category === filterCategory;
    const stockStatus = getStockStatus(p);
    const matchesStock = filterStock === 'all' ||
      (filterStock === 'low' && stockStatus === 'low') ||
      (filterStock === 'out' && stockStatus === 'out') ||
      (filterStock === 'ok' && stockStatus === 'ok');
    return matchesSearch && matchesCategory && matchesStock;
  });

  const stats = {
    total: products.length,
    lowStock: products.filter(p => getStockStatus(p) === 'low').length,
    outOfStock: products.filter(p => getStockStatus(p) === 'out').length,
    totalValue: products.reduce((sum, p) => sum + (p.stockQuantity * p.costPrice), 0)
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
      {/* Header */}
      <div>
        <h1 className={`text-xl sm:text-2xl font-black uppercase tracking-tighter ${textClass}`}>
          Inventory
        </h1>
        <p className={`text-sm ${mutedClass}`}>
          Monitor stock levels and request restocks
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <Package className={`w-5 h-5 mb-2 ${mutedClass}`} />
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Total Products</p>
          <p className={`text-xl font-black ${textClass}`}>{stats.total}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <AlertTriangle className="w-5 h-5 mb-2 text-orange-500" />
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Low Stock</p>
          <p className="text-xl font-black text-orange-500">{stats.lowStock}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <AlertTriangle className="w-5 h-5 mb-2 text-red-500" />
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Out of Stock</p>
          <p className="text-xl font-black text-red-500">{stats.outOfStock}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <CheckCircle className="w-5 h-5 mb-2 text-green-500" />
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Inventory Value</p>
          <p className="text-xl font-black text-green-500">{formatCurrency(stats.totalValue)}</p>
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
            placeholder="Search products..."
            className={`w-full ${bgClass} border ${borderClass} rounded-xl py-3 pl-11 pr-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${textClass}`}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'low', label: 'Low Stock' },
            { id: 'out', label: 'Out of Stock' },
            { id: 'ok', label: 'In Stock' }
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFilterStock(filter.id)}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase whitespace-nowrap transition-all ${
                filterStock === filter.id
                  ? filter.id === 'low' ? 'bg-orange-500 text-white'
                    : filter.id === 'out' ? 'bg-red-500 text-white'
                    : filter.id === 'ok' ? 'bg-green-500 text-white'
                    : darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'
                  : `${surfaceClass} border ${borderClass} ${mutedClass} hover:border-indigo-500`
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.length === 0 ? (
          <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-8 text-center col-span-full`}>
            <Package className={`w-12 h-12 mx-auto mb-3 ${mutedClass}`} />
            <p className={`text-sm font-bold ${textClass}`}>No products found</p>
            <p className={`text-xs ${mutedClass}`}>Try adjusting your search or filter</p>
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className={`${surfaceClass} border ${borderClass} rounded-2xl p-4`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                  <Package className={`w-6 h-6 ${mutedClass}`} />
                </div>
                {getStockBadge(product)}
              </div>

              <h3 className={`text-sm font-bold ${textClass} mb-1`}>{product.name}</h3>
              <p className={`text-[10px] ${mutedClass} mb-3`}>{product.sku || 'No SKU'}</p>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div>
                  <p className={`text-[9px] ${mutedClass} uppercase`}>Stock</p>
                  <p className={`text-sm font-black ${textClass}`}>{product.stockQuantity}</p>
                </div>
                <div>
                  <p className={`text-[9px] ${mutedClass} uppercase`}>Reorder Level</p>
                  <p className={`text-sm font-black ${textClass}`}>{product.reorderLevel || 10}</p>
                </div>
                <div>
                  <p className={`text-[9px] ${mutedClass} uppercase`}>Cost Price</p>
                  <p className={`text-sm font-bold ${textClass}`}>{formatCurrency(product.costPrice)}</p>
                </div>
                <div>
                  <p className={`text-[9px] ${mutedClass} uppercase`}>Sell Price</p>
                  <p className={`text-sm font-bold text-indigo-500`}>{formatCurrency(product.sellingPrice)}</p>
                </div>
              </div>

              {getStockStatus(product) !== 'ok' && (
                <button
                  onClick={() => notifyOwner(product)}
                  disabled={notifying === product.id}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  <Bell className="w-3.5 h-3.5" />
                  {notifying === product.id ? 'Notifying...' : 'Request Restock'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ManagerInventory;
