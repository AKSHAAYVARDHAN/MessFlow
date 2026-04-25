import '../canteen.css';
import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useCart } from '../context/CartContext';
import { CanteenFilterProvider, useCanteenFilter } from '../context/CanteenFilterContext';
import { fetchCanteens } from '../services/canteenService';

const CATEGORIES = ['All', 'Starters', 'Soups', 'Main Course', 'Beverages', 'Desserts'];

// ─── Topbar (reads/writes filter context) ─────────────────────────────────────
function Topbar({ canteens }) {
  const {
    search, setSearch,
    category, setCategory,
    vegOnly, toggleVeg,
    nonVegOnly, toggleNonVeg,
    selectedCanteenId, setSelectedCanteenId,
    showAvailableOnly, setShowAvailableOnly,
  } = useCanteenFilter();

  return (
    <header className="ct-topbar">
      {/* Search */}
      <div className="ct-topbar-search">
        <span className="ct-search-icon">🔍</span>
        <input
          id="canteen-global-search"
          className="ct-search-input"
          type="text"
          placeholder="Search dishes, canteens…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="ct-search-clear" onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      {/* Filters row */}
      <div className="ct-topbar-filters">
        {/* Canteen selector */}
        <select
          className="ct-filter-select"
          value={selectedCanteenId ?? ''}
          onChange={e => setSelectedCanteenId(e.target.value || null)}
          id="canteen-selector"
        >
          <option value="">All Canteens</option>
          {canteens.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Category */}
        <select
          className="ct-filter-select"
          value={category}
          onChange={e => setCategory(e.target.value)}
          id="category-filter"
        >
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* Diet toggles */}
        <button
          className={`ct-diet-btn ${vegOnly ? 'active-veg' : ''}`}
          onClick={toggleVeg}
          id="veg-toggle"
          title="Veg only"
        >
          <span className="veg-dot" /> Veg
        </button>
        <button
          className={`ct-diet-btn ${nonVegOnly ? 'active-nonveg' : ''}`}
          onClick={toggleNonVeg}
          id="nonveg-toggle"
          title="Non-veg only"
        >
          <span className="nonveg-dot" /> Non-Veg
        </button>

        {/* Availability */}
        <button
          className={`ct-avail-btn ${showAvailableOnly ? 'active' : ''}`}
          onClick={() => setShowAvailableOnly(v => !v)}
          id="availability-toggle"
        >
          {showAvailableOnly ? '✅ Available' : '📋 All Items'}
        </button>
      </div>
    </header>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar() {
  const { profile, signOut } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const { vegOnly, toggleVeg, nonVegOnly, toggleNonVeg } = useCanteenFilter();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { to: '/canteen',         icon: '🏠', label: 'Dashboard'   },
    { to: '/canteen/menu',    icon: '🍽️', label: 'All Menu'    },
    { to: '/canteen/orders',  icon: '📋', label: 'My Orders'   },
    { to: '/canteen/cart',    icon: '🛒', label: 'Cart', badge: totalItems > 0 ? totalItems : null },
  ];

  async function handleSignOut() {
    try { await signOut(); navigate('/login'); } catch {}
  }

  return (
    <aside className={`ct-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Brand */}
      <div className="ct-sidebar-brand">
        <span className="ct-brand-icon">🍱</span>
        {!collapsed && <span className="ct-brand-text">Canteen</span>}
        <button className="ct-collapse-btn" onClick={() => setCollapsed(v => !v)} title="Toggle sidebar">
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Nav links */}
      <nav className="ct-sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/canteen'}
            className={({ isActive }) => `ct-nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <span className="ct-nav-icon">{item.icon}</span>
            {!collapsed && <span className="ct-nav-label">{item.label}</span>}
            {item.badge && (
              <span className="ct-nav-badge">{item.badge}</span>
            )}
          </NavLink>
        ))}

        {/* Diet quick filters */}
        <div className="ct-sidebar-divider" />
        {!collapsed && <span className="ct-sidebar-section-label">Diet Filter</span>}

        <button
          className={`ct-nav-item ${vegOnly ? 'active' : ''}`}
          onClick={toggleVeg}
          title={collapsed ? 'Veg Only' : undefined}
        >
          <span className="ct-nav-icon"><span className="veg-dot" /></span>
          {!collapsed && <span className="ct-nav-label">Veg Only</span>}
        </button>

        <button
          className={`ct-nav-item ${nonVegOnly ? 'active' : ''}`}
          onClick={toggleNonVeg}
          title={collapsed ? 'Non-Veg Only' : undefined}
        >
          <span className="ct-nav-icon"><span className="nonveg-dot" /></span>
          {!collapsed && <span className="ct-nav-label">Non-Veg Only</span>}
        </button>
      </nav>

      {/* Bottom: module switch + sign out */}
      <div className="ct-sidebar-footer">
        {!collapsed && <span className="ct-sidebar-section-label">Switch Module</span>}

        <button
          className="ct-nav-item"
          onClick={() => navigate('/student')}
          title={collapsed ? 'Hostel Mess' : undefined}
        >
          <span className="ct-nav-icon">🏠</span>
          {!collapsed && <span className="ct-nav-label">Hostel Mess</span>}
        </button>

        <button
          className="ct-nav-item"
          onClick={() => navigate('/select-module')}
          title={collapsed ? 'All Modules' : undefined}
        >
          <span className="ct-nav-icon">🔄</span>
          {!collapsed && <span className="ct-nav-label">All Modules</span>}
        </button>

        {!collapsed && (
          <div className="ct-sidebar-user">
            <span className="ct-user-name">{profile?.name ?? 'Student'}</span>
            <button className="ct-signout-btn" onClick={handleSignOut}>Sign out</button>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
function CanteenLayoutInner() {
  const [canteens, setCanteens] = useState([]);

  useEffect(() => {
    fetchCanteens().then(setCanteens).catch(() => {});
  }, []);

  return (
    <div className="ct-layout">
      <Sidebar />
      <div className="ct-main">
        <Topbar canteens={canteens} />
        <div className="ct-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default function CanteenLayout() {
  return (
    <CanteenFilterProvider>
      <CanteenLayoutInner />
    </CanteenFilterProvider>
  );
}
