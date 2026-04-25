import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchCanteen, fetchMenuItems, fetchAllMenuItems } from '../services/canteenService';
import { useCanteenFilter } from '../context/CanteenFilterContext';
import MenuItemCard from '../components/MenuItemCard';

const CATEGORIES = ['All', 'Starters', 'Soups', 'Main Course', 'Beverages', 'Desserts'];

const CAT_EMOJI = {
  All: '🍽️', Starters: '🥗', Soups: '🍲',
  'Main Course': '🍛', Beverages: '☕', Desserts: '🍮',
};

export default function CanteenMenu() {
  const { canteenId } = useParams();                    // may be undefined on /canteen/menu
  const navigate = useNavigate();
  const {
    search, category, setCategory,
    vegOnly, nonVegOnly, showAvailableOnly,
    selectedCanteenId,
  } = useCanteenFilter();

  const [canteen, setCanteen] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Use canteenId from URL param OR from filter context
  const effectiveCanteenId = canteenId ?? selectedCanteenId;

  useEffect(() => {
    setLoading(true);
    setError(null);
    const load = effectiveCanteenId
      ? Promise.all([fetchCanteen(effectiveCanteenId), fetchMenuItems(effectiveCanteenId)])
          .then(([c, mi]) => { setCanteen(c); setItems(mi); })
      : fetchAllMenuItems().then(mi => { setCanteen(null); setItems(mi); });

    load.catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [effectiveCanteenId]);

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (category !== 'All' && item.category !== category) return false;
      if (vegOnly && !item.is_veg) return false;
      if (nonVegOnly && item.is_veg) return false;
      if (showAvailableOnly && !item.is_available) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!item.name.toLowerCase().includes(q) &&
            !(item.description ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, category, vegOnly, nonVegOnly, showAvailableOnly, search]);

  // Group by category for "All" view
  const grouped = useMemo(() => {
    if (category !== 'All') return null;
    const map = {};
    for (const item of filtered) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return map;
  }, [filtered, category]);

  const canteenIdForCard = effectiveCanteenId ?? canteen?.id;
  const canteenName = canteen?.name ?? 'All Canteens';

  return (
    <div className="ct-page">
      {/* Header */}
      <div className="ct-page-header">
        {canteenId && (
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/canteen')} style={{ marginBottom: '0.5rem' }}>
            ← Back
          </button>
        )}
        <h1 className="ct-page-title">
          🍽️ {canteen ? canteen.name : 'All Menu'}
        </h1>
        {canteen?.location && <p className="ct-page-subtitle">📍 {canteen.location}</p>}
      </div>

      {/* Category pills */}
      <div className="ct-cat-pills" role="tablist">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            role="tab"
            aria-selected={category === cat}
            className={`ct-cat-pill ${category === cat ? 'active' : ''}`}
            onClick={() => setCategory(cat)}
            id={`cat-${cat.replace(/\s+/g, '-').toLowerCase()}`}
          >
            {CAT_EMOJI[cat]} {cat}
          </button>
        ))}
      </div>

      {/* Results count */}
      {!loading && (
        <p className="ct-results-count">
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
          {search ? ` for "${search}"` : ''}
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="ct-menu-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="ct-menu-skeleton">
              <div className="skeleton" style={{ height: 140 }} />
              <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="skeleton" style={{ height: 14, width: '70%', borderRadius: 4 }} />
                <div className="skeleton" style={{ height: 12, width: '50%', borderRadius: 4 }} />
                <div className="skeleton" style={{ height: 32, borderRadius: 8 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="ct-error-card">
          <p>⚠️ {error}</p>
          <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state" style={{ marginTop: '3rem' }}>
          <div className="empty-state-icon">{CAT_EMOJI[category]}</div>
          <p className="empty-state-text">No items found</p>
          <p className="empty-state-sub">
            {search ? `No results for "${search}"` : 'Try a different filter'}
          </p>
        </div>
      )}

      {/* Items — grouped or flat */}
      {!loading && !error && filtered.length > 0 && (
        grouped ? (
          Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat} className="ct-menu-section">
              <h2 className="ct-menu-section-title">{CAT_EMOJI[cat]} {cat}</h2>
              <div className="ct-menu-grid">
                {catItems.map(item => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    canteenId={canteenIdForCard}
                    canteenName={canteenName}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="ct-menu-grid">
            {filtered.map(item => (
              <MenuItemCard
                key={item.id}
                item={item}
                canteenId={canteenIdForCard}
                canteenName={canteenName}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
