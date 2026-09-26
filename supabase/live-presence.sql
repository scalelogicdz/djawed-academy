-- Live student presence for the admin dashboard.
-- Run this in Supabase SQL Editor to update the existing Presence policies.
--
-- IMPORTANT:
-- Supabase private Presence requires a participant to be authorized to
-- receive Presence state as well as publish its own state.
--
-- Presence payloads intentionally contain only:
--   - an opaque server-generated key
--   - the current platform path
--   - a timestamp
-- No student name, email, or raw user id is broadcast.

drop policy if exists "students publish academy presence" on realtime.messages;
drop policy if exists "admins read academy presence" on realtime.messages;
drop policy if exists "authenticated read academy presence" on realtime.messages;

create policy "authenticated read academy presence"
on realtime.messages
for select
to authenticated
using (
  (select realtime.topic()) = 'academy:student-presence'
  and realtime.messages.extension = 'presence'
);

create policy "students publish academy presence"
on realtime.messages
for insert
to authenticated
with check (
  (select realtime.topic()) = 'academy:student-presence'
  and realtime.messages.extension = 'presence'
  and not public.is_admin()
);

select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'realtime'
  and tablename = 'messages'
  and policyname in (
    'authenticated read academy presence',
    'students publish academy presence'
  )
order by policyname;
