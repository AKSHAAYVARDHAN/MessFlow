import { supabase } from './supabase';
import { generateQRData } from '../utils/qrHelpers';

export const guestService = {
    async createGuestBooking(name, phone, date, mealType) {
        const qrData = generateQRData(`guest-${phone}`, date, mealType);
        const { data, error } = await supabase
            .from('guest_bookings')
            .insert({
                name,
                phone,
                date,
                meal_type: mealType,
                payment_status: 'paid',
                qr_code: qrData,
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async getGuestBookings(date) {
        const { data, error } = await supabase
            .from('guest_bookings')
            .select('*')
            .eq('date', date)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },
};
