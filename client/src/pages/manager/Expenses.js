import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { expensesAPI } from '../../api';
import { exportExpenses } from '../../utils/exportUtils';
import {
  Search,
  Wallet,
  Calendar,
  DollarSign,
  CheckCircle,
  ChevronDown,
  TrendingUp,
  BarChart3,
  Download
} from 'lucide-react';

const ManagerExpenses = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, bgClass }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [dateFilter, setDateFilter] = useState('all');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    category: 'Utilities'
  });

  const currencySymbol = user?.currencySymbol || '$';

  const categories = ['Utilities', 'Supplies', 'Salaries', 'Maintenance', 'Other'];

  useEffect(() => {
    loadExpenses();
  }, [dateFilter, customDateRange]);

  const getDateRange = () => {
    const now = new Date();

    // Helper to create date string in YYYY-MM-DDTHH:mm:ss format
    const formatDate = (date, endOfDay = false) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      if (endOfDay) {
        return `${year}-${month}-${day}T23:59:59.999`;
      }
      return `${year}-${month}-${day}T00:00:00.000`;
    };

    switch (dateFilter) {
      case 'all':
        // No date filter - return empty object to fetch all
        return {};
      case 'today':
        return {
          startDate: formatDate(now),
          endDate: formatDate(now, true)
        };
      case 'week': {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return {
          startDate: formatDate(weekAgo),
          endDate: formatDate(now, true)
        };
      }
      case 'month': {
        const monthAgo = new Date(now);
        monthAgo.setMonth(now.getMonth() - 1);
        return {
          startDate: formatDate(monthAgo),
          endDate: formatDate(now, true)
        };
      }
      case 'custom':
        if (customDateRange.start && customDateRange.end) {
          return {
            startDate: `${customDateRange.start}T00:00:00.000`,
            endDate: `${customDateRange.end}T23:59:59.999`
          };
        }
        return {
          startDate: formatDate(now),
          endDate: formatDate(now, true)
        };
      default:
        return {
          startDate: formatDate(now),
          endDate: formatDate(now, true)
        };
    }
  };

  const getFilterLabel = () => {
    switch (dateFilter) {
      case 'all': return 'All Time';
      case 'today': return 'Today';
      case 'week': return 'Last 7 Days';
      case 'month': return 'Last 30 Days';
      case 'custom':
        if (customDateRange.start && customDateRange.end) {
          return `${new Date(customDateRange.start).toLocaleDateString()} - ${new Date(customDateRange.end).toLocaleDateString()}`;
        }
        return 'Custom Range';
      default: return 'Today';
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

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const handleCreateExpense = async () => {
    if (!newExpense.description.trim() || !newExpense.amount) {
      showToast('Please fill in all fields');
      return;
    }

    setSaving(true);
    try {
      await expensesAPI.create({
        description: newExpense.description,
        amount: parseFloat(newExpense.amount),
        category: newExpense.category.toUpperCase().replace(' ', '_')
      });
      setNewExpense({ description: '', amount: '', category: 'Utilities' });
      showToast('Expense Logged');
      loadExpenses();
    } catch (error) {
      console.error('Error creating expense:', error);
      showToast('Failed to add expense');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Calculate expenses by category for chart
  const expensesByCategory = categories.reduce((acc, cat) => {
    const catExpenses = expenses.filter(e =>
      e.category?.toLowerCase().replace('_', ' ') === cat.toLowerCase()
    );
    acc[cat] = catExpenses.reduce((sum, e) => sum + e.amount, 0);
    return acc;
  }, {});

  const maxCategoryAmount = Math.max(...Object.values(expensesByCategory), 1);

  // Group expenses by actual date for better breakdown
  const dailyTrend = expenses.reduce((acc, expense) => {
    const date = new Date(expense.createdAt);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format for sorting
    const displayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!acc[dateKey]) acc[dateKey] = { display: displayDate, amount: 0 };
    acc[dateKey].amount += expense.amount;
    return acc;
  }, {});

  // Sort by date and take last 7 days
  const sortedDailyTrend = Object.entries(dailyTrend)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7)
    .map(([key, value]) => ({ date: key, display: value.display, amount: value.amount }));

  const maxDailyAmount = Math.max(...sortedDailyTrend.map(d => d.amount), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${textClass}`}>
            Expenses
          </h1>
          <p className={`text-sm ${mutedClass} mt-1`}>
            Track operational expenses
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Button */}
          <button
            onClick={() => exportExpenses(expenses, currencySymbol)}
            disabled={expenses.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-xs font-bold uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
            title="Export to Excel"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          {/* Date Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`flex items-center gap-2 px-4 py-2.5 ${surfaceClass} border ${borderClass} rounded-xl text-xs font-bold uppercase ${textClass} hover:border-accent-500 transition-colors`}
            >
              <Calendar className="w-4 h-4" />
              {getFilterLabel()}
              <ChevronDown className="w-4 h-4" />
            </button>

            {showDatePicker && (
            <div className={`absolute right-0 top-full mt-2 ${surfaceClass} border ${borderClass} rounded-2xl p-4 shadow-xl z-50 min-w-[280px]`}>
              <div className="space-y-2 mb-4">
                {['all', 'today', 'week', 'month'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setDateFilter(filter);
                      setShowDatePicker(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold uppercase transition-colors ${
                      dateFilter === filter
                        ? 'bg-accent-500 text-white'
                        : `${mutedClass} hover:${textClass} hover:bg-slate-100 dark:hover:bg-slate-700`
                    }`}
                  >
                    {filter === 'all' && 'All Time'}
                    {filter === 'today' && 'Today'}
                    {filter === 'week' && 'Last 7 Days'}
                    {filter === 'month' && 'Last 30 Days'}
                  </button>
                ))}
              </div>

              <div className={`border-t ${borderClass} pt-4`}>
                <p className={`text-[10px] font-black uppercase ${mutedClass} mb-2`}>Custom Range</p>
                <div className="space-y-2">
                  <div>
                    <label className={`text-[10px] font-bold ${mutedClass} block mb-1`}>Start Date</label>
                    <input
                      type="date"
                      value={customDateRange.start}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className={`w-full px-3 py-2 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} ${textClass} rounded-lg text-xs border ${borderClass}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[10px] font-bold ${mutedClass} block mb-1`}>End Date</label>
                    <input
                      type="date"
                      value={customDateRange.end}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className={`w-full px-3 py-2 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} ${textClass} rounded-lg text-xs border ${borderClass}`}
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (customDateRange.start && customDateRange.end) {
                        setDateFilter('custom');
                        setShowDatePicker(false);
                      }
                    }}
                    disabled={!customDateRange.start || !customDateRange.end}
                    className="w-full py-2.5 bg-accent-500 text-white rounded-xl text-xs font-bold uppercase disabled:opacity-50"
                  >
                    Apply Custom Range
                  </button>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-5 col-span-2`}>
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="w-5 h-5 text-negative-500" />
            <p className={`text-[10px] font-black uppercase ${mutedClass}`}>Total Expenses</p>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-negative-500">{formatCurrency(totalExpenses)}</p>
          <p className={`text-[10px] ${mutedClass} mt-1`}>{expenses.length} entries</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-5`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-warning-500" />
            <p className={`text-[10px] font-black uppercase ${mutedClass}`}>Avg / Entry</p>
          </div>
          <p className="text-xl sm:text-2xl font-black text-warning-500">
            {formatCurrency(expenses.length > 0 ? totalExpenses / expenses.length : 0)}
          </p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-5`}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-accent-500" />
            <p className={`text-[10px] font-black uppercase ${mutedClass}`}>Categories</p>
          </div>
          <p className="text-xl sm:text-2xl font-black text-accent-500">
            {Object.values(expensesByCategory).filter(v => v > 0).length}
          </p>
        </div>
      </div>

      {/* Trend Chart - By Category */}
      <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-sm font-black uppercase ${textClass}`}>Expenses by Category</h3>
          <span className={`text-[10px] font-bold ${mutedClass}`}>{getFilterLabel()}</span>
        </div>
        <div className="space-y-3">
          {categories.map((cat) => {
            const amount = expensesByCategory[cat] || 0;
            const percentage = maxCategoryAmount > 0 ? (amount / maxCategoryAmount) * 100 : 0;

            return (
              <div key={cat} className="flex items-center gap-4">
                <div className={`w-24 text-[10px] font-bold ${mutedClass} uppercase`}>{cat}</div>
                <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-negative-400 to-negative-500 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className={`w-24 text-right text-xs font-black ${amount > 0 ? 'text-negative-500' : mutedClass}`}>
                  {formatCurrency(amount)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Trend Chart */}
      <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-sm font-black uppercase ${textClass}`}>Daily Breakdown</h3>
          <span className={`text-[10px] font-bold ${mutedClass}`}>{getFilterLabel()}</span>
        </div>
        {sortedDailyTrend.length > 0 ? (
          <div className="flex items-end justify-between gap-2 h-40">
            {sortedDailyTrend.map((day) => {
              const height = maxDailyAmount > 0 ? (day.amount / maxDailyAmount) * 100 : 0;

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                  <p className={`text-[10px] font-bold text-negative-500`}>
                    {formatCurrency(day.amount)}
                  </p>
                  <div className="w-full flex-1 flex items-end justify-center">
                    <div
                      className="w-full max-w-12 bg-gradient-to-t from-negative-500 to-negative-400 rounded-t-lg transition-all duration-500"
                      style={{ height: `${Math.max(height, 8)}%` }}
                    />
                  </div>
                  <p className={`text-[9px] font-bold ${mutedClass}`}>{day.display}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-40 flex flex-col items-center justify-center">
            <Wallet className={`w-10 h-10 ${mutedClass} opacity-30 mb-2`} />
            <p className={`text-xs ${mutedClass}`}>No expenses in this period</p>
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Log Expense Form */}
        <div className={`${surfaceClass} border ${borderClass} p-8 sm:p-10 rounded-[40px] shadow-xl space-y-6`}>
          <h2 className={`text-xl sm:text-2xl font-black uppercase mb-4 ${textClass}`}>Log Expense</h2>

          <div>
            <label className={`text-[10px] font-black uppercase ${mutedClass} mb-1 block tracking-widest`}>Category</label>
            <select
              value={newExpense.category}
              onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
              className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-accent-500 ${textClass}`}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={`text-[10px] font-black uppercase ${mutedClass} mb-1 block tracking-widest`}>Description</label>
            <input
              type="text"
              value={newExpense.description}
              onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
              placeholder="Enter reason..."
              className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-accent-500 ${textClass}`}
            />
          </div>

          <div>
            <label className={`text-[10px] font-black uppercase ${mutedClass} mb-1 block tracking-widest`}>Amount ({currencySymbol})</label>
            <input
              type="number"
              value={newExpense.amount}
              onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
              placeholder="0.00"
              step="0.01"
              className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-accent-500 ${textClass}`}
            />
          </div>

          <button
            onClick={handleCreateExpense}
            disabled={saving}
            className="w-full py-4 bg-accent-500 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-accent-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Log Entry'}
          </button>
        </div>

        {/* Expense List - Scrollable */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm font-black uppercase ${textClass}`}>Recent Entries</h3>
            <span className={`text-[10px] font-bold ${mutedClass}`}>{expenses.length} total</span>
          </div>

          <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2" style={{ scrollbarWidth: 'thin' }}>
            {expenses.length === 0 ? (
              <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-12 text-center`}>
                <Wallet className={`w-12 h-12 mx-auto mb-3 ${mutedClass} opacity-30`} />
                <p className={`text-sm font-bold ${textClass}`}>No expenses logged</p>
                <p className={`text-xs ${mutedClass}`}>Add your first expense using the form</p>
              </div>
            ) : (
              expenses.slice().reverse().map((expense) => (
                <div
                  key={expense.id}
                  className={`${surfaceClass} border ${borderClass} p-4 rounded-2xl flex justify-between items-center shadow-sm hover:border-accent-500 transition-colors`}
                >
                  <div>
                    <p className={`text-[10px] font-black uppercase ${textClass}`}>{expense.description}</p>
                    <p className={`text-[9px] ${mutedClass} uppercase flex items-center gap-2`}>
                      <span className={`px-2 py-0.5 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                        {expense.category?.replace('_', ' ')}
                      </span>
                      <span>
                        {new Date(expense.createdAt).toLocaleDateString()} at{' '}
                        {new Date(expense.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </p>
                  </div>
                  <p className="font-black text-sm text-negative-500">- {formatCurrency(expense.amount)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast.show && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
          <div className={`${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${darkMode ? 'border-slate-200' : 'border-white/10'}`}>
            <CheckCircle className="w-5 h-5 text-positive-500" />
            <span className="font-bold text-xs uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Click outside to close date picker */}
      {showDatePicker && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDatePicker(false)}
        />
      )}
    </div>
  );
};

export default ManagerExpenses;
