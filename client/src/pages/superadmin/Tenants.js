import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { superAdminAPI } from '../../api';
import SubscriptionModal from '../../components/SubscriptionModal';
import './SuperAdmin.css';

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
    if (daysLeft < 0) return { class: 'expired', text: 'Expired' };
    if (daysLeft <= 7) return { class: 'warning', text: `${daysLeft} days left` };
    return { class: 'active', text: `${daysLeft} days left` };
  };

  return (
    <div className="super-admin-page">
      <div className="page-header">
        <h1>Tenants</h1>
        <p>Manage all tenants and their subscriptions</p>
      </div>

      <div className="controls-bar">
        <div className="filter-tabs">
          <button
            className={currentStatus === 'all' ? 'active' : ''}
            onClick={() => handleStatusFilter('all')}
          >
            All
          </button>
          <button
            className={currentStatus === 'active' ? 'active' : ''}
            onClick={() => handleStatusFilter('active')}
          >
            Active
          </button>
          <button
            className={currentStatus === 'inactive' ? 'active' : ''}
            onClick={() => handleStatusFilter('inactive')}
          >
            Inactive
          </button>
        </div>

        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search by business name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading">Loading tenants...</div>
      ) : tenants.length === 0 ? (
        <div className="empty-state">
          <p>No tenants found</p>
        </div>
      ) : (
        <>
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Status</th>
                  <th>Subscription</th>
                  <th>Stats</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => {
                  const subStatus = getSubscriptionStatus(tenant.subscriptionEnd);
                  return (
                    <tr key={tenant.id} className={!tenant.isActive ? 'inactive-row' : ''}>
                      <td>
                        <div className="tenant-info">
                          {tenant.businessLogo && (
                            <img
                              src={tenant.businessLogo}
                              alt={tenant.businessName}
                              className="tenant-logo"
                            />
                          )}
                          <div>
                            <div className="cell-primary">{tenant.businessName}</div>
                            <div className="cell-secondary">
                              Created: {formatDate(tenant.createdAt)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${tenant.isActive ? 'status-approved' : 'status-rejected'}`}>
                          {tenant.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="cell-primary">{formatDate(tenant.subscriptionEnd)}</div>
                        <div className={`subscription-status ${subStatus.class}`}>
                          {subStatus.text}
                        </div>
                      </td>
                      <td>
                        <div className="stats-cell">
                          <span title="Users">{tenant._count.users} users</span>
                          <span title="Products">{tenant._count.products} products</span>
                          <span title="Sales">{tenant._count.sales} sales</span>
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-action btn-extend"
                            onClick={() => handleExtendSubscription(tenant)}
                          >
                            Extend
                          </button>
                          <button
                            className={`btn-action ${tenant.isActive ? 'btn-deactivate' : 'btn-activate'}`}
                            onClick={() => handleToggleStatus(tenant)}
                            disabled={actionLoading}
                          >
                            {tenant.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {pagination.pages}
              </span>
              <button
                disabled={currentPage === pagination.pages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

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
