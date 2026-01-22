import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
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
  Globe
} from 'lucide-react';

const OwnerLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { branches, currentBranch, switchBranch, switchToAllBranches, isAllBranches, getActiveBranches } = useBranch();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [showPOSBranchModal, setShowPOSBranchModal] = useState(false);

  // Handle Launch POS click - show branch selector if in All Branches mode
  const handleLaunchPOS = () => {
    if (isAllBranches) {
      setShowPOSBranchModal(true);
    } else {
      navigate('/owner/pos');
    }
  };

  // Navigate to POS with selected branch
  const launchPOSForBranch = (branch) => {
    switchBranch(branch);
    setShowPOSBranchModal(false);
    setMobileMenuOpen(false);
    navigate('/owner/pos');
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
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  // Full navigation - Owner has access to everything
  const navLinks = [
    { path: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/owner/sales', label: 'Sales & Revenue', icon: BarChart3 },
    { path: '/owner/inventory', label: 'Inventory', icon: Package },
    { path: '/owner/staff', label: 'Staff', icon: Users },
    { path: '/owner/customers', label: 'Customers', icon: UserCheck },
    { path: '/owner/requests', label: 'Void Requests', icon: Bell },
    { path: '/owner/expenses', label: 'Expenses', icon: Wallet },
    { path: '/owner/activity', label: 'Activity Logs', icon: Activity },
    { path: '/owner/reports', label: 'Reports', icon: FileText },
    { path: '/owner/branches', label: 'Branches', icon: Building2 },
    { path: '/owner/settings', label: 'Settings', icon: Settings }
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
                  to="/owner/branches"
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
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 ${darkMode ? 'border-amber-400' : 'border-slate-400'} bg-slate-100 overflow-hidden`}>
            <div className={`w-full h-full ${darkMode ? 'bg-slate-700' : 'bg-slate-200'} flex items-center justify-center text-xs font-bold`}>
              {user?.fullName?.charAt(0) || 'O'}
            </div>
          </div>
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
              className={`w-72 h-full ${surfaceClass} p-4 flex flex-col gap-1 overflow-y-auto`}
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
    </div>
  );
};

export default OwnerLayout;
