import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DINNER_SLOTS, LUNCH_SLOTS } from '../../utils/constants';
import { profileStatsService } from '../../services/profileStatsService';
import { format } from 'date-fns';

// ─── Helpers ───────────────────────────────────────────────────────────────

function getInitial(name) {
    return name?.trim()?.charAt(0)?.toUpperCase() || '?';
}

function getNoShowColor(count) {
    if (count >= 3) return 'var(--color-danger)';
    if (count >= 1) return 'var(--color-warning)';
    return 'var(--color-success)';
}

function getProgressColor(count) {
    if (count >= 3) return '#DC2626';
    if (count >= 1) return '#F59E0B';
    return '#16A34A';
}

function getMemberSince(profile) {
    // Try created_at field on profile row
    const raw = profile?.created_at;
    if (!raw) return null;
    try {
        return format(new Date(raw), 'MMM yyyy');
    } catch {
        return null;
    }
}

// ─── Sub-components ────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color = '#2563EB', loading }) {
    return (
        <div
            className="card card-hover flex flex-col items-start gap-3 cursor-default"
            style={{ padding: '20px 22px' }}
        >
            <div
                className="flex items-center justify-center rounded-xl"
                style={{
                    width: 44,
                    height: 44,
                    background: `${color}18`,
                    fontSize: '1.25rem',
                    flexShrink: 0,
                }}
            >
                {icon}
            </div>
            {loading ? (
                <>
                    <div className="skeleton h-7 w-12 rounded" />
                    <div className="skeleton h-3 w-24 rounded" />
                </>
            ) : (
                <div>
                    <p
                        className="text-3xl font-black leading-none"
                        style={{ color, letterSpacing: '-0.03em' }}
                    >
                        {value ?? '—'}
                    </p>
                    <p className="text-xs text-text-muted font-medium mt-1.5">{label}</p>
                </div>
            )}
        </div>
    );
}

