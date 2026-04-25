import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchUserOrders } from '../services/canteenService';
import OrderStatusBadge from '../components/OrderStatusBadge';

function fmtDateTime(str) {
  return new Date(str).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}
function fmtDate(str) {
  return new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Orders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true);
    fetchUserOrders(user.id)
      .then(setOrders)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const toggle = id => setExpandedId(p => p === id ? null : id);

  return (
    <div className="ct-page">
      <div className="ct-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="ct-page-title">📋 My Orders</h1>
          <p className="ct-page-subtitle">Track your canteen pre-orders</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} id="refresh-orders">🔄 Refresh</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 88, borderRadius: 14 }} />)}
        </div>
      )}

      {!loading && error && (
        <div className="ct-error-card"><p>⚠️ {error}</p></div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="empty-state" style={{ marginTop: '4rem' }}>
          <div className="empty-state-icon">📋</div>
          <p className="empty-state-text">No orders yet</p>
          <p className="empty-state-sub">Your canteen orders will appear here</p>
          <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => navigate('/canteen')}>
            Browse Canteens
          </button>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="ct-orders-list">
          {orders.map(order => {
            const expanded = expandedId === order.id;
            const qrData = JSON.stringify({ orderId: order.id, token: order.token_id });
            return (
              <div key={order.id} className={`ct-order-card ${expanded ? 'expanded' : ''}`}>
                {/* Header */}
                <button
                  className="ct-order-header"
                  onClick={() => toggle(order.id)}
                  aria-expanded={expanded}
                  id={`order-${order.id.slice(0,8)}`}
                >
                  <div className="ct-order-header-left">
                    <p className="ct-order-canteen">{order.canteens?.name ?? 'Canteen'}</p>
                    <p className="ct-order-date">{fmtDate(order.created_at)}</p>
                  </div>
                  <div className="ct-order-header-right">
                    <OrderStatusBadge status={order.status} size="sm" />
                    <p className="ct-order-amount">₹{Number(order.total_amount).toFixed(2)}</p>
                  </div>
                  <span className={`ct-order-chevron ${expanded ? 'up' : ''}`}>▾</span>
                </button>

                {/* Expanded detail */}
                {expanded && (
                  <div className="ct-order-detail">
                    {/* Token + pickup */}
                    <div className="ct-order-token-row">
                      <div className="ct-order-token-box">
                        <span className="ct-order-token-label">Token</span>
                        <span className="ct-order-token">{order.token_id ?? '—'}</span>
                      </div>
                      <div>
                        <span className="ct-order-token-label">Pickup</span>
                        <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{fmtDateTime(order.pickup_time)}</p>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="ct-order-items">
                      {order.order_items?.map(oi => (
                        <div key={oi.id} className="ct-order-item-row">
                          <span>
                            <span className={oi.menu_items?.is_veg ? 'veg-dot' : 'nonveg-dot'} style={{ display:'inline-block', marginRight: 6 }} />
                            {oi.menu_items?.name ?? 'Item'} × {oi.quantity}
                          </span>
                          <span>₹{(oi.price_at_order * oi.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {/* QR */}
                    <div className="ct-order-qr">
                      <p className="ct-order-qr-label">Show QR at counter</p>
                      <QRCodeSVG value={qrData} size={150} bgColor="#fff" fgColor="#0F172A" level="H" includeMargin />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
