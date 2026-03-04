import { supabase } from './supabase';
import { format } from 'date-fns';
import { generateQRData } from '../utils/qrHelpers';
import { CANCELLATION_DEADLINES } from '../utils/constants';


export const bookingService = {
    async getTodayBookings(userId, date) {
        const today = date || format(new Date(), 'yyyy-MM-dd');
        const { data, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('user_id', userId)
            .eq('date', today)
            .order('meal_type');
        if (error) throw error;
        return data || [];
    },

    async getBookingsByDate(date) {
        const { data, error } = await supabase
            .from('bookings')
            .select('*, users!bookings_user_id_fkey(name, email)')
            .eq('date', date)
            .neq('status', 'cancelled');
        if (error) throw error;
        return data || [];
    },

    // For admin stats — includes cancelled bookings
    async getAllBookingsByDate(date) {
        const { data, error } = await supabase
            .from('bookings')
            .select('*, users!bookings_user_id_fkey(name, email)')
            .eq('date', date);
        if (error) throw error;
        return data || [];
    },

    // ── Count-only queries (head: true — no row data transferred) ─────────
    async getBookingCountByDate(date) {
        const { count, error } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('date', date);
        if (error) throw error;
        return count || 0;
    },

    async getCancellationCountByDate(date) {
        const { count, error } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('date', date)
            .eq('status', 'cancelled');
        if (error) throw error;
        return count || 0;
    },

    async getNoShowCountByDate(date) {
        const { count, error } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('date', date)
            .eq('status', 'no_show');
        if (error) throw error;
        return count || 0;
    },

    async getSlotDistribution(date, mealType) {
        const { data, error } = await supabase
            .from('bookings')
            .select('slot_time')
            .eq('date', date)
            .eq('meal_type', mealType)
            .neq('status', 'cancelled');
        if (error) throw error;
        return data || [];
    },

    async createBooking(userId, date, mealType, slotTime = null) {
        const qrData = generateQRData(userId, date, mealType, slotTime);
        const { data, error } = await supabase
            .from('bookings')
            .insert({
                user_id: userId,
                date,
                meal_type: mealType,
                slot_time: slotTime,
                status: 'booked',
                qr_code: qrData,
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async cancelBooking(bookingId, mealType) {
        // Server-side deadline enforcement
        if (mealType) {
            const deadline = CANCELLATION_DEADLINES[mealType];
            if (deadline) {
                const now = new Date();
                const cutoff = new Date();
                cutoff.setHours(deadline.hour, deadline.minute, 0, 0);
                if (now >= cutoff) {
                    throw new Error(`Cancellation deadline for ${mealType} has passed.`);
                }
            }
        }
        const { data, error } = await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', bookingId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateSlot(bookingId, userId, date, mealType, newSlotTime) {
        const qrData = generateQRData(userId, date, mealType, newSlotTime);
        const { data, error } = await supabase
            .from('bookings')
            .update({
                slot_time: newSlotTime,
                qr_code: qrData,
            })
            .eq('id', bookingId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async markScanned(bookingId) {
        const { data, error } = await supabase
            .from('bookings')
            .update({ status: 'scanned' })
            .eq('id', bookingId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    subscribeToBookings(date, callback) {
        return supabase
            .channel(`bookings-${date}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'bookings',
                    filter: `date=eq.${date}`,
                },
                callback
            )
            .subscribe();
    },

    unsubscribe(channel) {
        supabase.removeChannel(channel);
    },
};
