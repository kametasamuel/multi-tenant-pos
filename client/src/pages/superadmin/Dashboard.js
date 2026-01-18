import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { superAdminAPI } from '../../api';
import './SuperAdmin.css';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentApplications, setRecentApplications] = useState([]);
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await superAdminAPI.getDashboard();
      setStats(response.data.stats);
      setRecentApplications(response.data.recentApplications);
      setExpiringSoon(response.data.expiringSoon);
    } catch (err) {
      setError('Failed to load dashboard');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysUntil = (date) => {
    const days = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="error-banner">{error}</div>;
  }

  return (
    <div className="super-admin-page">
      <div className="page-header">
        <h1>Super Admin Dashboard</h1>
        <p>Overview of the POS system</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card pending">
          <div className="stat-icon">!</div>
          <div className="stat-info">
            <span className="stat-value">{stats?.pendingApplications || 0}</span>
            <span className="stat-label">Pending Applications</span>
          </div>
          <Link to="/super-admin/applications?status=pending" className="stat-link">
            View All
          </Link>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">&#10003;</div>
          <div className="stat-info">
            <span className="stat-value">{stats?.activeTenants || 0}</span>
            <span className="stat-label">Active Tenants</span>
          </div>
          <Link to="/super-admin/tenants?status=active" className="stat-link">
            View All
          </Link>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">&#9888;</div>
          <div className="stat-info">
            <span className="stat-value">{stats?.expiringTenants || 0}</span>
            <span className="stat-label">Expiring Soon (7 days)</span>
          </div>
        </div>

        <div className="stat-card neutral">
          <div className="stat-icon">&#128202;</div>
          <div className="stat-info">
            <span className="stat-value">{stats?.totalApplications || 0}</span>
            <span className="stat-label">Total Applications</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Recent Applications</h2>
            <Link to="/super-admin/applications">View All</Link>
          </div>
          <div className="section-content">
            {recentApplications.length === 0 ? (
              <p className="no-data">No recent applications</p>
            ) : (
              <div className="list">
                {recentApplications.map((app) => (
                  <div key={app.id} className="list-item">
                    <div className="item-info">
                      <span className="item-name">{app.businessName}</span>
                      <span className="item-meta">{app.businessEmail}</span>
                    </div>
                    <div className="item-actions">
                      <span className={`status-badge status-${app.status.toLowerCase()}`}>
                        {app.status}
                      </span>
                      <span className="item-date">{formatDate(app.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-header">
            <h2>Subscriptions Expiring Soon</h2>
            <Link to="/super-admin/tenants">View All</Link>
          </div>
          <div className="section-content">
            {expiringSoon.length === 0 ? (
              <p className="no-data">No subscriptions expiring soon</p>
            ) : (
              <div className="list">
                {expiringSoon.map((tenant) => (
                  <div key={tenant.id} className="list-item warning">
                    <div className="item-info">
                      <span className="item-name">{tenant.businessName}</span>
                      <span className="item-meta">
                        Expires: {formatDate(tenant.subscriptionEnd)}
                      </span>
                    </div>
                    <div className="item-actions">
                      <span className="days-badge">
                        {getDaysUntil(tenant.subscriptionEnd)} days left
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
