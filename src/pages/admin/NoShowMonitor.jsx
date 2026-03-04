import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import { supabase } from '../../services/supabase';
import { schedulerService } from '../../services/schedulerService';
import { useToast } from '../../components/Toast';

function getWarningLevel(count) {
    if (count >= 5) return { label: 'Critical', badge: 'badge-danger', icon: '🔴' };
    if (count >= 3) return { label: 'High', badge: 'badge-danger', icon: '🟠' };
    if (count >= 2) return { label: 'Warning', badge: 'badge-warning', icon: '🟡' };
    return { label: 'Caution', badge: 'badge-warning', icon: '🟡' };
}

function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export default function NoShowMonitor() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [resetModal, setResetModal] = useState(null); // { id, name }
    const [resetting, setResetting] = useState(false);
    const [lastChecked, setLastChecked] = useState(null);
    const toast = useToast();

    useEffect(() => {
        fetchStudents();
    }, []);

    async function fetchStudents() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('users')
                .select('id, name, email, no_show_count, default_booking_enabled, last_no_show_date')
                .eq('role', 'student')
                .gte('no_show_count', 1)
                .order('no_show_count', { ascending: false });
            if (error) throw error;
            setStudents(data || []);
            setLastChecked(new Date());
        } catch (err) {
            console.error('Failed to fetch students:', err);
            toast.error('Load failed', 'Could not fetch student data.');
        } finally {
            setLoading(false);
        }
    }

    async function handleRunCheck() {
        try {
            setRunning(true);
            const result = await schedulerService.runNoShowDetection();
            toast.success(
                'No-Show Check Complete',
                `${result.marked} student${result.marked !== 1 ? 's' : ''} marked as no-show.` +
                (result.skippedLeave > 0 ? ` ${result.skippedLeave} on leave skipped.` : '')
            );
            await fetchStudents();
        } catch (err) {
            console.error('No-show check failed:', err);
            toast.error('Check failed', err.message || 'Please try again.');
        } finally {
            setRunning(false);
        }
    }

    async function handleReset() {
        if (!resetModal || resetting) return;
        try {
            setResetting(true);
            await schedulerService.resetStudentNoShow(resetModal.id);
            toast.success('Reset successful', `${resetModal.name}'s no-show count has been reset.`);
            setResetModal(null);
            await fetchStudents();
        } catch (err) {
            console.error('Reset failed:', err);
            toast.error('Reset failed', err.message || 'Please try again.');
        } finally {
            setResetting(false);
        }
    }

    const criticalCount = students.filter((s) => s.no_show_count >= 3).length;
    const warningCount = students.filter((s) => s.no_show_count >= 2 && s.no_show_count < 3).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h2 className="page-title">No-Show Monitor</h2>
                    <p className="page-subtitle">Students with missed meals — sorted by no-show count</p>
                </div>
                <button
                    onClick={handleRunCheck}
                    disabled={running}
                    className="btn btn-primary"
                >
                    {running ? (
                        <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Running Check…
                        </span>
                    ) : (
                        '▶ Run No-Show Check'
                    )}
                </button>
            </div>

            {/* Summary chips */}
            {!loading && students.length > 0 && (
                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border">
                        <span className="text-sm font-semibold text-text">{students.length}</span>
                        <span className="text-xs text-text-muted">students flagged</span>
                    </div>
                    {criticalCount > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-danger/5 border border-danger/20">
                            <span className="text-danger text-sm font-semibold">{criticalCount}</span>
                            <span className="text-xs text-danger/80">critical (3+)</span>
                        </div>
                    )}
                    {warningCount > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-warning/5 border border-warning/20">
                            <span className="text-warning text-sm font-semibold">{warningCount}</span>
                            <span className="text-xs text-warning/80">warning (2)</span>
                        </div>
                    )}
                </div>
            )}

            {/* Info strip */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-lg flex-shrink-0">ℹ️</span>
                <p className="text-xs text-amber-800 leading-relaxed">
                    The check marks unscanned bookings as <strong>no_show</strong> after each meal window closes
                    (Breakfast: 9AM · Lunch: 2PM · Dinner: 9PM). Students on approved leave are automatically skipped.
                    After <strong>3 no-shows</strong>, auto-booking is disabled.
                </p>
            </div>

            {/* Main table / empty state */}
            <Card>
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="skeleton h-16 w-full" />
                        ))}
                    </div>
                ) : students.length === 0 ? (
                    /* ── Big green "all clear" card ── */
                    <div className="flex flex-col items-center justify-center py-14 gap-5">
                        <div className="w-24 h-24 rounded-full bg-success/10 flex items-center justify-center shadow-inner">
                            <span className="text-5xl">✅</span>
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-extrabold text-success">No No-Shows Recorded</h3>
                            <p className="text-sm text-text-secondary mt-1.5">
                                All scanned students attended their booked meals.
                            </p>
                            {lastChecked && (
                                <p className="text-xs text-text-muted mt-2">
                                    Last data fetch: {lastChecked.toLocaleString('en-IN', {
                                        day: '2-digit', month: 'short',
                                        hour: '2-digit', minute: '2-digit',
                                    })}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={handleRunCheck}
                            disabled={running}
                            className="btn btn-outline btn-sm"
                        >
                            {running ? 'Running…' : '▶ Run No-Show Check'}
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border">
                                    {[
                                        { label: 'Student', align: 'left' },
                                        { label: 'No-Shows', align: 'center' },
                                        { label: 'Warning Level', align: 'center' },
                                        { label: 'Last Missed', align: 'left' },
                                        { label: 'Auto-Booking', align: 'center' },
                                        { label: 'Action', align: 'right' },
                                    ].map(({ label, align }) => (
                                        <th
                                            key={label}
                                            className={`text-${align} text-xs font-semibold text-text-muted uppercase tracking-wider py-3 px-4`}
                                        >
                                            {label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student) => {
                                    const isDisabled = !student.default_booking_enabled;
                                    const isDanger = student.no_show_count >= 3;
                                    const isWarning = student.no_show_count === 2;
                                    const warning = getWarningLevel(student.no_show_count);

                                    return (
                                        <tr
                                            key={student.id}
                                            className={`border-b border-border last:border-0 transition-colors ${isDanger ? 'bg-danger/5 hover:bg-danger/8'
                                                    : isWarning ? 'bg-warning/5 hover:bg-warning/8'
                                                        : 'hover:bg-surface-hover'
                                                }`}
                                        >
                                            <td className="py-3.5 px-4">
                                                <p className="text-sm font-semibold text-text">{student.name}</p>
                                                <p className="text-xs text-text-muted">{student.email}</p>
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <span className={`badge text-sm font-bold px-3 ${warning.badge}`}>
                                                    {student.no_show_count}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <span className={`badge text-xs ${warning.badge}`}>
                                                    {warning.icon} {warning.label}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <p className="text-sm text-text-secondary">
                                                    {formatDate(student.last_no_show_date)}
                                                </p>
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                {isDisabled ? (
                                                    <span className="badge badge-danger">Disabled</span>
                                                ) : (
                                                    <span className="badge badge-success">Active</span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                {isDanger && (
                                                    <button
                                                        onClick={() => setResetModal({ id: student.id, name: student.name })}
                                                        className="btn btn-outline btn-sm"
                                                    >
                                                        Reset Count
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Reset Confirmation Modal */}
            <Modal
                isOpen={!!resetModal}
                onClose={() => !resetting && setResetModal(null)}
                title="Reset No-Show Count?"
            >
                <div className="space-y-5">
                    <div className="bg-warning/10 border border-warning/25 rounded-xl p-4">
                        <p className="text-sm font-semibold text-warning mb-1">⚠️ Confirm Reset</p>
                        <p className="text-sm text-text-secondary">
                            This will reset <strong>{resetModal?.name}</strong>'s no-show count to{' '}
                            <strong>0</strong> and re-enable their auto-booking.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setResetModal(null)}
                            disabled={resetting}
                            className="btn btn-secondary flex-1"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleReset}
                            disabled={resetting}
                            className="btn btn-primary flex-1"
                        >
                            {resetting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Resetting…
                                </span>
                            ) : 'Yes, Reset'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
