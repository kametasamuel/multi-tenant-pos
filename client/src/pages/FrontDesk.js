import React, { useState, useEffect } from 'react';
import {
  BedDouble, Users, ArrowRight, Calendar, Clock, Search,
  CheckCircle, XCircle, DollarSign, User, Phone, Plus,
  RefreshCw, AlertCircle, Star, CreditCard, Banknote
} from 'lucide-react';
import { bookingsAPI, roomsAPI, guestsAPI, foliosAPI } from '../api';
import { useAuth } from '../context/AuthContext';

const FrontDesk = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [arrivals, setArrivals] = useState([]);
  const [departures, setDepartures] = useState([]);
  const [inHouse, setInHouse] = useState([]);
  const [roomSummary, setRoomSummary] = useState(null);
  const [activeTab, setActiveTab] = useState('arrivals');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => setRefreshKey(k => k + 1), 30000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [arrivalsRes, departuresRes, inHouseRes, availabilityRes] = await Promise.all([
        bookingsAPI.getArrivals({}),
        bookingsAPI.getDepartures({}),
        bookingsAPI.getInHouse({}),
        roomsAPI.getAvailability({})
      ]);

      setArrivals(arrivalsRes.data);
      setDepartures(departuresRes.data);
      setInHouse(inHouseRes.data);
      setRoomSummary(availabilityRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (booking) => {
    setSelectedBooking(booking);
    setShowCheckInModal(true);
  };

  const handleCheckOut = async (booking) => {
    setSelectedBooking(booking);
    setShowCheckOutModal(true);
  };

  const confirmCheckIn = async () => {
    try {
      await bookingsAPI.checkIn(selectedBooking.id, {});
      setShowCheckInModal(false);
      setSelectedBooking(null);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to check in');
    }
  };

  const confirmCheckOut = async (paymentData) => {
    try {
      await bookingsAPI.checkOut(selectedBooking.id, paymentData);
      setShowCheckOutModal(false);
      setSelectedBooking(null);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to check out');
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getNights = (checkIn, checkOut) => {
    return Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
  };

  if (loading && arrivals.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading front desk...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <BedDouble className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Front Desk</h1>
              <p className="text-sm text-gray-500">{user?.tenantName}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowWalkInModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4" />
              Walk-in
            </button>
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-xs text-gray-500">
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">
              <strong className="text-green-600">{roomSummary?.availableRooms || 0}</strong> Available
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-gray-600">
              <strong className="text-blue-600">{inHouse.length}</strong> In-House
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-sm text-gray-600">
              <strong className="text-yellow-600">{arrivals.length}</strong> Arrivals Today
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span className="text-sm text-gray-600">
              <strong className="text-orange-600">{departures.length}</strong> Departures Today
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Bookings */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="bg-white border-b px-6">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('arrivals')}
                className={`py-3 border-b-2 text-sm font-medium ${
                  activeTab === 'arrivals'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Arrivals ({arrivals.length})
              </button>
              <button
                onClick={() => setActiveTab('departures')}
                className={`py-3 border-b-2 text-sm font-medium ${
                  activeTab === 'departures'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Departures ({departures.length})
              </button>
              <button
                onClick={() => setActiveTab('inhouse')}
                className={`py-3 border-b-2 text-sm font-medium ${
                  activeTab === 'inhouse'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                In-House ({inHouse.length})
              </button>
            </div>
          </div>

          {/* Bookings List */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {activeTab === 'arrivals' && arrivals.map(booking => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  type="arrival"
                  onAction={() => handleCheckIn(booking)}
                />
              ))}

              {activeTab === 'departures' && departures.map(booking => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  type="departure"
                  onAction={() => handleCheckOut(booking)}
                />
              ))}

              {activeTab === 'inhouse' && inHouse.map(booking => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  type="inhouse"
                  onAction={() => handleCheckOut(booking)}
                />
              ))}

              {((activeTab === 'arrivals' && arrivals.length === 0) ||
                (activeTab === 'departures' && departures.length === 0) ||
                (activeTab === 'inhouse' && inHouse.length === 0)) && (
                <div className="text-center py-12 text-gray-500">
                  <BedDouble className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No {activeTab === 'inhouse' ? 'in-house guests' : activeTab} for today</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Room Availability */}
        <div className="w-80 bg-white border-l overflow-y-auto">
          <div className="p-4 border-b">
            <h2 className="font-bold text-gray-900">Room Availability</h2>
          </div>

          <div className="p-4 space-y-3">
            {roomSummary?.summary?.map(item => (
              <div key={item.roomType.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{item.roomType.name}</p>
                    <p className="text-sm text-gray-500">${item.roomType.basePrice}/night</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    item.available > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {item.available} available
                  </span>
                </div>

                <div className="flex gap-2 text-xs">
                  <span className="text-gray-500">
                    {item.occupied} occupied
                  </span>
                  <span className="text-gray-500">
                    {item.reserved} reserved
                  </span>
                  {item.maintenance > 0 && (
                    <span className="text-orange-600">
                      {item.maintenance} maintenance
                    </span>
                  )}
                </div>
              </div>
            ))}

            {(!roomSummary?.summary || roomSummary.summary.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                No room types configured
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Check-In Modal */}
      {showCheckInModal && selectedBooking && (
        <CheckInModal
          booking={selectedBooking}
          onClose={() => {
            setShowCheckInModal(false);
            setSelectedBooking(null);
          }}
          onConfirm={confirmCheckIn}
        />
      )}

      {/* Check-Out Modal */}
      {showCheckOutModal && selectedBooking && (
        <CheckOutModal
          booking={selectedBooking}
          onClose={() => {
            setShowCheckOutModal(false);
            setSelectedBooking(null);
          }}
          onConfirm={confirmCheckOut}
        />
      )}

      {/* Walk-In Modal */}
      {showWalkInModal && (
        <WalkInModal
          onClose={() => setShowWalkInModal(false)}
          onSuccess={() => {
            setShowWalkInModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};

// Booking Card Component
const BookingCard = ({ booking, type, onAction }) => {
  const guest = booking.guest;
  const rooms = booking.rooms || [];
  const primaryRoom = rooms[0];

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900">
                {guest?.firstName} {guest?.lastName}
              </p>
              {guest?.vipStatus !== 'regular' && (
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              )}
            </div>
            <p className="text-sm text-gray-500">{booking.bookingNumber}</p>
          </div>
        </div>

        <button
          onClick={onAction}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            type === 'arrival'
              ? 'bg-green-600 text-white hover:bg-green-700'
              : type === 'departure'
              ? 'bg-orange-600 text-white hover:bg-orange-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {type === 'arrival' ? 'Check In' : 'Check Out'}
        </button>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-1 text-gray-600">
          <BedDouble className="w-4 h-4" />
          {rooms.map(r => r.room?.roomNumber).join(', ')}
          <span className="text-gray-400">({primaryRoom?.room?.roomType?.name})</span>
        </div>

        <div className="flex items-center gap-1 text-gray-600">
          <Users className="w-4 h-4" />
          {booking.adultsCount} Adults{booking.childrenCount > 0 && `, ${booking.childrenCount} Children`}
        </div>

        {booking.expectedArrival && type === 'arrival' && (
          <div className="flex items-center gap-1 text-gray-600">
            <Clock className="w-4 h-4" />
            ETA: {booking.expectedArrival}
          </div>
        )}

        {type !== 'arrival' && booking.folio && (
          <div className="flex items-center gap-1 text-gray-600">
            <DollarSign className="w-4 h-4" />
            Balance: ${booking.folio.balance?.toFixed(2) || '0.00'}
          </div>
        )}
      </div>

      {booking.specialRequests && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-orange-600">
            <AlertCircle className="w-3 h-3 inline mr-1" />
            {booking.specialRequests}
          </p>
        </div>
      )}
    </div>
  );
};

// Check-In Modal
const CheckInModal = ({ booking, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">Confirm Check-In</h2>

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="font-medium">{booking.guest?.firstName} {booking.guest?.lastName}</p>
          <p className="text-sm text-gray-500">{booking.bookingNumber}</p>
          <p className="text-sm text-gray-500 mt-2">
            Room(s): {booking.rooms?.map(r => r.room?.roomNumber).join(', ')}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Confirm Check-In'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Check-Out Modal
const CheckOutModal = ({ booking, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);
  const [folio, setFolio] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => {
    loadFolio();
  }, []);

  const loadFolio = async () => {
    try {
      const response = await foliosAPI.getByBooking(booking.id);
      setFolio(response.data);
      setPaymentAmount(response.data.balance?.toFixed(2) || '0');
    } catch (error) {
      console.error('Error loading folio:', error);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm({
      paymentMethod,
      paymentAmount: parseFloat(paymentAmount) || 0
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg p-6">
        <h2 className="text-xl font-bold mb-4">Check-Out</h2>

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">{booking.guest?.firstName} {booking.guest?.lastName}</p>
              <p className="text-sm text-gray-500">{booking.bookingNumber}</p>
              <p className="text-sm text-gray-500">
                Room(s): {booking.rooms?.map(r => r.room?.roomNumber).join(', ')}
              </p>
            </div>
          </div>
        </div>

        {folio && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Total Charges</span>
              <span className="font-medium">${folio.totalAmount?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Paid</span>
              <span className="text-green-600">${folio.paidAmount?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-blue-200">
              <span className="font-medium">Balance Due</span>
              <span className="text-xl font-bold text-blue-600">${folio.balance?.toFixed(2)}</span>
            </div>
          </div>
        )}

        {folio?.balance > 0 && (
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Payment Method</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border ${
                    paymentMethod === 'cash'
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  Cash
                </button>
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border ${
                    paymentMethod === 'card'
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  Card
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Payment Amount</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Complete Check-Out'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Walk-In Modal (simplified version)
const WalkInModal = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [guestData, setGuestData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!guestData.firstName || !guestData.lastName) {
      alert('First name and last name are required');
      return;
    }

    setLoading(true);
    try {
      // Create guest first
      const guestRes = await guestsAPI.create(guestData);
      alert('Guest created. Please create a booking from the Bookings page.');
      onSuccess();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to create guest');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">Walk-In Guest</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">First Name *</label>
              <input
                type="text"
                value={guestData.firstName}
                onChange={(e) => setGuestData({ ...guestData, firstName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name *</label>
              <input
                type="text"
                value={guestData.lastName}
                onChange={(e) => setGuestData({ ...guestData, lastName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              type="tel"
              value={guestData.phone}
              onChange={(e) => setGuestData({ ...guestData, phone: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={guestData.email}
              onChange={(e) => setGuestData({ ...guestData, email: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Guest'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FrontDesk;
