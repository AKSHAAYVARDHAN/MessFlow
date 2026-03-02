import { supabase } from './supabase';

const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2 };

export const leaveService = {
    // ── Student: fetch own leaves ─────────────────────────────────────────────
    async getLeaves(userId) {
        const { data, error } = await supabase
            .from('leaves')
            .select('*')
            .eq('user_id', userId)
            .order('from_date', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    // ── Student: submit a new leave ───────────────────────────────────────────
    async createLeave(userId, fromDate, fromMeal, toDate, toMeal) {
        const { data, error } = await supabase
            .from('leaves')
            .insert({
                user_id: userId,
                from_date: fromDate,
                from_meal: fromMeal,
                to_date: toDate,
                to_meal: toMeal,
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // ── Student: cancel a leave ───────────────────────────────────────────────
    async cancelLeave(leaveId) {
        const { error } = await supabase
            .from('leaves')
            .delete()
            .eq('id', leaveId);
        if (error) throw error;
    },

    // ── Check if user is on leave for a specific date+meal ───────────────────
    async isOnLeave(userId, date, mealType) {
        const { data, error } = await supabase
            .from('leaves')
            .select('*')
            .eq('user_id', userId)
            .lte('from_date', date)
            .gte('to_date', date);
        if (error) throw error;

        if (!data || data.length === 0) return false;

        const mealIdx = MEAL_ORDER[mealType];

        return data.some((leave) => {
            const fromIdx = MEAL_ORDER[leave.from_meal];
            const toIdx = MEAL_ORDER[leave.to_meal];

            if (date === leave.from_date && date === leave.to_date) {
                return mealIdx >= fromIdx && mealIdx <= toIdx;
            }
            if (date === leave.from_date) {
                return mealIdx >= fromIdx;
            }
            if (date === leave.to_date) {
                return mealIdx <= toIdx;
            }
            return true;
        });
    },

    // ── Get the active leave covering today (for TodayStatus banner) ──────────
    async getActiveLeaveForToday(userId) {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('leaves')
            .select('*')
            .eq('user_id', userId)
            .lte('from_date', today)
            .gte('to_date', today)
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data; // null if none
    },

    // ── Cancel all booked slots within the leave period (no deadline check) ──
    async cancelBookingsDuringLeave(userId, fromDate, fromMeal, toDate, toMeal) {
        // Fetch all 'booked' bookings in the date range
        const { data: bookings, error: fetchErr } = await supabase
            .from('bookings')
            .select('id, date, meal_type, status')
            .eq('user_id', userId)
            .eq('status', 'booked')
            .gte('date', fromDate)
            .lte('date', toDate);
        if (fetchErr) throw fetchErr;

        if (!bookings || bookings.length === 0) return 0;

        const fromIdx = MEAL_ORDER[fromMeal];
        const toIdx = MEAL_ORDER[toMeal];

        // Filter strictly by meal boundary on first/last day
        const toCancel = bookings.filter((b) => {
            const mealIdx = MEAL_ORDER[b.meal_type];
            if (b.date === fromDate && b.date === toDate) {
                return mealIdx >= fromIdx && mealIdx <= toIdx;
            }
            if (b.date === fromDate) return mealIdx >= fromIdx;
            if (b.date === toDate) return mealIdx <= toIdx;
            return true;
        });

        if (toCancel.length === 0) return 0;

        const ids = toCancel.map((b) => b.id);
        const { error: updateErr } = await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .in('id', ids);
        if (updateErr) throw updateErr;

        return toCancel.length;
    },

    // ── Admin: get all active leaves (to_date >= today) with user info ────────
    async getAllActiveLeaves(filterDate) {
        const today = new Date().toISOString().split('T')[0];
        const date = filterDate || today;

        const { data, error } = await supabase
            .from('leaves')
            .select('*, users(name, email)')
            .lte('from_date', date)
            .gte('to_date', date)
            .order('from_date', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    // ── Admin: get all leaves for a date range (for broader filtering) ────────
    async getLeavesByDateRange(startDate, endDate) {
        const { data, error } = await supabase
            .from('leaves')
            .select('*, users(name, email)')
            .lte('from_date', endDate)
            .gte('to_date', startDate)
            .order('from_date', { ascending: true });
        if (error) throw error;
        return data || [];
    },
};
