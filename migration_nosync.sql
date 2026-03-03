-- ============================================================
-- MessFlow — No-Show Count Sync Migration
-- Run this in the Supabase SQL Editor AFTER migration_noshow.sql
-- ============================================================

-- ============================================================
-- sync_no_show_count(uid)
--
-- Re-derives no_show_count directly from the bookings table
-- for a given user, ensuring users table stays in sync with
-- bookings (the authoritative source of truth).
--
-- Called by schedulerService after marking no-shows so the
-- count in users table is always accurate even if previous
-- increments were missed or failed.
--
-- Logic:
--   • Count all bookings with status='no_show' for this user
--   • Update users.no_show_count to that exact count
--   • Update last_no_show_date = now() if count > 0
--   • If count >= 3 → default_booking_enabled = false
-- ============================================================
CREATE OR REPLACE FUNCTION sync_no_show_count(uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count no_show bookings from bookings table (source of truth)
  SELECT COUNT(*)
    INTO v_count
    FROM public.bookings
   WHERE user_id = uid
     AND status = 'no_show';

  -- Update users table with the derived count
  UPDATE public.users
     SET no_show_count = v_count,
         last_no_show_date = CASE WHEN v_count > 0 THEN now() ELSE last_no_show_date END,
         default_booking_enabled =
           CASE
             WHEN v_count >= 3 THEN false
             ELSE default_booking_enabled
           END
   WHERE id = uid;
END;
$$;

-- Grant execute to roles used by Supabase client
GRANT EXECUTE ON FUNCTION sync_no_show_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_no_show_count(uuid) TO anon;

-- ============================================================
-- Backfill: sync all existing users' no_show_count from
-- bookings table right now to fix any existing inconsistencies.
-- This is a one-time safe operation.
-- ============================================================
DO $$
DECLARE
  u RECORD;
  v_count INTEGER;
BEGIN
  FOR u IN SELECT id FROM public.users WHERE role = 'student' LOOP
    SELECT COUNT(*) INTO v_count
      FROM public.bookings
     WHERE user_id = u.id
       AND status = 'no_show';

    UPDATE public.users
       SET no_show_count = v_count,
           default_booking_enabled =
             CASE WHEN v_count >= 3 THEN false ELSE true END
     WHERE id = u.id;
  END LOOP;
END;
$$;
