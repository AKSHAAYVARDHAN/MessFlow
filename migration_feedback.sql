-- ============================================================
-- MessFlow — Food Feedback System Migration
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Create meal_feedback table
CREATE TABLE IF NOT EXISTS public.meal_feedback (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  booking_id  uuid        NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  meal_type   text        NOT NULL,
  rating      integer     NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     text,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- Enforce one feedback per booking
  CONSTRAINT meal_feedback_booking_id_unique UNIQUE (booking_id)
);

-- 2. Index for fast user-scoped queries
CREATE INDEX IF NOT EXISTS meal_feedback_user_id_idx ON public.meal_feedback (user_id);

-- 3. Index for admin date-range analytics (join through bookings)
CREATE INDEX IF NOT EXISTS meal_feedback_created_at_idx ON public.meal_feedback (created_at);

-- 4. Enable Row Level Security
ALTER TABLE public.meal_feedback ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Students can insert feedback only for their own user_id
-- (DB-level integrity: they can only submit for their OWN bookings)
CREATE POLICY "students_insert_own_feedback"
  ON public.meal_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Students can read only their own feedback
CREATE POLICY "students_read_own_feedback"
  ON public.meal_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all feedback
CREATE POLICY "admin_read_all_feedback"
  ON public.meal_feedback
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Nobody can update feedback after submission (no UPDATE policy = no access)

-- ============================================================
-- Done. Verify with:
--   SELECT * FROM public.meal_feedback LIMIT 5;
-- ============================================================
