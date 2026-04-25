import { useState, useEffect, useCallback } from 'react';
import Card from '../../components/Card';
import QRDisplay from '../../components/QRDisplay';
import Modal from '../../components/Modal';
import FeedbackModal from '../../components/FeedbackModal';
import { useAuth } from '../../contexts/AuthContext';
import { useBookings } from '../../hooks/useBookings';
import { useRealtimeBookings } from '../../hooks/useRealtime';
import { useToast } from '../../components/Toast';
import { bookingService } from '../../services/bookingService';
import { leaveService } from '../../services/leaveService';
import { announcementService } from '../../services/announcementService';
import { menuService } from '../../services/menuService';
import { feedbackService } from '../../services/feedbackService';
import { supabase } from '../../services/supabase';
import { MEAL_ICONS, CANCELLATION_DEADLINES } from '../../utils/constants';
import { getToday, canCancelMeal, getTimeRemaining, getCancellationDeadlineLabel, formatDate, getBookingDate, isTomorrowBooking } from '../../utils/dateHelpers';
import { isMealClosed, secondsUntilCutoff, formatCountdown } from '../../utils/bookingTime';
import { format } from 'date-fns';
import { NavLink } from 'react-router-dom';

const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2 };
const MEAL_SEQUENCE = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const MEAL_ICON_MAP = { breakfast: '☀️', lunch: '🍽️', dinner: '🌙' };

