import React, { useState, useEffect } from 'react';
import {
  User, Plus, Search, Edit, Trash2, Star, Phone, Mail,
  MapPin, Building, Calendar, DollarSign, Award, X,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { guestsAPI } from '../../api';

const Guests = () => {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [vipFilter, setVipFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedGuest, setSelectedGuest] = useState(null);

  useEffect(() => {
    loadGuests();
  }, [pagination.page, vipFilter]);

  const loadGuests = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: 20,
        vipStatus: vipFilter || undefined
      };

      const response = await guestsAPI.getAll(params);
      setGuests(response.data.guests);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error loading guests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm || searchTerm.length < 2) {
      loadGuests();
      return;
    }

    try {
      setLoading(true);
      const response = await guestsAPI.search(searchTerm);
      setGuests(response.data);
      setPagination({ page: 1, pages: 1, total: response.data.length });
    } catch (error) {
      console.error('Error searching guests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedGuest(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleEdit = (guest) => {
    setSelectedGuest(guest);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleView = async (guestId) => {
    try {
      const response = await guestsAPI.getById(guestId);
      setSelectedGuest(response.data);
      setModalMode('view');
      setShowModal(true);
    } catch (error) {
      console.error('Error loading guest:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this guest?')) return;

    try {
      await guestsAPI.delete(id);
      loadGuests();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete guest');
    }
  };

  const handleSave = async (data) => {
    try {
      if (modalMode === 'edit') {
        await guestsAPI.update(selectedGuest.id, data);
      } else {
        await guestsAPI.create(data);
      }
      setShowModal(false);
      loadGuests();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to save guest');
    }
  };

  const handleVIPChange = async (guestId, newStatus) => {
    try {
      await guestsAPI.updateVIPStatus(guestId, newStatus);
      loadGuests();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update VIP status');
    }
  };

  const getVIPColor = (status) => {
    const colors = {
      regular: 'bg-gray-100 text-gray-800',
      silver: 'bg-gray-200 text-gray-800',
      gold: 'bg-yellow-100 text-yellow-800',
      platinum: 'bg-purple-100 text-purple-800'
    };
    return colors[status] || colors.regular;
  };

  const getVIPIcon = (status) => {
    if (status === 'platinum') return <Award className="w-4 h-4 text-purple-600" />;
    if (status === 'gold') return <Star className="w-4 h-4 text-yellow-600" />;
    if (status === 'silver') return <Star className="w-4 h-4 text-gray-400" />;
    return null;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guest Management</h1>
          <p className="text-gray-600">Manage guest profiles and history</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Guest
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Guests</p>
              <p className="text-xl font-bold">{pagination.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Award className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Platinum</p>
              <p className="text-xl font-bold text-purple-600">
                {guests.filter(g => g.vipStatus === 'platinum').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Star className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Gold</p>
              <p className="text-xl font-bold text-yellow-600">
                {guests.filter(g => g.vipStatus === 'gold').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Star className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Silver</p>
              <p className="text-xl font-bold text-gray-600">
                {guests.filter(g => g.vipStatus === 'silver').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, email, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          Search
        </button>
        <select
          value={vipFilter}
          onChange={(e) => setVipFilter(e.target.value)}
          className="border rounded-lg px-3 py-2"
        >
          <option value="">All VIP Status</option>
          <option value="platinum">Platinum</option>
          <option value="gold">Gold</option>
          <option value="silver">Silver</option>
          <option value="regular">Regular</option>
        </select>
      </div>

      {/* Guests Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4">Guest</th>
              <th className="text-left p-4">Contact</th>
              <th className="text-left p-4">ID</th>
              <th className="text-left p-4">VIP Status</th>
              <th className="text-left p-4">Stays</th>
              <th className="text-left p-4">Total Spent</th>
              <th className="text-left p-4">Last Stay</th>
              <th className="text-right p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </td>
              </tr>
            ) : guests.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500">
                  No guests found
                </td>
              </tr>
            ) : (
              guests.map(guest => (
                <tr
                  key={guest.id}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleView(guest.id)}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{guest.firstName} {guest.lastName}</p>
                        {guest.company && (
                          <p className="text-xs text-gray-500">{guest.company}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      {guest.phone && (
                        <p className="flex items-center gap-1 text-gray-600">
                          <Phone className="w-3 h-3" /> {guest.phone}
                        </p>
                      )}
                      {guest.email && (
                        <p className="flex items-center gap-1 text-gray-500 text-xs">
                          <Mail className="w-3 h-3" /> {guest.email}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    {guest.idNumber ? (
                      <div className="text-sm">
                        <p className="text-gray-600">{guest.idNumber}</p>
                        <p className="text-xs text-gray-400">{guest.idType}</p>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={guest.vipStatus}
                      onChange={(e) => handleVIPChange(guest.id, e.target.value)}
                      className={`px-2 py-1 rounded-full text-xs font-medium border-0 ${getVIPColor(guest.vipStatus)}`}
                    >
                      <option value="regular">Regular</option>
                      <option value="silver">Silver</option>
                      <option value="gold">Gold</option>
                      <option value="platinum">Platinum</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <span className="font-medium">{guest.totalStays}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-medium text-green-600">
                      ${guest.totalSpent?.toFixed(2) || '0.00'}
                    </span>
                  </td>
                  <td className="p-4">
                    {guest.lastStayAt ? (
                      <span className="text-sm text-gray-600">
                        {new Date(guest.lastStayAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-gray-400">Never</span>
                    )}
                  </td>
                  <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleEdit(guest)}
                      className="p-1 text-gray-400 hover:text-blue-600 mr-2"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(guest.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.pages} ({pagination.total} guests)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page === pagination.pages}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <GuestModal
          mode={modalMode}
          guest={selectedGuest}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

// Guest Modal
const GuestModal = ({ mode, guest, onClose, onSave }) => {
  const [formData, setFormData] = useState(
    guest || {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      idType: '',
      idNumber: '',
      nationality: '',
      dateOfBirth: '',
      address: '',
      city: '',
      country: '',
      company: '',
      vipStatus: 'regular',
      notes: ''
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'view') {
      onClose();
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold">
            {mode === 'view' ? 'Guest Details' : mode === 'edit' ? 'Edit Guest' : 'New Guest'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* View Mode - Show Stats */}
          {mode === 'view' && guest && (
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{guest.totalStays}</p>
                <p className="text-sm text-gray-600">Total Stays</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">${guest.totalSpent?.toFixed(2)}</p>
                <p className="text-sm text-gray-600">Total Spent</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-600 capitalize">{guest.vipStatus}</p>
                <p className="text-sm text-gray-600">VIP Status</p>
              </div>
            </div>
          )}

          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">First Name *</label>
              <input
                type="text"
                required
                disabled={mode === 'view'}
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name *</label>
              <input
                type="text"
                required
                disabled={mode === 'view'}
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="tel"
                disabled={mode === 'view'}
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                disabled={mode === 'view'}
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* ID */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">ID Type</label>
              <select
                disabled={mode === 'view'}
                value={formData.idType || ''}
                onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
              >
                <option value="">Select...</option>
                <option value="passport">Passport</option>
                <option value="national_id">National ID</option>
                <option value="drivers_license">Driver's License</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ID Number</label>
              <input
                type="text"
                disabled={mode === 'view'}
                value={formData.idNumber || ''}
                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Personal */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nationality</label>
              <input
                type="text"
                disabled={mode === 'view'}
                value={formData.nationality || ''}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date of Birth</label>
              <input
                type="date"
                disabled={mode === 'view'}
                value={formData.dateOfBirth ? formData.dateOfBirth.split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <input
              type="text"
              disabled={mode === 'view'}
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input
                type="text"
                disabled={mode === 'view'}
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <input
                type="text"
                disabled={mode === 'view'}
                value={formData.country || ''}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Company */}
          <div>
            <label className="block text-sm font-medium mb-1">Company</label>
            <input
              type="text"
              disabled={mode === 'view'}
              value={formData.company || ''}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
            />
          </div>

          {/* VIP Status */}
          {mode !== 'view' && (
            <div>
              <label className="block text-sm font-medium mb-1">VIP Status</label>
              <select
                value={formData.vipStatus}
                onChange={(e) => setFormData({ ...formData, vipStatus: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="regular">Regular</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
                <option value="platinum">Platinum</option>
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              disabled={mode === 'view'}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
              rows={3}
            />
          </div>

          {/* Booking History (View Mode) */}
          {mode === 'view' && guest?.bookings && guest.bookings.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Recent Bookings</h3>
              <div className="space-y-2">
                {guest.bookings.map(booking => (
                  <div key={booking.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                    <div>
                      <p className="font-medium">{booking.bookingNumber}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(booking.checkInDate).toLocaleDateString()} - {new Date(booking.checkOutDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      booking.status === 'checked_out' ? 'bg-gray-100 text-gray-800' :
                      booking.status === 'checked_in' ? 'bg-green-100 text-green-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {booking.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              {mode === 'view' ? 'Close' : 'Cancel'}
            </button>
            {mode !== 'view' && (
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {mode === 'edit' ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Guests;
