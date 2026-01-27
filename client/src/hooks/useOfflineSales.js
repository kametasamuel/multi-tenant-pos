/**
 * useOfflineSales Hook
 *
 * Provides offline-capable sale processing for POS.
 * Wraps the salesAPI with offline fallback.
 *
 * Usage:
 *   const { createSale, isOnline, pendingCount } = useOfflineSales();
 *
 *   // In checkout:
 *   const result = await createSale(saleData);
 *   if (result.offline) {
 *     showToast('Sale saved offline - will sync when connected');
 *   }
 */

import { useCallback } from 'react';
import { useOffline } from '../context/OfflineContext';
import { salesAPI } from '../api';
import { savePendingSale, getCachedProducts } from '../utils/offlineDB';

export const useOfflineSales = () => {
  const {
    isOnline,
    pendingSalesCount,
    saveDraft,
    clearDraft,
    getDraft
  } = useOffline();

  /**
   * Create a sale - automatically handles offline mode
   * Returns: { success, offline, data, error }
   */
  const createSale = useCallback(async (saleData) => {
    // Try online first
    if (isOnline) {
      try {
        const response = await salesAPI.create(saleData);
        // Clear any draft on success
        await clearDraft();
        return {
          success: true,
          offline: false,
          data: response.data
        };
      } catch (error) {
        // If it's a network error, fall through to offline mode
        if (!error.response) {
          console.log('Network error - saving offline');
        } else {
          // Server error - don't save offline, return error
          return {
            success: false,
            offline: false,
            error: error.response?.data?.error || error.message
          };
        }
      }
    }

    // Offline mode - save locally
    try {
      const localSale = await savePendingSale({
        ...saleData,
        offlineMode: true
      });

      // Clear draft since we saved the sale
      await clearDraft();

      // Generate a local transaction number
      const localTransactionNumber = `OFF-${Date.now().toString(36).toUpperCase()}`;

      return {
        success: true,
        offline: true,
        data: {
          sale: {
            ...localSale,
            transactionNumber: localTransactionNumber
          },
          message: 'Sale saved offline - will sync when connected'
        }
      };
    } catch (error) {
      return {
        success: false,
        offline: true,
        error: 'Failed to save sale offline: ' + error.message
      };
    }
  }, [isOnline, clearDraft]);

  /**
   * Save cart as draft (for power interruption recovery)
   */
  const saveCartDraft = useCallback(async (cart, customer, discount, paymentMethod) => {
    if (cart.length === 0) {
      await clearDraft();
      return;
    }

    await saveDraft({
      cart,
      customer,
      discount,
      paymentMethod
    });
  }, [saveDraft, clearDraft]);

  /**
   * Recover draft transaction (on page load)
   */
  const recoverDraft = useCallback(async () => {
    const draft = await getDraft();
    return draft;
  }, [getDraft]);

  /**
   * Clear draft (on successful checkout or manual clear)
   */
  const clearCartDraft = useCallback(async () => {
    await clearDraft();
  }, [clearDraft]);

  /**
   * Get products (with offline fallback)
   */
  const getProducts = useCallback(async (tenantId, fetchFn) => {
    if (isOnline) {
      try {
        return await fetchFn();
      } catch (error) {
        if (!error.response) {
          // Network error - try cached
          console.log('Network error - using cached products');
        } else {
          throw error;
        }
      }
    }

    // Offline - get from cache
    const cached = await getCachedProducts(tenantId);
    if (cached.length > 0) {
      return { data: { products: cached, fromCache: true } };
    }

    throw new Error('No cached products available');
  }, [isOnline]);

  return {
    createSale,
    saveCartDraft,
    recoverDraft,
    clearCartDraft,
    getProducts,
    isOnline,
    pendingCount: pendingSalesCount
  };
};

export default useOfflineSales;
