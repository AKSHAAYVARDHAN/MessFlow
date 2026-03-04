import { useState, useEffect, useCallback } from 'react';
import { bookingService } from '../services/bookingService';
import { useAuth } from '../contexts/AuthContext';
import { getToday } from '../utils/dateHelpers';

export function useBookings(date) {
    const { user } = useAuth();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchBookings = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const data = await bookingService.getTodayBookings(user.id, date);
            setBookings(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    const getBookingByMeal = useCallback(
        (mealType) => bookings.find((b) => b.meal_type === mealType && b.status !== 'cancelled'),
        [bookings]
    );

    return {
        bookings,
        loading,
        error,
        refetch: fetchBookings,
        getBookingByMeal,
    };
}
