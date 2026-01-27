/**
 * Offline Database Utility
 *
 * Uses IndexedDB for local storage of:
 * - Pending sales (transactions made offline)
 * - Product cache (for offline POS)
 * - Draft transactions (power interruption recovery)
 *
 * Automatically syncs when back online.
 */

const DB_NAME = 'pos_offline_db';
const DB_VERSION = 1;

// Store names
const STORES = {
  PENDING_SALES: 'pending_sales',
  PRODUCTS_CACHE: 'products_cache',
  DRAFT_TRANSACTION: 'draft_transaction',
  SYNC_QUEUE: 'sync_queue',
};

let db = null;

// Initialize IndexedDB
export const initOfflineDB = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB');
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('Offline DB initialized');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Pending sales store - transactions made while offline
      if (!database.objectStoreNames.contains(STORES.PENDING_SALES)) {
        const salesStore = database.createObjectStore(STORES.PENDING_SALES, {
          keyPath: 'localId',
          autoIncrement: true
        });
        salesStore.createIndex('createdAt', 'createdAt', { unique: false });
        salesStore.createIndex('status', 'status', { unique: false });
      }

      // Products cache - for offline POS
      if (!database.objectStoreNames.contains(STORES.PRODUCTS_CACHE)) {
        const productsStore = database.createObjectStore(STORES.PRODUCTS_CACHE, {
          keyPath: 'id'
        });
        productsStore.createIndex('tenantId', 'tenantId', { unique: false });
        productsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Draft transaction - for power interruption recovery
      if (!database.objectStoreNames.contains(STORES.DRAFT_TRANSACTION)) {
        database.createObjectStore(STORES.DRAFT_TRANSACTION, {
          keyPath: 'id'
        });
      }

      // Sync queue - general queue for failed API calls
      if (!database.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = database.createObjectStore(STORES.SYNC_QUEUE, {
          keyPath: 'id',
          autoIncrement: true
        });
        syncStore.createIndex('type', 'type', { unique: false });
        syncStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
};

// Get database instance
const getDB = async () => {
  if (!db) {
    await initOfflineDB();
  }
  return db;
};

// ============ PENDING SALES ============

// Save a sale made offline
export const savePendingSale = async (saleData) => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.PENDING_SALES], 'readwrite');
    const store = transaction.objectStore(STORES.PENDING_SALES);

    const sale = {
      ...saleData,
      createdAt: new Date().toISOString(),
      status: 'pending', // pending, syncing, synced, failed
      syncAttempts: 0,
      lastSyncAttempt: null,
    };

    const request = store.add(sale);

    request.onsuccess = () => {
      resolve({ ...sale, localId: request.result });
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

// Get all pending sales
export const getPendingSales = async () => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.PENDING_SALES], 'readonly');
    const store = transaction.objectStore(STORES.PENDING_SALES);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result.filter(s => s.status === 'pending' || s.status === 'failed'));
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

// Update pending sale status
export const updatePendingSaleStatus = async (localId, status, serverId = null) => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.PENDING_SALES], 'readwrite');
    const store = transaction.objectStore(STORES.PENDING_SALES);
    const getRequest = store.get(localId);

    getRequest.onsuccess = () => {
      const sale = getRequest.result;
      if (!sale) {
        reject(new Error('Sale not found'));
        return;
      }

      sale.status = status;
      sale.lastSyncAttempt = new Date().toISOString();
      sale.syncAttempts++;
      if (serverId) {
        sale.serverId = serverId;
      }

      const putRequest = store.put(sale);
      putRequest.onsuccess = () => resolve(sale);
      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
};

// Delete synced sale from local DB
export const deletePendingSale = async (localId) => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.PENDING_SALES], 'readwrite');
    const store = transaction.objectStore(STORES.PENDING_SALES);
    const request = store.delete(localId);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

// Get pending sales count
export const getPendingSalesCount = async () => {
  const sales = await getPendingSales();
  return sales.length;
};

// ============ PRODUCTS CACHE ============

