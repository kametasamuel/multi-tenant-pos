import React, { useState } from 'react';
import { superAdminAPI } from '../api';
import './Modal.css';

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>

        <div className="modal-header">
          <h2>Extend Subscription</h2>
        </div>

        <div className="modal-body">
          <div className="tenant-summary">
            <h3>{tenant.businessName}</h3>
            <div className="current-subscription">
              <label>Current End Date:</label>
              <span className={isExpired ? 'expired' : ''}>
                {formatDate(tenant.subscriptionEnd)}
                {isExpired ? ' (Expired)' : ` (${daysLeft} days left)`}
              </span>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="extension-form">
            <div className="form-group">
              <label>Extension Type</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="extensionType"
                    value="months"
                    checked={extensionType === 'months'}
                    onChange={(e) => setExtensionType(e.target.value)}
                  />
                  Months
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="extensionType"
                    value="days"
                    checked={extensionType === 'days'}
                    onChange={(e) => setExtensionType(e.target.value)}
                  />
                  Days
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>Extend by</label>
              <div className="input-with-label">
                <input
                  type="number"
                  min="1"
                  max={extensionType === 'months' ? 60 : 365}
                  value={extensionValue}
                  onChange={(e) => setExtensionValue(parseInt(e.target.value) || 1)}
                />
                <span>{extensionType}</span>
              </div>
            </div>

            <div className="preview-box">
              <label>New End Date:</label>
              <span className="new-date">{formatDate(calculateNewEndDate())}</span>
            </div>
          </div>

          <div className="form-actions">
            <button
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleExtend}
              disabled={loading}
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
