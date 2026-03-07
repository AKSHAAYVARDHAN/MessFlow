import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import QRDisplay from '../../components/QRDisplay';
import Modal from '../../components/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtimeBookings } from '../../hooks/useRealtime';
import { useToast } from '../../components/Toast';
import { bookingService } from '../../services/bookingService';
import { menuService } from '../../services/menuService';
import { LUNCH_SLOTS } from '../../utils/constants';
import { getBookingDate, isTomorrowBooking } from '../../utils/dateHelpers';
import { isMealClosed } from '../../utils/bookingTime';
import { format } from 'date-fns';

const SLOT_CAPACITY = 40; // max students per slot

export default function LunchSlots() {
    const { user } = useAuth();
    const toast = useToast();

    const [allBookings, setAllBookings] = useState([]);
    const [myBooking, setMyBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lunchMenu, setLunchMenu] = useState(null);

    // Confirmation modal state
    const [pendingSlot, setPendingSlot] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Tomorrow / today booking logic
    const isTomorrow = isTomorrowBooking();
    const bookingDate = getBookingDate();

    // Lunch booking is locked after 1:30 PM UNLESS we're in tomorrow-booking mode
    // In tomorrow mode, all meals are open for the next day
    const lunchClosed = isTomorrow ? false : isMealClosed('lunch');

    async function fetchData() {
        try {
            setLoading(true);
            const [all, mine, menus] = await Promise.all([
                bookingService.getSlotDistribution(bookingDate, 'lunch'),
                bookingService.getTodayBookings(user.id, bookingDate),
                menuService.getTodayMenus(),
            ]);
            setAllBookings(all);
            const lunchBooking = mine.find(
                (b) => b.meal_type === 'lunch' && b.status !== 'cancelled'
            );
            setMyBooking(lunchBooking || null);
            setLunchMenu(menus.find((m) => m.meal_type === 'lunch') || null);
        } catch (err) {
            console.error('Failed to fetch lunch data:', err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
    }, [user.id, bookingDate]);

    useRealtimeBookings(bookingDate, () => fetchData());

    function handleSelectSlot(slotTime) {
        if (lunchClosed || submitting) return;
        const slot = LUNCH_SLOTS.find((s) => s.value === slotTime);
        setPendingSlot(slot || { value: slotTime, label: slotTime });
    }

    async function handleConfirm() {
        if (!pendingSlot || submitting) return;
        setSubmitting(true);
        try {
            if (myBooking) {
                await bookingService.updateSlot(myBooking.id, user.id, bookingDate, 'lunch', pendingSlot.value);
                toast.success('Slot changed!', `Your lunch slot is now ${pendingSlot.label}`);
            } else {
                await bookingService.createBooking(user.id, bookingDate, 'lunch', pendingSlot.value);
                toast.success('Lunch booked!', `Slot: ${pendingSlot.label}`);
            }
            setPendingSlot(null);
            await fetchData();
        } catch (err) {
            console.error('Slot selection failed:', err);
            toast.error('Booking failed', err.message || 'Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCancel() {
        if (!myBooking || submitting) return;
        setSubmitting(true);
        try {
            await bookingService.cancelBooking(myBooking.id, 'lunch');
            toast.success('Booking cancelled', 'Your lunch booking has been removed.');
            setMyBooking(null);
            await fetchData();
        } catch (err) {
            toast.error('Cancellation failed', err.message || 'Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    // Slot counts
    const slotCounts = {};
    LUNCH_SLOTS.forEach((s) => {
        slotCounts[s.value] = allBookings.filter((b) => b.slot_time === s.value).length;
    });

    const totalBookings = allBookings.length;
    const currentSlotLabel = myBooking
        ? LUNCH_SLOTS.find((s) => s.value === myBooking.slot_time)?.label || myBooking.slot_time
        : null;

    const isChange = !!myBooking;
    const modalTitle = isChange ? 'Change Slot?' : 'Confirm Booking';
    const modalBody = isChange
        ? `Change lunch slot from "${currentSlotLabel}" to "${pendingSlot?.label}"?`
        : `Book lunch slot "${pendingSlot?.label}"?`;

    // Formatted booking date
    const bookingDateFormatted = format(new Date(bookingDate + 'T12:00:00'), 'EEE, MMM d, yyyy');

    return (
        <div className="space-y-6 animate-fade-in">
            {/* ── PAGE HEADER ── */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg ${isTomorrow
                                ? 'bg-green-100 text-green-700 border border-green-200'
                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}>
                            {isTomorrow ? '🌙 TOMORROW' : '📅 TODAY'}
                        </span>
                    </div>
                    <h2 className="text-xl font-bold text-text">Lunch Slots</h2>
                    <p className="text-sm text-text-secondary mt-0.5">
                        {isTomorrow
                            ? `Booking for tomorrow • ${bookingDateFormatted}`
                            : `Choose your preferred slot • ${bookingDateFormatted}`}
                    </p>
                </div>
                <div className="text-right hidden sm:block">
                    <p className="text-xs text-text-muted">Total booked</p>
                    <p className="text-2xl font-bold text-primary">{totalBookings}</p>
                    <p className="text-xs text-text-muted">students</p>
                </div>
            </div>

            {/* ── STATUS BANNER ── */}
            {lunchClosed ? (
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface border border-border">
                    <span className="text-lg flex-shrink-0">🔒</span>
                    <div>
                        <p className="text-sm font-semibold text-text-secondary">Lunch booking closed for today</p>
                        <p className="text-xs text-text-muted mt-0.5">Booking window was 11:00 AM – 1:30 PM. After 8:30 PM you can book for tomorrow.</p>
                    </div>
                </div>
            ) : (
                <div className={`flex items-center gap-3 p-3.5 rounded-xl border ${isTomorrow ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
                    }`}>
                    <span className="text-lg flex-shrink-0">{isTomorrow ? '🌙' : '✅'}</span>
                    <p className={`text-sm font-semibold ${isTomorrow ? 'text-green-700' : 'text-blue-700'}`}>
                        {isTomorrow
                            ? "Booking open for tomorrow's lunch"
                            : 'Booking open — window closes at 1:30 PM'}
                    </p>
                </div>
            )}

            {/* ── LUNCH MENU ── */}
            {lunchMenu && (() => {
                const items = lunchMenu.items.split('\n').map(s => s.trim()).filter(Boolean);
                return items.length > 0 ? (
                    <div className="p-4 rounded-xl bg-success/5 border border-success/20">
                        <div className="flex items-center gap-2 mb-2">
                            <span>🍽️</span>
                            <span className="text-sm font-semibold text-text">
                                {isTomorrow ? "Tomorrow's Lunch Menu" : "Today's Lunch Menu"}
                            </span>
                        </div>
                        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 pl-4">
                            {items.map((item, i) => (
                                <li key={i} className="text-xs text-text-secondary list-disc">{item}</li>
                            ))}
                        </ul>
                    </div>
                ) : null;
            })()}

            {/* ── MAIN GRID ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Slot Selection */}
                <div className="lg:col-span-2">
                    <Card
                        title="Select Slot"
                        icon="🕐"
                        badge={`${totalBookings} booked`}
                        badgeType="badge-info"
                    >
                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="skeleton h-20 w-full rounded-xl" />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {LUNCH_SLOTS.map((slot) => {
                                    const count = slotCounts[slot.value] || 0;
                                    const pct = Math.min(Math.round((count / SLOT_CAPACITY) * 100), 100);
                                    const available = Math.max(SLOT_CAPACITY - count, 0);
                                    const isActive = myBooking?.slot_time === slot.value;
                                    const isFull = count >= SLOT_CAPACITY;

                                    return (
                                        <button
                                            key={slot.value}
                                            onClick={() => handleSelectSlot(slot.value)}
                                            disabled={lunchClosed || submitting || isFull}
                                            className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${isActive
                                                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                                    : isFull
                                                        ? 'border-border bg-surface-hover opacity-60 cursor-not-allowed'
                                                        : lunchClosed || submitting
                                                            ? 'border-border opacity-50 cursor-not-allowed'
                                                            : 'border-border hover:border-primary/40 hover:bg-surface-hover cursor-pointer'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-text">{slot.label}</span>
                                                    {isActive && (
                                                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                                            Your Slot
                                                        </span>
                                                    )}
                                                    {isFull && (
                                                        <span className="text-xs font-bold text-danger bg-danger/10 px-2 py-0.5 rounded-full">
                                                            Full
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-text-muted">
                                                        <strong className={`${pct > 80 ? 'text-danger' : pct > 60 ? 'text-warning' : 'text-success'}`}>
                                                            {count}
                                                        </strong>
                                                        {' / '}{SLOT_CAPACITY} booked
                                                    </span>
                                                    <span className="text-xs text-text-muted">
                                                        {available} seats left
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Capacity Progress Bar */}
                                            <div className="w-full h-2.5 bg-border/50 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-500 ease-out"
                                                    style={{
                                                        width: `${Math.max(pct, count > 0 ? 2 : 0)}%`,
                                                        background: isActive
                                                            ? 'var(--color-primary)'
                                                            : pct > 80
                                                                ? 'var(--color-danger)'
                                                                : pct > 60
                                                                    ? 'var(--color-warning)'
                                                                    : 'var(--color-success)',
                                                    }}
                                                />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                </div>

                {/* My Booking Panel */}
                <div>
                    <Card title="Your Booking" icon="🎫">
                        {loading ? (
                            <div className="space-y-3">
                                <div className="skeleton h-6 w-20 mx-auto rounded" />
                                <div className="skeleton h-32 w-32 mx-auto rounded-xl" />
                                <div className="skeleton h-4 w-28 mx-auto rounded" />
                            </div>
                        ) : myBooking ? (
                            <div className="space-y-4">
                                <div className="text-center">
                                    <span className="badge badge-success mb-3">Booked ✓</span>
                                    <p className="text-base font-bold text-text mt-2">{currentSlotLabel}</p>
                                    <p className="text-xs text-text-muted mt-1">
                                        {isTomorrow ? 'Tomorrow' : 'Today'} • {bookingDateFormatted}
                                    </p>
                                </div>
                                <div className="flex justify-center">
                                    <QRDisplay value={myBooking.qr_code} size={140} />
                                </div>
                                {/* Booking details */}
                                <div className="bg-surface-hover rounded-xl p-3 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-text-muted font-medium">Meal</span>
                                        <span className="font-semibold text-text">🍽️ Lunch</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-text-muted font-medium">Slot</span>
                                        <span className="font-semibold text-text">{currentSlotLabel}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-text-muted font-medium">Date</span>
                                        <span className="font-semibold text-text">{bookingDateFormatted}</span>
                                    </div>
                                </div>
                                {!lunchClosed && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-text-muted text-center">
                                            Click any slot to change
                                        </p>
                                        <button
                                            onClick={handleCancel}
                                            disabled={submitting}
                                            className="btn btn-danger btn-sm w-full"
                                        >
                                            {submitting ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    Cancelling…
                                                </span>
                                            ) : 'Cancel Booking'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <div className="text-4xl mb-3">🍽️</div>
                                <p className="text-sm font-medium text-text-secondary">No booking yet</p>
                                <p className="text-xs text-text-muted mt-1">
                                    {lunchClosed
                                        ? 'Booking window has closed'
                                        : 'Select a slot on the left to book'}
                                </p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Confirmation Modal */}
            <Modal
                isOpen={!!pendingSlot}
                onClose={() => !submitting && setPendingSlot(null)}
                title={modalTitle}
            >
                <div className="space-y-5">
                    <div className="bg-surface-hover rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-text-muted font-medium">Meal</span>
                            <span className="font-semibold text-text">🍽️ Lunch</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-text-muted font-medium">Slot</span>
                            <span className="font-semibold text-text">{pendingSlot?.label}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-text-muted font-medium">Date</span>
                            <span className="font-semibold text-text flex items-center gap-1.5">
                                {bookingDateFormatted}
                                {isTomorrow && (
                                    <span className="text-xs font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-md">Tomorrow</span>
                                )}
                            </span>
                        </div>
                    </div>

                    {isChange && (
                        <p className="text-sm text-text-secondary text-center">
                            Your current slot <strong>"{currentSlotLabel}"</strong> will be replaced.
                        </p>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={() => setPendingSlot(null)}
                            disabled={submitting}
                            className="btn btn-ghost flex-1"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={submitting}
                            className="btn btn-primary flex-1"
                        >
                            {submitting ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Booking…
                                </span>
                            ) : isChange ? 'Yes, Change Slot' : 'Confirm Booking'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
