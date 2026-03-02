import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import { announcementService } from '../../services/announcementService';
import { formatDate } from '../../utils/dateHelpers';

const MEAL_BADGE = {
    breakfast: { label: 'Breakfast', cls: 'badge-warning' },
    lunch: { label: 'Lunch', cls: 'badge-info' },
    dinner: { label: 'Dinner', cls: 'badge-info' },
    all: { label: 'All Meals', cls: 'badge-success' },
};

const EMPTY_FORM = {
    title: '',
    description: '',
    mealType: '',
    date: new Date().toISOString().split('T')[0],
    isImportant: false,
};

export default function Announcements() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => { fetchAnnouncements(); }, []);

    async function fetchAnnouncements() {
        try {
            setLoading(true);
            const data = await announcementService.getAnnouncements(50);
            setAnnouncements(data);
        } catch (err) {
            console.error('Failed to fetch announcements:', err);
        } finally {
            setLoading(false);
        }
    }

    function startEdit(ann) {
        setEditingId(ann.id);
        setForm({
            title: ann.title,
            description: ann.description || '',
            mealType: ann.meal_type || '',
            date: ann.date,
            isImportant: ann.is_important || false,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function cancelEdit() {
        setEditingId(null);
        setForm(EMPTY_FORM);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingId) {
                await announcementService.updateAnnouncement(editingId, {
                    title: form.title,
                    description: form.description,
                    mealType: form.mealType || null,
                    date: form.date,
                    isImportant: form.isImportant,
                });
                setEditingId(null);
            } else {
                await announcementService.createAnnouncement(
                    form.title,
                    form.description,
                    form.mealType || null,
                    form.date,
                    form.isImportant
                );
            }
            setForm(EMPTY_FORM);
            await fetchAnnouncements();
        } catch (err) {
            console.error('Failed to save announcement:', err);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Delete this announcement?')) return;
        try {
            await announcementService.deleteAnnouncement(id);
            await fetchAnnouncements();
        } catch (err) {
            console.error('Failed to delete announcement:', err);
        }
    }

    async function handleToggleImportant(ann) {
        try {
            await announcementService.updateAnnouncement(ann.id, {
                title: ann.title,
                description: ann.description,
                mealType: ann.meal_type,
                date: ann.date,
                isImportant: !ann.is_important,
            });
            await fetchAnnouncements();
        } catch (err) {
            console.error('Failed to toggle importance:', err);
        }
    }

    const filtered = announcements.filter((ann) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            ann.title?.toLowerCase().includes(q) ||
            ann.description?.toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Page Header */}
            <div>
                <h2 className="page-title">Announcements</h2>
                <p className="page-subtitle">Post menu updates and notices for students</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ── Create / Edit Form ── */}
                <Card
                    title={editingId ? 'Edit Announcement' : 'New Announcement'}
                    icon={editingId ? '✏️' : '📢'}
                >
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="label">Title *</label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                className="input"
                                placeholder="e.g., Special Menu Today"
                                required
                            />
                        </div>

                        <div>
                            <label className="label">Description</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                className="input"
                                rows={3}
                                placeholder="Announcement details..."
                                style={{ resize: 'vertical' }}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label">Meal Type</label>
                                <select
                                    value={form.mealType}
                                    onChange={(e) => setForm({ ...form, mealType: e.target.value })}
                                    className="input"
                                >
                                    <option value="">All Meals</option>
                                    <option value="breakfast">Breakfast</option>
                                    <option value="lunch">Lunch</option>
                                    <option value="dinner">Dinner</option>
                                    <option value="all">All (explicit)</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">Date *</label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                                    className="input"
                                    required
                                />
                            </div>
                        </div>

                        {/* Important toggle */}
                        <div
                            className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${form.isImportant ? 'bg-amber-50 border-amber-200' : 'bg-surface-hover border-border'}`}
                            onClick={() => setForm({ ...form, isImportant: !form.isImportant })}
                        >
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setForm({ ...form, isImportant: !form.isImportant }); }}
                                className={`toggle ${form.isImportant ? 'active' : ''}`}
                            />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-text">Mark as Important</p>
                                <p className="text-xs text-text-muted">Highlighted with amber border for students</p>
                            </div>
                            {form.isImportant && <span className="text-lg">⭐</span>}
                        </div>

                        <div className="flex gap-2 pt-1">
                            {editingId && (
                                <button type="button" onClick={cancelEdit} className="btn btn-secondary flex-1">
                                    Cancel
                                </button>
                            )}
                            <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
                                {submitting
                                    ? (editingId ? 'Saving...' : 'Posting...')
                                    : (editingId ? '💾 Save Changes' : '📢 Post Announcement')
                                }
                            </button>
                        </div>
                    </form>
                </Card>

                {/* ── Announcement List ── */}
                <Card title={`Announcements (${filtered.length})`} icon="📋">
                    {/* Search */}
                    <div className="relative mb-4">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">🔍</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pl-9"
                            placeholder="Search announcements..."
                        />
                    </div>

                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="skeleton h-24 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📭</div>
                            <p className="empty-state-text">
                                {searchQuery ? 'No results found' : 'No announcements yet'}
                            </p>
                            <p className="empty-state-sub">
                                {searchQuery ? 'Try a different search term.' : 'Create your first announcement using the form.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                            {filtered.map((ann) => {
                                const badge = MEAL_BADGE[ann.meal_type];
                                const isEditing = editingId === ann.id;
                                return (
                                    <div
                                        key={ann.id}
                                        className={`p-3.5 rounded-xl border transition-all ${ann.is_important
                                            ? 'bg-amber-50 border-amber-200 border-l-4 border-l-amber-400'
                                            : isEditing
                                                ? 'bg-blue-50 border-blue-200'
                                                : 'bg-surface-hover border-border'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                    {ann.is_important && <span className="text-sm">⭐</span>}
                                                    <h4 className={`text-sm font-semibold ${ann.is_important ? 'text-amber-900' : 'text-text'}`}>
                                                        {ann.title}
                                                    </h4>
                                                    {ann.is_important && (
                                                        <span className="badge badge-warning text-xs">Important</span>
                                                    )}
                                                </div>
                                                {ann.description && (
                                                    <p className="text-xs text-text-secondary mt-0.5 mb-2 line-clamp-2">{ann.description}</p>
                                                )}
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs text-text-muted">📅 {formatDate(ann.date)}</span>
                                                    {badge && (
                                                        <span className={`badge ${badge.cls} text-xs`}>{badge.label}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                {/* Toggle important */}
                                                <button
                                                    onClick={() => handleToggleImportant(ann)}
                                                    className={`btn btn-sm p-1.5 ${ann.is_important ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'btn-ghost text-text-muted'}`}
                                                    title={ann.is_important ? 'Remove important' : 'Mark important'}
                                                >
                                                    ⭐
                                                </button>
                                                <button
                                                    onClick={() => startEdit(ann)}
                                                    className="btn btn-ghost btn-sm p-1.5 text-primary hover:bg-primary/10"
                                                    title="Edit"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(ann.id)}
                                                    className="btn btn-ghost btn-sm p-1.5 text-danger hover:bg-danger/10"
                                                    title="Delete"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
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
