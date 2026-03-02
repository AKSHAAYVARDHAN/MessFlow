export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];

export const LUNCH_SLOTS = [
    { label: '11:00 – 11:30', value: '11:00' },
    { label: '11:30 – 12:00', value: '11:30' },
    { label: '12:00 – 12:30', value: '12:00' },
    { label: '12:30 – 1:00', value: '12:30' },
    { label: '1:00 – 1:30', value: '13:00' },
];

export const DINNER_SLOTS = [
    { label: '6:45 – 7:00', value: '18:45' },
    { label: '7:00 – 7:15', value: '19:00' },
    { label: '7:15 – 7:30', value: '19:15' },
    { label: '7:30 – 7:45', value: '19:30' },
    { label: '7:45 – 8:00', value: '19:45' },
    { label: '8:00 – 8:15', value: '20:00' },
    { label: '8:15 – 8:30', value: '20:15' },
];

export const MEAL_ICONS = {
    breakfast: '☀️',
    lunch: '🍽️',
    dinner: '🌙',
};

export const STATUS_COLORS = {
    booked: 'badge-success',
    cancelled: 'badge-muted',
    scanned: 'badge-info',
    no_show: 'badge-danger',
};

export const CANCELLATION_DEADLINES = {
    breakfast: { hour: 6, minute: 30 },
    lunch: { hour: 11, minute: 0 },
    dinner: { hour: 17, minute: 0 },
};
