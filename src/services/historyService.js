import { supabase } from './supabase';

const PAGE_SIZE = 10;

/**
 * Fetch paginated meal history for a student, with optional filters.
 *
 * @param {string}  userId
 * @param {object}  filters  – { dateFrom, dateTo, mealType, status }
 * @param {number}  page     – 1-based
 * @returns {{ data: Array, count: number }}
 */
export const historyService = {
    async getMealHistory(userId, filters = {}, page = 1) {
        const { dateFrom, dateTo, mealType, status } = filters;
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let query = supabase
            .from('bookings')
            .select(
                'id, date, meal_type, slot_time, status, scanned_at, created_at,' +
                'meal_feedback(id, rating, comment, created_at)',
                { count: 'exact' }
            )
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .order('meal_type', { ascending: true })
            .range(from, to);

        if (dateFrom) query = query.gte('date', dateFrom);
        if (dateTo) query = query.lte('date', dateTo);
        if (mealType && mealType !== 'all') query = query.eq('meal_type', mealType);

        // Status filter is resolved client-side for 'missed' / 'on_leave'
        // because those require combining booking status + time context
        // The others map directly to DB columns
        if (status && status !== 'all' && status !== 'missed' && status !== 'on_leave') {
            if (status === 'attended') {
                // scanned_at is not null OR status === 'scanned'
                query = query.eq('status', 'scanned');
            } else if (status === 'cancelled') {
                query = query.eq('status', 'cancelled');
            } else if (status === 'no_show') {
                query = query.eq('status', 'no_show');
            }
        }

        const { data, error, count } = await query;
        if (error) throw error;
        return { data: data || [], count: count || 0 };
    },

    /**
     * Fetch leaves for the student that overlap with a date range.
     * Used to annotate bookings with "on_leave" status.
     */
    async getLeavesForDateRange(userId, dateFrom, dateTo) {
        const { data, error } = await supabase
            .from('leaves')
            .select('id, from_date, from_meal, to_date, to_meal')
            .eq('user_id', userId)
            .lte('from_date', dateTo || '9999-12-31')
            .gte('to_date', dateFrom || '0000-01-01');
        if (error) throw error;
        return data || [];
    },
};
