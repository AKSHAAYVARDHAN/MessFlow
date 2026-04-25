import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCanteens } from '../services/canteenService';
import CanteenCard from '../components/CanteenCard';

export default function CanteenList() {
  const [canteens, setCanteens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCanteens()
      .then(setCanteens)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="ct-page">
      <div className="ct-page-header">
        <h1 className="ct-page-title">🏠 Dashboard</h1>
        <p className="ct-page-subtitle">Select a canteen to browse and pre-order</p>
      </div>

      {loading && (
        <div className="ct-canteen-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="ct-canteen-skeleton">
              <div className="skeleton" style={{ height: 180 }} />
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="skeleton" style={{ height: 18, width: '60%', borderRadius: 6 }} />
                <div className="skeleton" style={{ height: 14, width: '80%', borderRadius: 6 }} />
                <div className="skeleton" style={{ height: 36, borderRadius: 8 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="ct-error-card">
          <p>⚠️</p><p>{error}</p>
          <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {!loading && !error && canteens.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🍽️</div>
          <p className="empty-state-text">No canteens available</p>
          <p className="empty-state-sub">Check back later</p>
        </div>
      )}

      {!loading && !error && canteens.length > 0 && (
        <>
          <div className="ct-stats-bar">
            <span>{canteens.length} canteen{canteens.length !== 1 ? 's' : ''} found</span>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/canteen/orders')}>
              📋 My Orders
            </button>
          </div>
          <div className="ct-canteen-grid">
            {canteens.map(c => <CanteenCard key={c.id} canteen={c} />)}
          </div>
        </>
      )}
    </div>
  );
}
