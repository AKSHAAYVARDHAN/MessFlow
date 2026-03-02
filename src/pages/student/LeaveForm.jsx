import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import { leaveService } from '../../services/leaveService';
import { useToast } from '../../components/Toast';
import { formatDate } from '../../utils/dateHelpers';

const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2 };

export default function LeaveForm() {
    const { user } = useAuth();
    const toast = useToast();
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        fromDate: '',
        fromMeal: 'breakfast',
        toDate: '',
        toMeal: 'dinner',
    });

    useEffect(() => {
        fetchLeaves();
    }, [user.id]);

    async function fetchLeaves() {
        try {
            setLoading(true);
            const data = await leaveService.getLeaves(user.id);
            setLeaves(data);
        } catch (err) {
            console.error('Failed to fetch leaves:', err);
        } finally {
            setLoading(false);
        }
    }

    function validate() {
        if (!form.fromDate || !form.toDate) {
            toast.error('Missing dates', 'Please select both From and To dates.');
            return false;
        }
        if (form.fromDate > form.toDate) {
            toast.error('Invalid date range', 'From Date must be on or before To Date.');
            return false;
        }
        // Same-day: ensure meal order is valid
        if (form.fromDate === form.toDate) {
            if (MEAL_ORDER[form.fromMeal] > MEAL_ORDER[form.toMeal]) {
                toast.error('Invalid meal range', 'From Meal must come before or equal To Meal on the same day.');
                return false;
            }
        }
        return true;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!validate()) return;

        setSubmitting(true);
        try {
            await leaveService.createLeave(
                user.id,
                form.fromDate,
                form.fromMeal,
                form.toDate,
                form.toMeal
            );

            // Auto-cancel any bookings within the leave range
            const cancelled = await leaveService.cancelBookingsDuringLeave(
                user.id,
                form.fromDate,
                form.fromMeal,
                form.toDate,
                form.toMeal
            );

            const msg = cancelled > 0
                ? `${cancelled} booking${cancelled > 1 ? 's' : ''} cancelled automatically.`
                : 'No existing bookings were affected.';

            toast.success('Leave applied!', msg);
            setForm({ fromDate: '', fromMeal: 'breakfast', toDate: '', toMeal: 'dinner' });
            await fetchLeaves();
        } catch (err) {
            console.error('Failed to create leave:', err);
            toast.error('Failed to apply leave', err.message || 'Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCancel(leaveId) {
        try {
            await leaveService.cancelLeave(leaveId);
            toast.success('Leave cancelled', 'Your leave has been removed.');
            await fetchLeaves();
        } catch (err) {
            console.error('Failed to cancel leave:', err);
            toast.error('Failed to cancel leave', err.message || 'Please try again.');
        }
    }

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-text">Leave Management</h2>
                <p className="text-sm text-text-secondary mt-0.5">
                    Apply for leave to skip meal bookings. Existing bookings in the leave period will be cancelled automatically.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Apply Leave Form */}
                <Card title="Apply Leave" icon="📝">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label">From Date</label>
                                <input
                                    type="date"
                                    value={form.fromDate}
                                    onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
                                    min={today}
                                    className="input"
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">From Meal</label>
                                <select
                                    value={form.fromMeal}
                                    onChange={(e) => setForm({ ...form, fromMeal: e.target.value })}
                                    className="input"
                                >
                                    <option value="breakfast">Breakfast</option>
                                    <option value="lunch">Lunch</option>
                                    <option value="dinner">Dinner</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label">To Date</label>
                                <input
                                    type="date"
                                    value={form.toDate}
                                    onChange={(e) => setForm({ ...form, toDate: e.target.value })}
                                    min={form.fromDate || today}
                                    className="input"
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">To Meal</label>
                                <select
                                    value={form.toMeal}
                                    onChange={(e) => setForm({ ...form, toMeal: e.target.value })}
                                    className="input"
                                >
                                    <option value="breakfast">Breakfast</option>
                                    <option value="lunch">Lunch</option>
                                    <option value="dinner">Dinner</option>
                                </select>
                            </div>
                        </div>

                        {/* Same-day warning */}
                        {form.fromDate && form.toDate && form.fromDate === form.toDate && (
                            <p className="text-xs text-text-muted bg-surface-hover border border-border rounded-lg px-3 py-2">
                                ℹ️ Same-day leave: From Meal must be ≤ To Meal (Breakfast → Lunch → Dinner).
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="btn btn-primary w-full"
                        >
                            {submitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Applying…
                                </span>
                            ) : 'Apply Leave'}
                        </button>
                    </form>
                </Card>

                {/* Leave History */}
                <Card title="Your Leaves" icon="📋">
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="skeleton h-16 w-full" />
                            ))}
                        </div>
                    ) : leaves.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="text-4xl mb-3">🏖️</div>
                            <p className="text-sm text-text-secondary">No leaves applied</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {leaves.map((leave) => {
                                const isActive = new Date(leave.to_date) >= new Date(today);
                                return (
                                    <div
                                        key={leave.id}
                                        className={`p-3 rounded-lg border ${isActive
                                            ? 'border-primary/20 bg-primary/5'
                                            : 'border-border bg-surface-hover opacity-60'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span
                                                        className={`badge text-xs ${isActive ? 'badge-success' : 'badge-muted'}`}
                                                    >
                                                        {isActive ? 'Active' : 'Completed'}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium text-text">
                                                    {formatDate(leave.from_date)}
                                                    <span className="text-text-muted font-normal"> ({leave.from_meal})</span>
                                                </p>
                                                <p className="text-sm text-text-secondary">
                                                    → {formatDate(leave.to_date)}
                                                    <span className="text-text-muted"> ({leave.to_meal})</span>
                                                </p>
                                            </div>
                                            {isActive && (
                                                <button
                                                    onClick={() => handleCancel(leave.id)}
                                                    className="btn btn-ghost btn-sm text-danger flex-shrink-0"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
