/**
 * Meal time windows for QR scan validation.
 * Format: { start: [hour, minute], end: [hour, minute] } — 24-hour time.
 */
export const MEAL_WINDOWS = {
    breakfast: { start: [6, 30], end: [9, 0], label: '6:30 AM – 9:00 AM' },
    lunch: { start: [11, 0], end: [14, 0], label: '11:00 AM – 2:00 PM' },
    dinner: { start: [18, 30], end: [21, 0], label: '6:30 PM – 9:00 PM' },
};

/**
 * Returns true if the current local time is within the allowed
 * scan window for the given meal type.
 *
 * @param {string} mealType — 'breakfast' | 'lunch' | 'dinner'
 * @returns {boolean}
 */
export function isWithinMealWindow(mealType) {
    const window = MEAL_WINDOWS[mealType];
    if (!window) return false;

    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const nowMinutes = h * 60 + m;

    const start = window.start[0] * 60 + window.start[1];
    const end = window.end[0] * 60 + window.end[1];

    return nowMinutes >= start && nowMinutes <= end;
}

/**
 * Returns a human-readable window string for a meal type.
 * @param {string} mealType
 * @returns {string}
 */
export function getMealWindowLabel(mealType) {
    return MEAL_WINDOWS[mealType]?.label || '';
}
