import React, { useState, useEffect, useRef } from 'react';
import { ownerAPI, IMAGE_BASE_URL } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  Settings as SettingsIcon,
  Building2,
  DollarSign,
  Percent,
  Save,
  RefreshCw,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Upload,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';

const Settings = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass }) => {
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: '',
    currency: '',
    currencySymbol: '',
    taxRate: 0
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Logo upload state
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deletingLogo, setDeletingLogo] = useState(false);
  const logoInputRef = useRef(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await ownerAPI.getSettings();
      setSettings(response.data.settings);
      setFormData({
        businessName: response.data.settings.businessName || '',
        businessType: response.data.settings.businessType || 'RETAIL',
        currency: response.data.settings.currency || 'USD',
        currencySymbol: response.data.settings.currencySymbol || '$',
        taxRate: (response.data.settings.taxRate || 0) * 100 // Convert to percentage
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await ownerAPI.updateSettings({
        businessName: formData.businessName,
        businessType: formData.businessType,
        currency: formData.currency,
        currencySymbol: formData.currencySymbol,
        taxRate: formData.taxRate / 100 // Convert back to decimal
      });
      setSuccess('Settings saved successfully - Currency updated across all pages');
      loadSettings();
      // Refresh user data in AuthContext so currency updates everywhere
      await refreshUser();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setUploadingLogo(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('logo', file);
      await ownerAPI.uploadLogo(formData);
      setSuccess('Logo updated successfully');
      loadSettings();
      await refreshUser();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      // Reset file input
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  const handleLogoDelete = async () => {
    if (!window.confirm('Are you sure you want to delete the business logo?')) return;

    setDeletingLogo(true);
    setError('');

    try {
      await ownerAPI.deleteLogo();
      setSuccess('Logo deleted successfully');
      loadSettings();
      await refreshUser();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to delete logo');
    } finally {
      setDeletingLogo(false);
    }
  };

  const businessTypes = [
    { value: 'RETAIL', label: 'Retail Store' },
    { value: 'RESTAURANT', label: 'Restaurant' },
    { value: 'SALON', label: 'Salon / Spa' },
    { value: 'PHARMACY', label: 'Pharmacy' },
    { value: 'GROCERY', label: 'Grocery Store' },
    { value: 'ELECTRONICS', label: 'Electronics' },
    { value: 'CLOTHING', label: 'Clothing / Fashion' },
    { value: 'OTHER', label: 'Other' }
  ];

  const currencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '\u20AC', name: 'Euro' },
    { code: 'GBP', symbol: '\u00A3', name: 'British Pound' },
    { code: 'GHS', symbol: 'GH\u20B5', name: 'Ghanaian Cedi' },
    { code: 'NGN', symbol: '\u20A6', name: 'Nigerian Naira' },
    { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
    { code: 'INR', symbol: '\u20B9', name: 'Indian Rupee' }
  ];

  const handleCurrencyChange = (code) => {
    const currency = currencies.find(c => c.code === code);
    if (currency) {
      setFormData({
        ...formData,
        currency: currency.code,
        currencySymbol: currency.symbol
      });
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysRemaining = () => {
    if (!settings?.subscriptionEnd) return 0;
    const end = new Date(settings.subscriptionEnd);
    const now = new Date();
    const diff = end - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
      </div>
    );
  }

  const daysRemaining = getDaysRemaining();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black uppercase tracking-tight ${textClass}`}>Business Settings</h1>
          <p className={`text-sm ${mutedClass}`}>Configure your business preferences</p>
        </div>
        <button
          onClick={loadSettings}
          className={`flex items-center gap-2 px-4 py-2.5 border ${borderClass} ${textClass} rounded-xl font-bold text-sm uppercase hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{success}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Subscription Status */}
      <div className={`${surfaceClass} rounded-2xl border ${borderClass} p-6`}>
        <div className="flex items-center gap-3 mb-4">
          <Calendar className={`w-5 h-5 ${mutedClass}`} />
          <h2 className={`text-sm font-black uppercase ${textClass}`}>Subscription Status</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className={`text-xs ${mutedClass} uppercase font-bold mb-1`}>Start Date</p>
            <p className={`text-lg font-bold ${textClass}`}>{settings?.subscriptionStart ? formatDate(settings.subscriptionStart) : '-'}</p>
          </div>
          <div>
            <p className={`text-xs ${mutedClass} uppercase font-bold mb-1`}>End Date</p>
            <p className={`text-lg font-bold ${textClass}`}>{settings?.subscriptionEnd ? formatDate(settings.subscriptionEnd) : '-'}</p>
          </div>
          <div>
            <p className={`text-xs ${mutedClass} uppercase font-bold mb-1`}>Days Remaining</p>
            <p className={`text-lg font-bold ${daysRemaining <= 7 ? 'text-red-500' : daysRemaining <= 30 ? 'text-slate-600' : 'text-green-500'}`}>
              {daysRemaining} days
            </p>
          </div>
        </div>
        {daysRemaining <= 7 && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-600 dark:text-red-400">
              Your subscription is expiring soon. Please contact support to renew.
            </p>
          </div>
        )}
      </div>

      {/* Business Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Business Profile */}
        <div className={`${surfaceClass} rounded-2xl border ${borderClass} p-6`}>
          <div className="flex items-center gap-3 mb-6">
            <Building2 className={`w-5 h-5 ${mutedClass}`} />
            <h2 className={`text-sm font-black uppercase ${textClass}`}>Business Profile</h2>
          </div>

          {/* Logo Section */}
          <div className="mb-6">
            <label className={`block text-xs font-bold uppercase ${mutedClass} mb-3`}>Business Logo</label>
            <div className="flex items-center gap-6">
              {/* Logo Preview */}
              <div className={`w-24 h-24 rounded-2xl border-2 border-dashed ${borderClass} flex items-center justify-center overflow-hidden ${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
                {settings?.businessLogo ? (
                  <img
                    src={`${IMAGE_BASE_URL}${settings.businessLogo}`}
                    alt="Business Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className={`w-8 h-8 ${mutedClass}`} />
                )}
              </div>

              {/* Upload/Delete Buttons */}
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  ref={logoInputRef}
                  onChange={handleLogoUpload}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm uppercase transition-colors ${
                    darkMode
                      ? 'bg-slate-600 hover:bg-slate-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  } disabled:opacity-50`}
                >
                  {uploadingLogo ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                </button>
                {settings?.businessLogo && (
                  <button
                    type="button"
                    onClick={handleLogoDelete}
                    disabled={deletingLogo}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm uppercase text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  >
                    {deletingLogo ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {deletingLogo ? 'Deleting...' : 'Remove'}
                  </button>
                )}
                <p className={`text-xs ${mutedClass}`}>JPEG, PNG, GIF, WebP. Max 5MB</p>
                <p className={`text-xs ${mutedClass}`}>Shows on login page & receipts</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Business Name</label>
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Business Type</label>
              <select
                value={formData.businessType}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
              >
                {businessTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Currency & Tax */}
        <div className={`${surfaceClass} rounded-2xl border ${borderClass} p-6`}>
          <div className="flex items-center gap-3 mb-6">
            <DollarSign className={`w-5 h-5 ${mutedClass}`} />
            <h2 className={`text-sm font-black uppercase ${textClass}`}>Currency & Tax</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
              >
                {currencies.map(c => (
                  <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Currency Symbol</label>
              <input
                type="text"
                value={formData.currencySymbol}
                onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                maxLength={5}
              />
            </div>
            <div>
              <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Tax Rate (%)</label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                  className={`w-full px-4 py-3 pr-10 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                  min="0"
                  max="100"
                  step="0.1"
                />
                <Percent className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
              </div>
              <p className={`text-xs ${mutedClass} mt-1`}>Applied to all sales transactions</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Additional Info */}
      <div className={`${surfaceClass} rounded-2xl border ${borderClass} p-6`}>
        <div className="flex items-center gap-3 mb-4">
          <SettingsIcon className={`w-5 h-5 ${mutedClass}`} />
          <h2 className={`text-sm font-black uppercase ${textClass}`}>Account Information</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
            <p className={`text-xs ${mutedClass} uppercase font-bold mb-1`}>Account ID</p>
            <p className={`text-sm font-mono ${textClass}`}>{settings?.id || '-'}</p>
          </div>
          <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
            <p className={`text-xs ${mutedClass} uppercase font-bold mb-1`}>Account Status</p>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              settings?.isActive
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {settings?.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
