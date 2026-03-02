import { useState } from 'react';

/* ─── Animated Star Rating ─────────────────────────────────────────────────── */
function StarRating({ rating, hoveredRating, onHover, onSelect }) {
    return (
        <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => {
                const active = star <= (hoveredRating || rating);
                return (
                    <button
                        key={star}
                        type="button"
                        onMouseEnter={() => onHover(star)}
                        onMouseLeave={() => onHover(0)}
                        onClick={() => onSelect(star)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            lineHeight: 1,
                            transition: 'transform 0.15s ease',
                            transform: active ? 'scale(1.2)' : 'scale(1)',
                            fontSize: '2rem',
                            filter: active ? 'none' : 'grayscale(1) opacity(0.35)',
                        }}
                        aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                    >
                        ⭐
                    </button>
                );
            })}
        </div>
    );
}

const RATING_LABELS = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent',
};

const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const MEAL_ICONS = { breakfast: '☀️', lunch: '🍽️', dinner: '🌙' };

/* ─── FeedbackModal ────────────────────────────────────────────────────────── */
export default function FeedbackModal({ isOpen, mealType, onClose, onSubmit, submitting }) {
    const [rating, setRating] = useState(0);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitted, setSubmitted] = useState(false);

    function handleClose() {
        if (submitting) return;
        // Reset on close
        setTimeout(() => {
            setRating(0);
            setHoveredRating(0);
            setComment('');
            setSubmitted(false);
        }, 200);
        onClose();
    }

    async function handleSubmit() {
        if (!rating || submitting) return;
        try {
            await onSubmit(rating, comment.trim() || null);
            setSubmitted(true);
        } catch {
            // Error toast handled by parent
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal panel */}
            <div
                className="relative bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-sm mx-4 animate-fade-in overflow-hidden"
            >
                {/* Header */}
                <div
                    className="px-6 pt-6 pb-4 text-center"
                    style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #EEF2FF 100%)' }}
                >
                    <div className="w-14 h-14 rounded-2xl bg-white mx-auto flex items-center justify-center text-3xl shadow-sm mb-3">
                        {MEAL_ICONS[mealType] || '🍽️'}
                    </div>
                    <h3 className="text-base font-bold text-text">
                        Rate Your {MEAL_LABELS[mealType] || 'Meal'}
                    </h3>
                    <p className="text-xs text-text-muted mt-1">How was the food quality?</p>

                    {/* Close button */}
                    <button
                        onClick={handleClose}
                        disabled={submitting}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-white/70 hover:text-text transition-colors"
                    >
                        ✕
                    </button>
                </div>

                <div className="px-6 py-5">
                    {submitted ? (
                        /* ── Success State ── */
                        <div className="flex flex-col items-center justify-center py-6 space-y-3 animate-fade-in">
                            <div
                                className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                                style={{ background: '#DCFCE7', boxShadow: '0 0 0 8px #DCFCE740' }}
                            >
                                ✅
                            </div>
                            <p className="text-base font-bold text-success">Thank you!</p>
                            <p className="text-sm text-text-secondary text-center">
                                Your feedback has been recorded.
                            </p>
                            <button
                                onClick={handleClose}
                                className="btn btn-secondary btn-sm mt-2"
                            >
                                Close
                            </button>
                        </div>
                    ) : (
                        /* ── Rating Form ── */
                        <div className="space-y-5">
                            {/* Star Selector */}
                            <div className="space-y-2">
                                <StarRating
                                    rating={rating}
                                    hoveredRating={hoveredRating}
                                    onHover={setHoveredRating}
                                    onSelect={setRating}
                                />
                                <p
                                    className="text-center text-sm font-semibold transition-all duration-200"
                                    style={{
                                        color: rating ? '#2563EB' : 'transparent',
                                        minHeight: '20px'
                                    }}
                                >
                                    {RATING_LABELS[hoveredRating || rating] || ''}
                                </p>
                            </div>

                            {/* Comment Textarea */}
                            <div>
                                <label className="label">Comment <span className="text-text-muted font-normal">(optional)</span></label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    placeholder="Tell us about the food quality, taste, or portions…"
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                    maxLength={300}
                                    style={{ resize: 'none' }}
                                />
                                <p className="text-right text-xs text-text-muted mt-1">
                                    {comment.length}/300
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleClose}
                                    disabled={submitting}
                                    className="btn btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={!rating || submitting}
                                    className="btn btn-primary flex-1"
                                >
                                    {submitting ? (
                                        <span className="flex items-center gap-2">
                                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Submitting…
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5">
                                            <span>Submit</span>
                                            <span>⭐</span>
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
