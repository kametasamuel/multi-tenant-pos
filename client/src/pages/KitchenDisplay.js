import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { kdsAPI } from '../api';
import { useKitchenSocket } from '../hooks/useSocket';
import {
  ChefHat,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Users,
  Utensils,
  Volume2,
  VolumeX,
  LogOut,
  Package,
  Armchair,
  Send,
  Bell,
  RotateCcw,
  Maximize,
  Minimize,
  X,
  BookOpen,
  ChevronDown,
  ChevronUp,
  User,
  Phone,
  MessageSquare,
  FileText,
  Sun,
  Moon,
  Calendar,
  Zap,
  Star
} from 'lucide-react';

const KitchenDisplay = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [readyOrders, setReadyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [stats, setStats] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Order detail modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [expandedRecipes, setExpandedRecipes] = useState({});

  // Theme - allow toggle between dark and light mode
  const [darkMode, setDarkMode] = useState(true); // Default dark for kitchen

  // Track if we've received socket updates
  const hasSocketUpdate = useRef(false);

  // Socket event handlers for real-time updates
  const handleOrderCreated = useCallback((data) => {
    console.log('New order received via WebSocket:', data.order?.orderNumber);
    hasSocketUpdate.current = true;
    if (soundEnabled) {
      playNotificationSound();
    }
    // Add the new order to the list
    setOrders(prev => {
      const exists = prev.some(o => o.id === data.order.id);
      if (exists) return prev;
      return [data.order, ...prev];
    });
    setLastRefresh(new Date());
  }, [soundEnabled]);

  const handleOrderUpdated = useCallback((data) => {
    console.log('Order updated via WebSocket:', data.order?.orderNumber || data.order?.id);
    hasSocketUpdate.current = true;
    setOrders(prev => prev.map(o =>
      o.id === data.order.id ? { ...o, ...data.order } : o
    ));
    // Move to ready if status is ready
    if (data.order.status === 'ready') {
      setReadyOrders(prev => {
        const exists = prev.some(o => o.id === data.order.id);
        if (exists) return prev.map(o => o.id === data.order.id ? data.order : o);
        return [data.order, ...prev];
      });
      // Remove from active orders
      setOrders(prev => prev.filter(o => o.id !== data.order.id));
    }
    setLastRefresh(new Date());
  }, []);

  const handleOrderCompleted = useCallback((data) => {
    console.log('Order completed via WebSocket:', data.orderId);
    hasSocketUpdate.current = true;
    // Remove from both lists
    setOrders(prev => prev.filter(o => o.id !== data.orderId));
    setReadyOrders(prev => prev.filter(o => o.id !== data.orderId));
    setLastRefresh(new Date());
  }, []);

  const handleOrderCancelled = useCallback((data) => {
    console.log('Order cancelled via WebSocket:', data.orderId);
    hasSocketUpdate.current = true;
    // Remove from both lists
    setOrders(prev => prev.filter(o => o.id !== data.orderId));
    setReadyOrders(prev => prev.filter(o => o.id !== data.orderId));
    setLastRefresh(new Date());
  }, []);

  const handleItemUpdated = useCallback((data) => {
    console.log('Item updated via WebSocket:', data.item?.id);
    hasSocketUpdate.current = true;
    // Update the item in the order
    setOrders(prev => prev.map(order => {
      if (order.id !== data.orderId) return order;
      return {
        ...order,
        items: order.items.map(item =>
          item.id === data.item.id ? { ...item, ...data.item } : item
        )
      };
    }));
    setLastRefresh(new Date());
  }, []);

  // Connect to WebSocket for real-time updates
  const { isConnected: socketConnected } = useKitchenSocket({
    onOrderCreated: handleOrderCreated,
    onOrderUpdated: handleOrderUpdated,
    onOrderCompleted: handleOrderCompleted,
    onOrderCancelled: handleOrderCancelled,
    onItemUpdated: handleItemUpdated
  });

  // Theme classes based on mode
  const themeClasses = darkMode ? {
    bg: 'bg-slate-900',
    surface: 'bg-slate-800',
    surfaceHover: 'hover:bg-slate-700',
    text: 'text-white',
    textSecondary: 'text-slate-300',
    muted: 'text-slate-400',
    border: 'border-slate-700',
    input: 'bg-slate-700 border-slate-600',
    cardBg: 'bg-slate-800/50'
  } : {
    bg: 'bg-gray-50',
    surface: 'bg-white',
    surfaceHover: 'hover:bg-gray-50',
    text: 'text-gray-900',
    textSecondary: 'text-gray-700',
    muted: 'text-gray-500',
    border: 'border-gray-200',
    input: 'bg-white border-gray-300',
    cardBg: 'bg-gray-50'
  };

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load orders
  const loadOrders = useCallback(async () => {
    try {
      const [ordersRes, readyRes, statsRes] = await Promise.all([
        kdsAPI.getOrders(),
        kdsAPI.getReadyOrders(),
        kdsAPI.getStats({ period: 'today' })
      ]);

      // Check for new orders and play sound
      const newOrderCount = ordersRes.data.orders?.length || 0;
      const prevOrderCount = orders.length;
      if (soundEnabled && newOrderCount > prevOrderCount && prevOrderCount > 0) {
        playNotificationSound();
      }

      setOrders(ordersRes.data.orders || []);
      setReadyOrders(readyRes.data.orders || []);
      setStats(statsRes.data.stats);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to load orders:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [orders.length, soundEnabled]);

  // Initial load
  useEffect(() => {
    loadOrders();
  }, []);

  // Auto-refresh as fallback (less frequent since we have WebSocket)
  // Only refresh via polling if no socket updates recently
  useEffect(() => {
    const interval = setInterval(() => {
      // If socket is connected and we've had recent updates, skip polling
      if (socketConnected && hasSocketUpdate.current) {
        hasSocketUpdate.current = false; // Reset flag
        return;
      }
      loadOrders();
    }, socketConnected ? 30000 : 10000); // 30s with socket, 10s without
    return () => clearInterval(interval);
  }, [loadOrders, socketConnected]);

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {});
    } catch (e) {}
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Load order details
  const loadOrderDetails = async (orderId) => {
    setOrderDetailLoading(true);
    try {
      const response = await kdsAPI.getOrderDetails(orderId);
      setSelectedOrder(response.data.order);
    } catch (err) {
      console.error('Failed to load order details:', err);
    } finally {
      setOrderDetailLoading(false);
    }
  };

  // Handle order click
  const handleOrderClick = (order) => {
    loadOrderDetails(order.id);
  };

  // Close order detail modal
  const closeOrderDetail = () => {
    setSelectedOrder(null);
    setExpandedRecipes({});
  };

  // Toggle recipe expansion
  const toggleRecipe = (itemId) => {
    setExpandedRecipes(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Update order status
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await kdsAPI.updateOrderStatus(orderId, newStatus);
      loadOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        loadOrderDetails(orderId);
      }
    } catch (err) {
      console.error('Failed to update order:', err);
    }
  };

  // Update item status
  const updateItemStatus = async (itemId, newStatus) => {
    try {
      await kdsAPI.updateItemStatus(itemId, newStatus);
      loadOrders();
      if (selectedOrder) {
        loadOrderDetails(selectedOrder.id);
      }
    } catch (err) {
      console.error('Failed to update item:', err);
    }
  };

  // Bump order (mark as ready)
  const bumpOrder = async (orderId) => {
    try {
      await kdsAPI.bumpOrder(orderId);
      if (soundEnabled) {
        playNotificationSound();
      }
      loadOrders();
      closeOrderDetail();
    } catch (err) {
      console.error('Failed to bump order:', err);
    }
  };

  // Recall order back to kitchen
  const recallOrder = async (orderId) => {
    try {
      await kdsAPI.recallOrder(orderId, 'Recalled from ready');
      loadOrders();
    } catch (err) {
      console.error('Failed to recall order:', err);
    }
  };

  // Get status color
  const getStatusColor = (status, isLate = false) => {
    if (isLate) return 'bg-negative-500';
    switch (status) {
      case 'pending': return 'bg-warning-500';
      case 'confirmed': return 'bg-accent-500';
      case 'preparing': return 'bg-warning-600';
      case 'ready': return 'bg-positive-500';
      default: return 'bg-gray-500';
    }
  };

  // Get status text color
  const getStatusTextColor = (status) => {
    switch (status) {
      case 'pending': return 'text-warning-500';
      case 'confirmed': return 'text-accent-500';
      case 'preparing': return 'text-warning-600';
      case 'ready': return 'text-positive-500';
      default: return 'text-gray-500';
    }
  };

  // Get wait time display
  const getWaitTimeDisplay = (minutes) => {
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Get next action for order
  const getNextAction = (order) => {
    switch (order.status) {
      case 'pending':
        return { label: 'Start', action: () => updateOrderStatus(order.id, 'preparing'), color: 'bg-warning-500 hover:bg-warning-600' };
      case 'confirmed':
        return { label: 'Start', action: () => updateOrderStatus(order.id, 'preparing'), color: 'bg-warning-500 hover:bg-warning-600' };
      case 'preparing':
        return { label: 'Ready', action: () => bumpOrder(order.id), color: 'bg-positive-500 hover:bg-positive-600' };
      default:
        return null;
    }
  };

  // Format time
  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get item status button class
  const getItemStatusClass = (status) => {
    switch (status) {
      case 'ready': return 'bg-positive-500 text-white';
      case 'preparing': return 'bg-warning-500 text-white';
      case 'served': return 'bg-accent-500 text-white';
      default: return darkMode ? 'bg-slate-600 text-slate-300' : 'bg-gray-200 text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${themeClasses.bg} flex items-center justify-center`}>
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-accent-500 animate-spin mx-auto mb-4" />
          <p className={themeClasses.text}>Loading Kitchen Display...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.bg} transition-colors duration-300`}>
      {/* Header */}
      <header className={`${themeClasses.surface} border-b ${themeClasses.border} px-4 py-3 sticky top-0 z-40 shadow-sm`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent-500 rounded-xl">
                <ChefHat className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className={`text-lg font-bold ${themeClasses.text}`}>Kitchen Display</h1>
                <p className={`text-xs ${themeClasses.muted}`}>
                  {user?.tenantName || 'Restaurant'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Date/Time Display */}
            <div className={`hidden md:flex items-center gap-3 px-4 py-2 ${darkMode ? 'bg-slate-700' : 'bg-gray-100'} rounded-xl`}>
              <div className="flex items-center gap-1.5">
                <Calendar className={`w-3.5 h-3.5 ${themeClasses.muted}`} />
                <span className={`text-xs font-bold uppercase ${themeClasses.textSecondary}`}>
                  {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              </div>
              <div className={`w-px h-4 ${darkMode ? 'bg-slate-600' : 'bg-gray-300'}`}></div>
              <div className="flex items-center gap-1.5">
                <Clock className={`w-3.5 h-3.5 ${themeClasses.muted}`} />
                <span className={`text-xs font-bold uppercase ${themeClasses.textSecondary}`}>
                  {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="hidden lg:flex items-center gap-4">
              <div className={`text-center px-3 py-1 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                <p className={`text-xl font-bold ${themeClasses.text}`}>{orders.length}</p>
                <p className={`text-[10px] uppercase font-medium ${themeClasses.muted}`}>Active</p>
              </div>
              <div className={`text-center px-3 py-1 rounded-lg ${darkMode ? 'bg-warning-500/20' : 'bg-warning-50'}`}>
                <p className="text-xl font-bold text-warning-500">
                  {orders.filter(o => o.status === 'pending').length}
                </p>
                <p className={`text-[10px] uppercase font-medium ${darkMode ? 'text-warning-400' : 'text-warning-600'}`}>New</p>
              </div>
              <div className={`text-center px-3 py-1 rounded-lg ${darkMode ? 'bg-positive-500/20' : 'bg-positive-50'}`}>
                <p className="text-xl font-bold text-positive-500">
                  {readyOrders.length}
                </p>
                <p className={`text-[10px] uppercase font-medium ${darkMode ? 'text-positive-400' : 'text-positive-600'}`}>Ready</p>
              </div>
              {stats && (
                <div className={`text-center px-3 py-1 rounded-lg ${darkMode ? 'bg-accent-500/20' : 'bg-accent-50'}`}>
                  <p className="text-xl font-bold text-accent-500">
                    {stats.avgPrepTimeMinutes}m
                  </p>
                  <p className={`text-[10px] uppercase font-medium ${darkMode ? 'text-accent-400' : 'text-accent-600'}`}>Avg</p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg ${themeClasses.surfaceHover} ${themeClasses.muted} transition-colors`}
                title={darkMode ? 'Light mode' : 'Dark mode'}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-lg ${themeClasses.surfaceHover} ${themeClasses.muted} transition-colors`}
                title={soundEnabled ? 'Mute' : 'Unmute'}
              >
                {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
              <button
                onClick={toggleFullscreen}
                className={`p-2 rounded-lg ${themeClasses.surfaceHover} ${themeClasses.muted} transition-colors`}
                title="Toggle fullscreen"
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
              {/* WebSocket Connection Indicator */}
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${socketConnected ? 'bg-positive-500/20 text-positive-500' : 'bg-amber-500/20 text-amber-500'}`}
                title={socketConnected ? 'Real-time sync active' : 'Connecting...'}
              >
                <div className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-positive-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className="text-xs font-bold uppercase">{socketConnected ? 'Live' : 'Sync'}</span>
              </div>
              <button
                onClick={loadOrders}
                className={`p-2 rounded-lg ${themeClasses.surfaceHover} text-accent-500 transition-colors`}
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  logout();
                  navigate(`/${user?.tenantSlug || ''}/login`);
                }}
                className={`p-2 rounded-lg ${themeClasses.surfaceHover} text-negative-500 transition-colors`}
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4">
        {error && (
          <div className="mb-4 p-4 bg-negative-50 border border-negative-200 rounded-xl text-negative-600 text-center">
            {error}
            <button onClick={loadOrders} className="ml-2 underline font-medium">Retry</button>
          </div>
        )}

        {orders.length === 0 && readyOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className={`p-6 rounded-full ${darkMode ? 'bg-slate-800' : 'bg-gray-100'} mb-6`}>
              <ChefHat className={`w-16 h-16 ${themeClasses.muted}`} />
            </div>
            <h2 className={`text-2xl font-bold ${themeClasses.text} mb-2`}>All Caught Up!</h2>
            <p className={themeClasses.muted}>No orders in the queue. Waiting for new orders...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Active Orders - 3 columns */}
            <div className="lg:col-span-3">
              <div className="flex items-center gap-2 mb-4">
                <Utensils className="w-5 h-5 text-accent-500" />
                <h2 className={`text-lg font-bold ${themeClasses.text}`}>Incoming Orders</h2>
                <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent-500 text-white">
                  {orders.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {orders.map(order => {
                  const nextAction = getNextAction(order);
                  return (
                    <div
                      key={order.id}
                      onClick={() => handleOrderClick(order)}
                      className={`${themeClasses.surface} rounded-2xl border-2 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.01] ${
                        order.priority === 'rush' ? 'border-orange-500 ring-2 ring-orange-500/30' :
                        order.priority === 'vip' ? 'border-purple-500 ring-2 ring-purple-500/30' :
                        order.isLate ? 'border-negative-500 animate-pulse' : themeClasses.border
                      } overflow-hidden`}
                    >
                      {/* Priority Banner */}
                      {order.priority === 'rush' && (
                        <div className="bg-orange-500 text-white text-xs font-black uppercase py-1 px-3 flex items-center justify-center gap-1">
                          <Zap className="w-3 h-3" /> RUSH ORDER
                        </div>
                      )}
                      {order.priority === 'vip' && (
                        <div className="bg-purple-500 text-white text-xs font-black uppercase py-1 px-3 flex items-center justify-center gap-1">
                          <Star className="w-3 h-3" /> VIP ORDER
                        </div>
                      )}

                      {/* Order Header */}
                      <div className={`px-4 py-3 border-b ${themeClasses.border} flex items-center justify-between ${
                        order.priority === 'rush' ? (darkMode ? 'bg-orange-900/20' : 'bg-orange-50') :
                        order.priority === 'vip' ? (darkMode ? 'bg-purple-900/20' : 'bg-purple-50') :
                        order.isLate ? (darkMode ? 'bg-negative-900/30' : 'bg-negative-50') : ''
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`px-3 py-1.5 rounded-lg font-bold text-white text-lg ${
                            order.priority === 'rush' ? 'bg-orange-500' :
                            order.priority === 'vip' ? 'bg-purple-500' :
                            getStatusColor(order.status, order.isLate)
                          }`}>
                            {order.orderNumber}
                          </div>
                          <div>
                            {order.table ? (
                              <div className="flex items-center gap-1">
                                <Armchair className="w-4 h-4 text-accent-500" />
                                <span className={`font-bold ${themeClasses.text}`}>Table {order.table.tableNumber}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Package className="w-4 h-4 text-accent-500" />
                                <span className={`font-bold ${themeClasses.text} capitalize`}>{order.orderType}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`flex items-center gap-1 ${order.isLate ? 'text-negative-500' : themeClasses.muted}`}>
                            <Clock className="w-4 h-4" />
                            <span className="font-bold">{getWaitTimeDisplay(order.waitMinutes)}</span>
                          </div>
                          {order.isLate && (
                            <span className="text-xs text-negative-500 flex items-center gap-1 justify-end">
                              <AlertTriangle className="w-3 h-3" /> Late
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Order Items Preview */}
                      <div className="p-4">
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {order.items.slice(0, 5).map(item => (
                            <div
                              key={item.id}
                              className={`flex items-center gap-2 text-sm ${
                                item.status === 'ready' ? 'opacity-50 line-through' : ''
                              }`}
                            >
                              <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-xs font-bold ${getItemStatusClass(item.status)}`}>
                                {item.quantity}
                              </span>
                              <span className={themeClasses.text}>{item.product.name}</span>
                            </div>
                          ))}
                          {order.items.length > 5 && (
                            <p className={`text-xs ${themeClasses.muted}`}>+{order.items.length - 5} more items</p>
                          )}
                        </div>

                        {/* Notes indicator */}
                        {order.notes && (
                          <div className="mt-3 flex items-center gap-1.5 text-warning-500">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">Has notes</span>
                          </div>
                        )}
                      </div>

                      {/* Quick Actions */}
                      <div className={`px-4 py-3 border-t ${themeClasses.border} ${themeClasses.cardBg}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${themeClasses.muted}`}>
                              {order.itemCount} items
                            </span>
                            {order.readyItemCount > 0 && (
                              <span className="text-xs text-positive-500 font-medium">
                                ({order.readyItemCount} ready)
                              </span>
                            )}
                          </div>
                          {nextAction && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                nextAction.action();
                              }}
                              className={`px-4 py-2 ${nextAction.color} text-white rounded-lg font-bold text-sm uppercase flex items-center gap-2 transition-colors shadow-sm`}
                            >
                              {nextAction.label}
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ready Orders Sidebar */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-positive-500" />
                <h2 className={`text-lg font-bold ${themeClasses.text}`}>Ready to Serve</h2>
                <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold bg-positive-500 text-white">
                  {readyOrders.length}
                </span>
              </div>

              <div className="space-y-3">
                {readyOrders.map(order => (
                  <div
                    key={order.id}
                    className={`${themeClasses.surface} rounded-2xl border-2 border-positive-500 overflow-hidden shadow-sm`}
                  >
                    <div className={`p-4 ${darkMode ? 'bg-positive-900/20' : 'bg-positive-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-3 py-1 bg-positive-500 text-white rounded-lg font-bold">
                          {order.orderNumber}
                        </span>
                        <span className={`text-sm ${themeClasses.muted}`}>
                          {order.readySinceMinutes}m ago
                        </span>
                      </div>
                      {order.table && (
                        <div className="flex items-center gap-2">
                          <Armchair className="w-4 h-4 text-positive-500" />
                          <span className={`font-bold ${themeClasses.text}`}>Table {order.table.tableNumber}</span>
                        </div>
                      )}
                      <p className={`text-xs ${themeClasses.muted} mt-1`}>
                        {order.items?.length || 0} items
                      </p>
                    </div>
                    <div className={`px-4 py-3 border-t ${themeClasses.border} flex gap-2`}>
                      <button
                        onClick={() => updateOrderStatus(order.id, 'served')}
                        className="flex-1 py-2.5 bg-positive-500 hover:bg-positive-600 text-white rounded-lg font-bold text-xs uppercase transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" /> Served
                      </button>
                      <button
                        onClick={() => recallOrder(order.id)}
                        className={`px-3 py-2.5 ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'} border ${themeClasses.border} rounded-lg text-warning-500 transition-colors`}
                        title="Recall to kitchen"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {readyOrders.length === 0 && (
                  <div className={`${themeClasses.surface} rounded-2xl border ${themeClasses.border} p-6 text-center`}>
                    <CheckCircle className={`w-12 h-12 ${themeClasses.muted} mx-auto mb-3`} />
                    <p className={themeClasses.muted}>No orders ready</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Order Detail Modal */}
      {(selectedOrder || orderDetailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`${themeClasses.surface} rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border ${themeClasses.border}`}>
            {orderDetailLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 text-accent-500 animate-spin" />
              </div>
            ) : selectedOrder && (
              <>
                {/* Modal Header */}
                <div className={`p-4 border-b ${themeClasses.border} flex items-center justify-between`}>
                  <div className="flex items-center gap-4">
                    <div className={`px-4 py-2 rounded-xl font-bold text-white text-xl ${getStatusColor(selectedOrder.status, selectedOrder.isLate)}`}>
                      {selectedOrder.orderNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {selectedOrder.table ? (
                          <>
                            <Armchair className="w-5 h-5 text-accent-500" />
                            <span className={`font-bold text-lg ${themeClasses.text}`}>
                              Table {selectedOrder.table.tableNumber}
                            </span>
                            {selectedOrder.table.section && (
                              <span className={`text-sm ${themeClasses.muted}`}>({selectedOrder.table.section})</span>
                            )}
                          </>
                        ) : (
                          <>
                            <Package className="w-5 h-5 text-accent-500" />
                            <span className={`font-bold text-lg ${themeClasses.text} capitalize`}>{selectedOrder.orderType}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-sm ${themeClasses.muted}`}>
                          <Clock className="w-3 h-3 inline mr-1" />
                          {getWaitTimeDisplay(selectedOrder.waitMinutes)} ago
                        </span>
                        <span className={`text-sm capitalize font-medium ${getStatusTextColor(selectedOrder.status)}`}>
                          {selectedOrder.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={closeOrderDetail}
                    className={`p-2 rounded-lg ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'} ${themeClasses.muted} transition-colors`}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Order Info */}
                <div className={`px-4 py-3 border-b ${themeClasses.border} ${themeClasses.cardBg}`}>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {selectedOrder.createdBy && (
                      <div className="flex items-center gap-2">
                        <User className={`w-4 h-4 ${themeClasses.muted}`} />
                        <span className={themeClasses.muted}>Cashier:</span>
                        <span className={`font-medium ${themeClasses.text}`}>{selectedOrder.createdBy.fullName}</span>
                      </div>
                    )}
                    {selectedOrder.customer && (
                      <div className="flex items-center gap-2">
                        <Users className={`w-4 h-4 ${themeClasses.muted}`} />
                        <span className={themeClasses.muted}>Customer:</span>
                        <span className={`font-medium ${themeClasses.text}`}>{selectedOrder.customer.name}</span>
                        {selectedOrder.customer.phone && (
                          <>
                            <Phone className={`w-3 h-3 ${themeClasses.muted}`} />
                            <span className={themeClasses.muted}>{selectedOrder.customer.phone}</span>
                          </>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Clock className={`w-4 h-4 ${themeClasses.muted}`} />
                      <span className={themeClasses.muted}>Ordered:</span>
                      <span className={`font-medium ${themeClasses.text}`}>{formatTime(selectedOrder.createdAt)}</span>
                    </div>
                  </div>

                  {/* Order Notes */}
                  {selectedOrder.notes && (
                    <div className={`mt-3 p-3 ${darkMode ? 'bg-warning-900/20' : 'bg-warning-50'} border ${darkMode ? 'border-warning-500/30' : 'border-warning-200'} rounded-xl`}>
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-warning-500 mt-0.5" />
                        <div>
                          <span className="text-warning-500 text-sm font-bold">Order Notes:</span>
                          <p className={themeClasses.text}>{selectedOrder.notes}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Order Items */}
                <div className="flex-1 overflow-y-auto p-4">
                  <h3 className={`text-sm font-bold ${themeClasses.muted} mb-3 uppercase tracking-wider`}>
                    Order Items ({selectedOrder.itemCount})
                  </h3>
                  <div className="space-y-3">
                    {selectedOrder.items.map(item => (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border ${themeClasses.border} ${
                          item.status === 'ready' ? (darkMode ? 'bg-positive-900/10 border-positive-500/30' : 'bg-positive-50 border-positive-200') :
                          item.status === 'preparing' ? (darkMode ? 'bg-warning-900/10 border-warning-500/30' : 'bg-warning-50 border-warning-200') :
                          themeClasses.cardBg
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => {
                                const nextStatus = item.status === 'pending' ? 'preparing' :
                                                   item.status === 'preparing' ? 'ready' : 'ready';
                                updateItemStatus(item.id, nextStatus);
                              }}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${getItemStatusClass(item.status)} hover:opacity-80 transition-opacity shadow-sm`}
                            >
                              {item.status === 'ready' ? (
                                <CheckCircle className="w-5 h-5" />
                              ) : (
                                item.quantity
                              )}
                            </button>
                            <div>
                              <h4 className={`font-bold text-lg ${themeClasses.text} ${item.status === 'ready' ? 'line-through opacity-60' : ''}`}>
                                {item.quantity}x {item.product.name}
                              </h4>
                              {item.product.kitchenCategory && (
                                <span className={`text-xs ${themeClasses.muted}`}>{item.product.kitchenCategory}</span>
                              )}
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${getItemStatusClass(item.status)}`}>
                            {item.status}
                          </span>
                        </div>

                        {/* Modifiers */}
                        {item.modifiers && (
                          <div className="ml-13 mb-2 flex flex-wrap gap-1.5">
                            {JSON.parse(item.modifiers).map((mod, idx) => (
                              <span key={idx} className={`inline-block px-2.5 py-1 ${darkMode ? 'bg-accent-500/20 text-accent-400' : 'bg-accent-50 text-accent-700'} rounded-lg text-sm font-medium`}>
                                {mod.name}: {mod.value || mod.label}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Special Request */}
                        {item.specialRequest && (
                          <div className={`ml-13 mb-2 p-2.5 ${darkMode ? 'bg-warning-900/20' : 'bg-warning-50'} rounded-lg border ${darkMode ? 'border-warning-500/30' : 'border-warning-200'}`}>
                            <span className="text-warning-500 text-sm font-bold">Special: </span>
                            <span className={themeClasses.text}>{item.specialRequest}</span>
                          </div>
                        )}

                        {/* Recipe Section */}
                        {item.product.recipe && (
                          <div className="ml-13 mt-2">
                            <button
                              onClick={() => toggleRecipe(item.id)}
                              className={`flex items-center gap-2 text-sm ${themeClasses.muted} hover:text-accent-500 transition-colors`}
                            >
                              <BookOpen className="w-4 h-4" />
                              <span className="font-medium">View Recipe</span>
                              {expandedRecipes[item.id] ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                            {expandedRecipes[item.id] && (
                              <div className={`mt-2 p-3 ${darkMode ? 'bg-slate-700/50' : 'bg-gray-100'} rounded-xl border ${themeClasses.border}`}>
                                <h5 className="text-accent-500 font-bold text-sm mb-2 flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  Recipe / Preparation
                                </h5>
                                <p className={`${themeClasses.text} text-sm whitespace-pre-wrap`}>{item.product.recipe}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Product Description (if no recipe) */}
                        {!item.product.recipe && item.product.description && (
                          <div className="ml-13 mt-2">
                            <button
                              onClick={() => toggleRecipe(item.id)}
                              className={`flex items-center gap-2 text-sm ${themeClasses.muted} hover:text-accent-500 transition-colors`}
                            >
                              <FileText className="w-4 h-4" />
                              <span className="font-medium">View Description</span>
                              {expandedRecipes[item.id] ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                            {expandedRecipes[item.id] && (
                              <div className={`mt-2 p-3 ${darkMode ? 'bg-slate-700/50' : 'bg-gray-100'} rounded-xl border ${themeClasses.border}`}>
                                <p className={`${themeClasses.text} text-sm`}>{item.product.description}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modal Footer - Actions */}
                <div className={`p-4 border-t ${themeClasses.border} ${themeClasses.cardBg}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`text-sm ${themeClasses.muted}`}>
                        <span className="text-positive-500 font-bold">{selectedOrder.readyItemCount}</span> of {selectedOrder.itemCount} items ready
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedOrder.status === 'pending' && (
                        <button
                          onClick={() => updateOrderStatus(selectedOrder.id, 'preparing')}
                          className="px-6 py-3 bg-warning-500 hover:bg-warning-600 text-white rounded-xl font-bold uppercase flex items-center gap-2 transition-colors shadow-sm"
                        >
                          <Utensils className="w-4 h-4" />
                          Start Preparing
                        </button>
                      )}
                      {selectedOrder.status === 'preparing' && (
                        <button
                          onClick={() => bumpOrder(selectedOrder.id)}
                          className="px-6 py-3 bg-positive-500 hover:bg-positive-600 text-white rounded-xl font-bold uppercase flex items-center gap-2 transition-colors shadow-sm"
                        >
                          <Bell className="w-4 h-4" />
                          Order Ready!
                        </button>
                      )}
                      {selectedOrder.status === 'ready' && (
                        <button
                          onClick={() => updateOrderStatus(selectedOrder.id, 'served')}
                          className="px-6 py-3 bg-accent-500 hover:bg-accent-600 text-white rounded-xl font-bold uppercase flex items-center gap-2 transition-colors shadow-sm"
                        >
                          <Send className="w-4 h-4" />
                          Mark Served
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default KitchenDisplay;
