import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import { bookingService } from '../../services/bookingService';
import { leaveService } from '../../services/leaveService';
import { announcementService } from '../../services/announcementService';
import { menuService } from '../../services/menuService';
import { useRealtimeBookings } from '../../hooks/useRealtime';
import { LUNCH_SLOTS, DINNER_SLOTS } from '../../utils/constants';

import { format, formatDistanceToNow, parseISO } from 'date-fns';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';

const COLORS = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#818CF8', '#A78BFA'];

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const MEAL_ICON = { breakfast: '☀️', lunch: '🍽️', dinner: '🌙' };
const MEAL_BADGE = { breakfast: 'badge-warning', lunch: 'badge-info', dinner: 'badge-purple' };

function parseMenuItems(text) {
    return (text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

/* ── Stat Card ─────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, loading, accent, tint }) {
    return (
        <div className="overview-stat-card card-hover" style={{ '--stat-accent': accent, '--stat-tint': tint }}>
            <div className="overview-stat-icon">
                <span>{icon}</span>
            </div>
            <div className="overview-stat-body">
                {loading ? (
                    <div className="skeleton" style={{ width: 48, height: 28, borderRadius: 8 }} />
                ) : (
                    <p className="overview-stat-value">{value}</p>
                )}
                <p className="overview-stat-label">{label}</p>
            </div>
        </div>
    );
}

/* ── Skeleton Row ──────────────────────────────────────────────────── */
function SkeletonRows({ count = 3, height = 56 }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height, width: '100%', borderRadius: 12 }} />
            ))}
        </div>
    );
}

