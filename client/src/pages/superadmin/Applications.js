import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { superAdminAPI } from '../../api';
import ApplicationModal from '../../components/ApplicationModal';
import './SuperAdmin.css';

const Applications = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [applications, setApplications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [showModal, setShowModal] = useState(false);

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
      setSelectedApp(response.data.application);
      setShowModal(true);
    } catch (err) {
      setError('Failed to load application details');
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedApp(null);
  };

  const handleActionComplete = () => {
    handleModalClose();
    fetchApplications();
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      PENDING: 'status-pending',
      APPROVED: 'status-approved',
      REJECTED: 'status-rejected'
    };
    return badges[status] || 'status-pending';
  };

  return (
    <div className="super-admin-page">
      <div className="page-header">
        <h1>Applications</h1>
        <p>Manage tenant applications</p>
      </div>

      <div className="filter-tabs">
        <button
          className={currentStatus === 'all' ? 'active' : ''}
          onClick={() => handleStatusFilter('all')}
        >
          All ({pagination.total})
        </button>
        <button
          className={currentStatus === 'pending' ? 'active' : ''}
          onClick={() => handleStatusFilter('pending')}
        >
          Pending
        </button>
        <button
          className={currentStatus === 'approved' ? 'active' : ''}
          onClick={() => handleStatusFilter('approved')}
        >
          Approved
        </button>
        <button
          className={currentStatus === 'rejected' ? 'active' : ''}
          onClick={() => handleStatusFilter('rejected')}
        >
          Rejected
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading">Loading applications...</div>
      ) : applications.length === 0 ? (
        <div className="empty-state">
          <p>No applications found</p>
        </div>
      ) : (
        <>
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div className="cell-primary">{app.businessName}</div>
                      <div className="cell-secondary">{app.businessEmail}</div>
                    </td>
                    <td>
                      <div className="cell-primary">{app.ownerFullName}</div>
                      <div className="cell-secondary">{app.ownerEmail}</div>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusBadge(app.status)}`}>
                        {app.status}
                      </span>
                    </td>
                    <td>{formatDate(app.createdAt)}</td>
                    <td>
                      <button
                        className="btn-action"
                        onClick={() => handleViewApplication(app)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
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

      {showModal && selectedApp && (
        <ApplicationModal
          application={selectedApp}
          onClose={handleModalClose}
          onActionComplete={handleActionComplete}
        />
      )}
    </div>
  );
};

export default Applications;
