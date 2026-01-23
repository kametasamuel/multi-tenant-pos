import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { usersAPI } from '../api';
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Building2,
  Activity,
  FileText,
  Settings,
  Monitor,
  LogOut,
  Menu,
  X,
  Crown,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Package,
  Bell,
  Wallet,
  UserCheck,
  ChevronDown,
  Check,
  Globe,
  Camera,
  Eye,
  EyeOff,
  Save,
  Trash2,
  AlertCircle,
  User,
  Lock,
  Mail,
  Phone,
  KeyRound,
  Sparkles
} from 'lucide-react';

const OwnerLayout = ({ children }) => {
  const { user, logout, isImpersonating } = useAuth();
  const { branches, currentBranch, switchBranch, switchToAllBranches, isAllBranches, getActiveBranches } = useBranch();
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [showPOSBranchModal, setShowPOSBranchModal] = useState(false);

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
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

  // Handle Launch POS click - show branch selector if in All Branches mode
  const handleLaunchPOS = () => {
    if (isAllBranches) {
      setShowPOSBranchModal(true);
    } else {
      navigate(`/${tenantSlug}/owner/pos`);
    }
  };

  // Navigate to POS with selected branch
  const launchPOSForBranch = (branch) => {
    switchBranch(branch);
    setShowPOSBranchModal(false);
    setMobileMenuOpen(false);
    navigate(`/${tenantSlug}/owner/pos`);
  };

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.branch-dropdown')) {
        setBranchDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate(`/${tenantSlug}/login`);
  };

  // Profile handlers
  const openProfileModal = () => {
    setProfileData({
      fullName: user?.fullName || '',
      username: user?.username || '',
      email: user?.email || '',
      phone: user?.phone || '',
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
      // Refresh user data would be ideal here
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

    // Validate passwords if changing
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
      if (profileData.fullName !== user?.fullName) {
        updateData.fullName = profileData.fullName;
      }
      if (profileData.username !== user?.username) {
        updateData.username = profileData.username;
      }
      if (profileData.email !== (user?.email || '')) {
        updateData.email = profileData.email;
      }
      if (profileData.phone !== (user?.phone || '')) {
        updateData.phone = profileData.phone;
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
      setTimeout(() => {
        setProfileSuccess('');
      }, 3000);
    } catch (error) {
      setProfileError(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const isActive = (path) => location.pathname === path;

  // Full navigation - Owner has access to everything
  const navLinks = [
    { path: `/${tenantSlug}/owner/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
    { path: `/${tenantSlug}/owner/sales`, label: 'Sales & Revenue', icon: BarChart3 },
    { path: `/${tenantSlug}/owner/inventory`, label: 'Inventory', icon: Package },
    { path: `/${tenantSlug}/owner/staff`, label: 'Staff', icon: Users },
    { path: `/${tenantSlug}/owner/customers`, label: 'Customers', icon: UserCheck },
    { path: `/${tenantSlug}/owner/requests`, label: 'Void Requests', icon: Bell },
    { path: `/${tenantSlug}/owner/expenses`, label: 'Expenses', icon: Wallet },
    { path: `/${tenantSlug}/owner/activity`, label: 'Activity Logs', icon: Activity },
    { path: `/${tenantSlug}/owner/reports`, label: 'Reports', icon: FileText },
    { path: `/${tenantSlug}/owner/branches`, label: 'Branches', icon: Building2 },
    { path: `/${tenantSlug}/owner/settings`, label: 'Settings', icon: Settings }
  ];

  const bgClass = darkMode ? 'bg-slate-900' : 'bg-gray-50';
  const surfaceClass = darkMode ? 'bg-slate-800' : 'bg-white';
  const textClass = darkMode ? 'text-white' : 'text-gray-900';
  const mutedClass = darkMode ? 'text-slate-400' : 'text-gray-500';
  const borderClass = darkMode ? 'border-slate-700' : 'border-gray-200';

  const activeBranches = getActiveBranches();

  return (
    <div className={`h-screen overflow-hidden flex flex-col ${bgClass} ${textClass}`}>
      {/* Header */}
      <header className={`h-16 sm:h-20 ${surfaceClass} border-b ${borderClass} flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 z-50`}>
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`lg:hidden p-2 ${mutedClass} hover:${textClass} rounded-lg`}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className={`w-8 h-8 sm:w-10 sm:h-10 ${darkMode ? 'bg-slate-700 text-amber-400' : 'bg-slate-800 text-amber-300'} rounded-xl flex items-center justify-center shadow-lg`}>
            <Crown className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="hidden sm:block">
            <h1 className={`text-base sm:text-lg font-black tracking-tighter uppercase ${textClass}`}>Owner Portal</h1>
            <p className={`text-[9px] font-bold uppercase tracking-widest ${darkMode ? 'text-amber-400' : 'text-slate-500'}`}>
              {user?.tenantName}
            </p>
          </div>
        </div>

        {/* Branch Selector */}
        <div className="relative branch-dropdown">
          <button
            onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors`}
          >
            <Building2 className={`w-4 h-4 ${darkMode ? 'text-amber-400' : 'text-slate-600'}`} />
            <span className="text-sm font-bold truncate max-w-[120px] sm:max-w-[200px]">
              {isAllBranches ? 'All Branches' : currentBranch?.name || 'Select Branch'}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${branchDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {branchDropdownOpen && (
            <div className={`absolute top-full mt-2 right-0 w-64 ${surfaceClass} rounded-xl border ${borderClass} shadow-xl z-50 overflow-hidden`}>
              <div className={`px-4 py-2 border-b ${borderClass}`}>
                <p className={`text-xs font-bold uppercase ${mutedClass}`}>Switch Branch</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {/* All Branches Option */}
                <button
                  onClick={() => {
                    switchToAllBranches();
                    setBranchDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${isAllBranches ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                >
                  <Globe className={`w-4 h-4 ${isAllBranches ? 'text-slate-700 dark:text-amber-400' : mutedClass}`} />
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-bold ${textClass}`}>All Branches</p>
                    <p className={`text-xs ${mutedClass}`}>View combined data</p>
                  </div>
                  {isAllBranches && <Check className="w-4 h-4 text-slate-700 dark:text-amber-400" />}
                </button>

                {/* Individual Branches */}
                {activeBranches.map(branch => (
                  <button
                    key={branch.id}
                    onClick={() => {
                      switchBranch(branch.id);
                      setBranchDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${currentBranch?.id === branch.id ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                  >
                    <Building2 className={`w-4 h-4 ${currentBranch?.id === branch.id ? 'text-slate-700 dark:text-amber-400' : mutedClass}`} />
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-bold ${textClass}`}>{branch.name}</p>
                        {branch.isMain && (
                          <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 text-[9px] font-bold uppercase rounded">
                            Main
                          </span>
                        )}
                      </div>
                      <p className={`text-xs ${mutedClass}`}>{branch._count?.users || 0} staff</p>
                    </div>
                    {currentBranch?.id === branch.id && <Check className="w-4 h-4 text-slate-700 dark:text-amber-400" />}
                  </button>
                ))}
              </div>
              <div className={`px-4 py-2 border-t ${borderClass}`}>
                <Link
                  to={`/${tenantSlug}/owner/branches`}
                  onClick={() => setBranchDropdownOpen(false)}
                  className={`text-xs ${darkMode ? 'text-amber-400' : 'text-slate-600'} hover:underline font-bold uppercase`}
                >
                  Manage Branches
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Date/Time Display */}
          <div className={`hidden lg:flex items-center gap-3 px-4 py-2 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-xl`}>
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
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
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
            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 ${darkMode ? 'border-amber-400' : 'border-slate-400'} bg-slate-100 overflow-hidden hover:ring-2 hover:ring-amber-300 transition-all`}
            title="Edit Profile"
          >
            {user?.profileImage ? (
              <img src={user.profileImage} alt={user.fullName} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full ${darkMode ? 'bg-slate-700' : 'bg-slate-200'} flex items-center justify-center text-xs font-bold`}>
                {user?.fullName?.charAt(0) || 'O'}
              </div>
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Desktop */}
        <aside className={`hidden lg:flex ${sidebarCollapsed ? 'w-20' : 'w-64'} border-r ${borderClass} ${surfaceClass} p-4 flex-col gap-1 shrink-0 transition-all duration-300`}>
          <div className="flex items-center justify-between mb-2">
            {!sidebarCollapsed && (
              <p className={`text-[10px] font-black uppercase ${mutedClass} px-3 tracking-widest leading-none`}>Business Control</p>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`p-2 ${mutedClass} hover:${textClass} rounded-lg`}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          <nav className="space-y-0.5 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase transition-all ${
                    isActive(link.path)
                      ? darkMode ? 'bg-slate-700 text-amber-400 shadow-lg' : 'bg-slate-800 text-white shadow-lg'
                      : `${mutedClass} hover:${textClass} hover:bg-gray-100 dark:hover:bg-slate-700`
                  }`}
                  title={sidebarCollapsed ? link.label : ''}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{link.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-1 pt-2 border-t border-dashed dark:border-slate-600">
            {!sidebarCollapsed && (
              <p className={`text-[10px] font-black uppercase ${mutedClass} px-3 tracking-widest leading-none mb-2`}>Quick Access</p>
            )}
            <button
              onClick={handleLaunchPOS}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-black uppercase shadow-lg transition-colors bg-accent-500 text-white hover:bg-accent-600"
              title={sidebarCollapsed ? 'Launch POS' : ''}
            >
              <Monitor className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Launch POS</span>}
            </button>
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase ${mutedClass} hover:text-negative-500 hover:bg-negative-50 dark:hover:bg-red-900/20 transition-colors`}
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
              className={`w-72 h-full ${surfaceClass} pt-20 sm:pt-24 p-4 flex flex-col gap-1 overflow-y-auto`}
              onClick={(e) => e.stopPropagation()}
            >
              <p className={`text-[10px] font-black uppercase ${mutedClass} px-3 tracking-widest leading-none mb-2`}>Business Control</p>

              <nav className="space-y-0.5 flex-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase transition-all ${
                        isActive(link.path)
                          ? darkMode ? 'bg-slate-700 text-amber-400 shadow-lg' : 'bg-slate-800 text-white shadow-lg'
                          : `${mutedClass} hover:${textClass} hover:bg-gray-100`
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-auto space-y-1 pt-2 border-t border-dashed dark:border-slate-600">
                <p className={`text-[10px] font-black uppercase ${mutedClass} px-3 tracking-widest leading-none mb-2`}>Quick Access</p>
                <button
                  onClick={handleLaunchPOS}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-black uppercase shadow-lg bg-accent-500 text-white hover:bg-accent-600"
                >
                  <Monitor className="w-4 h-4" />
                  <span>Launch POS</span>
                </button>
                <button
                  onClick={handleLogout}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase ${mutedClass} hover:text-negative-500`}
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Impersonation Banner */}
        {isImpersonating && (
          <div className="bg-amber-500 text-amber-900 px-4 py-2 text-center text-sm font-bold flex items-center justify-center gap-2">
            <UserCheck className="w-4 h-4" />
            <span>Admin Impersonation Mode - Actions are being logged</span>
            <button
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('isImpersonating');
                window.close();
              }}
              className="ml-4 px-3 py-1 bg-amber-700 text-white rounded-lg text-xs hover:bg-amber-800"
            >
              Exit Session
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8" style={{ scrollbarWidth: 'thin' }}>
          {React.cloneElement(children, {
            darkMode,
            surfaceClass,
            textClass,
            mutedClass,
            borderClass,
            bgClass,
            currentBranch,
            isAllBranches,
            branches: getActiveBranches()
          })}
        </main>
      </div>

      {/* POS Branch Selection Modal */}
      {showPOSBranchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPOSBranchModal(false)}>
          <div
            className={`${surfaceClass} w-full max-w-md rounded-[32px] p-6 sm:p-8 shadow-2xl border ${borderClass}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className={`w-16 h-16 mx-auto rounded-2xl ${darkMode ? 'bg-accent-500/20' : 'bg-accent-50'} flex items-center justify-center mb-4`}>
                <Monitor className="w-8 h-8 text-accent-500" />
              </div>
              <h2 className={`text-xl font-black uppercase ${textClass}`}>Select Branch for POS</h2>
              <p className={`text-sm ${mutedClass} mt-2`}>Choose which branch you want to operate the POS terminal for</p>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activeBranches.map((branch) => (
                <button
                  key={branch.id}
                  onClick={() => launchPOSForBranch(branch)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border ${borderClass} hover:border-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-all text-left group`}
                >
                  <div className={`w-12 h-12 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} flex items-center justify-center group-hover:bg-accent-100 dark:group-hover:bg-accent-900/30 transition-colors`}>
                    <Building2 className={`w-6 h-6 ${mutedClass} group-hover:text-accent-500`} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold ${textClass}`}>{branch.name}</p>
                    {branch.isMain && (
                      <span className="text-[10px] font-bold uppercase text-accent-500">Main Branch</span>
                    )}
                  </div>
                  <ChevronRight className={`w-5 h-5 ${mutedClass} group-hover:text-accent-500 transition-colors`} />
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowPOSBranchModal(false)}
              className={`w-full mt-4 py-3 rounded-xl text-sm font-bold ${mutedClass} hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Premium Owner Profile Modal */}
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
              <div className={`absolute inset-0 ${darkMode ? 'bg-gradient-to-br from-amber-600 via-orange-500 to-rose-500' : 'bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400'}`} />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />

              <div className="relative px-6 sm:px-8 pt-6 sm:pt-8 pb-20 sm:pb-24">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Owner Profile</h2>
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
                <div className="absolute bottom-8 left-8 w-32 h-32 bg-rose-400/20 rounded-full blur-3xl" />
              </div>

              {/* Profile Image */}
              <div className="absolute -bottom-16 sm:-bottom-20 left-1/2 -translate-x-1/2">
                <div className="relative group">
                  <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-3xl border-4 ${darkMode ? 'border-slate-800' : 'border-white'} shadow-2xl overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500`}>
                    {profileImagePreview ? (
                      <img src={profileImagePreview} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl sm:text-5xl font-black text-white">
                          {user?.fullName?.charAt(0) || 'O'}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => profileImageRef.current?.click()}
                    className="absolute -bottom-2 -right-2 w-12 h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/50 flex items-center justify-center transition-all hover:scale-110"
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
                  <div className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center shadow-lg">
                    <Sparkles className="w-4 h-4 text-amber-900" />
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
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-500/25 disabled:opacity-50 flex items-center gap-2 transition-all"
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
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
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
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
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
                  {/* Full Name */}
                  <div>
                    <label className={`text-xs font-bold uppercase ${mutedClass} block mb-2 flex items-center gap-2`}>
                      <User className="w-3.5 h-3.5" />
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profileData.fullName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, fullName: e.target.value }))}
                      className={`w-full px-4 py-3.5 rounded-xl border-2 ${borderClass} ${surfaceClass} ${textClass} focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none`}
                      placeholder="Enter your full name"
                    />
                  </div>

                  {/* Username */}
                  <div>
                    <label className={`text-xs font-bold uppercase ${mutedClass} block mb-2 flex items-center gap-2`}>
                      <span className="text-amber-500">@</span>
                      Username
                    </label>
                    <input
                      type="text"
                      value={profileData.username}
                      onChange={(e) => setProfileData(prev => ({ ...prev, username: e.target.value }))}
                      className={`w-full px-4 py-3.5 rounded-xl border-2 ${borderClass} ${surfaceClass} ${textClass} focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none`}
                      placeholder="Enter username"
                    />
                  </div>

                  {/* Email & Phone Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={`text-xs font-bold uppercase ${mutedClass} block mb-2 flex items-center gap-2`}>
                        <Mail className="w-3.5 h-3.5" />
                        Email
                      </label>
                      <input
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                        className={`w-full px-4 py-3.5 rounded-xl border-2 ${borderClass} ${surfaceClass} ${textClass} focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none`}
                        placeholder="Enter email"
                      />
                    </div>
                    <div>
                      <label className={`text-xs font-bold uppercase ${mutedClass} block mb-2 flex items-center gap-2`}>
                        <Phone className="w-3.5 h-3.5" />
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={profileData.phone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                        className={`w-full px-4 py-3.5 rounded-xl border-2 ${borderClass} ${surfaceClass} ${textClass} focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none`}
                        placeholder="Enter phone"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div className="space-y-5">
                  {/* Security Notice */}
                  <div className={`p-4 rounded-2xl ${darkMode ? 'bg-amber-900/30 border-amber-700/50' : 'bg-amber-50 border-amber-200'} border flex items-start gap-4`}>
                    <div className={`w-10 h-10 rounded-xl ${darkMode ? 'bg-amber-600/30' : 'bg-amber-100'} flex items-center justify-center shrink-0`}>
                      <KeyRound className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${darkMode ? 'text-amber-300' : 'text-amber-800'}`}>Password Security</p>
                      <p className={`text-xs ${darkMode ? 'text-amber-400/80' : 'text-amber-700'} mt-1`}>
                        Your password protects your entire business. Use at least 6 characters.
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
                        className={`w-full px-4 py-3.5 pr-12 rounded-xl border-2 ${borderClass} ${surfaceClass} ${textClass} focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none`}
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
                        className={`w-full px-4 py-3.5 pr-12 rounded-xl border-2 ${borderClass} ${surfaceClass} ${textClass} focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none`}
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
                        className={`w-full px-4 py-3.5 pr-12 rounded-xl border-2 ${profileData.confirmPassword && profileData.newPassword !== profileData.confirmPassword ? 'border-red-500' : borderClass} ${surfaceClass} ${textClass} focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none`}
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
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-500/25 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
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

export default OwnerLayout;
