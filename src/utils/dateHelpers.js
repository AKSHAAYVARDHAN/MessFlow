import { format, isToday, isTomorrow, parseISO, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { CANCELLATION_DEADLINES } from './constants';

export function formatDate(date) {
    if (typeof date === 'string') date = parseISO(date);
    return format(date, 'MMM dd, yyyy');
}

export function formatDateShort(date) {
    if (typeof date === 'string') date = parseISO(date);
    return format(date, 'MMM dd');
}

export function formatTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

export function getToday() {
    return format(new Date(), 'yyyy-MM-dd');
}

export function getRelativeDay(date) {
    if (typeof date === 'string') date = parseISO(date);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM dd');
}

export function getTimeRemaining(deadline) {
    const now = new Date();
    const target = new Date();
    target.setHours(deadline.hour, deadline.minute, 0, 0);

    const secs = differenceInSeconds(target, now);
    if (secs <= 0) return null;

    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;

    return {
        hours,
        mins,
        seconds,
        total: secs,
        display: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    };
}

export function canCancelMeal(mealType) {
    const remaining = getTimeRemaining(CANCELLATION_DEADLINES[mealType]);
    return remaining !== null && remaining.total > 0;
}

export function getCancellationDeadlineLabel(mealType) {
    const d = CANCELLATION_DEADLINES[mealType];
    if (!d) return '';
    const h = d.hour;
    const m = d.minute;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const displayMin = String(m).padStart(2, '0');
    return `${displayHour}:${displayMin} ${period}`;
}
