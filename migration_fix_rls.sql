-- ============================================================
-- MessFlow: Fix RLS Infinite Recursion
-- 
-- PROBLEM:
--   The admin SELECT / ALL policies on `leaves`, `bookings`,
--   `announcements`, `menus`, and `guest_bookings` all contain:
--
--     EXISTS (SELECT 1 FROM public.users
--             WHERE id = auth.uid() AND role = 'admin')
--
--   But `public.users` itself has RLS enabled, and its own
--   "Admins can view all users" policy ALSO runs the same
--   EXISTS subquery → infinite recursion → PostgreSQL returns
--   0 rows silently (no error shown to client).
--
-- FIX:
--   1. Create a SECURITY DEFINER function `public.is_admin()`
--      that checks the role WITHOUT being subject to RLS.
--   2. Drop and recreate every affected policy to call
--      `public.is_admin()` instead of the inline EXISTS.
--
-- Run this in the Supabase SQL Editor (one shot).
-- ============================================================


-- ── Step 1: Create the SECURITY DEFINER helper ─────────────
-- SECURITY DEFINER runs as the function owner (postgres/service
-- role), bypassing RLS on `users`. STABLE + row-cache means
-- it is called only once per query, not once per row.

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

-- Restrict execute to authenticated users only (security best-practice).
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;


-- ── Step 2: Fix `public.users` policies ────────────────────

DROP POLICY IF EXISTS "Admins can view all users"   ON public.users;
DROP POLICY IF EXISTS "Admins can update any user"  ON public.users;

CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update any user" ON public.users
  FOR UPDATE
  USING (public.is_admin());


-- ── Step 3: Fix `public.leaves` policies ───────────────────

DROP POLICY IF EXISTS "Admins can view all leaves" ON public.leaves;

CREATE POLICY "Admins can view all leaves" ON public.leaves
  FOR SELECT
  USING (public.is_admin());


-- ── Step 4: Fix `public.bookings` policies ─────────────────

DROP POLICY IF EXISTS "Admins can view all bookings"   ON public.bookings;
DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings;

CREATE POLICY "Admins can view all bookings" ON public.bookings
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can manage all bookings" ON public.bookings
  FOR ALL
  USING (public.is_admin());


-- ── Step 5: Fix `public.announcements` policies ────────────

DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;

CREATE POLICY "Admins can manage announcements" ON public.announcements
  FOR ALL
  USING (public.is_admin());


-- ── Step 6: Fix `public.menus` policies ────────────────────

DROP POLICY IF EXISTS "Admins can manage menus" ON public.menus;

CREATE POLICY "Admins can manage menus" ON public.menus
  FOR ALL
  USING (public.is_admin());


-- ── Step 7: Fix `public.guest_bookings` policies ───────────

DROP POLICY IF EXISTS "Admins can manage guest bookings" ON public.guest_bookings;

CREATE POLICY "Admins can manage guest bookings" ON public.guest_bookings
  FOR ALL
  USING (public.is_admin());


-- ── Done ────────────────────────────────────────────────────
-- After running this, the Leave Monitor, Slot Monitor,
-- No-Show Monitor, and all other admin views should correctly
-- display data for all students.
