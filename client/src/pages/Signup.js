import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applicationsAPI } from '../api';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  User,
  Lock,
  Upload,
  Check,
  ChevronRight,
  ChevronLeft,
  Store,
  Utensils,
  Hotel,
  Scissors,
  Copy,
  ExternalLink,
  Eye,
  EyeOff
} from 'lucide-react';

const businessTypes = [
  {
    value: 'RETAIL',
    label: 'Retail',
    icon: Store,
    description: 'Shops, electronics, groceries, pharmacy, clothing & general merchandise',
    features: ['Inventory Management', 'Barcode Scanning', 'Stock Alerts', 'Supplier Management']
  },
  {
    value: 'FOOD_AND_BEVERAGE',
    label: 'Food & Beverage',
    icon: Utensils,
    description: 'Restaurants, cafes, bars, quick service & food trucks',
    features: ['Table Management', 'Kitchen Display', 'Menu Modifiers', 'Split Bills']
  },
  {
    value: 'HOSPITALITY',
    label: 'Hospitality',
    icon: Hotel,
    description: 'Hotels, lodges, guest houses, rentals & vacation properties',
    features: ['Room Management', 'Reservations', 'Housekeeping', 'Guest Folios']
  },
  {
    value: 'SERVICES',
    label: 'Services',
    icon: Scissors,
    description: 'Salons, spas, auto repair, laundry & professional services',
    features: ['Appointment Booking', 'Staff Scheduling', 'Commission Tracking', 'Client History']
  }
];

