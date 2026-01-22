import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api';
import { Eye, EyeOff } from 'lucide-react';
import './Login.css';

const TenantLogin = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { login, user, isSuperAdmin, isOwner, isManager } = useAuth();

  const [tenant, setTenant] = useState(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenantError, setTenantError] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const userSlug = user.tenantSlug || (user.isSuperAdmin ? 'admin' : null);
      if (userSlug) {
        // Redirect based on role
        if (user.isSuperAdmin) {
          navigate('/admin/dashboard', { replace: true });
        } else if (isOwner()) {
          navigate(`/${userSlug}/owner/dashboard`, { replace: true });
        } else if (isManager()) {
          navigate(`/${userSlug}/manager/dashboard`, { replace: true });
        } else {
          navigate(`/${userSlug}/dashboard`, { replace: true });
        }
      }
    }
  }, [user, navigate, isOwner, isManager]);

  // Load tenant info
  useEffect(() => {
    const loadTenant = async () => {
      try {
        setTenantLoading(true);
        setTenantError('');
        const response = await authAPI.getTenantBySlug(slug);
        setTenant(response.data.tenant);
      } catch (error) {
        if (error.response?.status === 404) {
          setTenantError('Business not found');
        } else if (error.response?.status === 403) {
          setTenantError(error.response.data.error || 'Access denied');
        } else {
          setTenantError('Failed to load business info');
        }
      } finally {
        setTenantLoading(false);
      }
    };

    if (slug) {
      loadTenant();
    }
  }, [slug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password, slug);

      if (result.success) {
        const loggedInUser = result.user;
        const userSlug = loggedInUser.tenantSlug || (loggedInUser.isSuperAdmin ? 'admin' : slug);

        // Redirect based on role
        if (loggedInUser.isSuperAdmin) {
          navigate('/admin/dashboard', { replace: true });
        } else if (loggedInUser.role === 'OWNER' || loggedInUser.role === 'ADMIN') {
          navigate(`/${userSlug}/owner/dashboard`, { replace: true });
        } else if (loggedInUser.role === 'MANAGER') {
          navigate(`/${userSlug}/manager/dashboard`, { replace: true });
        } else {
          navigate(`/${userSlug}/dashboard`, { replace: true });
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (tenantLoading) {
    return (
      <div className={`login-container ${darkMode ? 'dark-mode' : ''}`}>
        <div className="login-card">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto"></div>
            <p className="mt-4 text-sm" style={{ color: 'var(--auth-text-secondary)' }}>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state - tenant not found
  if (tenantError) {
    return (
      <div className={`login-container ${darkMode ? 'dark-mode' : ''}`}>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="theme-toggle"
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
        <div className="login-card">
          <div className="logo-container">
            <div className="logo">❌</div>
            <h1 className="logo-text">Not Found</h1>
          </div>
          <div className="error-message">
            {tenantError}
          </div>
          <p style={{ textAlign: 'center', color: 'var(--auth-text-secondary)', fontSize: '14px', marginTop: '16px' }}>
            Please check the URL and try again.
          </p>
        </div>
      </div>
    );
  }

  const isSuperAdminLogin = slug === 'admin';

  return (
    <div className={`login-container ${darkMode ? 'dark-mode' : ''}`}>
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="theme-toggle"
      >
        {darkMode ? '☀️' : '🌙'}
      </button>

      <div className="login-card">
        <div className="logo-container">
          {tenant?.businessLogo ? (
            <img
              src={tenant.businessLogo}
              alt={tenant.businessName}
              className="logo"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div className="logo">
              {isSuperAdminLogin ? '🔐' : '🏪'}
            </div>
          )}
          <h1 className="logo-text">{tenant?.businessName || 'Smart POS'}</h1>
        </div>

        <div className="forms-wrapper" style={{ minHeight: 'auto' }}>
          <form onSubmit={handleSubmit} className="auth-form active" style={{ position: 'relative' }}>
            {error && (
              <div className="error-message">{error}</div>
            )}

            <div className="input-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {!isSuperAdminLogin && (
          <div className="login-footer">
            <p style={{ fontSize: '12px', color: 'var(--auth-text-secondary)' }}>
              Logging in to <strong>{tenant?.businessName}</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TenantLogin;