// Cache products for offline use
export const cacheProducts = async (products, tenantId) => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.PRODUCTS_CACHE], 'readwrite');
    const store = transaction.objectStore(STORES.PRODUCTS_CACHE);

    // Clear old cache for this tenant first
    const index = store.index('tenantId');
    const clearRequest = index.openCursor(IDBKeyRange.only(tenantId));

    clearRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => {
      // Now add new products
      const addTransaction = database.transaction([STORES.PRODUCTS_CACHE], 'readwrite');
      const addStore = addTransaction.objectStore(STORES.PRODUCTS_CACHE);

      products.forEach(product => {
        addStore.put({
          ...product,
          tenantId,
          cachedAt: new Date().toISOString()
        });
      });

      addTransaction.oncomplete = () => {
        console.log(`Cached ${products.length} products for offline use`);
        resolve(true);
      };

      addTransaction.onerror = () => reject(addTransaction.error);
    };

    transaction.onerror = () => reject(transaction.error);
  });
};

// Get cached products
export const getCachedProducts = async (tenantId) => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.PRODUCTS_CACHE], 'readonly');
    const store = transaction.objectStore(STORES.PRODUCTS_CACHE);
    const index = store.index('tenantId');
    const request = index.getAll(tenantId);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

// ============ DRAFT TRANSACTION (Power Interruption Recovery) ============

// Save current cart state as draft
export const saveDraftTransaction = async (draftData, sessionId = 'current') => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.DRAFT_TRANSACTION], 'readwrite');
    const store = transaction.objectStore(STORES.DRAFT_TRANSACTION);

    const draft = {
      id: sessionId,
      ...draftData,
      savedAt: new Date().toISOString()
    };

    const request = store.put(draft);

    request.onsuccess = () => resolve(draft);
    request.onerror = () => reject(request.error);
  });
};

// Get draft transaction
export const getDraftTransaction = async (sessionId = 'current') => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.DRAFT_TRANSACTION], 'readonly');
    const store = transaction.objectStore(STORES.DRAFT_TRANSACTION);
    const request = store.get(sessionId);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => reject(request.error);
  });
};

// Clear draft transaction (after successful checkout)
export const clearDraftTransaction = async (sessionId = 'current') => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.DRAFT_TRANSACTION], 'readwrite');
    const store = transaction.objectStore(STORES.DRAFT_TRANSACTION);
    const request = store.delete(sessionId);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

// ============ UTILITIES ============

// Clear all offline data (logout)
export const clearAllOfflineData = async () => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [STORES.PENDING_SALES, STORES.PRODUCTS_CACHE, STORES.DRAFT_TRANSACTION, STORES.SYNC_QUEUE],
      'readwrite'
    );

    transaction.objectStore(STORES.PENDING_SALES).clear();
    transaction.objectStore(STORES.PRODUCTS_CACHE).clear();
    transaction.objectStore(STORES.DRAFT_TRANSACTION).clear();
    transaction.objectStore(STORES.SYNC_QUEUE).clear();

    transaction.oncomplete = () => {
      console.log('All offline data cleared');
      resolve(true);
    };

    transaction.onerror = () => reject(transaction.error);
  });
};

// Get offline storage stats
export const getOfflineStats = async () => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const stats = {
      pendingSales: 0,
      cachedProducts: 0,
      hasDraft: false
    };

    const transaction = database.transaction(
      [STORES.PENDING_SALES, STORES.PRODUCTS_CACHE, STORES.DRAFT_TRANSACTION],
      'readonly'
    );

    const salesStore = transaction.objectStore(STORES.PENDING_SALES);
    const productsStore = transaction.objectStore(STORES.PRODUCTS_CACHE);
    const draftStore = transaction.objectStore(STORES.DRAFT_TRANSACTION);

    salesStore.count().onsuccess = (e) => { stats.pendingSales = e.target.result; };
    productsStore.count().onsuccess = (e) => { stats.cachedProducts = e.target.result; };
    draftStore.get('current').onsuccess = (e) => { stats.hasDraft = !!e.target.result; };

    transaction.oncomplete = () => resolve(stats);
    transaction.onerror = () => reject(transaction.error);
  });
};

export default {
  initOfflineDB,
  savePendingSale,
  getPendingSales,
  updatePendingSaleStatus,
  deletePendingSale,
  getPendingSalesCount,
  cacheProducts,
  getCachedProducts,
  saveDraftTransaction,
  getDraftTransaction,
  clearDraftTransaction,
  clearAllOfflineData,
  getOfflineStats,
  STORES
};
