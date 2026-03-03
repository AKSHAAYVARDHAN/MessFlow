import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, parseISO, isAfter } from 'date-fns';
import Card from '../../components/Card';
import FeedbackModal from '../../components/FeedbackModal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { historyService } from '../../services/historyService';
import { feedbackService } from '../../services/feedbackService';
import { MEAL_ICONS } from '../../utils/constants';

/* ────────────────────────────────────────────────────────────────────────────
   Constants & helpers
─────────────────────────────────────────────────────────────────────────────*/
const PAGE_SIZE = 15;
const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2 };

const MEAL_WINDOW_END = {
    breakfast: { h: 9, m: 30 },
    lunch: { h: 14, m: 0 },
    dinner: { h: 21, m: 30 },
};

const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

/** Returns true if the meal window for a given date+type has already passed */
function mealWindowPassed(dateStr, mealType) {
    const end = MEAL_WINDOW_END[mealType];
    if (!end) return true;
    const cutoff = new Date(`${dateStr}T${String(end.h).padStart(2, '0')}:${String(end.m).padStart(2, '0')}:00`);
    return isAfter(new Date(), cutoff);
}

/** Returns true if a booking date+meal falls within any leave in the array */
function isOnLeave(leaves, dateStr, mealType) {
    for (const leave of leaves) {
        if (leave.from_date > dateStr || leave.to_date < dateStr) continue;
        const mealIdx = MEAL_ORDER[mealType];
        const fromIdx = MEAL_ORDER[leave.from_meal];
        const toIdx = MEAL_ORDER[leave.to_meal];

        if (leave.from_date === dateStr && leave.to_date === dateStr) {
            if (mealIdx >= fromIdx && mealIdx <= toIdx) return true;
        } else if (leave.from_date === dateStr) {
            if (mealIdx >= fromIdx) return true;
        } else if (leave.to_date === dateStr) {
            if (mealIdx <= toIdx) return true;
        } else {
            return true;
        }
    }
    return false;
}

/** Derive the display status for a booking row */
function deriveStatus(booking, leaves) {
    const { status, scanned_at, date, meal_type } = booking;

    if (status === 'cancelled') return 'cancelled';
    if (status === 'scanned' || scanned_at) return 'attended';
    if (status === 'no_show') return 'missed';

    // 'booked' but window passed → missed (unless on leave)
    if (status === 'booked' && mealWindowPassed(date, meal_type)) {
        if (isOnLeave(leaves, date, meal_type)) return 'on_leave';
        return 'missed';
    }
    if (isOnLeave(leaves, date, meal_type)) return 'on_leave';
    return status; // 'booked' (upcoming)
}

/* ────────────────────────────────────────────────────────────────────────────
   Status Badge component — redesigned with stronger colors and contrast
─────────────────────────────────────────────────────────────────────────────*/
const STATUS_CONFIG = {
    attended: {
        label: 'Attended', icon: '✅',
        bg: '#DCFCE7', color: '#15803D', border: '#86EFAC',
    },
    missed: {
        label: 'Missed', icon: '🚫',
        bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA',
    },
    cancelled: {
        label: 'Cancelled', icon: '❌',
        bg: '#F1F5F9', color: '#475569', border: '#CBD5E1',
    },
    on_leave: {
        label: 'On Leave', icon: '🏖️',
        bg: '#DBEAFE', color: '#1E40AF', border: '#93C5FD',
    },
    booked: {
        label: 'Upcoming', icon: '🔵',
        bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE',
    },
    no_show: {
        label: 'No Show', icon: '⚠️',
        bg: '#FEF3C7', color: '#92400E', border: '#FCD34D',
    },
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || { label: status, icon: '•', bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' };
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 9999,
                fontSize: '0.75rem',
                fontWeight: 700,
                background: cfg.bg,
                color: cfg.color,
                border: `1.5px solid ${cfg.border}`,
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
            }}
        >
            <span style={{ fontSize: '0.7rem' }}>{cfg.icon}</span>
            {cfg.label}
        </span>
    );
}

