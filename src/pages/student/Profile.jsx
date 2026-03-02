import Card from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import { DINNER_SLOTS } from '../../utils/constants';

export default function Profile() {
    const { profile } = useAuth();

    if (!profile) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const count = profile.no_show_count || 0;
    const isDisabledByAdmin = !profile.default_booking_enabled;

    // Color level based on count
    const noShowLevel =
        count >= 3 ? 'danger' :
            count >= 2 ? 'warning' :
                'success';

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-text">Profile</h2>
                <p className="text-sm text-text-secondary mt-0.5">Your account details and status</p>
            </div>

            {/* Warning banner — shown if count >= 2 */}
            {count >= 2 && (
                <div
                    className={`flex items-start gap-3 p-4 rounded-2xl border ${count >= 3
                            ? 'bg-danger/8 border-danger/30'
                            : 'bg-warning/10 border-warning/30'
                        }`}
                >
                    <span className="text-2xl flex-shrink-0">{count >= 3 ? '🚫' : '⚠️'}</span>
                    <div>
                        {count >= 3 ? (
                            <>
                                <p className="text-sm font-bold text-danger">Auto-Booking Disabled</p>
                                <p className="text-sm text-text-secondary mt-0.5">
                                    You have <strong>{count} no-shows</strong>. Auto-booking has been disabled.
                                    Contact admin to re-enable auto-booking.
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-bold text-warning">No-Show Warning</p>
                                <p className="text-sm text-text-secondary mt-0.5">
                                    You have <strong>{count} no-shows</strong>. One more will automatically disable your auto-booking.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Account Info */}
                <Card title="Account Information" icon="👤">
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs text-text-muted uppercase tracking-wider">Name</p>
                            <p className="text-sm font-medium text-text mt-0.5">{profile.name}</p>
                        </div>
                        <div>
                            <p className="text-xs text-text-muted uppercase tracking-wider">Email</p>
                            <p className="text-sm font-medium text-text mt-0.5">{profile.email}</p>
                        </div>
                        <div>
                            <p className="text-xs text-text-muted uppercase tracking-wider">Role</p>
                            <span className="badge badge-info mt-1 capitalize">{profile.role}</span>
                        </div>
                        <div>
                            <p className="text-xs text-text-muted uppercase tracking-wider">Default Dinner Slot</p>
                            <p className="text-sm font-medium text-text mt-0.5">
                                {profile.preferred_dinner_slot
                                    ? DINNER_SLOTS.find((s) => s.value === profile.preferred_dinner_slot)?.label ||
                                    profile.preferred_dinner_slot
                                    : 'Not set'}
                            </p>
                        </div>
                    </div>
                </Card>

                {/* No-Show Status */}
                <Card title="No-Show Status" icon="⚠️">
                    <div className="space-y-4">
                        {/* Count display */}
                        <div className="text-center p-6 rounded-xl bg-bg">
                            <p
                                className="text-5xl font-bold"
                                style={{
                                    color:
                                        noShowLevel === 'danger' ? 'var(--color-danger)' :
                                            noShowLevel === 'warning' ? 'var(--color-warning)' :
                                                'var(--color-success)',
                                }}
                            >
                                {count}
                            </p>
                            <p className="text-sm text-text-secondary mt-1">Total no-shows</p>
                            <div className="flex justify-center gap-1 mt-2">
                                {[0, 1, 2].map((i) => (
                                    <div
                                        key={i}
                                        className="w-6 h-1.5 rounded-full transition-all"
                                        style={{
                                            background: i < count
                                                ? count >= 3 ? 'var(--color-danger)' : 'var(--color-warning)'
                                                : 'var(--color-border)',
                                        }}
                                    />
                                ))}
                            </div>
                            <p className="text-xs text-text-muted mt-1.5">{count}/3 before auto-booking is disabled</p>
                        </div>

                        {/* Status messages */}
                        {count >= 3 && (
                            <div className="p-3 rounded-lg bg-danger/8 border border-danger/20">
                                <p className="text-sm font-semibold text-danger">
                                    🚫 You have {count} no-shows. Contact admin to re-enable auto-booking.
                                </p>
                            </div>
                        )}

                        {count === 2 && (
                            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                                <p className="text-sm font-medium text-warning">
                                    ⚠️ Warning: One more no-show will disable auto-booking
                                </p>
                            </div>
                        )}

                        {count < 2 && (
                            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                                <p className="text-sm font-medium text-success">
                                    ✅ Your attendance record is good
                                </p>
                            </div>
                        )}

                        {/* Auto-booking status row */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-bg">
                            <span className="text-sm text-text-secondary">Auto Booking</span>
                            <span className={`badge ${profile.default_booking_enabled ? 'badge-success' : 'badge-danger'}`}>
                                {profile.default_booking_enabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>

                        {/* Contact admin note when disabled */}
                        {isDisabledByAdmin && (
                            <div className="p-3 rounded-lg bg-surface-hover border border-border text-center">
                                <p className="text-xs text-text-secondary">
                                    📧 Contact your mess admin to re-enable auto-booking
                                </p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
