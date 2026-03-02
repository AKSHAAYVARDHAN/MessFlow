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

    const noShowLevel =
        profile.no_show_count >= 5
            ? 'danger'
            : profile.no_show_count >= 3
                ? 'warning'
                : 'success';

    const isDefaultDisabled =
        profile.default_disabled_until &&
        new Date(profile.default_disabled_until) > new Date();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-text">Profile</h2>
                <p className="text-sm text-text-secondary mt-0.5">Your account details and status</p>
            </div>

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
                        {/* No-show count */}
                        <div className="text-center p-6 rounded-xl bg-bg">
                            <p className="text-4xl font-bold" style={{
                                color: noShowLevel === 'danger' ? 'var(--color-danger)' :
                                    noShowLevel === 'warning' ? 'var(--color-warning)' :
                                        'var(--color-success)'
                            }}>
                                {profile.no_show_count}
                            </p>
                            <p className="text-sm text-text-secondary mt-1">No-shows (last 30 days)</p>
                        </div>

                        {/* Warning messages */}
                        {profile.no_show_count >= 5 && (
                            <div className="p-3 rounded-lg bg-danger/5 border border-danger/20">
                                <p className="text-sm font-medium text-danger">
                                    🚫 Default booking has been disabled for 30 days
                                </p>
                                {isDefaultDisabled && (
                                    <p className="text-xs text-text-secondary mt-1">
                                        Re-enables on {new Date(profile.default_disabled_until).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                        )}

                        {profile.no_show_count >= 3 && profile.no_show_count < 5 && (
                            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                                <p className="text-sm font-medium text-warning">
                                    ⚠️ Warning: {5 - profile.no_show_count} more no-shows will disable auto booking
                                </p>
                            </div>
                        )}

                        {profile.no_show_count < 3 && (
                            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                                <p className="text-sm font-medium text-success">
                                    ✅ Your attendance record is good
                                </p>
                            </div>
                        )}

                        {/* Booking status */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-bg">
                            <span className="text-sm text-text-secondary">Auto Booking</span>
                            <span className={`badge ${profile.default_booking_enabled ? 'badge-success' : 'badge-danger'}`}>
                                {profile.default_booking_enabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-bg">
                            <span className="text-sm text-text-secondary">Reset Date</span>
                            <span className="text-sm font-medium text-text">
                                {profile.no_show_reset_date
                                    ? new Date(profile.no_show_reset_date).toLocaleDateString()
                                    : 'N/A'}
                            </span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
