/**
 * Offline Status Indicator
 *
 * Shows current online/offline status and sync status.
 * Displays:
 * - Connection status (online/offline)
 * - Pending sales count
 * - Sync progress
 * - Manual sync button
 */

import React, { useState } from 'react';
import { useOffline } from '../context/OfflineContext';
import {
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  X
} from 'lucide-react';

const OfflineIndicator = ({ compact = false, darkMode = false }) => {
  const {
    isOnline,
    isSyncing,
    pendingSalesCount,
    syncProgress,
    lastSyncResult,
    hasDraftTransaction,
    triggerSync
  } = useOffline();

  const [showDetails, setShowDetails] = useState(false);

  // Compact mode - just shows icon
  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={`p-2 rounded-lg transition-colors ${
            isOnline
              ? pendingSalesCount > 0
                ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                : 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
              : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
          }`}
        >
          {isOnline ? (
            isSyncing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : pendingSalesCount > 0 ? (
              <Cloud className="w-5 h-5" />
            ) : (
              <Wifi className="w-5 h-5" />
            )
          ) : (
            <WifiOff className="w-5 h-5" />
          )}
          {pendingSalesCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {pendingSalesCount}
            </span>
          )}
        </button>

        {/* Dropdown details */}
        {showDetails && (
          <div
            className={`absolute right-0 top-full mt-2 w-72 rounded-xl shadow-xl border z-50 ${
              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
            }`}
          >
            <OfflineDetails
              darkMode={darkMode}
              onClose={() => setShowDetails(false)}
            />
          </div>
        )}
      </div>
    );
  }

  // Full mode - shows status bar
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 rounded-xl ${
        isOnline
          ? pendingSalesCount > 0
            ? darkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
            : darkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'
          : darkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'
      }`}
    >
      {isOnline ? (
        isSyncing ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Wifi className="w-4 h-4" />
        )
      ) : (
        <WifiOff className="w-4 h-4" />
      )}

      <span className="text-sm font-medium">
        {!isOnline ? (
          'Offline Mode'
        ) : isSyncing ? (
          syncProgress ? `Syncing ${syncProgress.current}/${syncProgress.total}...` : 'Syncing...'
        ) : pendingSalesCount > 0 ? (
          `${pendingSalesCount} sale${pendingSalesCount > 1 ? 's' : ''} pending sync`
        ) : (
          'Online'
        )}
      </span>

      {isOnline && pendingSalesCount > 0 && !isSyncing && (
        <button
          onClick={triggerSync}
          className={`ml-auto text-xs font-bold uppercase px-2 py-1 rounded ${
            darkMode ? 'bg-yellow-800 hover:bg-yellow-700' : 'bg-yellow-200 hover:bg-yellow-300'
          }`}
        >
          Sync Now
        </button>
      )}
    </div>
  );
};

// Detailed offline status panel
const OfflineDetails = ({ darkMode, onClose }) => {
  const {
    isOnline,
    isSyncing,
    pendingSalesCount,
    syncProgress,
    lastSyncResult,
    hasDraftTransaction,
    triggerSync,
    refreshCache
  } = useOffline();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshCache = async () => {
    setRefreshing(true);
    await refreshCache();
    setRefreshing(false);
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-bold text-sm uppercase ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Connection Status
        </h3>
        <button
          onClick={onClose}
          className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 ${
            darkMode ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Status */}
      <div className="space-y-3">
        {/* Online/Offline */}
        <div className="flex items-center gap-3">
          {isOnline ? (
            <>
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Connected
                </p>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Sales will sync automatically
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Offline
                </p>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Sales saved locally, will sync when online
                </p>
              </div>
            </>
          )}
        </div>

        {/* Pending Sales */}
        {pendingSalesCount > 0 && (
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CloudOff className={`w-4 h-4 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {pendingSalesCount} Pending Sale{pendingSalesCount > 1 ? 's' : ''}
                </span>
              </div>
              {isOnline && !isSyncing && (
                <button
                  onClick={triggerSync}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Sync
                </button>
              )}
            </div>
            {isSyncing && syncProgress && (
              <div className="mt-2">
                <div className="h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                  />
                </div>
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Syncing {syncProgress.current} of {syncProgress.total}...
                </p>
              </div>
            )}
          </div>
        )}

        {/* Draft Transaction Warning */}
        {hasDraftTransaction && (
          <div className={`p-3 rounded-lg flex items-center gap-2 ${
            darkMode ? 'bg-yellow-900/30' : 'bg-yellow-50'
          }`}>
            <AlertTriangle className={`w-4 h-4 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
            <span className={`text-sm ${darkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
              You have an unsaved transaction
            </span>
          </div>
        )}

        {/* Last Sync Result */}
        {lastSyncResult && (
          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <div className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              <span>Last sync: {lastSyncResult.synced} synced</span>
              {lastSyncResult.failed > 0 && (
                <span className="text-red-500">, {lastSyncResult.failed} failed</span>
              )}
            </div>
          </div>
        )}

        {/* Refresh Cache Button */}
        {isOnline && (
          <button
            onClick={handleRefreshCache}
            disabled={refreshing}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
              darkMode
                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            } disabled:opacity-50`}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Product Cache'}
          </button>
        )}
      </div>
    </div>
  );
};

export default OfflineIndicator;
