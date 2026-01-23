import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { stockTransfersAPI, productsAPI, branchesAPI } from '../../api';
import {
  Search,
  Plus,
  X,
  Eye,
  ArrowRight,
  Package,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  Send,
  PackageCheck,
  Building2
} from 'lucide-react';

const StockTransfers = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, branches = [] }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [products, setProducts] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '' });

  const [formData, setFormData] = useState({
    fromBranchId: '',
    toBranchId: '',
    notes: '',
    items: []
  });

  const [newItem, setNewItem] = useState({
    productId: '',
    quantity: ''
  });

  const [receiveItems, setReceiveItems] = useState([]);

  useEffect(() => {
    loadTransfers();
    loadProducts();
  }, [statusFilter]);

  const loadTransfers = async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (statusFilter) params.status = statusFilter;
      const response = await stockTransfersAPI.getAll(params);
      setTransfers(response.data.transfers || []);
    } catch (error) {
      console.error('Error loading transfers:', error);
      showToast('Failed to load transfers');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await productsAPI.getAll({ limit: 500 });
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return 'bg-warning-100 text-warning-700';
      case 'IN_TRANSIT': return 'bg-blue-100 text-blue-700';
      case 'RECEIVED': return 'bg-positive-100 text-positive-700';
      case 'CANCELLED': return 'bg-negative-100 text-negative-700';
      default: return 'bg-slate-200 text-slate-700';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PENDING': return Clock;
      case 'IN_TRANSIT': return Truck;
      case 'RECEIVED': return CheckCircle;
      case 'CANCELLED': return XCircle;
      default: return Clock;
    }
  };

  const addItem = () => {
    if (!newItem.productId || !newItem.quantity) {
      showToast('Please fill all item fields');
      return;
    }
    const product = products.find(p => p.id === newItem.productId);
    if (!product) return;

    // Check stock
    if (parseInt(newItem.quantity) > product.stockQuantity) {
      showToast(`Insufficient stock (available: ${product.stockQuantity})`);
      return;
    }

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        productId: newItem.productId,
        productName: product.name,
        quantity: parseInt(newItem.quantity),
        available: product.stockQuantity
      }]
    }));
    setNewItem({ productId: '', quantity: '' });
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleCreate = async () => {
    if (!formData.fromBranchId || !formData.toBranchId) {
      showToast('Please select both branches');
      return;
    }
    if (formData.fromBranchId === formData.toBranchId) {
      showToast('Source and destination must be different');
      return;
    }
    if (formData.items.length === 0) {
      showToast('Please add at least one item');
      return;
    }
    try {
      await stockTransfersAPI.create({
        fromBranchId: formData.fromBranchId,
        toBranchId: formData.toBranchId,
        notes: formData.notes,
        items: formData.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      });
      showToast('Transfer created');
      setShowCreateModal(false);
      resetForm();
      loadTransfers();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to create transfer');
    }
  };

  const handleShip = async (transferId) => {
    try {
      await stockTransfersAPI.ship(transferId);
      showToast('Transfer shipped - stock deducted from source');
      loadTransfers();
      if (showViewModal && selectedTransfer?.id === transferId) {
        const response = await stockTransfersAPI.getById(transferId);
        setSelectedTransfer(response.data);
      }
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to ship transfer');
    }
  };

  const handleCancel = async (transferId) => {
    if (!window.confirm('Are you sure you want to cancel this transfer?')) return;
    try {
      await stockTransfersAPI.cancel(transferId);
      showToast('Transfer cancelled');
      loadTransfers();
      setShowViewModal(false);
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to cancel transfer');
    }
  };

  const openReceiveModal = async (transfer) => {
    const response = await stockTransfersAPI.getById(transfer.id);
    const fullTransfer = response.data;
    setSelectedTransfer(fullTransfer);
    setReceiveItems(fullTransfer.items.map(item => ({
      itemId: item.id,
      productName: item.product.name,
      shipped: item.quantity,
      alreadyReceived: item.receivedQty,
      remaining: item.quantity - item.receivedQty,
      receivedQty: item.quantity - item.receivedQty
    })));
    setShowReceiveModal(true);
  };

  const handleReceive = async () => {
    const items = receiveItems
      .filter(item => item.receivedQty > 0)
      .map(item => ({
        itemId: item.itemId,
        receivedQty: parseInt(item.receivedQty)
      }));

    if (items.length === 0) {
      showToast('No items to receive');
      return;
    }

    try {
      await stockTransfersAPI.receive(selectedTransfer.id, items);
      showToast('Items received - stock added to destination');
      setShowReceiveModal(false);
      loadTransfers();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to receive items');
    }
  };

  const openViewModal = async (transfer) => {
    const response = await stockTransfersAPI.getById(transfer.id);
    setSelectedTransfer(response.data);
    setShowViewModal(true);
  };

  const resetForm = () => {
    setFormData({
      fromBranchId: '',
      toBranchId: '',
      notes: '',
      items: []
    });
    setNewItem({ productId: '', quantity: '' });
  };

  const filteredTransfers = transfers.filter(t =>
    t.transferNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.fromBranch?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.toBranch?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: transfers.length,
    pending: transfers.filter(t => t.status === 'PENDING').length,
    inTransit: transfers.filter(t => t.status === 'IN_TRANSIT').length,
    received: transfers.filter(t => t.status === 'RECEIVED').length
  };

  // Get products for selected source branch
  const availableProducts = formData.fromBranchId
    ? products.filter(p => p.branchId === formData.fromBranchId && p.type !== 'SERVICE' && p.stockQuantity > 0)
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${textClass}`}>
            Stock Transfers
          </h1>
          <p className={`text-sm ${mutedClass}`}>
            Move inventory between branches
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="px-6 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Transfer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          onClick={() => setStatusFilter('')}
          className={`${surfaceClass} border-2 ${!statusFilter ? 'border-slate-500' : borderClass} rounded-[28px] p-5 cursor-pointer hover:border-slate-400 transition-all`}
        >
          <p className={`text-[10px] font-black uppercase ${mutedClass} mb-1`}>Total</p>
          <p className={`text-2xl font-black ${textClass}`}>{stats.total}</p>
        </div>
        <div
          onClick={() => setStatusFilter('PENDING')}
          className={`${surfaceClass} border-2 ${statusFilter === 'PENDING' ? 'border-warning-500' : borderClass} rounded-[28px] p-5 cursor-pointer hover:border-warning-400 transition-all`}
        >
          <p className={`text-[10px] font-black uppercase ${mutedClass} mb-1`}>Pending</p>
          <p className="text-2xl font-black text-warning-500">{stats.pending}</p>
        </div>
        <div
          onClick={() => setStatusFilter('IN_TRANSIT')}
          className={`${surfaceClass} border-2 ${statusFilter === 'IN_TRANSIT' ? 'border-blue-500' : borderClass} rounded-[28px] p-5 cursor-pointer hover:border-blue-400 transition-all`}
        >
          <p className={`text-[10px] font-black uppercase ${mutedClass} mb-1`}>In Transit</p>
          <p className="text-2xl font-black text-blue-500">{stats.inTransit}</p>
        </div>
        <div
          onClick={() => setStatusFilter('RECEIVED')}
          className={`${surfaceClass} border-2 ${statusFilter === 'RECEIVED' ? 'border-positive-500' : borderClass} rounded-[28px] p-5 cursor-pointer hover:border-positive-400 transition-all`}
        >
          <p className={`text-[10px] font-black uppercase ${mutedClass} mb-1`}>Received</p>
          <p className="text-2xl font-black text-positive-500">{stats.received}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {statusFilter && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-bold">
            <span>Filter: {statusFilter.replace('_', ' ')}</span>
            <button onClick={() => setStatusFilter('')} className="hover:bg-slate-700 dark:hover:bg-slate-600 rounded p-0.5">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="relative flex-1 sm:max-w-xs ml-auto">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search transfers..."
            className={`w-full ${surfaceClass} border ${borderClass} rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass}`}
          />
        </div>
      </div>

      {/* Transfers List */}
      <div className={`${surfaceClass} border ${borderClass} rounded-[28px] overflow-hidden`}>
        {filteredTransfers.length === 0 ? (
          <div className="p-8 text-center">
            <Truck className={`w-12 h-12 mx-auto mb-3 ${mutedClass} opacity-30`} />
            <p className={`text-sm font-bold ${textClass}`}>No transfers found</p>
            <p className={`text-xs ${mutedClass}`}>Create your first transfer to move stock between branches</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold">
              <thead className={`${darkMode ? 'bg-slate-800' : 'bg-slate-50'} text-[10px] font-black uppercase ${mutedClass}`}>
                <tr className={`border-b ${borderClass}`}>
                  <th className="p-4">Transfer #</th>
                  <th className="p-4">Route</th>
                  <th className="p-4">Items</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransfers.map((transfer) => {
                  const StatusIcon = getStatusIcon(transfer.status);
                  return (
                    <tr key={transfer.id} className={`border-b ${borderClass} last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700/50`}>
                      <td className={`p-4 ${textClass}`}>{transfer.transferNumber}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={textClass}>{transfer.fromBranch?.name}</span>
                          <ArrowRight className={`w-4 h-4 ${mutedClass}`} />
                          <span className={textClass}>{transfer.toBranch?.name}</span>
                        </div>
                      </td>
                      <td className={`p-4 ${mutedClass}`}>{transfer._count?.items || 0} items</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold uppercase ${getStatusColor(transfer.status)}`}>
                          <StatusIcon className="w-3 h-3" />
                          {transfer.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className={`p-4 ${mutedClass}`}>
                        {new Date(transfer.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openViewModal(transfer)}
                            className={`p-1.5 ${mutedClass} hover:text-slate-600 transition-colors`}
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {transfer.status === 'PENDING' && (
                            <button
                              onClick={() => handleShip(transfer.id)}
                              className="p-1.5 text-blue-500 hover:text-blue-600 transition-colors"
                              title="Ship Transfer"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          {transfer.status === 'IN_TRANSIT' && (
                            <button
                              onClick={() => openReceiveModal(transfer)}
                              className="p-1.5 text-positive-500 hover:text-positive-600 transition-colors"
                              title="Receive Items"
                            >
                              <PackageCheck className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div
            className={`${surfaceClass} w-full max-w-2xl rounded-[32px] p-6 sm:p-8 shadow-2xl border ${borderClass} relative max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowCreateModal(false)} className={`absolute top-6 right-6 ${mutedClass} hover:text-negative-500`}>
              <X className="w-6 h-6" />
            </button>

            <h2 className={`text-xl font-black uppercase mb-6 ${textClass} text-center`}>
              New Stock Transfer
            </h2>

            <div className="space-y-4">
              {/* Branch Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`text-[10px] font-bold ${mutedClass} block mb-2`}>From Branch *</label>
                  <select
                    value={formData.fromBranchId}
                    onChange={(e) => setFormData({ ...formData, fromBranchId: e.target.value, items: [] })}
                    className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none ${textClass}`}
                  >
                    <option value="">Select Source</option>
                    {branches.filter(b => b.isActive).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`text-[10px] font-bold ${mutedClass} block mb-2`}>To Branch *</label>
                  <select
                    value={formData.toBranchId}
                    onChange={(e) => setFormData({ ...formData, toBranchId: e.target.value })}
                    className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none ${textClass}`}
                  >
                    <option value="">Select Destination</option>
                    {branches
                      .filter(b => b.isActive && b.id !== formData.fromBranchId)
                      .map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <input
                type="text"
                placeholder="Notes (optional)"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none ${textClass}`}
              />

              {/* Add Item */}
              {formData.fromBranchId && (
                <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                  <p className={`text-[10px] font-black uppercase ${mutedClass} mb-3`}>Add Item</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      value={newItem.productId}
                      onChange={(e) => setNewItem({ ...newItem, productId: e.target.value })}
                      className={`sm:col-span-2 ${darkMode ? 'bg-slate-800' : 'bg-white'} border ${borderClass} rounded-xl p-3 text-xs font-bold ${textClass}`}
                    >
                      <option value="">Select Product</option>
                      {availableProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Stock: {p.stockQuantity})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Qty"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                      className={`${darkMode ? 'bg-slate-800' : 'bg-white'} border ${borderClass} rounded-xl p-3 text-xs font-bold ${textClass}`}
                    />
                  </div>
                  <button
                    onClick={addItem}
                    className="mt-3 px-4 py-2 bg-slate-800 dark:bg-slate-600 text-white rounded-lg text-xs font-bold"
                  >
                    Add to Transfer
                  </button>
                </div>
              )}

              {/* Items List */}
              {formData.items.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-[10px] font-black uppercase ${mutedClass}`}>Transfer Items</p>
                  {formData.items.map((item, index) => (
                    <div key={index} className={`flex items-center justify-between p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                      <div className="flex items-center gap-3">
                        <Package className={`w-4 h-4 ${mutedClass}`} />
                        <div>
                          <p className={`text-xs font-bold ${textClass}`}>{item.productName}</p>
                          <p className={`text-[10px] ${mutedClass}`}>
                            Quantity: {item.quantity} (Available: {item.available})
                          </p>
                        </div>
                      </div>
                      <button onClick={() => removeItem(index)} className="text-negative-500 hover:text-negative-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleCreate}
                className="w-full py-4 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-black text-[10px] uppercase shadow-lg"
              >
                Create Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedTransfer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowViewModal(false)}>
          <div
            className={`${surfaceClass} w-full max-w-2xl rounded-[32px] p-6 sm:p-8 shadow-2xl border ${borderClass} relative max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowViewModal(false)} className={`absolute top-6 right-6 ${mutedClass} hover:text-negative-500`}>
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className={`text-xl font-black uppercase ${textClass}`}>
                  {selectedTransfer.transferNumber}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <Building2 className={`w-4 h-4 ${mutedClass}`} />
                  <span className={`text-xs ${mutedClass}`}>
                    {selectedTransfer.fromBranch?.name} → {selectedTransfer.toBranch?.name}
                  </span>
                </div>
              </div>
              <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${getStatusColor(selectedTransfer.status)}`}>
                {selectedTransfer.status.replace('_', ' ')}
              </span>
            </div>

            <div className="space-y-4">
              <div className={`grid grid-cols-2 gap-4 p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                <div>
                  <p className={`text-[10px] ${mutedClass}`}>Created</p>
                  <p className={`text-xs font-bold ${textClass}`}>{new Date(selectedTransfer.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className={`text-[10px] ${mutedClass}`}>Initiated By</p>
                  <p className={`text-xs font-bold ${textClass}`}>{selectedTransfer.initiatedBy?.fullName}</p>
                </div>
                {selectedTransfer.shippedAt && (
                  <div>
                    <p className={`text-[10px] ${mutedClass}`}>Shipped</p>
                    <p className={`text-xs font-bold ${textClass}`}>{new Date(selectedTransfer.shippedAt).toLocaleDateString()}</p>
                  </div>
                )}
                {selectedTransfer.receivedAt && (
                  <div>
                    <p className={`text-[10px] ${mutedClass}`}>Received</p>
                    <p className={`text-xs font-bold ${textClass}`}>{new Date(selectedTransfer.receivedAt).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              <div>
                <p className={`text-[10px] font-black uppercase ${mutedClass} mb-2`}>Items</p>
                <div className="space-y-2">
                  {selectedTransfer.items?.map((item) => (
                    <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                      <div className="flex items-center gap-3">
                        <Package className={`w-4 h-4 ${mutedClass}`} />
                        <p className={`text-xs font-bold ${textClass}`}>{item.product?.name}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-bold ${textClass}`}>{item.quantity} units</p>
                        <p className={`text-[10px] ${item.receivedQty >= item.quantity ? 'text-positive-500' : 'text-warning-500'}`}>
                          Received: {item.receivedQty}/{item.quantity}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedTransfer.notes && (
                <div className={`p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                  <p className={`text-[10px] font-black uppercase ${mutedClass} mb-1`}>Notes</p>
                  <p className={`text-xs ${textClass}`}>{selectedTransfer.notes}</p>
                </div>
              )}

              <div className="flex gap-3">
                {selectedTransfer.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleShip(selectedTransfer.id)}
                      className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" /> Ship Transfer
                    </button>
                    <button
                      onClick={() => handleCancel(selectedTransfer.id)}
                      className="py-3 px-6 bg-negative-500 text-white rounded-xl font-black text-[10px] uppercase"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {selectedTransfer.status === 'IN_TRANSIT' && (
                  <>
                    <button
                      onClick={() => { setShowViewModal(false); openReceiveModal(selectedTransfer); }}
                      className="flex-1 py-3 bg-positive-500 text-white rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2"
                    >
                      <PackageCheck className="w-4 h-4" /> Receive Items
                    </button>
                    <button
                      onClick={() => handleCancel(selectedTransfer.id)}
                      className="py-3 px-6 bg-negative-500 text-white rounded-xl font-black text-[10px] uppercase"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && selectedTransfer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowReceiveModal(false)}>
          <div
            className={`${surfaceClass} w-full max-w-lg rounded-[32px] p-6 sm:p-8 shadow-2xl border ${borderClass} relative`}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowReceiveModal(false)} className={`absolute top-6 right-6 ${mutedClass} hover:text-negative-500`}>
              <X className="w-6 h-6" />
            </button>

            <h2 className={`text-xl font-black uppercase mb-2 ${textClass} text-center`}>
              Receive Items
            </h2>
            <p className={`text-xs ${mutedClass} text-center mb-6`}>
              {selectedTransfer.transferNumber}
            </p>

            <div className="space-y-3">
              {receiveItems.map((item, index) => (
                <div key={item.itemId} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-xs font-bold ${textClass}`}>{item.productName}</p>
                    <p className={`text-[10px] ${mutedClass}`}>
                      {item.alreadyReceived}/{item.shipped} received
                    </p>
                  </div>
                  {item.remaining > 0 ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        max={item.remaining}
                        value={item.receivedQty}
                        onChange={(e) => {
                          const val = Math.min(parseInt(e.target.value) || 0, item.remaining);
                          setReceiveItems(prev => prev.map((ri, i) =>
                            i === index ? { ...ri, receivedQty: val } : ri
                          ));
                        }}
                        className={`flex-1 ${darkMode ? 'bg-slate-800' : 'bg-white'} border ${borderClass} rounded-xl p-3 text-xs font-bold ${textClass}`}
                      />
                      <span className={`text-xs ${mutedClass}`}>of {item.remaining}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-positive-500 font-bold">Fully received</p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleReceive}
              className="w-full mt-6 py-4 bg-positive-500 text-white rounded-xl font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-2"
            >
              <PackageCheck className="w-4 h-4" /> Confirm Receipt
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
          <div className={`${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3`}>
            <CheckCircle className="w-5 h-5 text-positive-500" />
            <span className="font-bold text-xs uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockTransfers;
