/**
 * Central booking time logic for MessFlow.
 * All meal booking cutoff rules and time helpers live here.
 * Used by Dashboard (TodayStatus), LunchSlots, and DinnerSlots.
 */

export const MEAL_TIMES = {
    breakfast: {
        start: { h: 6, m: 45 },
        cutoff: { h: 8, m: 30 },
    },
    lunch: {
        start: { h: 11, m: 0 },
        cutoff: { h: 13, m: 30 },
    },
    dinner: {
        start: { h: 18, m: 45 },
        cutoff: { h: 20, m: 30 },
    },
};

/** Returns current time in total minutes since midnight. */
export function getCurrentMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

/** Returns the cutoff time for a meal in minutes since midnight. */
export function getMealCutoffMinutes(meal) {
    const t = MEAL_TIMES[meal].cutoff;
    return t.h * 60 + t.m;
}

/**
 * Returns true if the booking/slot window for a meal is CLOSED
 * (i.e. current time is past the cutoff).
 * In tomorrow-booking mode (past 8:30 PM), all meals are open.
 */
export function isMealClosed(meal) {
    const now = getCurrentMinutes();
    return now > getMealCutoffMinutes(meal);
}

/**
 * Returns remaining seconds until the cutoff for a meal.
 * Returns 0 if the cutoff has already passed.
 */
export function secondsUntilCutoff(meal) {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setHours(MEAL_TIMES[meal].cutoff.h, MEAL_TIMES[meal].cutoff.m, 0, 0);
    return Math.max(0, Math.floor((cutoff - now) / 1000));
}

/**
 * Formats seconds into a human-readable countdown string.
 * Shows "Xh Ym Zs" when hours > 0, or "Ym Zs" when under an hour.
 */
export function formatCountdown(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}h ${minutes}m ${String(seconds).padStart(2, '0')}s`;
    }
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}
