import '../mess-layout.css';
import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { announcementService } from '../services/announcementService';
import { getToday } from '../utils/dateHelpers';

const studentLinks = [
    { to: '/student',              label: 'Dashboard',    icon: '📊', end: true  },
    { to: '/student/lunch',        label: 'Lunch Slots',  icon: '🍽️', end: false },
    { to: '/student/dinner',       label: 'Dinner Slots', icon: '🌙', end: false },
    { to: '/student/leave',        label: 'Leave',        icon: '🏖️', end: false },
    { to: '/student/history',      label: 'Meal History', icon: '📜', end: false },
    { to: '/student/profile',      label: 'Profile',      icon: '👤', end: false },
    { to: '/student/announcements',label: 'Announcements',icon: '📢', end: false },
];

const adminLinks = [
    { to: '/admin',              label: 'Overview',        icon: '📊', end: true  },
    { to: '/admin/announcements',label: 'Announcements',   icon: '📢', end: false },
    { to: '/admin/menu',         label: 'Menu Management', icon: '🍴', end: false },
    { to: '/admin/slots',        label: 'Slot Monitor',    icon: '📈', end: false },
    { to: '/admin/leaves',       label: 'Leave Monitor',   icon: '🏖️', end: false },
    { to: '/admin/no-shows',     label: 'No-Show Monitor', icon: '⚠️', end: false },
    { to: '/admin/scan-logs',    label: 'Scan Logs',       icon: '📷', end: false },
    { to: '/admin/analytics',    label: 'Analytics',       icon: '📉', end: false },
    { to: '/admin/feedback',     label: 'Meal Feedback',   icon: '⭐', end: false },
];

const staffLinks = [
    { to: '/scan', label: 'QR Scanner', icon: '📷', end: true },
];

const PAGE_TITLES = {
    '/student':               'Dashboard',
    '/student/announcements': 'Announcements',
    '/student/lunch':         'Lunch Slots',
    '/student/dinner':        'Dinner Slots',
    '/student/leave':         'Leave',
    '/student/history':       'Meal History',
    '/student/profile':       'Profile',
    '/admin':                 'Overview',
    '/admin/announcements':   'Announcements',
    '/admin/menu':            'Menu Management',
    '/admin/slots':           'Slot Monitor',
    '/admin/leaves':          'Leave Monitor',
    '/admin/no-shows':        'No-Show Monitor',
    '/admin/scan-logs':       'Scan Logs',
    '/admin/analytics':       'Analytics Overview',
    '/admin/feedback':        'Meal Feedback',
    '/scan':                  'QR Scanner',
    '/guest':                 'Guest Booking',
};

