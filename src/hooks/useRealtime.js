import { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';

export function useRealtime(table, filter, callback) {
    const channelRef = useRef(null);

    useEffect(() => {
        const channel = supabase
            .channel(`realtime-${table}-${filter || 'all'}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table,
                    filter: filter || undefined,
                },
                (payload) => {
                    callback(payload);
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [table, filter]);

    return channelRef;
}

export function useRealtimeBookings(date, onUpdate) {
    return useRealtime('bookings', `date=eq.${date}`, onUpdate);
}
