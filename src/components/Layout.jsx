import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { announcementService } from '../services/announcementService';
import { getToday } from '../utils/dateHelpers';

const studentLinks = [
    { to: '/student', label: 'Dashboard', icon: '📊', end: true },
    { to: '/student/announcements', label: 'Announcements', icon: '📢', end: false },
    { to: '/student/lunch', label: 'Lunch Slots', icon: '🍽️', end: false },
    { to: '/student/dinner', label: 'Dinner Slots', icon: '🌙', end: false },
    { to: '/student/leave', label: 'Leave', icon: '🏖️', end: false },
    { to: '/student/history', label: 'Meal History', icon: '📜', end: false },
    { to: '/student/profile', label: 'Profile', icon: '👤', end: false },
];

const adminLinks = [
    { to: '/admin', label: 'Overview', icon: '📊', end: true },
    { to: '/admin/announcements', label: 'Announcements', icon: '📢', end: false },
    { to: '/admin/menu', label: 'Menu Management', icon: '🍴', end: false },
    { to: '/admin/slots', label: 'Slot Monitor', icon: '📈', end: false },
    { to: '/admin/leaves', label: 'Leave Monitor', icon: '🏖️', end: false },
    { to: '/admin/no-shows', label: 'No-Show Monitor', icon: '⚠️', end: false },
    { to: '/admin/scan-logs', label: 'Scan Logs', icon: '📷', end: false },
    { to: '/admin/analytics', label: 'Analytics', icon: '📉', end: false },
    { to: '/admin/feedback', label: 'Meal Feedback', icon: '⭐', end: false },
];

const staffLinks = [
    { to: '/scan', label: 'QR Scanner', icon: '📷', end: true },
];

// Map route paths to page titles
const PAGE_TITLES = {
    '/student': 'Dashboard',
    '/student/announcements': 'Announcements',
    '/student/lunch': 'Lunch Slots',
    '/student/dinner': 'Dinner Slots',
    '/student/leave': 'Leave',
    '/student/history': 'Meal History',
    '/student/profile': 'Profile',
    '/admin': 'Overview',
    '/admin/announcements': 'Announcements',
    '/admin/menu': 'Menu Management',
    '/admin/slots': 'Slot Monitor',
    '/admin/leaves': 'Leave Monitor',
    '/admin/no-shows': 'No-Show Monitor',
    '/admin/scan-logs': 'Scan Logs',
    '/admin/analytics': 'Analytics Overview',
    '/admin/feedback': 'Meal Feedback',
    '/scan': 'QR Scanner',
    '/guest': 'Guest Booking',
};

