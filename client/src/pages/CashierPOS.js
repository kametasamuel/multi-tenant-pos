import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { productsAPI, salesAPI, customersAPI, usersAPI, securityRequestsAPI, attendantsAPI, tablesAPI, ordersAPI, modifiersAPI } from '../api';
import { useSocket } from '../hooks/useSocket';
import TableSelector from '../components/TableSelector';
import ModifierModal from '../components/ModifierModal';
import OfflineIndicator from '../components/OfflineIndicator';
import DraftRecoveryDialog from '../components/DraftRecoveryDialog';
import { savePendingSale, getCachedProducts } from '../utils/offlineDB';
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
  UserCog,
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
  Calendar,
  Edit2,
  Building2,
  UtensilsCrossed,
  ChefHat,
  Armchair,
  Send,
  Receipt
} from 'lucide-react';

// Switch Table Modal Component
const SwitchTableModal = ({ currentTable, onSwitch, onClose, darkMode }) => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(null);

  const surfaceClass = darkMode ? 'bg-slate-800' : 'bg-white';
  const textClass = darkMode ? 'text-white' : 'text-gray-900';
  const mutedClass = darkMode ? 'text-slate-400' : 'text-gray-500';
  const borderClass = darkMode ? 'border-slate-700' : 'border-gray-200';

  useEffect(() => {
    loadAvailableTables();
  }, []);

  const loadAvailableTables = async () => {
    try {
      const response = await tablesAPI.getAll({ status: 'available' });
      // Filter out the current table
      const availableTables = (response.data.tables || []).filter(
        t => t.id !== currentTable?.id && (t.status === 'available' || !t.orders?.length)
      );
      setTables(availableTables);
    } catch (error) {
      console.error('Failed to load tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitch = async (tableId) => {
    setSwitching(tableId);
    await onSwitch(tableId);
    setSwitching(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`${surfaceClass} rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col animate-fade-in`}>
        {/* Header */}
        <div className={`p-4 border-b ${borderClass} flex items-center justify-between`}>
          <div>
            <h2 className={`text-lg font-black uppercase ${textClass}`}>
              Switch Table
            </h2>
            <p className={`text-xs ${mutedClass}`}>
              Move order from Table {currentTable?.tableNumber} to another table
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500"></div>
            </div>
          ) : tables.length === 0 ? (
            <div className={`text-center py-8 ${mutedClass}`}>
              <Armchair className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No available tables</p>
              <p className="text-xs">All tables are currently occupied</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {tables.map(table => (
                <button
                  key={table.id}
                  onClick={() => handleSwitch(table.id)}
                  disabled={switching !== null}
                  className={`p-3 rounded-xl border-2 ${
                    switching === table.id
                      ? 'border-accent-500 bg-accent-50'
                      : darkMode
                        ? 'border-slate-600 hover:border-accent-500'
                        : 'border-gray-200 hover:border-accent-500'
                  } transition-all disabled:opacity-50`}
                >
                  <div className={`text-lg font-black ${textClass}`}>
                    {table.tableNumber}
                  </div>
                  <div className={`text-[10px] ${mutedClass}`}>
                    {table.capacity} seats
                  </div>
                  {table.section && (
                    <div className={`text-[9px] ${mutedClass}`}>
                      {table.section}
                    </div>
                  )}
                  {switching === table.id && (
                    <div className="text-[10px] text-accent-500 font-bold mt-1">
                      Moving...
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t ${borderClass}`}>
          <button
            onClick={onClose}
            disabled={switching !== null}
            className={`w-full py-2.5 border ${darkMode ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-600'} rounded-xl font-bold text-sm uppercase hover:opacity-80 disabled:opacity-50`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

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

  // Attendants state (for service assignment)
  const [attendants, setAttendants] = useState([]);
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

  // Customer edit modal state
  const [showCustomerEditModal, setShowCustomerEditModal] = useState(false);
  const [editCustomerData, setEditCustomerData] = useState({ name: '', phone: '', email: '' });
  const [updatingCustomer, setUpdatingCustomer] = useState(false);

  // Modals
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '', onConfirm: null });
  const [toast, setToast] = useState({ show: false, message: '' });
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  // Date/Time
  const [currentTime, setCurrentTime] = useState(new Date());

  // Mobile responsiveness - toggle between products and cart on small screens
  const [mobileView, setMobileView] = useState('products'); // 'products' or 'cart'

  // Restaurant features (FOOD_AND_BEVERAGE only)
  const [showTableSelector, setShowTableSelector] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [openTabs, setOpenTabs] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [sendingToKitchen, setSendingToKitchen] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [selectedProductForModifier, setSelectedProductForModifier] = useState(null);
  const [pendingProduct, setPendingProduct] = useState(null); // Product waiting for table selection
  const [showTabSummary, setShowTabSummary] = useState(false); // Tab Summary modal
  const [tabSummaryMode, setTabSummaryMode] = useState('view'); // 'view', 'payment', 'amount', 'receipt'
  const [tableSummary, setTableSummary] = useState(null); // Summary data for all table orders
  const [loadingTabSummary, setLoadingTabSummary] = useState(false);
  const [closingTable, setClosingTable] = useState(false);
  const [showSwitchTable, setShowSwitchTable] = useState(false); // Switch table modal
  // Restaurant payment flow state
  const [tabPaymentMethod, setTabPaymentMethod] = useState('');
  const [tabSplitPayment, setTabSplitPayment] = useState(false);
  const [tabSplitMethods, setTabSplitMethods] = useState([]); // [{method: 'cash', amount: 100}]
  const [tabAmountTendered, setTabAmountTendered] = useState('');
  const [tabReceiptData, setTabReceiptData] = useState(null);
  const [showCancelRequest, setShowCancelRequest] = useState(false); // Cancel request modal
  const [cancelRequestReason, setCancelRequestReason] = useState('');
  const [sendingCancelRequest, setSendingCancelRequest] = useState(false);

  // Offline state
  const { isOnline, saveDraft, getDraft, clearDraft, pendingSalesCount } = useOffline();
  const [showDraftRecovery, setShowDraftRecovery] = useState(false);
  const [draftData, setDraftData] = useState(null);

  // Check if restaurant features should be shown
  const isRestaurant = user?.businessType === 'FOOD_AND_BEVERAGE';

  // Currency from tenant settings
  const currencySymbol = user?.currencySymbol || '$';

  // Socket connection for real-time kitchen updates
  const { on: socketOn, isConnected: socketConnected } = useSocket({
    autoConnect: isRestaurant,
    room: 'kitchen'
  });

  // Handle real-time order updates from kitchen
  useEffect(() => {
    if (!socketConnected || !isRestaurant) return;

    // When kitchen updates an order
    socketOn('order:updated', (data) => {
      if (activeOrder && data.order.id === activeOrder.id) {
        console.log('Order updated via WebSocket:', data.order.status);
        setActiveOrder(data.order);
        // Update cart item statuses
        if (data.order.items) {
          setCart(prevCart => prevCart.map(cartItem => {
            const orderItem = data.order.items.find(oi =>
              oi.id === cartItem.orderItemId ||
              (oi.productId === cartItem.id && cartItem.isExisting)
            );
            if (orderItem) {
              return { ...cartItem, itemStatus: orderItem.status, orderItemId: orderItem.id };
            }
            return cartItem;
          }));
        }
      }
    });

    // When a single item is updated
    socketOn('order:item-updated', (data) => {
      if (activeOrder && data.orderId === activeOrder.id) {
        console.log('Item updated via WebSocket:', data.item.status);
        setCart(prevCart => prevCart.map(cartItem => {
          if (cartItem.orderItemId === data.item.id) {
            return { ...cartItem, itemStatus: data.item.status };
          }
          return cartItem;
        }));
      }
    });

    // When order is completed by kitchen
    socketOn('order:completed', (data) => {
      if (activeOrder && data.orderId === activeOrder.id) {
        console.log('Order completed via WebSocket');
        // Could show a notification here
      }
    });
  }, [socketConnected, isRestaurant, activeOrder?.id, socketOn]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadProducts();
    loadTodaySales();
    loadAttendants();
    loadSecurityRequests();
  }, [isOnline]); // Re-load when online status changes

  // Check for draft transaction on load (power interruption recovery)
  useEffect(() => {
    const checkForDraft = async () => {
      try {
        const draft = await getDraft();
        if (draft && draft.cart?.length > 0) {
          setDraftData(draft);
          setShowDraftRecovery(true);
        }
      } catch (error) {
        console.error('Error checking for draft:', error);
      }
    };
    checkForDraft();
  }, [getDraft]);

  // Auto-save cart as draft (for power interruption recovery)
  useEffect(() => {
    const saveTimer = setTimeout(() => {
      if (cart.length > 0) {
        saveDraft({
          cart,
          customer: selectedCustomer,
          discount: 0,
          paymentMethod: selectedPayment
        }).catch(err => console.error('Error saving draft:', err));
      } else {
        // Clear draft when cart is empty
        clearDraft().catch(err => console.error('Error clearing draft:', err));
      }
    }, 1000); // Save after 1 second of no changes

    return () => clearTimeout(saveTimer);
  }, [cart, selectedCustomer, selectedPayment, saveDraft, clearDraft]);

  // Check for low stock items when products load
  useEffect(() => {
    const lowStock = products.filter(p =>
      p.type === 'PRODUCT' && p.stockQuantity <= (p.lowStockThreshold || 10)
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
      // Try to load from API first
      if (isOnline) {
        const response = await productsAPI.getAll();
        const activeProducts = response.data.products.filter(p => p.isActive);
        setProducts(activeProducts);
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error('Error loading products from API:', error);
    }

    // Fall back to cached products when offline or API fails
    try {
      if (user?.tenantId) {
        const cachedProducts = await getCachedProducts(user.tenantId);
        if (cachedProducts && cachedProducts.length > 0) {
          console.log(`Loaded ${cachedProducts.length} products from cache`);
          setProducts(cachedProducts.filter(p => p.isActive));
        } else {
          console.warn('No cached products available');
        }
      }
    } catch (cacheError) {
      console.error('Error loading cached products:', cacheError);
    }
    setLoading(false);
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

  const loadAttendants = async () => {
    try {
      const response = await attendantsAPI.getAll({ isActive: 'true' });
      setAttendants(response.data.attendants || []);
    } catch (error) {
      console.error('Error loading attendants:', error);
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

  // Load open tabs for restaurant mode
  const loadOpenTabs = async () => {
    if (!isRestaurant) return;
    try {
      const response = await ordersAPI.getOpenTabs();
      setOpenTabs(response.data.orders || []);
    } catch (error) {
      console.error('Error loading open tabs:', error);
    }
  };

  // Load open tabs on mount for restaurants
  useEffect(() => {
    if (isRestaurant) {
      loadOpenTabs();
    }
  }, [isRestaurant]);

  // Auto-refresh order status from kitchen (every 15 seconds)
  useEffect(() => {
    if (!isRestaurant || !activeOrder) return;

    const refreshOrderStatus = async () => {
      try {
        const response = await ordersAPI.refreshOrder(activeOrder.id);
        const updatedOrder = response.data.order;

        // Update activeOrder with fresh status
        setActiveOrder(updatedOrder);

        // Update cart items with their latest statuses
        if (updatedOrder.items && updatedOrder.items.length > 0) {
          setCart(prevCart => {
            return prevCart.map(cartItem => {
              // Find matching order item by orderItemId or productId
              const orderItem = updatedOrder.items.find(oi =>
                oi.id === cartItem.orderItemId ||
                (oi.productId === cartItem.id && cartItem.isExisting)
              );

              if (orderItem) {
                return {
                  ...cartItem,
                  itemStatus: orderItem.status, // pending, preparing, ready, served
                  orderItemId: orderItem.id
                };
              }
              return cartItem;
            });
          });
        }
      } catch (error) {
        console.error('Error refreshing order status:', error);
      }
    };

    // Initial refresh
    refreshOrderStatus();

    // Set up polling interval as fallback (less frequent if socket connected)
    const interval = setInterval(refreshOrderStatus, socketConnected ? 30000 : 5000);
    return () => clearInterval(interval);
  }, [isRestaurant, activeOrder?.id, socketConnected]);

  // Auto-refresh table summary when tab modal is open (for real-time kitchen status)
  useEffect(() => {
    if (!showTabSummary || !selectedTable) return;

    const refreshTableSummary = async () => {
      try {
        const response = await ordersAPI.getTableSummary(selectedTable.id);
        setTableSummary(response.data);
      } catch (error) {
        console.error('Error refreshing table summary:', error);
      }
    };

    // Poll every 5 seconds while modal is open
    const interval = setInterval(refreshTableSummary, 5000);
    return () => clearInterval(interval);
  }, [showTabSummary, selectedTable?.id]);


  // Handle table selection
  const handleTableSelect = async (table) => {
    setSelectedTable(table);
    setShowTableSelector(false);

    // If table has an open order, load it
    if (table.orders && table.orders.length > 0) {
      const openOrder = table.orders[0];
      setActiveOrder(openOrder);
      setOrderNotes(openOrder.notes || '');
      // Load order items into cart for display (but don't add to new items)
      if (openOrder.items && openOrder.items.length > 0) {
        const cartItems = openOrder.items.map(item => ({
          id: item.product?.id || item.productId,
          name: item.product?.name || 'Item',
          sellingPrice: item.unitPrice,
          quantity: item.quantity,
          qty: item.quantity,
          image: item.product?.image,
          orderItemId: item.id,
          modifiers: item.modifiers ? JSON.parse(item.modifiers) : [],
          specialRequest: item.specialRequest,
          itemStatus: item.status, // Include item status from kitchen
          isExisting: true // Mark as existing item
        }));
        setCart(cartItems);
      }
      showToast(`Loaded order ${openOrder.orderNumber} for Table ${table.tableNumber}`);
    } else {
      // New order for this table
      setActiveOrder(null);
      setOrderNotes('');
      setCart([]);
    }
    setOrderType('Dine-in');

    // If there was a pending product, add it now
    if (pendingProduct) {
      const productToAdd = pendingProduct;
      setPendingProduct(null);

      // Check for modifiers
      try {
        const response = await modifiersAPI.getForProduct(productToAdd.id);
        const modifiers = response.data.modifiers || [];

        if (modifiers.length > 0) {
          // Show modifier modal
          setSelectedProductForModifier(productToAdd);
          setShowModifierModal(true);
          return;
        }
      } catch (err) {
        console.log('No modifiers found or error:', err);
      }

      // Add directly if no modifiers
      addToCart(productToAdd);
    }
  };

  // Send order to kitchen (restaurant mode)
  const sendToKitchen = async () => {
    // Get only new items (not existing ones from loaded order)
    const newItems = cart.filter(item => !item.isExisting);

    if (newItems.length === 0) {
      showToast('Add new items to send to kitchen');
      return;
    }

    if (orderType === 'Dine-in' && !selectedTable) {
      showToast('Please select a table first');
      setShowTableSelector(true);
      return;
    }

    setSendingToKitchen(true);
    try {
      const items = newItems.map(item => ({
        productId: item.id,
        quantity: parseInt(item.qty || item.quantity || 1, 10),
        modifiers: item.modifiers || [],
        specialRequest: item.specialRequest || null
      }));

      console.log('Sending items to kitchen:', items); // Debug log

      if (activeOrder) {
        // Add items to existing order
        await ordersAPI.addItems(activeOrder.id, items);
        showToast(`Items added to order ${activeOrder.orderNumber}`);
        // Mark all cart items as existing now
        setCart(cart.map(item => ({ ...item, isExisting: true })));
      } else {
        // Create new order - only include optional fields if they have values
        const orderData = {
          orderType: orderType.toLowerCase(), // 'Dine-in' -> 'dine-in', 'Walk-in' -> 'walk-in', 'Takeout' -> 'takeout'
          items
        };
        // Only add optional fields if they have actual values
        if (selectedTable?.id) orderData.tableId = selectedTable.id;
        if (selectedCustomer?.id) orderData.customerId = selectedCustomer.id;
        if (orderNotes) orderData.notes = orderNotes;

        console.log('Creating order with data:', orderData); // Debug log
        const response = await ordersAPI.create(orderData);
        setActiveOrder(response.data.order);
        // Mark all cart items as existing now
        setCart(cart.map(item => ({ ...item, isExisting: true })));
        showToast(`Order ${response.data.order.orderNumber} sent to kitchen`);
      }

      loadOpenTabs();
    } catch (error) {
      console.error('Error sending to kitchen:', error);
      console.error('Error response:', error.response?.data); // Debug full error
      const errorMessage = error.response?.data?.error ||
                          error.response?.data?.errors?.[0]?.msg ||
                          'Failed to send order to kitchen';
      showToast(errorMessage);
    } finally {
      setSendingToKitchen(false);
    }
  };

  // Load table summary for Tab modal (view or close mode)
  const loadTableSummary = async (mode = 'view') => {
    if (!selectedTable) {
      showToast('No table selected');
      return;
    }

    setLoadingTabSummary(true);
    setTabSummaryMode(mode);
    try {
      const response = await ordersAPI.getTableSummary(selectedTable.id);
      setTableSummary(response.data);
      setShowTabSummary(true);
    } catch (error) {
      console.error('Error loading table summary:', error);
      showToast(error.response?.data?.error || 'Failed to load table summary');
    } finally {
      setLoadingTabSummary(false);
    }
  };

  // View tab - show summary and allow payment
  const viewTab = () => {
    if (!activeOrder && !selectedTable) {
      showToast('No active order to view');
      return;
    }
    // Reset payment state
    setTabSummaryMode('view');
    setTabPaymentMethod('');
    setTabSplitPayment(false);
    setTabSplitMethods([]);
    setTabAmountTendered('');
    setTabReceiptData(null);
    loadTableSummary('view');
  };

  // No longer used - payment is done through viewTab modal
  const closeTab = () => {
    viewTab();
  };

  // Check if all items are served (for enabling close tab)
  const allItemsServed = () => {
    if (!tableSummary?.allItems) return false;
    return tableSummary.allItems.every(item => item.status === 'served');
  };

  // Switch table - move order to different table
  const handleSwitchTable = async (newTableId) => {
    if (!activeOrder || !newTableId) return;

    try {
      const response = await ordersAPI.switchTable(activeOrder.id, newTableId);
      showToast(`Order moved to Table ${response.data.order.table?.tableNumber}`);
      setShowSwitchTable(false);
      // Update local state with new table
      setSelectedTable(response.data.order.table);
      setActiveOrder(response.data.order);
      loadOpenTabs();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to switch table');
    }
  };

  // Request cancel for order (cashier can't cancel directly once sent to kitchen)
  const requestCancelOrder = async () => {
    if (!activeOrder || !cancelRequestReason.trim()) {
      showToast('Please provide a reason for cancellation');
      return;
    }

    setSendingCancelRequest(true);
    try {
      const response = await ordersAPI.requestCancel(activeOrder.id, cancelRequestReason);

      if (response.data.requiresKitchenApproval) {
        showToast('Cancel request sent to kitchen for approval');
      } else {
        showToast('Cancel request submitted for manager approval');
      }

      setShowCancelRequest(false);
      setCancelRequestReason('');
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to send cancel request');
    } finally {
      setSendingCancelRequest(false);
    }
  };

  // Process restaurant payment (from tab summary modal)
  const processTabPayment = async () => {
    if (!selectedTable) return;

    const total = tableSummary?.summary?.total || 0;

    // Validate payment
    if (tabSplitPayment) {
      const splitTotal = tabSplitMethods.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
      if (splitTotal < total) {
        showToast(`Split payments (${formatCurrency(splitTotal)}) don't cover the total (${formatCurrency(total)})`);
        return;
      }
    } else if (!tabPaymentMethod) {
      showToast('Please select a payment method');
      return;
    }

    // For cash, validate amount
    if (!tabSplitPayment && tabPaymentMethod === 'cash') {
      const tendered = parseFloat(tabAmountTendered) || 0;
      if (tendered < total) {
        showToast('Amount tendered is less than total');
        return;
      }
    }

    setClosingTable(true);
    try {
      // Determine payment method and amount
      let paymentMethod = tabPaymentMethod;
      let amountReceived = total;

      if (tabSplitPayment) {
        // For split payment, use 'split' as method and pass details
        paymentMethod = 'split';
        amountReceived = tabSplitMethods.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
      } else if (tabPaymentMethod === 'cash') {
        amountReceived = parseFloat(tabAmountTendered) || total;
      }

      const response = await ordersAPI.closeTable(selectedTable.id, {
        paymentMethod,
        amountReceived,
        splitPayments: tabSplitPayment ? tabSplitMethods : null
      });

      // Update stats
      if (response.data.sale) {
        setStats(prev => ({
          orders: prev.orders + 1,
          revenue: prev.revenue + response.data.sale.finalAmount
        }));
      }

      // Store receipt data for the modal
      const calculatedChange = tabPaymentMethod === 'cash' && !tabSplitPayment
        ? (parseFloat(tabAmountTendered) || 0) - total
        : 0;

      setTabReceiptData({
        ...response.data.sale,
        items: tableSummary?.allItems || [],
        table: selectedTable,
        paymentMethod: tabSplitPayment ? 'Split Payment' : tabPaymentMethod,
        splitPayments: tabSplitPayment ? tabSplitMethods : null,
        amountTendered: tabPaymentMethod === 'cash' ? parseFloat(tabAmountTendered) : null,
        change: response.data.change || calculatedChange
      });

      // Switch to receipt view in modal
      setTabSummaryMode('receipt');

    } catch (error) {
      console.error('Error closing table:', error);
      showToast(error.response?.data?.error || 'Failed to process payment');
    } finally {
      setClosingTable(false);
    }
  };

  // Complete and close the tab summary modal after receipt
  const completeTabPayment = () => {
    setShowTabSummary(false);
    setTableSummary(null);
    setTabReceiptData(null);
    clearRestaurantOrder();
    loadTodaySales();
    loadOpenTabs();
    showToast(`Table ${selectedTable?.tableNumber} closed successfully`);
  };

  // Add split payment method
  const addSplitMethod = (method) => {
    if (tabSplitMethods.some(m => m.method === method)) {
      // Remove if already exists
      setTabSplitMethods(tabSplitMethods.filter(m => m.method !== method));
    } else {
      // Add new method
      setTabSplitMethods([...tabSplitMethods, { method, amount: '' }]);
    }
  };

  // Update tab split payment amount
  const updateTabSplitAmount = (method, amount) => {
    setTabSplitMethods(tabSplitMethods.map(m =>
      m.method === method ? { ...m, amount } : m
    ));
  };

  // Legacy function - kept for compatibility
  const handleCloseTable = async (paymentMethod, amountReceived, tipAmount = 0) => {
    setTabPaymentMethod(paymentMethod);
    setTabAmountTendered(amountReceived?.toString() || '');
    await processTabPayment();
  };

  // Clear restaurant order state
  const clearRestaurantOrder = () => {
    setSelectedTable(null);
    setActiveOrder(null);
    setOrderNotes('');
    setCart([]);
    loadOpenTabs();
  };

  // Start new table (show table selector)
  const startNewTable = () => {
    clearRestaurantOrder();
    setShowTableSelector(true);
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

  const openEditCustomerModal = () => {
    if (selectedCustomer) {
      setEditCustomerData({
        name: selectedCustomer.name || '',
        phone: selectedCustomer.phone || '',
        email: selectedCustomer.email || ''
      });
      setShowCustomerEditModal(true);
    }
  };

  const handleUpdateCustomer = async () => {
    if (!editCustomerData.name.trim()) {
      showToast('Customer name is required');
      return;
    }

    setUpdatingCustomer(true);
    try {
      const response = await customersAPI.update(selectedCustomer.id, editCustomerData);
      const updatedCustomer = response.data.customer;
      setSelectedCustomer(updatedCustomer);
      setCustomerName(updatedCustomer.name);
      setShowCustomerEditModal(false);
      showToast('Customer updated');
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to update customer');
    } finally {
      setUpdatingCustomer(false);
    }
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

  // Get type tabs (All, Products, Services)
  const typeTabs = ['All', 'Products', 'Services'];

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesType = activeCategory === 'All' ||
      (activeCategory === 'Products' && p.type === 'PRODUCT') ||
      (activeCategory === 'Services' && p.type === 'SERVICE');
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const hasStock = p.type === 'SERVICE' || p.stockQuantity > 0;
    return matchesType && matchesSearch && hasStock;
  });

  // Handle product click - for restaurant, require table selection first
  const handleProductClick = async (product) => {
    // For restaurants, require table selection first
    if (isRestaurant && !selectedTable) {
      // Store the pending product and show table selector
      setPendingProduct(product);
      setShowTableSelector(true);
      showToast('Please select a table first');
      return;
    }

    // For restaurants, check if product has modifiers
    if (isRestaurant) {
      try {
        const response = await modifiersAPI.getForProduct(product.id);
        const modifiers = response.data.modifiers || [];

        if (modifiers.length > 0) {
          // Show modifier modal
          setSelectedProductForModifier(product);
          setShowModifierModal(true);
          return;
        }
      } catch (err) {
        // If error checking modifiers, just add without modifiers
        console.log('No modifiers found or error:', err);
      }
    }

    // No modifiers or not restaurant - add directly
    addToCart(product);
  };

  // Handle adding item with modifiers from modal
  const handleAddWithModifiers = ({ product, quantity, modifiers, specialRequest, modifierPrice }) => {
    const totalPrice = product.sellingPrice + (modifierPrice || 0);

    setCart(prev => [
      ...prev,
      {
        ...product,
        qty: quantity,
        quantity: quantity,
        sellingPrice: totalPrice,
        basePrice: product.sellingPrice,
        modifiers: modifiers || [],
        specialRequest: specialRequest,
        isExisting: false
      }
    ]);

    setShowModifierModal(false);
    setSelectedProductForModifier(null);
    showToast(`${product.name} added to cart`);
  };

  // Cart functions
  const addToCart = (product) => {
    if (product.type === 'PRODUCT') {
      const cartItem = cart.find(item => item.id === product.id && !item.modifiers?.length);
      const currentQty = cartItem ? (cartItem.qty || cartItem.quantity || 0) : 0;
      if (currentQty >= product.stockQuantity) {
        showToast('Not enough stock');
        return;
      }
    }

    setCart(prev => {
      // For restaurant, always add as new item (don't combine because of modifiers)
      if (isRestaurant) {
        return [...prev, {
          ...product,
          qty: 1,
          quantity: 1,
          modifiers: [],
          specialRequest: null,
          isExisting: false
        }];
      }

      // For non-restaurant, combine same products
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
      const currentQty = item.qty || item.quantity || 1;
      const newQty = currentQty + delta;

      if (item.type === 'PRODUCT' && newQty > item.stockQuantity) {
        showToast('Not enough stock');
        return prev;
      }

      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      return prev.map((cartItem, i) =>
        i === index ? { ...cartItem, qty: newQty, quantity: newQty } : cartItem
      );
    });
  };

  // Update attendant for a cart item (service only)
  const updateAttendant = (index, attendant) => {
    setCart(prev => prev.map((item, i) =>
      i === index ? { ...item, attendant: attendant } : item
    ));
  };

  const getCartTotal = () => {
    const subtotal = cart.reduce((sum, item) => {
      const itemQty = item.qty || item.quantity || 1;
      return sum + (item.sellingPrice * itemQty);
    }, 0);
    const tax = subtotal * (user?.taxRate || 0);
    return subtotal + tax;
  };

  const getSubtotal = () => {
    return cart.reduce((sum, item) => {
      const itemQty = item.qty || item.quantity || 1;
      return sum + (item.sellingPrice * itemQty);
    }, 0);
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
    // For non-cash payments, auto-fill the exact total (no change needed)
    if (method !== 'Cash') {
      setAmountTendered(getCartTotal().toString());
    } else {
      setAmountTendered('');
    }
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
    } else if (selectedPayment === 'Cash') {
      // For cash, must enter amount >= total
      return (parseFloat(amountTendered) || 0) >= total;
    } else {
      // For card/momo/transfer, just need a payment method selected
      return selectedPayment !== '';
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

      const methodMap = { 'Cash': 'CASH', 'Card': 'CARD', 'Momo': 'MOMO', 'Bank Transfer': 'BANK_TRANSFER' };

      const saleData = {
        items: cart.map(item => ({
          productId: item.id,
          quantity: item.qty,
          unitPrice: item.sellingPrice,
          discount: 0,
          attendantId: item.attendant?.id || null
        })),
        paymentMethod: methodMap[primaryMethod] || 'CASH',
        customerId: selectedCustomer?.id || null,
        discountAmount: 0
      };

      const total = getCartTotal();
      const tendered = isSplitPayment ? getSplitTotal() : parseFloat(amountTendered) || total;
      const change = Math.max(0, tendered - total);

      let response;
      let isOfflineSale = false;

      // Try online first, fall back to offline
      if (isOnline) {
        try {
          response = await salesAPI.create(saleData);
        } catch (error) {
          // If network error (no response), save offline
          if (!error.response) {
            isOfflineSale = true;
          } else {
            throw error; // Re-throw server errors
          }
        }
      } else {
        isOfflineSale = true;
      }

      // Handle offline sale
      if (isOfflineSale) {
        const localSale = await savePendingSale({
          ...saleData,
          offlineMode: true,
          cartItems: cart, // Save full cart for receipt
          total,
          tendered,
          change
        });

        // Generate local transaction number
        const localTransactionNumber = `OFF-${Date.now().toString(36).toUpperCase()}`;

        // Clear draft
        await clearDraft();

        setLastReceipt({
          invoiceNo: localTransactionNumber,
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
          change: change,
          offline: true
        });

        setStats(prev => ({
          orders: prev.orders + 1,
          revenue: prev.revenue + total
        }));

        setSidebarView('receipt');
        showToast('Sale saved offline - will sync when connected');
        setProcessingPayment(false);
        return;
      }

      // Online sale successful - clear draft
      await clearDraft();

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
  const newTransaction = async () => {
    setCart([]);
    clearCustomer();
    setSidebarView('cart');
    // Clear any saved draft
    await clearDraft();
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
      attendant: item.attendant || null
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
      <header className={`h-14 sm:h-16 ${surfaceClass} border-b ${borderClass} flex items-center justify-between px-2 sm:px-4 lg:px-8 shrink-0 z-50`}>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className={`w-8 h-8 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg`}>
            <Store className="w-4 h-4" />
          </div>
          <div className="hidden sm:block">
            <h1 className={`text-sm sm:text-base font-black tracking-tighter uppercase ${textClass}`}>Smart POS</h1>
            <p className={`text-[8px] font-bold uppercase tracking-widest ${mutedClass} truncate max-w-[120px] lg:max-w-none`}>
              {user?.fullName}
            </p>
          </div>
        </div>

        <div className="flex-1 max-w-md px-2 sm:px-8 hidden md:block">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${mutedClass} w-4 h-4`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className={`w-full ${bgClass} border ${borderClass} rounded-lg py-2 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-accent-500/20 text-sm font-semibold ${textClass}`}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Date/Time Display - Hidden on smaller screens */}
          <div className={`hidden xl:flex items-center gap-2 px-3 py-1.5 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-lg`}>
            <span className={`text-[9px] font-bold ${textClass}`}>
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {/* Offline Status Indicator */}
          <OfflineIndicator compact darkMode={darkMode} />
          {/* Low Stock Alert Button */}
          <button
            onClick={() => setView(view === 'lowStock' ? 'menu' : 'lowStock')}
            className={`relative w-8 h-8 border ${borderClass} rounded-lg flex items-center justify-center ${view === 'lowStock' ? 'bg-warning-500 text-white border-warning-500' : surfaceClass} ${textClass} transition-all`}
          >
            <AlertTriangle className={`w-4 h-4 ${lowStockItems.length > 0 && view !== 'lowStock' ? 'text-warning-500' : ''}`} />
            {lowStockItems.length > 0 && (
              <span className={`absolute -top-1 -right-1 bg-warning-500 text-white text-[7px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center`}>
                {lowStockItems.length}
              </span>
            )}
          </button>
          <button
            onClick={toggleTheme}
            className={`w-8 h-8 border ${borderClass} rounded-lg flex items-center justify-center ${surfaceClass} ${textClass} transition-all`}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setView(view === 'held' ? 'menu' : 'held')}
            className={`relative w-8 h-8 border ${borderClass} rounded-lg flex items-center justify-center ${surfaceClass} ${textClass} transition-all`}
          >
            <Layers className="w-4 h-4" />
            {heldOrders.length > 0 && (
              <span className={`absolute -top-1 -right-1 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} text-[7px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center`}>
                {heldOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => openConfirm('End Session?', 'This will log you out.', handleLogout)}
            className={`w-8 h-8 border ${borderClass} rounded-lg flex items-center justify-center ${textClass} hover:text-negative-500`}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>
      )}

      {/* Main Content */}
      <div className={`flex flex-col md:flex-row flex-1 overflow-hidden ${embedded ? 'p-2 gap-2' : managerView ? 'p-2 sm:p-3 gap-2 sm:gap-4' : 'p-2 sm:p-4 lg:px-12 gap-2 sm:gap-6'}`}>
        {/* Products Grid - Hidden on mobile when viewing cart */}
        <main className={`flex-1 overflow-y-auto pr-1 sm:pr-4 ${mobileView === 'cart' ? 'hidden md:block' : ''}`} style={{ scrollbarWidth: 'thin' }}>
          {view === 'menu' ? (
            <>
              {/* Search and Quick Actions - Mobile or Manager View */}
              <div className={`${managerView ? 'block' : 'md:hidden'} mb-3`}>
                <div className="flex gap-1.5 items-center">
                  <div className="relative flex-1">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${mutedClass} w-3.5 h-3.5`} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search..."
                      className={`w-full ${bgClass} border ${borderClass} rounded-lg py-2 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-accent-500/20 text-xs font-semibold ${textClass}`}
                    />
                  </div>
                  {/* Quick Actions for Manager View */}
                  {managerView && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setView(view === 'lowStock' ? 'menu' : 'lowStock')}
                        className={`relative w-8 h-8 border ${borderClass} rounded-lg flex items-center justify-center ${view === 'lowStock' ? 'bg-warning-500 text-white border-warning-500' : surfaceClass} ${textClass} transition-all`}
                        title="Low Stock"
                      >
                        <AlertTriangle className={`w-3.5 h-3.5 ${lowStockItems.length > 0 && view !== 'lowStock' ? 'text-warning-500' : ''}`} />
                        {lowStockItems.length > 0 && (
                          <span className={`absolute -top-0.5 -right-0.5 bg-warning-500 text-white text-[6px] font-black w-3 h-3 rounded-full flex items-center justify-center`}>
                            {lowStockItems.length}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setView(view === 'held' ? 'menu' : 'held')}
                        className={`relative w-8 h-8 border ${borderClass} rounded-lg flex items-center justify-center ${view === 'held' ? 'bg-accent-500 text-white border-accent-500' : surfaceClass} ${textClass} transition-all`}
                        title="Held Orders"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        {heldOrders.length > 0 && (
                          <span className={`absolute -top-0.5 -right-0.5 bg-accent-500 text-white text-[6px] font-black w-3 h-3 rounded-full flex items-center justify-center`}>
                            {heldOrders.length}
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Restaurant Table Indicator - Show selected table or prompt to select */}
              {isRestaurant && (
                <div className={`mb-3 p-2 sm:p-3 rounded-xl border-2 ${
                  selectedTable
                    ? 'border-blue-500 bg-blue-50 ' + (darkMode ? 'bg-blue-900/20' : '')
                    : 'border-orange-400 bg-orange-50 ' + (darkMode ? 'bg-orange-900/20' : '')
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Armchair className={`w-5 h-5 ${selectedTable ? 'text-blue-600' : 'text-orange-500'}`} />
                      <div>
                        {selectedTable ? (
                          <>
                            <div className={`text-sm font-black ${textClass}`}>
                              Table {selectedTable.tableNumber}
                              {activeOrder && (
                                <span className="ml-2 text-xs font-medium text-blue-600">
                                  {activeOrder.orderNumber}
                                </span>
                              )}
                            </div>
                            <div className={`text-[10px] ${mutedClass}`}>
                              {selectedTable.section && `${selectedTable.section} • `}
                              {selectedTable.capacity} seats
                              {activeOrder && ` • ${cart.length} items`}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className={`text-sm font-bold text-orange-600`}>
                              No table selected
                            </div>
                            <div className={`text-[10px] ${mutedClass}`}>
                              Select a table to start taking orders
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedTable && activeOrder && (
                        <button
                          onClick={startNewTable}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg ${bgClass} ${textClass} hover:bg-slate-200 transition-colors`}
                        >
                          New Table
                        </button>
                      )}
                      <button
                        onClick={() => setShowTableSelector(true)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                          selectedTable
                            ? 'bg-blue-500 text-white hover:bg-blue-600'
                            : 'bg-orange-500 text-white hover:bg-orange-600'
                        } transition-colors`}
                      >
                        {selectedTable ? 'Change Table' : 'Select Table'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Type Filters - All / Products / Services */}
              <div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4 overflow-x-auto pb-1 scrollbar-hide">
                {typeTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveCategory(tab)}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[8px] sm:text-[9px] font-bold uppercase tracking-wide whitespace-nowrap transition-all ${
                      activeCategory === tab
                        ? `${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} shadow-md`
                        : `${surfaceClass} border ${borderClass} ${mutedClass} hover:text-accent-500`
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Products */}
              <div className={`grid ${managerView ? 'grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4'} pb-16 md:pb-6`}>
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      if (product.is86d) {
                        showToast(`${product.name} is currently unavailable (86'd)`);
                        return;
                      }
                      isRestaurant ? handleProductClick(product) : addToCart(product);
                    }}
                    className={`${surfaceClass} border ${borderClass} rounded-xl sm:rounded-2xl p-2 sm:p-3 transition-all group relative ${
                      product.is86d
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer hover:border-accent-500 hover:shadow-lg'
                    }`}
                  >
                    {/* 86'd Badge */}
                    {product.is86d && (
                      <div className="absolute top-1 right-1 bg-red-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase">
                        86'd
                      </div>
                    )}
                    <div className={`aspect-square ${bgClass} rounded-lg sm:rounded-xl mb-1.5 sm:mb-2 flex items-center justify-center`}>
                      {product.type === 'SERVICE' ? (
                        <UserCog className={`w-5 h-5 sm:w-6 sm:h-6 ${mutedClass} ${!product.is86d && 'group-hover:text-accent-500'}`} />
                      ) : (
                        <Package className={`w-5 h-5 sm:w-6 sm:h-6 ${mutedClass} ${!product.is86d && 'group-hover:text-accent-500'}`} />
                      )}
                    </div>
                    <h3 className={`font-bold text-[9px] sm:text-[10px] uppercase tracking-tight mb-0.5 ${textClass} truncate ${product.is86d && 'line-through'}`}>
                      {product.name}
                    </h3>
                    <div className="flex justify-between items-center">
                      <span className={`${mutedClass} text-[7px] font-bold uppercase hidden sm:inline`}>
                        {product.type === 'SERVICE' ? 'Svc' : `${product.stockQuantity}`}
                      </span>
                      <span className={`font-black text-[10px] sm:text-xs ${textClass}`}>
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
        {/* Hidden on mobile when viewing products, shown when viewing cart */}
        <aside className={`w-full md:w-[280px] lg:w-[320px] xl:w-[360px] flex flex-col gap-2 sm:gap-3 shrink-0 min-h-0 overflow-hidden ${mobileView === 'products' ? 'hidden md:flex' : 'flex'}`} style={{ fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif" }}>
          {/* Stats Card - Clickable to show today's sales */}
          <div
            onClick={() => setView(view === 'sales' ? 'menu' : 'sales')}
            className={`${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-xl sm:rounded-2xl p-2.5 sm:p-3 shadow-lg flex justify-around items-center shrink-0 cursor-pointer hover:opacity-90 transition-opacity ${view === 'sales' ? 'ring-2 ring-accent-500' : ''}`}
          >
            <div className="text-center">
              <p className="text-[7px] sm:text-[8px] font-black uppercase opacity-60 tracking-wider sm:tracking-widest">Served</p>
              <p className="text-base sm:text-lg font-black">{stats.orders}</p>
            </div>
            <div className={`h-5 w-px ${darkMode ? 'bg-black/10' : 'bg-white/10'}`}></div>
            <div className="text-center">
              <p className="text-[7px] sm:text-[8px] font-black uppercase opacity-60 tracking-wider sm:tracking-widest">Sales</p>
              <p className="text-base sm:text-lg font-black">{formatCurrency(stats.revenue)}</p>
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {sidebarView === 'cart' && (
              <div className="flex flex-col flex-1 gap-4 min-h-0 overflow-hidden">
                {/* Customer Input with Autocomplete */}
                <div className={`${surfaceClass} border ${borderClass} rounded-xl sm:rounded-2xl p-2.5 sm:p-3 shrink-0 shadow-sm`}>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <User className={`absolute left-3 ${selectedCustomer ? 'top-2.5' : 'top-1/2 -translate-y-1/2'} ${mutedClass} w-3.5 h-3.5`} />
                      {selectedCustomer ? (
                        // Show selected customer with name and phone - clickable to edit
                        <div className={`w-full ${bgClass} border ${borderClass} rounded-lg py-1.5 pl-9 pr-16 min-h-[32px]`}>
                          <button
                            onClick={openEditCustomerModal}
                            className={`text-left w-full hover:opacity-70 transition-opacity`}
                            title="Click to edit customer"
                          >
                            <p className={`text-xs font-bold ${textClass} flex items-center gap-1`}>
                              {selectedCustomer.name}
                              <Edit2 className={`w-3 h-3 ${mutedClass}`} />
                            </p>
                            {selectedCustomer.phone && (
                              <p className={`text-[9px] ${mutedClass}`}>{selectedCustomer.phone}</p>
                            )}
                          </button>
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
                <div className={`${surfaceClass} border ${borderClass} rounded-xl sm:rounded-2xl p-3 sm:p-4 flex-1 flex flex-col shadow-sm min-h-0 overflow-hidden`}>
                  {/* Fixed Header */}
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <h3 className={`text-[10px] sm:text-xs font-black uppercase tracking-tight ${textClass}`}>Cart</h3>
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
                        {cart.map((item, idx) => {
                          const itemQty = item.qty || item.quantity || 1;
                          const isExistingItem = item.isExisting && isRestaurant;
                          return (
                          <div key={idx} className={`group py-2 border-b ${borderClass} last:border-0 ${isExistingItem ? 'opacity-70' : ''}`}>
                            <div className="flex flex-col gap-1.5">
                              {/* Product Name and Delete */}
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <h4 className={`text-[10px] font-bold uppercase ${textClass} truncate`} title={item.name}>{item.name}</h4>
                                    {/* Show kitchen status for existing items */}
                                    {isExistingItem && item.itemStatus && (
                                      <span className={`px-1.5 py-0.5 text-[7px] font-bold rounded ${
                                        item.itemStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                        item.itemStatus === 'preparing' ? 'bg-blue-100 text-blue-700' :
                                        item.itemStatus === 'ready' ? 'bg-green-100 text-green-700' :
                                        item.itemStatus === 'served' ? 'bg-purple-100 text-purple-700' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>
                                        {item.itemStatus === 'pending' ? '⏳ PENDING' :
                                         item.itemStatus === 'preparing' ? '🍳 PREPARING' :
                                         item.itemStatus === 'ready' ? '✅ READY' :
                                         item.itemStatus === 'served' ? '🍽️ SERVED' :
                                         item.itemStatus?.toUpperCase()}
                                      </span>
                                    )}
                                    {/* Fallback: Show SENT for existing items without status */}
                                    {isExistingItem && !item.itemStatus && (
                                      <span className="px-1.5 py-0.5 text-[7px] font-bold bg-green-100 text-green-700 rounded">
                                        SENT
                                      </span>
                                    )}
                                    {!item.isExisting && isRestaurant && selectedTable && (
                                      <span className="px-1.5 py-0.5 text-[7px] font-bold bg-orange-100 text-orange-700 rounded">
                                        NEW
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-[9px] font-bold ${mutedClass}`}>
                                    {formatCurrency(item.sellingPrice)} each
                                    {item.modifiers && item.modifiers.length > 0 && (
                                      <span className="ml-1 text-accent-500">
                                        +{item.modifiers.length} modifier{item.modifiers.length > 1 ? 's' : ''}
                                      </span>
                                    )}
                                  </p>
                                  {item.specialRequest && (
                                    <p className={`text-[8px] italic ${mutedClass}`}>
                                      Note: {item.specialRequest}
                                    </p>
                                  )}
                                </div>
                                {!isExistingItem ? (
                                  <button
                                    onClick={() => removeFromCart(idx)}
                                    className={`${mutedClass} hover:text-negative-500 shrink-0`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  /* Show cancel request for items not yet served */
                                  item.itemStatus && item.itemStatus !== 'served' && (
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Request to cancel "${item.name}"? Kitchen staff will need to approve.`)) {
                                          ordersAPI.requestCancel(activeOrder?.id, `Cancel item: ${item.name}`)
                                            .then(() => showToast('Cancel request sent to kitchen'))
                                            .catch(err => showToast(err.response?.data?.error || 'Failed to request cancel'));
                                        }
                                      }}
                                      className="text-[7px] px-1.5 py-0.5 bg-red-100 text-red-600 hover:bg-red-200 rounded font-bold shrink-0"
                                      title="Request cancellation (requires kitchen approval)"
                                    >
                                      Cancel
                                    </button>
                                  )
                                )}
                              </div>
                              {/* Quantity and Subtotal */}
                              <div className="flex items-center justify-between">
                                {isExistingItem ? (
                                  <span className={`text-[11px] font-black ${textClass}`}>x{itemQty}</span>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => updateQty(idx, -1)}
                                      className={`w-6 h-6 rounded-md ${bgClass} border ${borderClass} flex items-center justify-center hover:border-accent-500`}
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className={`w-6 text-center text-[11px] font-black ${textClass}`}>{itemQty}</span>
                                    <button
                                      onClick={() => updateQty(idx, 1)}
                                      className={`w-6 h-6 rounded-md ${bgClass} border ${borderClass} flex items-center justify-center hover:border-accent-500`}
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                                <span className={`text-[11px] font-black text-accent-500`}>
                                  {formatCurrency(item.sellingPrice * itemQty)}
                                </span>
                              </div>
                            </div>
                            {/* Attendant Selection for Services - Only show for SERVICES/SALON business type */}
                            {item.type === 'SERVICE' && attendants.length > 0 && ['SERVICES', 'SALON'].includes(user?.businessType) && !isExistingItem && (
                              <div className="mt-1.5 flex items-center gap-2">
                                <UserCog className={`w-3 h-3 ${mutedClass}`} />
                                <select
                                  value={item.attendant?.id || ''}
                                  onChange={(e) => {
                                    const attendant = attendants.find(a => a.id === e.target.value);
                                    updateAttendant(idx, attendant || null);
                                  }}
                                  className={`flex-1 text-[9px] py-1 px-2 rounded-md ${bgClass} border ${borderClass} ${textClass} focus:outline-none focus:border-accent-500`}
                                >
                                  <option value="">Select attendant (optional)...</option>
                                  {attendants.map(a => (
                                    <option key={a.id} value={a.id}>{a.fullName}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Order Notes for Restaurant */}
                  {isRestaurant && selectedTable && !activeOrder && cart.length > 0 && (
                    <div className={`pt-2 mt-2 border-t ${borderClass}`}>
                      <label className={`text-[9px] font-bold uppercase ${mutedClass} block mb-1`}>
                        Order Notes
                      </label>
                      <textarea
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="Special instructions, allergies, etc..."
                        className={`w-full text-[10px] p-2 rounded-lg ${bgClass} border ${borderClass} ${textClass} focus:outline-none focus:border-accent-500 resize-none`}
                        rows={2}
                      />
                    </div>
                  )}

                  {/* Fixed Total with Tax Breakdown */}
                  <div className={`pt-2 sm:pt-3 mt-2 sm:mt-3 border-t ${borderClass}`}>
                    {/* Subtotal */}
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-[9px] font-bold uppercase ${mutedClass}`}>Subtotal</span>
                      <span className={`text-[11px] font-bold ${textClass}`}>
                        {formatCurrency(getSubtotal())}
                      </span>
                    </div>
                    {/* Tax - only show if there's a tax rate */}
                    {user?.taxRate > 0 && (
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-[9px] font-bold uppercase ${mutedClass}`}>Tax ({(user.taxRate * 100).toFixed(0)}%)</span>
                        <span className={`text-[11px] font-bold ${textClass}`}>
                          {formatCurrency(getSubtotal() * user.taxRate)}
                        </span>
                      </div>
                    )}
                    {/* Total */}
                    <div className="flex justify-between items-end pt-1">
                      <span className={`text-[9px] sm:text-[10px] font-black uppercase ${mutedClass} leading-none`}>Total</span>
                      <span className="text-lg sm:text-xl font-black text-accent-500 leading-none">
                        {formatCurrency(getCartTotal())}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fixed Action Buttons */}
                <div className="flex flex-col gap-1.5 sm:gap-2">
                  {/* Restaurant mode actions */}
                  {isRestaurant ? (
                    <>
                      {/* Active order info */}
                      {activeOrder && (
                        <div className={`p-2 rounded-lg ${bgClass} border ${borderClass} mb-1`}>
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-bold ${textClass}`}>
                              {activeOrder.orderNumber}
                            </span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                              activeOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              activeOrder.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                              activeOrder.status === 'ready' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {activeOrder.status}
                            </span>
                          </div>
                          {selectedTable && (
                            <span className={`text-[9px] ${mutedClass}`}>Table {selectedTable.tableNumber}</span>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                        <button
                          onClick={() => {
                            // If there's an active order (sent to kitchen), check for served items
                            if (activeOrder) {
                              const existingItems = cart.filter(i => i.isExisting);
                              const allServed = existingItems.length > 0 && existingItems.every(i => i.itemStatus === 'served');
                              if (allServed) {
                                showToast('Cannot cancel - all items have been served');
                                return;
                              }
                              setShowCancelRequest(true);
                            } else if (cart.length === 0) {
                              clearRestaurantOrder();
                            } else {
                              openConfirm('Clear cart?', 'This will remove all items.', () => {
                                setCart([]);
                                clearRestaurantOrder();
                              });
                            }
                          }}
                          className={`py-2.5 sm:py-3 border border-negative-200 rounded-lg sm:rounded-xl text-negative-500 font-bold text-[9px] sm:text-[10px] uppercase hover:bg-negative-50 ${surfaceClass}`}
                        >
                          {activeOrder ? 'Request Cancel' : 'Cancel'}
                        </button>
                        <button
                          onClick={sendToKitchen}
                          disabled={cart.filter(i => !i.isExisting).length === 0 || sendingToKitchen}
                          className="py-2.5 sm:py-3 bg-orange-500 text-white rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase hover:bg-orange-600 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                        >
                          <Send className="w-3 h-3" />
                          {sendingToKitchen ? 'Sending...' : `Send ${cart.filter(i => !i.isExisting).length} to Kitchen`}
                        </button>
                      </div>
                      {/* Action buttons when there's an active order */}
                      {activeOrder && (
                        <>
                          {/* View Tab / Pay and New Table row */}
                          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                            <button
                              onClick={viewTab}
                              disabled={loadingTabSummary}
                              className="py-2.5 sm:py-3 bg-green-600 text-white rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase hover:bg-green-700 shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              <Receipt className="w-3 h-3" />
                              {loadingTabSummary ? 'Loading...' : 'View Tab / Pay'}
                            </button>
                            <button
                              onClick={() => {
                                // Start a new order on a different table
                                clearRestaurantOrder();
                                setShowTableSelector(true);
                              }}
                              className={`py-2.5 sm:py-3 ${darkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'} border rounded-lg sm:rounded-xl font-bold text-[9px] sm:text-[10px] uppercase hover:opacity-80 transition-all flex items-center justify-center gap-1.5`}
                            >
                              <Plus className="w-3 h-3" />
                              New Table
                            </button>
                          </div>
                        </>
                      )}
                      {/* Table selection for dine-in */}
                      {!selectedTable && (
                        <button
                          onClick={() => setShowTableSelector(true)}
                          className={`w-full py-2.5 sm:py-3 ${darkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-white text-slate-900 border-slate-900'} border rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase hover:opacity-80 transition-all flex items-center justify-center gap-1.5`}
                        >
                          <Armchair className="w-3 h-3" /> Select Table
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Standard POS actions */}
                      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                        <button
                          onClick={() => openConfirm('Clear cart?', 'This will remove all items.', clearCart)}
                          className={`py-2.5 sm:py-3 border border-negative-200 rounded-lg sm:rounded-xl text-negative-500 font-bold text-[9px] sm:text-[10px] uppercase hover:bg-negative-50 ${surfaceClass}`}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={showPayment}
                          className="py-2.5 sm:py-3 bg-green-600 text-white rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase hover:bg-green-700 shadow-lg"
                        >
                          Pay Now
                        </button>
                      </div>
                      <button
                        onClick={holdOrder}
                        className={`w-full py-2.5 sm:py-3 ${darkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-white text-slate-900 border-slate-900'} border rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase hover:opacity-80 transition-all flex items-center justify-center gap-1.5`}
                      >
                        <PauseCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Hold
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {sidebarView === 'payment' && (
              <div className={`${surfaceClass} border ${borderClass} rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-1 flex-col shadow-sm min-h-0 overflow-hidden`}>
                <button
                  onClick={goBackPayment}
                  className={`text-[10px] sm:text-xs font-bold ${mutedClass} mb-2 sm:mb-3 flex items-center gap-1`}
                >
                  ← {paymentStep === 'amount' ? 'Methods' : paymentStep === 'select' ? 'Order Type' : 'Cart'}
                </button>

                {/* Total Display */}
                <div className="mb-3 sm:mb-4">
                  <h2 className={`text-sm sm:text-base font-black uppercase mb-0.5 ${textClass}`}>
                    {paymentStep === 'orderType' ? 'Order Type' : paymentStep === 'select' ? 'Payment' : 'Amount'}
                  </h2>
                  <p className="text-accent-500 font-black text-xl sm:text-2xl">{formatCurrency(getCartTotal())}</p>
                </div>

                {/* Step 0: Select Order Type */}
                {paymentStep === 'orderType' && (
                  <div className="flex-1 overflow-y-auto">
                    <p className={`text-[9px] sm:text-[10px] font-bold ${mutedClass} mb-2`}>Select order type</p>
                    <div className="grid grid-cols-2 gap-1.5 sm:space-y-0 sm:grid-cols-1 sm:gap-2">
                      {(isRestaurant ? [
                        { id: 'Dine-in', label: 'Dine-in', icon: Armchair },
                        { id: 'Takeout', label: 'Takeout', icon: ShoppingBag },
                        { id: 'Delivery', label: 'Delivery', icon: Package }
                      ] : [
                        { id: 'Walk-in', label: 'Walk-in' },
                        { id: 'Delivery', label: 'Delivery' },
                        { id: 'Pickup', label: 'Pickup' },
                        { id: 'Out-service', label: 'Out-svc' }
                      ]).map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          onClick={() => {
                            setOrderType(id);
                            // Show table selector for dine-in if no table selected
                            if (id === 'Dine-in' && !selectedTable) {
                              setShowTableSelector(true);
                            }
                          }}
                          className={`p-2 sm:p-2.5 border rounded-lg sm:rounded-xl text-left transition-all ${
                            orderType === id
                              ? 'border-accent-500 bg-accent-50 ' + (darkMode ? 'bg-accent-900/30' : '')
                              : `${borderClass} hover:border-accent-300`
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {Icon && <Icon className={`w-4 h-4 ${orderType === id ? 'text-accent-500' : mutedClass}`} />}
                              <span className={`font-bold text-[10px] sm:text-xs ${textClass}`}>{label}</span>
                            </div>
                            {orderType === id && (
                              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-accent-500" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Show selected table for Dine-in */}
                    {isRestaurant && orderType === 'Dine-in' && (
                      <div className="mt-3">
                        <button
                          onClick={() => setShowTableSelector(true)}
                          className={`w-full p-2.5 border rounded-lg ${borderClass} flex items-center justify-between ${
                            selectedTable ? 'border-green-500 bg-green-50' : ''
                          } ${darkMode && selectedTable ? 'bg-green-900/20' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            <Armchair className={`w-4 h-4 ${selectedTable ? 'text-green-600' : mutedClass}`} />
                            <span className={`font-bold text-xs ${textClass}`}>
                              {selectedTable ? `Table ${selectedTable.tableNumber}` : 'Select Table'}
                            </span>
                          </div>
                          {selectedTable && <CheckCircle className="w-4 h-4 text-green-500" />}
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => setPaymentStep('select')}
                      className={`w-full mt-3 py-2.5 sm:py-3 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase`}
                    >
                      Continue
                    </button>
                  </div>
                )}

                {/* Step 1: Select Payment Method */}
                {paymentStep === 'select' && (
                  <div className="flex-1 overflow-y-auto">
                    {/* Split Payment Toggle */}
                    <div className={`mb-3 p-2 sm:p-2.5 rounded-lg ${bgClass} border ${borderClass}`}>
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className={`text-[10px] sm:text-xs font-bold ${textClass}`}>Split</span>
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={isSplitPayment}
                            onChange={toggleSplitPayment}
                            className="sr-only"
                          />
                          <div className={`w-8 h-4 rounded-full transition-colors ${isSplitPayment ? 'bg-accent-500' : darkMode ? 'bg-slate-600' : 'bg-gray-300'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full shadow transform transition-transform mt-0.5 ${isSplitPayment ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`}></div>
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* Payment Methods - Compact Cards */}
                    <div className="space-y-1.5 sm:space-y-2">
                      {[
                        { id: 'Cash', label: 'Cash', icon: Banknote },
                        { id: 'Card', label: 'Card', icon: CreditCard },
                        { id: 'Momo', label: 'MoMo', icon: Smartphone },
                        { id: 'Bank Transfer', label: 'Bank Transfer', icon: Building2 }
                      ].map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          onClick={() => isSplitPayment ? toggleMethod(id) : selectSingleMethod(id)}
                          className={`w-full p-2 sm:p-2.5 border rounded-lg sm:rounded-xl flex items-center gap-2 sm:gap-3 transition-all ${
                            isSplitPayment && selectedMethods.includes(id)
                              ? 'border-accent-500 bg-accent-50'
                              : `${borderClass} hover:bg-accent-50 hover:border-accent-500`
                          } ${darkMode && isSplitPayment && selectedMethods.includes(id) ? 'bg-accent-900/30' : ''} group`}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                            isSplitPayment && selectedMethods.includes(id)
                              ? 'bg-accent-500 text-white'
                              : `${bgClass} group-hover:bg-accent-500 group-hover:text-white`
                          }`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className={`font-bold text-[10px] sm:text-xs flex-1 text-left ${textClass}`}>{label}</span>
                          {isSplitPayment && selectedMethods.includes(id) && (
                            <CheckCircle className="w-3.5 h-3.5 text-accent-500" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Proceed Button for Split Payment */}
                    {isSplitPayment && selectedMethods.length >= 2 && (
                      <button
                        onClick={proceedToSplitAmount}
                        className="w-full mt-3 py-2.5 sm:py-3 bg-accent-500 text-white rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase hover:bg-accent-600 transition-colors"
                      >
                        Continue ({selectedMethods.length})
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
                                    <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold ${mutedClass}`}>
                                      {currencySymbol}
                                    </span>
                                    <input
                                      type="number"
                                      value={paymentAmounts[method] || ''}
                                      onChange={(e) => updateSplitAmount(method, e.target.value)}
                                      placeholder="0.00"
                                      className={`w-full ${bgClass} border ${borderClass} rounded-lg py-2 pl-10 pr-3 text-sm font-bold focus:outline-none focus:border-accent-500 ${textClass}`}
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
                          <div className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border ${borderClass}`}>
                            <div className="flex items-center gap-2 mb-2 sm:mb-3">
                              <div className={`w-6 h-6 sm:w-7 sm:h-7 ${bgClass} rounded-lg flex items-center justify-center`}>
                                {selectedPayment === 'Cash' && <Banknote className="w-3.5 h-3.5" />}
                                {selectedPayment === 'Card' && <CreditCard className="w-3.5 h-3.5" />}
                                {selectedPayment === 'Momo' && <Smartphone className="w-3.5 h-3.5" />}
                              </div>
                              <span className={`text-xs font-bold ${textClass}`}>{selectedPayment}</span>
                            </div>
                            <label className={`text-[9px] sm:text-[10px] font-bold uppercase ${mutedClass} mb-1.5 block`}>
                              Amount
                            </label>
                            <div className="relative">
                              <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-base sm:text-lg font-bold ${mutedClass}`}>
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
                                } rounded-lg sm:rounded-xl py-3 sm:py-4 pl-12 sm:pl-14 pr-3 text-xl sm:text-2xl font-black focus:outline-none focus:border-accent-500 ${textClass}`}
                              />
                            </div>
                          </div>

                          {/* Quick Amount Buttons for Cash */}
                          {selectedPayment === 'Cash' && (
                            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
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
                                  className={`py-2 px-2 border ${borderClass} rounded-lg text-[10px] sm:text-xs font-bold ${textClass} hover:border-accent-500 hover:bg-accent-50 transition-colors`}
                                >
                                  {formatCurrency(amount)}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Change Display */}
                          {amountTendered && parseFloat(amountTendered) >= getCartTotal() && (
                            <div className={`p-3 rounded-lg sm:rounded-xl bg-green-50 border border-green-200 ${darkMode ? 'bg-green-900/20 border-green-800' : ''}`}>
                              <div className="flex justify-between items-center">
                                <span className={`text-[10px] sm:text-xs font-bold uppercase ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
                                  Change
                                </span>
                                <span className={`text-xl sm:text-2xl font-black ${darkMode ? 'text-green-400' : 'text-positive-600'}`}>
                                  {formatCurrency(getChange())}
                                </span>
                              </div>
                            </div>
                          )}

                          {amountTendered && parseFloat(amountTendered) < getCartTotal() && (
                            <div className={`p-2 sm:p-3 rounded-lg bg-negative-50 border border-negative-200 ${darkMode ? 'bg-red-900/20 border-negative-800' : ''}`}>
                              <p className={`text-[10px] sm:text-xs font-bold ${darkMode ? 'text-negative-400' : 'text-negative-600'}`}>
                                Short by {formatCurrency(getCartTotal() - parseFloat(amountTendered))}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Confirm Payment Button */}
                    <div className="pt-3 sm:pt-4 mt-auto">
                      <button
                        onClick={processPayment}
                        disabled={!isPaymentValid() || processingPayment}
                        className={`w-full py-3 sm:py-4 rounded-lg sm:rounded-xl font-black text-xs sm:text-sm uppercase transition-all flex items-center justify-center gap-2 ${
                          isPaymentValid() && !processingPayment
                            ? 'bg-positive-500 text-white hover:bg-green-600 shadow-lg'
                            : `${darkMode ? 'bg-slate-700 text-slate-500' : 'bg-gray-200 text-gray-400'} cursor-not-allowed`
                        }`}
                      >
                        {processingPayment ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span className="hidden sm:inline">Processing...</span><span className="sm:hidden">...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="hidden sm:inline">Confirm Payment</span><span className="sm:hidden">Confirm</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {sidebarView === 'receipt' && lastReceipt && (
              <div className={`${surfaceClass} border ${borderClass} rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-1 flex-col shadow-sm overflow-hidden`}>
                <div className="flex-1 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                  {/* Header - Business Info */}
                  <div className="text-center mb-2 sm:mb-3">
                    <h1 className={`text-xs sm:text-sm font-black uppercase leading-tight ${textClass}`}>{user?.tenantName}</h1>
                    <p className={`text-[7px] sm:text-[8px] ${mutedClass} mt-0.5 hidden sm:block`}>{user?.tenant?.address || 'Business Address'}</p>
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
                            {item.attendant && (
                              <span className={`block text-[7px] ${mutedClass}`}>by {item.attendant.fullName}</span>
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
                <div className={`mt-2 sm:mt-3 pt-2 sm:pt-3 border-t ${borderClass} space-y-1.5 sm:space-y-2`}>
                  <button
                    onClick={() => window.print()}
                    className={`w-full py-2 sm:py-2.5 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase flex items-center justify-center gap-1.5`}
                  >
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                  <button
                    onClick={newTransaction}
                    className="w-full py-1.5 sm:py-2 text-accent-500 font-bold text-[9px] sm:text-[10px] uppercase text-center"
                  >
                    New Sale
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile Floating Cart Button - Shows when viewing products on mobile */}
      {mobileView === 'products' && cart.length > 0 && (
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-40">
          <button
            onClick={() => setMobileView('cart')}
            className={`w-full ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-2xl py-3 px-4 shadow-2xl flex items-center justify-between`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 ${darkMode ? 'bg-slate-900 text-white' : 'bg-white text-black'} rounded-xl flex items-center justify-center`}>
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase opacity-70">View Cart</p>
                <p className="text-xs font-black">{cart.reduce((sum, item) => sum + item.qty, 0)} items</p>
              </div>
            </div>
            <span className="text-lg font-black">{formatCurrency(getCartTotal())}</span>
          </button>
        </div>
      )}

      {/* Mobile Back to Products Button - Shows when viewing cart on mobile */}
      {mobileView === 'cart' && (
        <div className="md:hidden fixed top-2 left-2 z-40">
          <button
            onClick={() => setMobileView('products')}
            className={`${surfaceClass} border ${borderClass} rounded-xl py-2 px-3 shadow-lg flex items-center gap-2 text-xs font-bold ${textClass}`}
          >
            ← Products
          </button>
        </div>
      )}

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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className={`${surfaceClass} w-full max-w-xs sm:max-w-sm rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl text-center animate-fade-in`}>
            <div className={`w-12 h-12 sm:w-14 sm:h-14 ${bgClass} rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5`}>
              <HelpCircle className="w-6 h-6 sm:w-7 sm:h-7 text-accent-500" />
            </div>
            <h2 className={`text-base sm:text-lg font-black uppercase ${textClass} mb-1.5 sm:mb-2`}>{confirmData.title}</h2>
            <p className={`text-[10px] sm:text-xs ${mutedClass} font-medium mb-5 sm:mb-6`}>{confirmData.message}</p>
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className={`flex-1 py-3 sm:py-3.5 border ${borderClass} rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase ${mutedClass} ${surfaceClass}`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmData.onConfirm?.();
                  setShowConfirm(false);
                }}
                className={`flex-1 py-3 sm:py-3.5 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase shadow-lg`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Modal (Void/Review with reason) */}
      {showRequestModal && requestModalData.sale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className={`${surfaceClass} w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-3xl shadow-2xl animate-fade-in overflow-hidden`}>
            <div className={`px-4 sm:px-6 py-3 sm:py-4 border-b ${borderClass} flex items-center justify-between ${
              requestModalData.type === 'Void' ? 'bg-negative-50' : 'bg-accent-50'
            } ${darkMode ? (requestModalData.type === 'Void' ? 'bg-red-900/20' : 'bg-accent-900/20') : ''}`}>
              <h2 className={`text-base sm:text-lg font-black uppercase ${requestModalData.type === 'Void' ? 'text-negative-600' : 'text-accent-600'}`}>
                {requestModalData.type === 'Void' ? (
                  <><XCircle className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1.5" />Void</>
                ) : (
                  <><Eye className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1.5" />Review</>
                )}
              </h2>
              <button
                onClick={() => {
                  setShowRequestModal(false);
                  setRequestModalData({ sale: null, type: '', reason: '' });
                }}
                className={`p-1.5 ${mutedClass} hover:text-negative-500 rounded-lg transition-colors`}
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6">
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
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setShowRequestModal(false);
                    setRequestModalData({ sale: null, type: '', reason: '' });
                  }}
                  className={`flex-1 py-2.5 sm:py-3 border ${borderClass} rounded-lg sm:rounded-xl font-bold text-[9px] sm:text-[10px] uppercase ${mutedClass} ${surfaceClass} transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={submitRequest}
                  disabled={sendingRequest || !requestModalData.reason.trim()}
                  className={`flex-1 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase transition-colors flex items-center justify-center gap-1.5 ${
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
                      <span className="hidden sm:inline">Sending...</span>
                    </>
                  ) : (
                    <>Send</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className={`${surfaceClass} w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-3xl shadow-2xl animate-fade-in overflow-hidden max-h-[90vh] flex flex-col`}>
            <div className={`px-4 sm:px-6 py-3 sm:py-4 border-b ${borderClass} flex items-center justify-between shrink-0`}>
              <h2 className={`text-base sm:text-lg font-black uppercase ${textClass}`}>New Customer</h2>
              <button
                onClick={() => setShowCustomerModal(false)}
                className={`p-1.5 ${mutedClass} hover:text-negative-500 rounded-lg transition-colors`}
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
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
            <div className={`px-4 sm:px-6 py-3 sm:py-4 border-t ${borderClass} flex gap-2 sm:gap-3 shrink-0`}>
              <button
                onClick={() => setShowCustomerModal(false)}
                className={`flex-1 py-2.5 sm:py-3 border ${borderClass} rounded-lg sm:rounded-xl font-bold text-[9px] sm:text-[10px] uppercase ${mutedClass} ${surfaceClass}`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomer}
                disabled={savingCustomer}
                className={`flex-1 py-2.5 sm:py-3 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase shadow-lg disabled:opacity-50`}
              >
                {savingCustomer ? 'Saving...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Edit Modal */}
      {showCustomerEditModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className={`${surfaceClass} w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-3xl shadow-2xl animate-fade-in overflow-hidden max-h-[90vh] flex flex-col`}>
            <div className={`px-4 sm:px-6 py-3 sm:py-4 border-b ${borderClass} flex items-center justify-between shrink-0`}>
              <h2 className={`text-base sm:text-lg font-black uppercase ${textClass}`}>Edit Customer</h2>
              <button
                onClick={() => setShowCustomerEditModal(false)}
                className={`p-1.5 ${mutedClass} hover:text-negative-500 rounded-lg transition-colors`}
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
              <div>
                <label className={`block text-[10px] font-bold uppercase mb-1.5 ${mutedClass}`}>
                  Name <span className="text-negative-500">*</span>
                </label>
                <div className="relative">
                  <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
                  <input
                    type="text"
                    value={editCustomerData.name}
                    onChange={(e) => setEditCustomerData({ ...editCustomerData, name: e.target.value })}
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
                    value={editCustomerData.phone}
                    onChange={(e) => setEditCustomerData({ ...editCustomerData, phone: e.target.value })}
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
                    value={editCustomerData.email}
                    onChange={(e) => setEditCustomerData({ ...editCustomerData, email: e.target.value })}
                    className={`w-full ${bgClass} border ${borderClass} rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold focus:outline-none focus:border-accent-500 ${textClass}`}
                    placeholder="customer@example.com"
                  />
                </div>
              </div>
            </div>
            <div className={`px-4 sm:px-6 py-3 sm:py-4 border-t ${borderClass} flex gap-2 sm:gap-3 shrink-0`}>
              <button
                onClick={() => setShowCustomerEditModal(false)}
                className={`flex-1 py-2.5 sm:py-3 border ${borderClass} rounded-lg sm:rounded-xl font-bold text-[9px] sm:text-[10px] uppercase ${mutedClass} ${surfaceClass}`}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateCustomer}
                disabled={updatingCustomer}
                className={`flex-1 py-2.5 sm:py-3 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase shadow-lg disabled:opacity-50`}
              >
                {updatingCustomer ? 'Saving...' : 'Save'}
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
                        {item.attendant && (
                          <span className={`block text-[7px] ${mutedClass}`}>by {item.attendant.fullName}</span>
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

      {/* Table Selector Modal (Restaurant Mode) */}
      {showTableSelector && (
        <TableSelector
          onSelect={handleTableSelect}
          onClose={() => {
            setShowTableSelector(false);
            setPendingProduct(null); // Clear pending product if closed without selecting
          }}
          darkMode={darkMode}
          selectedTableId={selectedTable?.id}
        />
      )}

      {/* Modifier Modal (Restaurant Mode) */}
      {showModifierModal && selectedProductForModifier && (
        <ModifierModal
          product={selectedProductForModifier}
          onAdd={handleAddWithModifiers}
          onClose={() => {
            setShowModifierModal(false);
            setSelectedProductForModifier(null);
          }}
          darkMode={darkMode}
          currencySymbol={currencySymbol}
        />
      )}

      {/* Tab Summary Modal (Restaurant Mode) - Multi-step payment flow */}
      {showTabSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-fade-in`}>
            {/* Header */}
            <div className={`p-4 border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'} flex items-center justify-between`}>
              <div>
                <h2 className={`text-lg font-black uppercase ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {tabSummaryMode === 'receipt' ? 'Receipt' :
                   tabSummaryMode === 'payment' ? 'Payment' :
                   tabSummaryMode === 'amount' ? 'Amount' :
                   'Tab Summary'} - Table {selectedTable?.tableNumber}
                </h2>
                <p className="text-xl font-black text-accent-500">
                  {formatCurrency(tableSummary?.summary?.total || 0)}
                </p>
              </div>
              {tabSummaryMode !== 'receipt' && (
                <button
                  onClick={() => {
                    setShowTabSummary(false);
                    setTableSummary(null);
                  }}
                  className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Loading State */}
            {loadingTabSummary ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500"></div>
              </div>
            ) : tableSummary ? (
              <>
                {/* VIEW MODE - Show items */}
                {tabSummaryMode === 'view' && (
                  <>
                    <div className="flex-1 overflow-y-auto p-4">
                      {/* Not all served warning */}
                      {!allItemsServed() && (
                        <div className={`mb-3 p-3 rounded-lg ${darkMode ? 'bg-yellow-900/30 border-yellow-700' : 'bg-yellow-50 border-yellow-200'} border`}>
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                            <p className={`text-xs ${darkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                              Some items are still being prepared
                            </p>
                          </div>
                        </div>
                      )}
                      <div className={`rounded-xl p-3 ${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
                        <div className="space-y-2">
                          {tableSummary.allItems?.map((item, idx) => (
                            <div key={idx} className={`flex items-center justify-between py-2 border-b ${darkMode ? 'border-slate-600' : 'border-gray-200'} last:border-0`}>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {item.name}
                                  </span>
                                  <span className={`px-1.5 py-0.5 text-[7px] font-bold rounded ${
                                    item.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                    item.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                                    item.status === 'ready' ? 'bg-green-100 text-green-700' :
                                    item.status === 'served' ? 'bg-purple-100 text-purple-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {item.status?.toUpperCase()}
                                  </span>
                                </div>
                                {item.modifiers?.length > 0 && (
                                  <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                                    {item.modifiers.map(m => `${m.name}: ${m.value}`).join(', ')}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>x{item.quantity}</span>
                                <p className="text-sm font-bold text-accent-500">{formatCurrency(item.total)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className={`p-4 border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'} space-y-2`}>
                      <button
                        onClick={() => setTabSummaryMode('payment')}
                        className="w-full py-3 bg-green-600 text-white rounded-xl font-bold text-sm uppercase hover:bg-green-700 flex items-center justify-center gap-2"
                      >
                        <Receipt className="w-4 h-4" />
                        Proceed to Payment
                      </button>
                      <button
                        onClick={() => { setShowTabSummary(false); setTableSummary(null); }}
                        className={`w-full py-2.5 border ${darkMode ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-600'} rounded-xl font-bold text-sm uppercase hover:opacity-80`}
                      >
                        Close
                      </button>
                    </div>
                  </>
                )}

                {/* PAYMENT MODE - Select payment method */}
                {tabSummaryMode === 'payment' && (
                  <>
                    <div className="flex-1 overflow-y-auto p-4">
                      {/* Split payment toggle */}
                      <div className={`flex items-center justify-between p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-gray-50'} mb-4`}>
                        <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Split Payment</span>
                        <button
                          onClick={() => {
                            setTabSplitPayment(!tabSplitPayment);
                            setTabPaymentMethod('');
                            setTabSplitMethods([]);
                          }}
                          className={`w-12 h-6 rounded-full transition-colors ${tabSplitPayment ? 'bg-accent-500' : darkMode ? 'bg-slate-600' : 'bg-gray-300'}`}
                        >
                          <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${tabSplitPayment ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                      </div>

                      {!tabSplitPayment ? (
                        /* Single payment method selection */
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { id: 'cash', label: 'Cash', icon: Banknote, color: 'bg-green-600 hover:bg-green-700' },
                            { id: 'card', label: 'Card', icon: CreditCard, color: 'bg-blue-600 hover:bg-blue-700' },
                            { id: 'mobile_money', label: 'Mobile Money', icon: Smartphone, color: 'bg-purple-600 hover:bg-purple-700' },
                            { id: 'bank_transfer', label: 'Bank Transfer', icon: Building2, color: 'bg-orange-600 hover:bg-orange-700' }
                          ].map(method => (
                            <button
                              key={method.id}
                              onClick={() => setTabPaymentMethod(method.id)}
                              className={`p-4 rounded-xl font-bold text-sm uppercase flex flex-col items-center justify-center gap-2 transition-all ${
                                tabPaymentMethod === method.id
                                  ? `${method.color} text-white ring-2 ring-offset-2 ring-accent-500`
                                  : darkMode
                                    ? 'bg-slate-700 text-white hover:bg-slate-600'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <method.icon className="w-6 h-6" />
                              {method.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        /* Split payment - select multiple methods */
                        <div className="space-y-3">
                          <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                            Select payment methods and enter amounts:
                          </p>
                          {[
                            { id: 'cash', label: 'Cash', icon: Banknote },
                            { id: 'card', label: 'Card', icon: CreditCard },
                            { id: 'mobile_money', label: 'Mobile', icon: Smartphone },
                            { id: 'bank_transfer', label: 'Transfer', icon: Building2 }
                          ].map(method => {
                            const isSelected = tabSplitMethods.some(m => m.method === method.id);
                            const splitItem = tabSplitMethods.find(m => m.method === method.id);
                            return (
                              <div key={method.id} className={`p-3 rounded-xl border-2 transition-all ${
                                isSelected
                                  ? 'border-accent-500'
                                  : darkMode ? 'border-slate-600' : 'border-gray-200'
                              }`}>
                                <button
                                  onClick={() => addSplitMethod(method.id)}
                                  className="w-full flex items-center gap-3"
                                >
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                    isSelected ? 'border-accent-500 bg-accent-500' : darkMode ? 'border-slate-500' : 'border-gray-300'
                                  }`}>
                                    {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                                  </div>
                                  <method.icon className={`w-5 h-5 ${darkMode ? 'text-white' : 'text-gray-700'}`} />
                                  <span className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{method.label}</span>
                                </button>
                                {isSelected && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>{currencySymbol}</span>
                                    <input
                                      type="number"
                                      value={splitItem?.amount || ''}
                                      onChange={(e) => updateTabSplitAmount(method.id, e.target.value)}
                                      placeholder="0.00"
                                      className={`flex-1 p-2 rounded-lg ${darkMode ? 'bg-slate-600 text-white' : 'bg-gray-100 text-gray-900'} border-0 focus:ring-2 focus:ring-accent-500`}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {tabSplitMethods.length > 0 && (
                            <div className={`p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
                              <div className="flex justify-between">
                                <span className={darkMode ? 'text-slate-400' : 'text-gray-500'}>Split Total:</span>
                                <span className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {formatCurrency(tabSplitMethods.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0))}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className={darkMode ? 'text-slate-400' : 'text-gray-500'}>Remaining:</span>
                                <span className={`font-bold ${
                                  (tableSummary?.summary?.total || 0) - tabSplitMethods.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0) > 0
                                    ? 'text-negative-500'
                                    : 'text-positive-500'
                                }`}>
                                  {formatCurrency((tableSummary?.summary?.total || 0) - tabSplitMethods.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0))}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className={`p-4 border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'} space-y-2`}>
                      <button
                        onClick={() => {
                          if (tabSplitPayment) {
                            processTabPayment();
                          } else if (tabPaymentMethod === 'cash') {
                            setTabSummaryMode('amount');
                          } else if (tabPaymentMethod) {
                            processTabPayment();
                          } else {
                            showToast('Please select a payment method');
                          }
                        }}
                        disabled={closingTable || (!tabPaymentMethod && !tabSplitPayment) || (tabSplitPayment && tabSplitMethods.length === 0)}
                        className="w-full py-3 bg-green-600 text-white rounded-xl font-bold text-sm uppercase hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {closingTable ? 'Processing...' : tabPaymentMethod === 'cash' && !tabSplitPayment ? 'Enter Amount' : 'Complete Payment'}
                      </button>
                      <button
                        onClick={() => setTabSummaryMode('view')}
                        disabled={closingTable}
                        className={`w-full py-2.5 border ${darkMode ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-600'} rounded-xl font-bold text-sm uppercase hover:opacity-80`}
                      >
                        ← Back
                      </button>
                    </div>
                  </>
                )}

                {/* AMOUNT MODE - Enter cash amount */}
                {tabSummaryMode === 'amount' && (
                  <>
                    <div className="flex-1 overflow-y-auto p-4">
                      <div className={`rounded-xl p-4 ${darkMode ? 'bg-slate-700' : 'bg-gray-50'} mb-4`}>
                        <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          Amount Tendered
                        </label>
                        <div className="flex items-center gap-2">
                          <span className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{currencySymbol}</span>
                          <input
                            type="number"
                            value={tabAmountTendered}
                            onChange={(e) => setTabAmountTendered(e.target.value)}
                            placeholder="0.00"
                            autoFocus
                            className={`flex-1 text-2xl font-bold p-3 rounded-xl ${darkMode ? 'bg-slate-600 text-white' : 'bg-white text-gray-900'} border-2 border-accent-500 focus:outline-none`}
                          />
                        </div>
                      </div>
                      {/* Quick amounts */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        <button
                          onClick={() => setTabAmountTendered((tableSummary?.summary?.total || 0).toString())}
                          className={`px-3 py-2 rounded-lg text-sm font-bold ${darkMode ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        >
                          Exact
                        </button>
                        {(() => {
                          const total = tableSummary?.summary?.total || 0;
                          // Generate smart quick amounts based on total
                          const roundUp = (n, to) => Math.ceil(n / to) * to;
                          const amounts = [
                            roundUp(total, 5),      // Round to nearest 5
                            roundUp(total, 10),     // Round to nearest 10
                            roundUp(total, 20),     // Round to nearest 20
                            roundUp(total, 50),     // Round to nearest 50
                          ].filter((amt, idx, arr) => amt > total && arr.indexOf(amt) === idx); // Remove duplicates and exact
                          return amounts.slice(0, 4).map(amt => (
                            <button
                              key={amt}
                              onClick={() => setTabAmountTendered(amt.toString())}
                              className={`px-3 py-2 rounded-lg text-sm font-bold ${darkMode ? 'bg-slate-600 text-white hover:bg-slate-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                              {formatCurrency(amt)}
                            </button>
                          ));
                        })()}
                      </div>
                      {/* Change calculation */}
                      {parseFloat(tabAmountTendered) >= (tableSummary?.summary?.total || 0) && (
                        <div className={`rounded-xl p-4 ${darkMode ? 'bg-green-900/30' : 'bg-green-50'}`}>
                          <div className="flex justify-between items-center">
                            <span className={`text-sm font-bold ${darkMode ? 'text-green-400' : 'text-green-700'}`}>Change</span>
                            <span className="text-2xl font-black text-green-600">
                              {formatCurrency(parseFloat(tabAmountTendered) - (tableSummary?.summary?.total || 0))}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className={`p-4 border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'} space-y-2`}>
                      <button
                        onClick={processTabPayment}
                        disabled={closingTable || parseFloat(tabAmountTendered) < (tableSummary?.summary?.total || 0)}
                        className="w-full py-3 bg-green-600 text-white rounded-xl font-bold text-sm uppercase hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {closingTable ? 'Processing...' : 'Complete Payment'}
                      </button>
                      <button
                        onClick={() => setTabSummaryMode('payment')}
                        disabled={closingTable}
                        className={`w-full py-2.5 border ${darkMode ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-600'} rounded-xl font-bold text-sm uppercase hover:opacity-80`}
                      >
                        ← Back
                      </button>
                    </div>
                  </>
                )}

                {/* RECEIPT MODE - Show receipt */}
                {tabSummaryMode === 'receipt' && tabReceiptData && (
                  <>
                    <div className="flex-1 overflow-y-auto p-3">
                      {/* Header - Business Info */}
                      <div className="text-center mb-2">
                        <h1 className={`text-xs font-black uppercase leading-tight ${textClass}`}>{user?.tenantName}</h1>
                        <p className={`text-[7px] ${mutedClass} mt-0.5`}>{user?.tenant?.address || 'Business Address'}</p>
                      </div>

                      {/* Receipt Title */}
                      <div className={`text-center py-2 border-y border-dashed ${borderClass} mb-2`}>
                        <p className={`text-xs font-black uppercase tracking-wide ${textClass}`}>Sales Receipt</p>
                        <CheckCircle className="w-5 h-5 text-green-500 mx-auto mt-1" />
                      </div>

                      {/* Transaction Details */}
                      <div className={`text-[9px] space-y-0.5 mb-2`}>
                        <div className="flex justify-between font-medium">
                          <span className={mutedClass}>Served by:</span>
                          <span className={textClass}>{user?.fullName}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span className={mutedClass}>Date:</span>
                          <span className={textClass}>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span className={mutedClass}>Table:</span>
                          <span className={textClass}>{tabReceiptData.table?.tableNumber || selectedTable?.tableNumber}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span className={mutedClass}>Invoice #:</span>
                          <span className={`font-bold ${textClass}`}>{tabReceiptData.transactionNumber || tabReceiptData.receiptNumber}</span>
                        </div>
                      </div>

                      {/* Items Table */}
                      <table className="w-full text-[9px] mb-2">
                        <thead>
                          <tr className={`border-y border-dashed ${borderClass} ${mutedClass} uppercase`}>
                            <th className="py-1 text-left w-5">Qty</th>
                            <th className="py-1 text-left">Item</th>
                            <th className="py-1 text-right w-12">Price</th>
                            <th className="py-1 text-right w-14">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(tabReceiptData.items || []).map((item, idx) => (
                            <tr key={idx} className={`border-b border-dotted ${borderClass}`}>
                              <td className="py-1 text-left">{item.quantity}</td>
                              <td className="py-1 text-left">
                                <span className={textClass}>{item.product?.name || item.productName || 'Item'}</span>
                                {(() => {
                                  try {
                                    const mods = typeof item.modifiers === 'string'
                                      ? JSON.parse(item.modifiers || '[]')
                                      : (item.modifiers || []);
                                    return mods.length > 0 ? (
                                      <span className={`block text-[7px] ${mutedClass}`}>
                                        {mods.map(m => m.value || m.name).join(', ')}
                                      </span>
                                    ) : null;
                                  } catch { return null; }
                                })()}
                                {item.specialRequest && (
                                  <span className={`block text-[7px] ${mutedClass} italic`}>{item.specialRequest}</span>
                                )}
                              </td>
                              <td className="py-1 text-right">{formatCurrency(item.unitPrice)}</td>
                              <td className="py-1 text-right font-medium">{formatCurrency(item.unitPrice * item.quantity)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Totals */}
                      <div className={`border-t border-dashed ${borderClass} pt-2 space-y-1`}>
                        <div className="flex justify-between text-[9px] font-medium">
                          <span className={mutedClass}>Subtotal:</span>
                          <span className={textClass}>{formatCurrency(tabReceiptData.totalAmount || tabReceiptData.finalAmount)}</span>
                        </div>
                        {tabReceiptData.discountAmount > 0 && (
                          <div className="flex justify-between text-[9px] font-medium">
                            <span className={mutedClass}>Discount:</span>
                            <span className="text-red-500">-{formatCurrency(tabReceiptData.discountAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[10px] font-black">
                          <span className={textClass}>Total:</span>
                          <span className="text-accent-600">{formatCurrency(tabReceiptData.finalAmount)}</span>
                        </div>
                      </div>

                      {/* Payment Info */}
                      <div className={`border-t border-dashed ${borderClass} mt-2 pt-2 space-y-1`}>
                        {tabReceiptData.amountTendered && (
                          <div className="flex justify-between text-[9px] font-medium">
                            <span className={mutedClass}>Amount Paid:</span>
                            <span className={textClass}>{formatCurrency(tabReceiptData.amountTendered)}</span>
                          </div>
                        )}
                        {tabReceiptData.change > 0 && (
                          <div className="flex justify-between text-[9px] font-bold">
                            <span className="text-green-600">Change:</span>
                            <span className="text-green-600">{formatCurrency(tabReceiptData.change)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[9px] font-medium">
                          <span className={mutedClass}>Payment:</span>
                          <span className={textClass}>
                            {tabReceiptData.splitPayments
                              ? tabReceiptData.splitPayments.map(p => p.method).join(' + ')
                              : (tabReceiptData.paymentMethod || '').replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Thank You */}
                      <div className={`text-center py-2 mt-2 border-t border-dashed ${borderClass}`}>
                        <p className={`text-[9px] font-bold ${textClass}`}>Thank you for dining with us!</p>
                        <p className={`text-[8px] ${mutedClass}`}>We appreciate your patronage</p>
                      </div>

                      {/* Footer */}
                      <div className={`text-center pt-2 border-t ${borderClass}`}>
                        <p className={`text-[7px] ${mutedClass}`}>Software by Kameta Samuel</p>
                        <p className={`text-[7px] ${mutedClass}`}>+233 24 000 0000</p>
                      </div>
                    </div>
                    <div className={`p-3 border-t ${borderClass} space-y-2`}>
                      <button
                        onClick={() => window.print()}
                        className={`w-full py-2.5 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-1.5`}
                      >
                        <Printer className="w-3.5 h-3.5" /> Print Receipt
                      </button>
                      <button
                        onClick={completeTabPayment}
                        className="w-full py-2.5 bg-green-600 text-white rounded-xl font-black text-[10px] uppercase hover:bg-green-700"
                      >
                        Done
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <p className={`${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>No orders found for this table</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Switch Table Modal */}
      {showSwitchTable && (
        <SwitchTableModal
          currentTable={selectedTable}
          onSwitch={handleSwitchTable}
          onClose={() => setShowSwitchTable(false)}
          darkMode={darkMode}
        />
      )}

      {/* Cancel Request Modal */}
      {showCancelRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in`}>
            <div className={`p-4 border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'} flex items-center justify-between`}>
              <div>
                <h2 className={`text-lg font-black uppercase ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Request Cancellation
                </h2>
                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  Order {activeOrder?.orderNumber} • Table {selectedTable?.tableNumber}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCancelRequest(false);
                  setCancelRequestReason('');
                }}
                className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {(() => {
                const existingItems = cart.filter(i => i.isExisting);
                const servedItems = existingItems.filter(i => i.itemStatus === 'served');
                const cancellableItems = existingItems.filter(i => i.itemStatus !== 'served');
                return (
                  <div className={`mb-4 p-3 rounded-lg ${darkMode ? 'bg-yellow-900/30 border-yellow-700' : 'bg-yellow-50 border-yellow-200'} border`}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                      <div className={`text-xs ${darkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                        <p className="mb-2">
                          Orders sent to kitchen cannot be cancelled directly. Your request will be sent to kitchen/manager for approval.
                        </p>
                        {servedItems.length > 0 && (
                          <p className="font-bold text-red-500">
                            Note: {servedItems.length} item(s) already served cannot be cancelled.
                          </p>
                        )}
                        {cancellableItems.length > 0 && (
                          <p className="mt-1">
                            {cancellableItems.length} item(s) can be requested for cancellation.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
              <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Reason for cancellation *
              </label>
              <textarea
                value={cancelRequestReason}
                onChange={(e) => setCancelRequestReason(e.target.value)}
                placeholder="e.g., Customer changed their mind, Wrong order, etc."
                className={`w-full p-3 rounded-xl ${darkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-gray-50 text-gray-900 border-gray-200'} border focus:outline-none focus:border-accent-500`}
                rows={3}
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    setShowCancelRequest(false);
                    setCancelRequestReason('');
                  }}
                  disabled={sendingCancelRequest}
                  className={`flex-1 py-2.5 border ${darkMode ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-600'} rounded-xl font-bold text-sm uppercase hover:opacity-80 disabled:opacity-50`}
                >
                  Back
                </button>
                <button
                  onClick={requestCancelOrder}
                  disabled={sendingCancelRequest || !cancelRequestReason.trim()}
                  className="flex-1 py-2.5 bg-negative-500 text-white rounded-xl font-bold text-sm uppercase hover:bg-negative-600 disabled:opacity-50"
                >
                  {sendingCancelRequest ? 'Sending...' : 'Send Request'}
                </button>
              </div>
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

      {/* Draft Recovery Dialog - for power interruption recovery */}
      {showDraftRecovery && draftData && (
        <DraftRecoveryDialog
          draft={draftData}
          onRestore={async () => {
            // Restore cart from draft
            if (draftData.cart) {
              setCart(draftData.cart);
            }
            if (draftData.customer) {
              setSelectedCustomer(draftData.customer);
              setCustomerName(draftData.customer.name || '');
            }
            if (draftData.paymentMethod) {
              setSelectedPayment(draftData.paymentMethod);
            }
            // Clear the draft from storage after restoring
            await clearDraft();
            setShowDraftRecovery(false);
            setDraftData(null);
            showToast('Transaction restored');
          }}
          onDiscard={async () => {
            await clearDraft();
            setShowDraftRecovery(false);
            setDraftData(null);
          }}
          darkMode={darkMode}
          currencySymbol={currencySymbol}
        />
      )}
    </div>
  );
};

export default CashierPOS;
