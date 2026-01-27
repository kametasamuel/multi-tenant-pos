import React, { useState, useEffect } from 'react';
import { tablesAPI } from '../../api';
import { useBranch } from '../../context/BranchContext';
import {
  Armchair,
  Plus,
  Edit2,
  Trash2,
  Search,
  RefreshCw,
  Users,
  MapPin,
  Check,
  X,
  AlertCircle,
  LayoutGrid,
  List,
  Filter
} from 'lucide-react';

const Tables = ({ darkMode = false }) => {
  const { selectedBranch } = useBranch();
  const [tables, setTables] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSection, setSelectedSection] = useState('All');
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    tableNumber: '',
    capacity: 4,
    section: '',
    positionX: null,
    positionY: null
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Bulk create state
  const [bulkData, setBulkData] = useState({
    startNumber: 1,
    count: 10,
    capacity: 4,
    section: '',
    prefix: ''
  });

  // Theme classes
  const surfaceClass = darkMode ? 'bg-slate-800' : 'bg-white';
  const textClass = darkMode ? 'text-white' : 'text-slate-900';
  const mutedClass = darkMode ? 'text-slate-400' : 'text-slate-500';
  const borderClass = darkMode ? 'border-slate-700' : 'border-slate-200';
  const bgClass = darkMode ? 'bg-slate-900' : 'bg-slate-50';
  const inputClass = darkMode
    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400';

  useEffect(() => {
    loadTables();
  }, [selectedBranch]);

  const loadTables = async () => {
    setLoading(true);
    try {
      const params = selectedBranch ? { branchId: selectedBranch.id } : {};
      const response = await tablesAPI.getAll(params);
      setTables(response.data.tables || []);
      setSections(['All', ...(response.data.sections || [])]);
    } catch (error) {
      console.error('Failed to load tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.tableNumber.trim()) {
      setFormError('Table number is required');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const data = {
        ...formData,
        branchId: selectedBranch?.id
      };

      if (editingTable) {
        await tablesAPI.update(editingTable.id, data);
      } else {
        await tablesAPI.create(data);
      }

      setShowModal(false);
      setEditingTable(null);
      resetForm();
      loadTables();
    } catch (error) {
      setFormError(error.response?.data?.error || 'Failed to save table');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      const response = await tablesAPI.bulkCreate({
        ...bulkData,
        branchId: selectedBranch?.id
      });

      if (response.data.skipped?.length > 0) {
        alert(`Created ${response.data.created} tables. Skipped: ${response.data.skipped.join(', ')} (already exist)`);
      }

      setShowBulkModal(false);
      setBulkData({ startNumber: 1, count: 10, capacity: 4, section: '', prefix: '' });
      loadTables();
    } catch (error) {
      setFormError(error.response?.data?.error || 'Failed to create tables');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (table) => {
    if (!window.confirm(`Delete table ${table.tableNumber}?`)) return;

    try {
      await tablesAPI.delete(table.id);
      loadTables();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete table');
    }
  };

  const handleEdit = (table) => {
    setEditingTable(table);
    setFormData({
      tableNumber: table.tableNumber,
      capacity: table.capacity,
      section: table.section || '',
      positionX: table.positionX,
      positionY: table.positionY
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      tableNumber: '',
      capacity: 4,
      section: '',
      positionX: null,
      positionY: null
    });
    setFormError('');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'occupied': return 'bg-red-500';
      case 'reserved': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const filteredTables = tables.filter(table => {
    const matchesSearch = table.tableNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSection = selectedSection === 'All' || table.section === selectedSection;
    return matchesSearch && matchesSection;
  });

  const tableStats = {
    total: tables.length,
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length
  };

  return (
    <div className={`p-4 md:p-6 ${bgClass} min-h-full`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className={`text-2xl font-black ${textClass}`}>Tables</h1>
          <p className={`text-sm ${mutedClass}`}>
            Manage restaurant tables and seating
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className={`px-4 py-2 ${surfaceClass} border ${borderClass} rounded-xl text-sm font-bold ${textClass} hover:border-accent-500 transition-colors flex items-center gap-2`}
          >
            <LayoutGrid className="w-4 h-4" />
            Bulk Add
          </button>
          <button
            onClick={() => {
              resetForm();
              setEditingTable(null);
              setShowModal(true);
            }}
            className="px-4 py-2 bg-accent-500 text-white rounded-xl text-sm font-bold hover:bg-accent-600 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Table
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
          <p className={`text-sm ${mutedClass}`}>Total Tables</p>
          <p className={`text-2xl font-black ${textClass}`}>{tableStats.total}</p>
        </div>
        <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
          <p className={`text-sm ${mutedClass}`}>Available</p>
          <p className="text-2xl font-black text-green-500">{tableStats.available}</p>
        </div>
        <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
          <p className={`text-sm ${mutedClass}`}>Occupied</p>
          <p className="text-2xl font-black text-red-500">{tableStats.occupied}</p>
        </div>
        <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
          <p className={`text-sm ${mutedClass}`}>Reserved</p>
          <p className="text-2xl font-black text-yellow-500">{tableStats.reserved}</p>
        </div>
      </div>

      {/* Filters */}
      <div className={`${surfaceClass} rounded-xl border ${borderClass} p-4 mb-6`}>
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${mutedClass}`} />
              <input
                type="text"
                placeholder="Search tables..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${inputClass} focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none`}
              />
            </div>
          </div>

          {/* Section Filter */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {sections.map(section => (
              <button
                key={section}
                onClick={() => setSelectedSection(section)}
                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                  selectedSection === section
                    ? 'bg-accent-500 text-white'
                    : `${bgClass} ${textClass} hover:bg-accent-100`
                }`}
              >
                {section}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className={`flex items-center gap-1 p-1 rounded-lg ${bgClass}`}>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-accent-500 text-white' : mutedClass
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-accent-500 text-white' : mutedClass
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={loadTables}
            className={`p-2.5 rounded-xl ${bgClass} ${mutedClass} hover:text-accent-500 transition-colors`}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tables Grid/List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className={`w-8 h-8 animate-spin ${mutedClass}`} />
        </div>
      ) : filteredTables.length === 0 ? (
        <div className={`${surfaceClass} rounded-xl border ${borderClass} p-12 text-center`}>
          <Armchair className={`w-16 h-16 mx-auto mb-4 ${mutedClass}`} />
          <h3 className={`text-lg font-bold ${textClass} mb-2`}>No tables found</h3>
          <p className={mutedClass}>
            {tables.length === 0 ? 'Add your first table to get started' : 'Try adjusting your filters'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredTables.map(table => (
            <div
              key={table.id}
              className={`${surfaceClass} rounded-xl border ${borderClass} p-4 text-center relative group hover:border-accent-500 transition-colors`}
            >
              {/* Status Badge */}
              <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${getStatusColor(table.status)}`} />

              {/* Table Info */}
              <div className={`text-2xl font-black ${textClass} mb-2`}>
                {table.tableNumber}
              </div>
              <div className="flex items-center justify-center gap-1 mb-2">
                <Users className={`w-4 h-4 ${mutedClass}`} />
                <span className={mutedClass}>{table.capacity}</span>
              </div>
              {table.section && (
                <div className={`text-xs ${mutedClass} mb-2`}>
                  {table.section}
                </div>
              )}
              <div className={`text-xs font-medium capitalize ${
                table.status === 'available' ? 'text-green-500' :
                table.status === 'occupied' ? 'text-red-500' :
                'text-yellow-500'
              }`}>
                {table.status}
              </div>

              {/* Actions */}
              <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={() => handleEdit(table)}
                  className="p-2 bg-white rounded-lg text-slate-900 hover:bg-accent-100 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(table)}
                  className="p-2 bg-white rounded-lg text-red-500 hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`${surfaceClass} rounded-xl border ${borderClass} overflow-hidden`}>
          <table className="w-full">
            <thead className={bgClass}>
              <tr>
                <th className={`text-left px-4 py-3 text-xs font-bold uppercase ${mutedClass}`}>Table</th>
                <th className={`text-left px-4 py-3 text-xs font-bold uppercase ${mutedClass}`}>Capacity</th>
                <th className={`text-left px-4 py-3 text-xs font-bold uppercase ${mutedClass}`}>Section</th>
                <th className={`text-left px-4 py-3 text-xs font-bold uppercase ${mutedClass}`}>Status</th>
                <th className={`text-right px-4 py-3 text-xs font-bold uppercase ${mutedClass}`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${borderClass}`}>
              {filteredTables.map(table => (
                <tr key={table.id} className={`hover:${bgClass}`}>
                  <td className={`px-4 py-3 font-bold ${textClass}`}>{table.tableNumber}</td>
                  <td className={`px-4 py-3 ${mutedClass}`}>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {table.capacity}
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${mutedClass}`}>{table.section || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${
                      table.status === 'available' ? 'bg-green-100 text-green-700' :
                      table.status === 'occupied' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(table.status)}`} />
                      {table.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(table)}
                      className={`p-2 rounded-lg ${bgClass} ${mutedClass} hover:text-accent-500 transition-colors mr-2`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(table)}
                      className={`p-2 rounded-lg ${bgClass} ${mutedClass} hover:text-red-500 transition-colors`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${surfaceClass} rounded-2xl w-full max-w-md shadow-xl`}>
            <div className={`p-4 border-b ${borderClass} flex items-center justify-between`}>
              <h2 className={`text-lg font-black ${textClass}`}>
                {editingTable ? 'Edit Table' : 'Add Table'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingTable(null);
                  resetForm();
                }}
                className={`p-2 rounded-lg ${bgClass} ${mutedClass} hover:text-red-500 transition-colors`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className={`block text-sm font-bold mb-2 ${textClass}`}>
                  Table Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.tableNumber}
                  onChange={(e) => setFormData({ ...formData, tableNumber: e.target.value })}
                  placeholder="e.g., T1, A01"
                  className={`w-full px-4 py-2.5 rounded-xl border ${inputClass} focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none`}
                />
              </div>
              <div>
                <label className={`block text-sm font-bold mb-2 ${textClass}`}>Capacity</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 4 })}
                  className={`w-full px-4 py-2.5 rounded-xl border ${inputClass} focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none`}
                />
              </div>
              <div>
                <label className={`block text-sm font-bold mb-2 ${textClass}`}>Section</label>
                <input
                  type="text"
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  placeholder="e.g., Patio, Main Floor, VIP"
                  className={`w-full px-4 py-2.5 rounded-xl border ${inputClass} focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none`}
                />
              </div>

              {formError && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-xl flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{formError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingTable(null);
                    resetForm();
                  }}
                  className={`flex-1 py-3 border ${borderClass} rounded-xl font-bold ${mutedClass} hover:border-slate-400 transition-colors`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-accent-500 text-white rounded-xl font-bold hover:bg-accent-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {editingTable ? 'Update' : 'Create'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Create Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${surfaceClass} rounded-2xl w-full max-w-md shadow-xl`}>
            <div className={`p-4 border-b ${borderClass} flex items-center justify-between`}>
              <h2 className={`text-lg font-black ${textClass}`}>Bulk Add Tables</h2>
              <button
                onClick={() => setShowBulkModal(false)}
                className={`p-2 rounded-lg ${bgClass} ${mutedClass} hover:text-red-500 transition-colors`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleBulkCreate} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-bold mb-2 ${textClass}`}>Start Number</label>
                  <input
                    type="number"
                    min="1"
                    value={bulkData.startNumber}
                    onChange={(e) => setBulkData({ ...bulkData, startNumber: parseInt(e.target.value) || 1 })}
                    className={`w-full px-4 py-2.5 rounded-xl border ${inputClass} focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-bold mb-2 ${textClass}`}>Count</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={bulkData.count}
                    onChange={(e) => setBulkData({ ...bulkData, count: parseInt(e.target.value) || 1 })}
                    className={`w-full px-4 py-2.5 rounded-xl border ${inputClass} focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none`}
                  />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-bold mb-2 ${textClass}`}>Prefix (optional)</label>
                <input
                  type="text"
                  value={bulkData.prefix}
                  onChange={(e) => setBulkData({ ...bulkData, prefix: e.target.value })}
                  placeholder="e.g., T, A, VIP-"
                  className={`w-full px-4 py-2.5 rounded-xl border ${inputClass} focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none`}
                />
              </div>
              <div>
                <label className={`block text-sm font-bold mb-2 ${textClass}`}>Default Capacity</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={bulkData.capacity}
                  onChange={(e) => setBulkData({ ...bulkData, capacity: parseInt(e.target.value) || 4 })}
                  className={`w-full px-4 py-2.5 rounded-xl border ${inputClass} focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none`}
                />
              </div>
              <div>
                <label className={`block text-sm font-bold mb-2 ${textClass}`}>Section</label>
                <input
                  type="text"
                  value={bulkData.section}
                  onChange={(e) => setBulkData({ ...bulkData, section: e.target.value })}
                  placeholder="e.g., Main Floor"
                  className={`w-full px-4 py-2.5 rounded-xl border ${inputClass} focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none`}
                />
              </div>

              <div className={`p-3 rounded-xl ${bgClass} text-sm ${mutedClass}`}>
                Will create tables: <span className="font-bold">{bulkData.prefix}{bulkData.startNumber}</span> to <span className="font-bold">{bulkData.prefix}{bulkData.startNumber + bulkData.count - 1}</span>
              </div>

              {formError && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-xl flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{formError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className={`flex-1 py-3 border ${borderClass} rounded-xl font-bold ${mutedClass} hover:border-slate-400 transition-colors`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-accent-500 text-white rounded-xl font-bold hover:bg-accent-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create {bulkData.count} Tables
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tables;
