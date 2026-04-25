-- ============================================================
-- Canteen Token Migration
-- Run in Supabase SQL Editor AFTER the main canteen_schema.sql
-- ============================================================

-- Add token_id column to orders table
alter table orders
  add column if not exists token_id text;

-- Backfill existing orders with a random token
update orders
  set token_id = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  where token_id is null;

-- Make it non-nullable going forward
alter table orders
  alter column token_id set not null,
  add constraint orders_token_id_unique unique (token_id);
