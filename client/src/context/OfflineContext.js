/**
 * Offline Context
 *
 * Provides offline functionality to the entire app.
 * Manages:
 * - Online/offline status
 * - Sync status and progress
 * - Draft transaction recovery
 * - Product cache for offline POS
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initOfflineDB, saveDraftTransaction, getDraftTransaction, clearDraftTransaction, getOfflineStats } from '../utils/offlineDB';
import { initSyncManager, addSyncListener, getSyncStatus, forceSync, refreshProductCache, getOnlineStatus } from '../utils/syncManager';
import { useAuth } from './AuthContext';

const OfflineContext = createContext();

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

export const OfflineProvider = ({ children }) => {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSalesCount, setPendingSalesCount] = useState(0);
  const [syncProgress, setSyncProgress] = useState(null);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [hasDraftTransaction, setHasDraftTransaction] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize offline system
  useEffect(() => {
    const init = async () => {
      try {
        // Initialize IndexedDB
        await initOfflineDB();

        // Initialize sync manager
        const cleanup = initSyncManager();

        // Check for draft transaction
        const draft = await getDraftTransaction();
        setHasDraftTransaction(!!draft);

        // Get initial sync status
        const status = await getSyncStatus();
        setIsOnline(status.isOnline);
        setPendingSalesCount(status.pendingSales);

        setIsInitialized(true);
        console.log('Offline system initialized');

        return cleanup;
      } catch (error) {
        console.error('Failed to initialize offline system:', error);
        setIsInitialized(true); // Continue anyway
      }
    };

    init();
  }, []);

  // Listen to sync events
  useEffect(() => {
    const unsubscribe = addSyncListener((event) => {
      switch (event.type) {
        case 'online':
          setIsOnline(true);
          break;
        case 'offline':
          setIsOnline(false);
          break;
        case 'syncStart':
          setIsSyncing(true);
          setSyncProgress({ current: 0, total: 0 });
          break;
        case 'syncProgress':
          setSyncProgress({ current: event.current, total: event.total });
          break;
        case 'syncComplete':
          setIsSyncing(false);
          setSyncProgress(null);
          setLastSyncResult({ synced: event.synced, failed: event.failed, time: new Date() });
          // Refresh pending count
          getSyncStatus().then(status => setPendingSalesCount(status.pendingSales));
          break;
        case 'saleSynced':
          // Could show toast notification here
          break;
        case 'saleFailed':
          // Could show error notification here
          break;
        default:
          break;
      }
    });

    return unsubscribe;
  }, []);

  // Refresh product cache when user changes (login) or when coming back online
  useEffect(() => {
    if (user?.tenantId && isOnline && isInitialized) {
      // Refresh product cache in background
      refreshProductCache(user.tenantId).catch(console.error);
    }
  }, [user?.tenantId, isOnline, isInitialized]);

  // Save draft transaction (for power interruption recovery)
  const saveDraft = useCallback(async (cartData) => {
    try {
      await saveDraftTransaction({
        cart: cartData.cart,
        customer: cartData.customer,
        discount: cartData.discount,
        paymentMethod: cartData.paymentMethod,
        tenantId: user?.tenantId
      });
      setHasDraftTransaction(true);
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  }, [user?.tenantId]);

  // Get draft transaction
  const getDraft = useCallback(async () => {
    try {
      return await getDraftTransaction();
    } catch (error) {
      console.error('Failed to get draft:', error);
      return null;
    }
  }, []);

  // Clear draft (after successful checkout)
  const clearDraft = useCallback(async () => {
    try {
      await clearDraftTransaction();
      setHasDraftTransaction(false);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }, []);

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    if (!isOnline) {
      return { success: false, error: 'Device is offline' };
    }
    return forceSync();
  }, [isOnline]);

  // Refresh product cache manually
  const refreshCache = useCallback(async () => {
    if (!user?.tenantId || !isOnline) {
      return false;
    }
    return refreshProductCache(user.tenantId);
  }, [user?.tenantId, isOnline]);

  // Get offline stats
  const getStats = useCallback(async () => {
    return getOfflineStats();
  }, []);

  const value = {
    // Status
    isOnline,
    isSyncing,
    pendingSalesCount,
    syncProgress,
    lastSyncResult,
    hasDraftTransaction,
    isInitialized,
    hasUnsynced: pendingSalesCount > 0,

    // Draft transaction methods
    saveDraft,
    getDraft,
    clearDraft,

    // Sync methods
    triggerSync,
    refreshCache,
    getStats
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};

export default OfflineContext;
