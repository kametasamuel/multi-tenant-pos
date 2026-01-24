import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usersAPI } from '../api';
import {
  LayoutDashboard,
  BarChart3,
  Package,
  Bell,
  Wallet,
  Monitor,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Users,
  UserCheck,
  Calendar,
  Clock,
  Camera,
  Eye,
  EyeOff,
  Save,
  Trash2,
  AlertCircle,
  Check,
  User,
  Lock,
  KeyRound,
  Sparkles,
  Info,
  Briefcase,
  UserCog
} from 'lucide-react';

const ManagerLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({
    username: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const profileImageRef = useRef(null);

  // Get tenant slug for navigation
  const tenantSlug = slug || user?.tenantSlug || '';

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate(`/${tenantSlug}/login`);
  };

  // Profile handlers
  const openProfileModal = () => {
    setProfileData({
      username: user?.username || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setProfileImage(null);
    setProfileImagePreview(user?.profileImage || null);
    setProfileError('');
    setProfileSuccess('');
    setActiveTab('profile');
    setShowProfileModal(true);
  };

  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setProfileError('Image must be less than 5MB');
        return;
      }
      setProfileImage(file);
      setProfileImagePreview(URL.createObjectURL(file));
    }
  };

  const handleUploadProfileImage = async () => {
    if (!profileImage) return;
    setProfileLoading(true);
    setProfileError('');
    try {
      const formData = new FormData();
      formData.append('image', profileImage);
      await usersAPI.uploadProfileImage(formData);
      setProfileSuccess('Profile image updated!');
      setProfileImage(null);
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (error) {
      setProfileError(error.response?.data?.error || 'Failed to upload image');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleDeleteProfileImage = async () => {
    setProfileLoading(true);
    setProfileError('');
    try {
      await usersAPI.deleteProfileImage();
      setProfileImagePreview(null);
      setProfileSuccess('Profile image removed');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (error) {
      setProfileError(error.response?.data?.error || 'Failed to delete image');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileError('');
    setProfileSuccess('');

    if (profileData.newPassword) {
      if (!profileData.currentPassword) {
        setProfileError('Current password is required to change password');
        return;
      }
      if (profileData.newPassword !== profileData.confirmPassword) {
        setProfileError('New passwords do not match');
        return;
      }
      if (profileData.newPassword.length < 6) {
        setProfileError('New password must be at least 6 characters');
        return;
      }
    }

    setProfileLoading(true);
    try {
      const updateData = {};
      if (profileData.username !== user?.username) {
        updateData.username = profileData.username;
      }
      if (profileData.newPassword) {
        updateData.currentPassword = profileData.currentPassword;
        updateData.newPassword = profileData.newPassword;
      }

      if (Object.keys(updateData).length === 0) {
        setProfileError('No changes to save');
        setProfileLoading(false);
        return;
      }

      await usersAPI.updateProfile(updateData);
      setProfileSuccess('Profile updated successfully!');
      setProfileData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (error) {
      setProfileError(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const isActive = (path) => location.pathname === path;

  // Check if this is a services-type business
  const isServicesType = ['SERVICES', 'SALON'].includes(user?.businessType);

  const navLinks = [
    { path: `/${tenantSlug}/manager/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
    { path: `/${tenantSlug}/manager/employees`, label: 'Staff', icon: Users },
    // Commission Tracking - only for SERVICES/SALON business types
    ...(isServicesType ? [{ path: `/${tenantSlug}/manager/attendants`, label: 'Commission', icon: UserCog }] : []),
    { path: `/${tenantSlug}/manager/customers`, label: 'Customers', icon: UserCheck },
    { path: `/${tenantSlug}/manager/sales`, label: 'Shift Revenue', icon: BarChart3 },
    { path: `/${tenantSlug}/manager/inventory`, label: isServicesType ? 'Services' : 'Inventory', icon: isServicesType ? Briefcase : Package },
    { path: `/${tenantSlug}/manager/requests`, label: 'Security Requests', icon: Bell },
    { path: `/${tenantSlug}/manager/expenses`, label: 'Expenses', icon: Wallet }
  ];

  const bgClass = darkMode ? 'bg-slate-900' : 'bg-gray-50';
  const surfaceClass = darkMode ? 'bg-slate-800' : 'bg-white';
  const textClass = darkMode ? 'text-white' : 'text-gray-900';
  const mutedClass = darkMode ? 'text-slate-400' : 'text-gray-500';
  const borderClass = darkMode ? 'border-slate-700' : 'border-gray-200';

  return (
    <div className={`h-screen overflow-hidden flex flex-col ${bgClass} ${textClass}`}>
      {/* Header */}
      <header className={`h-16 sm:h-20 ${surfaceClass} border-b ${borderClass} flex items-center justify-between px-4 sm:px-6 lg:px-12 shrink-0 z-50`}>
        <div className="flex items-center gap-3 sm:gap-5">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`lg:hidden p-2 ${mutedClass} hover:${textClass} rounded-lg`}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className={`w-8 h-8 sm:w-10 sm:h-10 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} rounded-xl flex items-center justify-center shadow-lg`}>
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="hidden sm:block">
            <h1 className={`text-base sm:text-lg font-black tracking-tighter uppercase ${textClass}`}>Branch Manager</h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-accent-500">
              {user?.tenantName} • Operational Hub
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Date/Time Display */}
          <div className={`hidden md:flex items-center gap-3 px-4 py-2 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-xl`}>
            <div className="flex items-center gap-1.5">
              <Calendar className={`w-3.5 h-3.5 ${mutedClass}`} />
              <span className={`text-[10px] font-bold uppercase ${textClass}`}>
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className={`w-px h-4 ${borderClass}`}></div>
            <div className="flex items-center gap-1.5">
              <Clock className={`w-3.5 h-3.5 ${mutedClass}`} />
              <span className={`text-[10px] font-bold uppercase ${textClass}`}>
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`w-8 h-8 sm:w-10 sm:h-10 border ${borderClass} rounded-xl flex items-center justify-center ${surfaceClass} ${textClass} transition-all`}
          >
            {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
          <button
            onClick={openProfileModal}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-accent-500 bg-slate-100 overflow-hidden hover:ring-2 hover:ring-accent-300 transition-all"
            title="Edit Profile"
          >
            {user?.profileImage ? (
              <img src={user.profileImage} alt={user.fullName} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full ${darkMode ? 'bg-slate-700' : 'bg-slate-200'} flex items-center justify-center text-xs font-bold`}>
                {user?.fullName?.charAt(0) || 'M'}
              </div>
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Desktop */}
        <aside className={`hidden lg:flex ${sidebarCollapsed ? 'w-20' : 'w-72'} border-r ${borderClass} ${surfaceClass} p-4 sm:p-6 flex-col gap-2 shrink-0 transition-all duration-300`}>
          <div className="flex items-center justify-between mb-4">
            {!sidebarCollapsed && (
              <p className={`text-[10px] font-black uppercase ${mutedClass} px-4 tracking-widest leading-none`}>Management</p>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`p-2 ${mutedClass} hover:${textClass} rounded-lg`}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          <nav className="space-y-1 flex-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl text-xs font-bold uppercase transition-all ${
                    isActive(link.path)
                      ? darkMode ? 'bg-white text-black shadow-lg' : 'bg-slate-900 text-white shadow-lg'
                      : `${mutedClass} hover:${textClass} hover:bg-slate-100 dark:hover:bg-slate-700`
                  }`}
                  title={sidebarCollapsed ? link.label : ''}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>{link.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-2">
            {!sidebarCollapsed && (
              <p className={`text-[10px] font-black uppercase ${mutedClass} px-4 tracking-widest leading-none mb-2`}>Quick Access</p>
            )}
            <Link
              to={`/${tenantSlug}/manager/pos`}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-xs font-black uppercase shadow-lg transition-colors bg-accent-500 text-white hover:bg-accent-600"
              title={sidebarCollapsed ? 'Launch POS' : ''}
            >
              <Monitor className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Launch POS</span>}
            </Link>
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-xs font-bold uppercase ${mutedClass} hover:text-negative-500 hover:bg-negative-50 dark:hover:bg-red-900/20 transition-colors`}
              title={sidebarCollapsed ? 'Logout' : ''}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </aside>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
            <div
              className={`w-72 h-full ${surfaceClass} pt-20 sm:pt-24 p-6 flex flex-col gap-2`}
              onClick={(e) => e.stopPropagation()}
            >
              <p className={`text-[10px] font-black uppercase ${mutedClass} px-4 tracking-widest leading-none mb-4`}>Management</p>

              <nav className="space-y-1 flex-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl text-xs font-bold uppercase transition-all ${
                        isActive(link.path)
                          ? darkMode ? 'bg-white text-black shadow-lg' : 'bg-slate-900 text-white shadow-lg'
                          : `${mutedClass} hover:${textClass} hover:bg-slate-100`
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-auto space-y-2">
                <p className={`text-[10px] font-black uppercase ${mutedClass} px-4 tracking-widest leading-none mb-2`}>Quick Access</p>
                <Link
                  to={`/${tenantSlug}/manager/pos`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-xs font-black uppercase shadow-lg bg-accent-500 text-white hover:bg-accent-600"
                >
                  <Monitor className="w-4 h-4" />
                  <span>Launch POS</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-xs font-bold uppercase ${mutedClass} hover:text-negative-500`}
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10" style={{ scrollbarWidth: 'thin' }}>
          {React.cloneElement(children, { darkMode, surfaceClass, textClass, mutedClass, borderClass, bgClass })}
        </main>
      </div>

      {/* Premium Manager Profile Modal */}
      {showProfileModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          onClick={() => setShowProfileModal(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" />

          {/* Modal */}
          <div
            className={`relative w-full max-w-2xl ${surfaceClass} rounded-3xl shadow-2xl border ${borderClass} max-h-[90vh] overflow-hidden flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Premium Header with Gradient */}
            <div className="relative overflow-hidden">
              <div className={`absolute inset-0 ${darkMode ? 'bg-gradient-to-br from-emerald-600 via-teal-500 to-cyan-500' : 'bg-gradient-to-br from-emerald-500 via-teal-400 to-cyan-400'}`} />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />

              <div className="relative px-6 sm:px-8 pt-6 sm:pt-8 pb-20 sm:pb-24">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Manager Profile</h2>
                      <p className="text-white/70 text-xs sm:text-sm font-medium">{user?.tenantName}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowProfileModal(false)}
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="absolute top-4 right-24 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute bottom-8 left-8 w-32 h-32 bg-cyan-400/20 rounded-full blur-3xl" />
              </div>

              {/* Profile Image */}
              <div className="absolute -bottom-16 sm:-bottom-20 left-1/2 -translate-x-1/2">
                <div className="relative group">
                  <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-3xl border-4 ${darkMode ? 'border-slate-800' : 'border-white'} shadow-2xl overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-500`}>
                    {profileImagePreview ? (
                      <img src={profileImagePreview} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl sm:text-5xl font-black text-white">
                          {user?.fullName?.charAt(0) || 'M'}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => profileImageRef.current?.click()}
                    className="absolute -bottom-2 -right-2 w-12 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/50 flex items-center justify-center transition-all hover:scale-110"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                  <input
                    type="file"
                    ref={profileImageRef}
                    onChange={handleProfileImageChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-emerald-400 flex items-center justify-center shadow-lg">
                    <Sparkles className="w-4 h-4 text-emerald-900" />
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="pt-20 sm:pt-24 px-4 sm:px-8 pb-6 sm:pb-8 overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin' }}>
              {/* Image actions */}
              {profileImage && (
                <div className="flex justify-center gap-3 mb-6">
                  <button
                    onClick={handleUploadProfileImage}
                    disabled={profileLoading}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25 disabled:opacity-50 flex items-center gap-2 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    {profileLoading ? 'Uploading...' : 'Save Image'}
                  </button>
                  <button
                    onClick={() => {
                      setProfileImage(null);
                      setProfileImagePreview(user?.profileImage || null);
                    }}
                    className={`px-5 py-2.5 ${surfaceClass} border ${borderClass} rounded-xl text-sm font-bold ${textClass} hover:bg-slate-100 dark:hover:bg-slate-700 transition-all`}
                  >
                    Cancel
                  </button>
                </div>
              )}
              {profileImagePreview && !profileImage && user?.profileImage && (
                <div className="flex justify-center mb-6">
                  <button
                    onClick={handleDeleteProfileImage}
                    disabled={profileLoading}
                    className="px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove Image
                  </button>
                </div>
              )}

              {/* Messages */}
              {profileError && (
                <div className="mb-6 p-4 rounded-2xl bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  </div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">{profileError}</p>
                </div>
              )}
              {profileSuccess && (
                <div className="mb-6 p-4 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{profileSuccess}</p>
                </div>
              )}

              {/* Tab Navigation */}
              <div className={`flex gap-2 p-1.5 rounded-2xl ${darkMode ? 'bg-slate-700/50' : 'bg-slate-100'} mb-6`}>
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${
                    activeTab === 'profile'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                      : `${textClass} hover:bg-white dark:hover:bg-slate-600`
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">Profile Info</span>
                  <span className="sm:hidden">Profile</span>
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${
                    activeTab === 'security'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                      : `${textClass} hover:bg-white dark:hover:bg-slate-600`
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <span>Security</span>
                </button>
              </div>

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="space-y-5">
                  {/* Full Name - Read Only */}
                  <div>
                    <label className={`text-xs font-bold uppercase ${mutedClass} block mb-2 flex items-center gap-2`}>
                      <User className="w-3.5 h-3.5" />
                      Full Name
                      <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`}>Read Only</span>
                    </label>
                    <input
                      type="text"
                      value={user?.fullName || ''}
                      disabled
                      className={`w-full px-4 py-3.5 rounded-xl border-2 ${borderClass} ${darkMode ? 'bg-slate-700/50' : 'bg-slate-100'} ${mutedClass} cursor-not-allowed`}
                    />
                    <div className={`mt-2 p-3 rounded-xl ${darkMode ? 'bg-blue-900/30 border-blue-700/50' : 'bg-blue-50 border-blue-200'} border flex items-start gap-2`}>
                      <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <p className={`text-xs ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                        Your name is managed by the business owner. Contact them to request a name change.
                      </p>
                    </div>
                  </div>

                  {/* Username */}
                  <div>
                    <label className={`text-xs font-bold uppercase ${mutedClass} block mb-2 flex items-center gap-2`}>
                      <span className="text-emerald-500">@</span>
                      Username
                    </label>
                    <input
                      type="text"
                      value={profileData.username}
                      onChange={(e) => setProfileData(prev => ({ ...prev, username: e.target.value }))}
                      className={`w-full px-4 py-3.5 rounded-xl border-2 ${borderClass} ${surfaceClass} ${textClass} focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none`}
                      placeholder="Enter username"
                    />
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div className="space-y-5">
                  {/* Security Notice */}
                  <div className={`p-4 rounded-2xl ${darkMode ? 'bg-emerald-900/30 border-emerald-700/50' : 'bg-emerald-50 border-emerald-200'} border flex items-start gap-4`}>
                    <div className={`w-10 h-10 rounded-xl ${darkMode ? 'bg-emerald-600/30' : 'bg-emerald-100'} flex items-center justify-center shrink-0`}>
                      <KeyRound className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${darkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>Password Security</p>
                      <p className={`text-xs ${darkMode ? 'text-emerald-400/80' : 'text-emerald-700'} mt-1`}>
                        Use a strong password with at least 6 characters to protect your account.
                      </p>
                    </div>
                  </div>

                  {/* Current Password */}
                  <div>
                    <label className={`text-xs font-bold uppercase ${mutedClass} block mb-2`}>Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={profileData.currentPassword}
                        onChange={(e) => setProfileData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        className={`w-full px-4 py-3.5 pr-12 rounded-xl border-2 ${borderClass} ${surfaceClass} ${textClass} focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none`}
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg ${mutedClass} hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors`}
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className={`text-xs font-bold uppercase ${mutedClass} block mb-2`}>New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={profileData.newPassword}
                        onChange={(e) => setProfileData(prev => ({ ...prev, newPassword: e.target.value }))}
                        className={`w-full px-4 py-3.5 pr-12 rounded-xl border-2 ${borderClass} ${surfaceClass} ${textClass} focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none`}
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg ${mutedClass} hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors`}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className={`text-xs font-bold uppercase ${mutedClass} block mb-2`}>Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={profileData.confirmPassword}
                        onChange={(e) => setProfileData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className={`w-full px-4 py-3.5 pr-12 rounded-xl border-2 ${profileData.confirmPassword && profileData.newPassword !== profileData.confirmPassword ? 'border-red-500' : borderClass} ${surfaceClass} ${textClass} focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none`}
                        placeholder="Confirm new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg ${mutedClass} hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors`}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {profileData.confirmPassword && profileData.newPassword !== profileData.confirmPassword && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Passwords do not match
                      </p>
                    )}
                    {profileData.confirmPassword && profileData.newPassword === profileData.confirmPassword && profileData.newPassword && (
                      <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Passwords match
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`px-4 sm:px-8 py-4 sm:py-5 border-t ${borderClass} flex flex-col sm:flex-row items-center justify-end gap-3 ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
              <button
                onClick={() => setShowProfileModal(false)}
                className={`w-full sm:w-auto px-6 py-3 ${surfaceClass} border ${borderClass} rounded-xl text-sm font-bold ${textClass} hover:bg-slate-100 dark:hover:bg-slate-700 transition-all`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={profileLoading}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
              >
                {profileLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerLayout;