/* ────────────────────────────────────────────────────────────────────────────
   Summary stat card
─────────────────────────────────────────────────────────────────────────────*/
function SummaryStat({ icon, label, value, color, bg, border }) {
    return (
        <div
            style={{
                background: bg,
                border: `1.5px solid ${border}`,
                borderRadius: 14,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flex: '1 1 120px',
            }}
        >
            <div
                style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'rgba(255,255,255,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.25rem', flexShrink: 0,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
            >
                {icon}
            </div>
            <div>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</p>
                <p style={{ fontSize: '0.72rem', color, opacity: 0.75, marginTop: 2, fontWeight: 600 }}>{label}</p>
            </div>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────────
   Skeleton rows
─────────────────────────────────────────────────────────────────────────────*/
function SkeletonRow() {
    return (
        <tr>
            {[100, 130, 90, 75, 110, 60].map((w, i) => (
                <td key={i} style={{ padding: '14px 16px' }}>
                    <div className="skeleton rounded" style={{ height: 14, width: w }} />
                </td>
            ))}
        </tr>
    );
}

/* ────────────────────────────────────────────────────────────────────────────
   Filter Bar — redesigned compact
─────────────────────────────────────────────────────────────────────────────*/
function FilterBar({ filters, onApply }) {
    const [local, setLocal] = useState(filters);

    // Sync when parent resets
    useEffect(() => setLocal(filters), [filters]);

    const defaultFilters = { dateFrom: '', dateTo: '', mealType: 'all', status: 'all' };

    return (
        <div
            style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 14,
                padding: '16px 20px',
                marginBottom: 20,
            }}
        >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                {/* Date From */}
                <div style={{ flex: '1 1 130px' }}>
                    <label className="label" style={{ marginBottom: 4 }}>From</label>
                    <input
                        type="date"
                        className="input"
                        value={local.dateFrom}
                        onChange={e => setLocal(l => ({ ...l, dateFrom: e.target.value }))}
                    />
                </div>

                {/* Date To */}
                <div style={{ flex: '1 1 130px' }}>
                    <label className="label" style={{ marginBottom: 4 }}>To</label>
                    <input
                        type="date"
                        className="input"
                        value={local.dateTo}
                        onChange={e => setLocal(l => ({ ...l, dateTo: e.target.value }))}
                    />
                </div>

                {/* Meal Type */}
                <div style={{ flex: '1 1 130px' }}>
                    <label className="label" style={{ marginBottom: 4 }}>Meal Type</label>
                    <select
                        className="input"
                        value={local.mealType}
                        onChange={e => setLocal(l => ({ ...l, mealType: e.target.value }))}
                    >
                        <option value="all">All Meals</option>
                        <option value="breakfast">Breakfast</option>
                        <option value="lunch">Lunch</option>
                        <option value="dinner">Dinner</option>
                    </select>
                </div>

                {/* Status */}
                <div style={{ flex: '1 1 130px' }}>
                    <label className="label" style={{ marginBottom: 4 }}>Status</label>
                    <select
                        className="input"
                        value={local.status}
                        onChange={e => setLocal(l => ({ ...l, status: e.target.value }))}
                    >
                        <option value="all">All Statuses</option>
                        <option value="attended">Attended</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="missed">Missed</option>
                        <option value="no_show">No Show</option>
                        <option value="on_leave">On Leave</option>
                    </select>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingBottom: 0 }}>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => onApply(local)}
                    >
                        Apply
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setLocal(defaultFilters); onApply(defaultFilters); }}
                    >
                        Reset
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────────
   Pagination
─────────────────────────────────────────────────────────────────────────────*/
function Pagination({ page, total, onPage }) {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (totalPages <= 1) return null;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)',
        }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
                ← Previous
            </button>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                Page {page} of {totalPages}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>
                Next →
            </button>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────────
   Feedback cell sub-component
─────────────────────────────────────────────────────────────────────────────*/
function FeedbackCell({ feedback, derivedStatus, onRate }) {
    const [showComment, setShowComment] = useState(false);

    if (feedback) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Stars */}
                <span style={{ color: '#F59E0B', fontSize: '0.875rem', letterSpacing: 1 }} title={`${feedback.rating}/5`}>
                    {'★'.repeat(feedback.rating)}{'☆'.repeat(5 - feedback.rating)}
                </span>
                {feedback.comment && (
                    <button
                        onClick={() => setShowComment(s => !s)}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 600,
                            padding: 0, textAlign: 'left',
                        }}
                    >
                        {showComment ? 'Hide ▲' : '💬 View Comment'}
                    </button>
                )}
                {showComment && feedback.comment && (
                    <span
                        style={{
                            display: 'block', fontSize: '0.75rem',
                            color: 'var(--color-text-secondary)',
                            background: 'var(--color-bg)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 8, padding: '6px 10px',
                            maxWidth: 200, lineHeight: 1.5,
                        }}
                    >
                        {feedback.comment}
                    </span>
                )}
            </div>
        );
    }

    if (derivedStatus === 'attended') {
        return (
            <button
                onClick={onRate}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 8,
                    background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)',
                    border: '1.5px solid #FED7AA',
                    color: '#C2410C', fontSize: '0.75rem', fontWeight: 700,
                    cursor: 'pointer',
                }}
            >
                ⭐ Add Feedback
            </button>
        );
    }

    return <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>;
}

