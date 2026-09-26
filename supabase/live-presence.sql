-- Reliable live-user heartbeat tracking.
-- Run this once in Supabase SQL Editor.
-- Safe to re-run.

alter table public.profiles
add column if not exists last_seen_at timestamptz;

alter table public.profiles
add column if not exists last_seen_path text;

create index if not exists profiles_last_seen_at_idx
on public.profiles (last_seen_at desc);

-- Optional cleanup of the old Realtime Presence policies.
drop policy if exists "students publish academy presence" on realtime.messages;
drop policy if exists "admins read academy presence" on realtime.messages;
drop policy if exists "authenticated read academy presence" on realtime.messages;

-- Verification
select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in ('last_seen_at', 'last_seen_path')
order by column_name;
