import { supabase } from './supabase';
import { format, subDays, startOfDay } from 'date-fns';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const analyticsService = {
    /**
     * Summary metrics for today:
     *  - mealsServed: bookings with status 'scanned'
     *  - cancellations: bookings with status 'cancelled'
     *  - noShows: bookings with status 'no_show'
     *  - avgDailyAttendance: average of (scanned) bookings per day over last 7 days
     */
    async getSummaryMetrics(today) {
        // Fetch today's bookings
        const { data: todayBookings, error: todayErr } = await supabase
            .from('bookings')
            .select('status')
            .eq('date', today);
        if (todayErr) throw todayErr;

        const mealsServed = (todayBookings || []).filter(b => b.status === 'scanned').length;
        const cancellations = (todayBookings || []).filter(b => b.status === 'cancelled').length;
        const noShows = (todayBookings || []).filter(b => b.status === 'no_show').length;

        // Last 7 days for avg attendance
        const dates = Array.from({ length: 7 }, (_, i) =>
            format(subDays(new Date(), i + 1), 'yyyy-MM-dd')
        );
        const { data: weekBookings, error: weekErr } = await supabase
            .from('bookings')
            .select('date, status')
            .in('date', dates)
            .eq('status', 'scanned');
        if (weekErr) throw weekErr;

        const countPerDay = {};
        dates.forEach(d => (countPerDay[d] = 0));
        (weekBookings || []).forEach(b => {
            if (countPerDay[b.date] !== undefined) countPerDay[b.date]++;
        });
        const vals = Object.values(countPerDay);
        const avgDailyAttendance = vals.length > 0
            ? Math.round(vals.reduce((a, c) => a + c, 0) / vals.length)
            : 0;

        return { mealsServed, cancellations, noShows, avgDailyAttendance };
    },

    /**
     * Peak slot usage across all time:
     * Groups bookings by meal_type + slot_time, excludes cancelled/no_show.
     * Returns: [{ slot, meal_type, count }]
     */
    async getPeakSlotUsage() {
        const { data, error } = await supabase
            .from('bookings')
            .select('meal_type, slot_time')
            .not('status', 'in', '(cancelled,no_show)')
            .not('slot_time', 'is', null);
        if (error) throw error;

        const map = {};
        (data || []).forEach(b => {
            const key = `${b.meal_type}||${b.slot_time}`;
            if (!map[key]) map[key] = { slot: b.slot_time, meal_type: b.meal_type, count: 0 };
            map[key].count++;
        });

        return Object.values(map).sort((a, b) => a.slot.localeCompare(b.slot));
    },

    /**
     * Cancellation trend over the last N days.
     * Returns: [{ date: 'MMM d', count }] ordered by date asc.
     */
    async getCancellationTrend(days = 14) {
        const dates = Array.from({ length: days }, (_, i) =>
            format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd')
        );

        const { data, error } = await supabase
            .from('bookings')
            .select('date')
            .in('date', dates)
            .eq('status', 'cancelled');
        if (error) throw error;

        const map = {};
        dates.forEach(d => (map[d] = 0));
        (data || []).forEach(b => {
            if (map[b.date] !== undefined) map[b.date]++;
        });

        return dates.map(d => ({
            date: format(new Date(d + 'T00:00:00'), 'MMM d'),
            count: map[d],
        }));
    },

    /**
     * Weekly attendance heatmap — last 30 days.
     * Groups attended bookings (not cancelled/no_show) by day-of-week.
     * Returns: [{ day: 'Mon', index: 1, count }] for Mon–Sun order.
     */
    async getWeeklyAttendanceHeatmap(days = 30) {
        const dates = Array.from({ length: days }, (_, i) =>
            format(subDays(new Date(), i), 'yyyy-MM-dd')
        );

        const { data, error } = await supabase
            .from('bookings')
            .select('date')
            .in('date', dates)
            .not('status', 'in', '(cancelled,no_show)');
        if (error) throw error;

        // Index 0=Sun…6=Sat, we want Mon(1)…Sun(0) order
        const dowCounts = Array(7).fill(0);
        (data || []).forEach(b => {
            const dow = new Date(b.date + 'T00:00:00').getDay();
            dowCounts[dow]++;
        });

        // Mon–Sun order: indices [1,2,3,4,5,6,0]
        const order = [1, 2, 3, 4, 5, 6, 0];
        return order.map(idx => ({
            day: DAY_NAMES[idx],
            index: idx,
            count: dowCounts[idx],
        }));
    },

    /**
     * No-show leaderboard: top N students by no_show_count.
     */
    async getNoShowLeaderboard(limit = 10) {
        const { data, error } = await supabase
            .from('users')
            .select('id, name, email, no_show_count')
            .eq('role', 'student')
            .gte('no_show_count', 1)
            .order('no_show_count', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data || [];
    },
};
