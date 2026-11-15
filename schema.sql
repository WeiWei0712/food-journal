-- 好好吃 FOOD JOURNAL - Supabase PostgreSQL database schema
-- Supabase Dashboard -> SQL Editor -> New query -> Run
-- This script can be rerun. The two tables are private to their owners.

create table if not exists public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  food_name text not null check (char_length(btrim(food_name)) between 1 and 100),
  serving text not null default '' check (char_length(serving) <= 60),
  calories integer not null check (calories between 0 and 10000),
  protein_g numeric(7,1) not null default 0 check (protein_g between 0 and 1000),
  carbs_g numeric(7,1) not null default 0 check (carbs_g between 0 and 1000),
  fat_g numeric(7,1) not null default 0 check (fat_g between 0 and 1000),
  notes text not null default '' check (char_length(notes) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists food_entries_user_date_idx
  on public.food_entries (user_id, entry_date desc, created_at);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_calorie_goal integer not null default 2000
    check (daily_calorie_goal between 500 and 10000)
);

-- IMPORTANT: row level security must be ON for public tables exposed to browser clients.
alter table public.food_entries enable row level security;
alter table public.user_settings enable row level security;

-- Public (signed-out) visitors have no permission on these tables.
revoke all on table public.food_entries from anon, authenticated;
revoke all on table public.user_settings from anon, authenticated;
grant select, insert, update, delete on table public.food_entries to authenticated;
grant select, insert, update, delete on table public.user_settings to authenticated;

-- Four operations per table, each locked to the authenticated user's own user_id.
drop policy if exists "food_entries_select_own" on public.food_entries;
create policy "food_entries_select_own" on public.food_entries
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "food_entries_insert_own" on public.food_entries;
create policy "food_entries_insert_own" on public.food_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "food_entries_update_own" on public.food_entries;
create policy "food_entries_update_own" on public.food_entries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "food_entries_delete_own" on public.food_entries;
create policy "food_entries_delete_own" on public.food_entries
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own" on public.user_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own" on public.user_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_settings_delete_own" on public.user_settings;
create policy "user_settings_delete_own" on public.user_settings
  for delete to authenticated using ((select auth.uid()) = user_id);