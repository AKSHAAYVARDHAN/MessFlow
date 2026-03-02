import { useState, useEffect, useCallback } from 'react';
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
const PAGE_SIZE = 10;
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
   Status Badge component
─────────────────────────────────────────────────────────────────────────────*/
const STATUS_BADGE_CONFIG = {
    attended: { label: 'Attended', cls: 'badge-success' },
    missed: { label: 'Missed', cls: 'badge-danger' },
    cancelled: { label: 'Cancelled', cls: 'badge-muted' },
    on_leave: { label: 'On Leave', cls: 'badge-info' },
    booked: { label: 'Upcoming', cls: 'badge-warning' },
    no_show: { label: 'No Show', cls: 'badge-danger' },
};

function StatusBadge({ status }) {
    const cfg = STATUS_BADGE_CONFIG[status] || { label: status, cls: 'badge-muted' };
    return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
}

/* ────────────────────────────────────────────────────────────────────────────
   Star display (read-only)
─────────────────────────────────────────────────────────────────────────────*/
function StarDisplay({ rating }) {
    return (
        <span className="text-amber-400 tracking-tight text-sm" title={`${rating}/5`}>
            {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
        </span>
    );
}

/* ────────────────────────────────────────────────────────────────────────────
   Skeleton row
─────────────────────────────────────────────────────────────────────────────*/
function SkeletonRow() {
    return (
        <tr>
            {[1, 2, 3, 4, 5, 6].map(i => (
                <td key={i} className="px-4 py-3">
                    <div className="skeleton h-4 rounded" style={{ width: i === 1 ? 90 : i === 5 ? 60 : 70 }} />
                </td>
            ))}
        </tr>
    );
}

/* ────────────────────────────────────────────────────────────────────────────
   Filter Bar
─────────────────────────────────────────────────────────────────────────────*/
function FilterBar({ filters, onChange }) {
    const { dateFrom, dateTo, mealType, status } = filters;

    return (
        <div className="flex flex-wrap gap-3 items-end" style={{ marginBottom: '1.5rem' }}>
            {/* Date From */}
            <div>
                <label className="label">From</label>
                <input
                    type="date"
                    className="input"
                    style={{ width: 150 }}
                    value={dateFrom}
                    onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
                />
            </div>
            {/* Date To */}
            <div>
                <label className="label">To</label>
                <input
                    type="date"
                    className="input"
                    style={{ width: 150 }}
                    value={dateTo}
                    onChange={e => onChange({ ...filters, dateTo: e.target.value })}
                />
            </div>
            {/* Meal Type */}
            <div>
                <label className="label">Meal Type</label>
                <select
                    className="input"
                    style={{ width: 150 }}
                    value={mealType}
                    onChange={e => onChange({ ...filters, mealType: e.target.value })}
                >
                    <option value="all">All Meals</option>
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                </select>
            </div>
            {/* Status */}
            <div>
                <label className="label">Status</label>
                <select
                    className="input"
                    style={{ width: 150 }}
                    value={status}
                    onChange={e => onChange({ ...filters, status: e.target.value })}
                >
                    <option value="all">All Statuses</option>
                    <option value="attended">Attended</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="missed">Missed</option>
                    <option value="no_show">No Show</option>
                    <option value="on_leave">On Leave</option>
                </select>
            </div>
            {/* Reset */}
            <button
                className="btn btn-ghost btn-sm"
                onClick={() => onChange({ dateFrom: '', dateTo: '', mealType: 'all', status: 'all' })}
            >
                Reset
            </button>
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
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <button
                className="btn btn-ghost btn-sm"
                onClick={() => onPage(page - 1)}
                disabled={page <= 1}
            >
                ← Previous
            </button>
            <span className="text-sm text-text-muted font-medium">
                Page {page} of {totalPages}
            </span>
            <button
                className="btn btn-ghost btn-sm"
                onClick={() => onPage(page + 1)}
                disabled={page >= totalPages}
            >
                Next →
            </button>
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────────
   Tooltip wrapper for feedback comment
─────────────────────────────────────────────────────────────────────────────*/
function CommentTooltip({ comment, children }) {
    const [show, setShow] = useState(false);
    if (!comment) return children;
    return (
        <span
            className="relative"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            {children}
            {show && (
                <span
                    className="absolute z-50 bottom-7 left-1/2 -translate-x-1/2 bg-text text-white text-xs rounded-lg px-3 py-2 shadow-xl"
                    style={{ minWidth: 180, maxWidth: 260, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
                >
                    {comment}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-text" />
                </span>
            )}
        </span>
    );
}

/* ────────────────────────────────────────────────────────────────────────────
   Main MealHistory Page
─────────────────────────────────────────────────────────────────────────────*/
export default function MealHistory() {
    const { user } = useAuth();
    const toast = useToast();

    /* ─── State ─── */
    const [rows, setRows] = useState([]);   // processed rows with derived status
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', mealType: 'all', status: 'all' });
    const [leaves, setLeaves] = useState([]);

    // Feedback modal state
    const [feedbackModal, setFeedbackModal] = useState(null); // { bookingId, mealType }
    const [submitting, setSubmitting] = useState(false);
    // Local map: bookingId → feedback record (for optimistic update)
    const [feedbackMap, setFeedbackMap] = useState({});

    /* ─── Fetch data ─── */
    const fetchHistory = useCallback(async (pg, fl) => {
        if (!user?.id) return;
        setLoading(true);
        try {
            // Determine date range for leave lookup
            const dateFrom = fl.dateFrom || '2000-01-01';
            const dateTo = fl.dateTo || '2100-01-01';

            const [histResult, leaveData] = await Promise.all([
                historyService.getMealHistory(user.id, fl, pg),
                historyService.getLeavesForDateRange(user.id, dateFrom, dateTo),
            ]);

            setLeaves(leaveData);
            setTotal(histResult.count);

            // Build feedback map from embedded join data
            const fMap = {};
            histResult.data.forEach(row => {
                const fb = row.meal_feedback?.[0]; // Supabase returns array for 1:many
                if (fb) fMap[row.id] = fb;
            });
            setFeedbackMap(prev => ({ ...prev, ...fMap }));

            // Process rows — attach derived status
            const processed = histResult.data.map(row => ({
                ...row,
                derivedStatus: deriveStatus(row, leaveData),
            }));

            // Client-side status filter for missed / on_leave
            let final = processed;
            if (fl.status === 'missed') final = processed.filter(r => r.derivedStatus === 'missed');
            if (fl.status === 'on_leave') final = processed.filter(r => r.derivedStatus === 'on_leave');

            setRows(final);
        } catch (err) {
            toast.error('Failed to load history', err.message || 'Please try again.');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchHistory(page, filters);
    }, [page, filters, fetchHistory]);

    /* ─── Filter change ─── */
    function handleFilterChange(newFilters) {
        setFilters(newFilters);
        setPage(1); // reset to first page
    }

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

    /* ─── Render ─── */
    return (
        <div className="space-y-8 animate-fade-in">
            {/* Page Header */}
            <div className="page-header">
                <h1 className="page-title">My Meal History</h1>
                <p className="page-subtitle">View your past bookings, attendance status, and feedback</p>
            </div>

            {/* Main Card */}
            <Card noPad>
                <div className="px-6 pt-5">
                    {/* Filter Bar */}
                    <FilterBar filters={filters} onChange={handleFilterChange} />
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1.5px solid var(--color-border)' }}>
                                {['Date', 'Meal', 'Slot', 'Status', 'Feedback', 'Action'].map(h => (
                                    <th
                                        key={h}
                                        style={{
                                            padding: '0.75rem 1rem',
                                            textAlign: 'left',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            color: 'var(--color-text-muted)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.06em',
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
                                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={6}>
                                        <div className="empty-state py-14">
                                            <div className="empty-state-icon">📜</div>
                                            <p className="empty-state-text">No meals recorded yet</p>
                                            <p className="empty-state-sub">
                                                Your meal bookings will appear here once you start booking meals.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row, idx) => {
                                    const isEven = idx % 2 === 0;
                                    const derivedStatus = row.derivedStatus;
                                    const feedback = feedbackMap[row.id];

                                    // Can submit feedback?
                                    const canRate =
                                        derivedStatus === 'attended' &&
                                        !feedback;

                                    // Format date
                                    const dateLabel = (() => {
                                        try { return format(parseISO(row.date), 'dd MMM yyyy'); }
                                        catch { return row.date; }
                                    })();

                                    // Slot label
                                    const slotLabel = row.slot_time
                                        ? row.slot_time.slice(0, 5)
                                        : <span className="text-text-muted">—</span>;

                                    return (
                                        <tr
                                            key={row.id}
                                            style={{
                                                backgroundColor: isEven ? 'transparent' : 'var(--color-surface-hover)',
                                                transition: 'background 0.15s',
                                                cursor: 'default',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(37,99,235,0.04)'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = isEven ? 'transparent' : 'var(--color-surface-hover)'}
                                        >
                                            {/* Date */}
                                            <td style={{ padding: '0.875rem 1rem', color: 'var(--color-text)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                {dateLabel}
                                            </td>

                                            {/* Meal Type */}
                                            <td style={{ padding: '0.875rem 1rem' }}>
                                                <span className="flex items-center gap-1.5 font-medium text-text-secondary">
                                                    <span>{MEAL_ICONS[row.meal_type]}</span>
                                                    <span>{MEAL_LABELS[row.meal_type]}</span>
                                                </span>
                                            </td>

                                            {/* Slot */}
                                            <td style={{ padding: '0.875rem 1rem', color: 'var(--color-text-secondary)' }}>
                                                {slotLabel}
                                            </td>

                                            {/* Status Badge */}
                                            <td style={{ padding: '0.875rem 1rem' }}>
                                                <StatusBadge status={derivedStatus} />
                                            </td>

                                            {/* Feedback display */}
                                            <td style={{ padding: '0.875rem 1rem' }}>
                                                {feedback ? (
                                                    <CommentTooltip comment={feedback.comment}>
                                                        <span className="flex items-center gap-1 cursor-default">
                                                            <StarDisplay rating={feedback.rating} />
                                                            {feedback.comment && (
                                                                <span className="text-xs text-text-muted ml-1" title={feedback.comment}>💬</span>
                                                            )}
                                                        </span>
                                                    </CommentTooltip>
                                                ) : derivedStatus === 'attended' ? (
                                                    <span className="text-xs text-text-muted">Not rated</span>
                                                ) : (
                                                    <span className="text-text-muted" style={{ fontSize: '0.75rem' }}>—</span>
                                                )}
                                            </td>

                                            {/* Action */}
                                            <td style={{ padding: '0.875rem 1rem' }}>
                                                {canRate ? (
                                                    <button
                                                        className="btn btn-xs"
                                                        style={{
                                                            background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)',
                                                            border: '1.5px solid #FED7AA',
                                                            color: '#C2410C',
                                                            fontWeight: 600,
                                                        }}
                                                        onClick={() => setFeedbackModal({ bookingId: row.id, mealType: row.meal_type })}
                                                    >
                                                        ⭐ Rate Now
                                                    </button>
                                                ) : (
                                                    <span className="text-text-muted" style={{ fontSize: '0.75rem' }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 pb-5">
                    <Pagination page={page} total={total} onPage={setPage} />
                </div>
            </Card>

            {/* Summary stats strip */}
            {!loading && rows.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Attended', val: rows.filter(r => r.derivedStatus === 'attended').length, color: '#16A34A', bg: '#DCFCE7', icon: '✅' },
                        { label: 'Missed', val: rows.filter(r => r.derivedStatus === 'missed').length, color: '#DC2626', bg: '#FEE2E2', icon: '⚠️' },
                        { label: 'Cancelled', val: rows.filter(r => r.derivedStatus === 'cancelled').length, color: '#64748B', bg: '#F1F5F9', icon: '❌' },
                        { label: 'On Leave', val: rows.filter(r => r.derivedStatus === 'on_leave').length, color: '#1E40AF', bg: '#DBEAFE', icon: '🏖️' },
                    ].map(({ label, val, color, bg, icon }) => (
                        <div
                            key={label}
                            className="card"
                            style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                        >
                            <div
                                style={{
                                    width: 40, height: 40, borderRadius: 10,
                                    background: bg, display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.125rem', flexShrink: 0,
                                }}
                            >
                                {icon}
                            </div>
                            <div>
                                <p style={{ fontSize: '1.375rem', fontWeight: 800, color, lineHeight: 1 }}>{val}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

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
