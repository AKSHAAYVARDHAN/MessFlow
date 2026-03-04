import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oyyizheqxjorjvjanuqk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95eWl6aGVxeGpvcmp2amFudXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODcwODksImV4cCI6MjA4Nzk2MzA4OX0.pgPNEw8DtEE3Usn3SzefXZ5g9L5L-cybg6qstY8cGyM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const today = new Date().toISOString().split('T')[0];
    console.log("Checking data for today:", today);

    const promises = [
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('date', today),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('date', today).eq('status', 'cancelled'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('date', today).eq('status', 'no_show'),
        supabase.from('leaves').select('*', { count: 'exact', head: true }).lte('start_date', today).gte('end_date', today).eq('status', 'approved'),
        supabase.from('bookings').select('*, users!bookings_user_id_fk(name, email)').eq('date', today),
        supabase.from('menus').select('*').eq('date', today).order('meal_type', { ascending: true }),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(5)
    ];

    const results = await Promise.allSettled(promises);
    results.forEach((res, i) => {
        if (res.status === 'rejected') {
            console.error(`Promise ${i} failed:`, res.reason);
        } else if (res.value.error) {
            console.error(`Promise ${i} returned Supabase error:`, res.value.error);
        } else {
            console.log(`Promise ${i} succeeded with data length/count:`, res.value.data ? res.value.data.length : res.value.count);
        }
    });

    console.log("Menus data:", results[5]?.value?.data);
    console.log("Announcements data:", results[6]?.value?.data);
}
run();
