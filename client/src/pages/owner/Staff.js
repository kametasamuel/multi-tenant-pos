import React, { useState, useEffect, useRef } from 'react';
import { ownerAPI, IMAGE_BASE_URL } from '../../api';
import { exportStaff } from '../../utils/exportUtils';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Key,
  UserCheck,
  UserX,
  X,
  Building2,
  Download,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Camera,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Briefcase,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

const Staff = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, currentBranch, isAllBranches, branches = [] }) => {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState([]);
  const [stats, setStats] = useState({ total: 0, byRole: {} });
  const [filters, setFilters] = useState({ search: '', role: '', status: '' });
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [passwordStaff, setPasswordStaff] = useState(null);
  const [expandedStaff, setExpandedStaff] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'CASHIER',
    branchId: '',
    phone: '',
    email: '',
    address: '',
    gender: '',
    dateOfBirth: '',
    specialty: '',
    commissionRate: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  // Branch filter for drilling down when in "All Branches" mode
  const [branchFilter, setBranchFilter] = useState(null);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  // Image upload state
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Get the effective branchId for API calls
  const getEffectiveBranchId = () => {
    if (!isAllBranches && currentBranch) {
      return currentBranch.id;
    }
    if (isAllBranches && branchFilter) {
      return branchFilter.id;
    }
    return null;
  };

  // Reset branch filter when switching away from "All Branches" mode
  useEffect(() => {
    if (!isAllBranches) {
      setBranchFilter(null);
    }
  }, [isAllBranches]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadData();
  }, [filters, currentBranch, isAllBranches, branchFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.role) params.role = filters.role;
      if (filters.status) params.status = filters.status;

      const effectiveBranchId = getEffectiveBranchId();
      if (effectiveBranchId) {
        params.branchId = effectiveBranchId;
      }

      const response = await ownerAPI.getStaff(params);
      setStaff(response.data.staff || []);
      setStats(response.data.stats || { total: 0, byRole: {} });
    } catch (error) {
      console.error('Failed to load staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (staffMember = null) => {
    if (staffMember) {
      setEditingStaff(staffMember);
      setFormData({
        username: staffMember.username || '',
        password: '',
        fullName: staffMember.fullName,
        role: staffMember.role,
        branchId: staffMember.branchId || '',
        phone: staffMember.phone || '',
        email: staffMember.email || '',
        address: staffMember.address || '',
        gender: staffMember.gender || '',
        dateOfBirth: staffMember.dateOfBirth ? staffMember.dateOfBirth.split('T')[0] : '',
        specialty: staffMember.specialty || '',
        commissionRate: staffMember.commissionRate || ''
      });
      // Set image preview if user has a profile image
      if (staffMember.profileImage) {
        setImagePreview(`${IMAGE_BASE_URL}${staffMember.profileImage}`);
      } else {
        setImagePreview(null);
      }
    } else {
      setEditingStaff(null);
      const mainBranch = branches.find(b => b.isMain);
      setFormData({
        username: '',
        password: '',
        fullName: '',
        role: 'CASHIER',
        branchId: mainBranch?.id || '',
        phone: '',
        email: '',
        address: '',
        gender: '',
        dateOfBirth: '',
        specialty: '',
        commissionRate: ''
      });
      setImagePreview(null);
    }
    setSelectedImage(null);
    setError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingStaff(null);
    setError('');
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
        return;
      }
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File too large. Maximum size is 5MB.');
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleRemoveImage = async () => {
    if (editingStaff?.profileImage) {
      try {
        await ownerAPI.deleteStaffImage(editingStaff.id);
        setSuccess('Profile image removed');
        loadData();
        setTimeout(() => setSuccess(''), 3000);
      } catch (error) {
        setError(error.response?.data?.error || 'Failed to remove image');
        return;
      }
    }
    setSelectedImage(null);
    setImagePreview(null);
  };

  const uploadImage = async (userId) => {
    if (!selectedImage) return;

    const formData = new FormData();
    formData.append('image', selectedImage);

    try {
      setUploadingImage(true);
      await ownerAPI.uploadStaffImage(userId, formData);
    } catch (error) {
      console.error('Image upload failed:', error);
      // Don't fail the whole operation if image upload fails
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      let userId;
      const isAttendant = formData.role === 'ATTENDANT';

      if (editingStaff) {
        const updateData = {
          fullName: formData.fullName,
          role: formData.role,
          branchId: formData.branchId || null,
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
          gender: formData.gender || null,
          dateOfBirth: formData.dateOfBirth || null
        };
        // Include ATTENDANT-specific fields
        if (isAttendant) {
          updateData.specialty = formData.specialty || null;
          updateData.commissionRate = formData.commissionRate ? parseFloat(formData.commissionRate) : null;
        }
        await ownerAPI.updateStaff(editingStaff.id, updateData);
        userId = editingStaff.id;

        // Upload image if selected
        if (selectedImage) {
          await uploadImage(userId);
        }

        setSuccess('Staff member updated successfully');
      } else {
        // For non-attendants, require password
        if (!isAttendant && !formData.password) {
          setError('Password is required for new staff');
          return;
        }
        const response = await ownerAPI.createStaff(formData);
        userId = response.data.user?.id;

        // Upload image if selected and we have the user ID
        if (selectedImage && userId) {
          await uploadImage(userId);
        }

        setSuccess('Staff member created successfully');
      }
      handleCloseModal();
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleToggleStatus = async (staffMember) => {
    try {
      await ownerAPI.updateStaff(staffMember.id, { isActive: !staffMember.isActive });
      setSuccess(`Staff member ${staffMember.isActive ? 'deactivated' : 'activated'} successfully`);
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to update status');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleOpenPasswordModal = (staffMember) => {
    setPasswordStaff(staffMember);
    setNewPassword('');
    setError('');
    setShowPasswordModal(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      await ownerAPI.resetStaffPassword(passwordStaff.id, newPassword);
      setSuccess('Password reset successfully');
      setShowPasswordModal(false);
      setPasswordStaff(null);
      setNewPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to reset password');
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'OWNER':
      case 'ADMIN':
        return 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'CASHIER':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'ATTENDANT':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  // Display OWNER for both OWNER and ADMIN roles
  const getDisplayRole = (role) => {
    return role === 'ADMIN' ? 'OWNER' : role;
  };

  // Calculate age from date of birth
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

  // Format gender for display
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

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black uppercase tracking-tight ${textClass}`}>Staff Management</h1>
          <div className="flex items-center gap-2 mt-1">
            <Building2 className={`w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            <p className={`text-sm ${mutedClass}`}>
              {isAllBranches ? 'All Branches' : currentBranch?.name || 'Select a branch'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Branch Filter Chip - Only show when filter is active in All Branches mode */}
          {isAllBranches && branchFilter && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-bold">
              <span>Filtered: {branchFilter.name}</span>
              <button
                onClick={() => setBranchFilter(null)}
                className="hover:bg-slate-700 dark:hover:bg-slate-600 rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Branch Filter Dropdown - Only show in All Branches mode */}
          {isAllBranches && (
            <div className="relative">
              <button
                onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm font-medium hover:border-slate-400 transition-colors`}
              >
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">{branchFilter ? branchFilter.name : 'All'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showBranchDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showBranchDropdown && (
                <div className={`absolute right-0 mt-2 w-56 ${surfaceClass} border ${borderClass} rounded-xl shadow-xl z-50 overflow-hidden`}>
                  <button
                    onClick={() => {
                      setBranchFilter(null);
                      setShowBranchDropdown(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 ${textClass} ${!branchFilter ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                  >
                    All Branches
                  </button>
                  {branches.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => {
                        setBranchFilter(branch);
                        setShowBranchDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 ${textClass} ${branchFilter?.id === branch.id ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                    >
                      {branch.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => exportStaff(staff)}
            disabled={staff.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
            title="Export to Excel"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add Staff
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl text-sm font-medium">
          {success}
        </div>
      )}
      {error && !showModal && !showPasswordModal && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass} text-center`}>
          <p className={`text-2xl font-black ${textClass}`}>{stats.total}</p>
          <p className={`text-xs ${mutedClass} uppercase font-bold`}>Total Staff</p>
        </div>
        <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass} text-center`}>
          <p className={`text-2xl font-black text-slate-600 dark:text-slate-400`}>{(stats.byRole?.OWNER || 0) + (stats.byRole?.ADMIN || 0)}</p>
          <p className={`text-xs ${mutedClass} uppercase font-bold`}>Owners</p>
        </div>
        <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass} text-center`}>
          <p className={`text-2xl font-black text-blue-500`}>{stats.byRole?.MANAGER || 0}</p>
          <p className={`text-xs ${mutedClass} uppercase font-bold`}>Managers</p>
        </div>
        <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass} text-center`}>
          <p className={`text-2xl font-black text-green-500`}>{stats.byRole?.CASHIER || 0}</p>
          <p className={`text-xs ${mutedClass} uppercase font-bold`}>Cashiers</p>
        </div>
        <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass} text-center`}>
          <p className={`text-2xl font-black text-purple-500`}>{stats.byRole?.ATTENDANT || 0}</p>
          <p className={`text-xs ${mutedClass} uppercase font-bold`}>Attendants</p>
        </div>
      </div>

      {/* Filters */}
      <div className={`${surfaceClass} rounded-2xl p-4 border ${borderClass}`}>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
            <input
              type="text"
              placeholder="Search by name or username..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className={`w-full pl-10 pr-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
            />
          </div>
          <select
            value={filters.role}
            onChange={(e) => setFilters({ ...filters, role: e.target.value })}
            className={`px-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm font-medium`}
          >
            <option value="">All Roles</option>
            <option value="OWNER,ADMIN">Owner</option>
            <option value="MANAGER">Manager</option>
            <option value="CASHIER">Cashier</option>
            <option value="ATTENDANT">Attendant</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className={`px-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm font-medium`}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Staff List - Expandable Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
        </div>
      ) : staff.length === 0 ? (
        <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-12 text-center`}>
          <Users className={`w-12 h-12 mx-auto ${mutedClass} mb-4`} />
          <p className={`text-sm font-bold ${textClass}`}>No staff members found</p>
          <p className={`text-xs ${mutedClass}`}>Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map(member => {
            const isExpanded = expandedStaff === member.id;
            const age = calculateAge(member.dateOfBirth);

            return (
              <div key={member.id}>
                {/* Staff Card - Clickable Header */}
                <div
                  onClick={() => setExpandedStaff(isExpanded ? null : member.id)}
                  className={`${surfaceClass} border ${isExpanded ? 'border-slate-500 rounded-t-2xl border-b-0' : `${borderClass} rounded-2xl`} p-4 sm:p-5 cursor-pointer hover:border-slate-400 transition-colors ${!member.isActive ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    {member.profileImage ? (
                      <img
                        src={`${IMAGE_BASE_URL}${member.profileImage}`}
                        alt={member.fullName}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover shrink-0"
                      />
                    ) : (
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 ${
                        member.isActive
                          ? darkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-100 text-slate-600'
                          : darkMode ? 'bg-slate-700 text-slate-400' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {getInitials(member.fullName)}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-sm sm:text-base font-bold ${textClass} truncate`}>
                          {member.fullName}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${getRoleBadgeClass(member.role)}`}>
                          {getDisplayRole(member.role)}
                        </span>
                        {!member.isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                            Inactive
                          </span>
                        )}
                      </div>
                      {member.role === 'ATTENDANT' ? (
                        <p className={`text-xs ${mutedClass}`}>{member.specialty || 'No specialty'}</p>
                      ) : (
                        <p className={`text-xs ${mutedClass}`}>@{member.username}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {member.branch && (
                          <p className={`text-xs ${mutedClass} flex items-center gap-1`}>
                            <Building2 className="w-3 h-3" />
                            {member.branch.name}
                          </p>
                        )}
                        {member.phone && (
                          <p className={`text-xs ${mutedClass} flex items-center gap-1`}>
                            <Phone className="w-3 h-3" />
                            {member.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Expand Icon */}
                    <div className={`${mutedClass}`}>
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className={`${surfaceClass} border border-slate-500 border-t-0 rounded-b-2xl p-5 ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50/50'}`}>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* Personal Info */}
                      <div className="space-y-3">
                        <h4 className={`text-[10px] font-black uppercase tracking-wider ${mutedClass}`}>Personal Information</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                              <Users className={`w-4 h-4 ${mutedClass}`} />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Gender</p>
                              <p className={`text-sm font-bold ${textClass}`}>{formatGender(member.gender)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                              <Calendar className={`w-4 h-4 ${mutedClass}`} />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Age</p>
                              <p className={`text-sm ${age !== null ? `font-bold ${textClass}` : `${mutedClass} italic`}`}>
                                {age !== null ? `${age} years` : 'Not provided'}
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
                              <p className={`text-sm ${member.phone ? `font-bold ${textClass}` : `${mutedClass} italic`}`}>
                                {member.phone || 'Not provided'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                              <Mail className={`w-4 h-4 ${mutedClass}`} />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Email</p>
                              <p className={`text-sm ${member.email ? `font-bold ${textClass}` : `${mutedClass} italic`} break-all`}>
                                {member.email || 'Not provided'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                              <MapPin className={`w-4 h-4 ${mutedClass}`} />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Address</p>
                              <p className={`text-sm ${member.address ? `font-bold ${textClass}` : `${mutedClass} italic`}`}>
                                {member.address || 'Not provided'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Account Details */}
                    <div className={`mt-4 pt-4 border-t ${borderClass}`}>
                      <h4 className={`text-[10px] font-black uppercase tracking-wider ${mutedClass} mb-3`}>Account Details</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex items-center gap-2">
                          <Briefcase className={`w-4 h-4 ${mutedClass}`} />
                          <div>
                            <p className={`text-[10px] ${mutedClass}`}>Role</p>
                            <p className={`text-sm font-bold ${textClass}`}>{getDisplayRole(member.role)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {member.isActive ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <div>
                            <p className={`text-[10px] ${mutedClass}`}>Status</p>
                            <p className={`text-sm font-bold ${member.isActive ? 'text-green-500' : 'text-red-500'}`}>
                              {member.isActive ? 'Active' : 'Inactive'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className={`w-4 h-4 ${mutedClass}`} />
                          <div>
                            <p className={`text-[10px] ${mutedClass}`}>Joined</p>
                            <p className={`text-sm font-bold ${textClass}`}>
                              {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'Unknown'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building2 className={`w-4 h-4 ${mutedClass}`} />
                          <div>
                            <p className={`text-[10px] ${mutedClass}`}>Branch</p>
                            <p className={`text-sm font-bold ${textClass}`}>{member.branch?.name || 'Unassigned'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Attendant-specific info */}
                    {member.role === 'ATTENDANT' && (
                      <div className={`mt-4 pt-4 border-t ${borderClass}`}>
                        <div className="flex items-center gap-4">
                          {member.specialty && (
                            <div className={`px-3 py-2 rounded-lg text-xs font-bold ${darkMode ? 'bg-purple-900/30' : 'bg-purple-100'} text-purple-600 dark:text-purple-400`}>
                              Specialty: {member.specialty}
                            </div>
                          )}
                          {member.commissionRate > 0 && (
                            <div className={`px-3 py-2 rounded-lg text-xs font-bold ${darkMode ? 'bg-emerald-900/30' : 'bg-emerald-100'} text-emerald-600 dark:text-emerald-400`}>
                              {member.commissionRate}% Commission
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className={`mt-4 pt-4 border-t ${borderClass} flex flex-wrap gap-2`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenModal(member);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'} ${textClass} transition-colors`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      {member.role !== 'ATTENDANT' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPasswordModal(member);
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'} ${textClass} transition-colors`}
                        >
                          <Key className="w-3.5 h-3.5" />
                          Reset Password
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(member);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${
                          member.isActive
                            ? 'bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400'
                            : 'bg-green-100 hover:bg-green-200 text-green-600 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400'
                        } transition-colors`}
                      >
                        {member.isActive ? (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            Activate
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${surfaceClass} rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-base font-black uppercase ${textClass}`}>
                {editingStaff ? 'Edit Staff' : 'Add Staff'}
              </h2>
              <button onClick={handleCloseModal} className={`p-1.5 rounded-lg ${mutedClass} hover:bg-gray-100 dark:hover:bg-slate-700`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Top Row: Photo + Role */}
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Profile" className="w-14 h-14 rounded-xl object-cover" />
                  ) : (
                    <div className={`w-14 h-14 rounded-xl ${darkMode ? 'bg-slate-600' : 'bg-gray-200'} flex items-center justify-center`}>
                      <Users className={`w-6 h-6 ${mutedClass}`} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-slate-800 dark:bg-slate-600 text-white rounded-full flex items-center justify-center hover:bg-slate-700"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                </div>
                <div className="flex-1">
                  <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Role</label>
                  <select
                    value={formData.role === 'ADMIN' ? 'OWNER' : formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                  >
                    <option value="CASHIER">Cashier</option>
                    <option value="MANAGER">Manager</option>
                    <option value="OWNER">Owner</option>
                    <option value="ATTENDANT">Attendant</option>
                  </select>
                  {formData.role === 'ATTENDANT' && (
                    <p className={`text-[10px] ${mutedClass} mt-0.5`}>No login needed</p>
                  )}
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Full Name</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                  required
                />
              </div>

              {/* Username/Password - Only for non-ATTENDANT */}
              {!editingStaff && formData.role !== 'ATTENDANT' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Username</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                      required
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className={`w-full px-3 py-2 pr-8 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                        placeholder="Min 6"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 ${mutedClass}`}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Gender and DOB */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
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
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                  />
                </div>
              </div>

              {/* Phone and Email */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                  />
                </div>
                <div>
                  <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                />
              </div>

              {/* ATTENDANT fields */}
              {formData.role === 'ATTENDANT' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Specialty</label>
                    <input
                      type="text"
                      value={formData.specialty}
                      onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                      placeholder="e.g., Stylist"
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Commission %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.commissionRate}
                      onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                      placeholder="30"
                    />
                  </div>
                </div>
              )}

              {/* Branch */}
              <div>
                <label className={`block text-[10px] font-bold uppercase ${mutedClass} mb-1`}>Branch</label>
                <select
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                >
                  <option value="">Select Branch</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={`flex-1 px-3 py-2.5 rounded-lg border ${borderClass} ${textClass} font-bold text-xs uppercase`}
                  disabled={uploadingImage}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingImage}
                  className="flex-1 px-3 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-lg font-bold text-xs uppercase disabled:opacity-50"
                >
                  {uploadingImage ? 'Uploading...' : (editingStaff ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${surfaceClass} rounded-2xl p-6 w-full max-w-md`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-lg font-black uppercase ${textClass}`}>Reset Password</h2>
              <button onClick={() => setShowPasswordModal(false)} className={`p-2 rounded-lg ${mutedClass} hover:bg-gray-100 dark:hover:bg-slate-700`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className={`text-sm ${mutedClass} mb-4`}>
              Reset password for <strong>{passwordStaff?.fullName}</strong>
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`w-full px-4 py-3 pr-12 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                    placeholder="Min 6 characters"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${mutedClass} hover:opacity-70`}
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className={`flex-1 px-4 py-3 rounded-xl border ${borderClass} ${textClass} font-bold text-sm uppercase`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase"
                >
                  Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;
