/**
 * Runs the RLS fix migration against Supabase using the service-role key.
 * Service-role bypasses RLS, so it can execute DDL via rpc('exec_sql', ...).
 *
 * Usage:  node scripts/run-migration.mjs
 */

const SUPABASE_URL = 'https://oyyizheqxjorjvjanuqk.supabase.co';
const SERVICE_ROLE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95eWl6aGVxeGpvcmp2amFudXFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjM4NzA4OSwiZXhwIjoyMDg3OTYzMDg5fQ.qnIEF01DKWGicCG-zJpUdD0rIBrMGHSDPcSDxV-n2pU';

// Each statement is run separately so we get clear per-step output.
const STEPS = [
    {
        label: 'Create SECURITY DEFINER is_admin() function',
        sql: `
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id  = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;
        `.trim(),
    },
    {
        label: 'Fix users policies',
        sql: `
DROP POLICY IF EXISTS "Admins can view all users"   ON public.users;
DROP POLICY IF EXISTS "Admins can update any user"  ON public.users;
CREATE POLICY "Admins can view all users"  ON public.users FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update any user" ON public.users FOR UPDATE  USING (public.is_admin());
        `.trim(),
    },
    {
        label: 'Fix leaves policies',
        sql: `
DROP POLICY IF EXISTS "Admins can view all leaves" ON public.leaves;
CREATE POLICY "Admins can view all leaves" ON public.leaves FOR SELECT USING (public.is_admin());
        `.trim(),
    },
    {
        label: 'Fix bookings policies',
        sql: `
DROP POLICY IF EXISTS "Admins can view all bookings"   ON public.bookings;
DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings;
CREATE POLICY "Admins can view all bookings"   ON public.bookings FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can manage all bookings" ON public.bookings FOR ALL    USING (public.is_admin());
        `.trim(),
    },
    {
        label: 'Fix announcements policies',
        sql: `
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "Admins can manage announcements" ON public.announcements FOR ALL USING (public.is_admin());
        `.trim(),
    },
    {
        label: 'Fix menus policies',
        sql: `
DROP POLICY IF EXISTS "Admins can manage menus" ON public.menus;
CREATE POLICY "Admins can manage menus" ON public.menus FOR ALL USING (public.is_admin());
        `.trim(),
    },
    {
        label: 'Fix guest_bookings policies',
        sql: `
DROP POLICY IF EXISTS "Admins can manage guest bookings" ON public.guest_bookings;
CREATE POLICY "Admins can manage guest bookings" ON public.guest_bookings FOR ALL USING (public.is_admin());
        `.trim(),
    },
];

async function runSql(sql) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql }),
    });

    // Supabase management endpoint differs from PostgREST rpc.
    // If rpc/exec_sql doesn't exist, fall back to the pg REST management API.
    if (res.status === 404) {
        // Try the management API for running arbitrary SQL
        const projectRef = 'oyyizheqxjorjvjanuqk';
        const mgmtRes = await fetch(
            `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
            {
                method: 'POST',
                headers: {
                    apikey: SERVICE_ROLE_KEY,
                    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: sql }),
            }
        );
        return { status: mgmtRes.status, body: await mgmtRes.text() };
    }

    const text = await res.text();
    return { status: res.status, body: text };
}

async function main() {
    console.log('=== MessFlow RLS Fix Migration ===\n');

    for (const step of STEPS) {
        process.stdout.write(`⏳  ${step.label} … `);
        try {
            const { status, body } = await runSql(step.sql);
            if (status >= 200 && status < 300) {
                console.log(`✅  OK (${status})`);
            } else {
                console.log(`⚠️  HTTP ${status}`);
                console.log('    Response:', body.slice(0, 300));
            }
        } catch (err) {
            console.log(`❌  ERROR: ${err.message}`);
        }
    }

    console.log('\n=== Done ===');
    console.log('If all steps show ✅, the RLS fix is applied.');
    console.log('Refresh the admin Leave Monitor to confirm leaves are visible.');
}

main();
