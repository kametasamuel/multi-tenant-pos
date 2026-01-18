import React, { useState, useEffect } from 'react';
import { productsAPI } from '../api';
import './Inventory.css';

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'PRODUCT',
    barcode: '',
    costPrice: '',
    sellingPrice: '',
    stockQuantity: '',
    lowStockThreshold: 10
  });
  const [lowStockProducts, setLowStockProducts] = useState([]);

  useEffect(() => {
    loadProducts();
    loadLowStock();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await productsAPI.getAll();
      setProducts(response.data.products);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLowStock = async () => {
    try {
      const response = await productsAPI.getLowStock();
      setLowStockProducts(response.data.products);
    } catch (error) {
      console.error('Error loading low stock:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await productsAPI.update(editingProduct.id, formData);
      } else {
        await productsAPI.create(formData);
      }
      setShowForm(false);
      setEditingProduct(null);
      resetForm();
      loadProducts();
      loadLowStock();
    } catch (error) {
      alert(error.response?.data?.error || 'Error saving product');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      category: product.category,
      barcode: product.barcode || '',
      costPrice: product.costPrice.toString(),
      sellingPrice: product.sellingPrice.toString(),
      stockQuantity: product.stockQuantity.toString(),
      lowStockThreshold: product.lowStockThreshold
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'PRODUCT',
      barcode: '',
      costPrice: '',
      sellingPrice: '',
      stockQuantity: '',
      lowStockThreshold: 10
    });
  };

  const profit = (product) => {
    return product.sellingPrice - product.costPrice;
  };

  const profitMargin = (product) => {
    if (product.sellingPrice === 0) return 0;
    return ((profit(product) / product.sellingPrice) * 100).toFixed(1);
  };

  return (
    <div className="inventory-page">
      <div className="page-header">
        <h1>Inventory Management</h1>
        <button onClick={() => { setShowForm(true); resetForm(); setEditingProduct(null); }} className="btn-primary">
          Add Product
        </button>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="alert alert-warning">
          <strong>Low Stock Alert:</strong> {lowStockProducts.length} product(s) are running low on stock.
          <ul>
            {lowStockProducts.map(product => (
              <li key={product.id}>{product.name} - {product.stockQuantity} remaining</li>
            ))}
          </ul>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); resetForm(); setEditingProduct(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  >
                    <option value="PRODUCT">Product</option>
                    <option value="SERVICE">Service</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Barcode</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Cost Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Selling Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    required
                  />
                </div>
                {formData.category === 'PRODUCT' && (
                  <>
                    <div className="form-group">
                      <label>Stock Quantity</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.stockQuantity}
                        onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Low Stock Threshold</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.lowStockThreshold}
                        onChange={(e) => setFormData({ ...formData, lowStockThreshold: parseInt(e.target.value) })}
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); setEditingProduct(null); }} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading products...</div>
      ) : (
        <div className="products-table-container">
          <table className="products-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Profit</th>
                <th>Margin</th>
                {products.some(p => p.category === 'PRODUCT') && <th>Stock</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id}>
                  <td>
                    <strong>{product.name}</strong>
                    {product.description && <div className="product-desc">{product.description}</div>}
                  </td>
                  <td>{product.category}</td>
                  <td>${product.costPrice.toFixed(2)}</td>
                  <td>${product.sellingPrice.toFixed(2)}</td>
                  <td className={profit(product) >= 0 ? 'profit' : 'loss'}>
                    ${profit(product).toFixed(2)}
                  </td>
                  <td>{profitMargin(product)}%</td>
                  {products.some(p => p.category === 'PRODUCT') && (
                    <td>
                      {product.category === 'PRODUCT' ? (
                        <span className={product.stockQuantity <= product.lowStockThreshold ? 'low-stock' : ''}>
                          {product.stockQuantity}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  )}
                  <td>
                    <button onClick={() => handleEdit(product)} className="btn-edit">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Inventory;
