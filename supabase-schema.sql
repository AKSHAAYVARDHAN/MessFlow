-- ============================================================
-- MessFlow Database Schema for Supabase
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1) Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  default_booking_enabled BOOLEAN NOT NULL DEFAULT true,
  preferred_dinner_slot TEXT,
  no_show_count INTEGER NOT NULL DEFAULT 0,
  no_show_reset_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  default_disabled_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  slot_time TEXT,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled', 'scanned', 'no_show')),
  qr_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) Leaves table
CREATE TABLE public.leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  from_date DATE NOT NULL,
  from_meal TEXT NOT NULL CHECK (from_meal IN ('breakfast', 'lunch', 'dinner')),
  to_date DATE NOT NULL,
  to_meal TEXT NOT NULL CHECK (to_meal IN ('breakfast', 'lunch', 'dinner')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4) Announcements table
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'all')),
  date DATE NOT NULL,
  is_important BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5) Menus table (daily menu per meal)
CREATE TABLE public.menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  items TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, meal_type)
);

-- 5) Guest Bookings table
CREATE TABLE public.guest_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  qr_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_bookings_user_date ON public.bookings(user_id, date);
CREATE INDEX idx_bookings_date_meal ON public.bookings(date, meal_type);
CREATE INDEX idx_leaves_user ON public.leaves(user_id);
CREATE INDEX idx_announcements_date ON public.announcements(date);
CREATE INDEX idx_menus_date ON public.menus(date);

-- ============================================================
-- Enable Realtime on bookings
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;

-- ============================================================
-- Row Level Security (basic policies)
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_bookings ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile; admins can read all
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update any user" ON public.users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Bookings: users manage their own; admins manage all
CREATE POLICY "Users can view own bookings" ON public.bookings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all bookings" ON public.bookings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Users can insert own bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bookings" ON public.bookings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all bookings" ON public.bookings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Leaves: users manage their own
CREATE POLICY "Users can manage own leaves" ON public.leaves
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all leaves" ON public.leaves
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Announcements: all authenticated can read; admins can write
CREATE POLICY "Anyone can view announcements" ON public.announcements
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage announcements" ON public.announcements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Guest bookings: public insert; admins can view
CREATE POLICY "Anyone can create guest booking" ON public.guest_bookings
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view own guest booking" ON public.guest_bookings
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage guest bookings" ON public.guest_bookings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Menus: anyone can read; admins can write
CREATE POLICY "Anyone can view menus" ON public.menus
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage menus" ON public.menus
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