/* ════════════════════════════════════════════════════════════════════ */
export default function Overview() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    // Stat counts
    const [totalBookings, setTotalBookings] = useState(0);
    const [cancellations, setCancellations] = useState(0);
    const [activeLeaves, setActiveLeaves] = useState(0);
    const [noShows, setNoShows] = useState(0);

    // Full data for breakdowns
    const [allBookings, setAllBookings] = useState([]);
    const [todayMenus, setTodayMenus] = useState([]);
    const [recentAnnouncements, setRecentAnnouncements] = useState([]);

    const today = new Date().toISOString().split('T')[0];

    async function fetchData() {
        try {
            setLoading(true);

            // Debug: verify auth is ready before querying
            console.log('Overview → user:', user);
            console.log('Overview → today:', today);

            const [
                bookingCount,
                cancelCount,
                noShowCount,
                leavesCount,
                bookings,
                menus,
                announcements,
            ] = await Promise.all([
                bookingService.getBookingCountByDate(today),
                bookingService.getCancellationCountByDate(today),
                bookingService.getNoShowCountByDate(today),
                leaveService.getActiveLeavesCount(today),
                bookingService.getAllBookingsByDate(today),
                menuService.getTodayMenus(),
                announcementService.getAnnouncements(5),
            ]);

            // Debug: verify returned data
            console.log('Today:', today);
            console.log('MenuData:', menus);
            console.log('Announcements:', announcements);
            console.log('Overview → totalBookings:', bookingCount);

            setTotalBookings(bookingCount);
            setCancellations(cancelCount);
            setNoShows(noShowCount);
            setActiveLeaves(leavesCount);
            setAllBookings(bookings);
            setTodayMenus(menus);
            setRecentAnnouncements(announcements);
        } catch (err) {
            console.error('Failed to fetch overview:', err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!user) return;   // wait until Supabase session is hydrated
        fetchData();
    }, [user, today]);
    useRealtimeBookings(today, () => fetchData());

    // ── Derived stats ────────────────────────────────────────────────────
    const active = allBookings.filter((b) => b.status !== 'cancelled');
    const cancelled = allBookings.filter((b) => b.status === 'cancelled');
    const cancelRate = totalBookings > 0 ? Math.round((cancellations / totalBookings) * 100) : 0;

    const breakfastCount = active.filter((b) => b.meal_type === 'breakfast').length;
    const lunchCount = active.filter((b) => b.meal_type === 'lunch').length;
    const dinnerCount = active.filter((b) => b.meal_type === 'dinner').length;

    const cancelledBreakfast = cancelled.filter((b) => b.meal_type === 'breakfast').length;
    const cancelledLunch = cancelled.filter((b) => b.meal_type === 'lunch').length;
    const cancelledDinner = cancelled.filter((b) => b.meal_type === 'dinner').length;

    const lunchData = LUNCH_SLOTS.map((slot) => ({
        name: slot.label,
        count: active.filter((b) => b.meal_type === 'lunch' && b.slot_time === slot.value).length,
    }));

    const dinnerData = DINNER_SLOTS.map((slot) => ({
        name: slot.label,
        count: active.filter((b) => b.meal_type === 'dinner' && b.slot_time === slot.value).length,
    }));

    const menuMap = {};
    todayMenus.forEach((m) => (menuMap[m.meal_type.toLowerCase()] = m));

    return (
        <div className="overview-root animate-fade-in">
            {/* ── Page Header ── */}
            <div className="overview-header">
                <h2 className="page-title">Overview</h2>
                <p className="page-subtitle">
                    {format(new Date(), 'EEEE, MMMM dd, yyyy')} &nbsp;·&nbsp; Real-time meal statistics
                </p>
            </div>

            {/* ═══ SECTION 1 — Stat Cards ═══ */}
            <div className="overview-stats-grid">
                <StatCard
                    icon="📊" label="Total Bookings" value={totalBookings}
                    loading={loading} accent="#2563EB" tint="#EFF6FF"
                />
                <StatCard
                    icon="❌" label={`Cancellations${cancelRate > 0 ? ` (${cancelRate}%)` : ''}`}
                    value={cancellations} loading={loading} accent="#DC2626" tint="#FEF2F2"
                />
                <StatCard
                    icon="🏖️" label="Active Leaves" value={activeLeaves}
                    loading={loading} accent="#7C3AED" tint="#F5F3FF"
                />
                <StatCard
                    icon="⚠️" label="No-Shows" value={noShows}
                    loading={loading} accent="#F59E0B" tint="#FFFBEB"
                />
            </div>

            {/* ═══ SECTION 2 — Meal Breakdown ═══ */}
            <Card title="Meal Breakdown" icon="📊">
                {loading ? (
                    <div className="skeleton" style={{ height: 80, width: '100%', borderRadius: 12 }} />
                ) : (
                    <div className="overview-meal-breakdown">
                        {[
                            { meal: 'Breakfast', icon: '☀️', confirmed: breakfastCount, cancelled: cancelledBreakfast },
                            { meal: 'Lunch', icon: '🍽️', confirmed: lunchCount, cancelled: cancelledLunch },
                            { meal: 'Dinner', icon: '🌙', confirmed: dinnerCount, cancelled: cancelledDinner },
                        ].map(({ meal, icon, confirmed, cancelled: c }) => {
                            const total = confirmed + c;
                            const pct = total > 0 ? Math.round((confirmed / total) * 100) : 0;
                            return (
                                <div key={meal} className="overview-meal-item">
                                    <div className="flex items-center gap-2">
                                        <span style={{ fontSize: '1.125rem' }}>{icon}</span>
                                        <span className="text-sm font-semibold text-text">{meal}</span>
                                        <span className="ml-auto text-xs font-bold text-text">{total}</span>
                                    </div>
                                    <div className="overview-progress-track">
                                        <div
                                            className="overview-progress-fill"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-success font-semibold">✓ {confirmed} booked</span>
                                        <span className="text-danger font-medium">✗ {c} cancelled</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            {/* ═══ SECTION 3 — Two-Column: Menu + Announcements ═══ */}
            <div className="overview-two-col">
                {/* ── Today's Menu ── */}
                <Card title="Today's Menu" icon="🍴" className="card-hover">
                    {loading ? (
                        <SkeletonRows count={3} height={72} />
                    ) : todayMenus.length === 0 ? (
                        <div className="empty-state py-6">
                            <div className="empty-state-icon">📋</div>
                            <p className="empty-state-text">No menu set for today</p>
                            <p className="empty-state-sub">Go to Menu Management to add today's menu.</p>
                        </div>
                    ) : (
                        <div className="overview-menu-grid">
                            {MEAL_ORDER.map((meal) => {
                                const m = menuMap[meal];
                                const items = m ? parseMenuItems(m.items) : [];
                                return (
                                    <div key={meal} className="overview-menu-col">
                                        <div className="overview-menu-col-header">
                                            <span style={{ fontSize: '1.25rem' }}>{MEAL_ICON[meal]}</span>
                                            <span className="overview-menu-col-title">{MEAL_LABEL[meal]}</span>
                                        </div>
                                        {items.length === 0 ? (
                                            <p className="overview-menu-empty">Not set</p>
                                        ) : (
                                            <ul className="overview-menu-list">
                                                {items.map((item, i) => (
                                                    <li key={i}>{item}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>

                {/* ── Recent Announcements ── */}
                <Card title="Recent Announcements" icon="📢" className="card-hover">
                    {loading ? (
                        <SkeletonRows count={4} height={64} />
                    ) : recentAnnouncements.length === 0 ? (
                        <div className="empty-state py-6">
                            <div className="empty-state-icon">📭</div>
                            <p className="empty-state-text">No announcements yet</p>
                            <p className="empty-state-sub">Create one from the Announcements page.</p>
                        </div>
                    ) : (
                        <div className="overview-ann-list">
                            {recentAnnouncements.map((ann) => (
                                <div
                                    key={ann.id}
                                    className={`overview-ann-item ${ann.is_important ? 'overview-ann-important' : ''}`}
                                >
                                    <div className="overview-ann-top">
                                        <div className="overview-ann-title-row">
                                            {ann.is_important && <span className="overview-ann-star">⭐</span>}
                                            <h4 className="overview-ann-title">{ann.title}</h4>
                                        </div>
                                        <div className="overview-ann-meta">
                                            {ann.meal_type && (
                                                <span className={`badge ${MEAL_BADGE[ann.meal_type] || 'badge-muted'}`}>
                                                    {ann.meal_type}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {ann.description && (
                                        <p className="overview-ann-desc">{ann.description}</p>
                                    )}
                                    <p className="overview-ann-time">
                                        {formatDistanceToNow(parseISO(ann.created_at), { addSuffix: true })}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {/* ═══ SECTION 4 — Slot Distribution Charts ═══ */}
            <div className="overview-charts-grid">
                <Card title="Lunch Slot Distribution" icon="🍽️" className="card-hover">
                    {loading ? (
                        <div className="skeleton" style={{ height: 220, width: '100%', borderRadius: 12 }} />
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={lunchData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={{ stroke: '#E2E8F0' }} />
                                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={{ stroke: '#E2E8F0' }} allowDecimals={false} />
                                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                    {lunchData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>

                <Card title="Dinner Slot Distribution" icon="🌙" className="card-hover">
                    {loading ? (
                        <div className="skeleton" style={{ height: 220, width: '100%', borderRadius: 12 }} />
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={dinnerData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={{ stroke: '#E2E8F0' }} />
                                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={{ stroke: '#E2E8F0' }} allowDecimals={false} />
                                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                    {dinnerData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>
            </div>
        </div>
    );
}
