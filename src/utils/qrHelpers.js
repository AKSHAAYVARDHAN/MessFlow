export function generateQRData(userId, date, mealType, slotTime = null) {
    const payload = {
        uid: userId,
        date,
        meal: mealType,
        slot: slotTime,
        ts: Date.now(),
        token: Math.random().toString(36).substring(2, 10),
    };
    return JSON.stringify(payload);
}

export function parseQRData(qrString) {
    try {
        return JSON.parse(qrString);
    } catch {
        return null;
    }
}
