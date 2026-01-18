import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { applicationsAPI } from '../api';
import './ApplicationStatus.css';

const ApplicationStatus = () => {
  const location = useLocation();
  const [searchType, setSearchType] = useState('id');
  const [searchValue, setSearchValue] = useState('');
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Auto-fill from navigation state
    if (location.state?.applicationId) {
      setSearchValue(location.state.applicationId);
      setSearchType('id');
      handleSearch(location.state.applicationId, 'id');
    }
  }, [location.state]);

  const handleSearch = async (value = searchValue, type = searchType) => {
    if (!value.trim()) {
      setError('Please enter a value to search');
      return;
    }

    setLoading(true);
    setError('');
    setApplication(null);

    try {
      let response;
      if (type === 'id') {
        response = await applicationsAPI.getStatus(value.trim());
      } else {
        response = await applicationsAPI.getStatusByEmail(value.trim());
      }
      setApplication(response.data.application);
    } catch (err) {
      setError(err.response?.data?.error || 'Application not found');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      PENDING: { class: 'status-pending', text: 'Pending Review' },
      APPROVED: { class: 'status-approved', text: 'Approved' },
      REJECTED: { class: 'status-rejected', text: 'Rejected' }
    };
    return badges[status] || badges.PENDING;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="status-container">
      <div className="status-card">
        <div className="status-header">
          <h1>POS System</h1>
          <h2>Application Status</h2>
        </div>

        <div className="search-section">
          <div className="search-type-toggle">
            <button
              className={searchType === 'id' ? 'active' : ''}
              onClick={() => setSearchType('id')}
            >
              Search by ID
            </button>
            <button
              className={searchType === 'email' ? 'active' : ''}
              onClick={() => setSearchType('email')}
            >
              Search by Email
            </button>
          </div>

          <div className="search-input">
            <input
              type={searchType === 'email' ? 'email' : 'text'}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={searchType === 'id' ? 'Enter Application ID' : 'Enter Business Email'}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={() => handleSearch()} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {application && (
          <div className="application-result">
            <div className={`status-badge ${getStatusBadge(application.status).class}`}>
              {getStatusBadge(application.status).text}
            </div>

            <div className="application-details">
              <h3>{application.businessName}</h3>
              <p className="email">{application.businessEmail}</p>

              <div className="detail-grid">
                <div className="detail-item">
                  <label>Application ID</label>
                  <span className="mono">{application.id}</span>
                </div>
                <div className="detail-item">
                  <label>Submitted On</label>
                  <span>{formatDate(application.createdAt)}</span>
                </div>
                {application.reviewedAt && (
                  <div className="detail-item">
                    <label>Reviewed On</label>
                    <span>{formatDate(application.reviewedAt)}</span>
                  </div>
                )}
              </div>

              {application.status === 'PENDING' && (
                <div className="status-message pending">
                  <h4>Your application is being reviewed</h4>
                  <p>
                    Our team is reviewing your application. This usually takes 1-2 business days.
                    Once approved, you will be able to log in using the credentials you provided during signup.
                  </p>
                </div>
              )}

              {application.status === 'APPROVED' && (
                <div className="status-message approved">
                  <h4>Your application has been approved!</h4>
                  <p>
                    Congratulations! Your business account is now active.
                    You can log in using the password you set during registration.
                    Your username is derived from your business name.
                  </p>
                  <Link to="/login" className="btn-login">
                    Go to Login
                  </Link>
                </div>
              )}

              {application.status === 'REJECTED' && (
                <div className="status-message rejected">
                  <h4>Your application was not approved</h4>
                  {application.rejectionReason && (
                    <div className="rejection-reason">
                      <label>Reason:</label>
                      <p>{application.rejectionReason}</p>
                    </div>
                  )}
                  <p>
                    If you believe this was an error or would like to appeal,
                    please contact our support team.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="status-footer">
          <Link to="/signup">Submit New Application</Link>
          <span className="divider">|</span>
          <Link to="/login">Back to Login</Link>
        </div>
      </div>
    </div>
  );
};

export default ApplicationStatus;
