import React, { useState, useEffect } from 'react';
import { ownerAPI } from '../../api';
import {
  Activity,
  Search,
  Filter,
  Download,
  User,
  Calendar,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Building2,
  ChevronDown,
  X
} from 'lucide-react';

const ActivityLogs = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, currentBranch, isAllBranches, branches = [] }) => {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });
  const [actionCounts, setActionCounts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    userId: '',
    action: ''
  });
  const [exporting, setExporting] = useState(false);
  // Branch filter for drilling down when in "All Branches" mode
  const [branchFilter, setBranchFilter] = useState(null);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

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
    loadInitialData();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [pagination.page, filters, currentBranch, isAllBranches, branchFilter]);

  const loadInitialData = async () => {
    try {
      const staffRes = await ownerAPI.getStaff();
      setStaff(staffRes.data.staff || []);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: 50,
        ...filters
      };

      const effectiveBranchId = getEffectiveBranchId();
      if (effectiveBranchId) {
        params.branchId = effectiveBranchId;
      }

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '') delete params[key];
      });

      const response = await ownerAPI.getActivity(params);
      setLogs(response.data.logs || []);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination?.total || 0,
        pages: response.data.pagination?.pages || 0
      }));
      setActionCounts(response.data.actionCounts || []);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const response = await ownerAPI.exportActivity(filters);

      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `activity-logs-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      userId: '',
      action: '',
      branchId: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getActionStyle = (action) => {
    if (action.includes('void') || action.includes('delete')) {
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    }
    if (action.includes('create') || action.includes('add')) {
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    }
    if (action.includes('update') || action.includes('edit')) {
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    }
    if (action.includes('login') || action.includes('auth')) {
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    }
    return 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const isHighValueAction = (log) => {
    if (!log.metadata) return false;
    try {
      const metadata = JSON.parse(log.metadata);
      return metadata.amount && metadata.amount >= 100;
    } catch {
      return false;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black uppercase tracking-tight ${textClass}`}>Activity Logs</h1>
          <div className="flex items-center gap-2 mt-1">
            <Building2 className={`w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
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
            onClick={loadLogs}
            className={`flex items-center gap-2 px-4 py-2.5 border ${borderClass} ${textClass} rounded-xl font-bold text-sm uppercase hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Action Stats */}
      {actionCounts.length > 0 && (
        <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
          <p className={`text-xs font-bold uppercase ${mutedClass} mb-3`}>Top Actions</p>
          <div className="flex flex-wrap gap-2">
            {actionCounts.slice(0, 8).map((item, index) => (
              <button
                key={index}
                onClick={() => handleFilterChange('action', item.action)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  filters.action === item.action
                    ? 'bg-slate-700 text-white'
                    : getActionStyle(item.action)
                }`}
              >
                {item.action.replace(/_/g, ' ')} ({item.count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
        <div className="flex items-center gap-2 mb-4">
          <Filter className={`w-4 h-4 ${mutedClass}`} />
          <p className={`text-xs font-bold uppercase ${mutedClass}`}>Filters</p>
          {Object.values(filters).some(v => v !== '') && (
            <button
              onClick={clearFilters}
              className="ml-auto text-xs text-slate-600 dark:text-slate-400 hover:underline"
            >
              Clear All
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            />
          </div>
          <div>
            <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            />
          </div>
          <div>
            <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>User</label>
            <select
              value={filters.userId}
              onChange={(e) => handleFilterChange('userId', e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            >
              <option value="">All Users</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>{s.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Branch</label>
            <select
              value={filters.branchId}
              onChange={(e) => handleFilterChange('branchId', e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Action</label>
            <input
              type="text"
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              placeholder="Search actions..."
              className={`w-full px-3 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
        </div>
      ) : (
        <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`px-6 py-4 text-left text-xs font-black uppercase ${mutedClass}`}>Timestamp</th>
                  <th className={`px-6 py-4 text-left text-xs font-black uppercase ${mutedClass}`}>User</th>
                  <th className={`px-6 py-4 text-left text-xs font-black uppercase ${mutedClass}`}>Action</th>
                  <th className={`px-6 py-4 text-left text-xs font-black uppercase ${mutedClass}`}>Description</th>
                  <th className={`px-6 py-4 text-left text-xs font-black uppercase ${mutedClass}`}>Branch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {logs.map(log => (
                  <tr key={log.id} className={isHighValueAction(log) ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={`text-sm ${textClass}`}>{formatDate(log.createdAt)}</span>
                        <span className={`text-xs ${mutedClass}`}>{formatTime(log.createdAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${darkMode ? 'bg-slate-600' : 'bg-gray-200'} flex items-center justify-center`}>
                          <span className={`text-xs font-bold ${textClass}`}>{log.user?.fullName?.charAt(0)}</span>
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${textClass}`}>{log.user?.fullName}</p>
                          <p className={`text-xs ${mutedClass}`}>{log.user?.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {isHighValueAction(log) && (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getActionStyle(log.action)}`}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className={`text-sm ${textClass} max-w-xs truncate`}>{log.description || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm ${log.branch?.name ? textClass : mutedClass}`}>
                        {log.branch?.name || log.user?.branch?.name || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {logs.length === 0 && (
            <div className="p-12 text-center">
              <Activity className={`w-12 h-12 mx-auto ${mutedClass} mb-4`} />
              <p className={`text-sm ${mutedClass}`}>No activity logs found</p>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className={`flex items-center justify-between px-6 py-4 border-t ${borderClass}`}>
              <p className={`text-sm ${mutedClass}`}>
                Showing {((pagination.page - 1) * 50) + 1} to {Math.min(pagination.page * 50, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <ChevronLeft className={`w-5 h-5 ${mutedClass}`} />
                </button>
                <span className={`px-4 py-2 text-sm font-bold ${textClass}`}>
                  {pagination.page} / {pagination.pages}
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                  className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <ChevronRight className={`w-5 h-5 ${mutedClass}`} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ActivityLogs;
