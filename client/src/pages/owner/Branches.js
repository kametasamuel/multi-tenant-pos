import React, { useState, useEffect } from 'react';
import { branchesAPI } from '../../api';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Plus,
  Edit2,
  Star,
  Users,
  DollarSign,
  Receipt,
  MapPin,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  X,
  Trash2,
  RefreshCw
} from 'lucide-react';

const Branches = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass }) => {
  const { user } = useAuth();
  const { refreshBranches } = useBranch();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [formData, setFormData] = useState({ name: '', address: '', phone: '', reason: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteModal, setDeleteModal] = useState({ show: false, branch: null });
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [transferBranchId, setTransferBranchId] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [rejectedRequests, setRejectedRequests] = useState([]);
  const [dismissedRejections, setDismissedRejections] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [branchesRes, requestsRes] = await Promise.all([
        branchesAPI.getAll(),
        branchesAPI.getRequests()
      ]);
      setBranches(branchesRes.data.branches || []);
      const allRequests = requestsRes.data.requests || [];
      setPendingRequests(allRequests.filter(r => r.status === 'PENDING'));
      // Get rejected requests that haven't been dismissed
      setRejectedRequests(allRequests.filter(r =>
        r.status === 'REJECTED' && !dismissedRejections.includes(r.id)
      ));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleOpenModal = (branch = null) => {
    if (branch) {
      setEditingBranch(branch);
      setFormData({
        name: branch.name,
        address: branch.address || '',
        phone: branch.phone || '',
        reason: ''
      });
    } else {
      setEditingBranch(null);
      setFormData({ name: '', address: '', phone: '', reason: '' });
    }
    setError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingBranch(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingBranch) {
        // Update existing branch
        await branchesAPI.update(editingBranch.id, {
          name: formData.name,
          address: formData.address,
          phone: formData.phone
        });
        setSuccess('Branch updated successfully');
      } else {
        // Create new branch request (goes to super admin for approval)
        await branchesAPI.createRequest({
          branchName: formData.name,
          address: formData.address,
          phone: formData.phone,
          reason: formData.reason || 'Business expansion'
        });
        setSuccess('Branch request submitted - Pending approval');
      }
      handleCloseModal();
      loadData();
      refreshBranches();
      setTimeout(() => setSuccess(''), 4000);
    } catch (error) {
      setError(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleSetMain = async (branchId) => {
    try {
      await branchesAPI.setMain(branchId);
      setSuccess('Main branch updated');
      loadData();
      refreshBranches();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to set main branch');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleCancelRequest = async (requestId) => {
    if (!window.confirm('Cancel this branch request?')) return;
    try {
      await branchesAPI.cancelRequest(requestId);
      setSuccess('Request cancelled');
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to cancel request');
      setTimeout(() => setError(''), 3000);
    }
  };

  const openDeleteModal = (branch) => {
    setDeleteModal({ show: true, branch });
    setDeleteConfirmName('');
    setTransferBranchId('');
    setError('');
  };

  const closeDeleteModal = () => {
    setDeleteModal({ show: false, branch: null });
    setDeleteConfirmName('');
    setTransferBranchId('');
    setError('');
  };

  const handleDeleteBranch = async () => {
    const branch = deleteModal.branch;
    if (!branch) return;

    // Validate confirmation name
    if (deleteConfirmName.toLowerCase() !== branch.name.toLowerCase()) {
      setError('Please type the branch name correctly to confirm');
      return;
    }

    // Check if transfer is needed
    const hasData = (branch._count?.users || 0) > 0 ||
                    (branch._count?.sales || 0) > 0 ||
                    (branch._count?.products || 0) > 0;

    if (hasData && !transferBranchId) {
      setError('Please select a branch to transfer data to');
      return;
    }

    try {
      setDeleting(true);
      await branchesAPI.delete(branch.id, {
        confirmName: deleteConfirmName,
        transferTo: transferBranchId || undefined
      });
      setSuccess('Branch deleted successfully');
      closeDeleteModal();
      loadData();
      refreshBranches();
      setTimeout(() => setSuccess(''), 4000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to delete branch');
    } finally {
      setDeleting(false);
    }
  };

  // Calculate totals
  const totals = branches.reduce((acc, b) => ({
    staff: acc.staff + (b._count?.users || 0),
    sales: acc.sales + (b._count?.sales || 0),
    revenue: acc.revenue + (b.totalRevenue || 0)
  }), { staff: 0, sales: 0, revenue: 0 });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black uppercase tracking-tight ${textClass}`}>Branch Management</h1>
          <p className={`text-sm ${mutedClass}`}>Manage your business locations</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadData}
            className={`p-2.5 border ${borderClass} ${textClass} rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add Branch
          </button>
        </div>
      </div>

      {/* Messages */}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{success}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl">
          <XCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Rejected Requests Alert */}
      {rejectedRequests.length > 0 && (
        <div className={`${surfaceClass} rounded-2xl border-2 border-red-300 dark:border-red-800 p-4`}>
          <div className="flex items-center gap-3 mb-3">
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h3 className={`text-sm font-black uppercase text-red-600 dark:text-red-400`}>Rejected Requests ({rejectedRequests.length})</h3>
          </div>
          <div className="space-y-2">
            {rejectedRequests.map(request => (
              <div key={request.id} className={`p-3 rounded-xl ${darkMode ? 'bg-red-900/20' : 'bg-red-50'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                    <div>
                      <p className={`text-sm font-bold ${textClass}`}>{request.branchName}</p>
                      <p className={`text-xs ${mutedClass}`}>
                        Rejected on {request.reviewedAt ? new Date(request.reviewedAt).toLocaleDateString() : 'N/A'}
                      </p>
                      {request.rejectionReason && (
                        <p className={`text-xs text-red-600 dark:text-red-400 mt-1`}>
                          <span className="font-bold">Reason:</span> {request.rejectionReason}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDismissedRejections([...dismissedRejections, request.id]);
                      setRejectedRequests(rejectedRequests.filter(r => r.id !== request.id));
                    }}
                    className={`p-1.5 ${mutedClass} hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg`}
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Requests Alert */}
      {pendingRequests.length > 0 && (
        <div className={`${surfaceClass} rounded-2xl border-2 border-slate-500/50 p-4`}>
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <h3 className={`text-sm font-black uppercase ${textClass}`}>Pending Approval ({pendingRequests.length})</h3>
          </div>
          <div className="space-y-2">
            {pendingRequests.map(request => (
              <div key={request.id} className={`flex items-center justify-between p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <div>
                    <p className={`text-sm font-bold ${textClass}`}>{request.branchName}</p>
                    <p className={`text-xs ${mutedClass}`}>
                      Submitted {new Date(request.createdAt).toLocaleDateString()}
                      {request.address && ` - ${request.address}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleCancelRequest(request.id)}
                  className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                  title="Cancel Request"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass} text-center`}>
          <Building2 className={`w-6 h-6 mx-auto ${mutedClass}`} />
          <p className={`text-2xl font-black ${textClass} mt-2`}>{branches.length}</p>
          <p className={`text-xs ${mutedClass}`}>Active Branches</p>
        </div>
        <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass} text-center`}>
          <Users className={`w-6 h-6 mx-auto ${mutedClass}`} />
          <p className={`text-2xl font-black ${textClass} mt-2`}>{totals.staff}</p>
          <p className={`text-xs ${mutedClass}`}>Total Staff</p>
        </div>
        <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass} text-center`}>
          <Receipt className={`w-6 h-6 mx-auto ${mutedClass}`} />
          <p className={`text-2xl font-black ${textClass} mt-2`}>{totals.sales}</p>
          <p className={`text-xs ${mutedClass}`}>Total Sales</p>
        </div>
        <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass} text-center`}>
          <DollarSign className={`w-6 h-6 mx-auto ${mutedClass}`} />
          <p className={`text-2xl font-black ${textClass} mt-2`}>{formatCurrency(totals.revenue)}</p>
          <p className={`text-xs ${mutedClass}`}>Total Revenue</p>
        </div>
      </div>

      {/* Branches Grid */}
      {branches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {branches.map(branch => (
            <div
              key={branch.id}
              className={`${surfaceClass} rounded-2xl border ${borderClass} ${branch.isMain ? 'ring-2 ring-slate-500' : ''} overflow-hidden`}
            >
              {/* Branch Header */}
              <div className={`p-4 ${branch.isMain ? 'bg-slate-100 dark:bg-slate-700' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl ${branch.isMain ? 'bg-slate-200 dark:bg-slate-600' : darkMode ? 'bg-slate-700' : 'bg-gray-100'} flex items-center justify-center`}>
                      <Building2 className={`w-6 h-6 ${branch.isMain ? 'text-slate-700 dark:text-slate-300' : mutedClass}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`text-lg font-bold ${textClass}`}>{branch.name}</h3>
                        {branch.isMain && (
                          <Star className="w-4 h-4 text-slate-600 dark:text-slate-400 fill-slate-500" />
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        branch.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {branch.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!branch.isMain && branch.isActive && (
                      <button
                        onClick={() => handleSetMain(branch.id)}
                        className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'} transition-colors`}
                        title="Set as Main"
                      >
                        <Star className={`w-4 h-4 ${mutedClass}`} />
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenModal(branch)}
                      className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'} transition-colors`}
                      title="Edit"
                    >
                      <Edit2 className={`w-4 h-4 ${mutedClass}`} />
                    </button>
                    {!branch.isMain && (
                      <button
                        onClick={() => openDeleteModal(branch)}
                        className={`p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors`}
                        title="Delete Branch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                {(branch.address || branch.phone) && (
                  <div className={`mt-3 space-y-1 text-sm ${mutedClass}`}>
                    {branch.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{branch.address}</span>
                      </div>
                    )}
                    {branch.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3" />
                        <span>{branch.phone}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Branch Stats */}
              <div className={`grid grid-cols-3 divide-x ${darkMode ? 'divide-slate-700 bg-slate-700/50' : 'divide-gray-200 bg-gray-50'}`}>
                <div className="p-3 text-center">
                  <p className={`text-lg font-bold ${textClass}`}>{branch._count?.users || 0}</p>
                  <p className={`text-[10px] ${mutedClass} uppercase font-bold`}>Staff</p>
                </div>
                <div className="p-3 text-center">
                  <p className={`text-lg font-bold ${textClass}`}>{branch._count?.sales || 0}</p>
                  <p className={`text-[10px] ${mutedClass} uppercase font-bold`}>Sales</p>
                </div>
                <div className="p-3 text-center">
                  <p className={`text-lg font-bold ${textClass}`}>{formatCurrency(branch.totalRevenue || 0)}</p>
                  <p className={`text-[10px] ${mutedClass} uppercase font-bold`}>Revenue</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`${surfaceClass} rounded-2xl border ${borderClass} p-12 text-center`}>
          <Building2 className={`w-16 h-16 mx-auto ${mutedClass} mb-4`} />
          <p className={`text-lg font-bold ${textClass} mb-2`}>No Branches Yet</p>
          <p className={`text-sm ${mutedClass} mb-4`}>Add your first branch to get started</p>
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase"
          >
            <Plus className="w-4 h-4" />
            Add Branch
          </button>
        </div>
      )}

      {/* Add/Edit Branch Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${surfaceClass} rounded-2xl p-6 w-full max-w-md`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-lg font-black uppercase ${textClass}`}>
                {editingBranch ? 'Edit Branch' : 'Add New Branch'}
              </h2>
              <button onClick={handleCloseModal} className={`p-2 rounded-lg ${mutedClass} hover:bg-gray-100 dark:hover:bg-slate-700`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {!editingBranch && (
              <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-700 rounded-xl">
                <p className={`text-sm text-slate-700 dark:text-slate-300`}>
                  <Clock className="w-4 h-4 inline mr-2" />
                  New branches require admin approval
                </p>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Branch Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                  placeholder="e.g., Downtown Branch"
                  required
                />
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                  placeholder="123 Main Street"
                />
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                  placeholder="+1 234 567 8900"
                />
              </div>

              {!editingBranch && (
                <div>
                  <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Reason for New Branch</label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                    rows={2}
                    placeholder="Business expansion, new location..."
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={`flex-1 px-4 py-3 rounded-xl border ${borderClass} ${textClass} font-bold text-sm uppercase`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase"
                >
                  {editingBranch ? 'Update' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Branch Confirmation Modal */}
      {deleteModal.show && deleteModal.branch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${surfaceClass} rounded-2xl p-6 w-full max-w-md`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-black uppercase text-red-600`}>Delete Branch</h2>
              <button onClick={closeDeleteModal} className={`p-2 rounded-lg ${mutedClass} hover:bg-gray-100 dark:hover:bg-slate-700`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                You are about to delete <strong>{deleteModal.branch.name}</strong>. This action cannot be undone.
              </p>
            </div>

            {/* Branch Data Summary */}
            {((deleteModal.branch._count?.users || 0) > 0 ||
              (deleteModal.branch._count?.sales || 0) > 0 ||
              (deleteModal.branch._count?.products || 0) > 0) && (
              <div className={`mb-4 p-4 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-xl`}>
                <p className={`text-xs font-bold uppercase ${mutedClass} mb-2`}>This branch has:</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className={`text-lg font-bold ${textClass}`}>{deleteModal.branch._count?.users || 0}</p>
                    <p className={`text-[10px] ${mutedClass}`}>Staff</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${textClass}`}>{deleteModal.branch._count?.sales || 0}</p>
                    <p className={`text-[10px] ${mutedClass}`}>Sales</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${textClass}`}>{deleteModal.branch._count?.products || 0}</p>
                    <p className={`text-[10px] ${mutedClass}`}>Products</p>
                  </div>
                </div>

                {/* Transfer Branch Selection */}
                <div className="mt-4">
                  <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>
                    Transfer Data To *
                  </label>
                  <select
                    value={transferBranchId}
                    onChange={(e) => setTransferBranchId(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                  >
                    <option value="">Select a branch...</option>
                    {branches
                      .filter(b => b.id !== deleteModal.branch.id && b.isActive)
                      .map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.isMain ? '(Main)' : ''}
                        </option>
                      ))
                    }
                  </select>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Confirmation Input */}
            <div className="mb-4">
              <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>
                Type "{deleteModal.branch.name}" to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                placeholder="Type branch name..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeDeleteModal}
                className={`flex-1 px-4 py-3 rounded-xl border ${borderClass} ${textClass} font-bold text-sm uppercase`}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteBranch}
                disabled={deleting || deleteConfirmName.toLowerCase() !== deleteModal.branch.name.toLowerCase()}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 dark:disabled:bg-red-900 text-white rounded-xl font-bold text-sm uppercase transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete Branch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Branches;