function SectionHeader({ icon, title }) {
    return (
        <div className="flex items-center gap-2.5 mb-5">
            <span className="text-xl leading-none">{icon}</span>
            <h3 className="section-title">{title}</h3>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function Profile() {
    const { profile } = useAuth();
    const [stats, setStats] = useState(null);
    const [liveNoShowCount, setLiveNoShowCount] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        if (!profile?.id) return;

        let cancelled = false;
        setStatsLoading(true);

        Promise.all([
            profileStatsService.getMealStatsThisMonth(profile.id),
            profileStatsService.getAttendancePercentage(profile.id),
            profileStatsService.getFeedbackCount(profile.id),
            // Live count directly from bookings — source of truth
            profileStatsService.getNoShowCount(profile.id),
        ])
            .then(([monthStats, attendancePct, feedbackCount, noShowCount]) => {
                if (!cancelled) {
                    setStats({ ...monthStats, attendancePct, feedbackCount });
                    setLiveNoShowCount(noShowCount);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setStats(null);
                    setLiveNoShowCount(0);
                }
            })
            .finally(() => {
                if (!cancelled) setStatsLoading(false);
            });

        return () => { cancelled = true; };
    }, [profile?.id]);

    if (!profile) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // Use live count from bookings table (source of truth).
    // Fall back to profile.no_show_count only while still loading.
    const noShowCount = statsLoading
        ? (profile.no_show_count || 0)
        : (liveNoShowCount ?? 0);

    const autoBookingEnabled = profile.default_booking_enabled;
    const progressPct = Math.min((noShowCount / 3) * 100, 100);
    const progressColor = getProgressColor(noShowCount);
    const memberSince = getMemberSince(profile);

    const preferredLunchLabel = profile.preferred_lunch_slot
        ? LUNCH_SLOTS.find((s) => s.value === profile.preferred_lunch_slot)?.label || profile.preferred_lunch_slot
        : null;

    const preferredDinnerLabel = profile.preferred_dinner_slot
        ? DINNER_SLOTS.find((s) => s.value === profile.preferred_dinner_slot)?.label || profile.preferred_dinner_slot
        : null;

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* ── PART 1 — Identity Card ──────────────────────────────────────── */}
            <div
                className="card card-elevated"
                style={{ padding: '28px 28px', overflow: 'hidden', position: 'relative' }}
            >
                {/* Subtle decorative gradient blob */}
                <div
                    style={{
                        position: 'absolute',
                        top: -40,
                        right: -40,
                        width: 180,
                        height: 180,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(124,58,237,0.07) 100%)',
                        pointerEvents: 'none',
                    }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '22px', flexWrap: 'wrap' }}>
                    {/* Avatar */}
                    <div
                        style={{
                            width: 72,
                            height: 72,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: '0 6px 20px rgba(37,99,235,0.25)',
                        }}
                    >
                        <span style={{ color: 'white', fontSize: '1.75rem', fontWeight: 900, lineHeight: 1 }}>
                            {getInitial(profile.name)}
                        </span>
                    </div>

                    {/* Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                                {profile.name}
                            </h2>
                            <span className="badge badge-student" style={{ fontSize: '0.7rem' }}>
                                🎓 Student
                            </span>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                            {profile.email}
                        </p>
                        {memberSince && (
                            <p style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span>📅</span> Member since {memberSince}
                            </p>
                        )}
                    </div>

                    {/* Auto-booking status pill — top right */}
                    <div style={{ flexShrink: 0 }}>
                        <span className={`badge ${autoBookingEnabled ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.72rem', padding: '0.3rem 0.85rem' }}>
                            {autoBookingEnabled ? '✅ Auto-booking On' : '🚫 Auto-booking Off'}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── PART 2 — No-Show Status ─────────────────────────────────────── */}
            <div>
                <SectionHeader icon="📊" title="No-Show Status" />

                {/* Alert banners */}
                {noShowCount >= 3 && (
                    <div
                        className="animate-scale-in"
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 12,
                            padding: '14px 18px',
                            borderRadius: 14,
                            background: 'rgba(220, 38, 38, 0.06)',
                            border: '1.5px solid rgba(220, 38, 38, 0.25)',
                            marginBottom: 16,
                        }}
                    >
                        <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>🚫</span>
                        <div>
                            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-danger)' }}>
                                Auto-booking disabled due to repeated no-shows.
                            </p>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                                Contact your mess admin to reset your no-show count and re-enable auto-booking.
                            </p>
                        </div>
                    </div>
                )}

                {noShowCount === 2 && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 12,
                            padding: '14px 18px',
                            borderRadius: 14,
                            background: 'rgba(245, 158, 11, 0.08)',
                            border: '1.5px solid rgba(245, 158, 11, 0.3)',
                            marginBottom: 16,
                        }}
                    >
                        <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>⚠️</span>
                        <div>
                            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-warning)' }}>
                                One more no-show will disable auto-booking.
                            </p>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                                Make sure to scan your QR code when you attend meals.
                            </p>
                        </div>
                    </div>
                )}

                {noShowCount < 2 && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '12px 18px',
                            borderRadius: 14,
                            background: 'rgba(22, 163, 74, 0.06)',
                            border: '1.5px solid rgba(22, 163, 74, 0.2)',
                            marginBottom: 16,
                        }}
                    >
                        <span style={{ fontSize: '1.1rem' }}>✅</span>
                        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-success)' }}>
                            Attendance record is good.
                        </p>
                    </div>
                )}

                {/* Progress tracker card */}
                <div className="card" style={{ padding: '24px' }}>
                    {statsLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                            <div className="skeleton h-14 w-16 rounded" />
                            <div style={{ flex: 1 }}>
                                <div className="skeleton h-3 w-32 rounded mb-3" />
                                <div className="skeleton h-3 w-full rounded" />
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                            {/* Big number */}
                            <div style={{ textAlign: 'center', minWidth: 72 }}>
                                <p
                                    style={{
                                        fontSize: '3.5rem',
                                        fontWeight: 900,
                                        lineHeight: 1,
                                        color: getNoShowColor(noShowCount),
                                        letterSpacing: '-0.04em',
                                    }}
                                >
                                    {noShowCount}
                                </p>
                                <p style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>
                                    No-shows
                                </p>
                            </div>

                            {/* Progress + label */}
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                                        {noShowCount} / 3
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                        Auto-booking disables at 3 no-shows
                                    </span>
                                </div>
                                {/* Track */}
                                <div
                                    style={{
                                        width: '100%',
                                        height: 12,
                                        borderRadius: 9999,
                                        background: 'var(--color-border)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        style={{
                                            height: '100%',
                                            width: `${progressPct}%`,
                                            borderRadius: 9999,
                                            background: progressColor,
                                            transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                            boxShadow: `0 2px 8px ${progressColor}55`,
                                            minWidth: noShowCount > 0 ? 16 : 0,
                                        }}
                                    />
                                </div>
                                {/* Tick markers */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                                    {[1, 2, 3].map((tick) => (
                                        <span
                                            key={tick}
                                            style={{
                                                fontSize: '0.65rem',
                                                fontWeight: 600,
                                                color: noShowCount >= tick
                                                    ? progressColor
                                                    : 'var(--color-text-muted)',
                                            }}
                                        >
                                            {tick}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Source note */}
                    <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>🔄</span> Live count from your booking records
                    </p>
                </div>
            </div>

            {/* ── PART 3 — My Meal Stats ───────────────────────────────────────── */}
            <div>
                <SectionHeader icon="🍽️" title="My Meal Stats" />
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: -14, marginBottom: 16 }}>
                    This month's activity · Last 30 days for attendance %
                </p>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
                        gap: 14,
                    }}
                >
                    <StatCard
                        icon="✅"
                        value={stats?.attended}
                        label="Meals Attended"
                        color="#16A34A"
                        loading={statsLoading}
                    />
                    <StatCard
                        icon="❌"
                        value={stats?.cancelled}
                        label="Meals Cancelled"
                        color="#DC2626"
                        loading={statsLoading}
                    />
                    <StatCard
                        icon="⚠️"
                        value={!statsLoading ? noShowCount : null}
                        label="Total No-Shows (all time)"
                        color="#F59E0B"
                        loading={statsLoading}
                    />
                    <StatCard
                        icon="📈"
                        value={stats?.attendancePct != null ? `${stats.attendancePct}%` : 'N/A'}
                        label="Attendance (30 days)"
                        color="#2563EB"
                        loading={statsLoading}
                    />
                    <StatCard
                        icon="⭐"
                        value={stats?.feedbackCount}
                        label="Feedback Submitted"
                        color="#7C3AED"
                        loading={statsLoading}
                    />
                </div>
            </div>

            {/* ── PART 4 — Meal Preferences ────────────────────────────────────── */}
            <div>
                <SectionHeader icon="⚙️" title="Meal Preferences" />

                <div className="card" style={{ padding: '24px' }}>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                            gap: 20,
                        }}
                    >
                        {/* Default Lunch Slot */}
                        <div>
                            <p style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                                Default Lunch Slot
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '1rem' }}>🍽️</span>
                                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: preferredLunchLabel ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                                    {preferredLunchLabel || 'Not set'}
                                </p>
                            </div>
                        </div>

                        {/* Default Dinner Slot */}
                        <div>
                            <p style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                                Default Dinner Slot
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '1rem' }}>🌙</span>
                                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: preferredDinnerLabel ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                                    {preferredDinnerLabel || 'Not set'}
                                </p>
                            </div>
                        </div>

                        {/* Auto-Booking Toggle (read-only) */}
                        <div>
                            <p style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                                Auto-Booking
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {/* Visual toggle — pointer-events disabled (read-only) */}
                                <div
                                    style={{
                                        pointerEvents: 'none',
                                        position: 'relative',
                                        width: 46,
                                        height: 26,
                                        borderRadius: 9999,
                                        background: autoBookingEnabled ? 'var(--color-primary)' : '#CBD5E1',
                                        transition: 'background 0.3s ease',
                                        flexShrink: 0,
                                    }}
                                >
                                    <div
                                        style={{
                                            position: 'absolute',
                                            width: 20,
                                            height: 20,
                                            background: 'white',
                                            borderRadius: '50%',
                                            top: 3,
                                            left: autoBookingEnabled ? 23 : 3,
                                            transition: 'left 0.3s ease',
                                            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                                        }}
                                    />
                                </div>
                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: autoBookingEnabled ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                    {autoBookingEnabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </div>
                        </div>

                        {/* Notification Preference */}
                        <div>
                            <p style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                                Notifications
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '1rem' }}>🔔</span>
                                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                                    In-app only
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ height: 1, background: 'var(--color-border)', margin: '20px 0' }} />

                    {/* Edit Preferences button — UI only */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                            disabled
                            className="btn btn-outline btn-sm"
                            title="Preference editing coming soon"
                            style={{ opacity: 0.45, cursor: 'not-allowed' }}
                        >
                            ✏️ Edit Preferences
                        </button>
                        <p style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)' }}>
                            Preference editing is managed by your mess admin.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── PART 5/6 — Account Info Strip ──────────────────────────────── */}
            <div>
                <SectionHeader icon="🔐" title="Account Details" />
                <div className="card" style={{ padding: '24px' }}>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                            gap: 20,
                        }}
                    >
                        <div>
                            <p style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                                Full Name
                            </p>
                            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>{profile.name}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                                Email Address
                            </p>
                            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>{profile.email}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                                Role
                            </p>
                            <span className="badge badge-student" style={{ fontSize: '0.7rem' }}>
                                {profile.role}
                            </span>
                        </div>
                        {memberSince && (
                            <div>
                                <p style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                                    Member Since
                                </p>
                                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>{memberSince}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
}
