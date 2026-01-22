import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { productsAPI, reportsAPI } from '../api';
import Checkout from '../components/Checkout';
import ExpenseModal from '../components/ExpenseModal';
import {
  ShoppingCart,
  Search,
  Grid,
  List,
  User,
  Settings,
  LogOut,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  X,
  Package,
  TrendingUp,
  Receipt,
  Wallet
} from 'lucide-react';

const Dashboard = () => {
  const { user, logout, isAdmin, canViewAnalytics } = useAuth();
  const navigate = useNavigate();

  // State
  const [darkMode, setDarkMode] = useState(false);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Currency settings from tenant (with fallback)
  const currencySymbol = user?.currencySymbol || user?.tenant?.currencySymbol || '$';
  const taxRate = user?.taxRate || user?.tenant?.taxRate || 0;

  useEffect(() => {
    loadProducts();
    if (canViewAnalytics()) {
      loadDashboard();
    }
  }, []);

  useEffect(() => {
    if (searchTerm || selectedCategory) {
      loadProducts();
    }
  }, [searchTerm, selectedCategory]);

  const loadProducts = async () => {
    try {
      const response = await productsAPI.getAll({ search: searchTerm, category: selectedCategory });
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await reportsAPI.getDashboard({
        startDate: today,
        endDate: today
      });
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.productId === product.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        product: product,
        quantity: 1,
        unitPrice: product.sellingPrice,
        discount: 0
      }]);
    }
    setShowCart(true);
  };

  const updateQuantity = (productId, change) => {
    setCart(cart.map(item => {
      if (item.productId === productId) {
        const newQty = item.quantity + change;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeItem = (productId) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const handleSaleComplete = () => {
    clearCart();
    setShowCheckout(false);
    if (canViewAnalytics()) {
      loadDashboard();
    }
  };

  const handleExpenseAdded = () => {
    setShowExpenseModal(false);
    if (canViewAnalytics()) {
      loadDashboard();
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const tax = subtotal * taxRate;
  const total = subtotal + tax;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Format currency
  const formatCurrency = (amount) => {
    return `${currencySymbol}${amount.toFixed(2)}`;
  };

  // Get emoji for product category
  const getProductEmoji = (product) => {
    if (product.category === 'SERVICE') return '✂️';
    if (product.name.toLowerCase().includes('hair')) return '💇';
    if (product.name.toLowerCase().includes('laptop') || product.name.toLowerCase().includes('charger')) return '💻';
    if (product.name.toLowerCase().includes('usb') || product.name.toLowerCase().includes('cable')) return '🔌';
    if (product.name.toLowerCase().includes('phone')) return '📱';
    return '📦';
  };

  if (showCheckout) {
    return (
      <Checkout
        cart={cart}
        updateCartItem={(productId, quantity) => {
          if (quantity <= 0) {
            removeItem(productId);
          } else {
            setCart(cart.map(item =>
              item.productId === productId ? { ...item, quantity } : item
            ));
          }
        }}
        clearCart={clearCart}
        onComplete={handleSaleComplete}
        onCancel={() => setShowCheckout(false)}
      />
    );
  }

  // Cart Content Component (reused for desktop and mobile)
  const CartContent = ({ isMobile = false }) => (
    <>
      <div className="p-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {isMobile && (
            <button
              onClick={() => setShowCart(false)}
              className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          )}
          <ShoppingCart className="w-5 h-5 text-gray-900 dark:text-gray-100" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Current Order</h2>
          <span className="ml-auto bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-bold px-2.5 py-1 rounded-full">
            {cartItemCount}
          </span>
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <ShoppingCart className="w-16 h-16 mb-4 opacity-50" />
            <p>No items in cart</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map(item => (
              <div key={item.productId} className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex gap-3">
                    <span className="text-2xl">{getProductEmoji(item.product)}</span>
                    <div>
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{item.product.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(item.unitPrice)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="text-gray-400 hover:text-negative-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Minus className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    </button>
                    <span className="w-8 text-center font-semibold text-gray-900 dark:text-gray-100">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Plus className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    </button>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals & Checkout */}
      {cart.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-5">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>Tax ({(taxRate * 100).toFixed(0)}%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-gray-100 pt-3 border-t border-gray-200 dark:border-gray-700">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <button
            onClick={() => setShowCheckout(true)}
            className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-2 border-gray-200 dark:border-gray-700 py-4 rounded-xl font-bold hover:bg-gray-900 hover:text-white dark:hover:bg-gray-100 dark:hover:text-gray-900 hover:border-gray-900 dark:hover:border-gray-100 transition-all hover:-translate-y-0.5 shadow-sm hover:shadow-lg flex items-center justify-center gap-2 mb-3"
          >
            <DollarSign className="w-5 h-5" />
            Complete Payment
          </button>

          <button
            onClick={clearCart}
            className="w-full border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 py-3 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            Clear Cart
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
          <div className="px-4 md:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-900 dark:bg-gray-100 rounded-full flex items-center justify-center text-xl md:text-2xl">
                🏪
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">Smart POS</h1>
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{user?.tenantName || 'Terminal #1'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Mobile Cart Button */}
              <button
                onClick={() => setShowCart(!showCart)}
                className="lg:hidden relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ShoppingCart className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {cartItemCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xl"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>

              <button className="hidden md:flex p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <User className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>

              <button
                onClick={() => navigate('/inventory')}
                className="hidden md:flex p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>

              <button
                onClick={handleLogout}
                className="hidden md:flex p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          </div>
        </header>

        {/* Expense Modal */}
        {showExpenseModal && (
          <ExpenseModal
            onClose={() => setShowExpenseModal(false)}
            onSave={handleExpenseAdded}
          />
        )}

        <div className="flex h-[calc(100vh-73px)]">
          {/* Products Section */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto">
            {/* Analytics Summary Cards */}
            {canViewAnalytics() && dashboardData && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 md:p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-gray-500" />
                    <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Today's Sales</h3>
                  </div>
                  <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(dashboardData.totalSales || 0)}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 md:p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-4 h-4 text-amber-500" />
                    <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Expenses</h3>
                  </div>
                  <p className="text-xl md:text-2xl font-bold text-amber-500">
                    {formatCurrency(dashboardData.totalExpenses || 0)}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 md:p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Net Profit</h3>
                  </div>
                  <p className={`text-xl md:text-2xl font-bold ${(dashboardData.netProfit || 0) >= 0 ? 'text-emerald-500' : 'text-negative-500'}`}>
                    {formatCurrency(dashboardData.netProfit || 0)}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 md:p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Receipt className="w-4 h-4 text-gray-500" />
                    <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Transactions</h3>
                  </div>
                  <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {dashboardData.transactionCount || 0}
                  </p>
                </div>
              </div>
            )}

            {/* Actions Bar */}
            {canViewAnalytics() && (
              <div className="flex justify-end gap-3 mb-4">
                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="px-4 py-2.5 bg-white dark:bg-gray-800 text-amber-600 border-2 border-amber-300 dark:border-amber-600 rounded-xl font-semibold hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all text-sm flex items-center gap-2"
                >
                  <Wallet className="w-4 h-4" />
                  Record Expense
                </button>
              </div>
            )}

            {/* Search & View Toggle */}
            <div className="mb-6 flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 transition-all"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
              >
                <option value="">All Categories</option>
                <option value="PRODUCT">Products</option>
                <option value="SERVICE">Services</option>
              </select>

              <div className="flex gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-gray-900 dark:bg-gray-100' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  <Grid className={`w-5 h-5 ${viewMode === 'grid' ? 'text-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-300'}`} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-gray-900 dark:bg-gray-100' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  <List className={`w-5 h-5 ${viewMode === 'list' ? 'text-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-300'}`} />
                </button>
              </div>
            </div>

            {/* Products Grid/List */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Package className="w-12 h-12 mb-4 opacity-50 animate-pulse" />
                <p>Loading products...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Package className="w-12 h-12 mb-4 opacity-50" />
                <p>No products found</p>
              </div>
            ) : (
              <div className={viewMode === 'grid'
                ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4'
                : 'space-y-3'
              }>
                {products.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`${viewMode === 'grid' ? 'flex flex-col items-center text-center' : 'flex items-center text-left'} bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 hover:shadow-xl transition-all hover:-translate-y-1 w-full`}
                  >
                    <div className={`${viewMode === 'grid' ? 'text-4xl md:text-5xl mb-3' : 'text-3xl mr-4'}`}>
                      {getProductEmoji(product)}
                    </div>
                    <div className={viewMode === 'grid' ? '' : 'flex-1'}>
                      <h3 className="font-semibold text-sm md:text-base text-gray-900 dark:text-gray-100">{product.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{product.category}</p>
                      {product.category === 'PRODUCT' && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Stock: {product.stockQuantity}</p>
                      )}
                    </div>
                    <p className={`text-lg font-bold text-gray-900 dark:text-gray-100 ${viewMode === 'grid' ? 'mt-2' : 'ml-auto'}`}>
                      {formatCurrency(product.sellingPrice)}
                    </p>
                    {product.category === 'PRODUCT' && product.stockQuantity <= (product.lowStockThreshold || 10) && (
                      <span className={`bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs font-semibold px-2 py-1 rounded-lg ${viewMode === 'grid' ? 'mt-2' : 'ml-2'}`}>
                        Low Stock
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cart Section - Desktop */}
          <div className="hidden lg:flex w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex-col">
            <CartContent />
          </div>

          {/* Cart Section - Mobile Overlay */}
          {showCart && (
            <>
              <div
                className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50"
                onClick={() => setShowCart(false)}
              />
              <div className="lg:hidden fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white dark:bg-gray-800 z-50 flex flex-col shadow-2xl">
                <CartContent isMobile={true} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
