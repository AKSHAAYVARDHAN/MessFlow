import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../../contexts/AuthContext';
import { useCart } from '../context/CartContext';
import { fetchCanteen, placeOrder } from '../services/canteenService';

function generateSlots(openingTime, closingTime) {
  const slots = [];
  const toDate = t => {
    const [h, m] = (t ?? '08:00').split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0); return d;
  };
  const now = new Date();
  let cursor = toDate(openingTime);
  const close = toDate(closingTime);
  const rem = cursor.getMinutes() % 15;
  if (rem) cursor.setMinutes(cursor.getMinutes() + (15 - rem));
  const minTime = new Date(now.getTime() + 15 * 60 * 1000);
  if (cursor < minTime) cursor = new Date(minTime.getTime());
  // round up to next 15-min boundary
  const remMin = cursor.getMinutes() % 15;
  if (remMin) cursor.setMinutes(cursor.getMinutes() + (15 - remMin), 0, 0);
  while (cursor <= close) { slots.push(new Date(cursor)); cursor = new Date(cursor.getTime() + 15 * 60 * 1000); }
  return slots;
}

function fmt12(date) {
  const h = date.getHours(), m = date.getMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, itemList, totalAmount, clearCart } = useCart();

  const [canteen, setCanteen] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!cart.canteenId) { navigate('/canteen'); return; }
    fetchCanteen(cart.canteenId).then(c => {
      setCanteen(c);
      const s = generateSlots(c.opening_time, c.closing_time);
      setSlots(s);
      if (s.length > 0) setSelectedSlot(s[0]);
    }).catch(() => navigate('/canteen'));
  }, [cart.canteenId, navigate]);

  if (itemList.length === 0 && !placedOrder) { navigate('/canteen/cart'); return null; }

  async function handlePlace() {
    if (!selectedSlot || !user) return;
    setPlacing(true); setError(null);
    try {
      const order = await placeOrder({
        userId: user.id, canteenId: cart.canteenId,
        items: itemList, pickupTime: selectedSlot.toISOString(),
        totalAmount, notes: notes.trim() || null,
      });
      clearCart();
      setPlacedOrder(order);
    } catch (err) { setError(err.message); } finally { setPlacing(false); }
  }

  /* ── Success ── */
  if (placedOrder) {
    const qrData = JSON.stringify({ orderId: placedOrder.id, token: placedOrder.token_id });
    return (
      <div className="ct-page">
        <div className="ct-success-card">
          <div className="ct-success-checkmark">✅</div>
          <h2 className="ct-success-title">Order Placed!</h2>
          <p className="ct-success-sub">Show this at {canteen?.name} when collecting your order</p>

          {/* Token */}
          <div className="ct-token-box">
            <p className="ct-token-label">Your Token</p>
            <p className="ct-token-value">{placedOrder.token_id}</p>
          </div>

          {/* QR */}
          <div className="ct-qr-wrapper">
            <QRCodeSVG value={qrData} size={200} bgColor="#fff" fgColor="#0F172A" level="H" includeMargin />
          </div>

          {/* Meta */}
          <div className="ct-success-meta">
            <div className="ct-success-meta-row">
              <span>Pickup</span>
              <span>{fmt12(new Date(placedOrder.pickup_time))}</span>
            </div>
            <div className="ct-success-meta-row">
              <span>Total</span>
              <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>₹{Number(placedOrder.total_amount).toFixed(2)}</span>
            </div>
          </div>

          <div className="ct-success-actions">
            <button className="btn btn-outline" onClick={() => navigate('/canteen/orders')} id="view-orders-after-checkout">My Orders</button>
            <button className="btn btn-primary" onClick={() => navigate('/canteen')} id="order-more-btn">Order More</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Form ── */
  return (
    <div className="ct-page">
      <div className="ct-page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/canteen/cart')} style={{ marginBottom: '0.5rem' }}>← Cart</button>
        <h1 className="ct-page-title">Checkout</h1>
        <p className="ct-page-subtitle">from {canteen?.name}</p>
      </div>

      <div className="ct-checkout-layout">
        {/* Left: slots + notes */}
        <div className="ct-checkout-left">
          <div className="ct-card">
            <h2 className="ct-card-title">📅 Select Pickup Time</h2>
            {slots.length === 0 ? (
              <p className="ct-warning-text">⚠️ No slots available — canteen may be closing soon.</p>
            ) : (
              <div className="ct-slots-grid">
                {slots.map((s, i) => (
                  <button
                    key={i}
                    className={`ct-slot-btn ${selectedSlot?.getTime() === s.getTime() ? 'active' : ''}`}
                    onClick={() => setSelectedSlot(s)}
                    id={`slot-${i}`}
                  >{fmt12(s)}</button>
                ))}
              </div>
            )}
          </div>

          <div className="ct-card" style={{ marginTop: '1rem' }}>
            <h2 className="ct-card-title">📝 Notes (optional)</h2>
            <textarea
              id="checkout-notes"
              className="input"
              rows={3}
              placeholder="e.g. Less spicy, extra sauce…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ resize: 'vertical', marginTop: '0.5rem' }}
            />
          </div>
        </div>

        {/* Right: summary */}
        <div className="ct-checkout-right">
          <div className="ct-card">
            <h2 className="ct-card-title">🧾 Order Summary</h2>
            <div className="ct-summary-items">
              {itemList.map(({ item, quantity }) => (
                <div key={item.id} className="ct-summary-item">
                  <span>
                    <span className={item.is_veg ? 'veg-dot' : 'nonveg-dot'} style={{ display: 'inline-block', marginRight: 6 }} />
                    {item.name} × {quantity}
                  </span>
                  <span>₹{(item.price * quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="ct-cart-divider" style={{ margin: '0.75rem 0' }} />
            <div className="ct-cart-total-row">
              <span>Total</span>
              <span className="ct-cart-total-amount">₹{totalAmount.toFixed(2)}</span>
            </div>

            {error && <p className="ct-error-text" style={{ marginTop: '0.75rem' }}>⚠️ {error}</p>}

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '1.25rem' }}
              disabled={!selectedSlot || placing || slots.length === 0}
              onClick={handlePlace}
              id="place-order-btn"
            >
              {placing ? '⏳ Placing…' : `Place Order — ₹${totalAmount.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
