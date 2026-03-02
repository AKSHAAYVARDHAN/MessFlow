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
import { supabase } from '../../services/supabase';
import { DINNER_SLOTS } from '../../utils/constants';
import { getToday } from '../../utils/dateHelpers';
import { format } from 'date-fns';

export default function DinnerSlots() {
    const { user, profile, refreshProfile } = useAuth();
    const toast = useToast();

    const [allBookings, setAllBookings] = useState([]);
    const [myBooking, setMyBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dinnerMenu, setDinnerMenu] = useState(null);

    // Confirmation modal state
    const [pendingSlot, setPendingSlot] = useState(null);   // { value, label }
    const [submitting, setSubmitting] = useState(false);    // prevent double-submit

    const today = getToday();

    // Lock slot changes after 6:45 PM
    const now = new Date();
    const lockTime = new Date();
    lockTime.setHours(18, 45, 0, 0);
    const isLocked = now >= lockTime;

    async function fetchData() {
        try {
            setLoading(true);
            const [all, mine, menus] = await Promise.all([
                bookingService.getSlotDistribution(today, 'dinner'),
                bookingService.getTodayBookings(user.id),
                menuService.getTodayMenus(),
            ]);
            setAllBookings(all);
            const dinnerBooking = mine.find(
                (b) => b.meal_type === 'dinner' && b.status !== 'cancelled'
            );
            setMyBooking(dinnerBooking || null);
            setDinnerMenu(menus.find((m) => m.meal_type === 'dinner') || null);
        } catch (err) {
            console.error('Failed to fetch dinner data:', err);
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
        if (isLocked || submitting) return;
        const slot = DINNER_SLOTS.find((s) => s.value === slotTime);
        setPendingSlot(slot || { value: slotTime, label: slotTime });
    }

    // Confirmed — now actually book
    async function handleConfirm() {
        if (!pendingSlot || submitting) return;
        setSubmitting(true);
        try {
            if (myBooking) {
                await bookingService.updateSlot(myBooking.id, user.id, today, 'dinner', pendingSlot.value);
            } else {
                await bookingService.createBooking(user.id, today, 'dinner', pendingSlot.value);
            }
            // Save preferred dinner slot
            await supabase.from('users').update({ preferred_dinner_slot: pendingSlot.value }).eq('id', user.id);
            await refreshProfile();

            if (myBooking) {
                toast.success('Slot changed!', `Your dinner slot is now ${pendingSlot.label}`);
            } else {
                toast.success('Dinner booked!', `Slot: ${pendingSlot.label}`);
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
        ? DINNER_SLOTS.find((s) => s.value === myBooking.slot_time)?.label || myBooking.slot_time
        : null;

    const isChange = !!myBooking;
    const modalTitle = isChange ? 'Change Slot?' : 'Confirm Booking';

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-text">Dinner Slots</h2>
                <p className="text-sm text-text-secondary mt-0.5">
                    Choose your preferred dinner slot • 6:45 PM – 8:30 PM
                </p>
            </div>

            {isLocked && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-warning text-sm font-medium">
                    ⏰ Slot changes are locked after 6:45 PM
                </div>
            )}

            {/* Today's Dinner Menu */}
            {dinnerMenu && (() => {
                const items = dinnerMenu.items.split('\n').map(s => s.trim()).filter(Boolean);
                return items.length > 0 ? (
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/15">
                        <div className="flex items-center gap-2 mb-2">
                            <span>🌙</span>
                            <span className="text-sm font-semibold text-text">Tonight's Dinner Menu</span>
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
                        icon="🕖"
                        badge={`${totalBookings} total`}
                        badgeType="badge-info"
                    >
                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                                    <div key={i} className="skeleton h-14 w-full" />
                                ))}
                            </div>
                        ) : (
                            <SlotBar
                                slots={DINNER_SLOTS}
                                bookings={allBookings}
                                activeSlot={myBooking?.slot_time}
                                onSelect={handleSelectSlot}
                                disabled={isLocked || !!pendingSlot || submitting}
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
                                {profile?.preferred_dinner_slot && (
                                    <p className="text-xs text-text-muted text-center">
                                        Default: {DINNER_SLOTS.find((s) => s.value === profile.preferred_dinner_slot)?.label || profile.preferred_dinner_slot}
                                    </p>
                                )}
                                {!isLocked && (
                                    <p className="text-xs text-text-muted text-center">
                                        Click any slot to change
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <div className="text-4xl mb-3">🌙</div>
                                <p className="text-sm text-text-secondary">Select a slot to book dinner</p>
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
                            <span className="font-semibold text-text">🌙 Dinner</span>
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
