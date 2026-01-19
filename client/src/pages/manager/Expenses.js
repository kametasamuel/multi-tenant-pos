import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { expensesAPI } from '../../api';
import {
  Plus,
  Search,
  Wallet,
  Calendar,
  X,
  DollarSign,
  TrendingUp,
  FileText
} from 'lucide-react';

const ManagerExpenses = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, bgClass }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    category: 'OPERATIONAL',
    notes: ''
  });

  const currencySymbol = user?.currencySymbol || '$';

  const categories = [
    { id: 'OPERATIONAL', label: 'Operational' },
    { id: 'UTILITIES', label: 'Utilities' },
    { id: 'SUPPLIES', label: 'Supplies' },
    { id: 'MAINTENANCE', label: 'Maintenance' },
    { id: 'OTHER', label: 'Other' }
  ];

  useEffect(() => {
    loadExpenses();
  }, [dateFilter]);

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateFilter) {
      case 'today':
        return { startDate: today.toISOString() };
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { startDate: weekAgo.toISOString() };
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return { startDate: monthAgo.toISOString() };
      default:
        return { startDate: today.toISOString() };
    }
  };

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const params = getDateRange();
      const response = await expensesAPI.getAll(params);
      setExpenses(response.data.expenses || []);
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpense = async () => {
    if (!newExpense.description.trim() || !newExpense.amount) {
      alert('Please fill in description and amount');
      return;
    }

    setSaving(true);
    try {
      await expensesAPI.create({
        ...newExpense,
        amount: parseFloat(newExpense.amount)
      });
      setShowAddModal(false);
      setNewExpense({ description: '', amount: '', category: 'OPERATIONAL', notes: '' });
      loadExpenses();
    } catch (error) {
      console.error('Error creating expense:', error);
      alert('Failed to add expense');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const filteredExpenses = expenses.filter(e =>
    e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const getCategoryColor = (category) => {
    switch (category) {
      case 'OPERATIONAL':
        return darkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-100 text-indigo-700';
      case 'UTILITIES':
        return darkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700';
      case 'SUPPLIES':
        return darkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700';
      case 'MAINTENANCE':
        return darkMode ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-700';
      default:
        return darkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl sm:text-2xl font-black uppercase tracking-tighter ${textClass}`}>
            Expenses
          </h1>
          <p className={`text-sm ${mutedClass}`}>
            Track and manage operational expenses
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase hover:bg-indigo-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Expense</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <Wallet className="w-5 h-5 mb-2 text-red-500" />
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Total Spent</p>
          <p className="text-xl font-black text-red-500">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4`}>
          <FileText className={`w-5 h-5 mb-2 ${mutedClass}`} />
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Entries</p>
          <p className={`text-xl font-black ${textClass}`}>{filteredExpenses.length}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-xl p-4 hidden sm:block`}>
          <TrendingUp className={`w-5 h-5 mb-2 ${mutedClass}`} />
          <p className={`text-[10px] font-bold uppercase ${mutedClass}`}>Average</p>
          <p className={`text-xl font-black ${textClass}`}>
            {formatCurrency(filteredExpenses.length > 0 ? totalExpenses / filteredExpenses.length : 0)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search expenses..."
            className={`w-full ${bgClass} border ${borderClass} rounded-xl py-3 pl-11 pr-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${textClass}`}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {[
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' }
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setDateFilter(filter.id)}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase whitespace-nowrap transition-all ${
                dateFilter === filter.id
                  ? darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'
                  : `${surfaceClass} border ${borderClass} ${mutedClass} hover:border-indigo-500`
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses List */}
      <div className="space-y-3">
        {filteredExpenses.length === 0 ? (
          <div className={`${surfaceClass} border ${borderClass} rounded-2xl p-8 text-center`}>
            <Wallet className={`w-12 h-12 mx-auto mb-3 ${mutedClass}`} />
            <p className={`text-sm font-bold ${textClass}`}>No expenses found</p>
            <p className={`text-xs ${mutedClass}`}>
              {expenses.length === 0 ? 'No expenses recorded for this period' : 'Try adjusting your search'}
            </p>
          </div>
        ) : (
          filteredExpenses.map((expense) => (
            <div key={expense.id} className={`${surfaceClass} border ${borderClass} rounded-2xl p-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                    <DollarSign className={`w-5 h-5 ${mutedClass}`} />
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${textClass}`}>{expense.description}</p>
                    <div className={`text-[10px] ${mutedClass} flex items-center gap-2 mt-1`}>
                      <Calendar className="w-3 h-3" />
                      {new Date(expense.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-red-500">-{formatCurrency(expense.amount)}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ${getCategoryColor(expense.category)}`}>
                    {expense.category}
                  </span>
                </div>
              </div>
              {expense.notes && (
                <p className={`mt-3 pt-3 border-t ${borderClass} text-xs ${mutedClass}`}>
                  {expense.notes}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${surfaceClass} w-full max-w-md rounded-2xl shadow-2xl`}>
            <div className={`px-6 py-4 border-b ${borderClass} flex items-center justify-between`}>
              <h2 className={`text-lg font-black uppercase ${textClass}`}>Add Expense</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className={`p-2 ${mutedClass} hover:text-red-500 rounded-lg transition-colors`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-[10px] font-bold uppercase mb-1.5 ${mutedClass}`}>
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  className={`w-full ${bgClass} border ${borderClass} rounded-xl py-2.5 px-4 text-sm font-semibold focus:outline-none focus:border-indigo-500 ${textClass}`}
                  placeholder="e.g., Office supplies"
                />
              </div>
              <div>
                <label className={`block text-[10px] font-bold uppercase mb-1.5 ${mutedClass}`}>
                  Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold ${mutedClass}`}>
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    className={`w-full ${bgClass} border ${borderClass} rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold focus:outline-none focus:border-indigo-500 ${textClass}`}
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className={`block text-[10px] font-bold uppercase mb-1.5 ${mutedClass}`}>
                  Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setNewExpense({ ...newExpense, category: cat.id })}
                      className={`py-2 px-3 rounded-xl text-[9px] font-bold uppercase transition-all ${
                        newExpense.category === cat.id
                          ? 'bg-indigo-500 text-white'
                          : `${bgClass} border ${borderClass} ${mutedClass} hover:border-indigo-500`
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={`block text-[10px] font-bold uppercase mb-1.5 ${mutedClass}`}>
                  Notes
                </label>
                <textarea
                  value={newExpense.notes}
                  onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
                  rows="3"
                  className={`w-full ${bgClass} border ${borderClass} rounded-xl py-2.5 px-4 text-sm font-semibold focus:outline-none focus:border-indigo-500 ${textClass} resize-none`}
                  placeholder="Additional details..."
                />
              </div>
            </div>
            <div className={`px-6 py-4 border-t ${borderClass} flex gap-3`}>
              <button
                onClick={() => setShowAddModal(false)}
                className={`flex-1 py-3 border ${borderClass} rounded-xl font-bold text-[10px] uppercase ${mutedClass} ${surfaceClass} hover:bg-slate-50`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateExpense}
                disabled={saving}
                className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-black text-[10px] uppercase hover:bg-indigo-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerExpenses;
