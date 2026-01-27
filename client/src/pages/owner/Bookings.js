import React, { useState, useEffect } from 'react';
import {
  Calendar, Plus, Search, Filter, User, BedDouble, Clock,
  CheckCircle, XCircle, ArrowRight, DollarSign, AlertCircle,
  ChevronLeft, ChevronRight, X, Phone, Mail
} from 'lucide-react';
import { bookingsAPI, guestsAPI, roomsAPI } from '../../api';

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
    source: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'

  useEffect(() => {
    loadBookings();
  }, [pagination.page, filters]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: 20,
        ...filters
      };

      const response = await bookingsAPI.getAll(params);
      setBookings(response.data.bookings);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      checked_in: 'bg-green-100 text-green-800',
      checked_out: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      no_show: 'bg-orange-100 text-orange-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getSourceLabel = (source) => {
    const labels = {
      direct: 'Direct',
      website: 'Website',
      'booking.com': 'Booking.com',
      expedia: 'Expedia',
      phone: 'Phone',
      walk_in: 'Walk-in'
    };
    return labels[source] || source;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (time) => {
    if (!time) return '-';
    return time;
  };

  const handleViewBooking = (booking) => {
    setSelectedBooking(booking);
  };

  const handleCheckIn = async (id) => {
    try {
      await bookingsAPI.checkIn(id, {});
      loadBookings();
      setSelectedBooking(null);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to check in');
    }
  };

  const handleCheckOut = async (id) => {
    try {
      await bookingsAPI.checkOut(id, {});
      loadBookings();
      setSelectedBooking(null);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to check out');
    }
  };

  const handleCancel = async (id) => {
    const reason = prompt('Enter cancellation reason:');
    if (!reason) return;

    try {
      await bookingsAPI.cancel(id, reason);
      loadBookings();
      setSelectedBooking(null);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to cancel');
    }
  };

  const filteredBookings = bookings.filter(booking => {
    if (!searchTerm) return true;
    const guestName = `${booking.guest?.firstName} ${booking.guest?.lastName}`.toLowerCase();
    return guestName.includes(searchTerm.toLowerCase()) ||
      booking.bookingNumber.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const stats = {
    total: pagination.total,
    arrivals: bookings.filter(b =>
      new Date(b.checkInDate).toDateString() === today.toDateString() &&
      (b.status === 'confirmed' || b.status === 'pending')
    ).length,
    departures: bookings.filter(b =>
      new Date(b.checkOutDate).toDateString() === today.toDateString() &&
      b.status === 'checked_in'
    ).length,
    inHouse: bookings.filter(b => b.status === 'checked_in').length
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-600">Manage reservations and guest stays</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Booking
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Bookings</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <ArrowRight className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Today's Arrivals</p>
              <p className="text-xl font-bold text-green-600">{stats.arrivals}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ArrowRight className="w-5 h-5 text-orange-600 transform rotate-180" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Today's Departures</p>
              <p className="text-xl font-bold text-orange-600">{stats.departures}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <User className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">In-House</p>
              <p className="text-xl font-bold text-purple-600">{stats.inHouse}</p>
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
            placeholder="Search by guest name or booking number..."
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
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="checked_in">Checked In</option>
          <option value="checked_out">Checked Out</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
        </select>
        <select
          value={filters.source}
          onChange={(e) => setFilters({ ...filters, source: e.target.value })}
          className="border rounded-lg px-3 py-2"
        >
          <option value="">All Sources</option>
          <option value="direct">Direct</option>
          <option value="website">Website</option>
          <option value="phone">Phone</option>
          <option value="walk_in">Walk-in</option>
        </select>
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          className="border rounded-lg px-3 py-2"
        />
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4">Booking #</th>
              <th className="text-left p-4">Guest</th>
              <th className="text-left p-4">Room(s)</th>
              <th className="text-left p-4">Check-in</th>
              <th className="text-left p-4">Check-out</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Source</th>
              <th className="text-right p-4">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </td>
              </tr>
            ) : filteredBookings.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500">
                  No bookings found
                </td>
              </tr>
            ) : (
              filteredBookings.map(booking => (
                <tr
                  key={booking.id}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleViewBooking(booking)}
                >
                  <td className="p-4 font-medium">{booking.bookingNumber}</td>
                  <td className="p-4">
                    <div>
                      <p className="font-medium">
                        {booking.guest?.firstName} {booking.guest?.lastName}
                      </p>
                      {booking.guest?.vipStatus !== 'regular' && (
                        <span className="text-xs text-yellow-600 font-medium">
                          {booking.guest.vipStatus.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    {booking.rooms?.map(br => (
                      <span key={br.id} className="inline-block bg-gray-100 px-2 py-1 rounded text-sm mr-1">
                        {br.room?.roomNumber}
                      </span>
                    ))}
                  </td>
                  <td className="p-4">
                    <div>
                      <p>{formatDate(booking.checkInDate)}</p>
                      {booking.expectedArrival && (
                        <p className="text-xs text-gray-500">{booking.expectedArrival}</p>
                      )}
                    </div>
                  </td>
                  <td className="p-4">{formatDate(booking.checkOutDate)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                      {booking.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-gray-600">{getSourceLabel(booking.source)}</span>
                  </td>
                  <td className="p-4 text-right font-medium">
                    ${booking.totalAmount?.toFixed(2)}
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
              Showing {((pagination.page - 1) * 20) + 1} to {Math.min(pagination.page * 20, pagination.total)} of {pagination.total} bookings
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

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onCheckIn={() => handleCheckIn(selectedBooking.id)}
          onCheckOut={() => handleCheckOut(selectedBooking.id)}
          onCancel={() => handleCancel(selectedBooking.id)}
        />
      )}

      {/* New Booking Modal */}
      {showModal && (
        <NewBookingModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            loadBookings();
          }}
        />
      )}
    </div>
  );
};

// Booking Detail Modal
const BookingDetailModal = ({ booking, onClose, onCheckIn, onCheckOut, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold">Booking {booking.bookingNumber}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              booking.status === 'checked_in' ? 'bg-green-100 text-green-800' :
              booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
              booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {booking.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {/* Guest Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-2">Guest Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">{booking.guest?.firstName} {booking.guest?.lastName}</p>
              </div>
              {booking.guest?.phone && (
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="flex items-center gap-1">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {booking.guest.phone}
                  </p>
                </div>
              )}
              {booking.guest?.email && (
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="flex items-center gap-1">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {booking.guest.email}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">VIP Status</p>
                <p className="font-medium">{booking.guest?.vipStatus || 'Regular'}</p>
              </div>
            </div>
          </div>

          {/* Stay Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Check-in</p>
              <p className="font-medium">
                {new Date(booking.checkInDate).toLocaleDateString()}
                {booking.expectedArrival && ` at ${booking.expectedArrival}`}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Check-out</p>
              <p className="font-medium">{new Date(booking.checkOutDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Guests</p>
              <p className="font-medium">{booking.adultsCount} Adults, {booking.childrenCount} Children</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Source</p>
              <p className="font-medium">{booking.source}</p>
            </div>
          </div>

          {/* Rooms */}
          <div>
            <h3 className="font-medium mb-2">Room(s)</h3>
            <div className="space-y-2">
              {booking.rooms?.map(br => (
                <div key={br.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                  <div>
                    <p className="font-medium">Room {br.room?.roomNumber}</p>
                    <p className="text-sm text-gray-500">{br.room?.roomType?.name}</p>
                  </div>
                  <p className="font-medium">${br.ratePerNight}/night</p>
                </div>
              ))}
            </div>
          </div>

          {/* Payment */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Amount</span>
              <span className="text-xl font-bold">${booking.totalAmount?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-gray-600">Paid</span>
              <span className="text-green-600 font-medium">${booking.paidAmount?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-blue-200">
              <span className="font-medium">Balance Due</span>
              <span className="text-lg font-bold text-blue-600">
                ${(booking.totalAmount - booking.paidAmount).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Special Requests */}
          {booking.specialRequests && (
            <div>
              <h3 className="font-medium mb-2">Special Requests</h3>
              <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">{booking.specialRequests}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            {booking.status === 'confirmed' && (
              <button
                onClick={onCheckIn}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4" />
                Check In
              </button>
            )}
            {booking.status === 'checked_in' && (
              <button
                onClick={onCheckOut}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <ArrowRight className="w-4 h-4" />
                Check Out
              </button>
            )}
            {(booking.status === 'pending' || booking.status === 'confirmed') && (
              <button
                onClick={onCancel}
                className="flex items-center justify-center gap-2 px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// New Booking Modal
const NewBookingModal = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    guestId: '',
    checkInDate: '',
    checkOutDate: '',
    rooms: [],
    adultsCount: 1,
    childrenCount: 0,
    source: 'direct',
    expectedArrival: '',
    specialRequests: '',
    depositAmount: 0
  });
  const [guestSearch, setGuestSearch] = useState('');
  const [guestResults, setGuestResults] = useState([]);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [roomTypes, setRoomTypes] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRoomTypes();
  }, []);

  useEffect(() => {
    if (formData.checkInDate && formData.checkOutDate) {
      loadAvailableRooms();
    }
  }, [formData.checkInDate, formData.checkOutDate]);

  const loadRoomTypes = async () => {
    try {
      const response = await roomsAPI.getTypes({});
      setRoomTypes(response.data);
    } catch (error) {
      console.error('Error loading room types:', error);
    }
  };

  const loadAvailableRooms = async () => {
    try {
      const response = await roomsAPI.getAvailability({
        checkIn: formData.checkInDate,
        checkOut: formData.checkOutDate
      });
      setAvailableRooms(response.data.summary || []);
    } catch (error) {
      console.error('Error loading availability:', error);
    }
  };

  const searchGuests = async (query) => {
    if (query.length < 2) {
      setGuestResults([]);
      return;
    }

    try {
      const response = await guestsAPI.search(query);
      setGuestResults(response.data);
    } catch (error) {
      console.error('Error searching guests:', error);
    }
  };

  const handleSelectGuest = (guest) => {
    setSelectedGuest(guest);
    setFormData({ ...formData, guestId: guest.id });
    setGuestResults([]);
    setGuestSearch('');
  };

  const handleSelectRoom = (roomTypeId, roomId, rate) => {
    const existingIndex = formData.rooms.findIndex(r => r.roomId === roomId);
    if (existingIndex >= 0) {
      setFormData({
        ...formData,
        rooms: formData.rooms.filter(r => r.roomId !== roomId)
      });
    } else {
      setFormData({
        ...formData,
        rooms: [...formData.rooms, { roomId, ratePerNight: rate }]
      });
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await bookingsAPI.create(formData);
      onSuccess();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    if (!formData.checkInDate || !formData.checkOutDate || formData.rooms.length === 0) {
      return 0;
    }
    const nights = Math.ceil(
      (new Date(formData.checkOutDate) - new Date(formData.checkInDate)) / (1000 * 60 * 60 * 24)
    );
    return formData.rooms.reduce((sum, r) => sum + (r.ratePerNight * nights), 0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold">New Booking</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Step 1: Guest Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Guest *</label>
            {selectedGuest ? (
              <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
                <div>
                  <p className="font-medium">{selectedGuest.firstName} {selectedGuest.lastName}</p>
                  <p className="text-sm text-gray-500">{selectedGuest.phone || selectedGuest.email}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedGuest(null);
                    setFormData({ ...formData, guestId: '' });
                  }}
                  className="text-red-600 hover:underline text-sm"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search guest by name, phone, or email..."
                  value={guestSearch}
                  onChange={(e) => {
                    setGuestSearch(e.target.value);
                    searchGuests(e.target.value);
                  }}
                  className="w-full border rounded-lg px-3 py-2"
                />
                {guestResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {guestResults.map(guest => (
                      <button
                        key={guest.id}
                        onClick={() => handleSelectGuest(guest)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50"
                      >
                        <p className="font-medium">{guest.firstName} {guest.lastName}</p>
                        <p className="text-sm text-gray-500">{guest.phone || guest.email}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Check-in Date *</label>
              <input
                type="date"
                value={formData.checkInDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Check-out Date *</label>
              <input
                type="date"
                value={formData.checkOutDate}
                min={formData.checkInDate || new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {/* Room Selection */}
          {formData.checkInDate && formData.checkOutDate && (
            <div>
              <label className="block text-sm font-medium mb-2">Select Room(s) *</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableRooms.map(summary => (
                  <div key={summary.roomType.id} className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <p className="font-medium">{summary.roomType.name}</p>
                        <p className="text-sm text-gray-500">
                          ${summary.roomType.basePrice}/night - {summary.available} available
                        </p>
                      </div>
                    </div>
                    {summary.available > 0 && (
                      <button
                        onClick={() => {
                          // For simplicity, we'll need room IDs. This would need more work in a real app.
                          // For now, just show as selected
                        }}
                        className="text-blue-600 text-sm hover:underline"
                      >
                        + Add Room
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Guests Count */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Adults</label>
              <input
                type="number"
                min="1"
                value={formData.adultsCount}
                onChange={(e) => setFormData({ ...formData, adultsCount: parseInt(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Children</label>
              <input
                type="number"
                min="0"
                value={formData.childrenCount}
                onChange={(e) => setFormData({ ...formData, childrenCount: parseInt(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {/* Source & Arrival */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Booking Source</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="direct">Direct</option>
                <option value="phone">Phone</option>
                <option value="website">Website</option>
                <option value="walk_in">Walk-in</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Expected Arrival Time</label>
              <input
                type="time"
                value={formData.expectedArrival}
                onChange={(e) => setFormData({ ...formData, expectedArrival: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {/* Special Requests */}
          <div>
            <label className="block text-sm font-medium mb-1">Special Requests</label>
            <textarea
              value={formData.specialRequests}
              onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              rows={2}
            />
          </div>

          {/* Total */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">Estimated Total</span>
              <span className="text-2xl font-bold text-blue-600">${calculateTotal().toFixed(2)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !formData.guestId || !formData.checkInDate || !formData.checkOutDate}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Booking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Bookings;
