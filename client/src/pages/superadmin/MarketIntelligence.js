import React, { useState, useEffect, useRef } from 'react';
import { marketIntelligenceAPI } from '../../api';
import {
  TrendingUp,
  ShoppingCart,
  PieChart,
  BarChart3,
  Clock,
  MapPin,
  Package,
  Download,
  RefreshCw,
  ChevronRight,
  Layers,
  Target,
  Zap,
  Activity,
  Globe,
  DollarSign,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Search,
  Building2,
  Store,
  Utensils,
  Calendar,
  ChevronDown,
  X
} from 'lucide-react';

const MarketIntelligence = ({
  darkMode = false,
  surfaceClass = 'bg-white',
  textClass = 'text-slate-900',
  mutedClass = 'text-slate-500',
  borderClass = 'border-slate-200'
}) => {
  const [activeTab, setActiveTab] = useState('basket');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('30');
  const [error, setError] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDates, setCustomDates] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const datePickerRef = useRef(null);

  // Data states
  const [basketData, setBasketData] = useState(null);
  const [brandData, setBrandData] = useState(null);
  const [locationData, setLocationData] = useState(null);
  const [peakHoursData, setPeakHoursData] = useState(null);
  const [elasticityData, setElasticityData] = useState(null);
  const [exportData, setExportData] = useState(null);

  const tabs = [
    { id: 'basket', label: 'Basket Analysis', icon: ShoppingCart },
    { id: 'brand', label: 'Brand Share', icon: PieChart },
    { id: 'location', label: 'Spending Patterns', icon: MapPin },
    { id: 'peak', label: 'Peak Hours', icon: Clock },
    { id: 'elasticity', label: 'Price Elasticity', icon: TrendingUp },
    { id: 'export', label: 'Data Export', icon: Download }
  ];

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, period, customDates]);

  const loadTabData = async (tab) => {
    setLoading(true);
    setError(null);

    // Build params based on period type
    const getParams = () => {
      if (period === 'custom') {
        return {
          startDate: customDates.startDate,
          endDate: customDates.endDate
        };
      }
      return { period };
    };

    try {
      const params = getParams();
      switch (tab) {
        case 'basket':
          const basketRes = await marketIntelligenceAPI.getBasketAnalysis({ ...params, limit: 50 });
          setBasketData(basketRes.data);
          break;
        case 'brand':
          const brandRes = await marketIntelligenceAPI.getBrandShare(params);
          setBrandData(brandRes.data);
          break;
        case 'location':
          const locationRes = await marketIntelligenceAPI.getSpendingByLocation(params);
          setLocationData(locationRes.data);
          break;
        case 'peak':
          const peakRes = await marketIntelligenceAPI.getPeakHours(params);
          setPeakHoursData(peakRes.data);
          break;
        case 'elasticity':
          const elasticityRes = await marketIntelligenceAPI.getPriceElasticity({ period: 90 });
          setElasticityData(elasticityRes.data);
          break;
        case 'export':
          const [summaryRes, trendsRes] = await Promise.all([
            marketIntelligenceAPI.exportSummary(params),
            marketIntelligenceAPI.exportTrends(params)
          ]);
          setExportData({ summary: summaryRes.data, trends: trendsRes.data });
          break;
        default:
          break;
      }
    } catch (err) {
      console.error(`Failed to load ${tab} data:`, err);
      setError(`Failed to load ${tab} data. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTabData(activeTab);
    setRefreshing(false);
  };

  const getPeriodLabel = () => {
    if (period === 'custom') {
      const start = new Date(customDates.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = new Date(customDates.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${start} - ${end}`;
    }
    return period === '7' ? 'Last 7 days' : period === '30' ? 'Last 30 days' : 'Last 90 days';
  };

  const handlePresetClick = (preset) => {
    setPeriod(preset);
    setShowDatePicker(false);
  };

  const handleApplyCustomDates = () => {
    setPeriod('custom');
    setShowDatePicker(false);
  };

  const handleDownloadCSV = async () => {
    try {
      const response = await marketIntelligenceAPI.downloadSummaryCSV(parseInt(period));
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `platform-summary-${period}d.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format((amount || 0) / 100);
  };

  const formatNumber = (num) => new Intl.NumberFormat('en-US').format(num || 0);

  // ==========================================
  // BASKET ANALYSIS TAB
  // ==========================================
  const renderBasketAnalysis = () => {
    if (!basketData) return null;

    return (
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{formatNumber(basketData.totalTransactions)}</p>
                <p className={`text-xs ${mutedClass}`}>Transactions Analyzed</p>
              </div>
            </div>
          </div>
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{formatNumber(basketData.totalProducts)}</p>
                <p className={`text-xs ${mutedClass}`}>Unique Products</p>
              </div>
            </div>
          </div>
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Layers className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{basketData.affinityPairs?.length || 0}</p>
                <p className={`text-xs ${mutedClass}`}>Product Pairs Found</p>
              </div>
            </div>
          </div>
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Target className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>
                  {basketData.affinityPairs?.length > 0 ? basketData.affinityPairs[0]?.lift?.toFixed(1) : '-'}x
                </p>
                <p className={`text-xs ${mutedClass}`}>Highest Lift</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Affinity Pairs */}
          <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${borderClass}`}>
              <h3 className={`text-sm font-bold uppercase ${mutedClass}`}>Product Affinity Pairs</h3>
              <p className={`text-xs ${mutedClass}`}>Products frequently purchased together</p>
            </div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {(!basketData.affinityPairs || basketData.affinityPairs.length === 0) ? (
                <div className="px-6 py-12 text-center">
                  <Layers className={`w-8 h-8 mx-auto mb-2 ${mutedClass}`} />
                  <p className={`text-sm ${mutedClass}`}>Not enough data for basket analysis</p>
                </div>
              ) : (
                basketData.affinityPairs.slice(0, 15).map((pair, index) => (
                  <div key={index} className={`px-6 py-4 hover:${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className={`text-sm font-bold ${textClass} truncate max-w-24`}>{pair.productA}</span>
                        <ChevronRight className={`w-4 h-4 ${mutedClass} shrink-0`} />
                        <span className={`text-sm font-bold ${textClass} truncate max-w-24`}>{pair.productB}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        pair.lift >= 2 ? 'bg-emerald-100 text-emerald-700' :
                        pair.lift >= 1.5 ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {pair.lift.toFixed(1)}x lift
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className={mutedClass}>{pair.coOccurrences} co-occurrences</span>
                      <span className={mutedClass}>Support: {pair.support}%</span>
                      <span className={mutedClass}>Confidence: {pair.confidenceAB}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Products */}
          <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${borderClass}`}>
              <h3 className={`text-sm font-bold uppercase ${mutedClass}`}>Most Frequent Products</h3>
              <p className={`text-xs ${mutedClass}`}>Products appearing in most baskets</p>
            </div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {(!basketData.topProducts || basketData.topProducts.length === 0) ? (
                <div className="px-6 py-12 text-center">
                  <Package className={`w-8 h-8 mx-auto mb-2 ${mutedClass}`} />
                  <p className={`text-sm ${mutedClass}`}>No product data available</p>
                </div>
              ) : (
                basketData.topProducts.map((product, index) => (
                  <div key={index} className={`px-6 py-3 hover:${darkMode ? 'bg-slate-700' : 'bg-slate-50'} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        index < 3 ? 'bg-amber-100 text-amber-700' : darkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {index + 1}
                      </span>
                      <div>
                        <p className={`text-sm font-bold ${textClass}`}>{product.name}</p>
                        <p className={`text-xs ${mutedClass}`}>{product.category || 'General'}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${textClass}`}>{formatNumber(product.frequency)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // BRAND SHARE TAB
  // ==========================================
  const renderBrandShare = () => {
    if (!brandData) return null;

    return (
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{formatCurrency(brandData.totalRevenue)}</p>
                <p className={`text-xs ${mutedClass}`}>Total Revenue</p>
              </div>
            </div>
          </div>
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{formatNumber(brandData.totalUnits)}</p>
                <p className={`text-xs ${mutedClass}`}>Units Sold</p>
              </div>
            </div>
          </div>
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Layers className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{brandData.brands?.length || 0}</p>
                <p className={`text-xs ${mutedClass}`}>Brands Tracked</p>
              </div>
            </div>
          </div>
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <PieChart className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{brandData.categoryBreakdown?.length || 0}</p>
                <p className={`text-xs ${mutedClass}`}>Categories</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Brand Rankings */}
          <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${borderClass}`}>
              <h3 className={`text-sm font-bold uppercase ${mutedClass}`}>Brand Market Share</h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {(!brandData.brands || brandData.brands.length === 0) ? (
                <div className="px-6 py-12 text-center">
                  <PieChart className={`w-8 h-8 mx-auto mb-2 ${mutedClass}`} />
                  <p className={`text-sm ${mutedClass}`}>No brand data available</p>
                </div>
              ) : (
                brandData.brands.slice(0, 20).map((brand, index) => (
                  <div key={index} className={`px-6 py-4 hover:${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-amber-100 text-amber-700' :
                          index === 1 ? 'bg-slate-200 text-slate-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          darkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {index + 1}
                        </span>
                        <div>
                          <p className={`text-sm font-bold ${textClass}`}>{brand.brand}</p>
                          <p className={`text-xs ${mutedClass}`}>{brand.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${textClass}`}>{formatCurrency(brand.revenue)}</p>
                        <p className={`text-xs ${mutedClass}`}>{brand.revenueShare}% share</p>
                      </div>
                    </div>
                    <div className={`h-1.5 rounded-full ${darkMode ? 'bg-slate-600' : 'bg-slate-100'}`}>
                      <div
                        className="h-full rounded-full bg-indigo-600"
                        style={{ width: `${Math.min(brand.revenueShare * 2, 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${borderClass}`}>
              <h3 className={`text-sm font-bold uppercase ${mutedClass}`}>Category Performance</h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {(!brandData.categoryBreakdown || brandData.categoryBreakdown.length === 0) ? (
                <div className="px-6 py-12 text-center">
                  <BarChart3 className={`w-8 h-8 mx-auto mb-2 ${mutedClass}`} />
                  <p className={`text-sm ${mutedClass}`}>No category data available</p>
                </div>
              ) : (
                brandData.categoryBreakdown.map((cat, index) => (
                  <div key={index} className={`px-6 py-4 hover:${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className={`text-sm font-bold ${textClass}`}>{cat.category}</p>
                        <p className={`text-xs ${mutedClass}`}>{cat.brandCount} brands · {formatNumber(cat.units)} units</p>
                      </div>
                      <p className={`text-sm font-bold ${textClass}`}>{formatCurrency(cat.revenue)}</p>
                    </div>
                    {cat.topBrands?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {cat.topBrands.slice(0, 3).map((b, i) => (
                          <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-slate-600' : 'bg-slate-100'} ${textClass}`}>
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // LOCATION/SPENDING PATTERNS TAB
  // ==========================================
  const renderLocationData = () => {
    if (!locationData) return null;

    return (
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{formatCurrency(locationData.summary?.totalRevenue)}</p>
                <p className={`text-xs ${mutedClass}`}>Total Revenue</p>
              </div>
            </div>
          </div>
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{formatNumber(locationData.summary?.totalTransactions)}</p>
                <p className={`text-xs ${mutedClass}`}>Transactions</p>
              </div>
            </div>
          </div>
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Globe className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{locationData.summary?.totalCountries || 1}</p>
                <p className={`text-xs ${mutedClass}`}>Countries</p>
              </div>
            </div>
          </div>
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Store className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{locationData.summary?.totalLocations || 0}</p>
                <p className={`text-xs ${mutedClass}`}>Business Types</p>
              </div>
            </div>
          </div>
        </div>

        {/* Location Breakdown */}
        <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${borderClass}`}>
            <h3 className={`text-sm font-bold uppercase ${mutedClass}`}>Spending by Business Type</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {(!locationData.locations || locationData.locations.length === 0) ? (
              <div className="px-6 py-12 text-center">
                <MapPin className={`w-8 h-8 mx-auto mb-2 ${mutedClass}`} />
                <p className={`text-sm ${mutedClass}`}>No location data available</p>
              </div>
            ) : (
              locationData.locations.map((loc, index) => (
                <div key={index} className={`px-6 py-4 hover:${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${darkMode ? 'bg-slate-600' : 'bg-indigo-100'} flex items-center justify-center`}>
                        {loc.businessType === 'RESTAURANT' ? <Utensils className="w-5 h-5 text-indigo-600" /> :
                         loc.businessType === 'RETAIL' ? <Store className="w-5 h-5 text-indigo-600" /> :
                         <Building2 className="w-5 h-5 text-indigo-600" />}
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${textClass}`}>{loc.businessType}</p>
                        <p className={`text-xs ${mutedClass}`}>{loc.country} · {loc.tenantCount} tenants</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${textClass}`}>{formatCurrency(loc.totalRevenue)}</p>
                      <p className={`text-xs ${mutedClass}`}>{formatNumber(loc.totalTransactions)} transactions</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div className={`p-2 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                      <p className={`text-xs ${mutedClass}`}>Avg Ticket</p>
                      <p className={`text-sm font-bold ${textClass}`}>{formatCurrency(loc.avgTicket)}</p>
                    </div>
                    <div className={`p-2 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                      <p className={`text-xs ${mutedClass}`}>Avg Txn/Tenant</p>
                      <p className={`text-sm font-bold ${textClass}`}>{formatNumber(loc.avgTransactionsPerTenant)}</p>
                    </div>
                    <div className={`p-2 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                      <p className={`text-xs ${mutedClass}`}>Peak Hours</p>
                      <p className={`text-sm font-bold ${textClass}`}>{loc.peakHours?.join(', ') || '-'}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // PEAK HOURS TAB
  // ==========================================
  const renderPeakHours = () => {
    if (!peakHoursData) return null;

    const maxHourly = Math.max(...(peakHoursData.hourlyStats?.map(h => h.transactions) || [1]));
    const maxDaily = Math.max(...(peakHoursData.dailyStats?.map(d => d.transactions) || [1]));

    return (
      <div className="space-y-6">
        {/* Insights Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Zap className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{peakHoursData.insights?.peakHour || '-'}</p>
                <p className={`text-xs ${mutedClass}`}>Peak Hour</p>
              </div>
            </div>
          </div>
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{peakHoursData.insights?.peakDay || '-'}</p>
                <p className={`text-xs ${mutedClass}`}>Busiest Day</p>
              </div>
            </div>
          </div>
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{peakHoursData.insights?.busiestPeriod || '-'}</p>
                <p className={`text-xs ${mutedClass}`}>Busiest Period</p>
              </div>
            </div>
          </div>
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{formatNumber(peakHoursData.totalTransactions)}</p>
                <p className={`text-xs ${mutedClass}`}>Total Transactions</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hourly Distribution */}
          <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${borderClass}`}>
              <h3 className={`text-sm font-bold uppercase ${mutedClass}`}>Hourly Distribution</h3>
            </div>
            <div className="p-6">
              <div className="flex items-end justify-between gap-1 h-40">
                {peakHoursData.hourlyStats?.map((hour, index) => (
                  <div key={index} className="flex flex-col items-center flex-1">
                    <div
                      className={`w-full rounded-t ${hour.transactions === Math.max(...peakHoursData.hourlyStats.map(h => h.transactions)) ? 'bg-emerald-500' : 'bg-indigo-400'}`}
                      style={{ height: `${(hour.transactions / maxHourly) * 100}%`, minHeight: '2px' }}
                      title={`${hour.hour}:00 - ${hour.transactions} transactions`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2">
                <span className={`text-xs ${mutedClass}`}>12am</span>
                <span className={`text-xs ${mutedClass}`}>6am</span>
                <span className={`text-xs ${mutedClass}`}>12pm</span>
                <span className={`text-xs ${mutedClass}`}>6pm</span>
                <span className={`text-xs ${mutedClass}`}>11pm</span>
              </div>
            </div>
          </div>

          {/* Daily Distribution */}
          <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${borderClass}`}>
              <h3 className={`text-sm font-bold uppercase ${mutedClass}`}>Daily Distribution</h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {peakHoursData.dailyStats?.map((day, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className={`w-10 text-xs font-bold ${textClass}`}>{day.dayName}</span>
                    <div className={`flex-1 h-6 rounded-lg ${darkMode ? 'bg-slate-600' : 'bg-slate-100'} overflow-hidden`}>
                      <div
                        className={`h-full rounded-lg ${day.transactions === Math.max(...peakHoursData.dailyStats.map(d => d.transactions)) ? 'bg-emerald-500' : 'bg-indigo-400'}`}
                        style={{ width: `${(day.transactions / maxDaily) * 100}%` }}
                      />
                    </div>
                    <span className={`w-16 text-right text-xs font-bold ${textClass}`}>{formatNumber(day.transactions)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // PRICE ELASTICITY TAB
  // ==========================================
  const renderElasticity = () => {
    if (!elasticityData) return null;

    return (
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{elasticityData.productsAnalyzed || 0}</p>
                <p className={`text-xs ${mutedClass}`}>Products Analyzed</p>
              </div>
            </div>
          </div>
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <ArrowDownRight className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{elasticityData.summary?.elasticProducts || 0}</p>
                <p className={`text-xs ${mutedClass}`}>Elastic Products</p>
              </div>
            </div>
          </div>
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{elasticityData.summary?.inelasticProducts || 0}</p>
                <p className={`text-xs ${mutedClass}`}>Inelastic Products</p>
              </div>
            </div>
          </div>
          <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className={`text-xl font-bold ${textClass}`}>{elasticityData.period || 90}d</p>
                <p className={`text-xs ${mutedClass}`}>Analysis Period</p>
              </div>
            </div>
          </div>
        </div>

        {/* Elasticity Table */}
        <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${borderClass}`}>
            <h3 className={`text-sm font-bold uppercase ${mutedClass}`}>Price Elasticity Analysis</h3>
            <p className={`text-xs ${mutedClass}`}>How price changes affect demand</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {(!elasticityData.elasticityData || elasticityData.elasticityData.length === 0) ? (
              <div className="px-6 py-12 text-center">
                <TrendingUp className={`w-8 h-8 mx-auto mb-2 ${mutedClass}`} />
                <p className={`text-sm ${mutedClass}`}>Not enough price variation data</p>
                <p className={`text-xs ${mutedClass}`}>Products need multiple price points for elasticity analysis</p>
              </div>
            ) : (
              elasticityData.elasticityData.slice(0, 20).map((product, index) => (
                <div key={index} className={`px-6 py-4 hover:${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-bold ${textClass}`}>{product.product}</p>
                      <p className={`text-xs ${mutedClass}`}>{product.category || 'General'} · Price range: {product.priceRange}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold ${textClass}`}>{product.elasticity}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        product.elasticityType === 'Elastic' ? 'bg-emerald-100 text-emerald-700' :
                        product.elasticityType === 'Inelastic' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {product.elasticityType}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Explanation */}
        <div className={`${surfaceClass} rounded-xl p-4 border ${borderClass}`}>
          <h4 className={`text-sm font-bold ${textClass} mb-2`}>Understanding Elasticity</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <p className={`font-bold text-emerald-600`}>Elastic (e &lt; -1)</p>
              <p className={mutedClass}>Demand highly sensitive to price. Price increase leads to proportionally larger drop in sales.</p>
            </div>
            <div>
              <p className={`font-bold text-amber-600`}>Inelastic (-1 &lt; e &lt; 0)</p>
              <p className={mutedClass}>Demand less sensitive to price. Good candidates for price increases with minimal sales impact.</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // DATA EXPORT TAB
  // ==========================================
  const renderDataExport = () => {
    if (!exportData) return null;

    return (
      <div className="space-y-6">
        {/* Platform Summary */}
        <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${borderClass} flex items-center justify-between`}>
            <div>
              <h3 className={`text-sm font-bold uppercase ${mutedClass}`}>Platform Summary Export</h3>
              <p className={`text-xs ${mutedClass}`}>Anonymized aggregate data for {period} days</p>
            </div>
            <button
              onClick={handleDownloadCSV}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                <p className={`text-xs ${mutedClass} mb-1`}>Active Tenants</p>
                <p className={`text-xl font-bold ${textClass}`}>{exportData.summary?.platformSummary?.activeTenants || 0}</p>
              </div>
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                <p className={`text-xs ${mutedClass} mb-1`}>Transaction Volume</p>
                <p className={`text-xl font-bold ${textClass}`}>{formatNumber(exportData.summary?.platformSummary?.transactionVolume)}</p>
              </div>
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                <p className={`text-xs ${mutedClass} mb-1`}>Total Revenue</p>
                <p className={`text-xl font-bold ${textClass}`}>{formatCurrency(exportData.summary?.platformSummary?.totalRevenue)}</p>
              </div>
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                <p className={`text-xs ${mutedClass} mb-1`}>Average Ticket Size</p>
                <p className={`text-xl font-bold ${textClass}`}>{formatCurrency(exportData.summary?.platformSummary?.averageTicketSize)}</p>
              </div>
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                <p className={`text-xs ${mutedClass} mb-1`}>Active Products</p>
                <p className={`text-xl font-bold ${textClass}`}>{formatNumber(exportData.summary?.platformSummary?.activeProducts)}</p>
              </div>
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                <p className={`text-xs ${mutedClass} mb-1`}>Avg Product Price</p>
                <p className={`text-xl font-bold ${textClass}`}>{formatCurrency(exportData.summary?.platformSummary?.averageProductPrice)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Category Performance */}
        <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${borderClass}`}>
            <h3 className={`text-sm font-bold uppercase ${mutedClass}`}>Category Performance</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {(!exportData.summary?.categoryPerformance || exportData.summary.categoryPerformance.length === 0) ? (
              <div className="px-6 py-12 text-center">
                <BarChart3 className={`w-8 h-8 mx-auto mb-2 ${mutedClass}`} />
                <p className={`text-sm ${mutedClass}`}>No category data available</p>
              </div>
            ) : (
              exportData.summary.categoryPerformance.slice(0, 10).map((cat, index) => (
                <div key={index} className={`px-6 py-3 flex items-center justify-between hover:${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                  <div>
                    <p className={`text-sm font-bold ${textClass}`}>{cat.category}</p>
                    <p className={`text-xs ${mutedClass}`}>{formatNumber(cat.units)} units</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${textClass}`}>{formatCurrency(cat.revenue)}</p>
                    <p className={`text-xs ${mutedClass}`}>{cat.revenueShare}% share</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Trend Data */}
        <div className={`${surfaceClass} rounded-2xl border ${borderClass} overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${borderClass}`}>
            <h3 className={`text-sm font-bold uppercase ${mutedClass}`}>Daily Trends ({exportData.trends?.metadata?.dataPoints || 0} days)</h3>
          </div>
          <div className="p-6">
            {exportData.trends?.trends?.length > 0 ? (
              <div className="h-48 flex items-end justify-between gap-1">
                {exportData.trends.trends.slice(-30).map((day, index) => (
                  <div key={index} className="flex flex-col items-center flex-1" title={`${day.date}: ${formatCurrency(day.revenue)}`}>
                    <div
                      className="w-full rounded-t bg-indigo-400 hover:bg-indigo-500"
                      style={{
                        height: `${(day.revenue / Math.max(...exportData.trends.trends.slice(-30).map(d => d.revenue || 1))) * 100}%`,
                        minHeight: '2px'
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <TrendingUp className={`w-8 h-8 mx-auto mb-2 ${mutedClass}`} />
                <p className={`text-sm ${mutedClass}`}>No trend data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // MAIN RENDER
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black ${textClass}`}>Market Intelligence</h1>
          <p className={`text-sm ${mutedClass}`}>Consumer behavior analytics and data insights</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date Range Picker */}
          <div className="relative" ref={datePickerRef}>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${borderClass} ${surfaceClass} ${textClass} text-sm font-bold hover:border-slate-400 transition-colors`}
            >
              <Calendar className="w-4 h-4" />
              <span>{getPeriodLabel()}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
            </button>

            {showDatePicker && (
              <div className={`absolute right-0 mt-2 ${surfaceClass} border ${borderClass} rounded-2xl shadow-xl z-50 overflow-hidden w-80`}>
                <div className={`flex items-center justify-between p-4 border-b ${borderClass}`}>
                  <h3 className={`text-sm font-bold ${textClass}`}>Select Date Range</h3>
                  <button
                    onClick={() => setShowDatePicker(false)}
                    className={`p-1 ${mutedClass} hover:${textClass} rounded-lg`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {/* Presets */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: '7', label: 'Last 7 days' },
                      { value: '30', label: 'Last 30 days' },
                      { value: '90', label: 'Last 90 days' }
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => handlePresetClick(preset.value)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                          period === preset.value
                            ? 'bg-indigo-600 text-white'
                            : `${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'} ${textClass}`
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom Date Inputs */}
                  <div className={`pt-4 border-t ${borderClass}`}>
                    <p className={`text-xs font-bold uppercase ${mutedClass} mb-3`}>Custom Range</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`text-xs ${mutedClass} mb-1 block`}>From</label>
                        <input
                          type="date"
                          value={customDates.startDate}
                          onChange={(e) => setCustomDates({ ...customDates, startDate: e.target.value })}
                          max={customDates.endDate}
                          className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                        />
                      </div>
                      <div>
                        <label className={`text-xs ${mutedClass} mb-1 block`}>To</label>
                        <input
                          type="date"
                          value={customDates.endDate}
                          onChange={(e) => setCustomDates({ ...customDates, endDate: e.target.value })}
                          min={customDates.startDate}
                          max={new Date().toISOString().split('T')[0]}
                          className={`w-full px-3 py-2 rounded-lg border ${borderClass} ${surfaceClass} ${textClass} text-sm`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Apply Button */}
                  <button
                    onClick={handleApplyCustomDates}
                    className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
                  >
                    Apply Custom Range
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`px-4 py-2 ${surfaceClass} border ${borderClass} rounded-xl text-sm font-bold ${textClass} hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50`}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`${surfaceClass} rounded-xl border ${borderClass} p-1 flex gap-1 overflow-x-auto`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : `${mutedClass} hover:${textClass} hover:bg-slate-100`
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {activeTab === 'basket' && renderBasketAnalysis()}
          {activeTab === 'brand' && renderBrandShare()}
          {activeTab === 'location' && renderLocationData()}
          {activeTab === 'peak' && renderPeakHours()}
          {activeTab === 'elasticity' && renderElasticity()}
          {activeTab === 'export' && renderDataExport()}
        </>
      )}
    </div>
  );
};

export default MarketIntelligence;
