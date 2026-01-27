import React, { useState, useEffect } from 'react';
import { tablesAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Users,
  MapPin,
  RefreshCw,
  User,
  Clock,
  Receipt
} from 'lucide-react';

const TableSelector = ({
  onSelect,
  onClose,
  darkMode = false,
  selectedTableId = null,
  branchId = null
}) => {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState('All');
  const [selectedView, setSelectedView] = useState('my'); // 'my' or 'available'
  const [error, setError] = useState(null);

  // Theme classes
  const surfaceClass = darkMode ? 'bg-slate-800' : 'bg-white';
  const textClass = darkMode ? 'text-white' : 'text-slate-900';
  const mutedClass = darkMode ? 'text-slate-400' : 'text-slate-500';
  const borderClass = darkMode ? 'border-slate-700' : 'border-slate-200';
  const bgClass = darkMode ? 'bg-slate-700' : 'bg-slate-100';

  const isCashier = user?.role === 'CASHIER';

  useEffect(() => {
    loadTables();
  }, [branchId]);

  const loadTables = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { forCashier: 'true' };
      if (branchId) params.branchId = branchId;
      const response = await tablesAPI.getAll(params);
      setTables(response.data.tables || []);
      setSections(['All', ...(response.data.sections || [])]);
    } catch (err) {
      console.error('Failed to load tables:', err);
      setError('Failed to load tables');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (table) => {
    if (table.assignedCashierId === user?.id) {
      return 'bg-blue-500'; // My table
    }
    switch (table.status) {
      case 'available':
        return 'bg-green-500';
      case 'occupied':
        return 'bg-red-500';
      case 'reserved':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBgClass = (table, isSelected) => {
    if (isSelected) {
      return 'border-accent-500 bg-accent-50 ring-2 ring-accent-500';
    }
    // My table (assigned to me)
    if (table.assignedCashierId === user?.id) {
      return `border-blue-400 ${darkMode ? 'bg-blue-900/30' : 'bg-blue-50'} hover:border-blue-500`;
    }
    switch (table.status) {
      case 'available':
        return `border-green-300 ${darkMode ? 'bg-green-900/20' : 'bg-green-50'} hover:border-green-500`;
      case 'occupied':
        return `border-red-300 ${darkMode ? 'bg-red-900/20' : 'bg-red-50'} opacity-50`;
      case 'reserved':
        return `border-yellow-300 ${darkMode ? 'bg-yellow-900/20' : 'bg-yellow-50'} opacity-50`;
      default:
        return borderClass;
    }
  };

  // Separate tables into my tables and available tables
  const myTables = tables.filter(t => t.assignedCashierId === user?.id);
  const availableTables = tables.filter(t => !t.assignedCashierId && t.status === 'available');
  const otherCashierTables = tables.filter(t => t.assignedCashierId && t.assignedCashierId !== user?.id);

  // Apply section filter
  const filterBySection = (tableList) => {
    if (selectedSection === 'All') return tableList;
    return tableList.filter(t => t.section === selectedSection);
  };

  // For managers/owners: show all tables; For cashiers: show based on view toggle
  const displayTables = isCashier
    ? (selectedView === 'my' ? filterBySection(myTables) : filterBySection(availableTables))
    : filterBySection(tables); // Show ALL tables for managers/owners

  const handleTableClick = (table) => {
    // For cashiers: only allow their tables or available tables
    if (isCashier) {
      const isMyTable = table.assignedCashierId === user?.id;
      const isAvailable = !table.assignedCashierId && table.status === 'available';

      if (!isMyTable && !isAvailable) {
        return; // Can't select other cashier's tables
      }
    }
    onSelect(table);
  };

  const canSelectTable = (table) => {
    if (!isCashier) return true; // Owner/Manager can select any
    const isMyTable = table.assignedCashierId === user?.id;
    const isAvailable = !table.assignedCashierId && table.status === 'available';
    return isMyTable || isAvailable;
  };

  // Calculate order total for a table
  const getTableTotal = (table) => {
    if (!table.orders || table.orders.length === 0) return 0;
    return table.orders.reduce((sum, order) => {
      const orderTotal = order.items?.reduce((itemSum, item) => {
        const modifiers = item.modifiers ? JSON.parse(item.modifiers) : [];
        const modifierTotal = modifiers.reduce((mSum, mod) => mSum + (mod.price || 0), 0);
        return itemSum + (item.unitPrice + modifierTotal) * item.quantity;
      }, 0) || 0;
      return sum + orderTotal;
    }, 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`${surfaceClass} rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl`}>
        {/* Header */}
        <div className={`p-4 border-b ${borderClass} flex items-center justify-between`}>
          <div>
            <h2 className={`text-lg font-black ${textClass}`}>Select Table</h2>
            <p className={`text-xs ${mutedClass}`}>
              {!isCashier
                ? 'All tables (Manager/Owner access)'
                : (selectedView === 'my' ? 'Your active tables' : 'Available tables to serve')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadTables}
              className={`p-2 rounded-lg ${bgClass} ${mutedClass} hover:text-accent-500 transition-colors`}
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg ${bgClass} ${mutedClass} hover:text-red-500 transition-colors`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Toggle - My Tables vs Available */}
        {isCashier && (
          <div className={`p-3 border-b ${borderClass} flex gap-2`}>
            <button
              onClick={() => setSelectedView('my')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                selectedView === 'my'
                  ? 'bg-blue-500 text-white'
                  : `${bgClass} ${textClass} hover:bg-blue-100`
              }`}
            >
              <User className="w-4 h-4" />
              My Tables ({myTables.length})
            </button>
            <button
              onClick={() => setSelectedView('available')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                selectedView === 'available'
                  ? 'bg-green-500 text-white'
                  : `${bgClass} ${textClass} hover:bg-green-100`
              }`}
            >
              <MapPin className="w-4 h-4" />
              Available ({availableTables.length})
            </button>
          </div>
        )}

        {/* Section Filter */}
        {sections.length > 1 && (
          <div className={`p-3 border-b ${borderClass} flex gap-2 overflow-x-auto`}>
            {sections.map(section => (
              <button
                key={section}
                onClick={() => setSelectedSection(section)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedSection === section
                    ? 'bg-accent-500 text-white'
                    : `${bgClass} ${textClass} hover:bg-accent-100`
                }`}
              >
                {section}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className={`w-8 h-8 animate-spin ${mutedClass}`} />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 font-medium">{error}</p>
              <button
                onClick={loadTables}
                className="mt-2 text-accent-500 text-sm font-medium hover:underline"
              >
                Try again
              </button>
            </div>
          ) : displayTables.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className={`w-12 h-12 mx-auto mb-3 ${mutedClass}`} />
              <p className={`font-medium ${textClass}`}>
                {!isCashier
                  ? 'No tables found'
                  : (selectedView === 'my' ? 'No active tables' : 'No available tables')}
              </p>
              <p className={`text-sm ${mutedClass}`}>
                {!isCashier
                  ? 'Create tables in the owner dashboard'
                  : (selectedView === 'my'
                    ? 'Select an available table to start serving'
                    : 'All tables are currently being served')}
              </p>
              {isCashier && selectedView === 'my' && availableTables.length > 0 && (
                <button
                  onClick={() => setSelectedView('available')}
                  className="mt-3 text-accent-500 text-sm font-medium hover:underline"
                >
                  View available tables ({availableTables.length})
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {displayTables.map(table => {
                const tableTotal = getTableTotal(table);
                const isMyTable = table.assignedCashierId === user?.id;
                const canSelect = canSelectTable(table);

                return (
                  <button
                    key={table.id}
                    onClick={() => handleTableClick(table)}
                    disabled={!canSelect}
                    className={`p-3 rounded-xl border-2 transition-all ${getStatusBgClass(table, table.id === selectedTableId)} ${
                      !canSelect ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <div className="text-center">
                      <div className={`text-xl font-black ${textClass}`}>
                        {table.tableNumber}
                      </div>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <Users className={`w-3 h-3 ${mutedClass}`} />
                        <span className={`text-xs ${mutedClass}`}>{table.capacity}</span>
                      </div>

                      {/* Status indicator */}
                      <div className="flex items-center justify-center gap-1 mt-1.5">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(table)}`} />
                        <span className={`text-[10px] font-medium ${isMyTable ? 'text-blue-600' : mutedClass}`}>
                          {isMyTable ? 'Your Table' : table.status}
                        </span>
                      </div>

                      {table.section && (
                        <div className={`text-[9px] mt-1 ${mutedClass}`}>
                          {table.section}
                        </div>
                      )}

                      {/* Show order info for my tables */}
                      {isMyTable && table.orders?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <div className="flex items-center justify-center gap-1 text-[10px] text-blue-600 font-medium">
                            <Receipt className="w-3 h-3" />
                            {table.orders.length} order{table.orders.length > 1 ? 's' : ''}
                          </div>
                          {tableTotal > 0 && (
                            <div className="text-xs font-bold text-blue-700 mt-0.5">
                              {tableTotal.toFixed(2)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Show cashier name for occupied tables (for managers) */}
                      {!isCashier && table.assignedCashier && (
                        <div className={`text-[9px] mt-1 ${mutedClass}`}>
                          {table.assignedCashier.fullName}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className={`p-3 border-t ${borderClass} flex items-center justify-center gap-4 flex-wrap`}>
          {isCashier && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className={`text-xs ${mutedClass}`}>Your Table</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className={`text-xs ${mutedClass}`}>Available</span>
          </div>
          {!isCashier && (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className={`text-xs ${mutedClass}`}>Occupied</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className={`text-xs ${mutedClass}`}>Reserved</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TableSelector;
