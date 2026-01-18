import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="nav-brand">
          <h2>POS System</h2>
          <span className="tenant-name">{user?.tenantName}</span>
        </div>
        <div className="nav-links">
          <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>
            Dashboard
          </Link>
          {isAdmin() && (
            <>
              <Link to="/inventory" className={location.pathname === '/inventory' ? 'active' : ''}>
                Inventory
              </Link>
              <Link to="/staff" className={location.pathname === '/staff' ? 'active' : ''}>
                Staff
              </Link>
              <Link to="/reports" className={location.pathname === '/reports' ? 'active' : ''}>
                Reports
              </Link>
              <Link to="/audit" className={location.pathname === '/audit' ? 'active' : ''}>
                Audit Log
              </Link>
            </>
          )}
        </div>
        <div className="nav-user">
          <span>{user?.fullName} ({user?.role})</span>
          <button onClick={handleLogout} className="btn-logout">Logout</button>
        </div>
      </nav>
      <main className="main-content">{children}</main>
    </div>
  );
};

export default Layout;
