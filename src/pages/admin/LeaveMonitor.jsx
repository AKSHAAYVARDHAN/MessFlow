import { useState, useEffect, useCallback } from 'react';
import Card from '../../components/Card';
import { leaveService } from '../../services/leaveService';
import { formatDate } from '../../utils/dateHelpers';
import { getToday } from '../../utils/dateHelpers';

const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2 };

function isMealOnLeave(leave, date, mealType) {
    if (date < leave.from_date || date > leave.to_date) return false;
    const mealIdx = MEAL_ORDER[mealType];
    const fromIdx = MEAL_ORDER[leave.from_meal];
    const toIdx = MEAL_ORDER[leave.to_meal];

    if (leave.from_date === date && leave.to_date === date) {
        return mealIdx >= fromIdx && mealIdx <= toIdx;
    }
    if (leave.from_date === date) return mealIdx >= fromIdx;
    if (leave.to_date === date) return mealIdx <= toIdx;
    return true;
}

function SummaryCard({ icon, label, count, loading, accentClass, bg }) {
    return (
        <div className={`card flex items-center gap-4 ${bg}`}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-white/70 shadow-sm">
                {icon}
            </div>
            <div className="min-w-0">
                {loading ? (
                    <>
                        <div className="skeleton h-7 w-10 mb-1" />
                        <div className="skeleton h-4 w-28" />
                    </>
                ) : (
                    <>
                        <p className={`text-2xl font-extrabold ${accentClass}`} style={{ letterSpacing: '-0.02em' }}>
                            {count}
                        </p>
                        <p className="text-xs text-text-muted font-medium mt-0.5">{label}</p>
                    </>
                )}
            </div>
        </div>
    );
}

