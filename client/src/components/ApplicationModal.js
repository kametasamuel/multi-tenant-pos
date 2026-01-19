import React, { useState } from 'react';
import { superAdminAPI } from '../api';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Mail,
  Phone,
  MapPin,
  User,
  Calendar,
  Copy,
  AlertTriangle
} from 'lucide-react';

const ApplicationModal = ({ application, onClose, onActionComplete }) => {
  const [action, setAction] = useState(null);
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const isPending = application.status === 'PENDING';

  const getStatusBadge = () => {
    switch (application.status) {
      case 'PENDING':
        return { bg: 'bg-amber-100', text: 'text-amber-800', icon: Clock };
      case 'APPROVED':
        return { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle2 };
      case 'REJECTED':
        return { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', icon: Clock };
    }
  };

  const status = getStatusBadge();
  const StatusIcon = status.icon;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {credentials ? (
          // Show credentials after approval
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Application Approved!</h2>
            <p className="text-gray-600 mb-6">The tenant account has been created successfully.</p>

            <div className="bg-gray-50 rounded-xl p-6 mb-6 text-left">
              <h3 className="font-semibold text-gray-900 mb-4">Tenant Credentials</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Username</p>
                    <code className="text-gray-900 font-medium">{credentials.credentials.username}</code>
                  </div>
                  <button
                    onClick={() => copyToClipboard(credentials.credentials.username)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Password</p>
                  <p className="text-gray-700">{credentials.credentials.note}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Subscription Valid Until</p>
                  <p className="text-gray-900 font-medium">{formatDate(credentials.tenant.subscriptionEnd)}</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Please share these credentials securely with the business owner.
              </p>
            </div>

            <button
              onClick={onActionComplete}
              className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900">Application Details</h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {application.status}
                </span>
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
              {/* Logo */}
              {application.businessLogo && (
                <div className="flex justify-center">
                  <img
                    src={application.businessLogo}
                    alt="Business Logo"
                    className="h-20 w-20 rounded-xl object-cover"
                  />
                </div>
              )}

              {/* Business Information */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-500" />
                  Business Information
                </h3>
                <div className="grid gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-24">Name</span>
                    <span className="text-gray-900 font-medium">{application.businessName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-24">Email</span>
                    <span className="text-gray-900 flex items-center gap-1">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {application.businessEmail}
                    </span>
                  </div>
                  {application.businessPhone && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 w-24">Phone</span>
                      <span className="text-gray-900 flex items-center gap-1">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {application.businessPhone}
                      </span>
                    </div>
                  )}
                  {application.businessAddress && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 w-24">Address</span>
                      <span className="text-gray-900 flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {application.businessAddress}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Owner Information */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  Owner / Admin Details
                </h3>
                <div className="grid gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-24">Full Name</span>
                    <span className="text-gray-900 font-medium">{application.ownerFullName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-24">Email</span>
                    <span className="text-gray-900 flex items-center gap-1">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {application.ownerEmail}
                    </span>
                  </div>
                  {application.ownerPhone && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 w-24">Phone</span>
                      <span className="text-gray-900 flex items-center gap-1">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {application.ownerPhone}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Application Status */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  Application Status
                </h3>
                <div className="grid gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-24">Submitted</span>
                    <span className="text-gray-900">{formatDate(application.createdAt)}</span>
                  </div>
                  {application.reviewedAt && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 w-24">Reviewed</span>
                      <span className="text-gray-900">{formatDate(application.reviewedAt)}</span>
                    </div>
                  )}
                  {application.rejectionReason && (
                    <div className="flex items-start gap-3">
                      <span className="text-sm text-gray-500 w-24">Reason</span>
                      <span className="text-red-700 bg-red-50 px-3 py-2 rounded-lg text-sm">
                        {application.rejectionReason}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              {isPending && !action && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setAction('approve')}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setAction('reject')}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Reject
                  </button>
                </div>
              )}

              {/* Approve Form */}
              {action === 'approve' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <h3 className="font-semibold text-green-900 mb-4">Approve Application</h3>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-green-800 mb-1.5">
                      Subscription Duration (months)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={subscriptionMonths}
                      onChange={(e) => setSubscriptionMonths(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    />
                    <p className="text-xs text-green-700 mt-1">Set how long their subscription will last</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setAction(null)}
                      disabled={loading}
                      className="flex-1 px-4 py-2 border border-green-300 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {loading ? 'Processing...' : 'Confirm Approval'}
                    </button>
                  </div>
                </div>
              )}

              {/* Reject Form */}
              {action === 'reject' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <h3 className="font-semibold text-red-900 mb-4">Reject Application</h3>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-red-800 mb-1.5">
                      Rejection Reason
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Please provide a detailed reason for rejection..."
                      rows="4"
                      className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                    />
                    <p className="text-xs text-red-700 mt-1">This will be shown to the applicant</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setAction(null)}
                      disabled={loading}
                      className="flex-1 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-100 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
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