export default function Layout() {
    const { profile, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [annBadge, setAnnBadge] = useState(0);

    const links = profile?.role === 'admin' ? adminLinks
        : profile?.role === 'staff' ? staffLinks
            : studentLinks;
    const roleBadgeClass = profile?.role === 'admin' ? 'badge-admin'
        : profile?.role === 'staff' ? 'badge-admin'
            : 'badge-student';

    // Derive page title from current path
    const pageTitle = PAGE_TITLES[location.pathname] || 'MessFlow';

    // For students, check if there are announcements today they haven't seen
    useEffect(() => {
        if (profile?.role !== 'student') return;
        const today = getToday();
        const seenKey = `ann_seen_${today}`;
        const seen = sessionStorage.getItem(seenKey);

        announcementService.getAnnouncementsByDate(today)
            .then((data) => {
                if (data.length > 0 && !seen) {
                    setAnnBadge(data.length);
                }
            })
            .catch(() => { });
    }, [profile?.role]);

    function clearBadge() {
        const today = getToday();
        sessionStorage.setItem(`ann_seen_${today}`, '1');
        setAnnBadge(0);
    }

    async function handleSignOut() {
        await signOut();
        navigate('/login');
    }

    return (
        <div className="min-h-screen bg-bg flex">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ── Sidebar ────────────────────────────────────────────── */}
            <aside
                className={`fixed top-0 left-0 z-50 h-full bg-surface border-r border-border flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
                style={{ width: '260px', minWidth: '260px' }}
            >
                {/* Logo */}
                <div className="px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)' }}
                        >
                            <span className="text-white font-black text-lg">M</span>
                        </div>
                        <div>
                            <h1 className="text-[15px] font-bold text-text tracking-tight">MessFlow</h1>
                            <p className="text-[11px] text-text-muted capitalize font-medium">{profile?.role} Panel</p>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-0.5">
                    {links.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.end}
                            onClick={() => {
                                setSidebarOpen(false);
                                if (link.to.includes('announcements')) clearBadge();
                            }}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-200 relative group ${isActive
                                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm'
                                    : 'text-text-secondary hover:bg-slate-50 hover:text-text'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-r-full" />
                                    )}
                                    <span className="text-base leading-none">{link.icon}</span>
                                    <span className="flex-1">{link.label}</span>
                                    {/* Badge for announcements */}
                                    {link.to.includes('announcements') && annBadge > 0 && (
                                        <span className="w-5 h-5 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
                                            {annBadge > 9 ? '9+' : annBadge}
                                        </span>
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}

                    {/* Divider before admin-only Guest Booking */}
                    {profile?.role === 'admin' && (
                        <>
                            <div className="divider mx-2 my-1.5" />
                            <NavLink
                                to="/guest"
                                onClick={() => setSidebarOpen(false)}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-200 relative ${isActive
                                        ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm'
                                        : 'text-text-secondary hover:bg-slate-50 hover:text-text'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        {isActive && (
                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-r-full" />
                                        )}
                                        <span className="text-base leading-none">🎫</span>
                                        <span>Guest Booking</span>
                                    </>
                                )}
                            </NavLink>
                        </>
                    )}
                </nav>

                {/* User section */}
                <div className="p-3 border-t border-border">
                    <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-surface-hover mb-1.5">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-bold text-sm">
                                {profile?.name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13.5px] font-semibold text-text truncate">{profile?.name || 'User'}</p>
                            <p className="text-[11.5px] text-text-muted truncate">{profile?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="w-full btn btn-ghost btn-sm text-danger/80 hover:bg-danger/5 hover:text-danger text-[13px]"
                    >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* ── Main content ────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-h-screen min-w-0">
                {/* Top bar */}
                <header
                    className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md border-b border-border px-4 lg:px-8"
                    style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)', height: '64px' }}
                >
                    <div className="flex items-center justify-between h-full">
                        {/* Left: hamburger + page title */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="btn btn-ghost btn-sm lg:hidden w-9 h-9 p-0"
                                aria-label="Open menu"
                            >
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M3 12h18M3 6h18M3 18h18" />
                                </svg>
                            </button>
                            <h2 className="text-[17px] font-bold text-text tracking-tight">
                                {pageTitle}
                            </h2>
                        </div>

                        {/* Right: notification + role badge + sign out */}
                        <div className="flex items-center gap-2.5">
                            {/* Announcement bell (students) */}
                            {profile?.role === 'student' && annBadge > 0 && (
                                <NavLink
                                    to="/student/announcements"
                                    onClick={clearBadge}
                                    className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-warning/10 hover:bg-warning/20 transition-colors"
                                    title={`${annBadge} new announcement${annBadge > 1 ? 's' : ''} today`}
                                >
                                    <span className="text-base">🔔</span>
                                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
                                        {annBadge > 9 ? '9+' : annBadge}
                                    </span>
                                </NavLink>
                            )}
                            <span className={`badge ${roleBadgeClass} text-xs capitalize`}>
                                {profile?.role}
                            </span>
                            <button
                                onClick={handleSignOut}
                                className="btn btn-ghost btn-sm text-text-secondary hover:text-danger hover:bg-danger/5 hidden sm:inline-flex"
                                title="Sign Out"
                            >
                                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                                <span className="hidden md:inline">Sign Out</span>
                            </button>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 p-5 lg:p-8">
                    <div className="max-w-[1200px] mx-auto animate-fade-in">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
