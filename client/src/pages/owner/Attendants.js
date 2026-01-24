import React, { useState, useEffect, useRef } from 'react';
import { attendantsAPI, IMAGE_BASE_URL } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  UserCircle,
  Search,
  Edit2,
  UserCheck,
  UserX,
  X,
  Building2,
  ChevronDown,
  ChevronUp,
  Camera,
  Trash2,
  Upload,
  Percent,
  DollarSign,
  Briefcase,
  TrendingUp,
  Award,
  Calendar
} from 'lucide-react';

const Attendants = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, currentBranch, isAllBranches, branches = [] }) => {
  const { user } = useAuth();

  // Check user role for branch handling
  const isManager = user?.role === 'MANAGER';
  const isOwner = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [attendants, setAttendants] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, totalCommission: 0 });
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [showModal, setShowModal] = useState(false);
  const [editingAttendant, setEditingAttendant] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    specialty: '',
    commissionRate: '',
    branchId: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Branch filter for drilling down when in "All Branches" mode
  const [branchFilter, setBranchFilter] = useState(null);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  // Image upload state
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Expandable row state
  const [expandedAttendant, setExpandedAttendant] = useState(null);
  const [attendantPerformance, setAttendantPerformance] = useState({});
  const [loadingPerformance, setLoadingPerformance] = useState({});

  // Performance summary for all attendants (used for totals and quick preview)
  const [performanceSummary, setPerformanceSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Date filter for performance (monthly commission tracking)
  const [dateFilter, setDateFilter] = useState('month');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  // Get date range based on selected filter
  const getDateRange = () => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (dateFilter) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        if (customDateRange.start && customDateRange.end) {
          startDate = new Date(customDateRange.start);
          endDate = new Date(customDateRange.end);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);
        }
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
  };

  // Get filter label for display
  const getFilterLabel = () => {
    switch (dateFilter) {
      case 'today': return 'Today';
      case 'week': return 'Last 7 Days';
      case 'month': return 'This Month';
      case 'lastMonth': return 'Last Month';
      case 'quarter': return 'Last 3 Months';
      case 'year': return 'This Year';
      case 'custom': return customDateRange.start && customDateRange.end
        ? `${new Date(customDateRange.start).toLocaleDateString()} - ${new Date(customDateRange.end).toLocaleDateString()}`
        : 'Custom Range';
      default: return 'This Month';
    }
  };

  const formatCurrency = (amount) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Reset branch filter when switching away from "All Branches" mode
  useEffect(() => {
    if (!isAllBranches) {
      setBranchFilter(null);
    }
  }, [isAllBranches]);

  useEffect(() => {
    loadData();
    loadPerformanceSummary();
  }, []);

  useEffect(() => {
    loadData();
  }, [filters, currentBranch, isAllBranches, branchFilter]);

  // Load performance summary when date filter changes
  useEffect(() => {
    loadPerformanceSummary();
    // Also reload expanded attendant's detailed data
    if (expandedAttendant) {
      loadAttendantPerformance(expandedAttendant);
    }
  }, [dateFilter, customDateRange, currentBranch, isAllBranches, branchFilter]);

  const loadPerformanceSummary = async () => {
    try {
      setLoadingSummary(true);
      const params = {};
      const effectiveBranchId = getEffectiveBranchId();
      if (effectiveBranchId) {
        params.branchId = effectiveBranchId;
      }

      const { startDate, endDate } = getDateRange();
      params.startDate = startDate.toISOString();
      params.endDate = endDate.toISOString();

      const response = await attendantsAPI.getPerformanceSummary(params);
      setPerformanceSummary(response.data);
    } catch (error) {
      console.error('Failed to load performance summary:', error);
    } finally {
      setLoadingSummary(false);
    }
  };

  // Get performance data for a specific attendant from summary
  const getAttendantSummaryPerformance = (attendantId) => {
    if (!performanceSummary?.performance) return null;
    return performanceSummary.performance.find(p => p.attendant?.id === attendantId);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.isActive = filters.status === 'active';

      const effectiveBranchId = getEffectiveBranchId();
      if (effectiveBranchId) {
        params.branchId = effectiveBranchId;
      }

      const response = await attendantsAPI.getAll(params);
      const attendantsList = response.data.attendants || [];
      setAttendants(attendantsList);

      // Calculate stats
      const activeCount = attendantsList.filter(a => a.isActive).length;
      setStats({
        total: attendantsList.length,
        active: activeCount,
        inactive: attendantsList.length - activeCount
      });
    } catch (error) {
      console.error('Failed to load attendants:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendantPerformance = async (attendantId) => {
    try {
      setLoadingPerformance(prev => ({ ...prev, [attendantId]: true }));

      const { startDate, endDate } = getDateRange();
      const response = await attendantsAPI.getById(attendantId, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      setAttendantPerformance(prev => ({
        ...prev,
        [attendantId]: response.data
      }));
    } catch (error) {
      console.error('Failed to load attendant performance:', error);
    } finally {
      setLoadingPerformance(prev => ({ ...prev, [attendantId]: false }));
    }
  };

  const handleExpandAttendant = (attendantId) => {
    if (expandedAttendant === attendantId) {
      setExpandedAttendant(null);
    } else {
      setExpandedAttendant(attendantId);
      if (!attendantPerformance[attendantId]) {
        loadAttendantPerformance(attendantId);
      }
    }
  };

  const handleOpenModal = (attendant = null, e) => {
    if (e) e.stopPropagation();

    if (attendant) {
      setEditingAttendant(attendant);
      setFormData({
        fullName: attendant.fullName,
        phone: attendant.phone || '',
        email: attendant.email || '',
        specialty: attendant.specialty || '',
        commissionRate: attendant.commissionRate || '',
        branchId: attendant.branchId || ''
      });
      if (attendant.profileImage) {
        setImagePreview(`${IMAGE_BASE_URL}${attendant.profileImage}`);
      } else {
        setImagePreview(null);
      }
    } else {
      setEditingAttendant(null);

      let defaultBranchId = '';
      if (isManager) {
        defaultBranchId = currentBranch?.id || user?.branchId || '';
      } else if (isOwner && !isAllBranches && currentBranch) {
        defaultBranchId = currentBranch.id;
      } else {
        const mainBranch = branches.find(b => b.isMain);
        defaultBranchId = mainBranch?.id || '';
      }

      setFormData({
        fullName: '',
        phone: '',
        email: '',
        specialty: '',
        commissionRate: '',
        branchId: defaultBranchId
      });
      setImagePreview(null);
    }
    setSelectedImage(null);
    setError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingAttendant(null);
    setError('');
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('File too large. Maximum size is 5MB.');
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const uploadImage = async (attendantId) => {
    if (!selectedImage) return;

    const formData = new FormData();
    formData.append('image', selectedImage);

    try {
      setUploadingImage(true);
      await attendantsAPI.uploadImage(attendantId, formData);
    } catch (error) {
      console.error('Image upload failed:', error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isOwner && isAllBranches && !formData.branchId) {
      setError('Please select a branch for this attendant');
      return;
    }

    try {
      let attendantId;
      const effectiveBranchId = isManager
        ? (currentBranch?.id || user?.branchId || formData.branchId)
        : formData.branchId;

      const submitData = {
        fullName: formData.fullName,
        phone: formData.phone || null,
        email: formData.email || null,
        specialty: formData.specialty || null,
        commissionRate: formData.commissionRate !== '' ? parseFloat(formData.commissionRate) : 0,
        branchId: effectiveBranchId || null
      };

      if (editingAttendant) {
        await attendantsAPI.update(editingAttendant.id, submitData);
        attendantId = editingAttendant.id;

        if (selectedImage) {
          await uploadImage(attendantId);
        }

        setSuccess('Attendant updated successfully');
      } else {
        const response = await attendantsAPI.create(submitData);
        attendantId = response.data.attendant?.id;

        if (selectedImage && attendantId) {
          await uploadImage(attendantId);
        }

        setSuccess('Attendant created successfully');
      }
      handleCloseModal();
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleToggleStatus = async (attendant, e) => {
    if (e) e.stopPropagation();
    try {
      await attendantsAPI.update(attendant.id, { isActive: !attendant.isActive });
      setSuccess(`Attendant ${attendant.isActive ? 'deactivated' : 'activated'} successfully`);
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to update status');
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black uppercase tracking-tight ${textClass}`}>Commission Tracking</h1>
          <div className="flex items-center gap-2 mt-1">
            <Building2 className={`w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            <p className={`text-sm ${mutedClass}`}>
              {isAllBranches ? 'All Branches' : currentBranch?.name || 'Select a branch'}
            </p>
          </div>
          <p className={`text-xs ${mutedClass} mt-1`}>
            Add attendants through Staff Management with the Attendant role
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Branch Filter Chip */}
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

          {/* Branch Filter Dropdown */}
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
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl text-sm font-medium">
          {success}
        </div>
      )}
      {error && !showModal && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Period Totals Banner */}
      {performanceSummary?.totals && (
        <div className={`${darkMode ? 'bg-gradient-to-r from-green-900/40 to-slate-800' : 'bg-gradient-to-r from-green-50 to-blue-50'} rounded-2xl p-5 border ${darkMode ? 'border-green-800/50' : 'border-green-200'}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className={`text-xs font-bold uppercase ${mutedClass}`}>{getFilterLabel()} Commission Summary</p>
              <p className={`text-3xl font-black text-green-600 dark:text-green-400 mt-1`}>
                {formatCurrency(performanceSummary.totals.totalCommission)}
              </p>
              <p className={`text-xs ${mutedClass} mt-1`}>Total payable to {performanceSummary.performance?.length || 0} attendants</p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className={`text-xl font-black ${textClass}`}>{formatCurrency(performanceSummary.totals.totalSales)}</p>
                <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Total Revenue</p>
              </div>
              <div className="text-center">
                <p className={`text-xl font-black ${textClass}`}>{performanceSummary.totals.totalServices}</p>
                <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Services Done</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass} text-center`}>
          <p className={`text-2xl font-black ${textClass}`}>{stats.total}</p>
          <p className={`text-xs ${mutedClass} uppercase font-bold`}>Total Attendants</p>
        </div>
        <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass} text-center`}>
          <p className={`text-2xl font-black text-green-500`}>{stats.active}</p>
          <p className={`text-xs ${mutedClass} uppercase font-bold`}>Active</p>
        </div>
        <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass} text-center`}>
          <p className={`text-2xl font-black text-red-500`}>{stats.inactive}</p>
          <p className={`text-xs ${mutedClass} uppercase font-bold`}>Inactive</p>
        </div>
      </div>

      {/* Date Filter & Search */}
      <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
            <input
              type="text"
              placeholder="Search by name, phone, or specialty..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className={`w-full pl-10 pr-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            />
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className={`px-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm font-medium`}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Date Filter */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`flex items-center gap-2 px-4 py-2 ${surfaceClass} border ${borderClass} rounded-xl text-xs font-bold uppercase ${textClass} hover:border-slate-400 transition-colors`}
            >
              <Calendar className="w-4 h-4" />
              {getFilterLabel()}
              <ChevronDown className={`w-4 h-4 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
            </button>

            {showDatePicker && (
              <div className={`absolute right-0 top-full mt-2 ${surfaceClass} border ${borderClass} rounded-2xl p-4 shadow-xl z-50 min-w-[280px]`}>
                <div className="space-y-2 mb-4">
                  {[
                    { value: 'today', label: 'Today' },
                    { value: 'week', label: 'Last 7 Days' },
                    { value: 'month', label: 'This Month' },
                    { value: 'lastMonth', label: 'Last Month' },
                    { value: 'quarter', label: 'Last 3 Months' },
                    { value: 'year', label: 'This Year' }
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => {
                        setDateFilter(filter.value);
                        setShowDatePicker(false);
                        // Clear cached performance data to reload with new date
                        setAttendantPerformance({});
                      }}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold uppercase transition-colors ${
                        dateFilter === filter.value
                          ? 'bg-slate-800 dark:bg-slate-600 text-white'
                          : `${mutedClass} hover:${textClass} hover:bg-slate-100 dark:hover:bg-slate-700`
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <div className={`border-t ${borderClass} pt-4`}>
                  <p className={`text-[10px] font-black uppercase ${mutedClass} mb-2`}>Custom Range</p>
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={customDateRange.start}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className={`w-full px-3 py-2 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} ${textClass} rounded-lg text-xs border ${borderClass}`}
                    />
                    <input
                      type="date"
                      value={customDateRange.end}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className={`w-full px-3 py-2 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} ${textClass} rounded-lg text-xs border ${borderClass}`}
                    />
                    <button
                      onClick={() => {
                        if (customDateRange.start && customDateRange.end) {
                          setDateFilter('custom');
                          setShowDatePicker(false);
                          setAttendantPerformance({});
                        }
                      }}
                      disabled={!customDateRange.start || !customDateRange.end}
                      className="w-full py-2.5 bg-slate-800 dark:bg-slate-600 text-white rounded-xl text-xs font-bold uppercase disabled:opacity-50"
                    >
                      Apply Custom Range
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Date Range Display */}
        <div className={`mt-3 pt-3 border-t ${borderClass}`}>
          <p className={`text-xs ${mutedClass}`}>
            Showing earnings from <span className={`font-bold ${textClass}`}>{getDateRange().startDate.toLocaleDateString()}</span> to <span className={`font-bold ${textClass}`}>{getDateRange().endDate.toLocaleDateString()}</span>
          </p>
        </div>
      </div>

      {/* Attendants List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
        </div>
      ) : (
        <div className="space-y-3">
          {attendants.length === 0 ? (
            <div className={`${surfaceClass} rounded-2xl border ${borderClass} p-12 text-center`}>
              <UserCircle className={`w-12 h-12 mx-auto ${mutedClass} mb-4`} />
              <p className={`text-sm ${mutedClass}`}>No attendants found</p>
              <p className={`text-xs ${mutedClass} mt-2`}>
                Add attendants through Staff Management with the Attendant role
              </p>
            </div>
          ) : (
            attendants.map(attendant => {
              const isExpanded = expandedAttendant === attendant.id;
              const performance = attendantPerformance[attendant.id];
              const isLoadingPerf = loadingPerformance[attendant.id];
              const summaryPerf = getAttendantSummaryPerformance(attendant.id);

              return (
                <div key={attendant.id} className={`${surfaceClass} rounded-2xl border ${isExpanded ? 'border-slate-400 dark:border-slate-500' : borderClass} overflow-hidden transition-all`}>
                  {/* Attendant Row */}
                  <div
                    onClick={() => handleExpandAttendant(attendant.id)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${!attendant.isActive ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      {attendant.profileImage ? (
                        <img
                          src={`${IMAGE_BASE_URL}${attendant.profileImage}`}
                          alt={attendant.fullName}
                          className="w-12 h-12 rounded-xl object-cover shrink-0"
                        />
                      ) : (
                        <div className={`w-12 h-12 rounded-xl ${darkMode ? 'bg-slate-600' : 'bg-gray-200'} flex items-center justify-center shrink-0`}>
                          <span className={`text-lg font-bold ${textClass}`}>{attendant.fullName?.charAt(0)}</span>
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`text-sm font-bold ${textClass}`}>{attendant.fullName}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            attendant.isActive
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {attendant.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {attendant.specialty && (
                            <span className={`text-xs ${mutedClass}`}>{attendant.specialty}</span>
                          )}
                          {attendant.branch?.name && (
                            <span className={`text-xs ${mutedClass} flex items-center gap-1`}>
                              <Building2 className="w-3 h-3" />
                              {attendant.branch.name}
                            </span>
                          )}
                          <span className={`text-xs font-medium ${textClass}`}>
                            {attendant.commissionRate || 0}% commission
                          </span>
                        </div>
                      </div>

                      {/* Quick Stats & Actions */}
                      <div className="flex items-center gap-3">
                        {/* Period Earnings Preview */}
                        {summaryPerf ? (
                          <div className="hidden sm:flex items-center gap-4">
                            <div className="text-right">
                              <p className={`text-xs ${mutedClass}`}>Revenue</p>
                              <p className={`text-sm font-bold ${textClass}`}>{formatCurrency(summaryPerf.totalSales)}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-xs ${mutedClass}`}>Commission</p>
                              <p className={`text-sm font-bold text-green-600 dark:text-green-400`}>{formatCurrency(summaryPerf.commission)}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-right hidden sm:block">
                            <p className={`text-xs ${mutedClass}`}>All Time Services</p>
                            <p className={`text-sm font-bold ${textClass}`}>{attendant._count?.saleItems || 0}</p>
                          </div>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleOpenModal(attendant, e)}
                            className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-600' : 'hover:bg-gray-200'} transition-colors`}
                            title="Edit"
                          >
                            <Edit2 className={`w-4 h-4 ${mutedClass}`} />
                          </button>
                          <button
                            onClick={(e) => handleToggleStatus(attendant, e)}
                            className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-600' : 'hover:bg-gray-200'} transition-colors`}
                            title={attendant.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {attendant.isActive ? (
                              <UserX className="w-4 h-4 text-red-500" />
                            ) : (
                              <UserCheck className="w-4 h-4 text-green-500" />
                            )}
                          </button>
                        </div>

                        {/* Expand Icon */}
                        <div className={`${mutedClass}`}>
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Performance Details */}
                  {isExpanded && (
                    <div className={`border-t ${borderClass} p-4 ${darkMode ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
                      {isLoadingPerf ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-500"></div>
                        </div>
                      ) : performance ? (
                        <div className="space-y-4">
                          {/* Performance Stats */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className={`${surfaceClass} rounded-xl p-3 border ${borderClass}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <DollarSign className="w-4 h-4 text-blue-500" />
                                <span className={`text-[10px] font-bold uppercase ${mutedClass}`}>Revenue</span>
                              </div>
                              <p className={`text-lg font-black ${textClass}`}>{formatCurrency(performance.performance?.totalSales)}</p>
                            </div>
                            <div className={`${surfaceClass} rounded-xl p-3 border ${borderClass}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <Award className="w-4 h-4 text-green-500" />
                                <span className={`text-[10px] font-bold uppercase ${mutedClass}`}>Commission</span>
                              </div>
                              <p className={`text-lg font-black text-green-600 dark:text-green-400`}>{formatCurrency(performance.performance?.commission)}</p>
                            </div>
                            <div className={`${surfaceClass} rounded-xl p-3 border ${borderClass}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <Briefcase className="w-4 h-4 text-purple-500" />
                                <span className={`text-[10px] font-bold uppercase ${mutedClass}`}>Services</span>
                              </div>
                              <p className={`text-lg font-black ${textClass}`}>{performance.performance?.serviceCount || 0}</p>
                            </div>
                            <div className={`${surfaceClass} rounded-xl p-3 border ${borderClass}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <Percent className="w-4 h-4 text-orange-500" />
                                <span className={`text-[10px] font-bold uppercase ${mutedClass}`}>Rate</span>
                              </div>
                              <p className={`text-lg font-black ${textClass}`}>{performance.performance?.commissionRate || 0}%</p>
                            </div>
                          </div>

                          {/* Recent Services */}
                          {performance.recentServices && performance.recentServices.length > 0 && (
                            <div>
                              <h4 className={`text-xs font-black uppercase ${mutedClass} mb-2`}>Recent Services</h4>
                              <div className="space-y-2">
                                {performance.recentServices.slice(0, 5).map((service, idx) => (
                                  <div key={idx} className={`flex items-center justify-between py-2 px-3 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-white'} border ${borderClass}`}>
                                    <div>
                                      <p className={`text-sm font-medium ${textClass}`}>{service.product?.name}</p>
                                      <p className={`text-xs ${mutedClass}`}>
                                        {new Date(service.sale?.createdAt).toLocaleDateString()} • #{service.sale?.transactionNumber?.slice(-8)}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className={`text-sm font-bold ${textClass}`}>{formatCurrency(service.subtotal)}</p>
                                      <p className={`text-xs text-green-600 dark:text-green-400`}>
                                        +{formatCurrency(service.subtotal * (attendant.commissionRate || 0) / 100)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {performance.recentServices?.length === 0 && (
                            <div className="text-center py-6">
                              <TrendingUp className={`w-8 h-8 mx-auto ${mutedClass} mb-2`} />
                              <p className={`text-sm ${mutedClass}`}>No services in this period</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <p className={`text-sm ${mutedClass}`}>Failed to load performance data</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Click outside handlers */}
      {(showDatePicker || showBranchDropdown) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowDatePicker(false);
            setShowBranchDropdown(false);
          }}
        />
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${surfaceClass} rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-lg font-black uppercase ${textClass}`}>
                {editingAttendant ? 'Edit Attendant' : 'Add Attendant'}
              </h2>
              <button onClick={handleCloseModal} className={`p-2 rounded-lg ${mutedClass} hover:bg-gray-100 dark:hover:bg-slate-700`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Profile Image Upload */}
              <div className="flex flex-col items-center mb-4">
                <div className="relative">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Profile preview"
                      className="w-24 h-24 rounded-full object-cover border-4 border-slate-200 dark:border-slate-600"
                    />
                  ) : (
                    <div className={`w-24 h-24 rounded-full ${darkMode ? 'bg-slate-600' : 'bg-gray-200'} flex items-center justify-center border-4 border-slate-200 dark:border-slate-600`}>
                      <UserCircle className={`w-10 h-10 ${mutedClass}`} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-slate-800 dark:bg-slate-600 text-white rounded-full flex items-center justify-center hover:bg-slate-700 transition-colors"
                    title="Upload photo"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                {imagePreview && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="mt-2 text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove photo
                  </button>
                )}
                <p className={`text-xs ${mutedClass} mt-2`}>Click to upload profile photo</p>
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Full Name *</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                  required
                />
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Specialty</label>
                <input
                  type="text"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                  placeholder="e.g., Hair Stylist, Nail Tech, Barber"
                />
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>
                  Branch {isOwner && isAllBranches && <span className="text-red-500">*</span>}
                </label>
                {isManager ? (
                  <div className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${darkMode ? 'bg-slate-700' : 'bg-gray-100'} ${mutedClass}`}>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      <span>{currentBranch?.name || 'Your Branch'}</span>
                    </div>
                    <p className={`text-xs ${mutedClass} mt-1`}>Attendants are auto-assigned to your branch</p>
                  </div>
                ) : (
                  <select
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                    required={isOwner && isAllBranches}
                  >
                    <option value="">Select Branch</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} {branch.isMain ? '(Main)' : ''}
                      </option>
                    ))}
                  </select>
                )}
                {isOwner && isAllBranches && !formData.branchId && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    You must select a branch when adding attendants in "All Branches" mode
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>
                  Commission Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={formData.commissionRate}
                    onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                    className={`w-full px-4 py-3 pr-12 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                    placeholder="e.g., 30"
                  />
                  <div className={`absolute right-4 top-1/2 -translate-y-1/2 ${mutedClass}`}>
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
                <p className={`text-xs ${mutedClass} mt-1`}>
                  Commission earned on services performed
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={`flex-1 px-4 py-3 rounded-xl border ${borderClass} ${textClass} font-bold text-sm uppercase`}
                  disabled={uploadingImage}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingImage}
                  className="flex-1 px-4 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploadingImage ? (
                    <>
                      <Upload className="w-4 h-4 animate-pulse" />
                      Uploading...
                    </>
                  ) : (
                    editingAttendant ? 'Update' : 'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendants;
