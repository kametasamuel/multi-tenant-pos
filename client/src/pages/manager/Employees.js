import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usersAPI, IMAGE_BASE_URL } from '../../api';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle,
  XCircle,
  Briefcase,
  Users,
  Calendar,
  Plus,
  X,
  Eye,
  EyeOff,
  UserPlus,
  Key,
  Camera,
  Edit3
} from 'lucide-react';

const ManagerEmployees = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, bgClass }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEmployee, setExpandedEmployee] = useState(null);
  const [filterRole, setFilterRole] = useState('All');

  // Add Staff Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newStaff, setNewStaff] = useState({
    username: '',
    password: '',
    fullName: '',
    phone: '',
    email: '',
    address: '',
    role: 'CASHIER',
    specialty: '',
    commissionRate: '',
    gender: '',
    dateOfBirth: ''
  });

  // Edit Staff Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Reset Password Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmployee, setResetEmployee] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Image upload state
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const response = await usersAPI.getAll();
      // Filter to only show staff (MANAGER, CASHIER, ATTENDANT) - exclude ADMIN, OWNER, and super admin
      const allUsers = response.data.users || response.data || [];
      setEmployees(allUsers.filter(u =>
        !u.isSuperAdmin &&
        u.role !== 'ADMIN' &&
        u.role !== 'OWNER'
      ));
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatGender = (gender) => {
    if (!gender) return 'Not specified';
    const genderMap = {
      'MALE': 'Male',
      'FEMALE': 'Female',
      'OTHER': 'Other',
      'PREFER_NOT_TO_SAY': 'Prefer not to say'
    };
    return genderMap[gender] || gender;
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setAddError('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setAddError('File too large. Maximum size is 5MB.');
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      setAddError('');
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const uploadImage = async (userId) => {
    if (!selectedImage) return;

    const formData = new FormData();
    formData.append('image', selectedImage);

    try {
      setUploadingImage(true);
      await usersAPI.uploadImage(userId, formData);
    } catch (error) {
      console.error('Image upload failed:', error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');

    const isAttendant = newStaff.role === 'ATTENDANT';

    // Validate non-attendant requirements
    if (!isAttendant && (!newStaff.username || !newStaff.password)) {
      setAddError('Username and password are required');
      setAddLoading(false);
      return;
    }

    try {
      const submitData = {
        fullName: newStaff.fullName,
        role: newStaff.role,
        phone: newStaff.phone || null,
        email: newStaff.email || null,
        gender: newStaff.gender || null,
        dateOfBirth: newStaff.dateOfBirth || null
      };

      // Add credentials for non-attendants
      if (!isAttendant) {
        submitData.username = newStaff.username;
        submitData.password = newStaff.password;
      }

      // Add ATTENDANT-specific fields
      if (isAttendant) {
        submitData.specialty = newStaff.specialty || null;
        submitData.commissionRate = newStaff.commissionRate ? parseFloat(newStaff.commissionRate) : 0;
      }

      const response = await usersAPI.create(submitData);
      const userId = response.data.user?.id;

      // Upload image if selected
      if (selectedImage && userId) {
        await uploadImage(userId);
      }

      setShowAddModal(false);
      setNewStaff({
        username: '',
        password: '',
        fullName: '',
        phone: '',
        email: '',
        address: '',
        role: 'CASHIER',
        specialty: '',
        commissionRate: '',
        gender: '',
        dateOfBirth: ''
      });
      setSelectedImage(null);
      setImagePreview(null);
      loadEmployees();
    } catch (error) {
      setAddError(error.response?.data?.error || 'Failed to add staff');
    } finally {
      setAddLoading(false);
    }
  };

  const openEditModal = (employee) => {
    setEditEmployee({
      ...employee,
      dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth).toISOString().split('T')[0] : ''
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleEditStaff = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');

    try {
      const updateData = {
        fullName: editEmployee.fullName,
        phone: editEmployee.phone || null,
        email: editEmployee.email || null,
        address: editEmployee.address || null,
        gender: editEmployee.gender || null,
        dateOfBirth: editEmployee.dateOfBirth || null
      };

      // Add ATTENDANT-specific fields
      if (editEmployee.role === 'ATTENDANT') {
        updateData.specialty = editEmployee.specialty || null;
        updateData.commissionRate = editEmployee.commissionRate ? parseFloat(editEmployee.commissionRate) : 0;
      }

      await usersAPI.update(editEmployee.id, updateData);
      setShowEditModal(false);
      setEditEmployee(null);
      loadEmployees();
    } catch (error) {
      setEditError(error.response?.data?.error || 'Failed to update staff');
    } finally {
      setEditLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetEmployee || !newPassword) return;

    setResetLoading(true);
    try {
      await usersAPI.resetPassword(resetEmployee.id, newPassword);
      setShowResetModal(false);
      setResetEmployee(null);
      setNewPassword('');
    } catch (error) {
      console.error('Failed to reset password:', error);
    } finally {
      setResetLoading(false);
    }
  };

  const openResetModal = (employee) => {
    setResetEmployee(employee);
    setNewPassword('');
    setShowResetModal(true);
  };

  // Check if manager can edit this employee (only cashiers and attendants)
  const canEditEmployee = (employee) => {
    return employee.role === 'CASHIER' || employee.role === 'ATTENDANT';
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
      case 'ATTENDANT':
        return darkMode ? 'bg-violet-900/30 text-violet-400' : 'bg-violet-100 text-violet-700';
      default:
        return darkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-700';
    }
  };

  const getDisplayRole = (role) => {
    return role === 'ADMIN' ? 'OWNER' : role;
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

  const roles = ['All', 'MANAGER', 'CASHIER', 'ATTENDANT'].filter(role =>
    role === 'All' || employees.some(e => e.role === role)
  );

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl sm:text-2xl font-black uppercase tracking-tighter ${textClass}`}>
            Staff
          </h1>
          <p className={`text-sm ${mutedClass}`}>
            Manage your team members
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent-500 text-white rounded-xl text-xs font-bold uppercase hover:bg-accent-600 transition-colors shadow-lg"
        >
          <UserPlus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Staff</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Total Staff</p>
          <p className={`text-2xl font-black ${textClass}`}>{employees.length}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Cashiers</p>
          <p className={`text-2xl font-black text-positive-500`}>
            {employees.filter(e => e.role === 'CASHIER').length}
          </p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Attendants</p>
          <p className={`text-2xl font-black text-violet-500`}>
            {employees.filter(e => e.role === 'ATTENDANT').length}
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
            <Users className={`w-12 h-12 mx-auto mb-3 ${mutedClass}`} />
            <p className={`text-sm font-bold ${textClass}`}>No employees found</p>
            <p className={`text-xs ${mutedClass}`}>Try adjusting your search or filter</p>
          </div>
        ) : (
          filteredEmployees.map((employee) => {
            const isExpanded = expandedEmployee === employee.id;
            const age = calculateAge(employee.dateOfBirth);
            const canEdit = canEditEmployee(employee);

            return (
              <div key={employee.id}>
                {/* Employee Card - Clickable Header */}
                <div
                  onClick={() => setExpandedEmployee(isExpanded ? null : employee.id)}
                  className={`${surfaceClass} border ${isExpanded ? 'border-accent-500 rounded-t-2xl border-b-0' : `${borderClass} rounded-2xl`} p-4 sm:p-5 cursor-pointer hover:border-accent-300 transition-colors`}
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    {employee.profileImage ? (
                      <img
                        src={`${IMAGE_BASE_URL}${employee.profileImage}`}
                        alt={employee.fullName}
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover shrink-0 ${!employee.isActive ? 'opacity-50' : ''}`}
                      />
                    ) : (
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 ${
                        employee.isActive
                          ? darkMode ? 'bg-accent-900/50 text-accent-300' : 'bg-accent-100 text-accent-700'
                          : darkMode ? 'bg-slate-700 text-slate-400' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {getInitials(employee.fullName)}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-sm sm:text-base font-bold ${textClass} truncate`}>
                          {employee.fullName}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${getRoleBadgeColor(employee.role)}`}>
                          {getDisplayRole(employee.role)}
                        </span>
                        {!employee.isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-red-100 text-negative-600">
                            Inactive
                          </span>
                        )}
                      </div>
                      {employee.role === 'ATTENDANT' ? (
                        <p className={`text-xs ${mutedClass}`}>{employee.specialty || 'No specialty'}</p>
                      ) : (
                        <p className={`text-xs ${mutedClass}`}>@{employee.username}</p>
                      )}
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
                    <div className="grid sm:grid-cols-2 gap-6">
                      {/* Personal Info */}
                      <div className="space-y-3">
                        <h4 className={`text-[10px] font-black uppercase tracking-wider ${mutedClass}`}>Personal Information</h4>

                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                              <User className={`w-4 h-4 ${mutedClass}`} />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Gender</p>
                              <p className={`text-sm font-bold ${textClass}`}>{formatGender(employee.gender)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                              <Calendar className={`w-4 h-4 ${mutedClass}`} />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Age</p>
                              <p className={`text-sm ${age ? `font-bold ${textClass}` : `${mutedClass} italic`}`}>
                                {age ? `${age} years old` : 'Not specified'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="space-y-3">
                        <h4 className={`text-[10px] font-black uppercase tracking-wider ${mutedClass}`}>Contact Information</h4>

                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                              <Phone className={`w-4 h-4 ${mutedClass}`} />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Phone</p>
                              <p className={`text-sm ${employee.phone ? `font-bold ${textClass}` : `${mutedClass} italic`}`}>
                                {employee.phone || 'Not provided'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                              <Mail className={`w-4 h-4 ${mutedClass}`} />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Email</p>
                              <p className={`text-sm ${employee.email ? `font-bold ${textClass} break-all` : `${mutedClass} italic`}`}>
                                {employee.email || 'Not provided'}
                              </p>
                            </div>
                          </div>

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
                              <p className={`text-sm font-bold ${textClass}`}>{getDisplayRole(employee.role)}</p>
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

                      {/* ATTENDANT-specific info */}
                      {employee.role === 'ATTENDANT' && (
                        <div className="space-y-3">
                          <h4 className={`text-[10px] font-black uppercase tracking-wider ${mutedClass}`}>Attendant Details</h4>

                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-violet-900/30' : 'bg-violet-100'}`}>
                                <Briefcase className="w-4 h-4 text-violet-500" />
                              </div>
                              <div>
                                <p className={`text-[10px] ${mutedClass}`}>Specialty</p>
                                <p className={`text-sm ${employee.specialty ? `font-bold ${textClass}` : `${mutedClass} italic`}`}>
                                  {employee.specialty || 'Not specified'}
                                </p>
                              </div>
                            </div>

                            {employee.commissionRate > 0 && (
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-violet-900/30' : 'bg-violet-100'}`}>
                                  <span className="text-xs font-bold text-violet-500">%</span>
                                </div>
                                <div>
                                  <p className={`text-[10px] ${mutedClass}`}>Commission Rate</p>
                                  <p className={`text-sm font-bold text-violet-500`}>{employee.commissionRate}%</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions - Only for cashiers and attendants */}
                    {canEdit && (
                      <div className={`mt-4 pt-4 border-t ${borderClass} flex flex-wrap gap-2`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(employee);
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'} ${textClass} transition-colors`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit Details
                        </button>
                        {employee.role === 'CASHIER' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openResetModal(employee);
                            }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'} ${textClass} transition-colors`}
                          >
                            <Key className="w-3.5 h-3.5" />
                            Reset Password
                          </button>
                        )}
                      </div>
                    )}

                    {/* View-only notice for managers */}
                    {!canEdit && (
                      <div className={`mt-4 pt-4 border-t ${borderClass}`}>
                        <p className={`text-xs ${mutedClass} italic text-center`}>
                          Contact the owner to update manager information
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div
            className={`${surfaceClass} w-full max-w-md rounded-2xl p-5 shadow-2xl border ${borderClass} max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-base font-black uppercase ${textClass}`}>Add Staff</h2>
              <button onClick={() => setShowAddModal(false)} className={`p-1.5 rounded-lg ${mutedClass} hover:bg-gray-100 dark:hover:bg-slate-700`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="mb-3 p-2 bg-red-100 text-negative-700 rounded-lg text-xs">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddStaff} className="space-y-3">
              {/* Top Row: Photo + Role */}
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Profile" className="w-14 h-14 rounded-xl object-cover" />
                  ) : (
                    <div className={`w-14 h-14 rounded-xl ${darkMode ? 'bg-slate-600' : 'bg-gray-200'} flex items-center justify-center`}>
                      <User className={`w-6 h-6 ${mutedClass}`} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-accent-500 text-white rounded-full flex items-center justify-center hover:bg-accent-600"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                </div>
                <div className="flex-1">
                  <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Role</label>
                  <select
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold`}
                  >
                    <option value="CASHIER">Cashier</option>
                    <option value="ATTENDANT">Attendant</option>
                  </select>
                  {newStaff.role === 'ATTENDANT' && (
                    <p className={`text-[10px] ${mutedClass} mt-0.5`}>No login needed</p>
                  )}
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Full Name *</label>
                <input
                  type="text"
                  value={newStaff.fullName}
                  onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold`}
                  required
                />
              </div>

              {/* Username/Password for non-ATTENDANT */}
              {newStaff.role !== 'ATTENDANT' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Username *</label>
                    <input
                      type="text"
                      value={newStaff.username}
                      onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold`}
                      required
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Password *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newStaff.password}
                        onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                        className={`w-full px-3 py-2 pr-8 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold`}
                        placeholder="Min 6"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 ${mutedClass}`}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ATTENDANT fields */}
              {newStaff.role === 'ATTENDANT' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Specialty</label>
                    <input
                      type="text"
                      value={newStaff.specialty}
                      onChange={(e) => setNewStaff({ ...newStaff, specialty: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold`}
                      placeholder="e.g., Stylist"
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Commission %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newStaff.commissionRate}
                      onChange={(e) => setNewStaff({ ...newStaff, commissionRate: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold`}
                      placeholder="30"
                    />
                  </div>
                </div>
              )}

              {/* Gender and DOB */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Gender</label>
                  <select
                    value={newStaff.gender}
                    onChange={(e) => setNewStaff({ ...newStaff, gender: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold`}
                  >
                    <option value="">Select...</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                    <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Date of Birth</label>
                  <input
                    type="date"
                    value={newStaff.dateOfBirth}
                    onChange={(e) => setNewStaff({ ...newStaff, dateOfBirth: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold`}
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Phone</label>
                <input
                  type="tel"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold`}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedImage(null);
                    setImagePreview(null);
                    setNewStaff({ username: '', password: '', fullName: '', phone: '', email: '', address: '', role: 'CASHIER', specialty: '', commissionRate: '', gender: '', dateOfBirth: '' });
                  }}
                  disabled={addLoading || uploadingImage}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold ${mutedClass} border ${borderClass} hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading || uploadingImage}
                  className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50"
                >
                  {addLoading || uploadingImage ? 'Adding...' : `Add ${newStaff.role === 'ATTENDANT' ? 'Attendant' : 'Cashier'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {showEditModal && editEmployee && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowEditModal(false)}>
          <div
            className={`${surfaceClass} w-full max-w-md rounded-2xl p-5 shadow-2xl border ${borderClass} max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-base font-black uppercase ${textClass}`}>Edit Staff</h2>
              <button onClick={() => setShowEditModal(false)} className={`p-1.5 rounded-lg ${mutedClass} hover:bg-gray-100 dark:hover:bg-slate-700`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="mb-3 p-2 bg-red-100 text-negative-700 rounded-lg text-xs">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditStaff} className="space-y-3">
              {/* Full Name */}
              <div>
                <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Full Name *</label>
                <input
                  type="text"
                  value={editEmployee.fullName || ''}
                  onChange={(e) => setEditEmployee({ ...editEmployee, fullName: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold`}
                  required
                />
              </div>

              {/* Gender and DOB */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Gender</label>
                  <select
                    value={editEmployee.gender || ''}
                    onChange={(e) => setEditEmployee({ ...editEmployee, gender: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold`}
                  >
                    <option value="">Select...</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                    <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Date of Birth</label>
                  <input
                    type="date"
                    value={editEmployee.dateOfBirth || ''}
                    onChange={(e) => setEditEmployee({ ...editEmployee, dateOfBirth: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold`}
                  />
                </div>
              </div>

              {/* Phone and Email */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Phone</label>
                  <input
                    type="tel"
                    value={editEmployee.phone || ''}
                    onChange={(e) => setEditEmployee({ ...editEmployee, phone: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold`}
                  />
                </div>
                <div>
                  <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Email</label>
                  <input
                    type="email"
                    value={editEmployee.email || ''}
                    onChange={(e) => setEditEmployee({ ...editEmployee, email: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold`}
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Address</label>
                <input
                  type="text"
                  value={editEmployee.address || ''}
                  onChange={(e) => setEditEmployee({ ...editEmployee, address: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold`}
                />
              </div>

              {/* ATTENDANT fields */}
              {editEmployee.role === 'ATTENDANT' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Specialty</label>
                    <input
                      type="text"
                      value={editEmployee.specialty || ''}
                      onChange={(e) => setEditEmployee({ ...editEmployee, specialty: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold`}
                      placeholder="e.g., Stylist"
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Commission %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editEmployee.commissionRate || ''}
                      onChange={(e) => setEditEmployee({ ...editEmployee, commissionRate: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold`}
                      placeholder="30"
                    />
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={editLoading}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold ${mutedClass} border ${borderClass} hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && resetEmployee && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowResetModal(false)}>
          <div
            className={`${surfaceClass} w-full max-w-sm rounded-2xl p-6 shadow-2xl border ${borderClass}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-lg font-black uppercase ${textClass}`}>Reset Password</h2>
              <button
                onClick={() => setShowResetModal(false)}
                className={`p-2 rounded-xl ${mutedClass} hover:bg-gray-100 dark:hover:bg-slate-700`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className={`text-sm ${mutedClass} mb-4`}>
              Reset password for <strong className={textClass}>{resetEmployee.fullName}</strong>
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>New Password *</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`w-full px-4 py-3 pr-12 rounded-xl border ${borderClass} ${bgClass} ${textClass} text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent-500/20`}
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${mutedClass}`}
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold ${mutedClass} border ${borderClass} hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading || !newPassword}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-accent-500 text-white hover:bg-accent-600 transition-colors disabled:opacity-50"
                >
                  {resetLoading ? 'Resetting...' : 'Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerEmployees;
