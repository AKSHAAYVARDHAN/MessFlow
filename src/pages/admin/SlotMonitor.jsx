import { useState, useEffect, useRef } from 'react';
import Card from '../../components/Card';
import { bookingService } from '../../services/bookingService';
import { useRealtimeBookings } from '../../hooks/useRealtime';
import { LUNCH_SLOTS, DINNER_SLOTS } from '../../utils/constants';
import { getToday } from '../../utils/dateHelpers';
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

const BAR_COLORS_LUNCH = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'];
const BAR_COLORS_DINNER = ['#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE', '#EDE9FE', '#F5F3FF'];

const PIE_COLORS = {
    breakfast: { bg: '#FEF3C7', text: '#92400E', icon: '☀️', accent: '#F59E0B' },
    lunch: { bg: '#DBEAFE', text: '#1E40AF', icon: '🍽️', accent: '#2563EB' },
    dinner: { bg: '#EDE9FE', text: '#5B21B6', icon: '🌙', accent: '#7C3AED' },
};

function StatCard({ label, icon, count, total, loading, accent, bg, textColor }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div className="card flex items-center gap-4" style={{ borderTop: `3px solid ${accent}` }}>
            <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: bg }}
            >
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                {loading ? (
                    <>
                        <div className="skeleton h-7 w-16 mb-1" />
                        <div className="skeleton h-4 w-24" />
                    </>
                ) : (
                    <>
                        <p className="text-2xl font-extrabold" style={{ color: textColor, letterSpacing: '-0.02em' }}>
                            {count}
                        </p>
                        <p className="text-xs text-text-muted font-medium mt-0.5">{label}</p>
                    </>
                )}
            </div>
            {!loading && total > 0 && (
                <div className="text-right flex-shrink-0">
                    <span className="text-lg font-bold" style={{ color: accent }}>{pct}%</span>
                    <p className="text-xs text-text-muted">of total</p>
                </div>
            )}
        </div>
    );
}

