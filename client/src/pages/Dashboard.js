import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { productsAPI, salesAPI, reportsAPI, expensesAPI } from '../api';
import Checkout from '../components/Checkout';
import ExpenseModal from '../components/ExpenseModal';
import './Dashboard.css';

const Dashboard = () => {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  useEffect(() => {
    loadProducts();
    if (isAdmin()) {
      loadDashboard();
    }
  }, [isAdmin]);

  const loadProducts = async () => {
    try {
      const response = await productsAPI.getAll({ search: searchTerm, category: selectedCategory });
      setProducts(response.data.products);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await reportsAPI.getDashboard({
        startDate: today,
        endDate: today
      });
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    loadProducts();
  };

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.productId === product.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        product: product,
        quantity: 1,
        unitPrice: product.sellingPrice,
        discount: 0
      }]);
    }
  };

  const updateCartItem = (productId, quantity) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => item.productId !== productId));
    } else {
      setCart(cart.map(item =>
        item.productId === productId
          ? { ...item, quantity }
          : item
      ));
    }
  };

  const clearCart = () => {
    setCart([]);
  };

  const handleSaleComplete = () => {
    clearCart();
    setShowCheckout(false);
    if (isAdmin()) {
      loadDashboard();
    }
  };

  const handleExpenseAdded = () => {
    setShowExpenseModal(false);
    if (isAdmin()) {
      loadDashboard();
    }
  };

  const quickActionProducts = products.filter(p => 
    ['Standard Haircut', 'Laptop Charger', 'Premium Haircut', 'USB Cable'].includes(p.name)
  );

  if (showCheckout) {
    return (
      <Checkout
        cart={cart}
        updateCartItem={updateCartItem}
        clearCart={clearCart}
        onComplete={handleSaleComplete}
        onCancel={() => setShowCheckout(false)}
      />
    );
  }

  return (
    <div className="dashboard">
      {isAdmin() && dashboardData && (
        <div className="dashboard-summary">
          <div className="summary-card">
            <h3>Today's Sales</h3>
            <p className="amount">${dashboardData.totalSales?.toFixed(2) || '0.00'}</p>
          </div>
          <div className="summary-card">
            <h3>Today's Expenses</h3>
            <p className="amount expense">${dashboardData.totalExpenses?.toFixed(2) || '0.00'}</p>
          </div>
          <div className="summary-card">
            <h3>Net Profit</h3>
            <p className={`amount ${dashboardData.netProfit >= 0 ? 'profit' : 'loss'}`}>
              ${dashboardData.netProfit?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="summary-card">
            <h3>Transactions</h3>
            <p className="amount">{dashboardData.transactionCount || 0}</p>
          </div>
        </div>
      )}

      {showExpenseModal && (
        <ExpenseModal
          onClose={() => setShowExpenseModal(false)}
          onSave={handleExpenseAdded}
        />
      )}

      <div className="quick-actions-header">
        <button
          onClick={() => setShowExpenseModal(true)}
          className="btn-expense"
        >
          Record Expense
        </button>
      </div>

      <div className="pos-section">
        <div className="products-section">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search by name or barcode..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                loadProducts();
              }}
              className="category-filter"
            >
              <option value="">All Categories</option>
              <option value="PRODUCT">Products</option>
              <option value="SERVICE">Services</option>
            </select>
          </div>

          {quickActionProducts.length > 0 && (
            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="quick-buttons">
                {quickActionProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="quick-btn"
                  >
                    {product.name}
                    <span>${product.sellingPrice.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="products-grid">
            {loading ? (
              <div className="loading">Loading products...</div>
            ) : products.length === 0 ? (
              <div className="no-products">No products found</div>
            ) : (
              products.map(product => (
                <div
                  key={product.id}
                  className="product-card"
                  onClick={() => addToCart(product)}
                >
                  <h4>{product.name}</h4>
                  {product.description && <p className="product-desc">{product.description}</p>}
                  <div className="product-info">
                    <span className="product-price">${product.sellingPrice.toFixed(2)}</span>
                    {product.category === 'PRODUCT' && (
                      <span className="product-stock">Stock: {product.stockQuantity}</span>
                    )}
                  </div>
                  {product.category === 'PRODUCT' && product.stockQuantity <= product.lowStockThreshold && (
                    <span className="low-stock-badge">Low Stock</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="cart-section">
          <div className="cart-header">
            <h2>Cart</h2>
            {cart.length > 0 && (
              <button onClick={clearCart} className="btn-clear">Clear</button>
            )}
          </div>
          {cart.length === 0 ? (
            <div className="empty-cart">Cart is empty</div>
          ) : (
            <>
              <div className="cart-items">
                {cart.map(item => (
                  <div key={item.productId} className="cart-item">
                    <div className="cart-item-info">
                      <h4>{item.product.name}</h4>
                      <p>${item.unitPrice.toFixed(2)} each</p>
                    </div>
                    <div className="cart-item-controls">
                      <button onClick={() => updateCartItem(item.productId, item.quantity - 1)}>
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateCartItem(item.productId, item.quantity + 1)}>
                        +
                      </button>
                    </div>
                    <div className="cart-item-total">
                      ${(item.unitPrice * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="cart-footer">
                <div className="cart-total">
                  <strong>Total: ${cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0).toFixed(2)}</strong>
                </div>
                <button
                  onClick={() => setShowCheckout(true)}
                  className="btn-checkout"
                >
                  Checkout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
