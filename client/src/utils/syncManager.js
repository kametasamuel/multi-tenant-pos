/**
 * Sync Manager
 *
 * Handles synchronization of offline data with the server.
 * - Detects online/offline status
 * - Automatically syncs pending sales when back online
 * - Provides hooks for UI updates
 */

import {
  getPendingSales,
  updatePendingSaleStatus,
  deletePendingSale,
  cacheProducts,
  getPendingSalesCount
} from './offlineDB';
import { salesAPI, productsAPI } from '../api';

// Sync status
let isOnline = navigator.onLine;
let isSyncing = false;
let syncListeners = [];

// ============ ONLINE/OFFLINE DETECTION ============

// Initialize online/offline listeners
export const initSyncManager = () => {
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Initial status
  isOnline = navigator.onLine;
  console.log(`Sync Manager initialized. Online: ${isOnline}`);

  // If online, try to sync any pending data
  if (isOnline) {
    syncPendingSales();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

const handleOnline = () => {
  console.log('Back online - starting sync');
  isOnline = true;
  notifyListeners({ type: 'online' });

  // Auto-sync pending sales
  syncPendingSales();
};

const handleOffline = () => {
  console.log('Gone offline');
  isOnline = false;
  notifyListeners({ type: 'offline' });
};

// ============ SYNC LISTENERS ============

// Subscribe to sync events
export const addSyncListener = (callback) => {
  syncListeners.push(callback);
  return () => {
    syncListeners = syncListeners.filter(l => l !== callback);
  };
};

// Notify all listeners
const notifyListeners = (event) => {
  syncListeners.forEach(listener => {
    try {
      listener(event);
    } catch (e) {
      console.error('Sync listener error:', e);
    }
  });
};

// ============ SYNC PENDING SALES ============

// Sync all pending sales to server
export const syncPendingSales = async () => {
  if (!isOnline || isSyncing) {
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  notifyListeners({ type: 'syncStart' });

  let synced = 0;
  let failed = 0;

  try {
    const pendingSales = await getPendingSales();

    if (pendingSales.length === 0) {
      isSyncing = false;
      notifyListeners({ type: 'syncComplete', synced: 0, failed: 0 });
      return { synced: 0, failed: 0 };
    }

    console.log(`Syncing ${pendingSales.length} pending sale(s)...`);

    for (const sale of pendingSales) {
      try {
        // Mark as syncing
        await updatePendingSaleStatus(sale.localId, 'syncing');
        notifyListeners({ type: 'syncProgress', current: synced + failed + 1, total: pendingSales.length });

        // Prepare sale data for API
        const saleData = {
          items: sale.items,
          paymentMethod: sale.paymentMethod,
          customerId: sale.customerId,
          discountAmount: sale.discountAmount || 0,
          // Include offline metadata
          offlineCreatedAt: sale.createdAt,
          offlineLocalId: sale.localId
        };

        // Send to server
        const response = await salesAPI.create(saleData);

        // Success - delete from local DB
        await deletePendingSale(sale.localId);
        synced++;

        notifyListeners({
          type: 'saleSynced',
          localId: sale.localId,
          serverId: response.data.sale?.id,
          transactionNumber: response.data.sale?.transactionNumber
        });

      } catch (error) {
        console.error(`Failed to sync sale ${sale.localId}:`, error);

        // Mark as failed
        await updatePendingSaleStatus(sale.localId, 'failed');
        failed++;

        notifyListeners({
          type: 'saleFailed',
          localId: sale.localId,
          error: error.message
        });
      }
    }

  } catch (error) {
    console.error('Sync error:', error);
  }

  isSyncing = false;
  notifyListeners({ type: 'syncComplete', synced, failed });
  console.log(`Sync complete. Synced: ${synced}, Failed: ${failed}`);

  return { synced, failed };
};

// ============ CACHE PRODUCTS FOR OFFLINE ============

// Refresh product cache for offline use
export const refreshProductCache = async (tenantId) => {
  if (!isOnline) {
    console.log('Offline - cannot refresh product cache');
    return false;
  }

  try {
    notifyListeners({ type: 'cacheRefreshStart' });

    // Fetch all active products
    const response = await productsAPI.getAll({ limit: 1000 });
    const products = response.data.products || [];

    // Cache locally
    await cacheProducts(products, tenantId);

    notifyListeners({ type: 'cacheRefreshComplete', count: products.length });
    console.log(`Product cache refreshed: ${products.length} products`);

    return true;
  } catch (error) {
    console.error('Failed to refresh product cache:', error);
    notifyListeners({ type: 'cacheRefreshError', error: error.message });
    return false;
  }
};

// ============ STATUS GETTERS ============

export const getOnlineStatus = () => isOnline;
export const getSyncingStatus = () => isSyncing;

export const getSyncStatus = async () => {
  const pendingCount = await getPendingSalesCount();
  return {
    isOnline,
    isSyncing,
    pendingSales: pendingCount,
    hasUnsynced: pendingCount > 0
  };
};

// ============ MANUAL SYNC TRIGGER ============

// Force sync (for manual retry button)
export const forceSync = async () => {
  if (!isOnline) {
    return { success: false, error: 'Device is offline' };
  }

  const result = await syncPendingSales();
  return {
    success: result.failed === 0,
    ...result
  };
};

export default {
  initSyncManager,
  addSyncListener,
  syncPendingSales,
  refreshProductCache,
  getOnlineStatus,
  getSyncingStatus,
  getSyncStatus,
  forceSync
};
