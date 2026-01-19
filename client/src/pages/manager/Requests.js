import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  AlertTriangle,
  Search,
  User
} from 'lucide-react';

const ManagerRequests = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, bgClass }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [processingId, setProcessingId] = useState(null);

  const currencySymbol = user?.currencySymbol || '$';

  // Simulated requests data - in production, this would come from the backend
  useEffect(() => {
    // Placeholder for when real request system is implemented
    setRequests([]);
  }, []);

  const formatCurrency = (amount) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleApprove = async (requestId) => {
    setProcessingId(requestId);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setRequests(prev =>
        prev.map(r => r.id === requestId ? { ...r, status: 'approved' } : r)
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId) => {
    setProcessingId(requestId);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setRequests(prev =>
        prev.map(r => r.id === requestId ? { ...r, status: 'rejected' } : r)
      );
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter(r =>
    filterStatus === 'all' || r.status === filterStatus
  );

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-xl sm:text-2xl font-black uppercase tracking-tighter ${textClass}`}>
          Security Requests
        </h1>
        <p className={`text-sm ${mutedClass}`}>
          Review and manage void and review requests from cashiers
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <Bell className={`w-5 h-5 mb-2 ${mutedClass}`} />
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Total Requests</p>
          <p className={`text-xl font-black ${textClass}`}>{stats.total}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <Clock className="w-5 h-5 mb-2 text-orange-500" />
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Pending</p>
          <p className="text-xl font-black text-orange-500">{stats.pending}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <CheckCircle className="w-5 h-5 mb-2 text-green-500" />
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Approved</p>
          <p className="text-xl font-black text-green-500">{stats.approved}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <XCircle className="w-5 h-5 mb-2 text-red-500" />
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Rejected</p>
          <p className="text-xl font-black text-red-500">{stats.rejected}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'all', label: 'All', color: '' },
          { id: 'pending', label: 'Pending', color: 'orange' },
          { id: 'approved', label: 'Approved', color: 'green' },
          { id: 'rejected', label: 'Rejected', color: 'red' }
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setFilterStatus(filter.id)}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase whitespace-nowrap transition-all ${
              filterStatus === filter.id
                ? filter.color === 'orange' ? 'bg-orange-500 text-white'
                  : filter.color === 'green' ? 'bg-green-500 text-white'
                  : filter.color === 'red' ? 'bg-red-500 text-white'
                  : darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'
                : `${surfaceClass} border ${borderClass} ${mutedClass} hover:border-indigo-500`
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-8 text-center`}>
            <Bell className={`w-12 h-12 mx-auto mb-3 ${mutedClass}`} />
            <p className={`text-sm font-bold ${textClass}`}>No requests found</p>
            <p className={`text-xs ${mutedClass}`}>
              {requests.length === 0
                ? 'No security requests have been submitted yet'
                : 'Try adjusting your filter'}
            </p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <div key={request.id} className={`${surfaceClass} border ${borderClass} rounded-2xl p-5`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    request.type === 'void'
                      ? darkMode ? 'bg-red-900/30' : 'bg-red-100'
                      : darkMode ? 'bg-indigo-900/30' : 'bg-indigo-100'
                  }`}>
                    {request.type === 'void' ? (
                      <XCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <Eye className="w-5 h-5 text-indigo-500" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${textClass}`}>
                      {request.type === 'void' ? 'Void' : 'Review'} Request
                    </p>
                    <p className={`text-[10px] ${mutedClass}`}>
                      Transaction #{request.transactionNumber?.slice(-8)}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase ${
                  request.status === 'pending' ? 'bg-orange-100 text-orange-600'
                    : request.status === 'approved' ? 'bg-green-100 text-green-600'
                    : 'bg-red-100 text-red-600'
                }`}>
                  {request.status}
                </span>
              </div>

              {/* Request Details */}
              <div className={`p-3 rounded-xl ${bgClass} mb-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <User className={`w-3.5 h-3.5 ${mutedClass}`} />
                  <span className={`text-xs font-bold ${textClass}`}>{request.cashierName}</span>
                </div>
                <p className={`text-sm ${mutedClass}`}>"{request.reason}"</p>
              </div>

              {/* Sale Info */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className={`text-[10px] ${mutedClass}`}>Amount</p>
                  <p className={`text-lg font-black text-indigo-500`}>{formatCurrency(request.amount)}</p>
                </div>
                <div className="text-right">
                  <p className={`text-[10px] ${mutedClass}`}>Submitted</p>
                  <p className={`text-xs font-bold ${textClass}`}>
                    {new Date(request.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Action Buttons (only for pending) */}
              {request.status === 'pending' && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleReject(request.id)}
                    disabled={processingId === request.id}
                    className="flex items-center justify-center gap-2 py-2.5 border border-red-300 text-red-600 rounded-xl text-[10px] font-bold uppercase hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(request.id)}
                    disabled={processingId === request.id}
                    className="flex items-center justify-center gap-2 py-2.5 bg-green-500 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Info Box */}
      <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-5`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className={`text-sm font-bold ${textClass} mb-1`}>About Security Requests</p>
            <p className={`text-xs ${mutedClass}`}>
              Cashiers can submit void requests to cancel transactions or review requests for manager oversight.
              All approved void requests will restore inventory and mark the transaction as voided.
              This feature helps maintain accountability and audit trails.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerRequests;
