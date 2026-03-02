/**
 * scanService — QR Scan Validation Service
 *
 * Handles all logic for validating and recording meal-entry QR scans.
 * Does NOT modify bookingService; operates independently.
 */
import { supabase } from './supabase';
import { parseQRData } from '../utils/qrHelpers';
import { isWithinMealWindow, getMealWindowLabel } from '../utils/mealWindows';
import { format } from 'date-fns';

export const scanService = {
    /**
     * Validate a raw QR string against the database and mark as scanned.
     *
     * @param {string} qrString   — raw QR code content
     * @param {string} staffId    — auth.uid() of the scanning staff/admin
     * @returns {{ valid: boolean, booking: object|null, studentName: string, reason: string|null }}
     */
    async validateAndScan(qrString, staffId) {
        // 1. Parse QR payload
        const payload = parseQRData(qrString);
        if (!payload || !payload.uid || !payload.date || !payload.meal) {
            return { valid: false, booking: null, studentName: '', reason: 'Invalid QR code format.' };
        }

        const { uid: userId, date, meal: mealType, slot } = payload;
        const today = format(new Date(), 'yyyy-MM-dd');

        // 2. Check date — must be today's booking
        if (date !== today) {
            return { valid: false, booking: null, studentName: '', reason: `QR is for ${date}, not today.` };
        }

        // 3. Check meal time window
        if (!isWithinMealWindow(mealType)) {
            const windowLabel = getMealWindowLabel(mealType);
            const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);
            return {
                valid: false,
                booking: null,
                studentName: '',
                reason: `${mealLabel} window closed. Allowed: ${windowLabel}`,
            };
        }

        // 4. Look up booking in DB — fetch student name too
        const { data: bookings, error } = await supabase
            .from('bookings')
            .select('*, users(name, email)')
            .eq('user_id', userId)
            .eq('date', date)
            .eq('meal_type', mealType)
            .limit(1);

        if (error) {
            console.error('Scan DB lookup error:', error);
            return { valid: false, booking: null, studentName: '', reason: 'Database error. Try again.' };
        }

        if (!bookings || bookings.length === 0) {
            return { valid: false, booking: null, studentName: '', reason: 'No booking found for today.' };
        }

        const booking = bookings[0];
        const studentName = booking.users?.name || 'Unknown Student';

        // 5. Check booking status
        if (booking.status === 'cancelled') {
            return { valid: false, booking, studentName, reason: 'Booking was cancelled.' };
        }

        if (booking.status === 'scanned') {
            const scannedAt = booking.scanned_at
                ? format(new Date(booking.scanned_at), 'hh:mm a')
                : 'earlier';
            return {
                valid: false,
                booking,
                studentName,
                reason: `Already scanned at ${scannedAt}.`,
            };
        }

        if (booking.status !== 'booked') {
            return { valid: false, booking, studentName, reason: `Booking status: ${booking.status}` };
        }

        // 6. All checks passed — mark as scanned
        const { data: updated, error: updateError } = await supabase
            .from('bookings')
            .update({
                status: 'scanned',
                scanned_at: new Date().toISOString(),
                scanned_by: staffId,
            })
            .eq('id', booking.id)
            .eq('status', 'booked') // extra guard against race conditions
            .select()
            .single();

        if (updateError || !updated) {
            // If update affected 0 rows, it was scanned by someone else simultaneously
            return {
                valid: false,
                booking,
                studentName,
                reason: 'Scan conflict — this booking was just scanned by another device.',
            };
        }

        return {
            valid: true,
            booking: { ...updated, users: booking.users },
            studentName,
            reason: null,
        };
    },

    /**
     * Fetch scan logs for admin panel.
     *
     * @param {string} date       — 'yyyy-MM-dd' (default: today)
     * @param {string|null} mealType — filter by meal type (optional)
     * @returns {Array}
     */
    async getScanLogs(date, mealType = null) {
        let query = supabase
            .from('bookings')
            .select(`
                id,
                date,
                meal_type,
                slot_time,
                scanned_at,
                scanned_by,
                users!bookings_user_id_fkey(name, email),
                scanner:users!bookings_scanned_by_fkey(name)
            `)
            .eq('date', date)
            .not('scanned_at', 'is', null)
            .order('scanned_at', { ascending: false });

        if (mealType) {
            query = query.eq('meal_type', mealType);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },
};
