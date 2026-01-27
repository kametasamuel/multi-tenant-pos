import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { superAdminAPI } from '../../api';
import {
  FileText,
  Building2,
  Mail,
  User,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  Calendar,
  Phone,
  MapPin,
  Briefcase,
  AlertTriangle,
  Filter,
  Download,
  Check,
  X,
  Globe,
  CreditCard
} from 'lucide-react';

const Applications = ({
  darkMode = false,
  surfaceClass = 'bg-white',
  textClass = 'text-slate-900',
  mutedClass = 'text-slate-500',
  borderClass = 'border-slate-200'
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [applications, setApplications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [subscriptionMonths, setSubscriptionMonths] = useState(3);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Slug state for approval
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState({ checking: false, available: null, error: null });
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });

  const currentStatus = searchParams.get('status') || 'all';
  const currentPage = parseInt(searchParams.get('page')) || 1;

  useEffect(() => {
    fetchApplications();
  }, [currentStatus, currentPage]);

  const fetchApplications = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page: currentPage, limit: 10 };
      if (currentStatus !== 'all') {
        params.status = currentStatus;
      }
      const response = await superAdminAPI.getApplications(params);
      setApplications(response.data.applications);
      setPagination(response.data.pagination);

      // Fetch stats (get all to count)
      const allResponse = await superAdminAPI.getApplications({ limit: 1000 });
      const allApps = allResponse.data.applications || [];
      setStats({
        total: allApps.length,
        pending: allApps.filter(a => a.status === 'PENDING').length,
        approved: allApps.filter(a => a.status === 'APPROVED').length,
        rejected: allApps.filter(a => a.status === 'REJECTED').length
      });
    } catch (err) {
      setError('Failed to load applications');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilter = (status) => {
    if (status === 'all') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', status);
    }
    searchParams.set('page', '1');
    setSearchParams(searchParams);
  };

  const handlePageChange = (page) => {
    searchParams.set('page', page.toString());
    setSearchParams(searchParams);
  };

  const handleViewApplication = async (app) => {
    try {
      const response = await superAdminAPI.getApplication(app.id);
      const appData = response.data.application;
      setSelectedApp(appData);
      // Auto-generate suggested slug from business name
      if (appData.status === 'PENDING') {
        const suggested = generateSlug(appData.businessName);
        setSlug(suggested);
        checkSlugAvailability(suggested);
      }
      setShowModal(true);
    } catch (err) {
      setError('Failed to load application details');
    }
  };

  // Generate suggested slug from business name
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);
  };

  // Check slug availability with debounce
  const checkSlugAvailability = async (slugValue) => {
    if (!slugValue || slugValue.length < 3) {
      setSlugStatus({ checking: false, available: null, error: 'Slug must be at least 3 characters' });
      return;
    }
    if (slugValue.length > 30) {
      setSlugStatus({ checking: false, available: null, error: 'Slug must be at most 30 characters' });
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slugValue) && slugValue.length >= 3) {
      setSlugStatus({ checking: false, available: null, error: 'Must start and end with letter/number, only hyphens in between' });
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slugValue)) {
      setSlugStatus({ checking: false, available: null, error: 'Only lowercase letters, numbers, and hyphens allowed' });
      return;
    }
    const reserved = ['admin', 'api', 'www', 'app', 'dashboard', 'login', 'signup', 'super-admin'];
    if (reserved.includes(slugValue)) {
      setSlugStatus({ checking: false, available: false, error: 'This slug is reserved' });
      return;
    }

    setSlugStatus({ checking: true, available: null, error: null });
    try {
      const response = await superAdminAPI.checkSlugAvailability(slugValue);
      setSlugStatus({ checking: false, available: response.data.available, error: null });
    } catch (err) {
      // If endpoint doesn't exist, assume available for now
      setSlugStatus({ checking: false, available: true, error: null });
    }
  };

  // Handle slug input change
  const handleSlugChange = (value) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(sanitized);
    // Debounced check
    const timeoutId = setTimeout(() => checkSlugAvailability(sanitized), 500);
    return () => clearTimeout(timeoutId);
  };

  const handleApprove = async () => {
    if (!selectedApp || !slug) return;
    if (slugStatus.available === false || slugStatus.error) {
      setError('Please enter a valid and available slug');
      return;
    }
    setActionLoading(true);
    try {
      await superAdminAPI.approveApplication(selectedApp.id, slug, subscriptionMonths);
      setShowModal(false);
      setSelectedApp(null);
      setSubscriptionMonths(3);
      setSlug('');
      setSlugStatus({ checking: false, available: null, error: null });
      fetchApplications();
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to approve application';
      setError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await superAdminAPI.rejectApplication(selectedApp.id, rejectReason);
      setShowModal(false);
      setShowRejectModal(false);
      setSelectedApp(null);
      setRejectReason('');
      fetchApplications();
    } catch (err) {
      setError('Failed to reject application');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTimeSince = (date) => {
    const now = new Date();
    const submitted = new Date(date);
    const diffHours = Math.floor((now - submitted) / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(date);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock };
      case 'APPROVED':
        return { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle };
      case 'REJECTED':
        return { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle };
      default:
        return { bg: 'bg-slate-100', text: 'text-slate-700', icon: Clock };
    }
  };

  const filteredApplications = applications.filter(app => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return app.businessName?.toLowerCase().includes(query) ||
           app.ownerFullName?.toLowerCase().includes(query) ||
           app.businessEmail?.toLowerCase().includes(query);
  });

  const StatCard = ({ icon: Icon, label, value, color, onClick, isActive }) => (
    <button
      onClick={onClick}
      className={`${surfaceClass} rounded-2xl p-5 border ${isActive ? 'border-indigo-500 ring-2 ring-indigo-200' : borderClass} text-left transition-all hover:shadow-md w-full`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className={`text-2xl font-black ${textClass}`}>{value}</p>
      <p className={`text-xs font-medium ${mutedClass} mt-1`}>{label}</p>
    </button>
  );

  if (loading && applications.length === 0) {
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
          <h1 className={`text-2xl font-black ${textClass}`}>Applications</h1>
          <p className={`text-sm ${mutedClass}`}>Review and process tenant signup applications</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchApplications}
            className={`px-4 py-2 ${surfaceClass} border ${borderClass} rounded-xl text-sm font-bold ${textClass} hover:bg-slate-50 flex items-center gap-2`}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={FileText}
          label="Total Applications"
          value={stats.total}
          color="bg-indigo-600"
          onClick={() => handleStatusFilter('all')}
          isActive={currentStatus === 'all'}
        />
        <StatCard
          icon={Clock}
          label="Pending Review"
          value={stats.pending}
          color="bg-amber-500"
          onClick={() => handleStatusFilter('pending')}
          isActive={currentStatus === 'pending'}
        />
        <StatCard
          icon={CheckCircle}
          label="Approved"
          value={stats.approved}
          color="bg-emerald-600"
          onClick={() => handleStatusFilter('approved')}
          isActive={currentStatus === 'approved'}
        />
        <StatCard
          icon={XCircle}
          label="Rejected"
          value={stats.rejected}
          color="bg-red-500"
          onClick={() => handleStatusFilter('rejected')}
          isActive={currentStatus === 'rejected'}
        />
      </div>

      {/* Pending Alert */}
      {stats.pending > 0 && currentStatus === 'all' && (
        <div className={`${darkMode ? 'bg-amber-900/20' : 'bg-amber-50'} border border-amber-200 rounded-2xl p-4`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-700">
                {stats.pending} Application{stats.pending !== 1 ? 's' : ''} Pending Review
              </p>
              <p className="text-xs text-amber-600">
                These applications are awaiting your approval or rejection
              </p>
            </div>
            <button
              onClick={() => handleStatusFilter('pending')}
              className="ml-auto px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700"
            >
              Review Now
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
          <input
            type="text"
            placeholder="Search by business name, owner, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className={`${darkMode ? 'bg-red-900/20' : 'bg-red-50'} border border-red-200 rounded-xl p-4 text-red-700`}>
          {error}
        </div>
      )}

      {/* Applications List */}
      <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
        {filteredApplications.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className={`w-12 h-12 mx-auto mb-4 ${mutedClass}`} />
            <p className={`text-sm font-bold ${textClass}`}>No applications found</p>
            <p className={`text-xs ${mutedClass}`}>
              {searchQuery ? 'Try a different search term' : 'Applications will appear here when submitted'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={darkMode ? 'bg-slate-700' : 'bg-slate-50'}>
                <tr>
                  <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Business</th>
                  <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Owner</th>
                  <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Industry</th>
                  <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Status</th>
                  <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Submitted</th>
                  <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${mutedClass}`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApplications.map((app) => {
                  const status = getStatusBadge(app.status);
                  const StatusIcon = status.icon;
                  return (
                    <tr key={app.id} className={`hover:${darkMode ? 'bg-slate-700' : 'bg-slate-50'} transition-colors`}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${darkMode ? 'bg-slate-600' : 'bg-slate-100'} flex items-center justify-center`}>
                            <Building2 className={`w-5 h-5 ${mutedClass}`} />
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${textClass}`}>{app.businessName}</p>
                            <p className={`text-xs ${mutedClass} flex items-center gap-1`}>
                              <Mail className="w-3 h-3" />
                              {app.businessEmail}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className={`text-sm font-bold ${textClass}`}>{app.ownerFullName}</p>
                        <p className={`text-xs ${mutedClass}`}>{app.ownerEmail}</p>
                      </td>
                      <td className={`px-4 py-4 text-sm ${mutedClass}`}>
                        {app.businessType || 'General'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${status.bg} ${status.text}`}>
                          <StatusIcon className="w-3 h-3" />
                          {app.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className={`text-sm ${textClass}`}>{getTimeSince(app.createdAt)}</p>
                        <p className={`text-xs ${mutedClass}`}>{formatDate(app.createdAt)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleViewApplication(app)}
                          className="px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className={`flex items-center justify-between px-4 py-3 border-t ${borderClass}`}>
            <p className={`text-sm ${mutedClass}`}>
              Page {currentPage} of {pagination.pages} ({pagination.total} total)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg ${surfaceClass} border ${borderClass} disabled:opacity-50`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className={`text-sm font-bold ${textClass}`}>Page {currentPage}</span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === pagination.pages}
                className={`p-2 rounded-lg ${surfaceClass} border ${borderClass} disabled:opacity-50`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Application Detail Modal */}
      {showModal && selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${surfaceClass} rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-6 border-b ${borderClass} sticky top-0 ${surfaceClass}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${darkMode ? 'bg-slate-600' : 'bg-slate-100'} flex items-center justify-center`}>
                    <Building2 className={`w-6 h-6 ${mutedClass}`} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${textClass}`}>{selectedApp.businessName}</h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${getStatusBadge(selectedApp.status).bg} ${getStatusBadge(selectedApp.status).text}`}>
                      {selectedApp.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedApp(null);
                  }}
                  className={`p-2 ${mutedClass} hover:${textClass} rounded-lg`}
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Business Information */}
              <div>
                <h4 className={`text-xs font-bold uppercase ${mutedClass} mb-3`}>Business Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={`text-xs ${mutedClass}`}>Business Name</p>
                    <p className={`text-sm font-bold ${textClass}`}>{selectedApp.businessName}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${mutedClass}`}>Business Type</p>
                    <p className={`text-sm font-bold ${textClass}`}>{selectedApp.businessType || 'General'}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${mutedClass}`}>Business Email</p>
                    <p className={`text-sm ${textClass} flex items-center gap-1`}>
                      <Mail className="w-3 h-3" />
                      {selectedApp.businessEmail}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs ${mutedClass}`}>Phone</p>
                    <p className={`text-sm ${textClass} flex items-center gap-1`}>
                      <Phone className="w-3 h-3" />
                      {selectedApp.businessPhone || 'Not provided'}
                    </p>
                  </div>
                  {selectedApp.businessAddress && (
                    <div className="col-span-2">
                      <p className={`text-xs ${mutedClass}`}>Address</p>
                      <p className={`text-sm ${textClass} flex items-center gap-1`}>
                        <MapPin className="w-3 h-3" />
                        {selectedApp.businessAddress}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Owner Information */}
              <div>
                <h4 className={`text-xs font-bold uppercase ${mutedClass} mb-3`}>Owner Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={`text-xs ${mutedClass}`}>Full Name</p>
                    <p className={`text-sm font-bold ${textClass}`}>{selectedApp.ownerFullName}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${mutedClass}`}>Email</p>
                    <p className={`text-sm ${textClass}`}>{selectedApp.ownerEmail}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${mutedClass}`}>Phone</p>
                    <p className={`text-sm ${textClass}`}>{selectedApp.ownerPhone || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${mutedClass}`}>Desired Username</p>
                    <p className={`text-sm font-mono ${textClass}`}>{selectedApp.desiredUsername}</p>
                  </div>
                </div>
              </div>

              {/* Application Meta */}
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={`text-xs ${mutedClass}`}>Submitted</p>
                    <p className={`text-sm font-bold ${textClass}`}>{formatDate(selectedApp.createdAt)}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${mutedClass}`}>Application ID</p>
                    <p className={`text-sm font-mono ${textClass}`}>{selectedApp.id}</p>
                  </div>
                </div>
              </div>

              {/* Action Section for Pending */}
              {selectedApp.status === 'PENDING' && (
                <div className={`p-4 rounded-xl ${darkMode ? 'bg-indigo-900/20' : 'bg-indigo-50'} border border-indigo-200`}>
                  <h4 className="text-sm font-bold text-indigo-700 mb-4">Approval Settings</h4>

                  {/* URL Slug - Required */}
                  <div className="mb-4">
                    <label className={`text-xs font-bold uppercase ${mutedClass} mb-2 block`}>
                      URL Slug (Required) *
                    </label>
                    <div className="relative">
                      <div className="flex items-center">
                        <span className={`px-3 py-3 rounded-l-xl border-l border-t border-b ${borderClass} ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} ${mutedClass} text-sm`}>
                          yourdomain.com/
                        </span>
                        <input
                          type="text"
                          value={slug}
                          onChange={(e) => handleSlugChange(e.target.value)}
                          placeholder="business-name"
                          className={`flex-1 px-4 py-3 rounded-r-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm font-mono ${
                            slugStatus.available === true ? 'border-emerald-500 ring-1 ring-emerald-200' :
                            slugStatus.available === false || slugStatus.error ? 'border-red-500 ring-1 ring-red-200' : ''
                          }`}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {slugStatus.checking && (
                            <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                          )}
                          {!slugStatus.checking && slugStatus.available === true && (
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                          )}
                          {!slugStatus.checking && (slugStatus.available === false || slugStatus.error) && (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      </div>
                      {slugStatus.error && (
                        <p className="text-xs text-red-500 mt-1">{slugStatus.error}</p>
                      )}
                      {slugStatus.available === true && !slugStatus.error && (
                        <p className="text-xs text-emerald-600 mt-1">This slug is available</p>
                      )}
                      {slugStatus.available === false && !slugStatus.error && (
                        <p className="text-xs text-red-500 mt-1">This slug is already taken</p>
                      )}
                    </div>
                    <p className={`text-xs ${mutedClass} mt-2`}>
                      This will be the URL path for tenant login. Only lowercase letters, numbers, and hyphens allowed. 3-30 characters.
                    </p>
                  </div>

                  {/* Subscription Period */}
                  <div className="mb-4">
                    <label className={`text-xs font-bold uppercase ${mutedClass} mb-2 block`}>
                      Initial Subscription Period
                    </label>
                    <select
                      value={subscriptionMonths}
                      onChange={(e) => setSubscriptionMonths(parseInt(e.target.value))}
                      className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                    >
                      <option value={1}>1 Month (Trial)</option>
                      <option value={3}>3 Months</option>
                      <option value={6}>6 Months</option>
                      <option value={12}>12 Months</option>
                    </select>
                  </div>

                  {/* Preview URL */}
                  {slug && slugStatus.available && (
                    <div className={`mb-4 p-3 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-white'} border ${borderClass}`}>
                      <p className={`text-xs font-bold uppercase ${mutedClass} mb-1`}>Tenant Login URL</p>
                      <p className={`text-sm font-mono ${textClass}`}>
                        <Globe className="w-3 h-3 inline mr-1" />
                        yourdomain.com/<span className="text-indigo-600 font-bold">{slug}</span>/login
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading || !slug || slugStatus.available !== true || slugStatus.checking}
                      className="flex-1 px-4 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Approve Application
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={actionLoading}
                      className="flex-1 px-4 py-3 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Approved Info */}
              {selectedApp.status === 'APPROVED' && selectedApp.tenant && (
                <div className={`p-4 rounded-xl ${darkMode ? 'bg-emerald-900/20' : 'bg-emerald-50'} border border-emerald-200`}>
                  <div className="flex items-center gap-2 text-emerald-700 mb-2">
                    <CheckCircle className="w-4 h-4" />
                    <p className="text-sm font-bold">Application Approved</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <p className={`text-xs ${mutedClass}`}>Tenant Created</p>
                      <p className={`text-sm font-bold ${textClass}`}>{selectedApp.tenant.businessName}</p>
                    </div>
                    <div>
                      <p className={`text-xs ${mutedClass}`}>Subscription Ends</p>
                      <p className={`text-sm ${textClass}`}>{formatDate(selectedApp.tenant.subscriptionEnd)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Rejected Info */}
              {selectedApp.status === 'REJECTED' && (
                <div className={`p-4 rounded-xl ${darkMode ? 'bg-red-900/20' : 'bg-red-50'} border border-red-200`}>
                  <div className="flex items-center gap-2 text-red-700 mb-2">
                    <XCircle className="w-4 h-4" />
                    <p className="text-sm font-bold">Application Rejected</p>
                  </div>
                  {selectedApp.rejectionReason && (
                    <p className={`text-sm ${textClass} mt-2`}>
                      <span className="font-bold">Reason:</span> {selectedApp.rejectionReason}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className={`${surfaceClass} rounded-2xl max-w-md w-full`}>
            <div className={`p-6 border-b ${borderClass}`}>
              <h3 className={`text-lg font-bold ${textClass}`}>Reject Application</h3>
              <p className={`text-sm ${mutedClass}`}>{selectedApp?.businessName}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-amber-900/20' : 'bg-amber-50'} border border-amber-200`}>
                <div className="flex items-center gap-2 text-amber-600 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <p className="text-xs font-bold uppercase">Important</p>
                </div>
                <p className={`text-sm ${textClass}`}>
                  The applicant will be notified of this rejection with your reason.
                </p>
              </div>
              <div>
                <label className={`text-xs font-bold uppercase ${mutedClass} mb-2 block`}>
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please provide a clear reason for rejection..."
                  rows={4}
                  className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} resize-none`}
                />
              </div>
            </div>
            <div className={`flex items-center justify-end gap-3 p-6 border-t ${borderClass}`}>
              <button
                onClick={() => {
                  setShowRejectModal(false);
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
                Reject Application
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Applications;