export default function LeaveMonitor() {
    const today = getToday();
    const [filterDate, setFilterDate] = useState(today);
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchLeaves = useCallback(async () => {
        try {
            setLoading(true);
            const data = await leaveService.getAllActiveLeaves(filterDate);
            setLeaves(data);
        } catch (err) {
            console.error('Failed to fetch leaves:', err);
        } finally {
            setLoading(false);
        }
    }, [filterDate]);

    useEffect(() => {
        fetchLeaves();
    }, [fetchLeaves]);

    const breakfastCount = leaves.filter((l) => isMealOnLeave(l, filterDate, 'breakfast')).length;
    const lunchCount = leaves.filter((l) => isMealOnLeave(l, filterDate, 'lunch')).length;
    const dinnerCount = leaves.filter((l) => isMealOnLeave(l, filterDate, 'dinner')).length;
    const totalCount = leaves.length;
    const isToday = filterDate === today;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="page-title">Leave Monitor</h2>
                    <p className="page-subtitle">
                        Students on approved leave —{' '}
                        {isToday ? 'showing today' : `filtered to ${formatDate(filterDate)}`}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {isToday && (
                        <span className="badge badge-success text-xs">Today</span>
                    )}
                    <label className="text-sm text-text-secondary font-medium sr-only">Date</label>
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="input text-sm py-1.5 w-auto"
                    />
                    {!isToday && (
                        <button
                            onClick={() => setFilterDate(today)}
                            className="btn btn-ghost btn-sm text-xs"
                        >
                            ↩ Today
                        </button>
                    )}
                </div>
            </div>

            {/* Summary stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <SummaryCard
                    icon="🧑‍🎓"
                    label="Total on Leave"
                    count={totalCount}
                    loading={loading}
                    accentClass="text-text"
                    bg=""
                />
                <SummaryCard
                    icon="☀️"
                    label="Breakfast Excluded"
                    count={breakfastCount}
                    loading={loading}
                    accentClass="text-warning"
                    bg="!border-warning/20"
                />
                <SummaryCard
                    icon="🍽️"
                    label="Lunch Excluded"
                    count={lunchCount}
                    loading={loading}
                    accentClass="text-primary"
                    bg="!border-primary/20"
                />
                <SummaryCard
                    icon="🌙"
                    label="Dinner Excluded"
                    count={dinnerCount}
                    loading={loading}
                    accentClass="text-purple-600"
                    bg="!border-purple-200"
                />
            </div>

            {/* Leave table or empty state */}
            <Card
                title={`Active Leaves — ${formatDate(filterDate)}`}
                icon="🏖️"
                badge={loading ? '…' : totalCount > 0 ? `${totalCount} student${totalCount !== 1 ? 's' : ''}` : undefined}
                badgeType="badge-warning"
            >
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="skeleton h-14 w-full" />
                        ))}
                    </div>
                ) : totalCount === 0 ? (
                    /* ── Green "all clear" empty state ── */
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center text-4xl shadow-inner">
                            ✅
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-success">All Students Available</h3>
                            <p className="text-sm text-text-secondary mt-1">
                                No approved leaves on{' '}
                                <span className="font-semibold">{formatDate(filterDate)}</span>.
                            </p>
                            <p className="text-xs text-text-muted mt-1">
                                All students are expected to attend their meals as booked.
                            </p>
                        </div>
                        {!isToday && (
                            <button onClick={() => setFilterDate(today)} className="btn btn-ghost btn-sm text-xs mt-1">
                                View today instead
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border">
                                        {['Student', 'Leave From', 'Leave To', 'Meals Affected', 'Status'].map((h) => (
                                            <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {leaves.map((leave) => {
                                        const meals = ['breakfast', 'lunch', 'dinner'].filter((m) => isMealOnLeave(leave, filterDate, m));
                                        const isPast = leave.to_date < today;

                                        return (
                                            <tr key={leave.id} className="hover:bg-surface-hover transition-colors">
                                                <td className="py-3 px-3">
                                                    <p className="font-semibold text-text">{leave.users?.name || '—'}</p>
                                                    <p className="text-xs text-text-muted">{leave.users?.email}</p>
                                                </td>
                                                <td className="py-3 px-3 text-text-secondary">
                                                    {formatDate(leave.from_date)}
                                                    <span className="ml-1 text-xs text-text-muted capitalize">({leave.from_meal})</span>
                                                </td>
                                                <td className="py-3 px-3 text-text-secondary">
                                                    {formatDate(leave.to_date)}
                                                    <span className="ml-1 text-xs text-text-muted capitalize">({leave.to_meal})</span>
                                                </td>
                                                <td className="py-3 px-3">
                                                    {meals.length === 0 ? (
                                                        <span className="text-text-muted text-xs">None</span>
                                                    ) : (
                                                        <div className="flex gap-1 flex-wrap">
                                                            {meals.map((m) => (
                                                                <span key={m} className="badge badge-info text-xs capitalize">{m}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3">
                                                    <span className={`badge text-xs ${isPast ? 'badge-muted' : 'badge-success'}`}>
                                                        {isPast ? 'Completed' : 'Active'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="md:hidden space-y-3">
                            {leaves.map((leave) => {
                                const meals = ['breakfast', 'lunch', 'dinner'].filter((m) => isMealOnLeave(leave, filterDate, m));
                                const isPast = leave.to_date < today;

                                return (
                                    <div key={leave.id} className="p-4 rounded-xl border border-border bg-surface-hover">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="font-semibold text-text text-sm">{leave.users?.name || '—'}</p>
                                                <p className="text-xs text-text-muted">{leave.users?.email}</p>
                                            </div>
                                            <span className={`badge text-xs ${isPast ? 'badge-muted' : 'badge-success'}`}>
                                                {isPast ? 'Completed' : 'Active'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-text-secondary mb-2">
                                            {formatDate(leave.from_date)} ({leave.from_meal}) → {formatDate(leave.to_date)} ({leave.to_meal})
                                        </p>
                                        {meals.length > 0 && (
                                            <div className="flex gap-1 flex-wrap">
                                                {meals.map((m) => (
                                                    <span key={m} className="badge badge-info text-xs capitalize">{m}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
}
