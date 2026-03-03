import { supabase } from './supabase';
import { format, subDays, startOfMonth } from 'date-fns';

export const profileStatsService = {
    /**
     * Get meal booking counts for the current calendar month.
     * Returns: { attended, cancelled, noShows, booked }
     */
    async getMealStatsThisMonth(userId) {
        const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
        const today = format(new Date(), 'yyyy-MM-dd');

        const { data, error } = await supabase
            .from('bookings')
            .select('status')
            .eq('user_id', userId)
            .gte('date', monthStart)
            .lte('date', today);

        if (error) throw error;

        const rows = data || [];
        return {
            attended: rows.filter((r) => r.status === 'scanned').length,
            cancelled: rows.filter((r) => r.status === 'cancelled').length,
            noShows: rows.filter((r) => r.status === 'no_show').length,
            booked: rows.filter((r) => r.status === 'booked').length,
        };
    },

    /**
     * Get the LIVE total no-show count from bookings table.
     * This is the authoritative source of truth — does NOT read from
     * users.no_show_count which may be stale or out of sync.
     * Returns: number
     */
    async getNoShowCount(userId) {
        const { count, error } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'no_show');

        if (error) throw error;
        return count || 0;
    },

    /**
     * Get attendance percentage over last 30 days.
     * Attendance % = scanned / (scanned + no_show) * 100
     * Ignores cancelled and still-booked meals.
     * Returns: number (0–100) or null if no data.
     */
    async getAttendancePercentage(userId) {
        const from = format(subDays(new Date(), 29), 'yyyy-MM-dd');
        const today = format(new Date(), 'yyyy-MM-dd');

        const { data, error } = await supabase
            .from('bookings')
            .select('status')
            .eq('user_id', userId)
            .gte('date', from)
            .lte('date', today)
            .in('status', ['scanned', 'no_show']);

        if (error) throw error;

        const rows = data || [];
        if (rows.length === 0) return null;

        const attended = rows.filter((r) => r.status === 'scanned').length;
        return Math.round((attended / rows.length) * 100);
    },

    /**
     * Get total feedback submissions for a user.
     * Returns: number
     */
    async getFeedbackCount(userId) {
        const { count, error } = await supabase
            .from('meal_feedback')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (error) throw error;
        return count || 0;
    },
};
