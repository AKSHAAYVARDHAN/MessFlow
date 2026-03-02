-- ============================================================
-- MessFlow — No-Show Detection System Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1) Add last_no_show_date column to track when the student last missed a meal.
--    IF NOT EXISTS guards against running twice on the same DB.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_no_show_date TIMESTAMPTZ;

-- 2) Ensure no_show_count exists with correct default (already in schema, safe guard).
--    Uncomment only if your DB was created before the original schema added these.
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS no_show_count INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS default_booking_enabled BOOLEAN NOT NULL DEFAULT true;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS default_disabled_until TIMESTAMPTZ;

-- 3) Add index for efficient no-show queries
CREATE INDEX IF NOT EXISTS idx_bookings_status_date
  ON public.bookings(date, status);

-- 4) Backfill: reset any users who were disabled by the old >=5 rule but would not
--    be caught by the new >=3 rule. This is a one-time safe operation.
--    OPTIONAL — comment out if you want to keep existing disabled states.
-- UPDATE public.users
--   SET default_booking_enabled = CASE WHEN no_show_count >= 3 THEN false ELSE true END;

-- ============================================================
-- 5) Atomic no-show increment function (called via supabase.rpc)
--
--    SECURITY DEFINER: runs with the privileges of the function
--    owner (postgres / service role), bypassing RLS on the users
--    table so the increment is never silently blocked.
--
--    Logic:
--      • no_show_count  += 1  (COALESCE handles NULL rows)
--      • last_no_show_date = now()
--      • If new count >= 3 → default_booking_enabled = false
-- ============================================================
create or replace function increment_no_show(uid uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.users
  set
    no_show_count = coalesce(no_show_count, 0) + 1,
    last_no_show_date = now(),
    default_booking_enabled =
      case
        when coalesce(no_show_count, 0) + 1 >= 3 then false
        else default_booking_enabled
      end
  where id = uid;
end;
$$;

-- Grant execute to the roles used by the Supabase client
grant execute on function increment_no_show(uuid) to authenticated;
grant execute on function increment_no_show(uuid) to anon;
