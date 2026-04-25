import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, parseISO, isAfter } from 'date-fns';
import FeedbackModal from '../../components/FeedbackModal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { historyService } from '../../services/historyService';
import { feedbackService } from '../../services/feedbackService';
import { MEAL_ICONS } from '../../utils/constants';

/* ─────────────────────────────────────────────────────────────────────────────
   Constants & helpers
───────────────────────────────────────────────────────────────────────────── */
const PAGE_SIZE = 15;
const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2 };
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

const MEAL_WINDOW_END = {
    breakfast: { h: 9,  m: 30 },
    lunch:     { h: 14, m: 0  },
    dinner:    { h: 21, m: 30 },
};

function mealWindowPassed(dateStr, mealType) {
    const end = MEAL_WINDOW_END[mealType];
    if (!end) return true;
    const cutoff = new Date(`${dateStr}T${String(end.h).padStart(2,'0')}:${String(end.m).padStart(2,'0')}:00`);
    return isAfter(new Date(), cutoff);
}

function isOnLeave(leaves, dateStr, mealType) {
    for (const leave of leaves) {
        if (leave.from_date > dateStr || leave.to_date < dateStr) continue;
        const mealIdx = MEAL_ORDER[mealType];
        const fromIdx = MEAL_ORDER[leave.from_meal];
        const toIdx   = MEAL_ORDER[leave.to_meal];
        if (leave.from_date === dateStr && leave.to_date === dateStr) {
            if (mealIdx >= fromIdx && mealIdx <= toIdx) return true;
        } else if (leave.from_date === dateStr) {
            if (mealIdx >= fromIdx) return true;
        } else if (leave.to_date === dateStr) {
            if (mealIdx <= toIdx) return true;
        } else { return true; }
    }
    return false;
}

