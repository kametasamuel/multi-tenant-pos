import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  Clock
} from 'lucide-react';

const ManagerLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { path: '/manager/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/manager/employees', label: 'Workers', icon: Users },
    { path: '/manager/customers', label: 'Customers', icon: UserCheck },
    { path: '/manager/sales', label: 'Shift Revenue', icon: BarChart3 },
    { path: '/manager/inventory', label: 'Inventory', icon: Package },
    { path: '/manager/requests', label: 'Security Requests', icon: Bell },
    { path: '/manager/expenses', label: 'Expenses', icon: Wallet }
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
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-accent-500 bg-slate-100 overflow-hidden">
            <div className={`w-full h-full ${darkMode ? 'bg-slate-700' : 'bg-slate-200'} flex items-center justify-center text-xs font-bold`}>
              {user?.fullName?.charAt(0) || 'M'}
            </div>
          </div>
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
              to="/manager/pos"
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
              className={`w-72 h-full ${surfaceClass} p-6 flex flex-col gap-2`}
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
                  to="/manager/pos"
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
    </div>
  );
};

export default ManagerLayout;
