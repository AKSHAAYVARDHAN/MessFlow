/**
 * ScanLogs — Admin page showing scan activity log.
 * Displays all bookings that have been scanned, with filters for date and meal type.
 */
import { useState, useEffect } from 'react';
import { scanService } from '../../services/scanService';
import { format } from 'date-fns';
import { getToday } from '../../utils/dateHelpers';
import Card from '../../components/Card';

const MEAL_OPTIONS = [
    { value: '', label: 'All Meals' },
    { value: 'breakfast', label: '☀️ Breakfast' },
    { value: 'lunch', label: '🍽️ Lunch' },
    { value: 'dinner', label: '🌙 Dinner' },
];

const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const MEAL_ICON = { breakfast: '☀️', lunch: '🍽️', dinner: '🌙' };

export default function ScanLogs() {
    const today = getToday();
    const [date, setDate] = useState(today);
    const [mealFilter, setMeal] = useState('');
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    async function fetchLogs() {
        setLoading(true);
        setError(null);
        try {
            const data = await scanService.getScanLogs(date, mealFilter || null);
            setLogs(data);
        } catch (err) {
            console.error('Failed to load scan logs:', err);
            setError('Failed to load scan logs. Check that the migration_scan.sql has been run.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchLogs(); }, [date, mealFilter]);

    function formatTime(ts) {
        if (!ts) return '—';
        try { return format(new Date(ts), 'hh:mm:ss a'); }
        catch { return ts; }
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="page-title">Scan Logs</h2>
                    <p className="page-subtitle">Real-time entry validation records</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border">
                    <span style={{ fontSize: '18px' }}>📷</span>
                    <span className="text-sm font-semibold text-text">{logs.length} scans</span>
                </div>
            </div>

            {/* Filters */}
            <Card title="Filters" icon="🔍">
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Date</label>
                        <input
                            type="date"
                            value={date}
                            max={today}
                            onChange={(e) => setDate(e.target.value)}
                            className="input"
                            style={{ minWidth: '160px' }}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Meal Type</label>
                        <select
                            value={mealFilter}
                            onChange={(e) => setMeal(e.target.value)}
                            className="input"
                            style={{ minWidth: '160px' }}
                        >
                            {MEAL_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                    <button onClick={fetchLogs} className="btn btn-primary">
                        Refresh
                    </button>
                </div>
            </Card>

            {/* Logs Table */}
            <Card title="Entry Records" icon="📋">
                {error && (
                    <div className="p-4 rounded-xl bg-danger/5 border border-danger/20 text-danger text-sm">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="skeleton h-14 w-full rounded-xl" />
                        ))}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="empty-state py-10">
                        <div className="empty-state-icon">📷</div>
                        <p className="empty-state-text">No scan records found</p>
                        <p className="empty-state-sub">
                            No entries were scanned{mealFilter ? ` for ${MEAL_LABEL[mealFilter]}` : ''} on {date}.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    {['Student', 'Meal', 'Slot', 'Scan Time', 'Scanned By'].map((col) => (
                                        <th key={col} style={{
                                            padding: '10px 12px',
                                            textAlign: 'left',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            color: 'var(--color-text-secondary)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.06em',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log, idx) => (
                                    <tr
                                        key={log.id}
                                        style={{
                                            borderBottom: '1px solid var(--color-border)',
                                            background: idx % 2 === 0 ? 'transparent' : 'var(--color-surface-hover)',
                                            transition: 'background 0.15s',
                                        }}
                                    >
                                        {/* Student */}
                                        <td style={{ padding: '12px 12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '32px', height: '32px', borderRadius: '8px',
                                                    background: 'var(--color-primary-10)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 700, fontSize: '13px', color: 'var(--color-primary)',
                                                    flexShrink: 0,
                                                }}>
                                                    {log.users?.name?.charAt(0)?.toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text)' }}>
                                                        {log.users?.name || '—'}
                                                    </p>
                                                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                                        {log.users?.email || ''}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Meal */}
                                        <td style={{ padding: '12px 12px' }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                fontSize: '12px', fontWeight: 600,
                                                color: 'var(--color-text)',
                                                background: 'var(--color-surface-hover)',
                                                border: '1px solid var(--color-border)',
                                                padding: '3px 10px', borderRadius: '20px',
                                            }}>
                                                {MEAL_ICON[log.meal_type]} {MEAL_LABEL[log.meal_type] || log.meal_type}
                                            </span>
                                        </td>

                                        {/* Slot */}
                                        <td style={{ padding: '12px 12px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                                            {log.slot_time || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                                        </td>

                                        {/* Scan Time */}
                                        <td style={{ padding: '12px 12px' }}>
                                            <span style={{
                                                fontSize: '13px', fontWeight: 600, color: 'var(--color-success)',
                                                fontVariantNumeric: 'tabular-nums',
                                            }}>
                                                {formatTime(log.scanned_at)}
                                            </span>
                                        </td>

                                        {/* Scanned By */}
                                        <td style={{ padding: '12px 12px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                                            {log.scanner?.name || (log.scanned_by ? log.scanned_by.slice(0, 8) + '…' : '—')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ padding: '12px 12px 4px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            Showing {logs.length} record{logs.length !== 1 ? 's' : ''} for {date}
                            {mealFilter ? ` · ${MEAL_LABEL[mealFilter]}` : ''}
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
