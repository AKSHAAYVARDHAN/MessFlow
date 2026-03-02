import { supabase } from './supabase';
import { format, subDays } from 'date-fns';

export const feedbackService = {
    /**
     * Submit feedback for a booking.
     * Inserts into meal_feedback. Throws if booking already has feedback (UNIQUE constraint).
     */
    async submitFeedback(userId, bookingId, mealType, rating, comment = null) {
        const { data, error } = await supabase
            .from('meal_feedback')
            .insert({
                user_id: userId,
                booking_id: bookingId,
                meal_type: mealType,
                rating,
                comment: comment?.trim() || null,
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    /**
     * Given a list of booking IDs, return the feedback records that exist.
     * Used by students to know which attended meals already have feedback.
     * Returns: [{ id, booking_id, rating, comment }]
     */
    async getFeedbackForBookingIds(bookingIds) {
        if (!bookingIds || bookingIds.length === 0) return [];
        const { data, error } = await supabase
            .from('meal_feedback')
            .select('id, booking_id, rating, comment, meal_type, created_at')
            .in('booking_id', bookingIds);
        if (error) throw error;
        return data || [];
    },

    /**
     * Admin: get daily average ratings per meal_type for a given date.
     * Joins meal_feedback → bookings to filter by booking date.
     * Returns: { breakfast: 4.2, lunch: 3.8, dinner: 4.5 } (null if no data)
     */
    async getDailyAverageRatings(date) {
        const { data, error } = await supabase
            .from('meal_feedback')
            .select('meal_type, rating, bookings!inner(date)')
            .eq('bookings.date', date);
        if (error) throw error;

        const grouped = { breakfast: [], lunch: [], dinner: [] };
        (data || []).forEach(({ meal_type, rating }) => {
            if (grouped[meal_type] !== undefined) {
                grouped[meal_type].push(rating);
            }
        });

        const avg = (arr) => arr.length > 0
            ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
            : null;

        return {
            breakfast: avg(grouped.breakfast),
            lunch: avg(grouped.lunch),
            dinner: avg(grouped.dinner),
        };
    },

    /**
     * Admin: get feedback trend — average rating per day over the last N days.
     * Returns: [{ date: 'Mar 1', avg: 4.2, count: 8 }] ordered by date asc.
     */
    async getFeedbackTrend(days = 14) {
        const dates = Array.from({ length: days }, (_, i) =>
            format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd')
        );

        const { data, error } = await supabase
            .from('meal_feedback')
            .select('rating, bookings!inner(date)')
            .in('bookings.date', dates);
        if (error) throw error;

        // Build a map: date -> [ratings]
        const map = {};
        dates.forEach(d => (map[d] = []));
        (data || []).forEach(({ rating, bookings }) => {
            const d = bookings?.date;
            if (d && map[d] !== undefined) map[d].push(rating);
        });

        return dates.map(d => {
            const arr = map[d];
            const avg = arr.length > 0
                ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
                : null;
            return {
                date: format(new Date(d + 'T00:00:00'), 'MMM d'),
                avg,
                count: arr.length,
            };
        });
    },

    /**
     * Admin: get recent feedback comments with student name.
     * Returns: [{ id, meal_type, rating, comment, created_at, users: { name, email } }]
     */
    async getRecentComments(limit = 25) {
        const { data, error } = await supabase
            .from('meal_feedback')
            .select('id, meal_type, rating, comment, created_at, users(name, email)')
            .not('comment', 'is', null)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data || [];
    },

    /**
     * Admin: get ALL recent feedback (including no-comment) for overview table.
     */
    async getAllRecentFeedback(limit = 50) {
        const { data, error } = await supabase
            .from('meal_feedback')
            .select('id, meal_type, rating, comment, created_at, users(name, email)')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data || [];
    },
};
