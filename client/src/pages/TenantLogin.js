import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api';
import { Eye, EyeOff, X, Mail, AlertCircle, Check, Info } from 'lucide-react';
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

  // Forgot password state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

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
        } else if (user.role === 'KITCHEN') {
          navigate(`/${userSlug}/kitchen`, { replace: true });
        } else {
          navigate(`/${userSlug}/dashboard`, { replace: true });
        }
      }
    }
  }, [user, navigate, isOwner, isManager]);

  // Load tenant info (skip for super admin login)
  useEffect(() => {
    const loadTenant = async () => {
      // Skip tenant loading for super admin login
      if (slug === 'admin') {
        setTenantLoading(false);
        return;
      }

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

      if (!result.success) {
        setError(result.error || 'Invalid credentials');
        setLoading(false);
        return;
      }

      // Login succeeded - handle redirect
      const loggedInUser = result.user;
      if (!loggedInUser) {
        setError('Login succeeded but user data was not returned. Please try again.');
        setLoading(false);
        return;
      }

      const userSlug = loggedInUser.tenantSlug || (loggedInUser.isSuperAdmin ? 'admin' : slug);

      // Redirect based on role
      if (loggedInUser.isSuperAdmin) {
        navigate('/admin/dashboard', { replace: true });
      } else if (loggedInUser.role === 'OWNER' || loggedInUser.role === 'ADMIN') {
        navigate(`/${userSlug}/owner/dashboard`, { replace: true });
      } else if (loggedInUser.role === 'MANAGER') {
        navigate(`/${userSlug}/manager/dashboard`, { replace: true });
      } else if (loggedInUser.role === 'KITCHEN') {
        navigate(`/${userSlug}/kitchen`, { replace: true });
      } else {
        navigate(`/${userSlug}/dashboard`, { replace: true });
      }
    } catch (err) {
      console.error('Login error:', err);
      // Show the actual error if available
      const errorMessage = err?.response?.data?.error || err?.message || 'An unexpected error occurred. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle forgot password submission
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email address');
      return;
    }

    setForgotLoading(true);
    try {
      await authAPI.requestPasswordReset(forgotEmail.trim(), slug === 'admin' ? null : slug);
      setForgotSuccess('If an account exists with this email, a password reset link has been sent.');
      setForgotEmail('');
    } catch (error) {
      // Don't reveal if email exists or not for security
      setForgotSuccess('If an account exists with this email, a password reset link has been sent.');
    } finally {
      setForgotLoading(false);
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
          {isSuperAdminLogin ? (
            <>
              <div className="logo" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}>
                🛡️
              </div>
              <h1 className="logo-text">Platform Control</h1>
              <p style={{ fontSize: '11px', color: 'var(--auth-text-secondary)', marginTop: '-8px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                Super Administrator
              </p>
            </>
          ) : tenant?.businessLogo ? (
            <>
              <img
                src={tenant.businessLogo}
                alt={tenant.businessName}
                className="logo"
                style={{ objectFit: 'cover' }}
              />
              <h1 className="logo-text">{tenant.businessName}</h1>
            </>
          ) : (
            <>
              <div className="logo">🏪</div>
              <h1 className="logo-text">{tenant?.businessName || 'Smart POS'}</h1>
            </>
          )}
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

            {/* Forgot Password Link */}
            <button
              type="button"
              onClick={() => {
                setShowForgotModal(true);
                setForgotEmail('');
                setForgotError('');
                setForgotSuccess('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--auth-text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
                marginTop: '12px',
                textDecoration: 'underline',
                width: '100%',
                textAlign: 'center'
              }}
            >
              Forgot Password?
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

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 100
          }}
          onClick={() => setShowForgotModal(false)}
        >
          <div
            style={{
              background: darkMode ? '#1e293b' : 'white',
              borderRadius: '24px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '24px',
              borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: darkMode ? 'white' : '#1e293b',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '-0.5px'
                }}>Reset Password</h2>
                <p style={{
                  fontSize: '13px',
                  color: darkMode ? '#94a3b8' : '#64748b',
                  margin: '4px 0 0 0'
                }}>
                  {isSuperAdminLogin ? 'Super Admin Recovery' : `${tenant?.businessName || 'Business'} Account`}
                </p>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                style={{
                  background: darkMode ? '#334155' : '#f1f5f9',
                  border: 'none',
                  borderRadius: '12px',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: darkMode ? '#94a3b8' : '#64748b'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '24px' }}>
              {/* Info Notice */}
              <div style={{
                padding: '16px',
                borderRadius: '16px',
                background: darkMode ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
                border: `1px solid ${darkMode ? 'rgba(59, 130, 246, 0.2)' : '#bfdbfe'}`,
                marginBottom: '20px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}>
                <Info size={20} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{
                    fontSize: '13px',
                    color: darkMode ? '#93c5fd' : '#1e40af',
                    margin: 0,
                    fontWeight: 600
                  }}>
                    {isSuperAdminLogin ? 'Super Admin Password Reset' : 'Owner & Admin Only'}
                  </p>
                  <p style={{
                    fontSize: '12px',
                    color: darkMode ? '#7dd3fc' : '#3b82f6',
                    margin: '4px 0 0 0'
                  }}>
                    {isSuperAdminLogin
                      ? 'Enter your registered email address to receive a password reset link.'
                      : 'Password reset via email is only available for Owner accounts. Cashiers and Managers must contact their business owner to reset their password.'}
                  </p>
                </div>
              </div>

              {/* Success Message */}
              {forgotSuccess && (
                <div style={{
                  padding: '16px',
                  borderRadius: '16px',
                  background: darkMode ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
                  border: `1px solid ${darkMode ? 'rgba(16, 185, 129, 0.2)' : '#a7f3d0'}`,
                  marginBottom: '20px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center'
                }}>
                  <Check size={20} style={{ color: '#10b981', flexShrink: 0 }} />
                  <p style={{
                    fontSize: '13px',
                    color: darkMode ? '#6ee7b7' : '#047857',
                    margin: 0
                  }}>{forgotSuccess}</p>
                </div>
              )}

              {/* Error Message */}
              {forgotError && (
                <div style={{
                  padding: '16px',
                  borderRadius: '16px',
                  background: darkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                  border: `1px solid ${darkMode ? 'rgba(239, 68, 68, 0.2)' : '#fecaca'}`,
                  marginBottom: '20px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center'
                }}>
                  <AlertCircle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <p style={{
                    fontSize: '13px',
                    color: darkMode ? '#fca5a5' : '#dc2626',
                    margin: 0
                  }}>{forgotError}</p>
                </div>
              )}

              {/* Email Form */}
              {!forgotSuccess && (
                <form onSubmit={handleForgotPassword}>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: darkMode ? '#94a3b8' : '#64748b',
                      marginBottom: '8px',
                      letterSpacing: '0.5px'
                    }}>
                      Email Address
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={18} style={{
                        position: 'absolute',
                        left: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: darkMode ? '#64748b' : '#94a3b8'
                      }} />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="Enter your email address"
                        style={{
                          width: '100%',
                          padding: '14px 14px 14px 44px',
                          borderRadius: '12px',
                          border: `2px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                          background: darkMode ? '#0f172a' : 'white',
                          color: darkMode ? 'white' : '#1e293b',
                          fontSize: '14px',
                          outline: 'none',
                          transition: 'border-color 0.2s',
                          boxSizing: 'border-box'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                        onBlur={(e) => e.target.style.borderColor = darkMode ? '#334155' : '#e2e8f0'}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      border: 'none',
                      background: isSuperAdminLogin
                        ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                        : 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      cursor: forgotLoading ? 'not-allowed' : 'pointer',
                      opacity: forgotLoading ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: isSuperAdminLogin
                        ? '0 4px 14px rgba(99, 102, 241, 0.4)'
                        : '0 4px 14px rgba(245, 158, 11, 0.4)'
                    }}
                  >
                    {forgotLoading ? (
                      <>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: 'white',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail size={18} />
                        Send Reset Link
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Close button after success */}
              {forgotSuccess && (
                <button
                  onClick={() => setShowForgotModal(false)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    border: `2px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                    background: 'transparent',
                    color: darkMode ? 'white' : '#1e293b',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TenantLogin;