function deriveStatus(booking, leaves) {
    const { status, scanned_at, date, meal_type } = booking;
    if (status === 'cancelled') return 'cancelled';
    if (status === 'scanned' || scanned_at) return 'attended';
    if (status === 'no_show') return 'missed';
    if (status === 'booked' && mealWindowPassed(date, meal_type)) {
        if (isOnLeave(leaves, date, meal_type)) return 'on_leave';
        return 'missed';
    }
    if (isOnLeave(leaves, date, meal_type)) return 'on_leave';
    return status;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Status badge config
───────────────────────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
    attended:  { label: 'Attended',  icon: '✅', bg: '#DCFCE7', color: '#15803D', border: '#86EFAC' },
    missed:    { label: 'Missed',    icon: '🚫', bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA' },
    cancelled: { label: 'Cancelled', icon: '❌', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
    on_leave:  { label: 'On Leave',  icon: '🏖️', bg: '#DBEAFE', color: '#1E40AF', border: '#93C5FD' },
    booked:    { label: 'Upcoming',  icon: '🔵', bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
    no_show:   { label: 'No Show',   icon: '⚠️', bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' },
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || { label: status, icon: '•', bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' };
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 9999,
            fontSize: '0.725rem', fontWeight: 700,
            background: cfg.bg, color: cfg.color,
            border: `1.5px solid ${cfg.border}`,
            whiteSpace: 'nowrap',
        }}>
            <span style={{ fontSize: '0.68rem' }}>{cfg.icon}</span>
            {cfg.label}
        </span>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Summary stat card
───────────────────────────────────────────────────────────────────────────── */
function SummaryStat({ icon, label, value, color, bg, border }) {
    return (
        <div style={{
            background: bg, border: `1.5px solid ${border}`,
            borderRadius: 14, padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: 12,
            flex: '1 1 120px',
        }}>
            <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'rgba(255,255,255,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.25rem', flexShrink: 0,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>{icon}</div>
            <div>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</p>
                <p style={{ fontSize: '0.72rem', color, opacity: 0.75, marginTop: 2, fontWeight: 600 }}>{label}</p>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Filter Bar
───────────────────────────────────────────────────────────────────────────── */
function FilterBar({ filters, onApply }) {
    const [local, setLocal] = useState(filters);
    useEffect(() => setLocal(filters), [filters]);
    const defaultFilters = { dateFrom: '', dateTo: '', mealType: 'all', status: 'all' };

    return (
        <div style={{
            background: 'white', border: '1px solid #E2E8F0',
            borderRadius: 14, padding: '16px 20px', marginBottom: 0,
        }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 130px' }}>
                    <label className="label" style={{ marginBottom: 4 }}>From</label>
                    <input type="date" className="input" value={local.dateFrom}
                        onChange={e => setLocal(l => ({ ...l, dateFrom: e.target.value }))} />
                </div>
                <div style={{ flex: '1 1 130px' }}>
                    <label className="label" style={{ marginBottom: 4 }}>To</label>
                    <input type="date" className="input" value={local.dateTo}
                        onChange={e => setLocal(l => ({ ...l, dateTo: e.target.value }))} />
                </div>
                <div style={{ flex: '1 1 130px' }}>
                    <label className="label" style={{ marginBottom: 4 }}>Meal Type</label>
                    <select className="input" value={local.mealType}
                        onChange={e => setLocal(l => ({ ...l, mealType: e.target.value }))}>
                        <option value="all">All Meals</option>
                        <option value="breakfast">Breakfast</option>
                        <option value="lunch">Lunch</option>
                        <option value="dinner">Dinner</option>
                    </select>
                </div>
                <div style={{ flex: '1 1 130px' }}>
                    <label className="label" style={{ marginBottom: 4 }}>Status</label>
                    <select className="input" value={local.status}
                        onChange={e => setLocal(l => ({ ...l, status: e.target.value }))}>
                        <option value="all">All Statuses</option>
                        <option value="attended">Attended</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="missed">Missed</option>
                        <option value="no_show">No Show</option>
                        <option value="on_leave">On Leave</option>
                    </select>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => onApply(local)}>Apply</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setLocal(defaultFilters); onApply(defaultFilters); }}>Reset</button>
                </div>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Pagination
───────────────────────────────────────────────────────────────────────────── */
function Pagination({ page, total, onPage }) {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (totalPages <= 1) return null;
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>← Previous</button>
            <span style={{ fontSize: '0.8125rem', color: '#94A3B8', fontWeight: 500 }}>Page {page} of {totalPages}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>Next →</button>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Feedback cell
───────────────────────────────────────────────────────────────────────────── */
function FeedbackCell({ feedback, derivedStatus, onRate }) {
    const [showComment, setShowComment] = useState(false);
    if (feedback) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ color: '#F59E0B', fontSize: '0.875rem', letterSpacing: 1 }}>
                    {'★'.repeat(feedback.rating)}{'☆'.repeat(5 - feedback.rating)}
                </span>
                {feedback.comment && (
                    <button onClick={() => setShowComment(s => !s)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '0.7rem', color: '#2563EB', fontWeight: 600, padding: 0, textAlign: 'left',
                    }}>
                        {showComment ? 'Hide ▲' : '💬 View'}
                    </button>
                )}
                {showComment && feedback.comment && (
                    <span style={{
                        display: 'block', fontSize: '0.75rem', color: '#475569',
                        background: '#F8FAFC', border: '1px solid #E2E8F0',
                        borderRadius: 8, padding: '5px 8px', maxWidth: 160, lineHeight: 1.5,
                    }}>{feedback.comment}</span>
                )}
            </div>
        );
    }
    if (derivedStatus === 'attended') {
        return (
            <button onClick={onRate} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 8,
                background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)',
                border: '1.5px solid #FED7AA', color: '#C2410C',
                fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                whiteSpace: 'nowrap',
            }}>⭐ Rate</button>
        );
    }
    return <span style={{ color: '#CBD5E1', fontSize: '0.8rem' }}>—</span>;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Skeleton card