function SlotBarChart({ data, colors, emptyLabel }) {
    const hasData = data.some((d) => d.count > 0);
    const maxVal = Math.max(...data.map((d) => d.count), 1);

    return (
        <div className="relative">
            {!hasData && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                    <div className="bg-surface-hover border border-border rounded-xl px-4 py-3 text-center shadow-sm">
                        <p className="text-2xl mb-1">📭</p>
                        <p className="text-sm font-semibold text-text-secondary">{emptyLabel}</p>
                        <p className="text-xs text-text-muted mt-0.5">Slot labels are shown below</p>
                    </div>
                </div>
            )}
            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: '#64748B' }}
                        tickLine={false}
                        axisLine={{ stroke: '#E2E8F0' }}
                    />
                    <YAxis
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        allowDecimals={false}
                        domain={[0, Math.max(maxVal + 1, 5)]}
                        tickLine={false}
                        axisLine={false}
                    />
                    <Tooltip
                        contentStyle={{
                            background: '#fff',
                            border: '1px solid #E2E8F0',
                            borderRadius: '10px',
                            fontSize: '13px',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                        }}
                        formatter={(val) => [val, 'Bookings']}
                        cursor={{ fill: 'rgba(226,232,240,0.4)' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {data.map((_, idx) => (
                            <Cell
                                key={idx}
                                fill={hasData ? colors[idx % colors.length] : '#E2E8F0'}
                                fillOpacity={hasData ? 1 : 0.5}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export default function SlotMonitor() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(null);
    const intervalRef = useRef(null);

    const today = getToday();

    async function fetchData() {
        try {
            setLoading(true);
            const data = await bookingService.getBookingsByDate(today);
            setBookings(data);
            setLastRefresh(new Date());
        } catch (err) {
            console.error('Failed to fetch slot data:', err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
        intervalRef.current = setInterval(fetchData, 30_000);
        return () => clearInterval(intervalRef.current);
    }, [today]);

    useRealtimeBookings(today, () => {
        fetchData();
    });

    // Derived data
    const breakfastBookings = bookings.filter((b) => b.meal_type === 'breakfast');
    const lunchBookings = bookings.filter((b) => b.meal_type === 'lunch');
    const dinnerBookings = bookings.filter((b) => b.meal_type === 'dinner');
    const totalBookings = bookings.length;

    const lunchData = LUNCH_SLOTS.map((slot) => ({
        name: slot.label,
        count: lunchBookings.filter((b) => b.slot_time === slot.value).length,
    }));

    const dinnerData = DINNER_SLOTS.map((slot) => ({
        name: slot.label,
        count: dinnerBookings.filter((b) => b.slot_time === slot.value).length,
    }));

    const summaryCards = [
        { key: 'breakfast', label: 'Breakfast Bookings', count: breakfastBookings.length, ...PIE_COLORS.breakfast },
        { key: 'lunch', label: 'Lunch Bookings', count: lunchBookings.length, ...PIE_COLORS.lunch },
        { key: 'dinner', label: 'Dinner Bookings', count: dinnerBookings.length, ...PIE_COLORS.dinner },
    ];

    const refreshLabel = lastRefresh
        ? lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '…';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h2 className="page-title">Real-Time Slot Monitor</h2>
                    <p className="page-subtitle">
                        Live slot distribution for {new Date(today).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
                        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                        <span className="text-xs font-semibold text-success">Live updating</span>
                    </div>
                    {lastRefresh && (
                        <span className="text-xs text-text-muted">Last: {refreshLabel}</span>
                    )}
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {summaryCards.map((c) => (
                    <StatCard
                        key={c.key}
                        label={c.label}
                        icon={c.icon}
                        count={c.count}
                        total={totalBookings}
                        loading={loading}
                        accent={c.accent}
                        bg={c.bg}
                        textColor={c.text}
                    />
                ))}
            </div>

            {/* Total bookings banner */}
            {!loading && (
                <div
                    className={`flex items-center gap-3 rounded-xl px-5 py-3.5 border ${totalBookings === 0
                            ? 'bg-surface-hover border-border'
                            : 'bg-primary/5 border-primary/15'
                        }`}
                >
                    <span className="text-xl">{totalBookings === 0 ? '📭' : '📊'}</span>
                    <div>
                        {totalBookings === 0 ? (
                            <>
                                <p className="text-sm font-semibold text-text-secondary">No bookings yet for today</p>
                                <p className="text-xs text-text-muted">Slot charts are ready — they will populate as students book meals.</p>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-semibold text-text">
                                    <span className="text-primary font-extrabold">{totalBookings}</span> total bookings today
                                </p>
                                <p className="text-xs text-text-muted">Across all meal types and slots</p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Slot Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Lunch Slots" icon="🍽️" badge={loading ? '…' : `${lunchBookings.length} booked`} badgeType="badge-info">
                    {loading ? (
                        <div className="skeleton h-64 w-full" />
                    ) : (
                        <SlotBarChart
                            data={lunchData}
                            colors={BAR_COLORS_LUNCH}
                            emptyLabel="No lunch bookings yet"
                        />
                    )}
                </Card>

                <Card title="Dinner Slots" icon="🌙" badge={loading ? '…' : `${dinnerBookings.length} booked`} badgeType="badge-purple">
                    {loading ? (
                        <div className="skeleton h-64 w-full" />
                    ) : (
                        <SlotBarChart
                            data={dinnerData}
                            colors={BAR_COLORS_DINNER}
                            emptyLabel="No dinner bookings yet"
                        />
                    )}
                </Card>
            </div>

            {/* Breakfast note (no slots) */}
            <Card title="Breakfast" icon="☀️" badge={loading ? '…' : `${breakfastBookings.length} booked`} badgeType="badge-warning">
                {loading ? (
                    <div className="skeleton h-20 w-full" />
                ) : breakfastBookings.length === 0 ? (
                    <div className="flex items-center gap-4 py-4 px-2">
                        <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center text-xl flex-shrink-0">☀️</div>
                        <div>
                            <p className="text-sm font-semibold text-text-secondary">No breakfast bookings yet</p>
                            <p className="text-xs text-text-muted mt-0.5">Breakfast has no time slots — all students book as a single block.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-4 py-4 px-2">
                        <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center text-xl flex-shrink-0">☀️</div>
                        <div>
                            <p className="text-2xl font-extrabold text-warning">{breakfastBookings.length}</p>
                            <p className="text-xs text-text-muted mt-0.5">Students booked for breakfast (no time slot selection)</p>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
