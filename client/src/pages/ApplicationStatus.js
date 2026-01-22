import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { applicationsAPI } from '../api';
import './ApplicationStatus.css';

const ApplicationStatus = () => {
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const [searchType, setSearchType] = useState('id');
  const [searchValue, setSearchValue] = useState('');
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const tabsRef = useRef(null);
  const indicatorRef = useRef(null);

  useEffect(() => {
    updateTabIndicator(searchType);
    window.addEventListener('resize', () => updateTabIndicator(searchType));
    return () => window.removeEventListener('resize', () => updateTabIndicator(searchType));
  }, [searchType]);

  const updateTabIndicator = (tab) => {
    if (!tabsRef.current || !indicatorRef.current) return;
    const tabs = tabsRef.current.querySelectorAll('.tab');
    const index = tab === 'id' ? 0 : 1;
    const tabWidth = tabs[0]?.offsetWidth || 0;
    indicatorRef.current.style.width = `${tabWidth}px`;
    indicatorRef.current.style.left = `${index * (tabWidth + 4) + 4}px`;
  };

  useEffect(() => {
    // Auto-fill from navigation state
    if (location.state?.applicationId) {
      setSearchValue(location.state.applicationId);
      setSearchType('id');
      handleSearch(location.state.applicationId, 'id');
    }
  }, [location.state]);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

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

  const getStatusInfo = (status) => {
    const info = {
      PENDING: { class: 'status-pending', text: 'Pending Review', icon: '⏳' },
      APPROVED: { class: 'status-approved', text: 'Approved', icon: '✓' },
      REJECTED: { class: 'status-rejected', text: 'Rejected', icon: '✗' }
    };
    return info[status] || info.PENDING;
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
    <div className={`status-container ${darkMode ? 'dark-mode' : ''}`}>
      <button className="theme-toggle" onClick={toggleTheme}>
        {darkMode ? '☀️' : '🌙'}
      </button>

      <div className="status-card">
        <div className="logo-container">
          <div className="logo">🔍</div>
          <div className="logo-text">Application Status</div>
        </div>

        {/* Search Type Tabs */}
        <div className="tabs" ref={tabsRef}>
          <div className="tab-indicator" ref={indicatorRef}></div>
          <button
            className={`tab ${searchType === 'id' ? 'active' : ''}`}
            onClick={() => setSearchType('id')}
            type="button"
          >
            By ID
          </button>
          <button
            className={`tab ${searchType === 'email' ? 'active' : ''}`}
            onClick={() => setSearchType('email')}
            type="button"
          >
            By Email
          </button>
        </div>

        {/* Search Form */}
        <div className="search-form">
          <div className="input-group">
            <label htmlFor="searchValue">
              {searchType === 'id' ? 'Application ID' : 'Business Email'}
            </label>
            <input
              type={searchType === 'email' ? 'email' : 'text'}
              id="searchValue"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={searchType === 'id' ? 'Enter your application ID' : 'Enter your business email'}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <button
            className="btn-primary"
            onClick={() => handleSearch()}
            disabled={loading}
          >
            {loading ? 'Searching...' : 'Check Status'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {application && (
          <div className="application-result">
            {/* Status Badge */}
            <div className={`status-badge ${getStatusInfo(application.status).class}`}>
              <span className="status-icon">{getStatusInfo(application.status).icon}</span>
              {getStatusInfo(application.status).text}
            </div>

            {/* Application Info */}
            <div className="application-info">
              <h3>{application.businessName}</h3>
              <p className="email">{application.businessEmail}</p>
            </div>

            {/* Details Grid */}
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

            {/* Status Messages */}
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
        )}

        {/* Footer */}
        <div className="status-footer">
          <p>
            <Link to="/signup">Submit New Application</Link>
          </p>
          <p>
            <Link to="/login">Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ApplicationStatus;
