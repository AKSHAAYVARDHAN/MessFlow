import { useState, useEffect } from 'react';
import { announcementService } from '../../services/announcementService';
import { getToday, formatDate } from '../../utils/dateHelpers';

const MEAL_BADGE = {
    breakfast: { label: 'Breakfast', cls: 'badge-warning' },
    lunch: { label: 'Lunch', cls: 'badge-info' },
    dinner: { label: 'Dinner', cls: 'badge-info' },
    all: { label: 'All Meals', cls: 'badge-success' },
};

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'today', label: 'Today' },
    { key: 'important', label: '⭐ Important' },
];

export default function StudentAnnouncements() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('all');

    const today = getToday();

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                const data = await announcementService.getAnnouncements(50);
                setAnnouncements(data);

                // Mark today's announcements as seen
                const seenKey = `ann_seen_${today}`;
                sessionStorage.setItem(seenKey, '1');
            } catch (err) {
                console.error('Failed to load announcements:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [today]);

    const filtered = announcements.filter((ann) => {
        if (activeFilter === 'today') return ann.date === today;
        if (activeFilter === 'important') return ann.is_important;
        return true;
    });

    const todayCount = announcements.filter((a) => a.date === today).length;
    const importantCount = announcements.filter((a) => a.is_important).length;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                    <h2 className="page-title">Announcements</h2>
                    <p className="page-subtitle">
                        Stay updated with the latest notices from the mess
                    </p>
                </div>
                {/* Stats pill */}
                <div className="flex items-center gap-2 text-sm shrink-0">
                    {todayCount > 0 && (
                        <span className="badge badge-info">
                            {todayCount} today
                        </span>
                    )}
                    {importantCount > 0 && (
                        <span className="badge badge-warning">
                            ⭐ {importantCount} important
                        </span>
                    )}
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="tab-bar">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        className={`tab-btn ${activeFilter === f.key ? 'active' : ''}`}
                        onClick={() => setActiveFilter(f.key)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="skeleton h-28 w-full rounded-2xl" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            {activeFilter === 'today' ? '📅' : activeFilter === 'important' ? '⭐' : '📭'}
                        </div>
                        <p className="empty-state-text">
                            {activeFilter === 'today'
                                ? 'No announcements for today'
                                : activeFilter === 'important'
                                    ? 'No important announcements'
                                    : 'No announcements yet'}
                        </p>
                        <p className="empty-state-sub">
                            {activeFilter === 'all'
                                ? 'Check back later for updates from the mess.'
                                : 'Try switching to the "All" tab to see everything.'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((ann, idx) => {
                        const badge = MEAL_BADGE[ann.meal_type];
                        const isToday = ann.date === today;

                        return (
                            <div
                                key={ann.id}
                                className={`ann-card animate-fade-in ${ann.is_important ? 'ann-card-important' : ''}`}
                                style={{ animationDelay: `${idx * 0.04}s` }}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Icon */}
                                    <div
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl ${ann.is_important ? 'bg-amber-100' : 'bg-blue-50'}`}
                                    >
                                        {ann.is_important ? '⭐' : '📌'}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <h4 className={`text-[15px] font-semibold ${ann.is_important ? 'text-amber-900' : 'text-text'}`}>
                                                {ann.title}
                                            </h4>
                                            {ann.is_important && (
                                                <span className="badge badge-warning">Important</span>
                                            )}
                                            {isToday && (
                                                <span className="badge badge-success">Today</span>
                                            )}
                                        </div>

                                        {ann.description && (
                                            <p className={`text-sm leading-relaxed mb-2 truncate-2 ${ann.is_important ? 'text-amber-800' : 'text-text-secondary'}`}>
                                                {ann.description}
                                            </p>
                                        )}

                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs text-text-muted font-medium">
                                                📅 {formatDate(ann.date)}
                                            </span>
                                            {badge && (
                                                <span className={`badge ${badge.cls} text-xs`}>
                                                    {badge.label}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
