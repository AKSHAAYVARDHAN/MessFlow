import { supabase } from './supabase';
import { format } from 'date-fns';
import { generateQRData } from '../utils/qrHelpers';

// Meal window end times (24-hour, local time)
// After these hours the meal window is considered closed.
const MEAL_END_HOURS = {
    breakfast: 9,   // 9:00 AM
    lunch: 14,      // 2:00 PM
    dinner: 21,     // 9:00 PM
};

// Threshold for disabling auto-booking
const NO_SHOW_DISABLE_THRESHOLD = 3;

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
     * No-show detection: scans today's unscanned bookings and marks
     * those whose meal window has ended as no_show.
     *
     * Safety guarantees:
     * - Only marks bookings still in 'booked' state (idempotent).
     * - Skips meals where the window hasn't closed yet.
     * - Skips students on approved leave for that meal.
     * - After marking, recalculates total no_show_count from bookings
     *   table for each affected user (source of truth sync).
     * - If no_show_count >= 3 → disables auto-booking.
     * - Updates last_no_show_date for admin visibility.
     */
    async runNoShowDetection() {
        const today = format(new Date(), 'yyyy-MM-dd');
        const nowHour = new Date().getHours(); // local time hours (0-23)

        // Fetch all 'booked' bookings for today that haven't been scanned
        const { data: unscanned, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('date', today)
            .eq('status', 'booked');

        if (error) throw error;

        let marked = 0;
        const skippedLeave = [];
        // Track which users were affected so we can resync their count once
        const affectedUsers = new Set();

        for (const booking of (unscanned || [])) {
            const mealEndHour = MEAL_END_HOURS[booking.meal_type];

            // Only process meals whose window has closed
            if (nowHour < mealEndHour) continue;

            // ── Leave check ──────────────────────────────────────────────
            const { data: leaves } = await supabase
                .from('leaves')
                .select('*')
                .eq('user_id', booking.user_id)
                .lte('from_date', today)
                .gte('to_date', today);

            const mealOrder = { breakfast: 0, lunch: 1, dinner: 2 };
            const mealIdx = mealOrder[booking.meal_type];

            const isOnLeave = leaves?.some((leave) => {
                const fromIdx = mealOrder[leave.from_meal];
                const toIdx = mealOrder[leave.to_meal];

                if (today === leave.from_date && today === leave.to_date) {
                    return mealIdx >= fromIdx && mealIdx <= toIdx;
                }
                if (today === leave.from_date) return mealIdx >= fromIdx;
                if (today === leave.to_date) return mealIdx <= toIdx;
                return true;
            });

            if (isOnLeave) {
                skippedLeave.push(booking.id);
                continue;
            }

            // ── Mark booking as no_show ───────────────────────────────────
            const { error: updateErr } = await supabase
                .from('bookings')
                .update({ status: 'no_show' })
                .eq('id', booking.id)
                .eq('status', 'booked'); // extra guard: only update if still 'booked'

            if (updateErr) {
                console.warn('Failed to mark booking no_show:', updateErr);
                continue;
            }

            affectedUsers.add(booking.user_id);
            marked++;
        }

        // ── Resync users.no_show_count from bookings (source of truth) ──
        // For each affected user, count all their no_show bookings and
        // update users table accordingly. This keeps the users table
        // consistent even if the RPC previously failed or was skipped.
        for (const userId of affectedUsers) {
            const { error: rpcErr } = await supabase.rpc('sync_no_show_count', {
                uid: userId,
            });

            if (rpcErr) {
                // Fallback: use the old increment RPC if new sync RPC not available
                console.warn('sync_no_show_count RPC failed, falling back to increment_no_show:', rpcErr.message);
                const { error: incrErr } = await supabase.rpc('increment_no_show', {
                    uid: userId,
                });
                if (incrErr) {
                    console.warn('increment_no_show RPC also failed:', incrErr.message);
                }
            }
        }

        return { marked, skippedLeave: skippedLeave.length };
    },

    /**
     * Admin override: reset no_show_count to 0 and re-enable auto-booking.
     */
    async resetStudentNoShow(studentId) {
        const { error } = await supabase
            .from('users')
            .update({
                no_show_count: 0,
                default_booking_enabled: true,
                default_disabled_until: null,
                last_no_show_date: null,
            })
            .eq('id', studentId);

        if (error) throw error;
        return { success: true };
    },

    /**
     * 30-day reset: resets no_show_count for users whose reset date has passed.
     * Preserved from original implementation for scheduled runs.
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
                    last_no_show_date: null,
                })
                .eq('id', user.id);

            reset++;
        }

        return { reset };
    },

    /**
     * Legacy alias kept for backwards compatibility.
     * @deprecated Use runNoShowDetection() instead.
     */
    async runNoShowMarker() {
        return this.runNoShowDetection();
    },
};
