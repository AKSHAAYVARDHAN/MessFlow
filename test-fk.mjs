import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oyyizheqxjorjvjanuqk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95eWl6aGVxeGpvcmp2amFudXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODcwODksImV4cCI6MjA4Nzk2MzA4OX0.pgPNEw8DtEE3Usn3SzefXZ5g9L5L-cybg6qstY8cGyM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Testing FK hints for bookings -> users");

    const queries = [
        '*, users!bookings_user_id_fkey(name, email)',
        '*, users!user_id(name, email)',
        '*, users!bookings_created_by_fkey(name, email)',
        '*, users!fk_user(name, email)',
        '*, users(name,email)'
    ];

    for (const hint of queries) {
        const { error, data } = await supabase.from('bookings').select(hint).limit(1);
        if (error) {
            console.error(`Hint [${hint}] failed with:`, error.message);
        } else {
            console.log(`Hint [${hint}] succeeded!`);
            break;
        }
    }
}
run();