export default function Layout() {
    const { profile, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed]   = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [annBadge, setAnnBadge]     = useState(0);

    const links = profile?.role === 'admin' ? adminLinks
        : profile?.role === 'staff' ? staffLinks
        : studentLinks;

    const roleBadgeClass = profile?.role === 'admin' ? 'badge-admin'
        : profile?.role === 'staff' ? 'badge-admin'
        : 'badge-student';

    const pageTitle = PAGE_TITLES[location.pathname] || 'MessFlow';

    // Announcement badge for students
    useEffect(() => {
        if (profile?.role !== 'student') return;
        const today  = getToday();
        const seenKey = `ann_seen_${today}`;
        const seen   = sessionStorage.getItem(seenKey);
        announcementService.getAnnouncementsByDate(today)
            .then((data) => { if (data.length > 0 && !seen) setAnnBadge(data.length); })
            .catch(() => {});
    }, [profile?.role]);

    function clearBadge() {
        sessionStorage.setItem(`ann_seen_${getToday()}`, '1');
        setAnnBadge(0);
    }

    async function handleSignOut() {
        await signOut();
        navigate('/login');
    }

    const initial = profile?.name?.charAt(0)?.toUpperCase() || '?';
    const roleLabel = profile?.role
        ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) + ' Panel'
        : '';

    return (
        <div className="ms-layout">

            {/* ── Mobile overlay ─────────────────────────────────── */}
            {mobileOpen && (
                <div className="ms-overlay" onClick={() => setMobileOpen(false)} />
            )}

            {/* ── Sidebar ────────────────────────────────────────── */}
            <aside className={`ms-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>

                {/* Brand */}
                <div className="ms-brand">
                    <div className="ms-brand-logo">M</div>
                    {!collapsed && (
                        <div className="ms-brand-text">
                            <div className="ms-brand-name">MessFlow</div>
                            <div className="ms-brand-sub">{roleLabel}</div>
                        </div>
                    )}
                    <button
                        className="ms-collapse-btn"
                        onClick={() => setCollapsed(v => !v)}
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {collapsed ? '›' : '‹'}
                    </button>
                </div>

                {/* Nav links */}
                <nav className="ms-nav">
                    {links.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.end}
                            onClick={() => {
                                setMobileOpen(false);
                                if (link.to.includes('announcements')) clearBadge();
                            }}
                            className={({ isActive }) => `ms-nav-item${isActive ? ' active' : ''}`}
                            title={collapsed ? link.label : undefined}
                        >
                            <span className="ms-nav-icon">{link.icon}</span>
                            {!collapsed && <span className="ms-nav-label">{link.label}</span>}
                            {!collapsed && link.to.includes('announcements') && annBadge > 0 && (
                                <span className="ms-nav-badge">{annBadge > 9 ? '9+' : annBadge}</span>
                            )}
                        </NavLink>
                    ))}

                    {/* Admin-only: Guest Booking */}
                    {profile?.role === 'admin' && (
                        <>
                            <div className="ms-nav-divider" />
                            <NavLink
                                to="/guest"
                                onClick={() => setMobileOpen(false)}
                                className={({ isActive }) => `ms-nav-item${isActive ? ' active' : ''}`}
                                title={collapsed ? 'Guest Booking' : undefined}
                            >
                                <span className="ms-nav-icon">🎫</span>
                                {!collapsed && <span className="ms-nav-label">Guest Booking</span>}
                            </NavLink>
                        </>
                    )}
                </nav>

                {/* Footer — module switch + user */}
                <div className="ms-footer">
                    {!collapsed && <div className="ms-footer-label">Switch Module</div>}

                    <button
                        className="ms-nav-item"
                        onClick={() => { navigate('/canteen'); setMobileOpen(false); }}
                        title={collapsed ? 'Canteen Pre-Order' : undefined}
                    >
                        <span className="ms-nav-icon">🍱</span>
                        {!collapsed && <span className="ms-nav-label">Canteen Pre-Order</span>}
                    </button>

                    <button
                        className="ms-nav-item"
                        onClick={() => { navigate('/select-module'); setMobileOpen(false); }}
                        title={collapsed ? 'All Modules' : undefined}
                    >
                        <span className="ms-nav-icon">🔄</span>
                        {!collapsed && <span className="ms-nav-label">All Modules</span>}
                    </button>

                    <div className="ms-nav-divider" />

                    {/* User card (expanded) / sign-out icon (collapsed) */}
                    {!collapsed ? (
                        <div className="ms-user-card">
                            <div className="ms-user-avatar">{initial}</div>
                            <div className="ms-user-info">
                                <div className="ms-user-name">{profile?.name || 'User'}</div>
                                <div className="ms-user-role">{profile?.email}</div>
                            </div>
                            <button className="ms-signout-btn" onClick={handleSignOut} title="Sign out">
                                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <button className="ms-nav-item" onClick={handleSignOut} title="Sign out">
                            <span className="ms-nav-icon">
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                            </span>
                        </button>
                    )}
                </div>
            </aside>

            {/* ── Main ───────────────────────────────────────────── */}
            <div className="ms-main">

                {/* Topbar */}
                <header className="ms-topbar">
                    <div className="ms-topbar-left">
                        <button
                            className="ms-mobile-menu-btn"
                            onClick={() => setMobileOpen(true)}
                            aria-label="Open menu"
                        >
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M3 12h18M3 6h18M3 18h18" />
                            </svg>
                        </button>
                        <h2 className="ms-topbar-title">{pageTitle}</h2>
                    </div>

                    <div className="ms-topbar-right">
                        {/* Announcement bell */}
                        {profile?.role === 'student' && annBadge > 0 && (
                            <NavLink
                                to="/student/announcements"
                                onClick={clearBadge}
                                style={{
                                    position: 'relative', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', width: 36, height: 36, borderRadius: 9,
                                    background: 'rgba(245,158,11,0.1)', textDecoration: 'none',
                                    transition: 'background 0.15s',
                                }}
                                title={`${annBadge} new announcement${annBadge > 1 ? 's' : ''} today`}
                            >
                                <span style={{ fontSize: '1rem' }}>🔔</span>
                                <span style={{
                                    position: 'absolute', top: -3, right: -3,
                                    width: 16, height: 16, borderRadius: '50%',
                                    background: '#EF4444', color: 'white',
                                    fontSize: '0.6rem', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {annBadge > 9 ? '9+' : annBadge}
                                </span>
                            </NavLink>
                        )}

                        <span className={`badge ${roleBadgeClass}`} style={{ fontSize: '0.7rem' }}>
                            {profile?.role}
                        </span>

                        <button
                            onClick={handleSignOut}
                            className="btn btn-ghost btn-sm"
                            style={{ color: '#64748B' }}
                            title="Sign Out"
                        >
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            <span style={{ display: 'none' }}>Sign Out</span>
                        </button>
                    </div>
                </header>

                {/* Page content */}
                <main className="ms-content">
                    <div style={{ maxWidth: '1200px', margin: '0 auto' }} className="animate-fade-in">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
