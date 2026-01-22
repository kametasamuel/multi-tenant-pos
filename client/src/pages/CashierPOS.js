import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { productsAPI, salesAPI, customersAPI, usersAPI, securityRequestsAPI } from '../api';
import {
  Search,
  Sun,
  Moon,
  Layers,
  LogOut,
  User,
  Users,
  UserPlus,
  ShoppingBag,
  Trash2,
  PauseCircle,
  Banknote,
  CreditCard,
  Smartphone,
  Printer,
  X,
  HelpCircle,
  CheckCircle,
  Package,
  Scissors,
  Store,
  Phone,
  Mail,
  MapPin,
  FileText,
  Plus,
  Minus,
  AlertTriangle,
  Bell,
  Eye,
  Clock,
  XCircle,
  Calendar
} from 'lucide-react';

const CashierPOS = ({
  embedded = false,
  managerView = false,
  darkMode: externalDarkMode,
  surfaceClass: externalSurfaceClass,
  textClass: externalTextClass,
  mutedClass: externalMutedClass,
  borderClass: externalBorderClass,
  bgClass: externalBgClass
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // State - use external dark mode if in manager view, otherwise use internal state
  const [internalDarkMode, setInternalDarkMode] = useState(false);
  const darkMode = managerView ? externalDarkMode : internalDarkMode;
  const setDarkMode = managerView ? () => {} : setInternalDarkMode;
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [heldOrders, setHeldOrders] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('menu'); // menu, held, lowStock, sales
  const [sidebarView, setSidebarView] = useState('cart'); // cart, payment, receipt
  const [selectedPayment, setSelectedPayment] = useState('');
  const [stats, setStats] = useState({ orders: 0, revenue: 0 });
  const [lastReceipt, setLastReceipt] = useState(null);

  // Low stock and sales state
  const [lowStockItems, setLowStockItems] = useState([]);
  const [todaySales, setTodaySales] = useState([]);

  // Workers/Stylists state
  const [workers, setWorkers] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  // Request tracking: { saleId: { type: 'void'|'review', status: 'pending'|'approved', reason: '' } }
  const [saleRequests, setSaleRequests] = useState({});
  // Request modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestModalData, setRequestModalData] = useState({ sale: null, type: '', reason: '' });

  // Payment flow state
  const [paymentStep, setPaymentStep] = useState('orderType'); // orderType, select, amount, confirm
  const [orderType, setOrderType] = useState('Walk-in');
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [selectedMethods, setSelectedMethods] = useState([]); // For split payment
  const [paymentAmounts, setPaymentAmounts] = useState({}); // { Cash: 100, Momo: 50 }
  const [amountTendered, setAmountTendered] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  // Customer state
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '', notes: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const customerInputRef = useRef(null);

  // Modals
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '', onConfirm: null });
  const [toast, setToast] = useState({ show: false, message: '' });
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  // Date/Time
  const [currentTime, setCurrentTime] = useState(new Date());

  // Currency from tenant settings
  const currencySymbol = user?.currencySymbol || '$';

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadProducts();
    loadTodaySales();
    loadWorkers();
    loadSecurityRequests();
  }, []);

  // Check for low stock items when products load
  useEffect(() => {
    const lowStock = products.filter(p =>
      p.category === 'PRODUCT' && p.stockQuantity <= (p.lowStockThreshold || 10)
    );
    setLowStockItems(lowStock);
  }, [products]);

  // Debounce customer search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerName.length >= 2 && !selectedCustomer) {
        searchCustomers(customerName);
      } else {
        setCustomerSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerName, selectedCustomer]);

  const loadProducts = async () => {
    try {
      const response = await productsAPI.getAll();
      setProducts(response.data.products.filter(p => p.isActive));
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTodaySales = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // ownSalesOnly=true ensures each user only sees their own sales
      const response = await salesAPI.getAll({
        startDate: today.toISOString(),
        ownSalesOnly: 'true'
      });
      setTodaySales(response.data.sales || []);
      // Update stats - only from own sales
      const sales = response.data.sales || [];
      const completedSales = sales.filter(s => s.paymentStatus === 'completed');
      setStats({
        orders: completedSales.length,
        revenue: completedSales.reduce((sum, s) => sum + s.finalAmount, 0)
      });
    } catch (error) {
      console.error('Error loading sales:', error);
    }
  };

  const loadWorkers = async () => {
    try {
      const response = await usersAPI.getAll();
      // Filter only active workers (cashiers) for stylist selection
      const activeWorkers = (response.data.users || []).filter(u => u.isActive);
      setWorkers(activeWorkers);
    } catch (error) {
      console.error('Error loading workers:', error);
    }
  };

  // Load security requests for the user's sales
  const loadSecurityRequests = async () => {
    try {
      const response = await securityRequestsAPI.getAll();
      const requests = response.data.securityRequests || [];
      // Convert to map by saleId for easy lookup
      const requestMap = {};
      requests.forEach(req => {
        if (req.saleId) {
          requestMap[req.saleId] = {
            id: req.id,
            type: req.type.toLowerCase(),
            status: req.status.toLowerCase(),
            reason: req.reason
          };
        }
      });
      setSaleRequests(requestMap);
    } catch (error) {
      console.error('Error loading security requests:', error);
    }
  };

  // Open request modal (for entering reason)
  const openRequestModal = (sale, requestType) => {
    setRequestModalData({ sale, type: requestType, reason: '' });
    setShowRequestModal(true);
  };

  // Submit request with reason
  const submitRequest = async () => {
    if (!requestModalData.reason.trim()) {
      showToast('Please enter a reason');
      return;
    }

    setSendingRequest(true);
    try {
      const response = await securityRequestsAPI.create({
        type: requestModalData.type.toUpperCase(),
        reason: requestModalData.reason,
        saleId: requestModalData.sale.id,
        itemName: `Transaction #${requestModalData.sale.transactionNumber?.slice(-8) || requestModalData.sale.id.slice(-8)}`,
        amount: requestModalData.sale.finalAmount
      });

      // Update request tracking with the new request
      setSaleRequests(prev => ({
        ...prev,
        [requestModalData.sale.id]: {
          id: response.data.securityRequest.id,
          type: requestModalData.type.toLowerCase(),
          status: 'pending',
          reason: requestModalData.reason
        }
      }));

      setShowRequestModal(false);
      setRequestModalData({ sale: null, type: '', reason: '' });
      showToast(`${requestModalData.type} request sent to manager`);
    } catch (error) {
      console.error('Submit request error:', error);
      showToast('Failed to send request');
    } finally {
      setSendingRequest(false);
    }
  };

  // Get request status for a sale
  const getSaleRequest = (saleId) => {
    return saleRequests[saleId] || null;
  };

  // Notify manager about low stock
  const notifyManagerLowStock = async (item) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API call
      showToast(`Manager notified about ${item.name}`);
    } catch (error) {
      showToast('Failed to notify manager');
    }
  };

  const searchCustomers = async (query) => {
    try {
      const response = await customersAPI.search(query);
      setCustomerSuggestions(response.data.customers || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error searching customers:', error);
    }
  };

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setCustomerName(customer.name);
    setShowSuggestions(false);
    setCustomerSuggestions([]);
  };

  // Refresh customer data to get updated stats
  const refreshCustomerData = async (customerId) => {
    try {
      const response = await customersAPI.getById(customerId);
      if (response.data.customer) {
        setSelectedCustomer(response.data.customer);
      }
    } catch (error) {
      console.error('Error refreshing customer:', error);
    }
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerName('');
    setCustomerSuggestions([]);
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.name.trim()) {
      showToast('Customer name is required');
      return;
    }

    setSavingCustomer(true);
    try {
      const response = await customersAPI.create(newCustomer);
      const customer = response.data.customer;
      setSelectedCustomer(customer);
      setCustomerName(customer.name);
      setShowCustomerModal(false);
      setNewCustomer({ name: '', phone: '', email: '', address: '', notes: '' });
      showToast('Customer added');
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to add customer');
    } finally {
      setSavingCustomer(false);
    }
  };

  // Theme toggle
  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  // Get unique categories
  const categories = ['All', ...new Set(products.map(p => p.category))];

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const hasStock = p.category === 'SERVICE' || p.stockQuantity > 0;
    return matchesCategory && matchesSearch && hasStock;
  });

  // Cart functions
  const addToCart = (product) => {
    if (product.category === 'PRODUCT') {
      const cartItem = cart.find(item => item.id === product.id);
      const currentQty = cartItem ? cartItem.qty : 0;
      if (currentQty >= product.stockQuantity) {
        showToast('Not enough stock');
        return;
      }
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const removeFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const updateQty = (index, delta) => {
    setCart(prev => {
      const item = prev[index];
      const newQty = item.qty + delta;

      if (item.category === 'PRODUCT' && newQty > item.stockQuantity) {
        showToast('Not enough stock');
        return prev;
      }

      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      return prev.map((item, i) =>
        i === index ? { ...item, qty: newQty } : item
      );
    });
  };

  // Update stylist for a cart item (service only)
  const updateStylist = (index, worker) => {
    setCart(prev => prev.map((item, i) =>
      i === index ? { ...item, stylist: worker } : item
    ));
  };

  const getCartTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.sellingPrice * item.qty), 0);
    const tax = subtotal * (user?.taxRate || 0);
    return subtotal + tax;
  };

  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.sellingPrice * item.qty), 0);
  };

  // Toast notification
  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  // Confirm dialog
  const openConfirm = (title, message, onConfirm) => {
    setConfirmData({ title, message, onConfirm });
    setShowConfirm(true);
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    clearCustomer();
    showToast('Cart cleared');
  };

  // Hold order
  const holdOrder = () => {
    if (cart.length === 0) return;
    setHeldOrders(prev => [...prev, {
      id: Date.now(),
      cart: [...cart],
      customer: selectedCustomer,
      customerName: customerName,
      time: new Date()
    }]);
    setCart([]);
    clearCustomer();
    showToast('Order held');
  };

  // Resume order
  const resumeOrder = (id) => {
    const order = heldOrders.find(o => o.id === id);
    if (order) {
      setCart(order.cart);
      setSelectedCustomer(order.customer);
      setCustomerName(order.customerName || '');
      setHeldOrders(prev => prev.filter(o => o.id !== id));
      setView('menu');
    }
  };

  // Payment flow
  const showPayment = () => {
    if (cart.length === 0) return;
    // Reset payment state
    setPaymentStep('orderType');
    setOrderType('Walk-in');
    setIsSplitPayment(false);
    setSelectedMethods([]);
    setPaymentAmounts({});
    setAmountTendered('');
    setSelectedPayment('');
    setSidebarView('payment');
  };

  // Toggle split payment mode
  const toggleSplitPayment = () => {
    setIsSplitPayment(!isSplitPayment);
    setSelectedMethods([]);
    setPaymentAmounts({});
    setSelectedPayment('');
  };

  // Toggle method selection for split payment
  const toggleMethod = (method) => {
    if (selectedMethods.includes(method)) {
      setSelectedMethods(selectedMethods.filter(m => m !== method));
      const newAmounts = { ...paymentAmounts };
      delete newAmounts[method];
      setPaymentAmounts(newAmounts);
    } else {
      setSelectedMethods([...selectedMethods, method]);
    }
  };

  // Select single payment method
  const selectSingleMethod = (method) => {
    setSelectedPayment(method);
    setPaymentStep('amount');
    setAmountTendered('');
  };

  // Proceed to amount entry for split payment
  const proceedToSplitAmount = () => {
    if (selectedMethods.length < 2) {
      showToast('Select at least 2 methods for split payment');
      return;
    }
    setPaymentStep('amount');
    // Initialize amounts
    const initialAmounts = {};
    selectedMethods.forEach(m => initialAmounts[m] = '');
    setPaymentAmounts(initialAmounts);
  };

  // Update split payment amount
  const updateSplitAmount = (method, value) => {
    setPaymentAmounts(prev => ({
      ...prev,
      [method]: value
    }));
  };

  // Calculate total of split payments
  const getSplitTotal = () => {
    return Object.values(paymentAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  };

  // Calculate change for single payment
  const getChange = () => {
    const tendered = parseFloat(amountTendered) || 0;
    const total = getCartTotal();
    return Math.max(0, tendered - total);
  };

  // Check if payment is valid
  const isPaymentValid = () => {
    const total = getCartTotal();
    if (isSplitPayment) {
      return getSplitTotal() >= total;
    } else {
      return (parseFloat(amountTendered) || 0) >= total;
    }
  };

  // Go back in payment flow
  const goBackPayment = () => {
    if (paymentStep === 'amount') {
      setPaymentStep('select');
      setAmountTendered('');
    } else if (paymentStep === 'select') {
      setPaymentStep('orderType');
    } else {
      setSidebarView('cart');
    }
  };

  const processPayment = async () => {
    if (!isPaymentValid()) {
      showToast('Amount must cover total');
      return;
    }

    setProcessingPayment(true);

    try {
      // Determine primary payment method for API
      let primaryMethod;
      if (isSplitPayment) {
        // Use the method with highest amount as primary
        const sortedMethods = selectedMethods.sort((a, b) =>
          (parseFloat(paymentAmounts[b]) || 0) - (parseFloat(paymentAmounts[a]) || 0)
        );
        primaryMethod = sortedMethods[0];
      } else {
        primaryMethod = selectedPayment;
      }

      const methodMap = { 'Cash': 'CASH', 'Card': 'CARD', 'Momo': 'MOBILE_MONEY' };

      const saleData = {
        items: cart.map(item => ({
          productId: item.id,
          quantity: item.qty,
          unitPrice: item.sellingPrice,
          discount: 0,
          stylistId: item.stylist?.id || null
        })),
        paymentMethod: methodMap[primaryMethod] || 'CASH',
        customerId: selectedCustomer?.id || null,
        discountAmount: 0
      };

      const response = await salesAPI.create(saleData);

      const total = getCartTotal();
      const tendered = isSplitPayment ? getSplitTotal() : parseFloat(amountTendered) || total;
      const change = Math.max(0, tendered - total);

      setStats(prev => ({
        orders: prev.orders + 1,
        revenue: prev.revenue + total
      }));

      setLastReceipt({
        invoiceNo: response.data.sale.transactionNumber,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        orderType: orderType,
        isSplitPayment,
        method: isSplitPayment ? null : selectedPayment,
        payments: isSplitPayment ? paymentAmounts : { [selectedPayment]: tendered },
        items: [...cart],
        customer: selectedCustomer,
        subtotal: getSubtotal(),
        total: total,
        amountTendered: tendered,
        change: change
      });

      setSidebarView('receipt');
      showToast('Payment successful');

      // Refresh customer data to get updated visit count and total spent
      if (selectedCustomer?.id) {
        refreshCustomerData(selectedCustomer.id);
      }

      // Refresh sales list
      loadTodaySales();
    } catch (error) {
      console.error('Payment error:', error);
      const errorMessage = error.response?.data?.error || 'Payment failed. Please try again.';
      showToast(errorMessage);
    } finally {
      setProcessingPayment(false);
    }
  };

  // New transaction
  const newTransaction = () => {
    setCart([]);
    clearCustomer();
    setSidebarView('cart');
    showToast('Ready for new transaction');
  };

  // Logout
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatCurrency = (amount) => {
    return `${currencySymbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      cashier: sale.user?.fullName || user?.fullName
    };
  };

  // Open receipt modal for reprinting
  const openReceiptModal = (sale) => {
    const receipt = generateReceiptFromSale(sale);
    setReceiptData(receipt);
    setShowReceiptModal(true);
  };

  // Theme classes - use external classes when in manager view
  const bgClass = managerView && externalBgClass ? externalBgClass : (darkMode ? 'bg-slate-900' : 'bg-gray-50');
  const surfaceClass = managerView && externalSurfaceClass ? externalSurfaceClass : (darkMode ? 'bg-slate-800' : 'bg-white');
  const textClass = managerView && externalTextClass ? externalTextClass : (darkMode ? 'text-white' : 'text-gray-900');
  const mutedClass = managerView && externalMutedClass ? externalMutedClass : (darkMode ? 'text-slate-400' : 'text-gray-500');
  const borderClass = managerView && externalBorderClass ? externalBorderClass : (darkMode ? 'border-slate-700' : 'border-gray-200');

  if (loading) {
    return (
      <div className={`${embedded || managerView ? 'h-full' : 'h-screen'} flex items-center justify-center ${bgClass}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`${embedded || managerView ? 'h-full' : 'h-screen'} overflow-hidden flex flex-col ${bgClass} ${textClass}`}>
      {/* Header - Hidden when embedded or in manager view */}
      {!embedded && !managerView && (
      <header className={`h-16 sm:h-20 ${surfaceClass} border-b ${borderClass} flex items-center justify-between px-4 sm:px-8 lg:px-12 shrink-0 z-50`}>
        <div className="flex items-center gap-3 sm:gap-5">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-xl flex items-center justify-center shadow-lg`}>
            <Store className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="hidden sm:block">
            <h1 className={`text-base sm:text-lg font-black tracking-tighter uppercase ${textClass}`}>Smart POS</h1>
            <p className={`text-[9px] font-bold uppercase tracking-widest ${mutedClass}`}>
              {user?.fullName} @ {user?.tenantName}
            </p>
          </div>
        </div>

        <div className="flex-1 max-w-xl px-4 sm:px-12 hidden md:block">
          <div className="relative">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${mutedClass} w-4 h-4`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search menu..."
              className={`w-full ${bgClass} border ${borderClass} rounded-xl py-2.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-accent-500/20 text-sm font-semibold ${textClass}`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Date/Time Display */}
          <div className={`hidden lg:flex items-center gap-3 px-4 py-2 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-xl`}>
            <div className="flex items-center gap-1.5">
              <Calendar className={`w-3.5 h-3.5 ${mutedClass}`} />
              <span className={`text-[10px] font-bold uppercase ${textClass}`}>
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className={`w-px h-4 ${borderClass}`}></div>
            <div className="flex items-center gap-1.5">
              <Clock className={`w-3.5 h-3.5 ${mutedClass}`} />
              <span className={`text-[10px] font-bold uppercase ${textClass}`}>
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
          {/* Low Stock Alert Button */}
          <button
            onClick={() => setView(view === 'lowStock' ? 'menu' : 'lowStock')}
            className={`relative w-8 h-8 sm:w-10 sm:h-10 border ${borderClass} rounded-xl flex items-center justify-center ${view === 'lowStock' ? 'bg-warning-500 text-white border-warning-500' : surfaceClass} ${textClass} transition-all`}
          >
            <AlertTriangle className={`w-4 h-4 sm:w-5 sm:h-5 ${lowStockItems.length > 0 && view !== 'lowStock' ? 'text-warning-500' : ''}`} />
            {lowStockItems.length > 0 && (
              <span className={`absolute -top-1.5 -right-1.5 bg-warning-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 ${darkMode ? 'border-slate-800' : 'border-white'}`}>
                {lowStockItems.length}
              </span>
            )}
          </button>
          <button
            onClick={toggleTheme}
            className={`w-8 h-8 sm:w-10 sm:h-10 border ${borderClass} rounded-xl flex items-center justify-center ${surfaceClass} hover:bg-slate-50 dark:hover:bg-slate-700 ${textClass} transition-all`}
          >
            {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
          <button
            onClick={() => setView(view === 'held' ? 'menu' : 'held')}
            className={`relative w-8 h-8 sm:w-10 sm:h-10 border ${borderClass} rounded-xl flex items-center justify-center ${surfaceClass} ${textClass} transition-all`}
          >
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
            {heldOrders.length > 0 && (
              <span className={`absolute -top-1.5 -right-1.5 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 ${darkMode ? 'border-slate-800' : 'border-white'}`}>
                {heldOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => openConfirm('End Session?', 'This will log you out.', handleLogout)}
            className={`w-8 h-8 sm:w-10 sm:h-10 border ${borderClass} rounded-xl flex items-center justify-center ${textClass} hover:text-negative-500`}
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>
      )}

      {/* Main Content */}
      <div className={`flex flex-1 overflow-hidden ${embedded ? 'p-2 gap-2' : managerView ? 'p-2 sm:p-4 gap-3 sm:gap-6' : 'p-3 sm:p-6 lg:px-16 gap-4 sm:gap-8'}`}>
        {/* Products Grid */}
        <main className="flex-1 overflow-y-auto pr-2 sm:pr-6" style={{ scrollbarWidth: 'thin' }}>
          {view === 'menu' ? (
            <>
              {/* Search and Quick Actions - Mobile or Manager View */}
              <div className={`${managerView ? 'block' : 'md:hidden'} mb-4`}>
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${mutedClass} w-4 h-4`} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search menu..."
                      className={`w-full ${bgClass} border ${borderClass} rounded-xl py-2.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-accent-500/20 text-sm font-semibold ${textClass}`}
                    />
                  </div>
                  {/* Quick Actions for Manager View */}
                  {managerView && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setView(view === 'lowStock' ? 'menu' : 'lowStock')}
                        className={`relative w-9 h-9 border ${borderClass} rounded-xl flex items-center justify-center ${view === 'lowStock' ? 'bg-warning-500 text-white border-warning-500' : surfaceClass} ${textClass} transition-all`}
                        title="Low Stock Alerts"
                      >
                        <AlertTriangle className={`w-4 h-4 ${lowStockItems.length > 0 && view !== 'lowStock' ? 'text-warning-500' : ''}`} />
                        {lowStockItems.length > 0 && (
                          <span className={`absolute -top-1 -right-1 bg-warning-500 text-white text-[7px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center`}>
                            {lowStockItems.length}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setView(view === 'held' ? 'menu' : 'held')}
                        className={`relative w-9 h-9 border ${borderClass} rounded-xl flex items-center justify-center ${view === 'held' ? 'bg-accent-500 text-white border-accent-500' : surfaceClass} ${textClass} transition-all`}
                        title="Held Orders"
                      >
                        <Layers className="w-4 h-4" />
                        {heldOrders.length > 0 && (
                          <span className={`absolute -top-1 -right-1 bg-accent-500 text-white text-[7px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center`}>
                            {heldOrders.length}
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Category Filters */}
              <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 sm:px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                      activeCategory === cat
                        ? `${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} shadow-md`
                        : `${surfaceClass} border ${borderClass} ${mutedClass} hover:text-accent-500`
                    }`}
                  >
                    {cat === 'PRODUCT' ? 'Products' : cat === 'SERVICE' ? 'Services' : cat}
                  </button>
                ))}
              </div>

              {/* Products */}
              <div className={`grid ${managerView ? 'grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6'} pb-10`}>
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`${surfaceClass} border ${borderClass} ${managerView ? 'rounded-xl p-2.5 sm:p-4' : 'rounded-2xl sm:rounded-3xl p-3 sm:p-5'} cursor-pointer hover:border-accent-500 hover:shadow-xl transition-all group`}
                  >
                    <div className={`aspect-square ${bgClass} rounded-xl sm:rounded-2xl mb-2 sm:mb-3 flex items-center justify-center`}>
                      {product.category === 'SERVICE' ? (
                        <Scissors className={`w-6 h-6 sm:w-7 sm:h-7 ${mutedClass} group-hover:text-accent-500`} />
                      ) : (
                        <Package className={`w-6 h-6 sm:w-7 sm:h-7 ${mutedClass} group-hover:text-accent-500`} />
                      )}
                    </div>
                    <h3 className={`font-bold text-[10px] sm:text-xs uppercase tracking-tight mb-1 ${textClass} truncate`}>
                      {product.name}
                    </h3>
                    <div className="flex justify-between items-center">
                      <span className={`${mutedClass} text-[7px] sm:text-[8px] font-bold uppercase`}>
                        {product.category === 'SERVICE' ? 'Service' : `Stock: ${product.stockQuantity}`}
                      </span>
                      <span className={`font-black text-xs sm:text-sm ${textClass}`}>
                        {formatCurrency(product.sellingPrice)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : view === 'held' ? (
            // Held Orders View
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className={`text-xl font-black uppercase tracking-tighter ${textClass}`}>Held Orders</h2>
                <button
                  onClick={() => setView('menu')}
                  className="text-xs font-bold text-accent-500 underline"
                >
                  Back to Menu
                </button>
              </div>
              <div className="space-y-3">
                {heldOrders.length === 0 ? (
                  <div className={`${surfaceClass} border ${borderClass} rounded-xl p-8 text-center`}>
                    <Layers className={`w-8 h-8 mx-auto mb-2 ${mutedClass}`} />
                    <p className={`text-sm ${mutedClass}`}>No held orders</p>
                  </div>
                ) : (
                  heldOrders.map((order) => (
                    <div
                      key={order.id}
                      className={`${surfaceClass} border ${borderClass} rounded-xl p-4 flex justify-between items-center`}
                    >
                      <div className={`text-[10px] font-bold ${textClass}`}>
                        #{order.id.toString().slice(-4)} • {order.customerName || 'Walk-in'} • {order.cart.length} items
                      </div>
                      <button
                        onClick={() => resumeOrder(order.id)}
                        className={`${darkMode ? 'bg-white text-black' : 'bg-black text-white'} px-4 py-1.5 rounded-lg font-black text-[9px] uppercase`}
                      >
                        Resume
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : view === 'lowStock' ? (
            // Low Stock View
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className={`text-xl font-black uppercase tracking-tighter ${textClass}`}>
                  <AlertTriangle className="w-5 h-5 inline mr-2 text-warning-500" />
                  Low Stock Items
                </h2>
                <button
                  onClick={() => setView('menu')}
                  className="text-xs font-bold text-accent-500 underline"
                >
                  Back to Menu
                </button>
              </div>
              <div className="space-y-3">
                {lowStockItems.length === 0 ? (
                  <div className={`${surfaceClass} border ${borderClass} rounded-xl p-8 text-center`}>
                    <CheckCircle className={`w-8 h-8 mx-auto mb-2 text-positive-500`} />
                    <p className={`text-sm ${mutedClass}`}>All items are well stocked</p>
                  </div>
                ) : (
                  lowStockItems.map((item) => (
                    <div
                      key={item.id}
                      className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className={`text-sm font-bold ${textClass}`}>{item.name}</h3>
                          <p className={`text-[10px] ${mutedClass}`}>{item.sku || 'No SKU'}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                          item.stockQuantity === 0
                            ? 'bg-negative-100 text-negative-600'
                            : item.stockQuantity <= 5
                            ? 'bg-orange-100 text-orange-600'
                            : 'bg-yellow-100 text-yellow-600'
                        }`}>
                          {item.stockQuantity === 0 ? 'Out of Stock' : `${item.stockQuantity} left`}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className={`text-[10px] ${mutedClass}`}>
                          Reorder Level: {item.reorderLevel || 10}
                        </div>
                        <button
                          onClick={() => notifyManagerLowStock(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-warning-500 text-white rounded-lg text-[9px] font-bold uppercase hover:bg-orange-600 transition-colors"
                        >
                          <Bell className="w-3 h-3" />
                          Notify Manager
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : view === 'sales' ? (
            // Today's Sales View
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className={`text-xl font-black uppercase tracking-tighter ${textClass}`}>
                  <Clock className="w-5 h-5 inline mr-2 text-accent-500" />
                  Today's Sales
                </h2>
                <button
                  onClick={() => setView('menu')}
                  className="text-xs font-bold text-accent-500 underline"
                >
                  Back to Menu
                </button>
              </div>

              <div className="space-y-3">
                {todaySales.length === 0 ? (
                  <div className={`${surfaceClass} border ${borderClass} rounded-xl p-8 text-center`}>
                    <ShoppingBag className={`w-8 h-8 mx-auto mb-2 ${mutedClass}`} />
                    <p className={`text-sm ${mutedClass}`}>No sales today yet</p>
                  </div>
                ) : (
                  todaySales.map((sale) => {
                    const request = getSaleRequest(sale.id);
                    const isExpanded = selectedSale?.id === sale.id;
                    return (
                      <div key={sale.id} className="space-y-0">
                        {/* Sale Header - Clickable */}
                        <div
                          onClick={() => setSelectedSale(isExpanded ? null : sale)}
                          className={`${surfaceClass} border ${isExpanded ? 'border-accent-500 rounded-t-xl border-b-0' : `${borderClass} rounded-xl`} p-4 cursor-pointer hover:border-accent-300 transition-colors`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <div className={`text-[10px] font-bold ${textClass}`}>
                                #{sale.transactionNumber?.slice(-8) || sale.id.slice(-8)}
                              </div>
                              <div className={`text-[9px] ${mutedClass}`}>
                                {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {sale.items?.length || 0} items
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-black ${sale.paymentStatus === 'voided' ? 'text-negative-500 line-through' : 'text-accent-500'}`}>
                                {formatCurrency(sale.finalAmount)}
                              </div>
                              <div className={`text-[9px] ${mutedClass} capitalize`}>
                                {sale.paymentMethod?.toLowerCase().replace('_', ' ')}
                              </div>
                            </div>
                          </div>

                          {/* Status Badges */}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {sale.paymentStatus === 'voided' && (
                              <span className="px-2 py-0.5 bg-negative-100 text-negative-600 text-[8px] font-bold rounded uppercase">
                                Voided
                              </span>
                            )}
                            {request?.status === 'pending' && (
                              <span className={`px-2 py-0.5 text-[8px] font-bold rounded uppercase flex items-center gap-1 ${
                                request.type === 'void' ? 'bg-negative-100 text-negative-600' : 'bg-accent-100 text-accent-600'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                  request.type === 'void' ? 'bg-negative-500' : 'bg-accent-500'
                                }`}></span>
                                {request.type === 'void' ? 'Void' : 'Review'} Pending
                              </span>
                            )}
                            {request?.status === 'approved' && (
                              <span className={`px-2 py-0.5 text-[8px] font-bold rounded uppercase ${
                                request.type === 'void' ? 'bg-negative-100 text-negative-600' : 'bg-green-100 text-positive-600'
                              }`}>
                                {request.type === 'void' ? 'Void' : 'Review'} Approved
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Inline Sale Detail - Shows below when expanded */}
                        {isExpanded && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`${surfaceClass} border border-accent-500 border-t-0 rounded-b-xl p-4 ${darkMode ? 'bg-slate-800/50' : 'bg-accent-50/30'}`}
                          >
                            {/* Items */}
                            <div className={`border-t border-b ${borderClass} py-2 mb-3`}>
                              {sale.items?.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-[10px] py-1">
                                  <span className={textClass}>{item.product?.name || 'Item'} x{item.quantity}</span>
                                  <span className={mutedClass}>{formatCurrency(item.subtotal)}</span>
                                </div>
                              ))}
                            </div>

                            <div className="flex justify-between items-center mb-3">
                              <span className={`text-xs font-bold ${mutedClass}`}>Total</span>
                              <span className={`text-lg font-black text-accent-500`}>{formatCurrency(sale.finalAmount)}</span>
                            </div>

                            {/* Reprint Receipt Button */}
                            <button
                              onClick={() => openReceiptModal(sale)}
                              className={`w-full flex items-center justify-center gap-2 py-2.5 mb-3 ${surfaceClass} border ${borderClass} rounded-lg text-[9px] font-bold uppercase hover:border-accent-500 transition-colors ${textClass}`}
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Reprint Receipt
                            </button>

                            {/* Action Buttons - Based on request status */}
                            {(() => {
                              const isVoided = sale.paymentStatus === 'voided';

                              // If already voided
                              if (isVoided) {
                                return (
                                  <div className={`py-3 rounded-lg text-center ${darkMode ? 'bg-red-900/30' : 'bg-negative-100'} text-negative-600`}>
                                    <XCircle className="w-4 h-4 inline mr-2" />
                                    <span className="text-[10px] font-bold uppercase">This sale has been voided</span>
                                  </div>
                                );
                              }

                              // If request is approved
                              if (request?.status === 'approved') {
                                return (
                                  <div className={`py-3 rounded-lg text-center ${
                                    request.type === 'void'
                                      ? darkMode ? 'bg-red-900/30 text-negative-400' : 'bg-negative-100 text-negative-600'
                                      : darkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-positive-600'
                                  }`}>
                                    <CheckCircle className="w-4 h-4 inline mr-2" />
                                    <span className="text-[10px] font-bold uppercase">
                                      {request.type === 'void' ? 'Void' : 'Review'} Request Approved
                                    </span>
                                  </div>
                                );
                              }

                              // If request is pending
                              if (request?.status === 'pending') {
                                return (
                                  <div className={`py-3 px-3 rounded-lg ${
                                    request.type === 'void' ? 'bg-negative-50 border border-negative-200' : 'bg-accent-50 border border-accent-200'
                                  } ${darkMode ? (request.type === 'void' ? 'bg-red-900/20 border-negative-800' : 'bg-accent-900/20 border-accent-800') : ''}`}>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full animate-pulse ${
                                          request.type === 'void' ? 'bg-negative-500' : 'bg-accent-500'
                                        }`}></div>
                                        <span className={`text-[10px] font-bold ${
                                          request.type === 'void' ? 'text-negative-600' : 'text-accent-600'
                                        }`}>
                                          {request.type === 'void' ? 'Void' : 'Review'} Request Pending
                                        </span>
                                      </div>
                                      <Clock className={`w-3.5 h-3.5 ${
                                        request.type === 'void' ? 'text-negative-400' : 'text-accent-400'
                                      }`} />
                                    </div>
                                    {request.reason && (
                                      <p className={`text-[9px] ${request.type === 'void' ? 'text-negative-600' : 'text-accent-600'} italic`}>
                                        "{request.reason}"
                                      </p>
                                    )}
                                    <p className={`text-[8px] ${mutedClass} mt-2 text-center`}>
                                      Awaiting manager approval
                                    </p>
                                  </div>
                                );
                              }

                              // No request - show both buttons
                              return (
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => openRequestModal(sale, 'Void')}
                                    disabled={sendingRequest}
                                    className="flex items-center justify-center gap-1.5 py-2.5 bg-negative-500 text-white rounded-lg text-[9px] font-bold uppercase hover:bg-negative-600 transition-colors"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    Void Request
                                  </button>
                                  <button
                                    onClick={() => openRequestModal(sale, 'Review')}
                                    disabled={sendingRequest}
                                    className="flex items-center justify-center gap-1.5 py-2.5 bg-accent-500 text-white rounded-lg text-[9px] font-bold uppercase hover:bg-accent-600 transition-colors"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    Review Request
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </main>

        {/* Sidebar - Right Panel with special font styling */}
        <aside className={`w-full ${managerView ? 'sm:w-[280px] lg:w-[320px]' : 'sm:w-[320px] lg:w-[360px]'} flex flex-col gap-4 shrink-0 min-h-0 overflow-hidden`} style={{ fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif" }}>
          {/* Stats Card - Clickable to show today's sales */}
          <div
            onClick={() => setView(view === 'sales' ? 'menu' : 'sales')}
            className={`${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-2xl p-4 shadow-lg flex justify-around items-center shrink-0 cursor-pointer hover:opacity-90 transition-opacity ${view === 'sales' ? 'ring-2 ring-accent-500' : ''}`}
          >
            <div className="text-center">
              <p className="text-[8px] font-black uppercase opacity-60 tracking-widest">Customers Served</p>
              <p className="text-lg font-black">{stats.orders}</p>
            </div>
            <div className={`h-6 w-px ${darkMode ? 'bg-black/10' : 'bg-white/10'}`}></div>
            <div className="text-center">
              <p className="text-[8px] font-black uppercase opacity-60 tracking-widest">Today's Sales</p>
              <p className="text-lg font-black">{formatCurrency(stats.revenue)}</p>
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {sidebarView === 'cart' && (
              <div className="flex flex-col flex-1 gap-4 min-h-0 overflow-hidden">
                {/* Customer Input with Autocomplete */}
                <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-3.5 shrink-0 shadow-sm`}>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <User className={`absolute left-3 ${selectedCustomer ? 'top-2.5' : 'top-1/2 -translate-y-1/2'} ${mutedClass} w-3.5 h-3.5`} />
                      {selectedCustomer ? (
                        // Show selected customer with name and phone
                        <div className={`w-full ${bgClass} border ${borderClass} rounded-lg py-1.5 pl-9 pr-8 min-h-[32px]`}>
                          <p className={`text-xs font-bold ${textClass}`}>{selectedCustomer.name}</p>
                          {selectedCustomer.phone && (
                            <p className={`text-[9px] ${mutedClass}`}>{selectedCustomer.phone}</p>
                          )}
                          <button
                            onClick={clearCustomer}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-negative-500"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        // Search input
                        <input
                          ref={customerInputRef}
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          onFocus={() => customerSuggestions.length > 0 && setShowSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                          placeholder="Search by name or phone..."
                          className={`w-full ${bgClass} border ${borderClass} rounded-lg py-1.5 pl-9 pr-8 text-xs font-bold focus:outline-none focus:border-accent-500 ${textClass}`}
                        />
                      )}

                      {/* Suggestions Dropdown */}
                      {showSuggestions && customerSuggestions.length > 0 && !selectedCustomer && (
                        <div
                          className={`absolute top-full left-0 right-0 mt-1 ${surfaceClass} border ${borderClass} rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto`}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          {customerSuggestions.map((customer) => (
                            <div
                              key={customer.id}
                              onClick={() => selectCustomer(customer)}
                              className={`w-full px-3 py-2.5 text-left hover:bg-accent-50 ${darkMode ? 'hover:bg-slate-700' : ''} transition-colors border-b ${borderClass} last:border-b-0 cursor-pointer`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className={`text-xs font-bold ${textClass}`}>{customer.name}</p>
                                  {customer.phone && (
                                    <p className={`text-[10px] ${mutedClass} flex items-center gap-1 mt-0.5`}>
                                      <Phone className="w-3 h-3" />
                                      {customer.phone}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className={`text-[9px] ${mutedClass}`}>{customer.visitCount || 0} visits</p>
                                  <p className={`text-[9px] text-accent-500 font-bold`}>{formatCurrency(customer.totalSpent || 0)}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setShowCustomerModal(true)}
                      className={`w-8 h-8 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity shrink-0`}
                      title="Add new customer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {selectedCustomer && (
                    <div className={`mt-2 pt-2 border-t ${borderClass} flex items-center justify-between`}>
                      <p className={`text-[9px] ${mutedClass}`}>
                        <span className="font-bold text-accent-500">{selectedCustomer.visitCount || 0}</span> visits
                      </p>
                      <p className={`text-[9px] font-bold text-accent-500`}>
                        {formatCurrency(selectedCustomer.totalSpent || 0)} spent
                      </p>
                    </div>
                  )}
                </div>

                {/* Cart Container - Takes remaining space */}
                <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-4 sm:p-5 flex-1 flex flex-col shadow-sm min-h-0 overflow-hidden`}>
                  {/* Fixed Header */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-xs font-black uppercase tracking-tight ${textClass}`}>Active Cart</h3>
                    {cart.length > 0 && (
                      <span className={`text-[10px] font-bold ${mutedClass} bg-accent-100 ${darkMode ? 'bg-accent-900/50 text-accent-300' : 'text-accent-600'} px-2 py-0.5 rounded-full`}>
                        {cart.reduce((sum, item) => sum + item.qty, 0)} items
                      </span>
                    )}
                  </div>

                  {/* Scrollable Cart Items */}
                  <div className="flex-1 overflow-y-auto min-h-0 pr-1" style={{ scrollbarWidth: 'thin' }}>
                    {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center opacity-30">
                        <ShoppingBag className="w-6 h-6 mb-2" />
                        <p className="text-[8px] font-black uppercase">Cart Empty</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {cart.map((item, idx) => (
                          <div key={idx} className={`group py-2 border-b ${borderClass} last:border-0`}>
                            <div className="flex flex-col gap-1.5">
                              {/* Product Name and Delete */}
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <h4 className={`text-[10px] font-bold uppercase ${textClass} truncate`} title={item.name}>{item.name}</h4>
                                  <p className={`text-[9px] font-bold ${mutedClass}`}>
                                    {formatCurrency(item.sellingPrice)} each
                                  </p>
                                </div>
                                <button
                                  onClick={() => removeFromCart(idx)}
                                  className={`${mutedClass} hover:text-negative-500 shrink-0`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {/* Quantity and Subtotal */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => updateQty(idx, -1)}
                                    className={`w-6 h-6 rounded-md ${bgClass} border ${borderClass} flex items-center justify-center hover:border-accent-500`}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className={`w-6 text-center text-[11px] font-black ${textClass}`}>{item.qty}</span>
                                  <button
                                    onClick={() => updateQty(idx, 1)}
                                    className={`w-6 h-6 rounded-md ${bgClass} border ${borderClass} flex items-center justify-center hover:border-accent-500`}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                                <span className={`text-[11px] font-black text-accent-500`}>
                                  {formatCurrency(item.sellingPrice * item.qty)}
                                </span>
                              </div>
                            </div>
                            {/* Stylist Selection for Services */}
                            {item.category === 'SERVICE' && workers.length > 0 && (
                              <div className="mt-1.5 flex items-center gap-2">
                                <Users className={`w-3 h-3 ${mutedClass}`} />
                                <select
                                  value={item.stylist?.id || ''}
                                  onChange={(e) => {
                                    const worker = workers.find(w => w.id === e.target.value);
                                    updateStylist(idx, worker || null);
                                  }}
                                  className={`flex-1 text-[9px] py-1 px-2 rounded-md ${bgClass} border ${borderClass} ${textClass} focus:outline-none focus:border-accent-500`}
                                >
                                  <option value="">Select stylist...</option>
                                  {workers.map(w => (
                                    <option key={w.id} value={w.id}>{w.fullName}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Fixed Total */}
                  <div className={`pt-3 mt-3 border-t ${borderClass}`}>
                    <div className="flex justify-between items-end">
                      <span className={`text-[10px] font-black uppercase ${mutedClass} leading-none`}>Due Total</span>
                      <span className="text-xl sm:text-2xl font-black text-accent-500 leading-none">
                        {formatCurrency(getCartTotal())}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fixed Action Buttons */}
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openConfirm('Clear cart?', 'This will remove all items.', clearCart)}
                      className={`py-3 border border-negative-200 rounded-xl text-negative-500 font-bold text-[10px] uppercase hover:bg-negative-50 ${surfaceClass}`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={showPayment}
                      className="py-3 bg-green-600 text-white rounded-xl font-black text-[10px] uppercase hover:bg-green-700 shadow-lg"
                    >
                      Pay Now
                    </button>
                  </div>
                  <button
                    onClick={holdOrder}
                    className={`w-full py-3.5 ${darkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-white text-slate-900 border-slate-900'} border rounded-xl font-black text-[10px] uppercase hover:opacity-80 transition-all flex items-center justify-center gap-2`}
                  >
                    <PauseCircle className="w-3.5 h-3.5" /> Hold Order
                  </button>
                </div>
              </div>
            )}

            {sidebarView === 'payment' && (
              <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-6 flex flex-1 flex-col shadow-sm min-h-0 overflow-hidden`}>
                <button
                  onClick={goBackPayment}
                  className={`text-xs font-bold ${mutedClass} mb-4 flex items-center gap-2`}
                >
                  ← {paymentStep === 'amount' ? 'Back to Methods' : paymentStep === 'select' ? 'Back to Order Type' : 'Back to Cart'}
                </button>

                {/* Total Display */}
                <div className="mb-4">
                  <h2 className={`text-lg font-black uppercase mb-1 ${textClass}`}>
                    {paymentStep === 'orderType' ? 'Order Type' : paymentStep === 'select' ? 'Select Payment' : 'Enter Amount'}
                  </h2>
                  <p className="text-accent-500 font-black text-2xl">{formatCurrency(getCartTotal())}</p>
                </div>

                {/* Step 0: Select Order Type */}
                {paymentStep === 'orderType' && (
                  <div className="flex-1 overflow-y-auto">
                    <p className={`text-[10px] font-bold ${mutedClass} mb-3`}>Select the type of order</p>
                    <div className="space-y-2">
                      {[
                        { id: 'Walk-in', label: 'Walk-in', desc: 'Customer at location' },
                        { id: 'Delivery', label: 'Delivery', desc: 'Order for delivery' },
                        { id: 'Pickup', label: 'Pickup', desc: 'Customer will pick up' },
                        { id: 'Out-service', label: 'Out-service', desc: 'Service outside location' }
                      ].map(({ id, label, desc }) => (
                        <button
                          key={id}
                          onClick={() => setOrderType(id)}
                          className={`w-full p-3 border rounded-xl text-left transition-all ${
                            orderType === id
                              ? 'border-accent-500 bg-accent-50 ' + (darkMode ? 'bg-accent-900/30' : '')
                              : `${borderClass} hover:border-accent-300`
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className={`font-bold text-xs ${textClass}`}>{label}</span>
                              <p className={`text-[9px] ${mutedClass}`}>{desc}</p>
                            </div>
                            {orderType === id && (
                              <CheckCircle className="w-4 h-4 text-accent-500" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setPaymentStep('select')}
                      className={`w-full mt-4 py-3.5 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-xl font-black text-[10px] uppercase`}
                    >
                      Continue to Payment
                    </button>
                  </div>
                )}

                {/* Step 1: Select Payment Method */}
                {paymentStep === 'select' && (
                  <div className="flex-1 overflow-y-auto">
                    {/* Split Payment Toggle */}
                    <div className={`mb-4 p-3 rounded-xl ${bgClass} border ${borderClass}`}>
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className={`text-xs font-bold ${textClass}`}>Split Payment</span>
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={isSplitPayment}
                            onChange={toggleSplitPayment}
                            className="sr-only"
                          />
                          <div className={`w-10 h-5 rounded-full transition-colors ${isSplitPayment ? 'bg-accent-500' : darkMode ? 'bg-slate-600' : 'bg-gray-300'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform mt-0.5 ${isSplitPayment ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`}></div>
                          </div>
                        </div>
                      </label>
                      {isSplitPayment && (
                        <p className={`text-[9px] ${mutedClass} mt-1`}>Select multiple payment methods</p>
                      )}
                    </div>

                    {/* Payment Methods - Compact Cards */}
                    <div className="space-y-2">
                      {[
                        { id: 'Cash', label: 'Cash', icon: Banknote },
                        { id: 'Card', label: 'Card', icon: CreditCard },
                        { id: 'Momo', label: 'Mobile Money', icon: Smartphone }
                      ].map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          onClick={() => isSplitPayment ? toggleMethod(id) : selectSingleMethod(id)}
                          className={`w-full p-2.5 border rounded-xl flex items-center gap-3 transition-all ${
                            isSplitPayment && selectedMethods.includes(id)
                              ? 'border-accent-500 bg-accent-50'
                              : `${borderClass} hover:bg-accent-50 hover:border-accent-500`
                          } ${darkMode && isSplitPayment && selectedMethods.includes(id) ? 'bg-accent-900/30' : ''} group`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            isSplitPayment && selectedMethods.includes(id)
                              ? 'bg-accent-500 text-white'
                              : `${bgClass} group-hover:bg-accent-500 group-hover:text-white`
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className={`font-bold text-xs flex-1 text-left ${textClass}`}>{label}</span>
                          {isSplitPayment && selectedMethods.includes(id) && (
                            <CheckCircle className="w-4 h-4 text-accent-500" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Proceed Button for Split Payment */}
                    {isSplitPayment && selectedMethods.length >= 2 && (
                      <button
                        onClick={proceedToSplitAmount}
                        className="w-full mt-4 py-3.5 bg-accent-500 text-white rounded-xl font-black text-[10px] uppercase hover:bg-accent-600 transition-colors"
                      >
                        Continue with {selectedMethods.length} Methods
                      </button>
                    )}
                  </div>
                )}

                {/* Step 2: Enter Amount */}
                {paymentStep === 'amount' && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto space-y-4">
                      {isSplitPayment ? (
                        // Split Payment Amount Inputs - Compact
                        <>
                          <div className={`p-3 rounded-xl border ${borderClass} space-y-2`}>
                            {selectedMethods.map((method) => {
                              const Icon = method === 'Cash' ? Banknote : method === 'Card' ? CreditCard : Smartphone;
                              return (
                                <div key={method} className="flex items-center gap-2">
                                  <div className={`w-7 h-7 ${bgClass} rounded-lg flex items-center justify-center shrink-0`}>
                                    <Icon className="w-3.5 h-3.5" />
                                  </div>
                                  <span className={`text-xs font-bold ${textClass} w-12 shrink-0`}>{method}</span>
                                  <div className="relative flex-1">
                                    <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold ${mutedClass}`}>
                                      {currencySymbol}
                                    </span>
                                    <input
                                      type="number"
                                      value={paymentAmounts[method] || ''}
                                      onChange={(e) => updateSplitAmount(method, e.target.value)}
                                      placeholder="0.00"
                                      className={`w-full ${bgClass} border ${borderClass} rounded-lg py-2 pl-7 pr-3 text-sm font-bold focus:outline-none focus:border-accent-500 ${textClass}`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Split Payment Summary - Compact */}
                          <div className={`p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                            <div className="flex justify-between items-center">
                              <span className={`text-[10px] font-bold ${mutedClass}`}>Split Total</span>
                              <span className={`text-sm font-black ${getSplitTotal() >= getCartTotal() ? 'text-positive-500' : 'text-negative-500'}`}>
                                {formatCurrency(getSplitTotal())}
                              </span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <span className={`text-[10px] font-bold ${mutedClass}`}>Required</span>
                              <span className={`text-xs font-bold ${textClass}`}>{formatCurrency(getCartTotal())}</span>
                            </div>
                            {getSplitTotal() > getCartTotal() && (
                              <div className={`flex justify-between items-center mt-2 pt-2 border-t ${borderClass}`}>
                                <span className={`text-[10px] font-bold text-positive-600`}>Change</span>
                                <span className="text-sm font-black text-positive-500">
                                  {formatCurrency(getSplitTotal() - getCartTotal())}
                                </span>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        // Single Payment Amount Input
                        <>
                          <div className={`p-4 rounded-xl border ${borderClass}`}>
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`w-8 h-8 ${bgClass} rounded-lg flex items-center justify-center`}>
                                {selectedPayment === 'Cash' && <Banknote className="w-4 h-4" />}
                                {selectedPayment === 'Card' && <CreditCard className="w-4 h-4" />}
                                {selectedPayment === 'Momo' && <Smartphone className="w-4 h-4" />}
                              </div>
                              <span className={`text-sm font-bold ${textClass}`}>{selectedPayment}</span>
                            </div>
                            <label className={`text-[10px] font-bold uppercase ${mutedClass} mb-2 block`}>
                              Amount Tendered
                            </label>
                            <div className="relative">
                              <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold ${mutedClass}`}>
                                {currencySymbol}
                              </span>
                              <input
                                type="number"
                                value={amountTendered}
                                onChange={(e) => setAmountTendered(e.target.value)}
                                placeholder="0.00"
                                autoFocus
                                className={`w-full ${bgClass} border-2 ${
                                  amountTendered && parseFloat(amountTendered) >= getCartTotal()
                                    ? 'border-positive-500'
                                    : borderClass
                                } rounded-xl py-4 pl-12 pr-4 text-2xl font-black focus:outline-none focus:border-accent-500 ${textClass}`}
                              />
                            </div>
                          </div>

                          {/* Quick Amount Buttons for Cash */}
                          {selectedPayment === 'Cash' && (
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                Math.ceil(getCartTotal()),
                                Math.ceil(getCartTotal() / 10) * 10,
                                Math.ceil(getCartTotal() / 50) * 50,
                                Math.ceil(getCartTotal() / 100) * 100,
                                Math.ceil(getCartTotal() / 100) * 100 + 100,
                                Math.ceil(getCartTotal() / 100) * 100 + 200
                              ].filter((v, i, a) => a.indexOf(v) === i && v >= getCartTotal()).slice(0, 6).map((amount) => (
                                <button
                                  key={amount}
                                  onClick={() => setAmountTendered(amount.toString())}
                                  className={`py-2.5 px-3 border ${borderClass} rounded-xl text-xs font-bold ${textClass} hover:border-accent-500 hover:bg-accent-50 transition-colors`}
                                >
                                  {formatCurrency(amount)}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Change Display */}
                          {amountTendered && parseFloat(amountTendered) >= getCartTotal() && (
                            <div className={`p-4 rounded-xl bg-green-50 border border-green-200 ${darkMode ? 'bg-green-900/20 border-green-800' : ''}`}>
                              <div className="flex justify-between items-center">
                                <span className={`text-xs font-bold uppercase ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
                                  Change to Give
                                </span>
                                <span className={`text-2xl font-black ${darkMode ? 'text-green-400' : 'text-positive-600'}`}>
                                  {formatCurrency(getChange())}
                                </span>
                              </div>
                            </div>
                          )}

                          {amountTendered && parseFloat(amountTendered) < getCartTotal() && (
                            <div className={`p-3 rounded-xl bg-negative-50 border border-negative-200 ${darkMode ? 'bg-red-900/20 border-negative-800' : ''}`}>
                              <p className={`text-xs font-bold ${darkMode ? 'text-negative-400' : 'text-negative-600'}`}>
                                Amount is less than total by {formatCurrency(getCartTotal() - parseFloat(amountTendered))}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Confirm Payment Button */}
                    <div className="pt-4 mt-auto">
                      <button
                        onClick={processPayment}
                        disabled={!isPaymentValid() || processingPayment}
                        className={`w-full py-4 rounded-xl font-black text-sm uppercase transition-all flex items-center justify-center gap-2 ${
                          isPaymentValid() && !processingPayment
                            ? 'bg-positive-500 text-white hover:bg-green-600 shadow-lg'
                            : `${darkMode ? 'bg-slate-700 text-slate-500' : 'bg-gray-200 text-gray-400'} cursor-not-allowed`
                        }`}
                      >
                        {processingPayment ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-5 h-5" />
                            Confirm Payment
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {sidebarView === 'receipt' && lastReceipt && (
              <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-4 flex flex-1 flex-col shadow-sm overflow-hidden`}>
                <div className="flex-1 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
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
                      <span className={textClass}>{user?.fullName}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span className={mutedClass}>Date:</span>
                      <span className={textClass}>{lastReceipt.date} {lastReceipt.time}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span className={mutedClass}>Order Type:</span>
                      <span className={textClass}>{lastReceipt.orderType || 'Walk-in'}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span className={mutedClass}>Invoice #:</span>
                      <span className={`font-bold ${textClass}`}>{lastReceipt.invoiceNo}</span>
                    </div>
                    {lastReceipt.customer && (
                      <div className="flex justify-between font-medium">
                        <span className={mutedClass}>Customer:</span>
                        <span className={textClass}>{lastReceipt.customer.name}</span>
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
                      {lastReceipt.items.map((item, idx) => (
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
                      <span className={textClass}>{formatCurrency(lastReceipt.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-black">
                      <span className={textClass}>Net Total:</span>
                      <span className="text-accent-600">{formatCurrency(lastReceipt.total)}</span>
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div className={`border-t border-dashed ${borderClass} mt-2 pt-2 space-y-1`}>
                    <div className="flex justify-between text-[9px] font-medium">
                      <span className={mutedClass}>Amount Paid:</span>
                      <span className={textClass}>{formatCurrency(lastReceipt.amountTendered)}</span>
                    </div>
                    {lastReceipt.change > 0 && (
                      <div className="flex justify-between text-[9px] font-bold">
                        <span className="text-positive-600">Change:</span>
                        <span className="text-positive-600">{formatCurrency(lastReceipt.change)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[9px] font-medium">
                      <span className={mutedClass}>Payment:</span>
                      <span className={textClass}>
                        {lastReceipt.isSplitPayment
                          ? Object.keys(lastReceipt.payments).join(' + ')
                          : lastReceipt.method}
                      </span>
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
                <div className={`mt-3 pt-3 border-t ${borderClass} space-y-2`}>
                  <button
                    onClick={() => window.print()}
                    className={`w-full py-2.5 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2`}
                  >
                    <Printer className="w-4 h-4" /> Print Receipt
                  </button>
                  <button
                    onClick={newTransaction}
                    className="w-full py-2 text-accent-500 font-bold text-[10px] uppercase text-center"
                  >
                    New Transaction
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Toast */}
      {toast.show && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/10 animate-fade-in">
            <CheckCircle className="w-5 h-5 text-positive-500" />
            <span className="font-bold text-[10px] uppercase tracking-wider">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${surfaceClass} w-full max-w-sm rounded-3xl p-10 shadow-2xl text-center animate-fade-in`}>
            <div className={`w-16 h-16 ${bgClass} rounded-full flex items-center justify-center mx-auto mb-6`}>
              <HelpCircle className="w-8 h-8 text-accent-500" />
            </div>
            <h2 className={`text-lg font-black uppercase ${textClass} mb-2`}>{confirmData.title}</h2>
            <p className={`text-xs ${mutedClass} font-medium mb-8`}>{confirmData.message}</p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirm(false)}
                className={`flex-1 py-4 border ${borderClass} rounded-2xl font-black text-[10px] uppercase ${mutedClass} ${surfaceClass} hover:bg-slate-50`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmData.onConfirm?.();
                  setShowConfirm(false);
                }}
                className={`flex-1 py-4 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-2xl font-black text-[10px] uppercase shadow-lg`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Modal (Void/Review with reason) */}
      {showRequestModal && requestModalData.sale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${surfaceClass} w-full max-w-md rounded-3xl shadow-2xl animate-fade-in overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${borderClass} flex items-center justify-between ${
              requestModalData.type === 'Void' ? 'bg-negative-50' : 'bg-accent-50'
            } ${darkMode ? (requestModalData.type === 'Void' ? 'bg-red-900/20' : 'bg-accent-900/20') : ''}`}>
              <h2 className={`text-lg font-black uppercase ${requestModalData.type === 'Void' ? 'text-negative-600' : 'text-accent-600'}`}>
                {requestModalData.type === 'Void' ? (
                  <><XCircle className="w-5 h-5 inline mr-2" />Void Request</>
                ) : (
                  <><Eye className="w-5 h-5 inline mr-2" />Review Request</>
                )}
              </h2>
              <button
                onClick={() => {
                  setShowRequestModal(false);
                  setRequestModalData({ sale: null, type: '', reason: '' });
                }}
                className={`p-2 ${mutedClass} hover:text-negative-500 rounded-lg transition-colors`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {/* Sale Info */}
              <div className={`p-3 rounded-xl ${bgClass} border ${borderClass} mb-4`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className={`text-[10px] font-bold ${textClass}`}>
                      #{requestModalData.sale.transactionNumber?.slice(-8) || requestModalData.sale.id.slice(-8)}
                    </p>
                    <p className={`text-[9px] ${mutedClass}`}>
                      {new Date(requestModalData.sale.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className={`text-lg font-black text-accent-500`}>
                    {formatCurrency(requestModalData.sale.finalAmount)}
                  </p>
                </div>
              </div>

              {/* Reason Input */}
              <div className="mb-6">
                <label className={`block text-[10px] font-bold uppercase mb-2 ${mutedClass}`}>
                  Reason for {requestModalData.type} Request <span className="text-negative-500">*</span>
                </label>
                <textarea
                  value={requestModalData.reason}
                  onChange={(e) => setRequestModalData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder={requestModalData.type === 'Void'
                    ? 'e.g., Customer changed their mind, Wrong items entered...'
                    : 'e.g., Price discrepancy, Need approval for discount...'
                  }
                  rows={4}
                  className={`w-full ${bgClass} border ${borderClass} rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-accent-500 ${textClass} resize-none`}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRequestModal(false);
                    setRequestModalData({ sale: null, type: '', reason: '' });
                  }}
                  className={`flex-1 py-3.5 border ${borderClass} rounded-xl font-bold text-[10px] uppercase ${mutedClass} ${surfaceClass} hover:bg-slate-50 transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={submitRequest}
                  disabled={sendingRequest || !requestModalData.reason.trim()}
                  className={`flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase transition-colors flex items-center justify-center gap-2 ${
                    requestModalData.reason.trim() && !sendingRequest
                      ? requestModalData.type === 'Void'
                        ? 'bg-negative-500 text-white hover:bg-negative-600'
                        : 'bg-accent-500 text-white hover:bg-accent-600'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {sendingRequest ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    <>Send Request</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${surfaceClass} w-full max-w-md rounded-3xl shadow-2xl animate-fade-in overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${borderClass} flex items-center justify-between`}>
              <h2 className={`text-lg font-black uppercase ${textClass}`}>New Customer</h2>
              <button
                onClick={() => setShowCustomerModal(false)}
                className={`p-2 ${mutedClass} hover:text-negative-500 rounded-lg transition-colors`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-[10px] font-bold uppercase mb-1.5 ${mutedClass}`}>
                  Name <span className="text-negative-500">*</span>
                </label>
                <div className="relative">
                  <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className={`w-full ${bgClass} border ${borderClass} rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold focus:outline-none focus:border-accent-500 ${textClass}`}
                    placeholder="Customer name"
                  />
                </div>
              </div>
              <div>
                <label className={`block text-[10px] font-bold uppercase mb-1.5 ${mutedClass}`}>Phone</label>
                <div className="relative">
                  <Phone className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className={`w-full ${bgClass} border ${borderClass} rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold focus:outline-none focus:border-accent-500 ${textClass}`}
                    placeholder="+1 234 567 8900"
                  />
                </div>
              </div>
              <div>
                <label className={`block text-[10px] font-bold uppercase mb-1.5 ${mutedClass}`}>Email</label>
                <div className="relative">
                  <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    className={`w-full ${bgClass} border ${borderClass} rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold focus:outline-none focus:border-accent-500 ${textClass}`}
                    placeholder="customer@example.com"
                  />
                </div>
              </div>
              <div>
                <label className={`block text-[10px] font-bold uppercase mb-1.5 ${mutedClass}`}>Address</label>
                <div className="relative">
                  <MapPin className={`absolute left-3 top-3 w-4 h-4 ${mutedClass}`} />
                  <textarea
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    rows="2"
                    className={`w-full ${bgClass} border ${borderClass} rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold focus:outline-none focus:border-accent-500 ${textClass} resize-none`}
                    placeholder="Street, City"
                  />
                </div>
              </div>
              <div>
                <label className={`block text-[10px] font-bold uppercase mb-1.5 ${mutedClass}`}>Notes</label>
                <div className="relative">
                  <FileText className={`absolute left-3 top-3 w-4 h-4 ${mutedClass}`} />
                  <textarea
                    value={newCustomer.notes}
                    onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                    rows="2"
                    className={`w-full ${bgClass} border ${borderClass} rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold focus:outline-none focus:border-accent-500 ${textClass} resize-none`}
                    placeholder="Special notes..."
                  />
                </div>
              </div>
            </div>
            <div className={`px-6 py-4 border-t ${borderClass} flex gap-3`}>
              <button
                onClick={() => setShowCustomerModal(false)}
                className={`flex-1 py-3 border ${borderClass} rounded-xl font-bold text-[10px] uppercase ${mutedClass} ${surfaceClass} hover:bg-slate-50`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomer}
                disabled={savingCustomer}
                className={`flex-1 py-3 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-xl font-black text-[10px] uppercase shadow-lg disabled:opacity-50`}
              >
                {savingCustomer ? 'Saving...' : 'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Reprint Modal */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${surfaceClass} rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in max-h-[90vh] flex flex-col`}>
            {/* Modal Header */}
            <div className={`px-5 py-4 border-b ${borderClass} flex justify-between items-center`}>
              <h3 className={`text-sm font-black uppercase ${textClass}`}>Receipt</h3>
              <button
                onClick={() => setShowReceiptModal(false)}
                className={`p-1.5 rounded-lg ${mutedClass} hover:${textClass} hover:bg-slate-100`}
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
                  <span className={textClass}>{receiptData.cashier || user?.fullName}</span>
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
                    <span className="text-positive-600">Change:</span>
                    <span className="text-positive-600">{formatCurrency(receiptData.change)}</span>
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

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .fixed.inset-0 {
            position: absolute;
            background: white !important;
          }
          .fixed.inset-0 > div {
            visibility: visible;
            position: absolute;
            left: 50%;
            top: 0;
            transform: translateX(-50%);
            max-width: 300px;
            box-shadow: none !important;
          }
          .fixed.inset-0 > div * {
            visibility: visible;
          }
          .fixed.inset-0 button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CashierPOS;
