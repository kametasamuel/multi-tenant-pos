import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [currentTab, setCurrentTab] = useState('login');
  const [darkMode, setDarkMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const tabsRef = useRef(null);
  const indicatorRef = useRef(null);

  useEffect(() => {
    updateTabIndicator(currentTab);
    window.addEventListener('resize', () => updateTabIndicator(currentTab));
    return () => window.removeEventListener('resize', () => updateTabIndicator(currentTab));
  }, [currentTab]);

  const updateTabIndicator = (tab) => {
    if (!tabsRef.current || !indicatorRef.current) return;
    const tabs = tabsRef.current.querySelectorAll('.tab');
    const index = tab === 'login' ? 0 : 1;
    const tabWidth = tabs[0]?.offsetWidth || 0;
    indicatorRef.current.style.width = `${tabWidth}px`;
    indicatorRef.current.style.left = `${index * (tabWidth + 4) + 4}px`;
  };

  const switchTab = (tab) => {
    if (currentTab === tab) return;
    setError('');
    setCurrentTab(tab);
  };

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);

    if (result.success) {
      if (result.user?.isSuperAdmin) {
        navigate('/super-admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className={`login-container ${darkMode ? 'dark-mode' : ''}`}>
      <button className="theme-toggle" onClick={toggleTheme}>
        {darkMode ? '☀️' : '🌙'}
      </button>

      <div className="login-card">
        <div className="logo-container">
          <div className="logo">🏪</div>
          <div className="logo-text">Smart POS</div>
        </div>

        <div className="tabs" ref={tabsRef}>
          <div className="tab-indicator" ref={indicatorRef}></div>
          <button
            className={`tab ${currentTab === 'login' ? 'active' : ''}`}
            onClick={() => switchTab('login')}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`tab ${currentTab === 'signup' ? 'active' : ''}`}
            onClick={() => switchTab('signup')}
            type="button"
          >
            Sign Up
          </button>
        </div>

        <div className="forms-wrapper">
          {/* Login Form */}
          <form
            className={`auth-form ${currentTab === 'login' ? 'active' : ''}`}
            onSubmit={handleLogin}
          >
            {error && <div className="error-message">{error}</div>}

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
              <div className="password-row">
                <label htmlFor="password">Password</label>
                <Link to="/forgot-password" className="forgot-password">
                  Forgot?
                </Link>
              </div>
              <input
                type="password"
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="login-footer">
              <p>
                <Link to="/application-status">Check application status</Link>
              </p>
            </div>
          </form>

          {/* Signup Tab Content */}
          <div className={`auth-form ${currentTab === 'signup' ? 'active' : ''}`}>
            <div className="signup-intro">
              <p>
                Register your business to get started with Smart POS.
                Our team will review your application and set up your account.
              </p>
              <Link to="/signup" className="btn-primary" style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}>
                Start Registration
              </Link>

              <div className="login-footer" style={{ marginTop: '24px' }}>
                <p style={{ fontSize: '13px', lineHeight: '1.6' }}>
                  Already submitted an application?<br />
                  <Link to="/application-status">Check your status</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