const Signup = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applicationId, setApplicationId] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    businessName: '',
    businessType: '',
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

  const handleBusinessTypeSelect = (type) => {
    setFormData(prev => ({ ...prev, businessType: type }));
    if (errors.businessType) {
      setErrors(prev => ({ ...prev, businessType: '' }));
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
    if (!formData.businessType) {
      newErrors.businessType = 'Please select a business type';
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
      const { confirmPassword, ...submitData } = formData;
      const response = await applicationsAPI.signup(submitData);
      const appId = response.data.applicationId;
      setApplicationId(appId);

      if (logoFile) {
        try {
          await applicationsAPI.uploadLogo(appId, logoFile);
        } catch (logoError) {
          console.error('Logo upload failed:', logoError);
        }
      }

      setStep(4);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(applicationId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSelectedBusinessType = () => {
    return businessTypes.find(t => t.value === formData.businessType);
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Business Information</h3>
        <p className="text-sm text-gray-500">Tell us about your business</p>
      </div>

      {/* Business Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Business Name <span className="text-negative-500">*</span>
        </label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            name="businessName"
            value={formData.businessName}
            onChange={handleChange}
            placeholder="Your Business Name"
            className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors ${
              errors.businessName ? 'border-negative-500 bg-negative-50' : 'border-gray-300'
            }`}
          />
        </div>
        {errors.businessName && <p className="mt-1 text-sm text-negative-500">{errors.businessName}</p>}
      </div>

      {/* Business Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          What type of business do you run? <span className="text-negative-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {businessTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = formData.businessType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => handleBusinessTypeSelect(type.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                      {type.label}
                    </p>
                    <p className={`text-xs mt-0.5 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                      {type.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {type.features.slice(0, 2).map((feature, idx) => (
                        <span
                          key={idx}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {feature}
                        </span>
                      ))}
                      {type.features.length > 2 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          +{type.features.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {errors.businessType && <p className="mt-2 text-sm text-negative-500">{errors.businessType}</p>}
      </div>

      {/* Business Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Business Email <span className="text-negative-500">*</span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="email"
            name="businessEmail"
            value={formData.businessEmail}
            onChange={handleChange}
            placeholder="business@example.com"
            className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors ${
              errors.businessEmail ? 'border-negative-500 bg-negative-50' : 'border-gray-300'
            }`}
          />
        </div>
        {errors.businessEmail && <p className="mt-1 text-sm text-negative-500">{errors.businessEmail}</p>}
      </div>

      {/* Business Phone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Business Phone
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="tel"
            name="businessPhone"
            value={formData.businessPhone}
            onChange={handleChange}
            placeholder="+1 234 567 8900"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          />
        </div>
      </div>

      {/* Business Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Business Address
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <textarea
            name="businessAddress"
            value={formData.businessAddress}
            onChange={handleChange}
            placeholder="Street, City, Country"
            rows="3"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-none"
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Owner Details</h3>
        <p className="text-sm text-gray-500">These credentials will be used to access your POS system</p>
      </div>

      {/* Full Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Full Name <span className="text-negative-500">*</span>
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            name="ownerFullName"
            value={formData.ownerFullName}
            onChange={handleChange}
            placeholder="John Doe"
            className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors ${
              errors.ownerFullName ? 'border-negative-500 bg-negative-50' : 'border-gray-300'
            }`}
          />
        </div>
        {errors.ownerFullName && <p className="mt-1 text-sm text-negative-500">{errors.ownerFullName}</p>}
      </div>

      {/* Owner Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Email <span className="text-negative-500">*</span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="email"
            name="ownerEmail"
            value={formData.ownerEmail}
            onChange={handleChange}
            placeholder="owner@example.com"
            className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors ${
              errors.ownerEmail ? 'border-negative-500 bg-negative-50' : 'border-gray-300'
            }`}
          />
        </div>
        {errors.ownerEmail && <p className="mt-1 text-sm text-negative-500">{errors.ownerEmail}</p>}
      </div>

      {/* Owner Phone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Phone
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="tel"
            name="ownerPhone"
            value={formData.ownerPhone}
            onChange={handleChange}
            placeholder="+1 234 567 8900"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Password <span className="text-negative-500">*</span>
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Min 6 chars, with upper, lower, number"
            className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors ${
              errors.password ? 'border-negative-500 bg-negative-50' : 'border-gray-300'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {errors.password && <p className="mt-1 text-sm text-negative-500">{errors.password}</p>}
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Confirm Password <span className="text-negative-500">*</span>
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Re-enter your password"
            className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors ${
              errors.confirmPassword ? 'border-negative-500 bg-negative-50' : 'border-gray-300'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {errors.confirmPassword && <p className="mt-1 text-sm text-negative-500">{errors.confirmPassword}</p>}
      </div>
    </div>
  );

  const renderStep3 = () => {
    const selectedType = getSelectedBusinessType();
    const TypeIcon = selectedType?.icon || Building2;

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Review & Submit</h3>
          <p className="text-sm text-gray-500">Review your information before submitting</p>
        </div>

        {/* Logo Upload */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Business Logo (Optional)
          </label>
          {logoPreview ? (
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <img src={logoPreview} alt="Logo preview" className="w-16 h-16 object-contain rounded-lg bg-white" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{logoFile?.name}</p>
                <p className="text-xs text-gray-500">{(logoFile?.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                type="button"
                onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                className="px-3 py-1.5 text-sm text-negative-600 hover:bg-negative-50 rounded-lg transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
              <Upload className="w-10 h-10 text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-700">Click to upload logo</p>
              <p className="text-xs text-gray-500 mt-1">JPEG, PNG, GIF, WebP (max 5MB)</p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleLogoChange}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Review Information */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-200">
          <div className="p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Business Information</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Business Name</span>
                <span className="text-sm font-medium text-gray-900">{formData.businessName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Business Type</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  <TypeIcon className="w-3.5 h-3.5" />
                  {selectedType?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Email</span>
                <span className="text-sm font-medium text-gray-900">{formData.businessEmail}</span>
              </div>
              {formData.businessPhone && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Phone</span>
                  <span className="text-sm font-medium text-gray-900">{formData.businessPhone}</span>
                </div>
              )}
            </div>
          </div>
          <div className="p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Owner Information</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Full Name</span>
                <span className="text-sm font-medium text-gray-900">{formData.ownerFullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Email</span>
                <span className="text-sm font-medium text-gray-900">{formData.ownerEmail}</span>
              </div>
              {formData.ownerPhone && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Phone</span>
                  <span className="text-sm font-medium text-gray-900">{formData.ownerPhone}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStep4 = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-positive-100 rounded-full flex items-center justify-center mx-auto">
        <Check className="w-8 h-8 text-positive-600" />
      </div>
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Application Submitted!</h3>
        <p className="text-gray-500">Your application has been submitted and is pending review.</p>
      </div>

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <p className="text-sm text-gray-500 mb-2">Application ID</p>
        <div className="flex items-center justify-center gap-2">
          <code className="text-lg font-mono font-semibold text-gray-900">{applicationId}</code>
          <button
            onClick={copyToClipboard}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Copy to clipboard"
          >
            {copied ? <Check className="w-4 h-4 text-positive-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
        Save this ID to check your application status. You will receive access credentials once your application is approved.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => navigate('/application-status', { state: { applicationId } })}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <ExternalLink className="w-4 h-4" />
          Check Status
        </button>
        <Link
          to="/"
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-accent-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-accent-600 px-6 py-8 text-center">
            <h1 className="text-2xl font-bold text-white mb-1">Smart POS</h1>
            <p className="text-blue-100">Business Registration</p>
          </div>

          {/* Step Indicator */}
          {step < 4 && (
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3].map((num) => (
                  <React.Fragment key={num}>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                        step >= num
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {step > num ? <Check className="w-4 h-4" /> : num}
                    </div>
                    {num < 3 && (
                      <div
                        className={`w-12 h-1 rounded-full transition-colors ${
                          step > num ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>Business</span>
                <span>Owner</span>
                <span>Review</span>
              </div>
            </div>
          )}

          {/* Form Content */}
          <div className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-negative-50 border border-negative-200 rounded-lg text-negative-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={(e) => e.preventDefault()}>
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}

              {step < 4 && (
                <div className="flex gap-3 mt-8">
                  {step > 1 && (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                  )}
                  {step < 3 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          Submit Application
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </form>

            {step < 4 && (
              <p className="text-center text-sm text-gray-500 mt-6">
                Already have an account? Use your business URL to sign in.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