/* ────────────────────────────────────────────────────────────────────────────
   Main MealHistory Page
─────────────────────────────────────────────────────────────────────────────*/
export default function MealHistory() {
    const { user } = useAuth();
    const toast = useToast();

    /* ─── State ─── */
    const [rows, setRows] = useState([]);
    const [allRowsForStats, setAllRowsForStats] = useState([]); // unfiltered page rows for summary
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [appliedFilters, setAppliedFilters] = useState({ dateFrom: '', dateTo: '', mealType: 'all', status: 'all' });
    const [leaves, setLeaves] = useState([]);

    const [feedbackModal, setFeedbackModal] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [feedbackMap, setFeedbackMap] = useState({});

    /* ─── Fetch data ─── */
    const fetchHistory = useCallback(async (pg, fl) => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const dateFrom = fl.dateFrom || '2000-01-01';
            const dateTo = fl.dateTo || '2100-01-01';

            const [histResult, leaveData] = await Promise.all([
                historyService.getMealHistory(user.id, fl, pg),
                historyService.getLeavesForDateRange(user.id, dateFrom, dateTo),
            ]);

            setLeaves(leaveData);
            setTotal(histResult.count);

            // Build feedback map
            const fMap = {};
            histResult.data.forEach(row => {
                const fb = row.meal_feedback?.[0];
                if (fb) fMap[row.id] = fb;
            });
            setFeedbackMap(prev => ({ ...prev, ...fMap }));

            // Process rows
            const processed = histResult.data.map(row => ({
                ...row,
                derivedStatus: deriveStatus(row, leaveData),
            }));

            // Client-side status filter
            let final = processed;
            if (fl.status === 'missed') final = processed.filter(r => r.derivedStatus === 'missed');
            if (fl.status === 'on_leave') final = processed.filter(r => r.derivedStatus === 'on_leave');

            setAllRowsForStats(processed);
            setRows(final);
        } catch (err) {
            toast.error('Failed to load history', err.message || 'Please try again.');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchHistory(page, appliedFilters);
    }, [page, appliedFilters, fetchHistory]);

    function handleFilterApply(newFilters) {
        setAppliedFilters(newFilters);
        setPage(1);
    }

    /* ─── Summary stats (from all rows in current page/filter) ─── */
    const summary = useMemo(() => {
        const src = allRowsForStats;
        const attended = src.filter(r => r.derivedStatus === 'attended').length;
        const missed = src.filter(r => r.derivedStatus === 'missed').length;
        const cancelled = src.filter(r => r.derivedStatus === 'cancelled').length;
        const onLeave = src.filter(r => r.derivedStatus === 'on_leave').length;
        const total = attended + missed;
        const pct = total > 0 ? Math.round((attended / total) * 100) : null;
        return { attended, missed, cancelled, onLeave, pct, total: src.length };
    }, [allRowsForStats]);

    /* ─── Feedback submit ─── */
    async function handleSubmitFeedback(rating, comment) {
        if (!feedbackModal || submitting) return;
        const { bookingId, mealType } = feedbackModal;
        setSubmitting(true);
        try {
            const record = await feedbackService.submitFeedback(user.id, bookingId, mealType, rating, comment);
            setFeedbackMap(prev => ({ ...prev, [bookingId]: record }));
            toast.success('Feedback submitted!', 'Thank you for rating your meal.');
        } catch (err) {
            toast.error('Submission failed', err.message || 'Please try again.');
            throw err;
        } finally {
            setSubmitting(false);
        }
    }

    /* ─── Group rows by date ─── */
    const groupedByDate = useMemo(() => {
        const groups = {};
        rows.forEach(row => {
            if (!groups[row.date]) groups[row.date] = [];
            groups[row.date].push(row);
        });
        // Return sorted dates descending
        return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
    }, [rows]);

    /* ─── Format helpers ─── */
    function formatDate(dateStr) {
        try { return format(parseISO(dateStr), 'dd MMM yyyy'); }
        catch { return dateStr; }
    }

    function formatDayOfWeek(dateStr) {
        try { return format(parseISO(dateStr), 'EEEE'); }
        catch { return ''; }
    }

    function formatSlot(slotTime, mealType) {
        if (!slotTime) {
            if (mealType === 'breakfast') return <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>Auto-assigned</span>;
            return <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>No slot selected</span>;
        }
        return <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{slotTime.slice(0, 5)}</span>;
    }

    /* ─── Render ─── */
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="animate-fade-in">

            {/* Page Header */}
            <div className="page-header" style={{ marginBottom: 0 }}>
                <h1 className="page-title">My Meal History</h1>
                <p className="page-subtitle">View your past bookings, attendance status, and feedback</p>
            </div>

            {/* ── Summary Stats Header ── */}
            {!loading && allRowsForStats.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }} className="animate-fade-in">
                    <SummaryStat
                        icon="📋"
                        label="Total Meals"
                        value={summary.total}
                        color="#1E40AF"
                        bg="#EFF6FF"
                        border="#BFDBFE"
                    />
                    <SummaryStat
                        icon="✅"
                        label="Attended"
                        value={summary.attended}
                        color="#15803D"
                        bg="#F0FDF4"
                        border="#86EFAC"
                    />
                    <SummaryStat
                        icon="🚫"
                        label="Missed"
                        value={summary.missed}
                        color="#B91C1C"
                        bg="#FFF1F2"
                        border="#FECACA"
                    />
                    <SummaryStat
                        icon="❌"
                        label="Cancelled"
                        value={summary.cancelled}
                        color="#475569"
                        bg="#F8FAFC"
                        border="#CBD5E1"
                    />
                    {summary.pct !== null && (
                        <SummaryStat
                            icon="📈"
                            label="Attendance %"
                            value={`${summary.pct}%`}
                            color={summary.pct >= 75 ? '#15803D' : summary.pct >= 50 ? '#92400E' : '#B91C1C'}
                            bg={summary.pct >= 75 ? '#F0FDF4' : summary.pct >= 50 ? '#FFFBEB' : '#FFF1F2'}
                            border={summary.pct >= 75 ? '#86EFAC' : summary.pct >= 50 ? '#FCD34D' : '#FECACA'}
                        />
                    )}
                </div>
            )}

            {/* ── Filter Bar ── */}
            <FilterBar filters={appliedFilters} onApply={handleFilterApply} />

            {/* ── Table Card ── */}
            <Card noPad>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--color-bg)' }}>
                                {['Meal', 'Slot', 'Status', 'Feedback', 'Action'].map(h => (
                                    <th
                                        key={h}
                                        style={{
                                            padding: '12px 16px',
                                            textAlign: 'left',
                                            fontSize: '0.72rem',
                                            fontWeight: 800,
                                            color: 'var(--color-text-muted)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.07em',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={6}>
                                        <div style={{
                                            display: 'flex', flexDirection: 'column',
                                            alignItems: 'center', justifyContent: 'center',
                                            padding: '56px 24px', textAlign: 'center',
                                        }}>
                                            <div style={{ fontSize: '3rem', marginBottom: 12, opacity: 0.5 }}>📅</div>
                                            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                                                No meals found for selected range
                                            </p>
                                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', maxWidth: 280, lineHeight: 1.6 }}>
                                                Try adjusting your filters or expanding the date range.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                groupedByDate.map(([dateStr, dateRows]) => (
                                    <>
                                        {/* Date group divider */}
                                        <tr key={`group-${dateStr}`}>
                                            <td
                                                colSpan={5}
                                                style={{
                                                    padding: '8px 16px 6px',
                                                    background: 'var(--color-bg)',
                                                    borderTop: '1px solid var(--color-border)',
                                                    borderBottom: '1px solid var(--color-border)',
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-secondary)', letterSpacing: '-0.01em' }}>
                                                        {formatDate(dateStr)}
                                                    </span>
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                                        {formatDayOfWeek(dateStr)}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Rows for this date */}
                                        {dateRows.map((row) => {
                                            const derivedStatus = row.derivedStatus;
                                            const feedback = feedbackMap[row.id];

                                            return (
                                                <tr
                                                    key={row.id}
                                                    style={{
                                                        borderBottom: '1px solid var(--color-border)',
                                                        transition: 'background 0.15s',
                                                        cursor: 'default',
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,99,235,0.035)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    {/* Meal Type */}
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span
                                                                style={{
                                                                    width: 32, height: 32, borderRadius: 8,
                                                                    background: 'var(--color-bg)',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '1rem', flexShrink: 0,
                                                                    border: '1px solid var(--color-border)',
                                                                }}
                                                            >
                                                                {MEAL_ICONS[row.meal_type]}
                                                            </span>
                                                            <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.875rem' }}>
                                                                {MEAL_LABELS[row.meal_type]}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Slot */}
                                                    <td style={{ padding: '14px 16px' }}>
                                                        {formatSlot(row.slot_time, row.meal_type)}
                                                    </td>

                                                    {/* Status */}
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <StatusBadge status={derivedStatus} />
                                                    </td>

                                                    {/* Feedback */}
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <FeedbackCell
                                                            feedback={feedback}
                                                            derivedStatus={derivedStatus}
                                                            onRate={() => setFeedbackModal({ bookingId: row.id, mealType: row.meal_type })}
                                                        />
                                                    </td>

                                                    {/* Action — reserved for future row-level actions */}
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>—</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div style={{ padding: '0 16px 16px' }}>
                    <Pagination page={page} total={total} onPage={setPage} />
                </div>
            </Card>

            {/* Feedback Modal */}
            <FeedbackModal
                isOpen={!!feedbackModal}
                mealType={feedbackModal?.mealType}
                onClose={() => !submitting && setFeedbackModal(null)}
                onSubmit={handleSubmitFeedback}
                submitting={submitting}
            />
        </div>
    );
}
