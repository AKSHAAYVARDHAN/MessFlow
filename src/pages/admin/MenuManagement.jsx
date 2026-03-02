import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import { menuService } from '../../services/menuService';
import { useToast } from '../../components/Toast';
import { getToday } from '../../utils/dateHelpers';
import { format } from 'date-fns';

const MEALS = [
    { key: 'breakfast', label: 'Breakfast', icon: '☀️' },
    { key: 'lunch', label: 'Lunch', icon: '🍽️' },
    { key: 'dinner', label: 'Dinner', icon: '🌙' },
];

function parseItems(text) {
    return text
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
}

export default function MenuManagement() {
    const { user } = useAuth();
    const toast = useToast();
    const today = getToday();

    const [selectedDate, setSelectedDate] = useState(today);
    const [menus, setMenus] = useState({}); // { breakfast: {items, id}, lunch: {...}, dinner: {...} }
    const [drafts, setDrafts] = useState({ breakfast: '', lunch: '', dinner: '' }); // textarea text
    const [saving, setSaving] = useState({ breakfast: false, lunch: false, dinner: false });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadMenus(selectedDate);
    }, [selectedDate]);

    async function loadMenus(date) {
        setLoading(true);
        try {
            const rows = await menuService.getMenusByDate(date);
            const map = {};
            rows.forEach((r) => (map[r.meal_type] = r));
            setMenus(map);
            // populate drafts from saved data
            setDrafts({
                breakfast: map.breakfast?.items || '',
                lunch: map.lunch?.items || '',
                dinner: map.dinner?.items || '',
            });
        } catch (err) {
            console.error('Failed to load menus:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave(mealType) {
        setSaving((s) => ({ ...s, [mealType]: true }));
        try {
            await menuService.upsertMenu(selectedDate, mealType, drafts[mealType], user.id);
            toast.success(
                'Menu saved!',
                `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} menu updated. Announcement created.`
            );
            await loadMenus(selectedDate);
        } catch (err) {
            console.error('Failed to save menu:', err);
            toast.error('Save failed', err.message || 'Please try again.');
        } finally {
            setSaving((s) => ({ ...s, [mealType]: false }));
        }
    }

    const friendlyDate = selectedDate
        ? format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')
        : '';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-text">Menu Management</h2>
                    <p className="text-sm text-text-secondary mt-0.5">
                        Set the daily menu for each meal. Saving auto-creates an announcement.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-text-secondary">Date:</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="input w-auto"
                    />
                </div>
            </div>

            {selectedDate && (
                <p className="text-sm text-primary font-medium -mt-2">
                    📅 {friendlyDate}
                </p>
            )}

            {/* Meal sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {MEALS.map(({ key, label, icon }) => {
                    const saved = menus[key];
                    const savedItems = saved ? parseItems(saved.items) : [];
                    const hasChanges = drafts[key] !== (saved?.items || '');

                    return (
                        <Card key={key} title={label} icon={icon}>
                            {loading ? (
                                <div className="skeleton h-32 w-full" />
                            ) : (
                                <div className="space-y-3">
                                    {/* Saved preview */}
                                    {savedItems.length > 0 && (
                                        <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                                            <p className="text-xs font-semibold text-success mb-2">
                                                ✓ Currently saved
                                            </p>
                                            <ul className="space-y-1">
                                                {savedItems.map((item, i) => (
                                                    <li key={i} className="text-xs text-text-secondary flex items-start gap-1.5">
                                                        <span className="text-text-muted mt-0.5">•</span>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Editor */}
                                    <div>
                                        <label className="label">
                                            Menu Items <span className="text-text-muted font-normal">(one per line)</span>
                                        </label>
                                        <textarea
                                            value={drafts[key]}
                                            onChange={(e) =>
                                                setDrafts((d) => ({ ...d, [key]: e.target.value }))
                                            }
                                            className="input text-sm"
                                            rows={5}
                                            placeholder={`e.g.\nIdly\nSambar\nChutney`}
                                            style={{ resize: 'vertical' }}
                                        />
                                    </div>

                                    <button
                                        onClick={() => handleSave(key)}
                                        disabled={saving[key] || !drafts[key].trim()}
                                        className={`btn w-full text-sm ${hasChanges && drafts[key].trim()
                                                ? 'btn-primary'
                                                : 'btn-ghost'
                                            }`}
                                    >
                                        {saving[key] ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Saving…
                                            </span>
                                        ) : saved ? (
                                            '💾 Update Menu'
                                        ) : (
                                            '💾 Save Menu'
                                        )}
                                    </button>
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>

            {/* Info note */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15">
                <span className="text-xl flex-shrink-0">💡</span>
                <div>
                    <p className="text-sm font-semibold text-primary">Auto Announcement</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                        Every time you save a menu, an announcement is automatically created and
                        students will see it on their dashboard for the selected date.
                    </p>
                </div>
            </div>
        </div>
    );
}
