import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationsAPI } from '../api';
import './Signup.css';

const Signup = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applicationId, setApplicationId] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const [formData, setFormData] = useState({
    businessName: '',
    businessEmail: '',
    businessPhone: '',
    businessAddress: '',
    ownerFullName: '',
    ownerEmail: '',
    ownerPhone: '',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Logo file must be less than 5MB');
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const validateStep1 = () => {
    const newErrors = {};
    if (!formData.businessName.trim()) {
      newErrors.businessName = 'Business name is required';
    }
    if (!formData.businessEmail.trim()) {
      newErrors.businessEmail = 'Business email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.businessEmail)) {
      newErrors.businessEmail = 'Invalid email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!formData.ownerFullName.trim()) {
      newErrors.ownerFullName = 'Full name is required';
    }
    if (!formData.ownerEmail.trim()) {
      newErrors.ownerEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail)) {
      newErrors.ownerEmail = 'Invalid email format';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and number';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
    setError('');
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      // Submit application
      const { confirmPassword, ...submitData } = formData;
      const response = await applicationsAPI.signup(submitData);
      const appId = response.data.applicationId;
      setApplicationId(appId);

      // Upload logo if provided
      if (logoFile) {
        try {
          await applicationsAPI.uploadLogo(appId, logoFile);
        } catch (logoError) {
          console.error('Logo upload failed:', logoError);
          // Continue anyway - logo is optional
        }
      }

      setStep(4); // Success step
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="form-step">
      <h3>Business Information</h3>
      <div className="form-group">
        <label>Business Name *</label>
        <input
          type="text"
          name="businessName"
          value={formData.businessName}
          onChange={handleChange}
          placeholder="Your Business Name"
          className={errors.businessName ? 'error' : ''}
        />
        {errors.businessName && <span className="error-text">{errors.businessName}</span>}
      </div>
      <div className="form-group">
        <label>Business Email *</label>
        <input
          type="email"
          name="businessEmail"
          value={formData.businessEmail}
          onChange={handleChange}
          placeholder="business@example.com"
          className={errors.businessEmail ? 'error' : ''}
        />
        {errors.businessEmail && <span className="error-text">{errors.businessEmail}</span>}
      </div>
      <div className="form-group">
        <label>Business Phone</label>
        <input
          type="tel"
          name="businessPhone"
          value={formData.businessPhone}
          onChange={handleChange}
          placeholder="+1 234 567 8900"
        />
      </div>
      <div className="form-group">
        <label>Business Address</label>
        <textarea
          name="businessAddress"
          value={formData.businessAddress}
          onChange={handleChange}
          placeholder="Street, City, Country"
          rows="3"
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="form-step">
      <h3>Owner / Admin Details</h3>
      <p className="step-description">These credentials will be used to access your POS system</p>
      <div className="form-group">
        <label>Full Name *</label>
        <input
          type="text"
          name="ownerFullName"
          value={formData.ownerFullName}
          onChange={handleChange}
          placeholder="John Doe"
          className={errors.ownerFullName ? 'error' : ''}
        />
        {errors.ownerFullName && <span className="error-text">{errors.ownerFullName}</span>}
      </div>
      <div className="form-group">
        <label>Email *</label>
        <input
          type="email"
          name="ownerEmail"
          value={formData.ownerEmail}
          onChange={handleChange}
          placeholder="owner@example.com"
          className={errors.ownerEmail ? 'error' : ''}
        />
        {errors.ownerEmail && <span className="error-text">{errors.ownerEmail}</span>}
      </div>
      <div className="form-group">
        <label>Phone</label>
        <input
          type="tel"
          name="ownerPhone"
          value={formData.ownerPhone}
          onChange={handleChange}
          placeholder="+1 234 567 8900"
        />
      </div>
      <div className="form-group">
        <label>Password *</label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Min 6 chars, with upper, lower, number"
          className={errors.password ? 'error' : ''}
        />
        {errors.password && <span className="error-text">{errors.password}</span>}
      </div>
      <div className="form-group">
        <label>Confirm Password *</label>
        <input
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="Re-enter your password"
          className={errors.confirmPassword ? 'error' : ''}
        />
        {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="form-step">
      <h3>Business Logo (Optional)</h3>
      <p className="step-description">Upload your business logo to personalize your POS system</p>
      <div className="logo-upload">
        {logoPreview ? (
          <div className="logo-preview">
            <img src={logoPreview} alt="Logo preview" />
            <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); }}>
              Remove
            </button>
          </div>
        ) : (
          <div className="upload-area">
            <input
              type="file"
              id="logo"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleLogoChange}
            />
            <label htmlFor="logo">
              <span className="upload-icon">+</span>
              <span>Click to upload logo</span>
              <span className="upload-hint">JPEG, PNG, GIF, WebP (max 5MB)</span>
            </label>
          </div>
        )}
      </div>

      <div className="review-section">
        <h4>Review Your Application</h4>
        <div className="review-item">
          <strong>Business:</strong> {formData.businessName}
        </div>
        <div className="review-item">
          <strong>Business Email:</strong> {formData.businessEmail}
        </div>
        <div className="review-item">
          <strong>Owner:</strong> {formData.ownerFullName}
        </div>
        <div className="review-item">
          <strong>Owner Email:</strong> {formData.ownerEmail}
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="form-step success-step">
      <div className="success-icon">&#10003;</div>
      <h3>Application Submitted!</h3>
      <p>Your application has been submitted successfully and is pending review.</p>
      <div className="application-id">
        <strong>Application ID:</strong>
        <code>{applicationId}</code>
      </div>
      <p className="note">
        Save this ID to check your application status. You will receive access credentials
        once your application is approved by our team.
      </p>
      <div className="success-actions">
        <button onClick={() => navigate('/application-status', { state: { applicationId } })}>
          Check Status
        </button>
        <Link to="/login" className="link-btn">Back to Login</Link>
      </div>
    </div>
  );

  return (
    <div className="signup-container">
      <div className="signup-card">
        <div className="signup-header">
          <h1>POS System</h1>
          <h2>Business Registration</h2>
        </div>

        {step < 4 && (
          <div className="step-indicator">
            <div className={`step-dot ${step >= 1 ? 'active' : ''}`}>1</div>
            <div className="step-line"></div>
            <div className={`step-dot ${step >= 2 ? 'active' : ''}`}>2</div>
            <div className="step-line"></div>
            <div className={`step-dot ${step >= 3 ? 'active' : ''}`}>3</div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={(e) => e.preventDefault()}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}

          {step < 4 && (
            <div className="form-actions">
              {step > 1 && (
                <button type="button" onClick={handleBack} className="btn-secondary">
                  Back
                </button>
              )}
              {step < 3 ? (
                <button type="button" onClick={handleNext} className="btn-primary">
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Submit Application'}
                </button>
              )}
            </div>
          )}
        </form>

        {step < 4 && (
          <div className="signup-footer">
            Already have an account? <Link to="/login">Sign In</Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Signup;
