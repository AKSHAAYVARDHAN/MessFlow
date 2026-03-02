import { useState, useEffect, useCallback } from 'react';
import Card from '../../components/Card';
import { leaveService } from '../../services/leaveService';
import { formatDate } from '../../utils/dateHelpers';
import { getToday } from '../../utils/dateHelpers';

const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2 };

// Check if a given meal on a given date falls within a leave
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

    // Count students on leave per meal for the selected date
    const breakfastCount = leaves.filter((l) => isMealOnLeave(l, filterDate, 'breakfast')).length;
    const lunchCount = leaves.filter((l) => isMealOnLeave(l, filterDate, 'lunch')).length;
    const dinnerCount = leaves.filter((l) => isMealOnLeave(l, filterDate, 'dinner')).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-text">Leave Monitor</h2>
                    <p className="text-sm text-text-secondary mt-0.5">
                        Students on approved leave — filter by date
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-text-secondary font-medium">Date:</label>
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="input text-sm py-1.5"
                    />
                    {filterDate !== today && (
                        <button
                            onClick={() => setFilterDate(today)}
                            className="btn btn-ghost btn-sm text-xs"
                        >
                            Today
                        </button>
                    )}
                </div>
            </div>

            {/* Per-meal summary stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Breakfast', icon: '☀️', count: breakfastCount, badgeClass: 'badge-warning' },
                    { label: 'Lunch', icon: '🍽️', count: lunchCount, badgeClass: 'badge-info' },
                    { label: 'Dinner', icon: '🌙', count: dinnerCount, badgeClass: 'badge-info' },
                ].map((stat) => (
                    <div key={stat.label} className="card">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{stat.icon}</span>
                            <div>
                                <p className="text-2xl font-bold text-text">
                                    {loading ? '—' : stat.count}
                                </p>
                                <p className="text-xs text-text-secondary">{stat.label} on Leave</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Leave Table */}
            <Card
                title={`Active Leaves on ${formatDate(filterDate)}`}
                icon="🏖️"
                badge={loading ? '…' : `${leaves.length} student${leaves.length !== 1 ? 's' : ''}`}
                badgeType={leaves.length > 0 ? 'badge-warning' : 'badge-muted'}
            >
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="skeleton h-14 w-full" />
                        ))}
                    </div>
                ) : leaves.length === 0 ? (
                    <div className="text-center py-10">
                        <div className="text-4xl mb-3">✅</div>
                        <p className="text-sm font-medium text-text">No leaves on this date</p>
                        <p className="text-xs text-text-muted mt-1">All students are available for meals.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="text-left py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Student</th>
                                        <th className="text-left py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Leave From</th>
                                        <th className="text-left py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Leave To</th>
                                        <th className="text-left py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Meals Affected</th>
                                        <th className="text-left py-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wide">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {leaves.map((leave) => {
                                        const meals = ['breakfast', 'lunch', 'dinner']
                                            .filter((m) => isMealOnLeave(leave, filterDate, m));

                                        const isPast = leave.to_date < today;

                                        return (
                                            <tr key={leave.id} className="hover:bg-surface-hover transition-colors">
                                                <td className="py-3 px-3">
                                                    <p className="font-medium text-text">{leave.users?.name || '—'}</p>
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
                                                    <div className="flex gap-1 flex-wrap">
                                                        {meals.length === 0 ? (
                                                            <span className="text-text-muted text-xs">None</span>
                                                        ) : meals.map((m) => (
                                                            <span key={m} className="badge badge-info text-xs capitalize">{m}</span>
                                                        ))}
                                                    </div>
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
                                const meals = ['breakfast', 'lunch', 'dinner']
                                    .filter((m) => isMealOnLeave(leave, filterDate, m));
                                const isPast = leave.to_date < today;

                                return (
                                    <div key={leave.id} className="p-3 rounded-lg border border-border bg-surface-hover">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="font-medium text-text text-sm">{leave.users?.name || '—'}</p>
                                                <p className="text-xs text-text-muted">{leave.users?.email}</p>
                                            </div>
                                            <span className={`badge text-xs ${isPast ? 'badge-muted' : 'badge-success'}`}>
                                                {isPast ? 'Completed' : 'Active'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-text-secondary">
                                            {formatDate(leave.from_date)} ({leave.from_meal}) → {formatDate(leave.to_date)} ({leave.to_meal})
                                        </p>
                                        {meals.length > 0 && (
                                            <div className="flex gap-1 flex-wrap mt-2">
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
