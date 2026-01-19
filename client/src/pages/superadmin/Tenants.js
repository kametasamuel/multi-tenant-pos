import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { superAdminAPI } from '../../api';
import SubscriptionModal from '../../components/SubscriptionModal';
import {
  Building2,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Package,
  ShoppingCart,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  CalendarPlus
} from 'lucide-react';

const Tenants = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tenants, setTenants] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const currentStatus = searchParams.get('status') || 'all';
  const currentPage = parseInt(searchParams.get('page')) || 1;

  useEffect(() => {
    fetchTenants();
  }, [currentStatus, currentPage]);

  const fetchTenants = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page: currentPage, limit: 10 };
      if (currentStatus !== 'all') {
        params.status = currentStatus;
      }
      if (searchTerm) {
        params.search = searchTerm;
      }
      const response = await superAdminAPI.getTenants(params);
      setTenants(response.data.tenants);
      setPagination(response.data.pagination);
    } catch (err) {
      setError('Failed to load tenants');
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

  const handleSearch = (e) => {
    e.preventDefault();
    searchParams.set('page', '1');
    setSearchParams(searchParams);
    fetchTenants();
  };

  const handleToggleStatus = async (tenant) => {
    if (!window.confirm(`Are you sure you want to ${tenant.isActive ? 'deactivate' : 'activate'} ${tenant.businessName}?`)) {
      return;
    }

    setActionLoading(true);
    try {
      await superAdminAPI.updateTenantStatus(tenant.id, !tenant.isActive);
      fetchTenants();
    } catch (err) {
      setError('Failed to update tenant status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExtendSubscription = (tenant) => {
    setSelectedTenant(tenant);
    setShowSubscriptionModal(true);
  };

  const handleSubscriptionUpdate = () => {
    setShowSubscriptionModal(false);
    setSelectedTenant(null);
    fetchTenants();
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getSubscriptionStatus = (endDate) => {
    const daysLeft = Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { class: 'bg-red-100 text-red-800', text: 'Expired', daysLeft };
    if (daysLeft <= 7) return { class: 'bg-amber-100 text-amber-800', text: `${daysLeft} days left`, daysLeft };
    return { class: 'bg-green-100 text-green-800', text: `${daysLeft} days left`, daysLeft };
  };

  const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'inactive', label: 'Inactive' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Building2 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Tenants</h1>
              <p className="text-sm text-gray-500">Manage all tenants and their subscriptions</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Filter Tabs */}
          <div className="flex gap-2">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleStatusFilter(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  currentStatus === tab.key
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by business name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : tenants.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">No tenants found</p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">Business</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">Status</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">Subscription</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">Stats</th>
                      <th className="text-center px-6 py-4 text-sm font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {tenants.map((tenant) => {
                      const subStatus = getSubscriptionStatus(tenant.subscriptionEnd);
                      return (
                        <tr
                          key={tenant.id}
                          className={`hover:bg-gray-50 transition-colors ${!tenant.isActive ? 'bg-gray-50/50' : ''}`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {tenant.businessLogo ? (
                                <img
                                  src={tenant.businessLogo}
                                  alt={tenant.businessName}
                                  className="w-10 h-10 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                  <Building2 className="w-5 h-5 text-purple-600" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-gray-900">{tenant.businessName}</p>
                                <p className="text-sm text-gray-500 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Created: {formatDate(tenant.createdAt)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                              tenant.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {tenant.isActive ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              {tenant.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-gray-900">{formatDate(tenant.subscriptionEnd)}</p>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${subStatus.class}`}>
                                <Clock className="w-3 h-3" />
                                {subStatus.text}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                              <span className="inline-flex items-center gap-1" title="Users">
                                <Users className="w-4 h-4 text-gray-400" />
                                {tenant._count.users}
                              </span>
                              <span className="inline-flex items-center gap-1" title="Products">
                                <Package className="w-4 h-4 text-gray-400" />
                                {tenant._count.products}
                              </span>
                              <span className="inline-flex items-center gap-1" title="Sales">
                                <ShoppingCart className="w-4 h-4 text-gray-400" />
                                {tenant._count.sales}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleExtendSubscription(tenant)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg text-sm font-medium transition-colors"
                              >
                                <CalendarPlus className="w-4 h-4" />
                                Extend
                              </button>
                              <button
                                onClick={() => handleToggleStatus(tenant)}
                                disabled={actionLoading}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                                  tenant.isActive
                                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                    : 'bg-green-50 text-green-600 hover:bg-green-100'
                                }`}
                              >
                                {tenant.isActive ? (
                                  <>
                                    <ToggleRight className="w-4 h-4" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <ToggleLeft className="w-4 h-4" />
                                    Activate
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-500">
                  Page {currentPage} of {pagination.pages}
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <button
                    disabled={currentPage === pagination.pages}
                    onClick={() => handlePageChange(currentPage + 1)}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {showSubscriptionModal && selectedTenant && (
        <SubscriptionModal
          tenant={selectedTenant}
          onClose={() => setShowSubscriptionModal(false)}
          onSuccess={handleSubscriptionUpdate}
        />
      )}
    </div>
  );
};

export default Tenants;
