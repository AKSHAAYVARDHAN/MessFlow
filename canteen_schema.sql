-- ============================================================
-- MessFlow — Smart Canteen Pre-Order System
-- Run this entire script in your Supabase SQL Editor.
-- ============================================================

-- ─── 1. canteens ─────────────────────────────────────────────
create table if not exists canteens (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,
  image_url     text,
  description   text,
  location      text,
  opening_time  time        not null default '08:00',
  closing_time  time        not null default '22:00',
  status        text        not null default 'open'
                            check (status in ('open', 'closed')),
  created_at    timestamptz default now()
);

-- ─── 2. menu_items ───────────────────────────────────────────
create table if not exists menu_items (
  id           uuid         primary key default gen_random_uuid(),
  canteen_id   uuid         references canteens(id) on delete cascade,
  name         text         not null,
  description  text,
  category     text         not null
               check (category in ('Starters','Soups','Main Course','Beverages','Desserts')),
  price        numeric(8,2) not null,
  is_veg       boolean      not null default true,
  is_available boolean      not null default true,
  image_url    text,
  created_at   timestamptz  default now()
);

-- ─── 3. orders ───────────────────────────────────────────────
create table if not exists orders (
  id           uuid         primary key default gen_random_uuid(),
  user_id      uuid         references auth.users(id) on delete cascade,
  canteen_id   uuid         references canteens(id),
  total_amount numeric(10,2) not null,
  status       text         not null default 'not_preparing'
               check (status in ('not_preparing','preparing','prepared')),
  pickup_time  timestamptz  not null,
  notes        text,
  created_at   timestamptz  default now()
);

-- ─── 4. order_items ──────────────────────────────────────────
create table if not exists order_items (
  id             uuid         primary key default gen_random_uuid(),
  order_id       uuid         references orders(id) on delete cascade,
  item_id        uuid         references menu_items(id),
  quantity       int          not null default 1 check (quantity > 0),
  price_at_order numeric(8,2) not null
);

-- ─── 5. Row Level Security ────────────────────────────────────
alter table canteens    enable row level security;
alter table menu_items  enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;

-- canteens: anyone can read
create policy "canteens_select_all"
  on canteens for select using (true);

-- canteens: only service-role can insert/update (admin managed via Supabase dashboard)
-- If you want admin users to manage canteens from the app, add:
-- create policy "canteens_admin_write" on canteens for all using (
--   exists (select 1 from users where users.id = auth.uid() and users.role = 'admin')
-- );

-- menu_items: anyone can read
create policy "menu_items_select_all"
  on menu_items for select using (true);

-- menu_items: admin can update availability
create policy "menu_items_admin_update"
  on menu_items for update using (
    exists (select 1 from users where users.id = auth.uid() and users.role = 'admin')
  );

-- orders: users can read their own orders
create policy "orders_select_own"
  on orders for select using (auth.uid() = user_id);

-- orders: authenticated users can insert their own
create policy "orders_insert_own"
  on orders for insert with check (auth.uid() = user_id);

-- orders: admin can read all and update status
create policy "orders_admin_all"
  on orders for all using (
    exists (select 1 from users where users.id = auth.uid() and users.role = 'admin')
  );

-- order_items: insert allowed for authenticated
create policy "order_items_insert"
  on order_items for insert with check (
    exists (select 1 from orders where orders.id = order_items.order_id and orders.user_id = auth.uid())
  );

-- order_items: read if you own the parent order
create policy "order_items_select_own"
  on order_items for select using (
    exists (select 1 from orders where orders.id = order_items.order_id and orders.user_id = auth.uid())
  );

-- order_items: admin can read all
create policy "order_items_admin_select"
  on order_items for select using (
    exists (select 1 from users where users.id = auth.uid() and users.role = 'admin')
  );

-- ─── 6. Sample Seed Data (optional, for testing) ─────────────
-- Insert a sample canteen
insert into canteens (name, description, location, opening_time, closing_time, status)
values
  ('Main Canteen',    'Campus main canteen with a wide variety', 'Block A, Ground Floor', '08:00', '22:00', 'open'),
  ('Snack Corner',    'Quick bites and beverages',               'Library Block',         '09:00', '20:00', 'open'),
  ('North Cafe',      'North campus cafeteria',                  'North Hostel',          '07:00', '21:00', 'closed')
on conflict do nothing;

-- Insert sample menu items (referencing the first canteen)
-- Note: IDs will be auto-generated; this seed uses a subquery to get the canteen id
insert into menu_items (canteen_id, name, category, price, is_veg, is_available)
select id, 'Veg Spring Rolls',     'Starters',   60,   true,  true  from canteens where name = 'Main Canteen'
union all
select id, 'Paneer Tikka',         'Starters',   120,  true,  true  from canteens where name = 'Main Canteen'
union all
select id, 'Chicken Lollipop',     'Starters',   150,  false, true  from canteens where name = 'Main Canteen'
union all
select id, 'Tomato Soup',          'Soups',      50,   true,  true  from canteens where name = 'Main Canteen'
union all
select id, 'Sweet Corn Soup',      'Soups',      55,   true,  true  from canteens where name = 'Main Canteen'
union all
select id, 'Chicken Noodle Soup',  'Soups',      80,   false, true  from canteens where name = 'Main Canteen'
union all
select id, 'Paneer Butter Masala', 'Main Course',160,  true,  true  from canteens where name = 'Main Canteen'
union all
select id, 'Dal Makhani',          'Main Course',100,  true,  true  from canteens where name = 'Main Canteen'
union all
select id, 'Chicken Biryani',      'Main Course',180,  false, true  from canteens where name = 'Main Canteen'
union all
select id, 'Masala Chai',          'Beverages',  20,   true,  true  from canteens where name = 'Main Canteen'
union all
select id, 'Cold Coffee',          'Beverages',  60,   true,  true  from canteens where name = 'Main Canteen'
union all
select id, 'Fresh Lime Soda',      'Beverages',  40,   true,  true  from canteens where name = 'Main Canteen'
union all
select id, 'Gulab Jamun',          'Desserts',   50,   true,  true  from canteens where name = 'Main Canteen'
union all
select id, 'Ice Cream',            'Desserts',   60,   true,  true  from canteens where name = 'Main Canteen'
on conflict do nothing;
