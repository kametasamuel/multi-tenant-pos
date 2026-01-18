import React, { useState } from 'react';
import { superAdminAPI } from '../api';
import './Modal.css';

const ApplicationModal = ({ application, onClose, onActionComplete }) => {
  const [action, setAction] = useState(null); // 'approve' | 'reject'
  const [subscriptionMonths, setSubscriptionMonths] = useState(1);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState(null);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleApprove = async () => {
    if (subscriptionMonths < 1 || subscriptionMonths > 60) {
      setError('Subscription months must be between 1 and 60');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await superAdminAPI.approveApplication(application.id, subscriptionMonths);
      setCredentials(response.data);
      setAction('approved');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve application');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (rejectionReason.length < 10) {
      setError('Please provide a detailed rejection reason (at least 10 characters)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await superAdminAPI.rejectApplication(application.id, rejectionReason);
      onActionComplete();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject application');
    } finally {
      setLoading(false);
    }
  };

  const isPending = application.status === 'PENDING';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>

        {credentials ? (
          // Show credentials after approval
          <div className="credentials-view">
            <div className="success-icon">&#10003;</div>
            <h2>Application Approved!</h2>
            <p>The tenant account has been created successfully.</p>

            <div className="credentials-box">
              <h3>Tenant Credentials</h3>
              <div className="credential-item">
                <label>Username:</label>
                <code>{credentials.credentials.username}</code>
              </div>
              <div className="credential-item">
                <label>Password:</label>
                <span className="password-note">
                  {credentials.credentials.note}
                </span>
              </div>
              <div className="credential-item">
                <label>Subscription Valid Until:</label>
                <span>{formatDate(credentials.tenant.subscriptionEnd)}</span>
              </div>
            </div>

            <p className="credentials-warning">
              Please share these credentials securely with the business owner.
            </p>

            <button className="btn-primary" onClick={onActionComplete}>
              Done
            </button>
          </div>
        ) : (
          // Show application details
          <>
            <div className="modal-header">
              <h2>Application Details</h2>
              <span className={`status-badge status-${application.status.toLowerCase()}`}>
                {application.status}
              </span>
            </div>

            <div className="modal-body">
              {application.businessLogo && (
                <div className="logo-preview">
                  <img src={application.businessLogo} alt="Business Logo" />
                </div>
              )}

              <div className="details-section">
                <h3>Business Information</h3>
                <div className="detail-row">
                  <label>Business Name:</label>
                  <span>{application.businessName}</span>
                </div>
                <div className="detail-row">
                  <label>Email:</label>
                  <span>{application.businessEmail}</span>
                </div>
                {application.businessPhone && (
                  <div className="detail-row">
                    <label>Phone:</label>
                    <span>{application.businessPhone}</span>
                  </div>
                )}
                {application.businessAddress && (
                  <div className="detail-row">
                    <label>Address:</label>
                    <span>{application.businessAddress}</span>
                  </div>
                )}
              </div>

              <div className="details-section">
                <h3>Owner / Admin Details</h3>
                <div className="detail-row">
                  <label>Full Name:</label>
                  <span>{application.ownerFullName}</span>
                </div>
                <div className="detail-row">
                  <label>Email:</label>
                  <span>{application.ownerEmail}</span>
                </div>
                {application.ownerPhone && (
                  <div className="detail-row">
                    <label>Phone:</label>
                    <span>{application.ownerPhone}</span>
                  </div>
                )}
              </div>

              <div className="details-section">
                <h3>Application Status</h3>
                <div className="detail-row">
                  <label>Submitted:</label>
                  <span>{formatDate(application.createdAt)}</span>
                </div>
                {application.reviewedAt && (
                  <div className="detail-row">
                    <label>Reviewed:</label>
                    <span>{formatDate(application.reviewedAt)}</span>
                  </div>
                )}
                {application.rejectionReason && (
                  <div className="detail-row">
                    <label>Rejection Reason:</label>
                    <span className="rejection-reason">{application.rejectionReason}</span>
                  </div>
                )}
              </div>

              {error && <div className="error-message">{error}</div>}

              {isPending && !action && (
                <div className="action-section">
                  <h3>Take Action</h3>
                  <div className="action-buttons">
                    <button
                      className="btn-approve"
                      onClick={() => setAction('approve')}
                    >
                      Approve
                    </button>
                    <button
                      className="btn-reject"
                      onClick={() => setAction('reject')}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {action === 'approve' && (
                <div className="action-form">
                  <h3>Approve Application</h3>
                  <div className="form-group">
                    <label>Subscription Duration (months)</label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={subscriptionMonths}
                      onChange={(e) => setSubscriptionMonths(parseInt(e.target.value) || 1)}
                    />
                    <span className="form-hint">Set how long their subscription will last</span>
                  </div>
                  <div className="form-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => setAction(null)}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn-approve"
                      onClick={handleApprove}
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : 'Confirm Approval'}
                    </button>
                  </div>
                </div>
              )}

              {action === 'reject' && (
                <div className="action-form">
                  <h3>Reject Application</h3>
                  <div className="form-group">
                    <label>Rejection Reason</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Please provide a detailed reason for rejection..."
                      rows="4"
                    />
                    <span className="form-hint">This will be shown to the applicant</span>
                  </div>
                  <div className="form-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => setAction(null)}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn-reject"
                      onClick={handleReject}
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : 'Confirm Rejection'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ApplicationModal;
