import React, { useState, useEffect } from 'react';
import {
  BedDouble, Plus, Edit, Trash2, Search, Filter,
  Home, DoorOpen, Wrench, Sparkles, Users, DollarSign,
  ChevronDown, ChevronRight, MoreVertical, X
} from 'lucide-react';
import { roomsAPI } from '../../api';

const Rooms = () => {
  const [roomTypes, setRoomTypes] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms' | 'types'
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [selectedItem, setSelectedItem] = useState(null);
  const [filters, setFilters] = useState({ status: '', roomTypeId: '', floor: '' });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [typesRes, roomsRes] = await Promise.all([
        roomsAPI.getTypes({ includeInactive: true }),
        roomsAPI.getAll({ includeInactive: true })
      ]);
      setRoomTypes(typesRes.data);
      setRooms(roomsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      available: 'bg-green-100 text-green-800',
      occupied: 'bg-blue-100 text-blue-800',
      reserved: 'bg-yellow-100 text-yellow-800',
      cleaning: 'bg-purple-100 text-purple-800',
      maintenance: 'bg-orange-100 text-orange-800',
      out_of_order: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getCleaningColor = (status) => {
    const colors = {
      clean: 'bg-green-100 text-green-800',
      dirty: 'bg-red-100 text-red-800',
      inspecting: 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredRooms = rooms.filter(room => {
    if (filters.status && room.status !== filters.status) return false;
    if (filters.roomTypeId && room.roomTypeId !== filters.roomTypeId) return false;
    if (filters.floor && room.floor !== filters.floor) return false;
    if (searchTerm && !room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const floors = [...new Set(rooms.map(r => r.floor).filter(Boolean))].sort();

  const handleCreateType = () => {
    setSelectedItem(null);
    setModalMode('create');
    setActiveTab('types');
    setShowModal(true);
  };

  const handleCreateRoom = () => {
    setSelectedItem(null);
    setModalMode('create');
    setActiveTab('rooms');
    setShowModal(true);
  };

  const handleEdit = (item, type) => {
    setSelectedItem(item);
    setModalMode('edit');
    setActiveTab(type);
    setShowModal(true);
  };

  const handleDelete = async (id, type) => {
    if (!window.confirm(`Are you sure you want to delete this ${type === 'types' ? 'room type' : 'room'}?`)) {
      return;
    }

    try {
      if (type === 'types') {
        await roomsAPI.deleteType(id);
      } else {
        await roomsAPI.delete(id);
      }
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete');
    }
  };

  const handleSaveType = async (data) => {
    try {
      if (modalMode === 'edit') {
        await roomsAPI.updateType(selectedItem.id, data);
      } else {
        await roomsAPI.createType(data);
      }
      setShowModal(false);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to save');
    }
  };

  const handleSaveRoom = async (data) => {
    try {
      if (modalMode === 'edit') {
        await roomsAPI.update(selectedItem.id, data);
      } else {
        await roomsAPI.create(data);
      }
      setShowModal(false);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to save');
    }
  };

  const handleStatusChange = async (roomId, status) => {
    try {
      await roomsAPI.updateStatus(roomId, { status });
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update status');
    }
  };

  // Summary stats
  const stats = {
    total: rooms.length,
    available: rooms.filter(r => r.status === 'available' && r.cleaningStatus === 'clean').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    dirty: rooms.filter(r => r.cleaningStatus === 'dirty').length,
    maintenance: rooms.filter(r => r.status === 'maintenance' || r.status === 'out_of_order').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Room Management</h1>
          <p className="text-gray-600">Manage room types and individual rooms</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCreateType}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <Plus className="w-4 h-4" />
            Add Room Type
          </button>
          <button
            onClick={handleCreateRoom}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Room
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <BedDouble className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Rooms</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DoorOpen className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Available</p>
              <p className="text-xl font-bold text-green-600">{stats.available}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Occupied</p>
              <p className="text-xl font-bold text-blue-600">{stats.occupied}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Needs Cleaning</p>
              <p className="text-xl font-bold text-purple-600">{stats.dirty}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Wrench className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Maintenance</p>
              <p className="text-xl font-bold text-orange-600">{stats.maintenance}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-4 border-b">
        <button
          onClick={() => setActiveTab('rooms')}
          className={`pb-2 px-1 ${activeTab === 'rooms' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-gray-500'}`}
        >
          Rooms ({rooms.length})
        </button>
        <button
          onClick={() => setActiveTab('types')}
          className={`pb-2 px-1 ${activeTab === 'types' ? 'border-b-2 border-blue-600 text-blue-600 font-medium' : 'text-gray-500'}`}
        >
          Room Types ({roomTypes.length})
        </button>
      </div>

      {/* Rooms Tab */}
      {activeTab === 'rooms' && (
        <>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="border rounded-lg px-3 py-2"
            >
              <option value="">All Status</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="reserved">Reserved</option>
              <option value="cleaning">Cleaning</option>
              <option value="maintenance">Maintenance</option>
              <option value="out_of_order">Out of Order</option>
            </select>
            <select
              value={filters.roomTypeId}
              onChange={(e) => setFilters({ ...filters, roomTypeId: e.target.value })}
              className="border rounded-lg px-3 py-2"
            >
              <option value="">All Types</option>
              {roomTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
            <select
              value={filters.floor}
              onChange={(e) => setFilters({ ...filters, floor: e.target.value })}
              className="border rounded-lg px-3 py-2"
            >
              <option value="">All Floors</option>
              {floors.map(floor => (
                <option key={floor} value={floor}>Floor {floor}</option>
              ))}
            </select>
          </div>

          {/* Rooms Grid */}
          <div className="grid grid-cols-4 gap-4">
            {filteredRooms.map(room => (
              <div
                key={room.id}
                className={`bg-white rounded-lg shadow-sm border p-4 ${!room.isActive ? 'opacity-50' : ''}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{room.roomNumber}</h3>
                    <p className="text-sm text-gray-500">{room.roomType?.name}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(room, 'rooms')}
                      className="p-1 text-gray-400 hover:text-blue-600"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(room.id, 'rooms')}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 mb-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>
                    {room.status}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCleaningColor(room.cleaningStatus)}`}>
                    {room.cleaningStatus}
                  </span>
                </div>

                {room.floor && (
                  <p className="text-sm text-gray-500">Floor: {room.floor}</p>
                )}

                {/* Quick status change */}
                <div className="mt-3 pt-3 border-t">
                  <select
                    value={room.status}
                    onChange={(e) => handleStatusChange(room.id, e.target.value)}
                    className="w-full text-sm border rounded px-2 py-1"
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="reserved">Reserved</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="out_of_order">Out of Order</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {filteredRooms.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No rooms found. Create your first room to get started.
            </div>
          )}
        </>
      )}

      {/* Room Types Tab */}
      {activeTab === 'types' && (
        <div className="bg-white rounded-lg shadow-sm border">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Code</th>
                <th className="text-left p-4">Base Price</th>
                <th className="text-left p-4">Max Occupancy</th>
                <th className="text-left p-4">Bed Type</th>
                <th className="text-left p-4">Rooms</th>
                <th className="text-left p-4">Status</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roomTypes.map(type => (
                <tr key={type.id} className="border-b hover:bg-gray-50">
                  <td className="p-4 font-medium">{type.name}</td>
                  <td className="p-4 text-gray-500">{type.code}</td>
                  <td className="p-4">${type.basePrice.toFixed(2)}</td>
                  <td className="p-4">{type.maxOccupancy} guests</td>
                  <td className="p-4">{type.bedType || '-'}</td>
                  <td className="p-4">{type._count?.rooms || 0} rooms</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${type.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {type.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleEdit(type, 'types')}
                      className="p-1 text-gray-400 hover:text-blue-600 mr-2"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(type.id, 'types')}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {roomTypes.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No room types found. Create your first room type to get started.
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal
          mode={modalMode}
          type={activeTab}
          item={selectedItem}
          roomTypes={roomTypes}
          onClose={() => setShowModal(false)}
          onSave={activeTab === 'types' ? handleSaveType : handleSaveRoom}
        />
      )}
    </div>
  );
};

// Modal Component
const Modal = ({ mode, type, item, roomTypes, onClose, onSave }) => {
  const [formData, setFormData] = useState(
    item || (type === 'types' ? {
      name: '',
      code: '',
      description: '',
      basePrice: '',
      maxOccupancy: 2,
      bedType: '',
      bedCount: 1,
      size: '',
      isActive: true
    } : {
      roomNumber: '',
      roomTypeId: '',
      floor: '',
      building: '',
      notes: '',
      isActive: true
    })
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold">
            {mode === 'edit' ? 'Edit' : 'Create'} {type === 'types' ? 'Room Type' : 'Room'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {type === 'types' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="e.g., Deluxe Double"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="e.g., DLX"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Base Price/Night *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Occupancy</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxOccupancy}
                    onChange={(e) => setFormData({ ...formData, maxOccupancy: parseInt(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Bed Type</label>
                  <select
                    value={formData.bedType || ''}
                    onChange={(e) => setFormData({ ...formData, bedType: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select...</option>
                    <option value="Single">Single</option>
                    <option value="Double">Double</option>
                    <option value="Queen">Queen</option>
                    <option value="King">King</option>
                    <option value="Twin">Twin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Number of Beds</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.bedCount}
                    onChange={(e) => setFormData({ ...formData, bedCount: parseInt(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Room Size (sq m)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.size || ''}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Room Type *</label>
                <select
                  required
                  value={formData.roomTypeId}
                  onChange={(e) => setFormData({ ...formData, roomTypeId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Select room type...</option>
                  {roomTypes.filter(t => t.isActive).map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Room Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.roomNumber}
                    onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="e.g., 101"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Floor</label>
                  <input
                    type="text"
                    value={formData.floor || ''}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="e.g., 1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Building</label>
                <input
                  type="text"
                  value={formData.building || ''}
                  onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., Main Building"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="isActive" className="text-sm">Active</label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {mode === 'edit' ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Rooms;
