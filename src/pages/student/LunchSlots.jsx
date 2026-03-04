import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import SlotBar from '../../components/SlotBar';
import QRDisplay from '../../components/QRDisplay';
import Modal from '../../components/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtimeBookings } from '../../hooks/useRealtime';
import { useToast } from '../../components/Toast';
import { bookingService } from '../../services/bookingService';
import { menuService } from '../../services/menuService';
import { LUNCH_SLOTS } from '../../utils/constants';
import { getBookingDate } from '../../utils/dateHelpers';
import { isMealClosed } from '../../utils/bookingTime';
import { format } from 'date-fns';

export default function LunchSlots() {
    const { user } = useAuth();
    const toast = useToast();

    const [allBookings, setAllBookings] = useState([]);
    const [myBooking, setMyBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lunchMenu, setLunchMenu] = useState(null);

    // Confirmation modal state
    const [pendingSlot, setPendingSlot] = useState(null);   // { value, label }
    const [submitting, setSubmitting] = useState(false);    // prevent double-submit

    // Use shared booking date (today before 8:30 PM, tomorrow after)
    const today = getBookingDate();

    // Lunch booking is locked after 1:30 PM
    const lunchClosed = isMealClosed('lunch');

    async function fetchData() {
        try {
            setLoading(true);
            const [all, mine, menus] = await Promise.all([
                bookingService.getSlotDistribution(today, 'lunch'),
                bookingService.getTodayBookings(user.id),
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
    }, [user.id, today]);

    useRealtimeBookings(today, () => fetchData());

    // Open modal — does NOT book yet
    function handleSelectSlot(slotTime) {
        if (lunchClosed || submitting) return;
        const slot = LUNCH_SLOTS.find((s) => s.value === slotTime);
        setPendingSlot(slot || { value: slotTime, label: slotTime });
    }

    // Confirmed — now actually book
    async function handleConfirm() {
        if (!pendingSlot || submitting) return;
        setSubmitting(true);
        try {
            if (myBooking) {
                await bookingService.updateSlot(myBooking.id, user.id, today, 'lunch', pendingSlot.value);
                toast.success('Slot changed!', `Your lunch slot is now ${pendingSlot.label}`);
            } else {
                await bookingService.createBooking(user.id, today, 'lunch', pendingSlot.value);
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

    const totalBookings = allBookings.length;
    const currentSlotLabel = myBooking
        ? LUNCH_SLOTS.find((s) => s.value === myBooking.slot_time)?.label || myBooking.slot_time
        : null;

    // Modal title / body text
    const isChange = !!myBooking;
    const modalTitle = isChange ? 'Change Slot?' : 'Confirm Booking';
    const modalBody = isChange
        ? `Change lunch slot from "${currentSlotLabel}" to "${pendingSlot?.label}"?`
        : `Book lunch slot "${pendingSlot?.label}"?`;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-text">Lunch Slots</h2>
                <p className="text-sm text-text-secondary mt-0.5">
                    Choose your preferred lunch slot • 11:00 AM – 1:30 PM
                </p>
            </div>

            {lunchClosed && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-danger/8 border border-danger/20">
                    <span className="text-lg flex-shrink-0">🔒</span>
                    <div>
                        <p className="text-sm font-semibold text-danger">Lunch booking closed for today</p>
                        <p className="text-xs text-text-muted mt-0.5">Booking window was 11:00 AM – 1:30 PM. Come back tomorrow!</p>
                    </div>
                </div>
            )}

            {/* Today's Lunch Menu */}
            {lunchMenu && (() => {
                const items = lunchMenu.items.split('\n').map(s => s.trim()).filter(Boolean);
                return items.length > 0 ? (
                    <div className="p-4 rounded-xl bg-success/5 border border-success/20">
                        <div className="flex items-center gap-2 mb-2">
                            <span>🍽️</span>
                            <span className="text-sm font-semibold text-text">Today's Lunch Menu</span>
                        </div>
                        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 pl-4">
                            {items.map((item, i) => (
                                <li key={i} className="text-xs text-text-secondary list-disc">{item}</li>
                            ))}
                        </ul>
                    </div>
                ) : null;
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Slot Selection */}
                <div className="lg:col-span-2">
                    <Card
                        title="Select Slot"
                        icon="🕐"
                        badge={`${totalBookings} total`}
                        badgeType="badge-info"
                    >
                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="skeleton h-14 w-full" />
                                ))}
                            </div>
                        ) : (
                            <SlotBar
                                slots={LUNCH_SLOTS}
                                bookings={allBookings}
                                activeSlot={myBooking?.slot_time}
                                onSelect={handleSelectSlot}
                                disabled={lunchClosed || !!pendingSlot || submitting}
                            />
                        )}
                    </Card>
                </div>

                {/* My Booking */}
                <div>
                    <Card title="Your Booking" icon="🎫">
                        {myBooking ? (
                            <div className="space-y-4">
                                <div className="text-center">
                                    <span className="badge badge-success mb-3">Booked</span>
                                    <p className="text-sm font-medium text-text mt-2">
                                        Slot: {currentSlotLabel}
                                    </p>
                                    <p className="text-xs text-text-muted mt-1">
                                        {format(new Date(), 'EEE, MMM dd')}
                                    </p>
                                </div>
                                <div className="flex justify-center">
                                    <QRDisplay value={myBooking.qr_code} size={140} />
                                </div>
                                <p className="text-xs text-text-muted text-center">
                                    Click any slot to change
                                </p>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <div className="text-4xl mb-3">🍽️</div>
                                <p className="text-sm text-text-secondary">Select a slot to book lunch</p>
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
                    {/* Meal info */}
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
                            <span className="font-semibold text-text">{format(new Date(), 'EEE, MMM dd, yyyy')}</span>
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
