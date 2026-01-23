import React, { useState } from 'react';
import { salesAPI } from '../api';
import './Checkout.css';

const Checkout = ({ cart, updateCartItem, clearCart, onComplete, onCancel }) => {
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const total = subtotal - discountAmount;

  const handleCheckout = async () => {
    if (total <= 0) {
      setError('Total must be greater than zero');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const items = cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        discount: item.discount || 0
      }));

      await salesAPI.create({
        items,
        paymentMethod,
        discountAmount: parseFloat(discountAmount) || 0
      });

      onComplete();
    } catch (err) {
      setError(err.response?.data?.error || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkout-overlay">
      <div className="checkout-modal">
        <div className="checkout-header">
          <h2>Checkout</h2>
          <button onClick={onCancel} className="btn-close">×</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="checkout-items">
          <h3>Order Summary</h3>
          {cart.map(item => (
            <div key={item.productId} className="checkout-item">
              <div>
                <strong>{item.product.name}</strong>
                <span> × {item.quantity}</span>
              </div>
              <div>${(item.unitPrice * item.quantity).toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div className="checkout-summary">
          <div className="summary-row">
            <span>Subtotal:</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <label>
              Discount:
              <input
                type="number"
                min="0"
                max={subtotal}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                className="discount-input"
              />
            </label>
          </div>
          <div className="summary-row total">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        <div className="payment-method">
          <h3>Payment Method</h3>
          <div className="payment-options">
            <label>
              <input
                type="radio"
                value="CASH"
                checked={paymentMethod === 'CASH'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              Cash
            </label>
            <label>
              <input
                type="radio"
                value="CARD"
                checked={paymentMethod === 'CARD'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              Card
            </label>
            <label>
              <input
                type="radio"
                value="MOMO"
                checked={paymentMethod === 'MOMO'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              MoMo
            </label>
            <label>
              <input
                type="radio"
                value="BANK_TRANSFER"
                checked={paymentMethod === 'BANK_TRANSFER'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              Bank Transfer
            </label>
          </div>
        </div>

        <div className="checkout-actions">
          <button onClick={onCancel} className="btn-cancel" disabled={loading}>
            Cancel
          </button>
          <button
            onClick={handleCheckout}
            className="btn-confirm"
            disabled={loading || total <= 0}
          >
            {loading ? 'Processing...' : 'Complete Sale'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
