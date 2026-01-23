import React, { useState, useEffect, useRef } from 'react';
import { ownerAPI } from '../../api';
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
  Eye,
  EyeOff,
  Camera,
  Trash2,
  Upload
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
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'CASHIER',
    branchId: ''
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
        username: staffMember.username,
        password: '',
        fullName: staffMember.fullName,
        role: staffMember.role,
        branchId: staffMember.branchId || ''
      });
      // Set image preview if user has a profile image
      if (staffMember.profileImage) {
        setImagePreview(`http://localhost:5000${staffMember.profileImage}`);
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
        branchId: mainBranch?.id || ''
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
      if (editingStaff) {
        await ownerAPI.updateStaff(editingStaff.id, {
          fullName: formData.fullName,
          role: formData.role,
          branchId: formData.branchId || null
        });
        userId = editingStaff.id;

        // Upload image if selected
        if (selectedImage) {
          await uploadImage(userId);
        }

        setSuccess('Staff member updated successfully');
      } else {
        if (!formData.password) {
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
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  // Display OWNER for both OWNER and ADMIN roles
  const getDisplayRole = (role) => {
    return role === 'ADMIN' ? 'OWNER' : role;
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

      {/* Staff List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
        </div>
      ) : (
        <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`px-6 py-4 text-left text-xs font-black uppercase ${mutedClass}`}>Staff</th>
                  <th className={`px-6 py-4 text-left text-xs font-black uppercase ${mutedClass}`}>Role</th>
                  <th className={`px-6 py-4 text-left text-xs font-black uppercase ${mutedClass}`}>Branch</th>
                  <th className={`px-6 py-4 text-left text-xs font-black uppercase ${mutedClass}`}>Status</th>
                  <th className={`px-6 py-4 text-left text-xs font-black uppercase ${mutedClass}`}>Sales</th>
                  <th className={`px-6 py-4 text-right text-xs font-black uppercase ${mutedClass}`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {staff.map(member => (
                  <tr key={member.id} className={`${!member.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {member.profileImage ? (
                          <img
                            src={`http://localhost:5000${member.profileImage}`}
                            alt={member.fullName}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-slate-600' : 'bg-gray-200'} flex items-center justify-center`}>
                            <span className={`text-sm font-bold ${textClass}`}>{member.fullName?.charAt(0)}</span>
                          </div>
                        )}
                        <div>
                          <p className={`text-sm font-bold ${textClass}`}>{member.fullName}</p>
                          <p className={`text-xs ${mutedClass}`}>@{member.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getRoleBadgeClass(member.role)}`}>
                        {getDisplayRole(member.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className={`w-4 h-4 ${mutedClass}`} />
                        <span className={`text-sm ${textClass}`}>{member.branch?.name || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        member.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${textClass}`}>{member._count?.sales || 0}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(member)}
                          className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'} transition-colors`}
                          title="Edit"
                        >
                          <Edit2 className={`w-4 h-4 ${mutedClass}`} />
                        </button>
                        <button
                          onClick={() => handleOpenPasswordModal(member)}
                          className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'} transition-colors`}
                          title="Reset Password"
                        >
                          <Key className={`w-4 h-4 ${mutedClass}`} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(member)}
                          className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'} transition-colors`}
                          title={member.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {member.isActive ? (
                            <UserX className="w-4 h-4 text-red-500" />
                          ) : (
                            <UserCheck className="w-4 h-4 text-green-500" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {staff.length === 0 && (
            <div className="p-12 text-center">
              <Users className={`w-12 h-12 mx-auto ${mutedClass} mb-4`} />
              <p className={`text-sm ${mutedClass}`}>No staff members found</p>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${surfaceClass} rounded-2xl p-6 w-full max-w-md`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-lg font-black uppercase ${textClass}`}>
                {editingStaff ? 'Edit Staff' : 'Add Staff'}
              </h2>
              <button onClick={handleCloseModal} className={`p-2 rounded-lg ${mutedClass} hover:bg-gray-100 dark:hover:bg-slate-700`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Profile Image Upload */}
              <div className="flex flex-col items-center mb-4">
                <div className="relative">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Profile preview"
                      className="w-24 h-24 rounded-full object-cover border-4 border-slate-200 dark:border-slate-600"
                    />
                  ) : (
                    <div className={`w-24 h-24 rounded-full ${darkMode ? 'bg-slate-600' : 'bg-gray-200'} flex items-center justify-center border-4 border-slate-200 dark:border-slate-600`}>
                      <Users className={`w-10 h-10 ${mutedClass}`} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-slate-800 dark:bg-slate-600 text-white rounded-full flex items-center justify-center hover:bg-slate-700 transition-colors"
                    title="Upload photo"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                {imagePreview && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="mt-2 text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove photo
                  </button>
                )}
                <p className={`text-xs ${mutedClass} mt-2`}>Click to upload profile photo</p>
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Full Name</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                  required
                />
              </div>

              {!editingStaff && (
                <>
                  <div>
                    <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Username</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                      required
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className={`w-full px-4 py-3 pr-12 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                        placeholder="Min 6 characters"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 ${mutedClass} hover:opacity-70`}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Role</label>
                <select
                  value={formData.role === 'ADMIN' ? 'OWNER' : formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                >
                  <option value="CASHIER">Cashier</option>
                  <option value="MANAGER">Manager</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase ${mutedClass} mb-2`}>Branch</label>
                <select
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border ${borderClass} ${surfaceClass} ${textClass}`}
                >
                  <option value="">Select Branch</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} {branch.isMain ? '(Main)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={`flex-1 px-4 py-3 rounded-xl border ${borderClass} ${textClass} font-bold text-sm uppercase`}
                  disabled={uploadingImage}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingImage}
                  className="flex-1 px-4 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploadingImage ? (
                    <>
                      <Upload className="w-4 h-4 animate-pulse" />
                      Uploading...
                    </>
                  ) : (
                    editingStaff ? 'Update' : 'Create'
                  )}
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
