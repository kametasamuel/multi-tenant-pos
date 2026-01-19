import React, { useState } from 'react';
import { superAdminAPI } from '../api';
import {
  X,
  Calendar,
  CalendarPlus,
  Building2,
  Clock,
  AlertTriangle
} from 'lucide-react';

const SubscriptionModal = ({ tenant, onClose, onSuccess }) => {
  const [extensionType, setExtensionType] = useState('months');
  const [extensionValue, setExtensionValue] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateNewEndDate = () => {
    let currentEnd = new Date(tenant.subscriptionEnd);
    if (currentEnd < new Date()) {
      currentEnd = new Date();
    }

    if (extensionType === 'months') {
      currentEnd.setMonth(currentEnd.getMonth() + extensionValue);
    } else {
      currentEnd.setDate(currentEnd.getDate() + extensionValue);
    }

    return currentEnd;
  };

  const handleExtend = async () => {
    if (extensionValue < 1) {
      setError('Please enter a valid extension value');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = extensionType === 'months'
        ? { months: extensionValue }
        : { days: extensionValue };

      await superAdminAPI.extendSubscription(tenant.id, data);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to extend subscription');
    } finally {
      setLoading(false);
    }
  };

  const isExpired = new Date(tenant.subscriptionEnd) < new Date();
  const daysLeft = Math.ceil((new Date(tenant.subscriptionEnd) - new Date()) / (1000 * 60 * 60 * 24));

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Extend Subscription</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Tenant Summary */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
            {tenant.businessLogo ? (
              <img
                src={tenant.businessLogo}
                alt={tenant.businessName}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-purple-600" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-gray-900">{tenant.businessName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className={`text-sm ${isExpired ? 'text-red-600' : 'text-gray-600'}`}>
                  {formatDate(tenant.subscriptionEnd)}
                  {isExpired ? (
                    <span className="ml-1 text-red-600 font-medium">(Expired)</span>
                  ) : (
                    <span className="ml-1 text-gray-500">({daysLeft} days left)</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Extension Form */}
          <div className="space-y-4">
            {/* Extension Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Extension Type
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setExtensionType('months')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    extensionType === 'months'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Months
                </button>
                <button
                  onClick={() => setExtensionType('days')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    extensionType === 'days'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Days
                </button>
              </div>
            </div>

            {/* Extension Value */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Extend by
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max={extensionType === 'months' ? 60 : 365}
                  value={extensionValue}
                  onChange={(e) => setExtensionValue(parseInt(e.target.value) || 1)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
                <span className="text-gray-600 font-medium">{extensionType}</span>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">New End Date</span>
              </div>
              <p className="text-lg font-semibold text-purple-900">
                {formatDate(calculateNewEndDate())}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExtend}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Extend Subscription'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;
