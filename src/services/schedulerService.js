import { supabase } from './supabase';
import { format, subDays } from 'date-fns';
import { generateQRData } from '../utils/qrHelpers';

export const schedulerService = {
    /**
     * Auto-booking generator: creates bookings for all students
     * with default_booking_enabled = true who aren't on leave.
     */
    async runAutoBooking() {
        const today = format(new Date(), 'yyyy-MM-dd');

        // Get all students with default booking enabled
        const { data: students, error: studentsError } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'student')
            .eq('default_booking_enabled', true);

        if (studentsError) throw studentsError;

        const meals = ['breakfast', 'lunch', 'dinner'];
        let created = 0;

        for (const student of students) {
            // Check if default booking is disabled due to no-shows
            if (student.default_disabled_until && new Date(student.default_disabled_until) > new Date()) {
                continue;
            }

            for (const meal of meals) {
                // Check if on leave
                const { data: leaves } = await supabase
                    .from('leaves')
                    .select('*')
                    .eq('user_id', student.id)
                    .lte('from_date', today)
                    .gte('to_date', today);

                const isOnLeave = leaves?.some((leave) => {
                    const mealOrder = { breakfast: 0, lunch: 1, dinner: 2 };
                    const mealIdx = mealOrder[meal];
                    const fromIdx = mealOrder[leave.from_meal];
                    const toIdx = mealOrder[leave.to_meal];

                    if (today === leave.from_date && today === leave.to_date) {
                        return mealIdx >= fromIdx && mealIdx <= toIdx;
                    }
                    if (today === leave.from_date) return mealIdx >= fromIdx;
                    if (today === leave.to_date) return mealIdx <= toIdx;
                    return true;
                });

                if (isOnLeave) continue;

                // Check if booking already exists
                const { data: existing } = await supabase
                    .from('bookings')
                    .select('id')
                    .eq('user_id', student.id)
                    .eq('date', today)
                    .eq('meal_type', meal)
                    .limit(1);

                if (existing && existing.length > 0) continue;

                // Create booking
                const slotTime = meal === 'dinner' ? student.preferred_dinner_slot : null;
                const qrData = generateQRData(student.id, today, meal, slotTime);

                await supabase.from('bookings').insert({
                    user_id: student.id,
                    date: today,
                    meal_type: meal,
                    slot_time: slotTime,
                    status: 'booked',
                    qr_code: qrData,
                });

                created++;
            }
        }

        return { created };
    },

    /**
     * No-show marker: marks unscanned bookings as no_show
     * and updates the user's no_show_count.
     */
    async runNoShowMarker() {
        const today = format(new Date(), 'yyyy-MM-dd');

        // Find all bookings that are still 'booked' (not cancelled or scanned)
        const { data: unscanned, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('date', today)
            .eq('status', 'booked');

        if (error) throw error;

        let marked = 0;

        for (const booking of (unscanned || [])) {
            // Mark as no_show
            await supabase
                .from('bookings')
                .update({ status: 'no_show' })
                .eq('id', booking.id);

            // Increment no_show_count
            const { data: user } = await supabase
                .from('users')
                .select('no_show_count, no_show_reset_date')
                .eq('id', booking.user_id)
                .single();

            if (user) {
                const newCount = (user.no_show_count || 0) + 1;
                const updates = { no_show_count: newCount };

                // If 5 no-shows, disable default booking for 30 days
                if (newCount >= 5) {
                    const disableUntil = new Date();
                    disableUntil.setDate(disableUntil.getDate() + 30);
                    updates.default_booking_enabled = false;
                    updates.default_disabled_until = disableUntil.toISOString();
                }

                await supabase
                    .from('users')
                    .update(updates)
                    .eq('id', booking.user_id);
            }

            marked++;
        }

        return { marked };
    },

    /**
     * 30-day reset: resets no_show_count for users whose reset date has passed.
     */
    async runResetCheck() {
        const now = new Date().toISOString();

        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .gt('no_show_count', 0)
            .lte('no_show_reset_date', now);

        if (error) throw error;

        let reset = 0;

        for (const user of (users || [])) {
            const resetDate = new Date();
            resetDate.setDate(resetDate.getDate() + 30);

            await supabase
                .from('users')
                .update({
                    no_show_count: 0,
                    no_show_reset_date: resetDate.toISOString(),
                    default_disabled_until: null,
                    default_booking_enabled: true,
                })
                .eq('id', user.id);

            reset++;
        }

        return { reset };
    },
};
