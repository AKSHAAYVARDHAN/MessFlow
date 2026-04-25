import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

/**
 * CartDrawer — floating "View Cart" button anchored to the bottom of the screen.
 * Shown whenever there is at least one item in the cart.
 */
export default function CartDrawer() {
  const { totalItems, totalAmount } = useCart();
  const navigate = useNavigate();

  if (totalItems === 0) return null;

  return (
    <div className="cart-fab-container">
      <button
        className="cart-fab"
        onClick={() => navigate('/canteen/cart')}
        id="cart-fab-btn"
        aria-label={`View cart — ${totalItems} item${totalItems !== 1 ? 's' : ''}`}
      >
        <div className="cart-fab-left">
          <span className="cart-fab-count">{totalItems}</span>
          <span className="cart-fab-label">
            {totalItems === 1 ? 'item' : 'items'} in cart
          </span>
        </div>
        <div className="cart-fab-right">
          <span className="cart-fab-total">₹{totalAmount.toFixed(2)}</span>
          <span className="cart-fab-arrow">→</span>
        </div>
      </button>
    </div>
  );
}
