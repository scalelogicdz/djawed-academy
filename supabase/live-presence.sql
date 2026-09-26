-- Live student presence for the admin dashboard.
-- Run this once in Supabase SQL Editor.
--
-- This uses a PRIVATE Realtime channel named:
--   academy:student-presence
--
-- Students may publish their own connection state to the channel.
-- Only admins may receive the channel's presence state.
--
-- Do NOT disable "Allow public access" globally in Realtime Settings;
-- other existing realtime features may still use public channels.

drop policy if exists "students publish academy presence" on realtime.messages;
create policy "students publish academy presence"
on realtime.messages
for insert
to authenticated
with check (
  (select realtime.topic()) = 'academy:student-presence'
  and realtime.messages.extension = 'presence'
  and not public.is_admin()
);

drop policy if exists "admins read academy presence" on realtime.messages;
create policy "admins read academy presence"
on realtime.messages
for select
to authenticated
using (
  (select realtime.topic()) = 'academy:student-presence'
  and realtime.messages.extension = 'presence'
  and public.is_admin()
);

-- Read-only verification: these two policies should appear below.
select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'realtime'
  and tablename = 'messages'
order by policyname;
