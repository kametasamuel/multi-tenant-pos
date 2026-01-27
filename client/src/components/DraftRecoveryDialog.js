/**
 * Draft Recovery Dialog
 *
 * Shows when a user returns to POS and there's an unsaved transaction.
 * Allows them to restore or discard the draft.
 */

import React from 'react';
import { AlertTriangle, RefreshCw, Trash2, ShoppingBag } from 'lucide-react';

const DraftRecoveryDialog = ({
  draft,
  onRestore,
  onDiscard,
  darkMode = false,
  currencySymbol = '$'
}) => {
  if (!draft) return null;

  const surfaceClass = darkMode ? 'bg-slate-800' : 'bg-white';
  const textClass = darkMode ? 'text-white' : 'text-gray-900';
  const mutedClass = darkMode ? 'text-slate-400' : 'text-gray-500';
  const borderClass = darkMode ? 'border-slate-700' : 'border-gray-200';

  // Calculate draft totals
  const cartItems = draft.cart || [];
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Format saved time
  const savedAt = draft.savedAt ? new Date(draft.savedAt) : null;
  const timeAgo = savedAt ? getTimeAgo(savedAt) : 'recently';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={`${surfaceClass} rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in`}
      >
        {/* Header */}
        <div className={`p-6 border-b ${borderClass} text-center`}>
          <div className="w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h2 className={`text-xl font-black uppercase ${textClass}`}>
            Unsaved Transaction Found
          </h2>
          <p className={`text-sm ${mutedClass} mt-2`}>
            A transaction was interrupted {timeAgo}
          </p>
        </div>

        {/* Draft Summary */}
        <div className="p-6">
          <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-3 mb-3">
              <ShoppingBag className={`w-5 h-5 ${mutedClass}`} />
              <span className={`font-bold text-sm uppercase ${textClass}`}>
                Cart Summary
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className={mutedClass}>Items</span>
                <span className={`font-bold ${textClass}`}>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className={mutedClass}>Products</span>
                <span className={`font-bold ${textClass}`}>{cartItems.length} unique</span>
              </div>
              <div className={`flex justify-between pt-2 border-t ${borderClass}`}>
                <span className={`font-bold ${textClass}`}>Total</span>
                <span className={`font-black text-lg ${textClass}`}>
                  {currencySymbol}{total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Customer info if present */}
            {draft.customer && (
              <div className={`mt-3 pt-3 border-t ${borderClass} text-sm`}>
                <span className={mutedClass}>Customer: </span>
                <span className={`font-medium ${textClass}`}>{draft.customer.name}</span>
              </div>
            )}
          </div>

          {/* Preview items */}
          {cartItems.length > 0 && (
            <div className={`mt-4 text-xs ${mutedClass}`}>
              <p className="font-bold uppercase mb-2">Items:</p>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {cartItems.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span className="truncate flex-1">{item.name}</span>
                    <span className="ml-2">x{item.quantity}</span>
                  </div>
                ))}
                {cartItems.length > 5 && (
                  <p className="text-center opacity-50">
                    +{cartItems.length - 5} more item{cartItems.length - 5 !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={`p-6 border-t ${borderClass} space-y-3`}>
          <button
            onClick={onRestore}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm uppercase flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Restore Transaction
          </button>
          <button
            onClick={onDiscard}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm uppercase flex items-center justify-center gap-2 transition-colors ${
              darkMode
                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            Discard & Start Fresh
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper function to format time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export default DraftRecoveryDialog;
