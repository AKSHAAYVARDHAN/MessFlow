import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    Dot,
    Legend,
} from 'recharts';
import Card from '../../components/Card';
import { analyticsService } from '../../services/analyticsService';
import { getToday } from '../../utils/dateHelpers';

/* ─── Helpers ─────────────────────────────────────────────────── */

function MetricCard({ icon, label, value, loading, accent, sub }) {
    return (
        <div
            className="metric-card card-hover"
            style={{ flex: '1', minWidth: '0' }}
        >
            <div className="metric-icon" style={{ background: accent + '18' }}>
                <span style={{ fontSize: '1.375rem' }}>{icon}</span>
            </div>
            <div className="min-w-0">
                <p className="metric-value" style={{ color: accent }}>
                    {loading ? (
                        <span className="skeleton inline-block w-14 h-7 rounded-lg" />
                    ) : (
                        value
                    )}
                </p>
                <p className="metric-label">{label}</p>
                {sub && <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

function SectionSkeleton({ height = 240 }) {
    return <div className="skeleton w-full rounded-xl" style={{ height }} />;
}

function EmptyState({ icon, text, sub }) {
    return (
        <div className="empty-state py-10">
            <div className="empty-state-icon">{icon}</div>
            <p className="empty-state-text">{text}</p>
            {sub && <p className="empty-state-sub">{sub}</p>}
        </div>
    );
}

/* ─── Custom Recharts Tooltip ─────────────────────────────────── */
const ChartTooltipStyle = {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    fontSize: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

/* ─── Heatmap Cell ────────────────────────────────────────────── */
const HEATMAP_BASE = [230, 240, 254]; // #E6F0FE (light blue)
const HEATMAP_PEAK = [29, 78, 216];  // #1D4ED8 (dark blue)

function lerp(a, b, t) {
    return Math.round(a + (b - a) * t);
}

function heatColor(count, max) {
    if (max === 0) return { bg: `rgb(241,245,249)`, text: '#94A3B8' };
    const t = Math.min(count / max, 1);
    const r = lerp(HEATMAP_BASE[0], HEATMAP_PEAK[0], t);
    const g = lerp(HEATMAP_BASE[1], HEATMAP_PEAK[1], t);
    const b = lerp(HEATMAP_BASE[2], HEATMAP_PEAK[2], t);
    return {
        bg: `rgb(${r},${g},${b})`,
        text: t > 0.5 ? '#fff' : '#1E40AF',
    };
}

/* ─── Peak Slot Custom Label ──────────────────────────────────── */
function SlotBarLabel({ x, y, width, value }) {
    if (!value) return null;
    return (
        <text x={x + width / 2} y={y - 4} fill="#475569" fontSize={10} textAnchor="middle">
            {value}
        </text>
    );
}

/* ─── Main Analytics Page ─────────────────────────────────────── */
export default function Analytics() {
    const today = getToday();

    const [summaryLoading, setSummaryLoading] = useState(true);
    const [slotLoading, setSlotLoading] = useState(true);
    const [trendLoading, setTrendLoading] = useState(true);
    const [heatLoading, setHeatLoading] = useState(true);
    const [leaderLoading, setLeaderLoading] = useState(true);

    const [summary, setSummary] = useState(null);
    const [slotData, setSlotData] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [heatData, setHeatData] = useState([]);
    const [leaderData, setLeaderData] = useState([]);

    useEffect(() => {
        fetchAll();
    }, [today]);

    async function fetchAll() {
        // Fire all requests independently so a single failure doesn't block others
        analyticsService.getSummaryMetrics(today)
            .then(setSummary)
            .catch(console.error)
            .finally(() => setSummaryLoading(false));

        analyticsService.getPeakSlotUsage()
            .then(buildSlotChartData)
            .catch(console.error)
            .finally(() => setSlotLoading(false));

        analyticsService.getCancellationTrend(14)
            .then(setTrendData)
            .catch(console.error)
            .finally(() => setTrendLoading(false));

        analyticsService.getWeeklyAttendanceHeatmap(30)
            .then(setHeatData)
            .catch(console.error)
            .finally(() => setHeatLoading(false));

        analyticsService.getNoShowLeaderboard(10)
            .then(setLeaderData)
            .catch(console.error)
            .finally(() => setLeaderLoading(false));
    }

    function buildSlotChartData(raw) {
        // Pivot: each entry is {slot, lunch?, dinner?}, merging by slot
        const map = {};
        raw.forEach(({ slot, meal_type, count }) => {
            if (!map[slot]) map[slot] = { slot };
            map[slot][meal_type] = count;
        });
        const sorted = Object.values(map).sort((a, b) => a.slot.localeCompare(b.slot));
        setSlotData(sorted);
    }

    const heatMax = heatData.length > 0 ? Math.max(...heatData.map(d => d.count)) : 0;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* ── Page header ── */}
            <div>
                <h2 className="page-title">Analytics Overview</h2>
                <p className="page-subtitle">
                    {format(new Date(), 'EEEE, MMMM dd, yyyy')}
                    &nbsp;·&nbsp;Historical performance and trends
                </p>
            </div>

            {/* ── PART 6: Summary Metrics Row ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon="🍽️"
                    label="Meals Served Today"
                    value={summary?.mealsServed ?? 0}
                    loading={summaryLoading}
                    accent="#16A34A"
                    sub="Status: scanned"
                />
                <MetricCard
                    icon="❌"
                    label="Cancellations Today"
                    value={summary?.cancellations ?? 0}
                    loading={summaryLoading}
                    accent="#DC2626"
                />
                <MetricCard
                    icon="⚠️"
                    label="No-Shows Today"
                    value={summary?.noShows ?? 0}
                    loading={summaryLoading}
                    accent="#F59E0B"
                />
                <MetricCard
                    icon="📈"
                    label="Avg Daily Attendance"
                    value={summary?.avgDailyAttendance ?? 0}
                    loading={summaryLoading}
                    accent="#7C3AED"
                    sub="Last 7 days"
                />
            </div>

            {/* ── PART 2: Peak Slot Usage ── */}
            <Card title="Peak Slot Usage" icon="⏰">
                {slotLoading ? (
                    <SectionSkeleton height={260} />
                ) : slotData.length === 0 ? (
                    <EmptyState icon="📊" text="No slot data yet" sub="Slot usage will appear once students start booking meals." />
                ) : (
                    <>
                        {/* Legend */}
                        <div className="flex items-center gap-4 mb-4">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#2563EB' }} />
                                Lunch
                            </span>
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#7C3AED' }} />
                                Dinner
                            </span>
                        </div>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={slotData} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                <XAxis dataKey="slot" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip contentStyle={ChartTooltipStyle} cursor={{ fill: 'rgba(37,99,235,0.04)' }} />
                                <Bar dataKey="lunch" name="Lunch" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={36} label={<SlotBarLabel />} />
                                <Bar dataKey="dinner" name="Dinner" fill="#7C3AED" radius={[6, 6, 0, 0]} maxBarSize={36} label={<SlotBarLabel />} />
                            </BarChart>
                        </ResponsiveContainer>
                    </>
                )}
            </Card>

            {/* ── PART 3 + 4: Cancellation Trend + Heatmap side by side ── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* Cancellation Trend */}
                <Card title="Cancellation Trend (Last 14 Days)" icon="📉">
                    {trendLoading ? (
                        <SectionSkeleton height={240} />
                    ) : trendData.every(d => d.count === 0) ? (
                        <EmptyState icon="✅" text="No cancellations" sub="No cancellations were recorded in the last 14 days." />
                    ) : (
                        <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={trendData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={1} />
                                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip contentStyle={ChartTooltipStyle} />
                                <Line
                                    type="monotone"
                                    dataKey="count"
                                    name="Cancellations"
                                    stroke="#DC2626"
                                    strokeWidth={2.5}
                                    dot={{ r: 4, fill: '#DC2626', strokeWidth: 0 }}
                                    activeDot={{ r: 6, fill: '#DC2626', strokeWidth: 0 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </Card>

                {/* Weekly Attendance Heatmap */}
                <Card title="Weekly Attendance Heatmap" icon="🗓️">
                    <p className="text-xs text-text-muted mb-4">Last 30 days — darker = higher attendance</p>
                    {heatLoading ? (
                        <SectionSkeleton height={100} />
                    ) : heatData.length === 0 ? (
                        <EmptyState icon="📆" text="No attendance data" sub="Attendance patterns will be visible after 30 days of bookings." />
                    ) : (
                        <div className="grid grid-cols-7 gap-2">
                            {heatData.map(({ day, count }) => {
                                const { bg, text } = heatColor(count, heatMax);
                                return (
                                    <div
                                        key={day}
                                        className="flex flex-col items-center justify-center rounded-xl py-4 transition-transform duration-200 hover:scale-105 cursor-default"
                                        style={{ background: bg }}
                                        title={`${day}: ${count} attended`}
                                    >
                                        <span
                                            className="text-[11px] font-bold tracking-wide mb-1"
                                            style={{ color: text }}
                                        >
                                            {day}
                                        </span>
                                        <span
                                            className="text-lg font-black leading-none"
                                            style={{ color: text }}
                                        >
                                            {count}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            </div>

            {/* ── PART 5: No-Show Leaderboard ── */}
            <Card title="No-Show Leaderboard" icon="🏆">
                <p className="text-xs text-text-muted mb-4">Top 10 students with the most missed meals</p>
                {leaderLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="skeleton h-14 w-full rounded-xl" />
                        ))}
                    </div>
                ) : leaderData.length === 0 ? (
                    <EmptyState icon="🎉" text="No repeat no-shows" sub="All students have a clean no-show record." />
                ) : (
                    <div className="space-y-2">
                        {leaderData.map((student, idx) => {
                            const rank = idx + 1;
                            const isDanger = student.no_show_count >= 3;
                            const isWarning = student.no_show_count <= 2;
                            const isTop3 = rank <= 3;
                            const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

                            return (
                                <div
                                    key={student.id}
                                    className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-200 hover:shadow-sm ${isDanger
                                        ? 'bg-danger/5 border-danger/20'
                                        : 'bg-surface-hover border-border'
                                        }`}
                                >
                                    {/* Rank */}
                                    <div className="w-8 flex-shrink-0 text-center">
                                        {rankEmoji ? (
                                            <span className="text-xl leading-none">{rankEmoji}</span>
                                        ) : (
                                            <span className="text-sm font-bold text-text-muted">#{rank}</span>
                                        )}
                                    </div>

                                    {/* Avatar */}
                                    <div
                                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
                                        style={{
                                            background: isDanger ? '#FEE2E2' : '#DBEAFE',
                                            color: isDanger ? '#991B1B' : '#1E40AF',
                                        }}
                                    >
                                        {student.name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>

                                    {/* Name + email */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-text truncate">{student.name}</p>
                                        <p className="text-xs text-text-muted truncate">{student.email}</p>
                                    </div>

                                    {/* Badge */}
                                    <span className={`badge flex-shrink-0 ${isDanger ? 'badge-danger' : 'badge-warning'}`}>
                                        {student.no_show_count} no-show{student.no_show_count !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
}
