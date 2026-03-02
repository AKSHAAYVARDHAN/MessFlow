import { useState, useEffect, useCallback } from 'react';
import Card from '../../components/Card';
import QRDisplay from '../../components/QRDisplay';
import Modal from '../../components/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useBookings } from '../../hooks/useBookings';
import { useRealtimeBookings } from '../../hooks/useRealtime';
import { useToast } from '../../components/Toast';
import { bookingService } from '../../services/bookingService';
import { leaveService } from '../../services/leaveService';
import { announcementService } from '../../services/announcementService';
import { menuService } from '../../services/menuService';
import { supabase } from '../../services/supabase';
import { MEAL_ICONS, CANCELLATION_DEADLINES } from '../../utils/constants';
import { getToday, canCancelMeal, getTimeRemaining, getCancellationDeadlineLabel, formatDate } from '../../utils/dateHelpers';
import { format } from 'date-fns';
import { NavLink } from 'react-router-dom';

const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2 };
const MEAL_SEQUENCE = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const MEAL_ICON_MAP = { breakfast: '☀️', lunch: '🍽️', dinner: '🌙' };

function parseMenuItems(text) {
    return (text || '').split('\n').map((s) => s.trim()).filter(Boolean);
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
    const { bookings, loading, refetch, getBookingByMeal } = useBookings();
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

    const today = getToday();

    useRealtimeBookings(today, () => refetch());

    useEffect(() => {
        announcementService.getAnnouncementsByDate(today).then(setAnnouncements).catch(console.error);
        menuService.getTodayMenus().then(setTodayMenus).catch(console.error);
    }, [today]);

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
        setBookingMeal(mealType);
        setBookModal(null);
        try {
            await bookingService.createBooking(user.id, today, mealType);
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
    todayMenus.forEach((m) => (menuMap[m.meal_type] = m));
    const hasMenu = MEAL_SEQUENCE.some((m) => menuMap[m]);

    const importantAnn = announcements.filter((a) => a.is_important);
    const regularAnn = announcements.filter((a) => !a.is_important);

    return (
        <div className="space-y-8 animate-fade-in">
            {/* ── TOP SECTION: Summary + Auto Booking ── */}
            <div className="flex flex-col sm:flex-row gap-4">
                {/* Date summary card */}
                <div className="card flex-1 flex items-center gap-4" style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #EEF2FF 100%)', borderColor: '#BFDBFE' }}>
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-2xl flex-shrink-0">
                        📅
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-0.5">Today</p>
                        <p className="text-base font-bold text-text">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
                        <p className="text-sm text-text-secondary mt-0.5">
                            {bookings.filter(b => b.status !== 'cancelled').length} of 3 meals booked
                        </p>
                    </div>
                </div>

                {/* Auto Booking Toggle */}
                <div className="card flex flex-col gap-3 sm:w-auto"
                    style={{ minWidth: '220px' }}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                            🔄
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-text">Auto Booking</p>
                            <p className="text-xs text-text-muted mt-0.5">
                                {profile?.default_booking_enabled ? 'Active — meals booked automatically' : 'Off — book meals manually'}
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
                    {/* No-show warning inside the card */}
                    {profile && !profile.default_booking_enabled && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-danger/8 border border-danger/20">
                            <span className="text-base flex-shrink-0">⚠️</span>
                            <p className="text-xs font-medium text-danger leading-snug">
                                Auto-booking disabled due to {profile.no_show_count || 3}+ no-shows.
                                Contact admin to re-enable.
                            </p>
                        </div>
                    )}
                    {profile && profile.default_booking_enabled && (profile.no_show_count || 0) >= 2 && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-warning/10 border border-warning/20">
                            <span className="text-base flex-shrink-0">⚠️</span>
                            <p className="text-xs font-medium text-warning leading-snug">
                                {profile.no_show_count} no-show{profile.no_show_count !== 1 ? 's' : ''}. One more disables auto-booking.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Active Leave Banner */}
            {!leaveLoading && activeLeave && (
                <div className="flex items-start gap-4 p-4 rounded-2xl"
                    style={{ background: 'linear-gradient(135deg, #EFF6FF, #EEF2FF)', border: '1.5px solid #BFDBFE' }}>
                    <span className="text-2xl flex-shrink-0 mt-0.5">🏖️</span>
                    <div>
                        <p className="text-sm font-bold text-primary">You are currently on leave</p>
                        <p className="text-sm text-text-secondary mt-0.5">
                            From <strong className="text-text">{formatDate(activeLeave.from_date)}</strong> ({activeLeave.from_meal}) to{' '}
                            <strong className="text-text">{formatDate(activeLeave.to_date)}</strong> ({activeLeave.to_meal}).
                            Booking is disabled for affected meals.
                        </p>
                    </div>
                </div>
            )}

            {/* ── SECOND SECTION: Meal Cards ── */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="section-title">Today's Meals</h3>
                    <span className="text-sm text-text-muted">
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

                            const statusBadge = onLeave ? 'On Leave' :
                                isCancelling ? 'Cancelling…' :
                                    isBooking ? 'Booking…' :
                                        booking ? booking.status :
                                            'No Booking';

                            const badgeType = onLeave ? 'badge-info' :
                                booking?.status === 'booked' ? 'badge-success' :
                                    booking?.status === 'scanned' ? 'badge-info' :
                                        isCancelling || isBooking ? 'badge-warning' :
                                            'badge-muted';

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
                                            <div className="flex flex-col items-center justify-center py-8 space-y-2">
                                                <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center text-3xl mb-1">✅</div>
                                                <p className="text-sm font-semibold text-success">Meal Scanned</p>
                                                <p className="text-xs text-text-muted">Enjoy your {meal}!</p>
                                            </div>
                                        ) : booking?.status === 'no_show' ? (
                                            <div className="flex flex-col items-center justify-center py-8 space-y-2">
                                                <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-3xl mb-1">⚠️</div>
                                                <p className="text-sm font-semibold text-danger">No Show</p>
                                                <p className="text-xs text-text-muted">You missed this meal</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-8 space-y-3">
                                                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-3xl mb-1">🍴</div>
                                                <p className="text-sm text-text-secondary">No booking yet</p>
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
                            <p className="empty-state-text">Menu not set yet</p>
                            <p className="empty-state-sub">Check back once the admin updates today's menu.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {MEAL_SEQUENCE.map((meal) => {
                                const m = menuMap[meal];
                                if (!m) return null;
                                const items = parseMenuItems(m.items);
                                return (
                                    <div key={meal} className="flex gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center text-base flex-shrink-0">
                                            {MEAL_ICON_MAP[meal]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-text">{MEAL_LABEL[meal]}</p>
                                            <p className="text-xs text-text-secondary truncate-2 mt-0.5">
                                                {items.join(' · ')}
                                            </p>
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
                            <span className="font-semibold text-text">{format(new Date(), 'EEE, MMM dd, yyyy')}</span>
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
                            <span className="font-semibold text-text">{format(new Date(), 'EEE, MMM dd, yyyy')}</span>
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
        </div>
    );
}
