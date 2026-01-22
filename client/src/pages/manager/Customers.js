import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { customersAPI } from '../../api';
import { exportCustomers } from '../../utils/exportUtils';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  ShoppingBag,
  DollarSign,
  FileText,
  Calendar,
  TrendingUp,
  Download
} from 'lucide-react';

const ManagerCustomers = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, bgClass }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCustomer, setExpandedCustomer] = useState(null);
  const [sortBy, setSortBy] = useState('recent'); // recent, visits, spent, name

  const currencySymbol = user?.currencySymbol || '$';

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const response = await customersAPI.getAll();
      setCustomers(response.data.customers || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredCustomers = customers
    .filter(cust => {
      const matchesSearch =
        cust.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cust.phone?.includes(searchTerm) ||
        cust.email?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'visits':
          return (b.visitCount || 0) - (a.visitCount || 0);
        case 'spent':
          return (b.totalSpent || 0) - (a.totalSpent || 0);
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'recent':
        default:
          return new Date(b.lastVisit || b.createdAt) - new Date(a.lastVisit || a.createdAt);
      }
    });

  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
  const avgSpent = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
  const activeCustomers = customers.filter(c => c.visitCount > 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${textClass}`}>
            Customers
          </h1>
          <p className={`text-sm ${mutedClass}`}>
            View and manage your customer base
          </p>
        </div>
        <button
          onClick={() => exportCustomers(customers, currencySymbol)}
          disabled={customers.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
          title="Export to Excel"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-5 hover:border-accent-500 transition-colors cursor-pointer`}>
          <p className={`text-[10px] font-black uppercase ${mutedClass} mb-1`}>Total Customers</p>
          <p className={`text-2xl sm:text-3xl font-black text-accent-500`}>{totalCustomers}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-5 hover:border-accent-500 transition-colors cursor-pointer`}>
          <p className={`text-[10px] font-black uppercase ${mutedClass} mb-1`}>Active Customers</p>
          <p className={`text-2xl sm:text-3xl font-black text-positive-500`}>{activeCustomers}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-5 hover:border-accent-500 transition-colors cursor-pointer`}>
          <p className={`text-[10px] font-black uppercase ${mutedClass} mb-1`}>Total Revenue</p>
          <p className={`text-xl sm:text-2xl font-black ${textClass}`}>{formatCurrency(totalRevenue)}</p>
        </div>
        <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-5 hover:border-accent-500 transition-colors cursor-pointer`}>
          <p className={`text-[10px] font-black uppercase ${mutedClass} mb-1`}>Avg. Per Customer</p>
          <p className={`text-xl sm:text-2xl font-black ${textClass}`}>{formatCurrency(avgSpent)}</p>
        </div>
      </div>

      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className={`w-full ${surfaceClass} border ${borderClass} rounded-xl py-3 pl-11 pr-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 ${textClass}`}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {[
            { value: 'recent', label: 'Recent' },
            { value: 'visits', label: 'Most Visits' },
            { value: 'spent', label: 'Top Spenders' },
            { value: 'name', label: 'A-Z' }
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setSortBy(option.value)}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase whitespace-nowrap transition-all ${
                sortBy === option.value
                  ? darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'
                  : `${surfaceClass} border ${borderClass} ${mutedClass} hover:border-accent-500`
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer List */}
      <div className="space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-8 text-center`}>
            <User className={`w-12 h-12 mx-auto mb-3 ${mutedClass}`} />
            <p className={`text-sm font-bold ${textClass}`}>No customers found</p>
            <p className={`text-xs ${mutedClass}`}>
              {searchTerm ? 'Try adjusting your search' : 'Customers will appear here after their first purchase'}
            </p>
          </div>
        ) : (
          filteredCustomers.map((customer) => {
            const isExpanded = expandedCustomer === customer.id;
            return (
              <div key={customer.id}>
                {/* Customer Card - Clickable Header */}
                <div
                  onClick={() => setExpandedCustomer(isExpanded ? null : customer.id)}
                  className={`${surfaceClass} border ${isExpanded ? 'border-accent-500 rounded-t-[28px] border-b-0' : `${borderClass} rounded-[28px]`} p-5 cursor-pointer hover:border-accent-300 transition-colors shadow-sm`}
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 ${
                      darkMode ? 'bg-accent-900/50 text-accent-300' : 'bg-accent-100 text-accent-700'
                    }`}>
                      {getInitials(customer.name)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-sm sm:text-base font-bold ${textClass} truncate`}>
                          {customer.name}
                        </h3>
                        {customer.visitCount > 10 && (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            darkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            VIP
                          </span>
                        )}
                      </div>
                      {customer.phone && (
                        <p className={`text-xs ${mutedClass} flex items-center gap-1 mt-1`}>
                          <Phone className="w-3 h-3" />
                          {customer.phone}
                        </p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-6">
                      <div className="text-center">
                        <p className={`text-lg font-black text-accent-500`}>{customer.visitCount || 0}</p>
                        <p className={`text-[9px] ${mutedClass} uppercase`}>Visits</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-lg font-black ${textClass}`}>{formatCurrency(customer.totalSpent || 0)}</p>
                        <p className={`text-[9px] ${mutedClass} uppercase`}>Total Spent</p>
                      </div>
                    </div>

                    {/* Expand Icon */}
                    <div className={`${mutedClass}`}>
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>

                  {/* Mobile Stats */}
                  <div className="flex sm:hidden items-center gap-4 mt-3 pt-3 border-t border-dashed" style={{ borderColor: darkMode ? '#334155' : '#E5E7EB' }}>
                    <div className="flex items-center gap-2">
                      <ShoppingBag className={`w-3 h-3 ${mutedClass}`} />
                      <span className={`text-xs font-bold text-accent-500`}>{customer.visitCount || 0} visits</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className={`w-3 h-3 ${mutedClass}`} />
                      <span className={`text-xs font-bold ${textClass}`}>{formatCurrency(customer.totalSpent || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div
                    className={`${surfaceClass} border border-accent-500 border-t-0 rounded-b-[28px] p-6 ${darkMode ? 'bg-slate-800/50' : 'bg-accent-50/30'}`}
                  >
                    <div className="grid sm:grid-cols-2 gap-6">
                      {/* Contact Info */}
                      <div className="space-y-3">
                        <h4 className={`text-[10px] font-black uppercase tracking-wider ${mutedClass}`}>Contact Information</h4>

                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
                              <Phone className={`w-4 h-4 ${mutedClass}`} />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Phone</p>
                              <p className={`text-sm font-bold ${customer.phone ? textClass : `${mutedClass} italic`}`}>
                                {customer.phone || 'Not provided'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
                              <Mail className={`w-4 h-4 ${mutedClass}`} />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Email</p>
                              <p className={`text-sm font-bold ${customer.email ? textClass : `${mutedClass} italic`} break-all`}>
                                {customer.email || 'Not provided'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
                              <MapPin className={`w-4 h-4 ${mutedClass}`} />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Address</p>
                              <p className={`text-sm font-bold ${customer.address ? textClass : `${mutedClass} italic`}`}>
                                {customer.address || 'Not provided'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Purchase Stats */}
                      <div className="space-y-3">
                        <h4 className={`text-[10px] font-black uppercase tracking-wider ${mutedClass}`}>Purchase History</h4>

                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
                              <ShoppingBag className="w-4 h-4 text-accent-500" />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Total Visits</p>
                              <p className={`text-sm font-bold text-accent-500`}>{customer.visitCount || 0}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
                              <TrendingUp className="w-4 h-4 text-positive-500" />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Total Spent</p>
                              <p className={`text-sm font-bold text-positive-500`}>{formatCurrency(customer.totalSpent || 0)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
                              <Calendar className={`w-4 h-4 ${mutedClass}`} />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Last Visit</p>
                              <p className={`text-sm font-bold ${textClass}`}>
                                {customer.lastVisit
                                  ? new Date(customer.lastVisit).toLocaleDateString()
                                  : 'Never'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
                              <Clock className={`w-4 h-4 ${mutedClass}`} />
                            </div>
                            <div>
                              <p className={`text-[10px] ${mutedClass}`}>Customer Since</p>
                              <p className={`text-sm font-bold ${textClass}`}>
                                {customer.createdAt
                                  ? new Date(customer.createdAt).toLocaleDateString()
                                  : 'Unknown'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notes Section */}
                    {customer.notes && (
                      <div className={`mt-4 pt-4 border-t ${borderClass}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
                            <FileText className={`w-4 h-4 ${mutedClass}`} />
                          </div>
                          <div>
                            <p className={`text-[10px] font-black uppercase ${mutedClass} mb-1`}>Notes</p>
                            <p className={`text-sm ${textClass}`}>{customer.notes}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ManagerCustomers;