───────────────────────────────────────────────────────────────────────────── */
function SkeletonCard() {
    return (
        <div style={{
            background: 'white', border: '1px solid #E2E8F0', borderRadius: 14,
            padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
        }}>
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="skeleton" style={{ height: 13, width: '40%', borderRadius: 6 }} />
                <div className="skeleton" style={{ height: 11, width: '25%', borderRadius: 6 }} />
            </div>
            <div className="skeleton" style={{ width: 72, height: 24, borderRadius: 9999 }} />
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   History Row Card
───────────────────────────────────────────────────────────────────────────── */
function HistoryCard({ row, feedback, onRate }) {
    const { derivedStatus } = row;
    const cfg = STATUS_CONFIG[derivedStatus] || STATUS_CONFIG.booked;

    const slotDisplay = row.slot_time
        ? row.slot_time.slice(0, 5)
        : row.meal_type === 'breakfast' ? 'Auto' : '—';

    return (
        <div style={{
            background: 'white',
            border: `1px solid #E2E8F0`,
            borderLeft: `4px solid ${cfg.border}`,
            borderRadius: 14,
            padding: '13px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            transition: 'box-shadow 0.18s, transform 0.18s',
        }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
        >
            {/* Meal icon pill */}
            <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: '#F8FAFC', border: '1px solid #E2E8F0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.125rem',
            }}>
                {MEAL_ICONS[row.meal_type]}
            </div>

            {/* Meal name + slot */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A', marginBottom: 2 }}>
                    {MEAL_LABELS[row.meal_type]}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 500 }}>
                    {slotDisplay !== '—' && slotDisplay !== 'Auto' ? `Slot ${slotDisplay}` : slotDisplay}
                </p>
            </div>

            {/* Status badge */}
            <StatusBadge status={derivedStatus} />

            {/* Feedback */}
            <div style={{ marginLeft: 4, flexShrink: 0 }}>
                <FeedbackCell
                    feedback={feedback}
                    derivedStatus={derivedStatus}
                    onRate={onRate}
                />
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main MealHistory Page
───────────────────────────────────────────────────────────────────────────── */
export default function MealHistory() {
    const { user } = useAuth();
    const toast    = useToast();

    const [rows, setRows]                   = useState([]);
    const [allRowsForStats, setAllRowsForStats] = useState([]);
    const [total, setTotal]                 = useState(0);
    const [loading, setLoading]             = useState(true);
    const [page, setPage]                   = useState(1);
    const [appliedFilters, setAppliedFilters] = useState({ dateFrom: '', dateTo: '', mealType: 'all', status: 'all' });
    const [leaves, setLeaves]               = useState([]);
    const [feedbackModal, setFeedbackModal] = useState(null);
    const [submitting, setSubmitting]       = useState(false);
    const [feedbackMap, setFeedbackMap]     = useState({});

    const fetchHistory = useCallback(async (pg, fl) => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const dateFrom = fl.dateFrom || '2000-01-01';
            const dateTo   = fl.dateTo   || '2100-01-01';
            const [histResult, leaveData] = await Promise.all([
                historyService.getMealHistory(user.id, fl, pg),
                historyService.getLeavesForDateRange(user.id, dateFrom, dateTo),
            ]);
            setLeaves(leaveData);
            setTotal(histResult.count);

            const fMap = {};
            histResult.data.forEach(r => {
                const fb = r.meal_feedback?.[0];
                if (fb) fMap[r.id] = fb;
            });
            setFeedbackMap(prev => ({ ...prev, ...fMap }));

            const processed = histResult.data.map(r => ({ ...r, derivedStatus: deriveStatus(r, leaveData) }));
            let final = processed;
            if (fl.status === 'missed')   final = processed.filter(r => r.derivedStatus === 'missed');
            if (fl.status === 'on_leave') final = processed.filter(r => r.derivedStatus === 'on_leave');
            setAllRowsForStats(processed);
            setRows(final);
        } catch (err) {
            toast.error('Failed to load history', err.message || 'Please try again.');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => { fetchHistory(page, appliedFilters); }, [page, appliedFilters, fetchHistory]);

    function handleFilterApply(newFilters) { setAppliedFilters(newFilters); setPage(1); }

    const summary = useMemo(() => {
        const src      = allRowsForStats;
        const attended  = src.filter(r => r.derivedStatus === 'attended').length;
        const missed    = src.filter(r => r.derivedStatus === 'missed').length;
        const cancelled = src.filter(r => r.derivedStatus === 'cancelled').length;
        const onLeave   = src.filter(r => r.derivedStatus === 'on_leave').length;
        const tot       = attended + missed;
        const pct       = tot > 0 ? Math.round((attended / tot) * 100) : null;
        return { attended, missed, cancelled, onLeave, pct, total: src.length };
    }, [allRowsForStats]);

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

    /* Group rows by date (descending) */
    const groupedByDate = useMemo(() => {
        const groups = {};
        rows.forEach(r => { if (!groups[r.date]) groups[r.date] = []; groups[r.date].push(r); });
        return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
    }, [rows]);

    function formatDateHeader(dateStr) {
        try {
            const d = parseISO(dateStr);
            return { date: format(d, 'dd MMM yyyy'), day: format(d, 'EEEE') };
        } catch { return { date: dateStr, day: '' }; }
    }

    /* ── Render ── */
    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Page Header */}
            <div className="page-header" style={{ marginBottom: 0 }}>
                <h1 className="page-title">My Meal History</h1>
                <p className="page-subtitle">View your past bookings, attendance status, and feedback</p>
            </div>

            {/* Summary Stats */}
            {!loading && allRowsForStats.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }} className="animate-fade-in">
                    <SummaryStat icon="📋" label="Total Meals"   value={summary.total}     color="#1E40AF" bg="#EFF6FF" border="#BFDBFE" />
                    <SummaryStat icon="✅" label="Attended"       value={summary.attended}  color="#15803D" bg="#F0FDF4" border="#86EFAC" />
                    <SummaryStat icon="🚫" label="Missed"         value={summary.missed}    color="#B91C1C" bg="#FFF1F2" border="#FECACA" />
                    <SummaryStat icon="❌" label="Cancelled"      value={summary.cancelled} color="#475569" bg="#F8FAFC" border="#CBD5E1" />
                    {summary.pct !== null && (
                        <SummaryStat
                            icon="📈" label="Attendance %"
                            value={`${summary.pct}%`}
                            color={summary.pct >= 75 ? '#15803D' : summary.pct >= 50 ? '#92400E' : '#B91C1C'}
                            bg={summary.pct >= 75 ? '#F0FDF4' : summary.pct >= 50 ? '#FFFBEB' : '#FFF1F2'}
                            border={summary.pct >= 75 ? '#86EFAC' : summary.pct >= 50 ? '#FCD34D' : '#FECACA'}
                        />
                    )}
                </div>
            )}

            {/* Filter Bar */}
            <FilterBar filters={appliedFilters} onApply={handleFilterApply} />

            {/* Card List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                ) : rows.length === 0 ? (
                    <div style={{
                        background: 'white', border: '1px solid #E2E8F0', borderRadius: 16,
                        padding: '56px 24px', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: 12, opacity: 0.45 }}>📅</div>
                        <p style={{ fontSize: '1rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                            No meals found for selected range
                        </p>
                        <p style={{ fontSize: '0.8125rem', color: '#94A3B8', maxWidth: 280, lineHeight: 1.6 }}>
                            Try adjusting your filters or expanding the date range.
                        </p>
                    </div>
                ) : (
                    groupedByDate.map(([dateStr, dateRows]) => {
                        const { date, day } = formatDateHeader(dateStr);
                        return (
                            <div key={dateStr} style={{ marginBottom: 20 }}>
                                {/* Date group header */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    marginBottom: 10, padding: '0 4px',
                                }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        background: '#F8FAFC', border: '1px solid #E2E8F0',
                                        borderRadius: 8, padding: '5px 12px',
                                    }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
                                            {date}
                                        </span>
                                        <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 500 }}>
                                            {day}
                                        </span>
                                    </div>
                                    <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
                                    <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 500, flexShrink: 0 }}>
                                        {dateRows.length} meal{dateRows.length !== 1 ? 's' : ''}
                                    </span>
                                </div>

                                {/* Cards for this date */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {dateRows.map(row => (
                                        <HistoryCard
                                            key={row.id}
                                            row={row}
                                            feedback={feedbackMap[row.id]}
                                            onRate={() => setFeedbackModal({ bookingId: row.id, mealType: row.meal_type })}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}

                {/* Pagination */}
                {!loading && rows.length > 0 && (
                    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 18px', marginTop: 4 }}>
                        <Pagination page={page} total={total} onPage={setPage} />
                    </div>
                )}
            </div>

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
