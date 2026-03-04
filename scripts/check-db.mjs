import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://oyyizheqxjorjvjanuqk.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95eWl6aGVxeGpvcmp2amFudXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODcwODksImV4cCI6MjA4Nzk2MzA4OX0.pgPNEw8DtEE3Usn3SzefXZ5g9L5L-cybg6qstY8cGyM';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

const utcToday = new Date().toISOString().split('T')[0];
console.log('UTC today:', utcToday);

// Check sample menus (most recent 5 rows)
const { data: m3, error: e3 } = await supabase
    .from('menus')
    .select('date, meal_type')
    .limit(5)
    .order('date', { ascending: false });
console.log('Sample menus:', JSON.stringify(m3), 'Error:', e3?.message);

// Query for UTC today
const { data: m4, error: e4 } = await supabase
    .from('menus')
    .select('date, meal_type, items')
    .eq('date', utcToday);
console.log('Menus for utcToday:', JSON.stringify(m4), 'Error:', e4?.message);

// Check announcements
const { data: a1, error: ae1 } = await supabase
    .from('announcements')
    .select('id, title, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
console.log('Announcements:', JSON.stringify(a1), 'Error:', ae1?.message);
