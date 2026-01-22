import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usersAPI } from '../../api';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Search,
  ChevronDown,
  ChevronUp,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  Briefcase
} from 'lucide-react';

const ManagerEmployees = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, bgClass }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEmployee, setExpandedEmployee] = useState(null);
  const [filterRole, setFilterRole] = useState('All');

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const response = await usersAPI.getAll();
      // Filter to only show employees (not the manager themselves, and not super admin)
      const allUsers = response.data.users || response.data || [];
      setEmployees(allUsers.filter(u => !u.isSuperAdmin));
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'ADMIN':
      case 'OWNER':
        return darkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700';
      case 'MANAGER':
        return darkMode ? 'bg-accent-900/30 text-accent-400' : 'bg-accent-100 text-accent-700';
      case 'CASHIER':
        return darkMode ? 'bg-positive-900/30 text-positive-400' : 'bg-positive-100 text-positive-700';
      default:
        return darkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-700';
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch =
      emp.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.phone?.includes(searchTerm) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'All' || emp.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const roles = ['All', ...new Set(employees.map(e => e.role))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-xl sm:text-2xl font-black uppercase tracking-tighter ${textClass}`}>
          Employees
        </h1>
        <p className={`text-sm ${mutedClass}`}>
          View and manage your team members
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Total Staff</p>
          <p className={`text-2xl font-black ${textClass}`}>{employees.length}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Managers</p>
          <p className={`text-2xl font-black text-accent-500`}>
            {employees.filter(e => e.role === 'MANAGER').length}
          </p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Cashiers</p>
          <p className={`text-2xl font-black text-positive-500`}>
            {employees.filter(e => e.role === 'CASHIER').length}
          </p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Active</p>
          <p className={`text-2xl font-black text-emerald-500`}>
            {employees.filter(e => e.isActive).length}
          </p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className={`w-full ${bgClass} border ${borderClass} rounded-xl py-3 pl-11 pr-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent-500/20 ${textClass}`}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {roles.map((role) => (
            <button
              key={role}
              onClick={() => setFilterRole(role)}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase whitespace-nowrap transition-all ${
                filterRole === role
                  ? darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'
                  : `${surfaceClass} border ${borderClass} ${mutedClass} hover:border-accent-500`
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Employee List */}
      <div className="space-y-3">
        {filteredEmployees.length === 0 ? (
          <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-8 text-center`}>
            <User className={`w-12 h-12 mx-auto mb-3 ${mutedClass}`} />
            <p className={`text-sm font-bold ${textClass}`}>No employees found</p>
            <p className={`text-xs ${mutedClass}`}>Try adjusting your search or filter</p>
          </div>
        ) : (
          filteredEmployees.map((employee) => {
            const isExpanded = expandedEmployee === employee.id;
            return (
              <div key={employee.id}>
                {/* Employee Card - Clickable Header */}
                <div
                  onClick={() => setExpandedEmployee(isExpanded ? null : employee.id)}
                  className={`${surfaceClass} border ${isExpanded ? 'border-accent-500 rounded-t-2xl border-b-0' : `${borderClass} rounded-2xl`} p-4 sm:p-5 cursor-pointer hover:border-accent-300 transition-colors`}
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 ${
                      employee.isActive
                        ? darkMode ? 'bg-accent-900/50 text-accent-300' : 'bg-accent-100 text-accent-700'
                        : darkMode ? 'bg-slate-700 text-slate-400' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {getInitials(employee.fullName)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-sm sm:text-base font-bold ${textClass} truncate`}>
                          {employee.fullName}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${getRoleBadgeColor(employee.role)}`}>
                          {employee.role}
                        </span>
                        {!employee.isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-red-100 text-negative-600">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className={`text-xs ${mutedClass}`}>@{employee.username}</p>
                      {employee.phone && (
                        <p className={`text-xs ${mutedClass} flex items-center gap-1 mt-1`}>
                          <Phone className="w-3 h-3" />
                          {employee.phone}
                        </p>
                      )}
                    </div>

                    {/* Expand Icon */}
                    <div className={`${mutedClass}`}>
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div
                    className={`${surfaceClass} border border-accent-500 border-t-0 rounded-b-2xl p-5 ${darkMode ? 'bg-slate-800/50' : 'bg-accent-50/30'}`}
                  >
                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* Contact Info */}
                      <div className="space-y-3">
                        <h4 className={`text-[10px] font-black uppercase tracking-wider ${mutedClass}`}>Contact Information</h4>

                        <div className="space-y-2">
                          {employee.phone ? (
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                                <Phone className={`w-4 h-4 ${mutedClass}`} />
                              </div>
                              <div>
                                <p className={`text-[10px] ${mutedClass}`}>Phone</p>
                                <p className={`text-sm font-bold ${textClass}`}>{employee.phone}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                                <Phone className={`w-4 h-4 ${mutedClass}`} />
                              </div>
                              <div>
                                <p className={`text-[10px] ${mutedClass}`}>Phone</p>
                                <p className={`text-sm ${mutedClass} italic`}>Not provided</p>
                              </div>
                            </div>
                          )}

                          {employee.email ? (
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                                <Mail className={`w-4 h-4 ${mutedClass}`} />
                              </div>
                              <div>
                                <p className={`text-[10px] ${mutedClass}`}>Email</p>
                                <p className={`text-sm font-bold ${textClass} break-all`}>{employee.email}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                                <Mail className={`w-4 h-4 ${mutedClass}`} />
                              </div>
                              <div>
                                <p className={`text-[10px] ${mutedClass}`}>Email</p>
                                <p className={`text-sm ${mutedClass} italic`}>Not provided</p>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                              <MapPin className={`w-4 h-4 ${mutedClass}`} />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Address</p>
                              <p className={`text-sm ${employee.address ? `font-bold ${textClass}` : `${mutedClass} italic`}`}>
                                {employee.address || 'Not provided'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Account Info */}
                      <div className="space-y-3">
                        <h4 className={`text-[10px] font-black uppercase tracking-wider ${mutedClass}`}>Account Details</h4>

                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                              <Briefcase className={`w-4 h-4 ${mutedClass}`} />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Role</p>
                              <p className={`text-sm font-bold ${textClass}`}>{employee.role}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                              {employee.isActive ? (
                                <CheckCircle className="w-4 h-4 text-positive-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-negative-500" />
                              )}
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Status</p>
                              <p className={`text-sm font-bold ${employee.isActive ? 'text-positive-500' : 'text-negative-500'}`}>
                                {employee.isActive ? 'Active' : 'Inactive'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                              <Clock className={`w-4 h-4 ${mutedClass}`} />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Joined</p>
                              <p className={`text-sm font-bold ${textClass}`}>
                                {employee.createdAt
                                  ? new Date(employee.createdAt).toLocaleDateString()
                                  : 'Unknown'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notes Section */}
                    {employee.notes && (
                      <div className={`mt-4 pt-4 border-t ${borderClass}`}>
                        <h4 className={`text-[10px] font-black uppercase tracking-wider ${mutedClass} mb-2`}>Notes</h4>
                        <p className={`text-sm ${textClass}`}>{employee.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ManagerEmployees;
