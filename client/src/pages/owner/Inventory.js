import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { productsAPI, IMAGE_BASE_URL } from '../../api';
import { exportInventory } from '../../utils/exportUtils';
import ModifierManager from '../../components/ModifierManager';
import {
  Search,
  Package,
  AlertTriangle,
  CheckCircle,
  Bell,
  Filter,
  Check,
  Plus,
  X,
  Grid3X3,
  List,
  Edit3,
  Calendar,
  Image,
  Tag,
  Building2,
  Download,
  ChevronDown,
  Settings2
} from 'lucide-react';

const OwnerInventory = ({ darkMode, surfaceClass, textClass, mutedClass, borderClass, bgClass, currentBranch, isAllBranches, branches = [] }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStock, setFilterStock] = useState(false);
  const [activeStatsFilter, setActiveStatsFilter] = useState(null);
  const [stockUpdates, setStockUpdates] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [customCategories, setCustomCategories] = useState(['All', 'Products', 'Services']);
  // Check if this is a services-type business (defined early for form default)
  const isServicesTypeBusiness = ['SERVICES', 'SALON'].includes(user?.businessType);

  const [newProduct, setNewProduct] = useState({
    name: '',
    category: isServicesTypeBusiness ? 'SERVICE' : 'PRODUCT', // Default to SERVICE for salon businesses
    customCategory: '',
    costPrice: '',
    price: '',
    stock: '',
    expiryDate: '',
    lowStockThreshold: '10',
    branchId: ''
  });
  const [toast, setToast] = useState({ show: false, message: '' });
  // Branch filter for drilling down when in "All Branches" mode
  const [branchFilter, setBranchFilter] = useState(null);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  // Image upload state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);
  // Modifier manager state
  const [showModifierManager, setShowModifierManager] = useState(false);
  const [modifierProduct, setModifierProduct] = useState(null);

  const currencySymbol = user?.currencySymbol || '$';

  // Use the already defined isServicesTypeBusiness
  const isServicesType = isServicesTypeBusiness;
  // Check if restaurant type
  const isRestaurantType = user?.businessType === 'FOOD_AND_BEVERAGE';

  // Get the effective branchId for API calls
  const getEffectiveBranchId = () => {
    if (!isAllBranches && currentBranch) {
      return currentBranch.id;
    }
    if (isAllBranches && branchFilter) {
      return branchFilter.id;
    }
    return null;
  };

  // Reset branch filter when switching away from "All Branches" mode
  useEffect(() => {
    if (!isAllBranches) {
      setBranchFilter(null);
    }
  }, [isAllBranches]);

  useEffect(() => {
    loadProducts();
  }, [currentBranch, isAllBranches, branchFilter]);

  // Apply filter from navigation state (from dashboard alerts)
  useEffect(() => {
    if (location.state?.filter) {
      setActiveStatsFilter(location.state.filter);
      // Clear the state so it doesn't persist on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const productCategories = products
      .map(p => p.customCategory)
      .filter(Boolean);
    const uniqueCategories = ['All', 'Products', 'Services', ...new Set(productCategories)];
    setCustomCategories(uniqueCategories);
  }, [products]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = {};
      const effectiveBranchId = getEffectiveBranchId();
      if (effectiveBranchId) {
        params.branchId = effectiveBranchId;
      }
      const response = await productsAPI.getAll(params);
      const allProducts = response.data.products || [];
      setProducts(allProducts);
      const updates = {};
      allProducts.forEach(p => {
        updates[p.id] = p.stockQuantity;
      });
      setStockUpdates(updates);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const formatCurrency = (amount) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStockStatus = (product) => {
    if (product.type === 'SERVICE') return 'service';
    if (product.stockQuantity === 0) return 'out';
    if (product.stockQuantity <= (product.lowStockThreshold || 10)) return 'low';
    return 'ok';
  };

  const getExpiryStatus = (product) => {
    if (!product.expiryDate) return null;
    const now = new Date();
    const expiryDate = new Date(product.expiryDate);
    const diffDays = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= 30) return 'critical';
    if (diffDays <= 90) return 'warning';
    return 'ok';
  };

  const updateStock = async (productId) => {
    const newStock = stockUpdates[productId];
    try {
      await productsAPI.update(productId, { stockQuantity: parseInt(newStock) });
      setProducts(prev => prev.map(p =>
        p.id === productId ? { ...p, stockQuantity: parseInt(newStock) } : p
      ));
      showToast('Stock Level Updated');
    } catch (error) {
      showToast('Failed to update stock');
    }
  };

  const openEditModal = (product) => {
    setEditingProduct({
      ...product,
      costPrice: product.costPrice || 0,
      price: product.sellingPrice,
      stock: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold || 10,
      expiryDate: product.expiryDate ? new Date(product.expiryDate).toISOString().split('T')[0] : ''
    });
    // Clear any previous edit image state
    setEditImageFile(null);
    setEditImagePreview(null);
    if (editFileInputRef.current) editFileInputRef.current.value = '';
    setShowEditModal(true);
  };

  const getProfit = (product) => {
    return (product.sellingPrice || 0) - (product.costPrice || 0);
  };

  const getProfitMargin = (product) => {
    if (!product.sellingPrice || product.sellingPrice === 0) return 0;
    return ((getProfit(product) / product.sellingPrice) * 100).toFixed(1);
  };

  const openModifierManager = (product) => {
    setModifierProduct(product);
    setShowModifierManager(true);
  };

  const saveProductEdit = async () => {
    try {
      let updateData;
      if (editImageFile) {
        // Use FormData when there's a new image
        updateData = new FormData();
        updateData.append('image', editImageFile);
        updateData.append('name', editingProduct.name);
        updateData.append('costPrice', editingProduct.costPrice || '0');
        updateData.append('sellingPrice', editingProduct.price);
        updateData.append('stockQuantity', editingProduct.stock || '0');
        if (editingProduct.expiryDate) updateData.append('expiryDate', editingProduct.expiryDate);
        updateData.append('lowStockThreshold', editingProduct.lowStockThreshold || '10');
        if (editingProduct.customCategory) updateData.append('customCategory', editingProduct.customCategory);
      } else {
        // Use JSON when no image change
        updateData = {
          name: editingProduct.name,
          costPrice: parseFloat(editingProduct.costPrice) || 0,
          sellingPrice: parseFloat(editingProduct.price),
          stockQuantity: parseInt(editingProduct.stock) || 0,
          expiryDate: editingProduct.expiryDate || null,
          lowStockThreshold: parseInt(editingProduct.lowStockThreshold) || 10,
          customCategory: editingProduct.customCategory
        };
      }
      await productsAPI.update(editingProduct.id, updateData);
      setShowEditModal(false);
      setEditingProduct(null);
      setEditImageFile(null);
      setEditImagePreview(null);
      if (editFileInputRef.current) editFileInputRef.current.value = '';
      showToast('Product Updated');
      loadProducts();
    } catch (error) {
      showToast('Failed to update product');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' ||
      (filterCategory === 'Services' && p.type === 'SERVICE') ||
      (filterCategory === 'Products' && p.type === 'PRODUCT') ||
      p.customCategory === filterCategory;
    const status = getStockStatus(p);
    const expiryStatus = getExpiryStatus(p);
    const matchesStock = !filterStock || (status === 'low' || status === 'out');

    // Stats card filter
    let matchesStatsFilter = true;
    if (activeStatsFilter) {
      switch (activeStatsFilter) {
        case 'services':
          matchesStatsFilter = p.type === 'SERVICE';
          break;
        case 'lowStock':
          matchesStatsFilter = status === 'low';
          break;
        case 'outOfStock':
          matchesStatsFilter = status === 'out';
          break;
        case 'expiringSoon':
          matchesStatsFilter = ['critical', 'warning'].includes(expiryStatus);
          break;
        case 'expired':
          matchesStatsFilter = expiryStatus === 'expired';
          break;
        default:
          matchesStatsFilter = true;
      }
    }

    return matchesSearch && matchesCategory && matchesStock && matchesStatsFilter;
  });

  const stats = {
    total: products.length,
    services: products.filter(p => p.type === 'SERVICE').length,
    lowStock: products.filter(p => getStockStatus(p) === 'low').length,
    outOfStock: products.filter(p => getStockStatus(p) === 'out').length,
    expiringSoon: products.filter(p => ['critical', 'warning'].includes(getExpiryStatus(p))).length,
    expired: products.filter(p => getExpiryStatus(p) === 'expired').length
  };

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
          <h1 className={`text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-tighter ${textClass}`}>
            {isServicesType ? 'Services Menu' : isRestaurantType ? 'Menu Management' : 'Inventory Control'}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Building2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <p className={`text-sm ${mutedClass}`}>
              {isAllBranches ? 'All Branches' : currentBranch?.name || 'Select a branch'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Filter Chip - Only show when filter is active in All Branches mode */}
          {isAllBranches && branchFilter && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-bold">
              <span>Filtered: {branchFilter.name}</span>
              <button
                onClick={() => setBranchFilter(null)}
                className="hover:bg-slate-700 dark:hover:bg-slate-600 rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Branch Filter Dropdown - Only show in All Branches mode */}
          {isAllBranches && (
            <div className="relative">
              <button
                onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl border ${borderClass} ${surfaceClass} ${textClass} text-[10px] font-black uppercase hover:border-slate-400 transition-colors`}
              >
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">{branchFilter ? branchFilter.name : 'All'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showBranchDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showBranchDropdown && (
                <div className={`absolute right-0 mt-2 w-56 ${surfaceClass} border ${borderClass} rounded-xl shadow-xl z-50 overflow-hidden`}>
                  <button
                    onClick={() => {
                      setBranchFilter(null);
                      setShowBranchDropdown(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 ${textClass} ${!branchFilter ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                  >
                    All Branches
                  </button>
                  {branches.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => {
                        setBranchFilter(branch);
                        setShowBranchDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 ${textClass} ${branchFilter?.id === branch.id ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                    >
                      {branch.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={`flex ${surfaceClass} border ${borderClass} rounded-xl overflow-hidden`}>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 ${viewMode === 'grid' ? (darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white') : mutedClass}`}
              title="Grid View"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 ${viewMode === 'list' ? (darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white') : mutedClass}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => exportInventory(filteredProducts, currencySymbol)}
            disabled={filteredProducts.length === 0}
            className="px-4 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-2xl font-black text-[10px] uppercase hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
            title="Export to Excel"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {isRestaurantType ? 'Add Menu Item' : 'Add Item'}
          </button>
        </div>
      </div>

      {/* Stats Bar - Clickable Filters */}
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
        <div
          onClick={() => setActiveStatsFilter(activeStatsFilter === null ? null : null)}
          className={`${surfaceClass} border-2 ${activeStatsFilter === null ? 'border-slate-500' : borderClass} rounded-2xl sm:rounded-[28px] p-3 sm:p-5 cursor-pointer hover:border-slate-400 transition-all`}
        >
          <p className={`text-[8px] sm:text-[10px] font-black uppercase ${mutedClass} mb-0.5 sm:mb-1`}>Total</p>
          <p className={`text-lg sm:text-2xl font-black ${textClass}`}>{stats.total}</p>
        </div>
        <div
          onClick={() => setActiveStatsFilter(activeStatsFilter === 'services' ? null : 'services')}
          className={`${surfaceClass} border-2 ${activeStatsFilter === 'services' ? 'border-slate-500' : borderClass} rounded-2xl sm:rounded-[28px] p-3 sm:p-5 cursor-pointer hover:border-slate-400 transition-all`}
        >
          <p className={`text-[8px] sm:text-[10px] font-black uppercase ${mutedClass} mb-0.5 sm:mb-1`}>
            {isRestaurantType ? 'Menu Items' : 'Services'}
          </p>
          <p className="text-lg sm:text-2xl font-black text-slate-600 dark:text-slate-400">{stats.services}</p>
        </div>
        <div
          onClick={() => setActiveStatsFilter(activeStatsFilter === 'lowStock' ? null : 'lowStock')}
          className={`${surfaceClass} border-2 ${activeStatsFilter === 'lowStock' ? 'border-warning-500' : borderClass} rounded-2xl sm:rounded-[28px] p-3 sm:p-5 cursor-pointer hover:border-warning-400 transition-all`}
        >
          <p className={`text-[8px] sm:text-[10px] font-black uppercase ${mutedClass} mb-0.5 sm:mb-1`}>Low Stock</p>
          <p className="text-lg sm:text-2xl font-black text-warning-500">{stats.lowStock}</p>
        </div>
        <div
          onClick={() => setActiveStatsFilter(activeStatsFilter === 'outOfStock' ? null : 'outOfStock')}
          className={`${surfaceClass} border-2 ${activeStatsFilter === 'outOfStock' ? 'border-negative-500' : borderClass} rounded-2xl sm:rounded-[28px] p-3 sm:p-5 cursor-pointer hover:border-negative-400 transition-all`}
        >
          <p className={`text-[8px] sm:text-[10px] font-black uppercase ${mutedClass} mb-0.5 sm:mb-1`}>Out of Stock</p>
          <p className="text-lg sm:text-2xl font-black text-negative-500">{stats.outOfStock}</p>
        </div>
        <div
          onClick={() => setActiveStatsFilter(activeStatsFilter === 'expiringSoon' ? null : 'expiringSoon')}
          className={`${surfaceClass} border-2 ${activeStatsFilter === 'expiringSoon' ? 'border-yellow-500' : borderClass} rounded-2xl sm:rounded-[28px] p-3 sm:p-5 cursor-pointer hover:border-yellow-400 transition-all`}
        >
          <p className={`text-[8px] sm:text-[10px] font-black uppercase ${mutedClass} mb-0.5 sm:mb-1`}>Expiring</p>
          <p className="text-lg sm:text-2xl font-black text-yellow-500">{stats.expiringSoon}</p>
        </div>
        <div
          onClick={() => setActiveStatsFilter(activeStatsFilter === 'expired' ? null : 'expired')}
          className={`${surfaceClass} border-2 ${activeStatsFilter === 'expired' ? 'border-negative-600' : borderClass} rounded-2xl sm:rounded-[28px] p-3 sm:p-5 cursor-pointer hover:border-negative-500 transition-all`}
        >
          <p className={`text-[8px] sm:text-[10px] font-black uppercase ${mutedClass} mb-0.5 sm:mb-1`}>Expired</p>
          <p className="text-lg sm:text-2xl font-black text-negative-600">{stats.expired}</p>
        </div>
      </div>

      {/* Active Filter Indicator */}
      {activeStatsFilter && (
        <div className={`flex items-center justify-between ${surfaceClass} border ${borderClass} rounded-xl px-4 py-3`}>
          <p className={`text-xs font-bold ${mutedClass}`}>
            Showing: <span className={textClass}>
              {activeStatsFilter === 'services' && (isRestaurantType ? 'Menu Items Only' : 'Services Only')}
              {activeStatsFilter === 'lowStock' && 'Low Stock Items'}
              {activeStatsFilter === 'outOfStock' && 'Out of Stock Items'}
              {activeStatsFilter === 'expiringSoon' && 'Expiring Soon Items'}
              {activeStatsFilter === 'expired' && 'Expired Items'}
            </span>
          </p>
          <button
            onClick={() => setActiveStatsFilter(null)}
            className={`text-xs font-bold ${mutedClass} hover:text-negative-500 flex items-center gap-1`}
          >
            <X className="w-3 h-3" /> Clear Filter
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto">
          {customCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-5 py-2.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap transition-all ${
                filterCategory === cat
                  ? 'bg-slate-800 dark:bg-slate-700 text-white'
                  : `${surfaceClass} border ${borderClass} ${mutedClass} hover:border-slate-400`
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedClass}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className={`w-full ${surfaceClass} border ${borderClass} rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass}`}
            />
          </div>
          <button
            onClick={() => setFilterStock(!filterStock)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              filterStock
                ? 'bg-negative-500 text-white'
                : `${surfaceClass} border ${borderClass} ${mutedClass}`
            }`}
            title="Filter low stock items"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Products - Grid or List View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
          {filteredProducts.length === 0 ? (
            <div className={`${surfaceClass} border ${borderClass} rounded-[28px] p-8 text-center col-span-full`}>
              <Package className={`w-12 h-12 mx-auto mb-3 ${mutedClass} opacity-30`} />
              <p className={`text-sm font-bold ${textClass}`}>No items found</p>
              <p className={`text-xs ${mutedClass}`}>Try adjusting your search or filter</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const status = getStockStatus(product);
              const expiryStatus = getExpiryStatus(product);
              const isLowOrOut = status === 'low' || status === 'out';

              return (
                <div
                  key={product.id}
                  className={`${surfaceClass} border ${borderClass} rounded-2xl sm:rounded-[28px] p-3 sm:p-5 shadow-sm hover:border-slate-400 transition-all group relative`}
                >
                  <button
                    onClick={() => openEditModal(product)}
                    className={`absolute top-4 right-4 p-2 ${mutedClass} hover:text-slate-600 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity`}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {expiryStatus && expiryStatus !== 'ok' && (
                    <div className={`absolute top-4 left-4 px-2 py-1 rounded-lg text-[8px] font-black uppercase ${
                      expiryStatus === 'expired' ? 'bg-negative-500 text-white' :
                      expiryStatus === 'critical' ? 'bg-warning-500 text-white' :
                      'bg-yellow-500 text-black'
                    }`}>
                      {expiryStatus === 'expired' ? 'Expired' : 'Expiring'}
                    </div>
                  )}

                  <div className={`aspect-square ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} rounded-xl sm:rounded-[20px] mb-2 sm:mb-4 overflow-hidden flex items-center justify-center`}>
                    {product.image ? (
                      <img
                        src={`${IMAGE_BASE_URL}${product.image}`}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'block';
                        }}
                      />
                    ) : null}
                    <div className={`text-4xl sm:text-6xl grayscale group-hover:grayscale-0 transition-all ${
                      product.type === 'SERVICE' ? 'opacity-50' : ''
                    } ${product.image ? 'hidden' : ''}`}>
                      {product.type === 'SERVICE' ? '✂️' : '📦'}
                    </div>
                  </div>

                  <h3 className={`font-black text-[10px] uppercase truncate mb-1 ${textClass}`} title={product.name}>
                    {product.name}
                  </h3>
                  {product.customCategory && (
                    <p className={`text-[9px] ${mutedClass} mb-1`}>
                      <Tag className="w-2.5 h-2.5 inline mr-1" />
                      {product.customCategory}
                    </p>
                  )}
                  {isAllBranches && product.branch && (
                    <p className={`text-[9px] ${mutedClass} mb-1`}>
                      <Building2 className="w-2.5 h-2.5 inline mr-1" />
                      {product.branch.name}
                    </p>
                  )}
                  <p className="font-black text-slate-600 dark:text-slate-400 text-xs sm:text-sm">{formatCurrency(product.sellingPrice)}</p>
                  {product.costPrice > 0 && (
                    <p className={`text-[9px] ${mutedClass} mb-2`}>
                      Cost: {formatCurrency(product.costPrice)} ·
                      <span className="text-positive-500 ml-1">+{formatCurrency(getProfit(product))} ({getProfitMargin(product)}%)</span>
                    </p>
                  )}

                  {product.expiryDate && (
                    <p className={`text-[9px] ${expiryStatus === 'expired' || expiryStatus === 'critical' ? 'text-negative-500' : mutedClass} mb-2 flex items-center gap-1`}>
                      <Calendar className="w-3 h-3" />
                      Exp: {new Date(product.expiryDate).toLocaleDateString()}
                    </p>
                  )}

                  {product.type === 'PRODUCT' ? (
                    <div className={`flex items-center gap-1.5 sm:gap-2 border-t pt-2 sm:pt-4 ${borderClass}`}>
                      <input
                        type="number"
                        value={stockUpdates[product.id] || 0}
                        onChange={(e) => setStockUpdates(prev => ({ ...prev, [product.id]: e.target.value }))}
                        className={`flex-1 ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-lg sm:rounded-xl p-1.5 sm:p-2 text-center text-[10px] sm:text-xs font-black focus:outline-none focus:border-slate-400 ${textClass} ${
                          isLowOrOut ? 'border-negative-300 bg-negative-50' : ''
                        }`}
                      />
                      <button
                        onClick={() => updateStock(product.id)}
                        className="bg-slate-800 dark:bg-slate-700 text-white p-1.5 sm:p-2 rounded-lg sm:rounded-xl hover:opacity-80 transition-opacity"
                      >
                        <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className={`border-t pt-2 sm:pt-4 ${borderClass}`}>
                      <p className={`text-[8px] sm:text-[9px] ${mutedClass} uppercase text-center`}>Service - No Stock</p>
                    </div>
                  )}

                  {isLowOrOut && product.type === 'PRODUCT' && (
                    <div className="w-full mt-3 flex items-center justify-center gap-2 py-2 bg-warning-500 text-white rounded-xl text-[9px] font-bold uppercase">
                      <AlertTriangle className="w-3 h-3" />
                      {status === 'out' ? 'Out of Stock' : 'Low Stock'}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className={`${surfaceClass} border ${borderClass} rounded-[28px] overflow-hidden`}>
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center">
              <Package className={`w-12 h-12 mx-auto mb-3 ${mutedClass} opacity-30`} />
              <p className={`text-sm font-bold ${textClass}`}>No items found</p>
              <p className={`text-xs ${mutedClass}`}>Try adjusting your search or filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-bold">
                <thead className={`${darkMode ? 'bg-slate-800' : 'bg-slate-50'} text-[10px] font-black uppercase ${mutedClass} tracking-widest`}>
                  <tr className={`border-b ${borderClass}`}>
                    <th className="p-4">Item</th>
                    <th className="p-4">Category</th>
                    {isAllBranches && <th className="p-4">Branch</th>}
                    <th className="p-4">Cost</th>
                    <th className="p-4">Price</th>
                    <th className="p-4">Profit</th>
                    <th className="p-4">Stock</th>
                    <th className="p-4">Expiry</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const status = getStockStatus(product);
                    const expiryStatus = getExpiryStatus(product);
                    const isLowOrOut = status === 'low' || status === 'out';

                    return (
                      <tr key={product.id} className={`border-b ${borderClass} last:border-b-0 hover:bg-amber-50 ${darkMode ? 'hover:bg-slate-700/50' : ''}`}>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} flex items-center justify-center text-xl overflow-hidden`}>
                              {product.image ? (
                                <img
                                  src={`${IMAGE_BASE_URL}${product.image}`}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              ) : (
                                product.type === 'SERVICE' ? '✂️' : '📦'
                              )}
                            </div>
                            <div>
                              <p className={textClass}>{product.name}</p>
                              {product.sku && <p className={`text-[10px] ${mutedClass}`}>SKU: {product.sku}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase ${
                            product.type === 'SERVICE'
                              ? 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200'
                              : 'bg-emerald-100 text-emerald-600'
                          }`}>
                            {product.customCategory || (product.type === 'SERVICE' ? 'Service' : 'Product')}
                          </span>
                        </td>
                        {isAllBranches && (
                          <td className="p-4">
                            <span className={`text-[10px] ${mutedClass}`}>
                              {product.branch?.name || 'Unassigned'}
                            </span>
                          </td>
                        )}
                        <td className={`p-4 ${mutedClass}`}>{formatCurrency(product.costPrice || 0)}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-400">{formatCurrency(product.sellingPrice)}</td>
                        <td className="p-4">
                          <span className="text-positive-500">{formatCurrency(getProfit(product))}</span>
                          <span className={`text-[9px] ${mutedClass} ml-1`}>({getProfitMargin(product)}%)</span>
                        </td>
                        <td className="p-4">
                          {product.type === 'PRODUCT' ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={stockUpdates[product.id] || 0}
                                onChange={(e) => setStockUpdates(prev => ({ ...prev, [product.id]: e.target.value }))}
                                className={`w-16 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} border ${borderClass} rounded-lg p-1.5 text-center text-xs focus:outline-none ${
                                  isLowOrOut ? 'border-negative-300 text-negative-500' : textClass
                                }`}
                              />
                              <button
                                onClick={() => updateStock(product.id)}
                                className="p-1.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span className={mutedClass}>N/A</span>
                          )}
                        </td>
                        <td className="p-4">
                          {product.expiryDate ? (
                            <span className={`text-[10px] ${
                              expiryStatus === 'expired' ? 'text-negative-500' :
                              expiryStatus === 'critical' ? 'text-warning-500' :
                              expiryStatus === 'warning' ? 'text-yellow-600' :
                              mutedClass
                            }`}>
                              {new Date(product.expiryDate).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className={mutedClass}>-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => openEditModal(product)}
                            className={`p-1.5 ${mutedClass} hover:text-slate-600 dark:text-slate-400`}
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div
            className={`${surfaceClass} w-full max-w-[95vw] sm:max-w-lg md:max-w-xl rounded-[32px] p-6 sm:p-8 shadow-2xl border ${borderClass} relative max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowAddModal(false)}
              className={`absolute top-6 right-6 ${mutedClass} hover:text-negative-500`}
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className={`text-xl font-black uppercase mb-6 ${textClass} text-center`}>
              {isRestaurantType ? 'Add Menu Item' : 'Add New Item'}
            </h2>

            <div className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                      showToast('Image must be less than 5MB');
                      return;
                    }
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                  }
                }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border-2 border-dashed ${borderClass} rounded-2xl p-8 text-center cursor-pointer hover:border-slate-400 transition-colors relative overflow-hidden`}
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="w-full h-32 object-contain mx-auto" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageFile(null);
                        setImagePreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="absolute top-2 right-2 p-1 bg-negative-500 text-white rounded-full hover:bg-negative-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <Image className={`w-8 h-8 mx-auto mb-2 ${mutedClass}`} />
                    <p className={`text-xs font-bold ${mutedClass}`}>Click to upload image</p>
                    <p className={`text-[10px] ${mutedClass}`}>PNG, JPG up to 5MB</p>
                  </>
                )}
              </div>

              <input
                type="text"
                placeholder="Product Name"
                value={newProduct.name}
                onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass}`}
              />

              {/* Branch selector - only show in "All Branches" mode */}
              {isAllBranches && (
                <select
                  value={newProduct.branchId}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, branchId: e.target.value }))}
                  className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass}`}
                >
                  <option value="">Select a branch *</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              )}

              <div className="grid grid-cols-2 gap-4">
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, category: e.target.value }))}
                  className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none ${textClass}`}
                >
                  <option value="SERVICE">Service</option>
                  <option value="PRODUCT">Product</option>
                </select>
                <input
                  type="text"
                  placeholder="Custom Category (optional)"
                  value={newProduct.customCategory}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, customCategory: e.target.value }))}
                  className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass}`}
                />
              </div>

              {newProduct.category === 'PRODUCT' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-[10px] font-bold ${mutedClass} block mb-2`}>Cost Price ({currencySymbol})</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={newProduct.costPrice}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, costPrice: e.target.value }))}
                      className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[10px] font-bold ${mutedClass} block mb-2`}>Selling Price ({currencySymbol})</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, price: e.target.value }))}
                      className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass}`}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className={`text-[10px] font-bold ${mutedClass} block mb-2`}>Service Price ({currencySymbol})</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, price: e.target.value }))}
                    className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass}`}
                  />
                </div>
              )}

              {newProduct.category === 'PRODUCT' && newProduct.price && newProduct.costPrice && (
                <div className={`p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-positive-50'} flex justify-between items-center`}>
                  <span className={`text-[10px] font-bold ${mutedClass}`}>Profit per unit:</span>
                  <span className="text-positive-500 font-black text-sm">
                    {formatCurrency(parseFloat(newProduct.price || 0) - parseFloat(newProduct.costPrice || 0))}
                  </span>
                </div>
              )}

              {newProduct.category === 'PRODUCT' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`text-[10px] font-bold ${mutedClass} block mb-2`}>Starting Quantity</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={newProduct.stock}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, stock: e.target.value }))}
                        className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass}`}
                      />
                    </div>
                    <div>
                      <label className={`text-[10px] font-bold ${mutedClass} block mb-2`}>Low Stock Alert Level</label>
                      <input
                        type="number"
                        placeholder="10"
                        value={newProduct.lowStockThreshold}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, lowStockThreshold: e.target.value }))}
                        className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass}`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`text-[10px] font-bold ${mutedClass} block mb-2`}>Expiry Date (Optional)</label>
                    <input
                      type="date"
                      value={newProduct.expiryDate}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, expiryDate: e.target.value }))}
                      className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass} cursor-pointer`}
                      onClick={(e) => e.target.showPicker?.()}
                    />
                  </div>
                </>
              )}

              <button
                onClick={async () => {
                  if (!newProduct.name || !newProduct.price) {
                    showToast('Name and price required');
                    return;
                  }
                  // Require branch selection when in "All Branches" mode
                  if (isAllBranches && !newProduct.branchId) {
                    showToast('Please select a branch');
                    return;
                  }
                  try {
                    // Use FormData if there's an image, otherwise use JSON
                    let productData;
                    if (imageFile) {
                      productData = new FormData();
                      productData.append('image', imageFile);
                      productData.append('name', newProduct.name);
                      productData.append('category', newProduct.category);
                      if (newProduct.customCategory) productData.append('customCategory', newProduct.customCategory);
                      productData.append('costPrice', newProduct.category === 'SERVICE' ? '0' : (newProduct.costPrice || '0'));
                      productData.append('sellingPrice', newProduct.price);
                      productData.append('stockQuantity', newProduct.stock || '0');
                      productData.append('lowStockThreshold', newProduct.lowStockThreshold || '10');
                      if (newProduct.expiryDate) productData.append('expiryDate', newProduct.expiryDate);
                      // Use selected branch in "All Branches" mode, otherwise use current branch
                      if (isAllBranches && newProduct.branchId) {
                        productData.append('branchId', newProduct.branchId);
                      } else if (currentBranch) {
                        productData.append('branchId', currentBranch.id);
                      }
                    } else {
                      productData = {
                        name: newProduct.name,
                        category: newProduct.category,
                        customCategory: newProduct.customCategory || null,
                        costPrice: newProduct.category === 'SERVICE' ? 0 : (parseFloat(newProduct.costPrice) || 0),
                        sellingPrice: parseFloat(newProduct.price),
                        stockQuantity: parseInt(newProduct.stock) || 0,
                        lowStockThreshold: parseInt(newProduct.lowStockThreshold) || 10,
                        expiryDate: newProduct.expiryDate || null,
                        isActive: true
                      };
                      // Use selected branch in "All Branches" mode, otherwise use current branch
                      if (isAllBranches) {
                        productData.branchId = newProduct.branchId;
                      } else if (currentBranch) {
                        productData.branchId = currentBranch.id;
                      }
                    }
                    await productsAPI.create(productData);
                    setShowAddModal(false);
                    setNewProduct({ name: '', category: 'PRODUCT', customCategory: '', costPrice: '', price: '', stock: '', expiryDate: '', lowStockThreshold: '10', branchId: '' });
                    setImageFile(null);
                    setImagePreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    showToast('Item Added');
                    loadProducts();
                  } catch (error) {
                    showToast('Failed to add item');
                  }
                }}
                className="w-full py-4 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-black text-[10px] uppercase shadow-lg mt-2"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowEditModal(false)}>
          <div
            className={`${surfaceClass} w-full max-w-[95vw] sm:max-w-lg md:max-w-xl rounded-[32px] p-6 sm:p-8 shadow-2xl border ${borderClass} relative max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowEditModal(false)}
              className={`absolute top-6 right-6 ${mutedClass} hover:text-negative-500`}
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className={`text-xl font-black uppercase mb-6 ${textClass} text-center`}>
              {isRestaurantType ? 'Edit Menu Item' : 'Edit Item'}
            </h2>

            <div className="space-y-4">
              {/* Image Upload for Edit */}
              <input
                type="file"
                ref={editFileInputRef}
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                      showToast('Image must be less than 5MB');
                      return;
                    }
                    setEditImageFile(file);
                    setEditImagePreview(URL.createObjectURL(file));
                  }
                }}
              />
              <div
                onClick={() => editFileInputRef.current?.click()}
                className={`${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border-2 border-dashed ${borderClass} rounded-2xl p-4 text-center cursor-pointer hover:border-slate-400 transition-colors relative overflow-hidden`}
              >
                {editImagePreview || editingProduct.image ? (
                  <>
                    <img
                      src={editImagePreview || `${IMAGE_BASE_URL}${editingProduct.image}`}
                      alt="Product"
                      className="w-full h-32 object-contain mx-auto"
                    />
                    <p className={`text-[10px] ${mutedClass} mt-2`}>Click to change image</p>
                    {(editImagePreview || editImageFile) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditImageFile(null);
                          setEditImagePreview(null);
                          if (editFileInputRef.current) editFileInputRef.current.value = '';
                        }}
                        className="absolute top-2 right-2 p-1 bg-negative-500 text-white rounded-full hover:bg-negative-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <Image className={`w-8 h-8 mx-auto mb-2 ${mutedClass}`} />
                    <p className={`text-xs font-bold ${mutedClass}`}>Click to upload image</p>
                    <p className={`text-[10px] ${mutedClass}`}>PNG, JPG up to 5MB</p>
                  </>
                )}
              </div>

              <input
                type="text"
                placeholder="Product Name"
                value={editingProduct.name}
                onChange={(e) => setEditingProduct(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass}`}
              />

              <input
                type="text"
                placeholder="Custom Category (optional)"
                value={editingProduct.customCategory || ''}
                onChange={(e) => setEditingProduct(prev => ({ ...prev, customCategory: e.target.value }))}
                className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass}`}
              />

              {editingProduct.type === 'PRODUCT' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-[10px] font-bold ${mutedClass} block mb-2`}>Cost Price ({currencySymbol})</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={editingProduct.costPrice || ''}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev, costPrice: e.target.value }))}
                      className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[10px] font-bold ${mutedClass} block mb-2`}>Selling Price ({currencySymbol})</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={editingProduct.price}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev, price: e.target.value }))}
                      className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass}`}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className={`text-[10px] font-bold ${mutedClass} block mb-2`}>Service Price ({currencySymbol})</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct(prev => ({ ...prev, price: e.target.value }))}
                    className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass}`}
                  />
                </div>
              )}

              {editingProduct.type === 'PRODUCT' && editingProduct.price && (
                <div className={`p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-positive-50'} flex justify-between items-center`}>
                  <span className={`text-[10px] font-bold ${mutedClass}`}>Profit per unit:</span>
                  <span className="text-positive-500 font-black text-sm">
                    {formatCurrency(parseFloat(editingProduct.price || 0) - parseFloat(editingProduct.costPrice || 0))}
                  </span>
                </div>
              )}

              {editingProduct.type === 'PRODUCT' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`text-[10px] font-bold ${mutedClass} block mb-2`}>Stock Quantity</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={editingProduct.stock}
                        onChange={(e) => setEditingProduct(prev => ({ ...prev, stock: e.target.value }))}
                        className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass}`}
                      />
                    </div>
                    <div>
                      <label className={`text-[10px] font-bold ${mutedClass} block mb-2`}>Low Stock Alert Level</label>
                      <input
                        type="number"
                        placeholder="10"
                        value={editingProduct.lowStockThreshold || 10}
                        onChange={(e) => setEditingProduct(prev => ({ ...prev, lowStockThreshold: e.target.value }))}
                        className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass}`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`text-[10px] font-bold ${mutedClass} block mb-2`}>Expiry Date</label>
                    <input
                      type="date"
                      value={editingProduct.expiryDate || ''}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev, expiryDate: e.target.value }))}
                      className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${borderClass} rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-slate-400 ${textClass} cursor-pointer`}
                      onClick={(e) => e.target.showPicker?.()}
                    />
                  </div>
                </>
              )}

              {/* Manage Modifiers Button - Only for restaurants */}
              {isRestaurantType && (
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    openModifierManager(editingProduct);
                  }}
                  className={`w-full py-4 border ${borderClass} rounded-xl font-black text-[10px] uppercase ${textClass} hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2`}
                >
                  <Settings2 className="w-4 h-4" />
                  Manage Modifiers (Add-ons)
                </button>
              )}

              <button
                onClick={saveProductEdit}
                className="w-full py-4 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-black text-[10px] uppercase shadow-lg mt-2"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modifier Manager Modal */}
      {showModifierManager && modifierProduct && (
        <ModifierManager
          product={modifierProduct}
          onClose={() => {
            setShowModifierManager(false);
            setModifierProduct(null);
          }}
          darkMode={darkMode}
          currencySymbol={currencySymbol}
        />
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
          <div className={`${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'} px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${darkMode ? 'border-slate-200' : 'border-white/10'}`}>
            <CheckCircle className="w-5 h-5 text-positive-500" />
            <span className="font-bold text-xs uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerInventory;