function parseMenuItems(text) {
    return (text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

// ─── Booking Cut-Off Helper ───────────────────────────────────────────────────
// In tomorrow-booking mode (past 8:30 PM) ALL meals for tomorrow are open.
// In today-booking mode, apply normal per-meal cutoff via central bookingTime helper.
function isBookingOpen(mealType, tomorrowMode) {
    if (tomorrowMode) return true;
    return !isMealClosed(mealType);
}

// ─── Booking Countdown Timer ─────────────────────────────────────────────────
function BookingCountdown({ mealType, tomorrowMode }) {
    const [secs, setSecs] = useState(() => secondsUntilCutoff(mealType));

    useEffect(() => {
        const timer = setInterval(() => setSecs(secondsUntilCutoff(mealType)), 1000);
        return () => clearInterval(timer);
    }, [mealType]);

    if (tomorrowMode || secs <= 0) return null;

    const isUrgent   = secs < 900;
    const isCritical = secs < 300;
    // Max window: 3h = 10800s; cap progress at 100%
    const totalWindow = mealType === 'breakfast' ? 5400 : mealType === 'lunch' ? 9000 : 10800;
    const pct = Math.min(100, Math.round((secs / totalWindow) * 100));

    const bg      = isCritical ? '#FEE2E2' : isUrgent ? '#FEF3C7' : '#EFF6FF';
    const color   = isCritical ? '#B91C1C' : isUrgent ? '#92400E' : '#1E40AF';
    const border  = isCritical ? '#FECACA' : isUrgent ? '#FCD34D' : '#BFDBFE';
    const barColor = isCritical ? '#EF4444' : isUrgent ? '#F59E0B' : '#3B82F6';

    return (
        <div style={{
            background: bg, border: `1.5px solid ${border}`,
            borderRadius: 10, padding: '8px 12px', width: '100%',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <span style={{ fontSize: '0.8rem' }}>⏱</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color, flex: 1 }}>
                    Closes in <strong style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{formatCountdown(secs)}</strong>
                </span>
            </div>
            <div style={{ height: 4, borderRadius: 9999, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <div style={{
                    height: '100%', borderRadius: 9999,
                    width: `${pct}%`,
                    background: barColor,
                    transition: 'width 1s linear',
                }} />
            </div>
        </div>
    );
}

// ─── Countdown Timer ─────────────────────────────────────────────────────────
function Countdown({ mealType }) {
    const [remaining, setRemaining] = useState(() => getTimeRemaining(CANCELLATION_DEADLINES[mealType]));

    useEffect(() => {
        const interval = setInterval(() => {
            setRemaining(getTimeRemaining(CANCELLATION_DEADLINES[mealType]));
        }, 1000);
        return () => clearInterval(interval);
    }, [mealType]);

    if (!remaining) return null;

    const isUrgent = remaining.total < 900;
    const isCritical = remaining.total < 300;

    return (
        <div className={`text-center py-2 px-3 rounded-xl text-xs ${isCritical ? 'bg-danger/10 border border-danger/20' :
            isUrgent ? 'bg-warning/10 border border-warning/20' :
                'bg-surface-hover border border-border'
            }`}>
            <p className="text-text-muted mb-0.5 font-medium">Cancellation closes in</p>
            <p className={`font-mono font-bold text-sm tracking-wider ${isCritical ? 'text-danger' :
                isUrgent ? 'text-warning' :
                    'text-text'
                }`}>
                {remaining.display}
            </p>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TodayStatus() {
    const { user, profile, refreshProfile } = useAuth();

    // ── Booking date resolution (next-day logic) ───────────────────────────────
    const isTomorrow = isTomorrowBooking();
    const bookingDate = getBookingDate(); // 'yyyy-MM-dd' — today or tomorrow

    const { bookings, loading, refetch, getBookingByMeal } = useBookings(bookingDate);
    const toast = useToast();
    const [announcements, setAnnouncements] = useState([]);
    const [todayMenus, setTodayMenus] = useState([]);
    const [toggling, setToggling] = useState(false);
    const [activeLeave, setActiveLeave] = useState(null);
    const [leaveLoading, setLeaveLoading] = useState(true);

    const [bookModal, setBookModal] = useState(null);
    const [bookingMeal, setBookingMeal] = useState(null);
    const [cancelModal, setCancelModal] = useState(null);
    const [cancellingMeal, setCancellingMeal] = useState(null);

    // Feedback
    const [feedbackModal, setFeedbackModal] = useState(null); // { bookingId, mealType }
    const [feedbackMap, setFeedbackMap] = useState({});       // bookingId -> feedback record
    const [submittingFeedback, setSubmittingFeedback] = useState(false);

    const today = getToday(); // always the ACTUAL current day (for leave / menus / announcements)

    useRealtimeBookings(bookingDate, () => refetch());

    useEffect(() => {
        announcementService.getAnnouncementsByDate(today).then(setAnnouncements).catch(console.error);
        menuService.getTodayMenus().then(setTodayMenus).catch(console.error);
    }, [today]);

    // ── Auto-book dinner at midnight ───────────────────────────────────────────
    // If auto_booking_enabled, create a dinner booking for tomorrow at midnight.
    useEffect(() => {
        if (!profile?.default_booking_enabled) return;

        async function autoBookDinner() {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateStr = tomorrow.toISOString().split('T')[0];

            try {
                const { data: existing, error: fetchErr } = await supabase
                    .from('bookings')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('date', dateStr)
                    .eq('meal_type', 'dinner');

                if (fetchErr) throw fetchErr;

                if (!existing || existing.length === 0) {
                    const { error: insertErr } = await supabase.from('bookings').insert({
                        user_id: user.id,
                        meal_type: 'dinner',
                        date: dateStr,
                        status: 'booked',
                    });
                    if (insertErr) throw insertErr;
                    toast.success('Dinner Auto-Booked!', `Dinner for tomorrow (${dateStr}) booked automatically.`);
                    await refetch();
                }
            } catch (err) {
                console.error('Auto-book dinner failed:', err);
            }
        }

        // Schedule auto-book to run at midnight
        const now = new Date();
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0); // next midnight
        const msUntilMidnight = midnight - now;

        const timeout = setTimeout(() => {
            autoBookDinner();
        }, msUntilMidnight);

        return () => clearTimeout(timeout);
    }, [profile?.default_booking_enabled, user.id]);

    useEffect(() => {
        async function checkLeave() {
            try {
                setLeaveLoading(true);
                const leave = await leaveService.getActiveLeaveForToday(user.id);
                setActiveLeave(leave);
            } catch (err) {
                console.error('Failed to check leave:', err);
            } finally {
                setLeaveLoading(false);
            }
        }
        checkLeave();
    }, [user.id]);

    // Load existing feedback whenever today's bookings change
    useEffect(() => {
        const attendedIds = bookings
            .filter(b => b.status === 'scanned')
            .map(b => b.id);
        if (attendedIds.length === 0) { setFeedbackMap({}); return; }
        feedbackService.getFeedbackForBookingIds(attendedIds)
            .then(records => {
                const map = {};
                records.forEach(r => { map[r.booking_id] = r; });
                setFeedbackMap(map);
            })
            .catch(console.error);
    }, [bookings]);

    function isMealOnLeave(mealType) {
        if (!activeLeave) return false;
        const mealIdx = MEAL_ORDER[mealType];
        const fromIdx = MEAL_ORDER[activeLeave.from_meal];
        const toIdx = MEAL_ORDER[activeLeave.to_meal];
        if (activeLeave.from_date === today && activeLeave.to_date === today) {
            return mealIdx >= fromIdx && mealIdx <= toIdx;
        }
        if (activeLeave.from_date === today) return mealIdx >= fromIdx;
        if (activeLeave.to_date === today) return mealIdx <= toIdx;
        return true;
    }

    function requestBookMeal(mealType) { setBookModal({ mealType }); }

    async function confirmBookMeal() {
        if (!bookModal || bookingMeal) return;
        const { mealType } = bookModal;

        // Guard: prevent API call if booking window has closed
        if (!isBookingOpen(mealType, isTomorrow)) {
            toast.error('Booking Closed', 'The booking time for this meal has passed.');
            setBookModal(null);
            return;
        }

        setBookingMeal(mealType);
        setBookModal(null);
        try {
            await bookingService.createBooking(user.id, bookingDate, mealType);
            toast.success(`${mealType.charAt(0).toUpperCase() + mealType.slice(1)} booked!`, 'Your QR code is ready.');
            await refetch();
        } catch (err) {
            toast.error('Booking failed', err.message || 'Please try again.');
        } finally {
            setBookingMeal(null);
        }
    }

    function requestCancelMeal(bookingId, mealType) {
        if (!canCancelMeal(mealType)) return;
        setCancelModal({ bookingId, mealType });
    }

    async function confirmCancelMeal() {
        if (!cancelModal || cancellingMeal) return;
        const { bookingId, mealType } = cancelModal;
        setCancellingMeal(mealType);
        setCancelModal(null);
        try {
            await bookingService.cancelBooking(bookingId, mealType);
            toast.success('Booking cancelled', `Your ${mealType} booking has been removed.`);
            await refetch();
        } catch (err) {
            toast.error('Cancellation failed', err.message || 'Please try again.');
        } finally {
            setCancellingMeal(null);
        }
    }

    async function handleSubmitFeedback(rating, comment) {
        if (!feedbackModal || submittingFeedback) return;
        const { bookingId, mealType } = feedbackModal;
        setSubmittingFeedback(true);
        try {
            const record = await feedbackService.submitFeedback(
                user.id, bookingId, mealType, rating, comment
            );
            // Update local map so the button turns into "Thank you"
            setFeedbackMap(prev => ({ ...prev, [bookingId]: record }));
            toast.success('Feedback submitted!', 'Thank you for rating your meal.');
        } catch (err) {
            toast.error('Submission failed', err.message || 'Please try again.');
            throw err; // Let modal know to stay open
        } finally {
            setSubmittingFeedback(false);
        }
    }

    async function handleToggleDefault() {
        if (!profile) return;
        setToggling(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({ default_booking_enabled: !profile.default_booking_enabled })
                .eq('id', user.id);
            if (error) throw error;
            await refreshProfile();
        } catch (err) {
            console.error('Toggle failed:', err);
        } finally {
            setToggling(false);
        }
    }

    const meals = ['breakfast', 'lunch', 'dinner'];
    const MEAL_NAMES = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
    const MEAL_DEADLINE_LABELS = {
        breakfast: getCancellationDeadlineLabel('breakfast'),
        lunch: getCancellationDeadlineLabel('lunch'),
        dinner: getCancellationDeadlineLabel('dinner'),
    };

    const menuMap = {};
    // Normalize DB meal_type ('Breakfast') to lowercase so MEAL_SEQUENCE lookups work
    todayMenus.forEach((m) => (menuMap[m.meal_type.toLowerCase()] = m));
    const hasMenu = todayMenus.length > 0;

    const importantAnn = announcements.filter((a) => a.is_important);
    const regularAnn = announcements.filter((a) => !a.is_important);

    return (
        <div className="space-y-6 animate-fade-in">

            {/* ── TOP SECTION: Summary + Auto Booking ── */}
            <div className="flex flex-col sm:flex-row gap-4">
                {/* Date + booking mode banner */}
                <div
                    className="card flex-1 flex items-center gap-4"
                    style={{
                        background: isTomorrow
                            ? 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)'
                            : 'linear-gradient(135deg, #EFF6FF 0%, #EEF2FF 100%)',
                        borderColor: isTomorrow ? '#86EFAC' : '#BFDBFE',
                        borderWidth: 1.5,
                    }}
                >
                    <div style={{
                        width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                        background: isTomorrow ? '#DCFCE7' : '#DBEAFE',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
                    }}>
                        {isTomorrow ? '🌙' : '📅'}
                    </div>
                    <div style={{ flex: 1 }}>
                        {/* Today / Tomorrow tab indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{
                                fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                color: isTomorrow ? '#15803D' : '#2563EB',
                                background: isTomorrow ? '#DCFCE7' : '#DBEAFE',
                                border: `1px solid ${isTomorrow ? '#86EFAC' : '#93C5FD'}`,
                                borderRadius: 6, padding: '2px 8px',
                            }}>
                                {isTomorrow ? '🌙 Tomorrow' : '📅 Today'}
                            </span>
                            <span style={{
                                fontSize: '0.7rem', fontWeight: 600,
                                color: isTomorrow ? '#15803D' : '#2563EB',
                            }}>
                                {isTomorrow ? 'Booking open for tomorrow' : 'Booking open now'}
                            </span>
                        </div>
                        <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>
                            {format(new Date(bookingDate + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
                        </p>
                        <p style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: 2 }}>
                            {bookings.filter(b => b.status !== 'cancelled').length} of 3 meals booked
                        </p>
                    </div>
                </div>

                {/* Auto Booking Toggle */}
                <div className="card flex flex-col gap-3" style={{ minWidth: '220px' }}>
                    <div className="flex items-center gap-3">
                        <div style={{
                            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                            background: 'rgba(37,99,235,0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem',
                        }}>🔄</div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0F172A' }}>Auto Booking</p>
                            <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 2 }}>
                                {profile?.default_booking_enabled ? 'Active — auto-booked nightly' : 'Off — book manually'}
                            </p>
                        </div>
                        <button
                            onClick={handleToggleDefault}
                            disabled={
                                toggling ||
                                !profile?.default_booking_enabled ||
                                (profile?.default_disabled_until && new Date(profile.default_disabled_until) > new Date())
                            }
                            className={`toggle ${profile?.default_booking_enabled ? 'active' : ''}`}
                            title={!profile?.default_booking_enabled ? 'Disabled by admin due to no-shows' : ''}
                        />
                    </div>
                    {profile && !profile.default_booking_enabled && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 12px', borderRadius: 10,
                            background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)',
                        }}>
                            <span style={{ fontSize: '0.875rem', flexShrink: 0 }}>⚠️</span>
                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#DC2626', lineHeight: 1.4 }}>
                                Disabled — {profile.no_show_count || 3}+ no-shows. Contact admin.
                            </p>
                        </div>
                    )}
                    {profile && profile.default_booking_enabled && (profile.no_show_count || 0) >= 2 && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 12px', borderRadius: 10,
                            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                        }}>
                            <span style={{ fontSize: '0.875rem', flexShrink: 0 }}>⚠️</span>
                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#D97706', lineHeight: 1.4 }}>
                                {profile.no_show_count} no-show{profile.no_show_count !== 1 ? 's' : ''}. 1 more disables auto-booking.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Active Leave Banner */}
            {!leaveLoading && activeLeave && (
                <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    padding: '14px 18px', borderRadius: 16,
                    background: 'linear-gradient(135deg, #EFF6FF, #EEF2FF)',
                    border: '1.5px solid #BFDBFE',
                }}>
                    <span style={{ fontSize: '1.5rem', flexShrink: 0, marginTop: 2 }}>🏖️</span>
                    <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1E40AF' }}>You are currently on leave</p>
                        <p style={{ fontSize: '0.8125rem', color: '#475569', marginTop: 3 }}>
                            From <strong style={{ color: '#0F172A' }}>{formatDate(activeLeave.from_date)}</strong> ({activeLeave.from_meal}) to{' '}
                            <strong style={{ color: '#0F172A' }}>{formatDate(activeLeave.to_date)}</strong> ({activeLeave.to_meal}).
                            Booking is disabled for affected meals.
                        </p>
                    </div>
                </div>
            )}

            {/* ── MEAL CARDS SECTION ── */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h3 className="section-title">{isTomorrow ? "Tomorrow's Meals" : "Today's Meals"}</h3>
                        <span style={{
                            fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                            padding: '3px 9px', borderRadius: 6,
                            background: isTomorrow ? '#DCFCE7' : '#DBEAFE',
                            color: isTomorrow ? '#15803D' : '#1E40AF',
                            border: `1px solid ${isTomorrow ? '#86EFAC' : '#93C5FD'}`,
                        }}>
                            {isTomorrow ? 'Tomorrow' : 'Today'}
                        </span>
                    </div>
                    <span style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>
                        {bookings.filter(b => b.status === 'booked').length} booked
                    </span>
                </div>
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="card">
                                <div className="skeleton h-6 w-24 mb-4 rounded-lg" />
                                <div className="skeleton h-44 w-full rounded-xl" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {meals.map((meal) => {
                            const booking = getBookingByMeal(meal);
                            const canCancel = canCancelMeal(meal);
                            const isBooking = bookingMeal === meal;
                            const isCancelling = cancellingMeal === meal;
                            const onLeave = isMealOnLeave(meal);
                            const bookingOpen = isBookingOpen(meal, isTomorrow);

                            const statusBadge = onLeave ? 'On Leave' :
                                isCancelling ? 'Cancelling…' :
                                    isBooking ? 'Booking…' :
                                        booking ? booking.status :
                                            bookingOpen ? 'Open' : 'Closed';

                            const badgeType = onLeave ? 'badge-info' :
                                booking?.status === 'booked' ? 'badge-success' :
                                    booking?.status === 'scanned' ? 'badge-info' :
                                        isCancelling || isBooking ? 'badge-warning' :
                                            bookingOpen ? 'badge-success' : 'badge-muted';

                            return (
                                <Card
                                    key={meal}
                                    icon={MEAL_ICONS[meal]}
                                    title={MEAL_NAMES[meal]}
                                    badge={statusBadge}
                                    badgeType={badgeType}
                                    className="flex flex-col"
                                >
                                    <div className="flex-1">
                                        {onLeave ? (
                                            <div className="flex flex-col items-center justify-center py-8 space-y-2">
                                                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl mb-1">🏖️</div>
                                                <p className="text-sm font-semibold text-primary">On Leave</p>
                                                <p className="text-xs text-text-muted text-center">Booking unavailable during your leave period</p>
                                            </div>
                                        ) : booking && booking.status === 'booked' ? (
                                            <div className="space-y-3">
                                                <div className="flex justify-center py-2">
                                                    <QRDisplay
                                                        value={booking.qr_code}
                                                        size={120}
                                                        label={booking.slot_time ? `Slot: ${booking.slot_time}` : 'Valid for full duration'}
                                                    />
                                                </div>
                                                {canCancel ? (
                                                    <div className="space-y-2">
                                                        <Countdown mealType={meal} />
                                                        <button
                                                            onClick={() => requestCancelMeal(booking.id, meal)}
                                                            disabled={isCancelling}
                                                            className="btn btn-danger btn-sm w-full"
                                                        >
                                                            {isCancelling ? (
                                                                <span className="flex items-center justify-center gap-2">
                                                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                                    Cancelling…
                                                                </span>
                                                            ) : 'Cancel Meal'}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-surface-hover border border-border">
                                                        <span className="text-base">🔒</span>
                                                        <div>
                                                            <p className="text-xs font-semibold text-text-secondary">Cancellation Closed</p>
                                                            <p className="text-xs text-text-muted">Deadline was {MEAL_DEADLINE_LABELS[meal]}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : booking?.status === 'scanned' ? (
                                            <div className="flex flex-col items-center justify-center py-6 space-y-3">
                                                <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center text-3xl mb-1">✅</div>
                                                <p className="text-sm font-semibold text-success">Meal Scanned</p>
                                                <p className="text-xs text-text-muted">Enjoy your {meal}!</p>
                                                {/* Feedback CTA */}
                                                {feedbackMap[booking.id] ? (
                                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200">
                                                        <span className="text-sm">⭐</span>
                                                        <span className="text-xs font-semibold text-amber-700">{'★'.repeat(feedbackMap[booking.id].rating)} rated</span>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setFeedbackModal({ bookingId: booking.id, mealType: meal })}
                                                        className="btn btn-sm"
                                                        style={{
                                                            background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)',
                                                            border: '1.5px solid #FED7AA',
                                                            color: '#C2410C',
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        <span>⭐</span>
                                                        Rate This Meal
                                                    </button>
                                                )}
                                            </div>
                                        ) : booking?.status === 'no_show' ? (
                                            <div className="flex flex-col items-center justify-center py-8 space-y-2">
                                                <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-3xl mb-1">⚠️</div>
                                                <p className="text-sm font-semibold text-danger">No Show</p>
                                                <p className="text-xs text-text-muted">You missed this meal</p>
                                            </div>
                                        ) : bookingOpen ? (
                                            <div className="flex flex-col items-center justify-center py-8 space-y-3">
                                                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-3xl mb-1">🍴</div>
                                                <p className="text-sm text-text-secondary">No booking yet</p>
                                                <BookingCountdown mealType={meal} tomorrowMode={isTomorrow} />
                                                <button
                                                    onClick={() => requestBookMeal(meal)}
                                                    disabled={isBooking}
                                                    className="btn btn-primary btn-sm"
                                                >
                                                    {isBooking ? (
                                                        <span className="flex items-center gap-2">
                                                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                            Booking…
                                                        </span>
                                                    ) : 'Book Now'}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-8 space-y-2">
                                                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-1">🔒</div>
                                                <p className="text-sm font-semibold text-text-secondary">Booking Closed</p>
                                                <p className="text-xs text-text-muted text-center px-2">The booking window for this meal has passed.</p>
                                                <button
                                                    disabled
                                                    className="btn btn-sm opacity-40 cursor-not-allowed"
                                                    style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                                                >
                                                    Booking Closed
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── THIRD SECTION: Menu Preview + Announcements Preview ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Today's Menu Preview */}
                <Card title="Today's Menu" icon="🍴">
                    {todayMenus.length === 0 ? (
                        <div className="empty-state py-6">
                            <div className="empty-state-icon">🥗</div>
                            <p className="empty-state-text">Menu not available</p>
                            <p className="empty-state-sub">Check back once the admin updates today's menu.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {MEAL_SEQUENCE.map((meal) => {
                                const m = menuMap[meal];
                                const items = m ? parseMenuItems(m.items) : [];
                                return (
                                    <div key={meal} className="flex gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center text-base flex-shrink-0">
                                            {MEAL_ICON_MAP[meal]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-text">{MEAL_LABEL[meal]}</p>
                                            {items.length > 0 ? (
                                                <p className="text-xs text-text-secondary truncate-2 mt-0.5">
                                                    {items.join(' · ')}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-text-muted mt-0.5 italic">Menu not available</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>

                {/* Recent Announcements Preview */}
                <Card
                    title="Announcements"
                    icon="📢"
                    action={
                        <NavLink to="/student/announcements" className="btn btn-ghost btn-xs text-primary">
                            See all →
                        </NavLink>
                    }
                >
                    {announcements.length === 0 ? (
                        <div className="empty-state py-6">
                            <div className="empty-state-icon">📭</div>
                            <p className="empty-state-text">No announcements today</p>
                            <p className="empty-state-sub">You're all caught up!</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {[...importantAnn, ...regularAnn].slice(0, 4).map((ann) => (
                                <div
                                    key={ann.id}
                                    className={`flex items-start gap-3 p-3 rounded-xl ${ann.is_important
                                        ? 'bg-amber-50 border border-amber-200'
                                        : 'bg-surface-hover border border-border'
                                        }`}
                                >
                                    <span className="text-base flex-shrink-0 mt-0.5">
                                        {ann.is_important ? '⭐' : '📌'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-semibold truncate ${ann.is_important ? 'text-amber-900' : 'text-text'}`}>
                                            {ann.title}
                                        </p>
                                        {ann.description && (
                                            <p className="text-xs text-text-secondary truncate mt-0.5">{ann.description}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {/* ── Book Confirmation Modal ── */}
            <Modal isOpen={!!bookModal} onClose={() => !bookingMeal && setBookModal(null)} title="Confirm Booking">
                <div className="space-y-5">
                    <div className="bg-surface-hover rounded-xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-text-muted font-medium">Meal</span>
                            <span className="font-semibold text-text">
                                {bookModal && MEAL_ICONS[bookModal.mealType]} {bookModal && MEAL_NAMES[bookModal.mealType]}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-text-muted font-medium">Date</span>
                            <span className="font-semibold text-text">
                                {format(new Date(bookingDate + 'T12:00:00'), 'EEE, MMM dd, yyyy')}
                                {isTomorrow && <span className="ml-1.5 text-xs font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-md">Tomorrow</span>}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setBookModal(null)} disabled={!!bookingMeal} className="btn btn-secondary flex-1">
                            Cancel
                        </button>
                        <button onClick={confirmBookMeal} disabled={!!bookingMeal} className="btn btn-primary flex-1">
                            Confirm Booking
                        </button>
                    </div>
                </div>
            </Modal>

            {/* ── Cancel Confirmation Modal ── */}
            <Modal isOpen={!!cancelModal} onClose={() => !cancellingMeal && setCancelModal(null)} title="Cancel This Meal?">
                <div className="space-y-5">
                    <div className="bg-danger/5 border border-danger/15 rounded-xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-text-muted font-medium">Meal</span>
                            <span className="font-semibold text-text">
                                {cancelModal && MEAL_ICONS[cancelModal.mealType]} {cancelModal && MEAL_NAMES[cancelModal.mealType]}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-text-muted font-medium">Date</span>
                            <span className="font-semibold text-text">
                                {format(new Date(bookingDate + 'T12:00:00'), 'EEE, MMM dd, yyyy')}
                                {isTomorrow && <span className="ml-1.5 text-xs font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-md">Tomorrow</span>}
                            </span>
                        </div>
                    </div>
                    <p className="text-sm text-text-secondary text-center">
                        ⚠️ This action cannot be undone. The meal will be marked as cancelled.
                    </p>
                    <div className="flex gap-3">
                        <button onClick={() => setCancelModal(null)} disabled={!!cancellingMeal} className="btn btn-primary flex-1">
                            Keep Meal
                        </button>
                        <button onClick={confirmCancelMeal} disabled={!!cancellingMeal} className="btn btn-danger flex-1">
                            Yes, Cancel
                        </button>
                    </div>
                </div>
            </Modal>

            {/* ── Feedback Modal ── */}
            <FeedbackModal
                isOpen={!!feedbackModal}
                mealType={feedbackModal?.mealType}
                onClose={() => !submittingFeedback && setFeedbackModal(null)}
                onSubmit={handleSubmitFeedback}
                submitting={submittingFeedback}
            />
        </div>
    );
}
