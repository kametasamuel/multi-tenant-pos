import React, { useState, useEffect } from 'react';
import { superAdminAPI } from '../../api';
import {
  GitBranch,
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  MapPin,
  Phone,
  FileText,
  Search,
  Filter,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  MessageSquare
} from 'lucide-react';

const BranchRequests = ({
  darkMode = false,
  surfaceClass = 'bg-white',
  textClass = 'text-slate-900',
  mutedClass = 'text-slate-500',
  borderClass = 'border-slate-200'
}) => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });
  const [filters, setFilters] = useState({
    status: 'all',
    search: ''
  });
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveModal, setApproveModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filters.status]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status !== 'all') params.status = filters.status.toUpperCase();

      const response = await superAdminAPI.getBranchRequests(params);
      const requestsList = response.data.requests || [];
      setRequests(requestsList);

      // Calculate stats
      const allRequests = response.data.requests || [];
      setStats({
        total: allRequests.length,
        pending: allRequests.filter(r => r.status === 'PENDING').length,
        approved: allRequests.filter(r => r.status === 'APPROVED').length,
        rejected: allRequests.filter(r => r.status === 'REJECTED').length
      });

    } catch (error) {
      console.error('Error fetching branch requests:', error);
      // Mock data for demo
      const mockRequests = [
        {
          id: '1',
          branchName: 'Downtown Branch',
          address: '123 Main Street, Downtown',
          phone: '+1 555-0101',
          reason: 'Expanding to serve customers in the downtown area. High foot traffic expected.',
          status: 'PENDING',
          tenant: { businessName: 'Trim N Fade Salon', email: 'owner@trimnfade.com' },
          requester: { fullName: 'John Owner', username: 'john_owner' },
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          branchName: 'Mall Kiosk',
          address: 'Westfield Mall, Unit K12',
          phone: '+1 555-0102',
          reason: 'Strategic location in the busiest mall in the city.',
          status: 'PENDING',
          tenant: { businessName: 'Quick Mart', email: 'contact@quickmart.com' },
          requester: { fullName: 'Sarah Manager', username: 'sarah_mgr' },
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '3',
          branchName: 'Airport Terminal',
          address: 'JFK Airport, Terminal 4',
          phone: '+1 555-0103',
          reason: 'High-value customers, 24/7 operation potential.',
          status: 'APPROVED',
          tenant: { businessName: 'Coffee Corner', email: 'ops@coffeecorner.com' },
          requester: { fullName: 'Mike Business', username: 'mike_b' },
          reviewer: { fullName: 'Admin User' },
          reviewedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '4',
          branchName: 'Suburbs Location',
          address: '789 Residential Ave',
          phone: '+1 555-0104',
          reason: 'Testing residential area market.',
          status: 'REJECTED',
          rejectionReason: 'Insufficient business case. Please provide market research data.',
          tenant: { businessName: 'Tech Store', email: 'support@techstore.com' },
          requester: { fullName: 'Lisa Chen', username: 'lisa_c' },
          reviewer: { fullName: 'Admin User' },
          reviewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
      setRequests(mockRequests);
      setStats({
        total: mockRequests.length,
        pending: mockRequests.filter(r => r.status === 'PENDING').length,
        approved: mockRequests.filter(r => r.status === 'APPROVED').length,
        rejected: mockRequests.filter(r => r.status === 'REJECTED').length
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approveModal) return;

    setActionLoading(true);
    try {
      await superAdminAPI.approveBranchRequest(approveModal.id);
      fetchData();
      setApproveModal(null);
      setSelectedRequest(null);
    } catch (error) {
      console.error('Error approving request:', error);
      // Mock approval for demo
      setRequests(requests.map(r =>
        r.id === approveModal.id
          ? { ...r, status: 'APPROVED', reviewedAt: new Date().toISOString() }
          : r
      ));
      setApproveModal(null);
      setSelectedRequest(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) return;

    setActionLoading(true);
    try {
      await superAdminAPI.rejectBranchRequest(rejectModal.id, rejectReason);
      fetchData();
      setRejectModal(null);
      setRejectReason('');
      setSelectedRequest(null);
    } catch (error) {
      console.error('Error rejecting request:', error);
      // Mock rejection for demo
      setRequests(requests.map(r =>
        r.id === rejectModal.id
          ? { ...r, status: 'REJECTED', rejectionReason: rejectReason, reviewedAt: new Date().toISOString() }
          : r
      ));
      setRejectModal(null);
      setRejectReason('');
      setSelectedRequest(null);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    if (filters.status !== 'all' && req.status !== filters.status.toUpperCase()) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return req.branchName.toLowerCase().includes(searchLower) ||
             req.tenant?.businessName?.toLowerCase().includes(searchLower);
    }
    return true;
  });

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      PENDING: 'bg-amber-100 text-amber-700',
      APPROVED: 'bg-emerald-100 text-emerald-700',
      REJECTED: 'bg-red-100 text-red-700'
    };
    const icons = {
      PENDING: Clock,
      APPROVED: CheckCircle,
      REJECTED: XCircle
    };
    const Icon = icons[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${styles[status]}`}>
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
  };

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className={`${surfaceClass} rounded-2xl p-5 border ${borderClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className={`text-2xl font-black ${textClass}`}>{value}</p>
      <p className={`text-xs font-medium ${mutedClass} mt-1`}>{label}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black ${textClass}`}>Branch Requests</h1>
          <p className={`text-sm ${mutedClass}`}>Review and manage tenant branch expansion requests</p>
        </div>
        <button
          onClick={fetchData}
          className={`px-4 py-2 ${surfaceClass} border ${borderClass} rounded-xl text-sm font-bold ${textClass} hover:bg-slate-50 flex items-center gap-2`}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={GitBranch} label="Total Requests" value={stats.total} color="bg-indigo-600" />
        <StatCard icon={Clock} label="Pending Review" value={stats.pending} color="bg-amber-500" />
        <StatCard icon={CheckCircle} label="Approved" value={stats.approved} color="bg-emerald-600" />
        <StatCard icon={XCircle} label="Rejected" value={stats.rejected} color="bg-red-500" />
      </div>

      {/* Filters */}
      <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
            <input
              type="text"
              placeholder="Search by branch or tenant..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className={`w-full pl-10 pr-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className={`px-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div className="grid gap-4">
        {filteredRequests.map((request) => (
          <div
            key={request.id}
            className={`${surfaceClass} rounded-2xl border ${borderClass} p-5 hover:shadow-lg transition-shadow cursor-pointer`}
            onClick={() => setSelectedRequest(request)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} flex items-center justify-center shrink-0`}>
                  <GitBranch className={`w-6 h-6 ${mutedClass}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-base font-bold ${textClass}`}>{request.branchName}</h3>
                    {getStatusBadge(request.status)}
                  </div>
                  <p className={`text-sm ${mutedClass} flex items-center gap-1 mb-2`}>
                    <Building2 className="w-4 h-4" />
                    {request.tenant?.businessName}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <span className={`flex items-center gap-1 ${mutedClass}`}>
                      <MapPin className="w-3 h-3" />
                      {request.address}
                    </span>
                    <span className={`flex items-center gap-1 ${mutedClass}`}>
                      <Calendar className="w-3 h-3" />
                      Requested {formatDate(request.createdAt)}
                    </span>
                    <span className={`flex items-center gap-1 ${mutedClass}`}>
                      <User className="w-3 h-3" />
                      {request.requester?.fullName}
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 ${mutedClass} shrink-0`} />
            </div>

            {request.status === 'PENDING' && (
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-dashed border-slate-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setApproveModal(request);
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-1"
                >
                  <CheckCircle className="w-3 h-3" />
                  Approve
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRejectModal(request);
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 flex items-center gap-1"
                >
                  <XCircle className="w-3 h-3" />
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}

        {filteredRequests.length === 0 && (
          <div className={`${surfaceClass} rounded-2xl border ${borderClass} p-12 text-center`}>
            <GitBranch className={`w-12 h-12 mx-auto mb-4 ${mutedClass}`} />
            <p className={`text-sm font-bold ${textClass}`}>No branch requests found</p>
            <p className={`text-xs ${mutedClass}`}>
              {filters.status === 'pending' ? 'All pending requests have been processed' : 'Try adjusting your filters'}
            </p>
          </div>
        )}
      </div>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${surfaceClass} rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-6 border-b ${borderClass}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-lg font-bold ${textClass}`}>{selectedRequest.branchName}</h3>
                  {getStatusBadge(selectedRequest.status)}
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className={`p-2 ${mutedClass} hover:${textClass} rounded-lg`}
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className={`text-xs font-bold uppercase ${mutedClass} mb-1`}>Tenant</p>
                <p className={`text-sm font-bold ${textClass}`}>{selectedRequest.tenant?.businessName}</p>
                <p className={`text-xs ${mutedClass}`}>{selectedRequest.tenant?.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass} mb-1`}>Address</p>
                  <p className={`text-sm ${textClass}`}>{selectedRequest.address || 'Not provided'}</p>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass} mb-1`}>Phone</p>
                  <p className={`text-sm ${textClass}`}>{selectedRequest.phone || 'Not provided'}</p>
                </div>
              </div>

              <div>
                <p className={`text-xs font-bold uppercase ${mutedClass} mb-1`}>Reason for Request</p>
                <p className={`text-sm ${textClass} ${darkMode ? 'bg-slate-700' : 'bg-slate-50'} p-3 rounded-lg`}>
                  {selectedRequest.reason}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass} mb-1`}>Requested By</p>
                  <p className={`text-sm ${textClass}`}>{selectedRequest.requester?.fullName}</p>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase ${mutedClass} mb-1`}>Request Date</p>
                  <p className={`text-sm ${textClass}`}>{formatDate(selectedRequest.createdAt)}</p>
                </div>
              </div>

              {selectedRequest.status !== 'PENDING' && (
                <div className={`p-4 rounded-xl ${
                  selectedRequest.status === 'APPROVED'
                    ? darkMode ? 'bg-emerald-900/20' : 'bg-emerald-50'
                    : darkMode ? 'bg-red-900/20' : 'bg-red-50'
                }`}>
                  <p className={`text-xs font-bold uppercase mb-2 ${
                    selectedRequest.status === 'APPROVED' ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {selectedRequest.status === 'APPROVED' ? 'Approved' : 'Rejected'} on {formatDate(selectedRequest.reviewedAt)}
                  </p>
                  {selectedRequest.reviewer && (
                    <p className={`text-sm ${textClass}`}>By: {selectedRequest.reviewer.fullName}</p>
                  )}
                  {selectedRequest.rejectionReason && (
                    <p className={`text-sm ${textClass} mt-2`}>
                      <span className="font-bold">Reason:</span> {selectedRequest.rejectionReason}
                    </p>
                  )}
                </div>
              )}

              {selectedRequest.status === 'PENDING' && (
                <div className="flex items-center gap-2 pt-4">
                  <button
                    onClick={() => setApproveModal(selectedRequest)}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve Request
                  </button>
                  <button
                    onClick={() => setRejectModal(selectedRequest)}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-3 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Request
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {approveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${surfaceClass} rounded-2xl max-w-md w-full`}>
            <div className={`p-6 border-b ${borderClass}`}>
              <h3 className={`text-lg font-bold ${textClass}`}>Approve Branch Request</h3>
              <p className={`text-sm ${mutedClass}`}>{approveModal.branchName}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-emerald-900/20' : 'bg-emerald-50'} border border-emerald-200`}>
                <div className="flex items-center gap-2 text-emerald-600 mb-2">
                  <CheckCircle className="w-4 h-4" />
                  <p className="text-xs font-bold uppercase">Approval Confirmation</p>
                </div>
                <p className={`text-sm ${textClass}`}>
                  This will create a new branch for the tenant. The branch will be immediately available for use.
                </p>
              </div>

              {/* Branch Details Summary */}
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={`text-xs ${mutedClass}`}>Tenant</span>
                    <span className={`text-sm font-bold ${textClass}`}>{approveModal.tenant?.businessName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-xs ${mutedClass}`}>Branch Name</span>
                    <span className={`text-sm font-bold ${textClass}`}>{approveModal.branchName}</span>
                  </div>
                  {approveModal.address && (
                    <div className="flex justify-between">
                      <span className={`text-xs ${mutedClass}`}>Address</span>
                      <span className={`text-sm ${textClass}`}>{approveModal.address}</span>
                    </div>
                  )}
                  {approveModal.phone && (
                    <div className="flex justify-between">
                      <span className={`text-xs ${mutedClass}`}>Phone</span>
                      <span className={`text-sm ${textClass}`}>{approveModal.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className={`flex items-center justify-end gap-3 p-6 border-t ${borderClass}`}>
              <button
                onClick={() => setApproveModal(null)}
                className={`px-4 py-2 ${surfaceClass} border ${borderClass} rounded-xl text-sm font-bold ${textClass}`}
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve Branch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${surfaceClass} rounded-2xl max-w-md w-full`}>
            <div className={`p-6 border-b ${borderClass}`}>
              <h3 className={`text-lg font-bold ${textClass}`}>Reject Branch Request</h3>
              <p className={`text-sm ${mutedClass}`}>{rejectModal.branchName}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-amber-900/20' : 'bg-amber-50'} border border-amber-200`}>
                <div className="flex items-center gap-2 text-amber-600 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <p className="text-xs font-bold uppercase">Rejection Notice</p>
                </div>
                <p className={`text-sm ${textClass}`}>
                  The tenant will be notified of this rejection along with your reason.
                </p>
              </div>
              <div>
                <label className={`text-xs font-bold uppercase ${mutedClass} mb-2 block`}>
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Provide a clear reason for rejection..."
                  rows={4}
                  className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} resize-none`}
                />
              </div>
            </div>
            <div className={`flex items-center justify-end gap-3 p-6 border-t ${borderClass}`}>
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason('');
                }}
                className={`px-4 py-2 ${surfaceClass} border ${borderClass} rounded-xl text-sm font-bold ${textClass}`}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50"
              >
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchRequests;
