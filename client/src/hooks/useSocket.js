import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';

/**
 * Custom hook for Socket.IO connection management
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoConnect - Auto-connect on mount (default: true)
 * @param {string} options.room - Room to join (e.g., 'kitchen', 'tenant')
 * @returns {Object} - Socket instance and connection state
 */
export const useSocket = (options = {}) => {
  const { autoConnect = true, room = null } = options;
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);

  // Initialize socket connection
  useEffect(() => {
    if (!autoConnect || !user?.tenantId) return;

    // Create socket connection
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    const socket = socketRef.current;

    // Connection handlers
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);

      // Join tenant room
      socket.emit('join-tenant', user.tenantId);

      // Join specific room if specified
      if (room === 'kitchen') {
        socket.emit('join-kitchen', user.tenantId);
        if (user.branchId) {
          socket.emit('join-branch', {
            tenantId: user.tenantId,
            branchId: user.branchId
          });
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [autoConnect, user?.tenantId, user?.branchId, room]);

  // Subscribe to events
  const on = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, (data) => {
        setLastMessage({ event, data, timestamp: new Date() });
        callback(data);
      });
    }
  }, []);

  // Unsubscribe from events
  const off = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  }, []);

  // Emit events
  const emit = useCallback((event, data) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, data);
    }
  }, [isConnected]);

  return {
    socket: socketRef.current,
    isConnected,
    lastMessage,
    on,
    off,
    emit
  };
};

/**
 * Hook specifically for Kitchen Display real-time updates
 * @param {Function} onOrderCreated - Callback for new orders
 * @param {Function} onOrderUpdated - Callback for order updates
 * @param {Function} onOrderCompleted - Callback for completed orders
 * @param {Function} onOrderCancelled - Callback for cancelled orders
 * @param {Function} onItemUpdated - Callback for item updates
 */
export const useKitchenSocket = ({
  onOrderCreated,
  onOrderUpdated,
  onOrderCompleted,
  onOrderCancelled,
  onItemUpdated
}) => {
  const { on, off, isConnected } = useSocket({ room: 'kitchen' });

  useEffect(() => {
    if (!isConnected) return;

    // Subscribe to kitchen events
    if (onOrderCreated) {
      on('order:created', onOrderCreated);
    }
    if (onOrderUpdated) {
      on('order:updated', onOrderUpdated);
    }
    if (onOrderCompleted) {
      on('order:completed', onOrderCompleted);
    }
    if (onOrderCancelled) {
      on('order:cancelled', onOrderCancelled);
    }
    if (onItemUpdated) {
      on('order:item-updated', onItemUpdated);
    }

    // Cleanup subscriptions
    return () => {
      if (onOrderCreated) off('order:created', onOrderCreated);
      if (onOrderUpdated) off('order:updated', onOrderUpdated);
      if (onOrderCompleted) off('order:completed', onOrderCompleted);
      if (onOrderCancelled) off('order:cancelled', onOrderCancelled);
      if (onItemUpdated) off('order:item-updated', onItemUpdated);
    };
  }, [isConnected, on, off, onOrderCreated, onOrderUpdated, onOrderCompleted, onOrderCancelled, onItemUpdated]);

  return { isConnected };
};

export default useSocket;
