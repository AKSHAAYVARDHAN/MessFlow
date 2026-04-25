import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export default function Cart() {
  const { itemList, totalItems, totalAmount, addItem, removeItem, clearCart, cart } = useCart();
  const navigate = useNavigate();

  if (totalItems === 0) {
    return (
      <div className="ct-page">
        <div className="ct-page-header">
          <h1 className="ct-page-title">🛒 Cart</h1>
        </div>
        <div className="empty-state" style={{ marginTop: '4rem' }}>
          <div className="empty-state-icon">🛒</div>
          <p className="empty-state-text">Your cart is empty</p>
          <p className="empty-state-sub">Add items from the menu to get started</p>
          <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => navigate('/canteen/menu')}>
            Browse Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ct-page">
      <div className="ct-page-header">
        <h1 className="ct-page-title">🛒 Cart</h1>
        {cart.canteenName && <p className="ct-page-subtitle">from {cart.canteenName}</p>}
      </div>

      <div className="ct-cart-layout">
        {/* Items */}
        <div className="ct-cart-items">
          <div className="ct-cart-header">
            <span>{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--color-danger)' }}
              onClick={clearCart}
              id="clear-cart-btn"
            >
              🗑 Clear all
            </button>
          </div>

          {itemList.map(({ item, quantity }) => (
            <div key={item.id} className="ct-cart-row">
              <div className="ct-cart-row-left">
                <span className={item.is_veg ? 'veg-dot' : 'nonveg-dot'} style={{ flexShrink: 0 }} />
                <div>
                  <p className="ct-cart-item-name">{item.name}</p>
                  <p className="ct-cart-item-unit">₹{Number(item.price).toFixed(2)} each</p>
                </div>
              </div>
              <div className="ct-cart-row-right">
                <div className="qty-controls">
                  <button className="qty-btn" onClick={() => removeItem(item.id)}>−</button>
                  <span className="qty-value">{quantity}</span>
                  <button className="qty-btn qty-btn-add" onClick={() => addItem(item, cart.canteenId, cart.canteenName)}>+</button>
                </div>
                <span className="ct-cart-item-total">₹{(item.price * quantity).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="ct-cart-summary">
          <h2 className="ct-cart-summary-title">Order Summary</h2>
          <div className="ct-cart-summary-rows">
            <div className="ct-cart-summary-row">
              <span>Subtotal ({totalItems} items)</span>
              <span>₹{totalAmount.toFixed(2)}</span>
            </div>
            <div className="ct-cart-summary-row muted">
              <span>Packaging</span><span>₹0.00</span>
            </div>
            <div className="ct-cart-summary-row muted">
              <span>Taxes</span><span>₹0.00</span>
            </div>
          </div>
          <div className="ct-cart-divider" />
          <div className="ct-cart-total-row">
            <span>Total</span>
            <span className="ct-cart-total-amount">₹{totalAmount.toFixed(2)}</span>
          </div>
          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '1.25rem' }}
            onClick={() => navigate('/canteen/checkout')}
            id="proceed-checkout-btn"
          >
            Proceed to Checkout →
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', marginTop: '0.5rem' }}
            onClick={() => navigate(-1)}
          >
            ← Continue ordering
          </button>
        </div>
      </div>
    </div>
  );
}
