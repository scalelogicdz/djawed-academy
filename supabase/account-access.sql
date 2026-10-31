-- Apply before deploying the matching app. Enforcement stays OFF until explicitly enabled.
begin;
create table if not exists public.account_access_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
insert into public.account_access_settings(singleton) values(true) on conflict do nothing;
create table if not exists public.account_device_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_replaced_at timestamptz
);
create table if not exists public.account_browsers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  label text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(user_id, token_hash)
);
create table if not exists public.account_browser_sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  browser_id uuid not null references public.account_browsers(id) on delete cascade
);
create table if not exists public.account_device_challenges (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  target_id uuid not null references public.account_browsers(id),
  browser_hash text not null,
  browser_label text not null,
  code_hash text not null,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  sent_at timestamptz,
  consumed_at timestamptz
);
create index if not exists account_challenge_user_time on public.account_device_challenges(user_id, created_at);
create table if not exists public.account_viewing_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  browser_id uuid not null references public.account_browsers(id),
  session_id uuid not null,
  lease_id uuid not null,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  expires_at timestamptz not null
);
-- Only server service-role code can access these records or invoke mutating functions.
do $$ declare t text; begin
  foreach t in array array['account_access_settings','account_device_state','account_browsers','account_browser_sessions','account_device_challenges','account_viewing_sessions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

create or replace function public.account_access_enabled() returns boolean
language sql stable security definer set search_path = '' as $$
  select enabled from public.account_access_settings where singleton;
$$;
create or replace function public.account_session_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select not public.account_access_enabled() or exists (
    select 1 from public.account_browser_sessions s
    join public.account_browsers b on b.id=s.browser_id and b.user_id=s.user_id
    join auth.sessions a on a.id=s.session_id and a.user_id=s.user_id
    where s.user_id=auth.uid() and s.session_id=(auth.jwt()->>'session_id')::uuid and b.revoked_at is null
  );
$$;

-- Restrictive policies are ANDed with existing enrollment/admin policies.
-- Anonymous public pages retain their existing access rules.
do $$ declare t text; begin
  foreach t in array array['profiles','courses','enrollments','modules','lessons','lesson_progress','questions','replies','quiz_questions','notifications','support_requests','student_presence'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop policy if exists "registered browser required" on public.%I',t);
      execute format('create policy "registered browser required" on public.%I as restrictive for all to authenticated using (public.account_session_allowed()) with check (public.account_session_allowed())',t);
    end if;
  end loop;
end $$;

create or replace function public.register_account_browser(p_user uuid,p_session uuid,p_hash text,p_label text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.account_browsers; n int;
begin
  if not public.account_access_enabled() then return jsonb_build_object('allowed',true,'disabled',true); end if;
  perform 1 from public.profiles where id=p_user for update;
  if not found or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user) then
    return jsonb_build_object('allowed',false,'reason','session');
  end if;
  select * into b from public.account_browsers where user_id=p_user and token_hash=p_hash;
  if found and b.revoked_at is not null then return jsonb_build_object('allowed',false,'reason','revoked'); end if;
  if b.id is null then
    select count(*) into n from public.account_browsers where user_id=p_user and revoked_at is null;
    if n>=2 then return jsonb_build_object('allowed',false,'reason','limit'); end if;
    insert into public.account_browsers(user_id,token_hash,label) values(p_user,p_hash,left(p_label,100)) returning * into b;
  else
    update public.account_browsers set last_seen_at=now() where id=b.id and last_seen_at<now()-interval '5 minutes';
  end if;
  insert into public.account_browser_sessions(session_id,user_id,browser_id) values(p_session,p_user,b.id)
    on conflict(session_id) do update set browser_id=excluded.browser_id where account_browser_sessions.user_id=p_user;
  return jsonb_build_object('allowed',true,'browserId',b.id);
end $$;

create or replace function public.begin_account_device_replacement(p_user uuid,p_session uuid,p_hash text,p_label text,p_target uuid,p_id uuid,p_code_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare last_change timestamptz;
begin
  perform 1 from public.profiles where id=p_user for update;
  if not found or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user) then return jsonb_build_object('error','session'); end if;
  if not public.account_access_enabled() then return jsonb_build_object('error','disabled'); end if;
  if not exists(select 1 from public.account_browsers where id=p_target and user_id=p_user and revoked_at is null)
     or exists(select 1 from public.account_browsers where user_id=p_user and token_hash=p_hash and revoked_at is null) then return jsonb_build_object('error','target'); end if;
  select last_replaced_at into last_change from public.account_device_state where user_id=p_user;
  if last_change>now()-interval '7 days' then return jsonb_build_object('error','cooldown','nextAt',last_change+interval '7 days'); end if;
  if exists(select 1 from public.account_device_challenges where user_id=p_user and created_at>now()-interval '60 seconds')
     or (select count(*) from public.account_device_challenges where user_id=p_user and created_at>now()-interval '1 hour')>=3 then return jsonb_build_object('error','rate'); end if;
  update public.account_device_challenges set consumed_at=now() where user_id=p_user and consumed_at is null;
  delete from public.account_device_challenges where user_id=p_user and created_at<now()-interval '1 day';
  insert into public.account_device_challenges(id,user_id,session_id,target_id,browser_hash,browser_label,code_hash)
    values(p_id,p_user,p_session,p_target,p_hash,left(p_label,100),p_code_hash);
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.confirm_account_device_replacement(p_user uuid,p_session uuid,p_hash text,p_id uuid,p_code_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.account_device_challenges; b uuid; last_change timestamptz;
begin
  if not public.account_access_enabled() then return jsonb_build_object('error','disabled'); end if;
  perform 1 from public.profiles where id=p_user for update;
  if not found or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user) then return jsonb_build_object('error','session'); end if;
  select * into c from public.account_device_challenges where id=p_id and user_id=p_user for update;
  if not found or c.session_id<>p_session or c.browser_hash<>p_hash or c.sent_at is null or c.consumed_at is not null or c.expires_at<=now() or c.attempts>=5 then return jsonb_build_object('error','invalid'); end if;
  update public.account_device_challenges set attempts=attempts+1 where id=c.id;
  if c.code_hash<>p_code_hash then return jsonb_build_object('error','invalid'); end if;
  select last_replaced_at into last_change from public.account_device_state where user_id=p_user;
  if last_change>now()-interval '7 days' then return jsonb_build_object('error','cooldown'); end if;
  if not exists(select 1 from public.account_browsers where id=c.target_id and user_id=p_user and revoked_at is null)
    or exists(select 1 from public.account_browsers where user_id=p_user and token_hash=p_hash and revoked_at is null) then return jsonb_build_object('error','target'); end if;
  update public.account_browsers set revoked_at=now() where id=c.target_id;
  delete from public.account_browser_sessions where browser_id=c.target_id;
  delete from public.account_viewing_sessions where browser_id=c.target_id;
  insert into public.account_browsers(user_id,token_hash,label) values(p_user,p_hash,c.browser_label)
    on conflict(user_id,token_hash) do update set revoked_at=null,last_seen_at=now() returning id into b;
  insert into public.account_browser_sessions(session_id,user_id,browser_id) values(p_session,p_user,b)
    on conflict(session_id) do update set browser_id=excluded.browser_id;
  insert into public.account_device_state(user_id,last_replaced_at) values(p_user,now())
    on conflict(user_id) do update set last_replaced_at=excluded.last_replaced_at;
  update public.account_device_challenges set consumed_at=now() where user_id=p_user and consumed_at is null;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.account_viewing_lease(p_user uuid,p_session uuid,p_hash text,p_lease uuid,p_lesson uuid,p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b uuid; v public.account_viewing_sessions; until_at timestamptz;
begin
  if not public.account_access_enabled() then return jsonb_build_object('allowed',true,'disabled',true); end if;
  perform 1 from public.profiles where id=p_user for update;
  select s.browser_id into b from public.account_browser_sessions s
    join public.account_browsers d on d.id=s.browser_id and d.user_id=s.user_id
    join auth.sessions a on a.id=s.session_id and a.user_id=s.user_id
    where s.user_id=p_user and s.session_id=p_session and d.token_hash=p_hash and d.revoked_at is null;
  if b is null then return jsonb_build_object('allowed',false,'reason','device'); end if;
  if p_action='start' then
    if not exists(select 1 from public.lessons l join public.modules m on m.id=l.module_id
      where l.id=p_lesson and (exists(select 1 from public.enrollments e where e.student_id=p_user and e.course_id=m.course_id)
      or exists(select 1 from public.profiles where id=p_user and is_admin))) then return jsonb_build_object('allowed',false,'reason','lesson'); end if;
    until_at=now()+interval '30 seconds';
    insert into public.account_viewing_sessions(user_id,browser_id,session_id,lease_id,lesson_id,expires_at)
      values(p_user,b,p_session,p_lease,p_lesson,until_at)
      on conflict(user_id) do update set browser_id=excluded.browser_id,session_id=excluded.session_id,lease_id=excluded.lease_id,lesson_id=excluded.lesson_id,expires_at=excluded.expires_at;
    return jsonb_build_object('allowed',true);
  end if;
  select * into v from public.account_viewing_sessions where user_id=p_user;
  if not found or v.lease_id<>p_lease or v.browser_id<>b or v.session_id<>p_session or v.lesson_id<>p_lesson then return jsonb_build_object('allowed',false,'reason','superseded'); end if;
  if p_action='stop' then
    delete from public.account_viewing_sessions where user_id=p_user and lease_id=p_lease;
    return jsonb_build_object('allowed',true);
  end if;
  if p_action<>'heartbeat' or v.expires_at<=now() then return jsonb_build_object('allowed',false,'reason','expired'); end if;
  update public.account_viewing_sessions set expires_at=now()+interval '30 seconds' where user_id=p_user and lease_id=p_lease;
  return jsonb_build_object('allowed',true);
end $$;

revoke all on function public.account_access_enabled() from public, anon, authenticated;
revoke all on function public.account_session_allowed() from public, anon;
grant execute on function public.account_session_allowed() to authenticated;
do $$ declare f regprocedure; begin
  for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in
    ('register_account_browser','begin_account_device_replacement','confirm_account_device_replacement','account_viewing_lease') loop
    execute format('revoke all on function %s from public, anon, authenticated',f);
    execute format('grant execute on function %s to service_role',f);
  end loop;
end $$;
grant execute on function public.account_access_enabled() to service_role;
commit;
-- AFTER the new deployment passes its checks, enable with:
-- update public.account_access_settings set enabled=true where singleton;
-- Emergency rollback (preserves registrations): set enabled=false.
