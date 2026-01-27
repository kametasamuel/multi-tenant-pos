import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { securityRequestsAPI } from '../../api';
import {
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Edit3,
  AlertTriangle,
  ShieldAlert,
  X,
  RefreshCw,
  Building2,
  Calendar,
  ChevronDown
} from 'lucide-react';

const OwnerRequests = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, bgClass, currentBranch, isAllBranches, branches = [] }) => {
  const { user } = useAuth();
  const isRestaurantType = user?.businessType === 'FOOD_AND_BEVERAGE';
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [filterStatus, setFilterStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // Branch filter for drilling down when in "All Branches" mode
  const [branchFilter, setBranchFilter] = useState(null);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  const currencySymbol = user?.currencySymbol || '$';

  // Get the effective branchId for API calls
  const getEffectiveBranchId = () => {
    if (!isAllBranches && currentBranch) {
      return currentBranch.id;
    }
    if (isAllBranches && branchFilter) {
      return branchFilter.id;
    }
    return null;
  };

  // Reset branch filter when switching away from "All Branches" mode
  useEffect(() => {
    if (!isAllBranches) {
      setBranchFilter(null);
    }
  }, [isAllBranches]);

  useEffect(() => {
    loadRequests();
  }, [currentBranch, isAllBranches, branchFilter, startDate, endDate]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params = {};
      const effectiveBranchId = getEffectiveBranchId();
      if (effectiveBranchId) {
        params.branchId = effectiveBranchId;
      }
      // Add proper time components to dates for accurate filtering
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        params.startDate = start.toISOString();
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.endDate = end.toISOString();
      }
      const response = await securityRequestsAPI.getAll(params);
      const apiRequests = response.data.securityRequests || [];
      const transformedRequests = apiRequests.map(req => ({
        id: req.id,
        type: req.type === 'VOID' ? 'Void' : 'Review',
        status: req.status.charAt(0) + req.status.slice(1).toLowerCase(),
        item: req.itemName,
        price: req.amount,
        cashier: req.requester?.fullName || 'Unknown',
        reason: req.reason,
        time: new Date(req.createdAt).toLocaleString(),
        saleId: req.saleId,
        branchName: req.branch?.name || 'Unknown Branch'
      }));
      setRequests(transformedRequests);
    } catch (error) {
      console.error('Error loading requests:', error);
      showToast('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const formatCurrency = (amount) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleApprove = async (requestId) => {
    setProcessingId(requestId);
    try {
      await securityRequestsAPI.approve(requestId);
      setRequests(prev =>
        prev.map(r => r.id === requestId ? { ...r, status: 'Approved' } : r)
      );
      setSelectedRequest(null);
      showToast('Request Approved');
    } catch (error) {
      console.error('Error approving request:', error);
      showToast('Failed to approve request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId) => {
    setProcessingId(requestId);
    try {
      await securityRequestsAPI.reject(requestId);
      setRequests(prev =>
        prev.map(r => r.id === requestId ? { ...r, status: 'Rejected' } : r)
      );
      setSelectedRequest(null);
      showToast('Request Rejected');
    } catch (error) {
      console.error('Error rejecting request:', error);
      showToast('Failed to reject request');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (filterStatus === 'all') return true;
    return r.status.toLowerCase() === filterStatus;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'Pending').length,
    approved: requests.filter(r => r.status === 'Approved').length,
    rejected: requests.filter(r => r.status === 'Rejected').length
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${textClass}`}>
            {isRestaurantType ? 'Cancel Order Requests' : 'Void Requests'}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Building2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <p className={`text-sm ${mutedClass}`}>
              {isAllBranches ? 'All Branches' : currentBranch?.name || 'Select a branch'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Branch Filter Chip - Only show when filter is active in All Branches mode */}
          {isAllBranches && branchFilter && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-bold">
              <span>Filtered: {branchFilter.name}</span>
              <button
                onClick={() => setBranchFilter(null)}
                className="hover:bg-slate-700 dark:hover:bg-slate-600 rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Branch Filter Dropdown - Only show in All Branches mode */}
          {isAllBranches && (
            <div className="relative">
              <button
                onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm font-medium hover:border-slate-400 transition-colors`}
              >
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">{branchFilter ? branchFilter.name : 'All'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showBranchDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showBranchDropdown && (
                <div className={`absolute right-0 mt-2 w-56 ${surfaceClass} border ${borderClass} rounded-xl shadow-xl z-50 overflow-hidden`}>
                  <button
                    onClick={() => {
                      setBranchFilter(null);
                      setShowBranchDropdown(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 ${textClass} ${!branchFilter ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                  >
                    All Branches
                  </button>
                  {branches.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => {
                        setBranchFilter(branch);
                        setShowBranchDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 ${textClass} ${branchFilter?.id === branch.id ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                    >
                      {branch.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={loadRequests}
            disabled={loading}
            className={`p-3 rounded-xl ${surfaceClass} border ${borderClass} ${mutedClass} hover:border-slate-400 hover:text-slate-600 dark:text-slate-400 transition-colors disabled:opacity-50`}
            title="Refresh requests"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-5`}>
          <p className={`text-[10px] font-black uppercase ${mutedClass} mb-1`}>Total Requests</p>
          <p className={`text-2xl font-black ${textClass}`}>{stats.total}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-5`}>
          <p className={`text-[10px] font-black uppercase ${mutedClass} mb-1`}>Pending</p>
          <p className="text-2xl font-black text-warning-500">{stats.pending}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-5`}>
          <p className={`text-[10px] font-black uppercase ${mutedClass} mb-1`}>Approved</p>
          <p className="text-2xl font-black text-positive-500">{stats.approved}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-5`}>
          <p className={`text-[10px] font-black uppercase ${mutedClass} mb-1`}>Rejected</p>
          <p className="text-2xl font-black text-negative-500">{stats.rejected}</p>
        </div>
      </div>

      {/* Date Filter */}
      <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-5`}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className={`w-4 h-4 ${mutedClass}`} />
            <span className={`text-[10px] font-black uppercase ${mutedClass}`}>Date Range</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`px-4 py-2.5 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            />
            <span className={`text-xs ${mutedClass}`}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`px-4 py-2.5 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className={`px-4 py-2.5 rounded-xl border ${borderClass} ${mutedClass} hover:border-slate-400 text-[10px] font-bold uppercase`}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { value: 'all', label: 'All' },
          { value: 'pending', label: 'Pending' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' }
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterStatus(tab.value)}
            className={`px-5 py-2.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap transition-all ${
              filterStatus === tab.value
                ? 'bg-slate-800 dark:bg-slate-700 text-white'
                : `${surfaceClass} border ${borderClass} ${mutedClass} hover:border-slate-400`
            }`}
          >
            {tab.label}
            {tab.value !== 'all' && (
              <span className="ml-2">
                ({tab.value === 'pending' ? stats.pending : tab.value === 'approved' ? stats.approved : stats.rejected})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Info Box */}
      <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-6`}>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
            <AlertTriangle className="w-5 h-5 text-warning-500" />
          </div>
          <div>
            <p className={`text-sm font-black uppercase ${textClass} mb-1`}>
              {isRestaurantType ? 'About Cancel Order Requests' : 'About Void Requests'}
            </p>
            <p className={`text-xs ${mutedClass} leading-relaxed`}>
              {isRestaurantType
                ? 'Staff can submit requests to cancel orders. As the owner, you have full authority to approve or reject these requests. Approved cancellations will update the order status and restore any ingredients/inventory. This helps maintain accountability and audit trails across all branches.'
                : 'Cashiers can submit void requests to cancel transactions. As the owner, you have full authority to approve or reject these requests. Approved void requests will restore inventory and mark the transaction as voided. This helps maintain accountability and audit trails across all branches.'}
            </p>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {loading ? (
          <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-12 text-center`}>
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400"></div>
            </div>
            <p className={`text-sm font-bold ${textClass} mt-4`}>Loading requests...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-12 text-center`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${darkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <Bell className={`w-8 h-8 ${mutedClass} opacity-30`} />
            </div>
            <p className={`text-sm font-bold ${textClass} mb-1`}>
              {filterStatus === 'all' ? 'No Requests' : `No ${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} Requests`}
            </p>
            <p className={`text-xs ${mutedClass}`}>
              When cashiers submit void requests, they will appear here
            </p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <div
              key={request.id}
              onClick={() => setSelectedRequest(request)}
              className={`${surfaceClass} border ${borderClass} p-5 rounded-[28px] flex justify-between items-center shadow-sm cursor-pointer hover:border-slate-400 transition-colors`}
            >
              <div className="flex items-center gap-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  request.type === 'Void'
                    ? darkMode ? 'bg-negative-900/30 text-negative-400' : 'bg-negative-50 text-negative-500'
                    : darkMode ? 'bg-slate-700 text-slate-300' : 'bg-amber-50 text-slate-600 dark:text-slate-400'
                }`}>
                  {request.type === 'Void' ? (
                    <Trash2 className="w-5 h-5" />
                  ) : (
                    <Edit3 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4 className={`font-black text-sm uppercase ${textClass}`}>
                    {request.type}: {request.item}
                  </h4>
                  <p className={`text-[9px] ${mutedClass} font-bold uppercase`}>
                    {request.cashier} • {request.time}
                  </p>
                  {isAllBranches && (
                    <p className={`text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase mt-1`}>
                      <Building2 className="w-3 h-3 inline mr-1" />
                      {request.branchName}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-black text-sm text-slate-600 dark:text-slate-400">{formatCurrency(request.price)}</span>
                <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase ${
                  request.status === 'Pending'
                    ? darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-400'
                    : request.status === 'Approved'
                      ? 'bg-positive-100 text-positive-600'
                      : 'bg-negative-100 text-negative-600'
                }`}>
                  {request.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedRequest(null)}>
          <div
            className={`${surfaceClass} w-full max-w-md rounded-[32px] p-8 shadow-2xl border ${borderClass} relative`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedRequest(null)}
              className={`absolute top-6 right-6 ${mutedClass} hover:text-negative-500`}
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-8">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                darkMode ? 'bg-negative-900/30' : 'bg-negative-50'
              }`}>
                <ShieldAlert className="w-8 h-8 text-negative-500" />
              </div>
              <h2 className={`text-xl font-black uppercase ${textClass}`}>{selectedRequest.type} Request</h2>
              <p className={`text-[10px] font-bold ${mutedClass} uppercase tracking-widest`}>
                {selectedRequest.item}
              </p>
            </div>

            <div className={`${darkMode ? 'bg-slate-800' : 'bg-slate-50'} p-5 rounded-2xl space-y-4 mb-8`}>
              <div className="flex justify-between text-[10px] font-bold">
                <span className={mutedClass}>VALUE</span>
                <span className="text-slate-600 dark:text-slate-400">{formatCurrency(selectedRequest.price)}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold">
                <span className={mutedClass}>CASHIER</span>
                <span className={textClass}>{selectedRequest.cashier}</span>
              </div>
              {isAllBranches && (
                <div className="flex justify-between text-[10px] font-bold">
                  <span className={mutedClass}>BRANCH</span>
                  <span className="text-slate-600 dark:text-slate-400">{selectedRequest.branchName}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] font-bold">
                <span className={mutedClass}>TIME</span>
                <span className={textClass}>{selectedRequest.time}</span>
              </div>
              <div className={`border-t pt-3 ${borderClass}`}>
                <p className={`text-[10px] font-black ${mutedClass} uppercase mb-2`}>Cashier's Reason:</p>
                <p className={`text-xs font-medium italic ${textClass}`}>"{selectedRequest.reason}"</p>
              </div>
            </div>

            {selectedRequest.status === 'Pending' ? (
              <div className="flex gap-4">
                <button
                  onClick={() => handleReject(selectedRequest.id)}
                  disabled={processingId === selectedRequest.id}
                  className={`flex-1 py-4 border ${borderClass} rounded-2xl font-black text-[10px] uppercase ${mutedClass} hover:border-negative-500 hover:text-negative-500 transition-colors disabled:opacity-50`}
                >
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(selectedRequest.id)}
                  disabled={processingId === selectedRequest.id}
                  className="flex-1 py-4 bg-slate-800 dark:bg-slate-700 text-white rounded-2xl font-black text-[10px] uppercase disabled:opacity-50"
                >
                  Approve
                </button>
              </div>
            ) : (
              <div className={`text-center py-4 rounded-2xl ${
                selectedRequest.status === 'Approved'
                  ? 'bg-positive-100 text-positive-600'
                  : 'bg-negative-100 text-negative-600'
              } font-black text-[10px] uppercase`}>
                {selectedRequest.status}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
          <div className={`${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${darkMode ? 'border-slate-200' : 'border-white/10'}`}>
            <CheckCircle className="w-5 h-5 text-positive-500" />
            <span className="font-bold text-xs uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerRequests;
