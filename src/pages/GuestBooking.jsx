import { useState } from 'react';
import Card from '../components/Card';
import QRDisplay from '../components/QRDisplay';
import { guestService } from '../services/guestService';

export default function GuestBooking() {
    const [form, setForm] = useState({
        name: '',
        phone: '',
        date: new Date().toISOString().split('T')[0],
        mealType: 'lunch',
    });
    const [step, setStep] = useState('form'); // form | payment | done
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(false);

    function handleProceedToPayment(e) {
        e.preventDefault();
        setStep('payment');
    }

    async function handlePayment() {
        setLoading(true);
        try {
            // Simulate payment delay
            await new Promise((resolve) => setTimeout(resolve, 1500));

            const result = await guestService.createGuestBooking(
                form.name,
                form.phone,
                form.date,
                form.mealType
            );
            setBooking(result);
            setStep('done');
        } catch (err) {
            console.error('Guest booking failed:', err);
            setStep('form');
        } finally {
            setLoading(false);
        }
    }

    function handleReset() {
        setForm({ name: '', phone: '', date: new Date().toISOString().split('T')[0], mealType: 'lunch' });
        setStep('form');
        setBooking(null);
    }

    const mealPrices = { breakfast: 40, lunch: 60, dinner: 55 };

    return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/25">
                        <span className="text-3xl">🎫</span>
                    </div>
                    <h1 className="text-2xl font-bold text-text">Guest Meal Booking</h1>
                    <p className="text-text-secondary mt-1">Book a meal as a guest visitor</p>
                </div>

                {/* Step: Form */}
                {step === 'form' && (
                    <Card className="animate-fade-in">
                        <form onSubmit={handleProceedToPayment} className="space-y-4">
                            <div>
                                <label className="label">Full Name</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="input"
                                    placeholder="John Doe"
                                    required
                                />
                            </div>

                            <div>
                                <label className="label">Phone Number</label>
                                <input
                                    type="tel"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    className="input"
                                    placeholder="+91 98765 43210"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="label">Date</label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="input"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label">Meal</label>
                                    <select
                                        value={form.mealType}
                                        onChange={(e) => setForm({ ...form, mealType: e.target.value })}
                                        className="input"
                                    >
                                        <option value="breakfast">Breakfast</option>
                                        <option value="lunch">Lunch</option>
                                        <option value="dinner">Dinner</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-3 rounded-lg bg-bg border border-border">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-text-secondary">Meal Price</span>
                                    <span className="text-lg font-bold text-text">₹{mealPrices[form.mealType]}</span>
                                </div>
                            </div>

                            <button type="submit" className="btn btn-primary w-full py-3 text-base">
                                Proceed to Payment
                            </button>
                        </form>
                    </Card>
                )}

                {/* Step: Payment */}
                {step === 'payment' && (
                    <Card className="animate-fade-in">
                        <div className="text-center space-y-6">
                            <div>
                                <h3 className="text-base font-semibold text-text">Payment Summary</h3>
                                <p className="text-sm text-text-secondary mt-1">Confirm your booking details</p>
                            </div>

                            <div className="space-y-3 text-left">
                                <div className="flex justify-between p-2 rounded bg-bg">
                                    <span className="text-sm text-text-secondary">Name</span>
                                    <span className="text-sm font-medium text-text">{form.name}</span>
                                </div>
                                <div className="flex justify-between p-2 rounded bg-bg">
                                    <span className="text-sm text-text-secondary">Date</span>
                                    <span className="text-sm font-medium text-text">{form.date}</span>
                                </div>
                                <div className="flex justify-between p-2 rounded bg-bg">
                                    <span className="text-sm text-text-secondary">Meal</span>
                                    <span className="text-sm font-medium text-text capitalize">{form.mealType}</span>
                                </div>
                                <div className="flex justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                                    <span className="text-sm font-semibold text-text">Total</span>
                                    <span className="text-lg font-bold text-primary">₹{mealPrices[form.mealType]}</span>
                                </div>
                            </div>

                            <button
                                onClick={handlePayment}
                                disabled={loading}
                                className="btn btn-success w-full py-3 text-base"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processing Payment...
                                    </span>
                                ) : (
                                    `Pay ₹${mealPrices[form.mealType]}`
                                )}
                            </button>

                            <button
                                onClick={() => setStep('form')}
                                className="btn btn-ghost w-full"
                                disabled={loading}
                            >
                                ← Go Back
                            </button>
                        </div>
                    </Card>
                )}

                {/* Step: Done */}
                {step === 'done' && booking && (
                    <Card className="animate-fade-in">
                        <div className="text-center space-y-6">
                            <div>
                                <div className="text-5xl mb-3">🎉</div>
                                <h3 className="text-lg font-bold text-text">Booking Confirmed!</h3>
                                <p className="text-sm text-text-secondary mt-1">
                                    Show this QR code at the mess entrance
                                </p>
                            </div>

                            <div className="flex justify-center">
                                <QRDisplay value={booking.qr_code} size={180} label="Scan at entrance" />
                            </div>

                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between p-2 rounded bg-bg">
                                    <span className="text-text-secondary">Guest</span>
                                    <span className="font-medium text-text">{booking.name}</span>
                                </div>
                                <div className="flex justify-between p-2 rounded bg-bg">
                                    <span className="text-text-secondary">Date</span>
                                    <span className="font-medium text-text">{booking.date}</span>
                                </div>
                                <div className="flex justify-between p-2 rounded bg-bg">
                                    <span className="text-text-secondary">Meal</span>
                                    <span className="font-medium text-text capitalize">{booking.meal_type}</span>
                                </div>
                                <div className="flex justify-between p-2 rounded bg-bg">
                                    <span className="text-text-secondary">Payment</span>
                                    <span className="badge badge-success">Paid</span>
                                </div>
                            </div>

                            <button onClick={handleReset} className="btn btn-outline w-full">
                                Book Another
                            </button>
                        </div>
                    </Card>
                )}

                {/* Back to login */}
                <div className="text-center mt-6">
                    <a
                        href="/login"
                        className="text-sm text-primary font-medium hover:text-primary-dark transition-colors"
                    >
                        ← Back to Login
                    </a>
                </div>
            </div>
        </div>
    );
}
