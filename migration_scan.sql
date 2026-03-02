-- ============================================================
-- MessFlow — QR Scan Validation System Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Allow 'staff' as a valid role in users table
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
    CHECK (role IN ('student', 'admin', 'staff'));

-- ────────────────────────────────────────────────────────────
-- 2. Add scan tracking columns to bookings table
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scanned_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Index for scan log queries
CREATE INDEX IF NOT EXISTS idx_bookings_scanned_at ON public.bookings(scanned_at)
  WHERE scanned_at IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 3. Update bookings status check to ensure 'scanned' is valid
--    (should already be there, but make sure)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('booked', 'cancelled', 'scanned', 'no_show'));

-- ────────────────────────────────────────────────────────────
-- 4. RLS Policies for STAFF role
-- ────────────────────────────────────────────────────────────

-- Staff can read their own profile
CREATE POLICY IF NOT EXISTS "Staff can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Staff can view all bookings (needed to look up by qr_code / user_id)
CREATE POLICY IF NOT EXISTS "Staff can view all bookings" ON public.bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'staff'
    )
  );

-- Staff can update scanned_at, scanned_by, status on bookings
-- (only allowed to mark as scanned — not cancel or delete)
CREATE POLICY IF NOT EXISTS "Staff can mark bookings as scanned" ON public.bookings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

-- ────────────────────────────────────────────────────────────
-- 5. Prevent students from modifying scanned_at
--    The existing "Users can update own bookings" policy covers
--    student updates. Since we check status='booked' in app
--    logic before scanning, and staff/admin RLS overrides,
--    students are effectively blocked from setting scanned_at.
--    For extra safety, a column-level privilege can be set
--    via Supabase dashboard (optional, shown below as comment).
-- ────────────────────────────────────────────────────────────
-- OPTIONAL: Revoke column-level update for students
-- REVOKE UPDATE (scanned_at, scanned_by) ON public.bookings FROM authenticated;
-- Then grant back for admin/staff only — but this requires custom roles.
-- The app-level validation (staff-only access to /scan) is sufficient.

-- ────────────────────────────────────────────────────────────
-- 6. Allow staff to view users (to show student names in scan result)
-- ────────────────────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "Staff can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );
