import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import { bookingService } from '../../services/bookingService';
import { leaveService } from '../../services/leaveService';
import { announcementService } from '../../services/announcementService';
import { menuService } from '../../services/menuService';
import { useRealtimeBookings } from '../../hooks/useRealtime';
import { LUNCH_SLOTS, DINNER_SLOTS } from '../../utils/constants';
import { getToday } from '../../utils/dateHelpers';
import { format } from 'date-fns';
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

function parseMenuItems(text) {
    return (text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

function MetricCard({ icon, label, value, loading, accent }) {
    return (
        <div className="metric-card">
            <div className="metric-icon" style={{ background: accent + '18' }}>
                <span style={{ fontSize: '1.375rem' }}>{icon}</span>
            </div>
            <div>
                <p className="metric-value" style={{ color: accent }}>
                    {loading ? '—' : value}
                </p>
                <p className="metric-label">{label}</p>
            </div>
        </div>
    );
}

export default function Overview() {
    const [allBookings, setAllBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeLeaves, setActiveLeaves] = useState(0);
    const [noShows, setNoShows] = useState(0);
    const [todayMenus, setTodayMenus] = useState([]);
    const [recentAnnouncements, setRecentAnnouncements] = useState([]);

    const today = getToday();

    async function fetchData() {
        try {
            setLoading(true);
            const [bookings, menus, announcements] = await Promise.all([
                bookingService.getAllBookingsByDate(today),
                menuService.getTodayMenus(),
                announcementService.getAnnouncements(5),
            ]);
            setAllBookings(bookings);
            setTodayMenus(menus);
            setRecentAnnouncements(announcements);

            try {
                const leaves = await leaveService.getAllActiveLeaves();
                setActiveLeaves(leaves.length);
            } catch {
                setActiveLeaves(0);
            }

            // no-shows = status 'no_show'
            setNoShows(bookings.filter(b => b.status === 'no_show').length);
        } catch (err) {
            console.error('Failed to fetch overview:', err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchData(); }, [today]);
    useRealtimeBookings(today, () => fetchData());

    const active = allBookings.filter((b) => b.status !== 'cancelled');
    const cancelled = allBookings.filter((b) => b.status === 'cancelled');
    const totalActive = active.length;
    const totalCancelled = cancelled.length;
    const cancelRate = allBookings.length > 0 ? Math.round((totalCancelled / allBookings.length) * 100) : 0;

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
    todayMenus.forEach((m) => (menuMap[m.meal_type] = m));

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Page header */}
            <div>
                <h2 className="page-title">Overview</h2>
                <p className="page-subtitle">
                    {format(new Date(), 'EEEE, MMMM dd, yyyy')} &nbsp;·&nbsp; Real-time meal statistics
                </p>
            </div>

            {/* ── TOP: 4 Metric Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon="🍴" label="Total Bookings" value={totalActive} loading={loading} accent="#2563EB" />
                <MetricCard icon="❌" label={`Cancellations${cancelRate > 0 ? ' (' + cancelRate + '%)' : ''}`} value={totalCancelled} loading={loading} accent="#DC2626" />
                <MetricCard icon="🏖️" label="Active Leaves" value={activeLeaves} loading={loading} accent="#7C3AED" />
                <MetricCard icon="⚠️" label="No-Shows" value={noShows} loading={loading} accent="#F59E0B" />
            </div>

            {/* ── MIDDLE: Slot Charts (left) + Menu Preview (right) ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Slot Charts — takes 2 cols */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Confirmed vs Cancelled bar */}
                    <Card title="Meal Breakdown" icon="📊">
                        {loading ? (
                            <div className="skeleton h-20 w-full rounded-xl" />
                        ) : (
                            <div className="grid grid-cols-3 gap-6">
                                {[
                                    { meal: 'Breakfast', icon: '☀️', confirmed: breakfastCount, cancelled: cancelledBreakfast },
                                    { meal: 'Lunch', icon: '🍽️', confirmed: lunchCount, cancelled: cancelledLunch },
                                    { meal: 'Dinner', icon: '🌙', confirmed: dinnerCount, cancelled: cancelledDinner },
                                ].map(({ meal, icon, confirmed, cancelled: c }) => {
                                    const total = confirmed + c;
                                    const pct = total > 0 ? Math.round((confirmed / total) * 100) : 0;
                                    return (
                                        <div key={meal} className="space-y-2.5">
                                            <div className="flex items-center gap-2">
                                                <span>{icon}</span>
                                                <span className="text-sm font-semibold text-text">{meal}</span>
                                                <span className="ml-auto text-xs font-bold text-text">{total}</span>
                                            </div>
                                            <div className="h-2.5 rounded-full bg-border overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-success transition-all duration-700"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-success font-semibold">✓ {confirmed} booked</span>
                                                <span className="text-danger font-medium">✗ {c}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>

                    {/* Slot Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Lunch Slot Distribution" icon="🍽️">
                            {loading ? (
                                <div className="skeleton h-52 w-full rounded-xl" />
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

                        <Card title="Dinner Slot Distribution" icon="🌙">
                            {loading ? (
                                <div className="skeleton h-52 w-full rounded-xl" />
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

                {/* Right column: menu + announcements */}
                <div className="space-y-6">
                    {/* Today's Menu */}
                    <Card title="Today's Menu" icon="🍴">
                        {loading ? (
                            <div className="skeleton h-44 w-full rounded-xl" />
                        ) : todayMenus.length === 0 ? (
                            <div className="empty-state py-6">
                                <div className="empty-state-icon">📋</div>
                                <p className="empty-state-text">No menu set</p>
                                <p className="empty-state-sub">Go to Menu Management to add today's menu.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {MEAL_ORDER.map((meal) => {
                                    const m = menuMap[meal];
                                    if (!m) return null;
                                    const items = parseMenuItems(m.items);
                                    return (
                                        <div key={meal} className="flex gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center text-base flex-shrink-0">
                                                {MEAL_ICON[meal]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-text">{MEAL_LABEL[meal]}</p>
                                                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                                                    {items.slice(0, 4).join(', ')}{items.length > 4 ? ` +${items.length - 4} more` : ''}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>

                    {/* Recent Announcements */}
                    <Card title="Recent Announcements" icon="📢">
                        {loading ? (
                            <div className="space-y-2">
                                {[1, 2, 3].map((i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
                            </div>
                        ) : recentAnnouncements.length === 0 ? (
                            <div className="empty-state py-6">
                                <div className="empty-state-icon">📭</div>
                                <p className="empty-state-text">No announcements yet</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {recentAnnouncements.map((ann) => (
                                    <div
                                        key={ann.id}
                                        className={`p-3 rounded-xl border ${ann.is_important
                                            ? 'bg-amber-50 border-amber-200'
                                            : 'bg-surface-hover border-border'
                                            }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            {ann.is_important && <span className="text-sm">⭐</span>}
                                            <h4 className={`text-sm font-semibold truncate ${ann.is_important ? 'text-amber-900' : 'text-text'}`}>
                                                {ann.title}
                                            </h4>
                                        </div>
                                        {ann.description && (
                                            <p className="text-xs text-text-secondary mt-0.5 truncate">{ann.description}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
