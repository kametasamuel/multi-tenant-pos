import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './SuperAdminLayout.css';

const SuperAdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="super-admin-layout">
      <nav className="super-admin-navbar">
        <div className="nav-brand">
          <h2>POS System</h2>
          <span className="admin-badge">Super Admin</span>
        </div>
        <div className="nav-links">
          <Link
            to="/super-admin/dashboard"
            className={isActive('/super-admin/dashboard') ? 'active' : ''}
          >
            Dashboard
          </Link>
          <Link
            to="/super-admin/applications"
            className={isActive('/super-admin/applications') ? 'active' : ''}
          >
            Applications
          </Link>
          <Link
            to="/super-admin/tenants"
            className={isActive('/super-admin/tenants') ? 'active' : ''}
          >
            Tenants
          </Link>
        </div>
        <div className="nav-user">
          <span>{user?.fullName}</span>
          <button onClick={handleLogout} className="btn-logout">Logout</button>
        </div>
      </nav>
      <main className="super-admin-content">{children}</main>
    </div>
  );
};

export default SuperAdminLayout;
