-- One viewing session plus observational browser presence. No device caps or cooldowns.
-- Run before deployment. Viewing enforcement is initially disabled.
begin;
-- Undo restrictions if the earlier, unshipped migration was installed.
do $$ declare t text; begin
  foreach t in array array['profiles','courses','enrollments','modules','lessons','lesson_progress','questions','replies','quiz_questions','notifications','support_requests','student_presence'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop policy if exists "registered browser required" on public.%I',t);
    end if;
  end loop;
  if to_regclass('public.account_access_settings') is not null then execute 'update public.account_access_settings set enabled=false'; end if;
end $$;
drop function if exists public.register_account_browser(uuid,uuid,text,text);
drop function if exists public.begin_account_device_replacement(uuid,uuid,text,text,uuid,uuid,text);
drop function if exists public.confirm_account_device_replacement(uuid,uuid,text,uuid,text);
drop function if exists public.account_viewing_lease(uuid,uuid,text,uuid,uuid,text);
create table if not exists public.viewing_access_settings (
  singleton boolean primary key default true check(singleton), enabled boolean not null default false
);
insert into public.viewing_access_settings(singleton) values(true) on conflict do nothing;
create table if not exists public.browser_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  browser_hash text not null check(browser_hash ~ '^[a-f0-9]{64}$'),
  label text not null, last_seen_at timestamptz not null default now(),
  last_seen_path text not null default '/dashboard', unique(user_id,browser_hash)
);
create index if not exists browser_connections_last_seen on public.browser_connections(last_seen_at desc);
create table if not exists public.lesson_viewing_leases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null, lease_id uuid not null,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  expires_at timestamptz not null
);
do $$ declare t text; begin
  foreach t in array array['viewing_access_settings','browser_connections','lesson_viewing_leases'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
create or replace function public.record_browser_connection(p_user uuid,p_hash text,p_label text,p_path text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.browser_connections(user_id,browser_hash,label,last_seen_path)
    values(p_user,p_hash,left(p_label,100),left(p_path,300))
    on conflict(user_id,browser_hash) do update set label=excluded.label,last_seen_at=now(),last_seen_path=excluded.last_seen_path;
end $$;
create or replace function public.browser_connection_counts()
returns table(user_id uuid,browser_count bigint)
language sql stable security definer set search_path = '' as $$
  select b.user_id,count(*) from public.browser_connections b group by b.user_id;
$$;
create or replace function public.manage_lesson_viewing(p_user uuid,p_session uuid,p_lease uuid,p_lesson uuid,p_action text,p_takeover boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.lesson_viewing_leases;
begin
  if not (select enabled from public.viewing_access_settings where singleton) then return jsonb_build_object('allowed',true,'disabled',true); end if;
  perform 1 from public.profiles where id=p_user for update;
  if not found or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user) then return jsonb_build_object('allowed',false,'reason','session'); end if;
  select * into v from public.lesson_viewing_leases where user_id=p_user;
  if p_action='start' then
    if not exists(select 1 from public.lessons l join public.modules m on m.id=l.module_id
      where l.id=p_lesson and (exists(select 1 from public.enrollments e where e.student_id=p_user and e.course_id=m.course_id)
      or exists(select 1 from public.profiles where id=p_user and is_admin))) then return jsonb_build_object('allowed',false,'reason','lesson'); end if;
    if v.user_id is not null and v.expires_at>now() and not p_takeover then return jsonb_build_object('allowed',false,'reason','active'); end if;
    insert into public.lesson_viewing_leases(user_id,session_id,lease_id,lesson_id,expires_at)
      values(p_user,p_session,p_lease,p_lesson,now()+interval '30 seconds')
      on conflict(user_id) do update set session_id=excluded.session_id,lease_id=excluded.lease_id,lesson_id=excluded.lesson_id,expires_at=excluded.expires_at;
    return jsonb_build_object('allowed',true);
  end if;
  if v.user_id is null or v.lease_id<>p_lease or v.session_id<>p_session or v.lesson_id<>p_lesson then return jsonb_build_object('allowed',false,'reason','superseded'); end if;
  if p_action='stop' then
    delete from public.lesson_viewing_leases where user_id=p_user and lease_id=p_lease;
    return jsonb_build_object('allowed',true);
  end if;
  if p_action<>'heartbeat' or v.expires_at<=now() then return jsonb_build_object('allowed',false,'reason','expired'); end if;
  update public.lesson_viewing_leases set expires_at=now()+interval '30 seconds' where user_id=p_user and lease_id=p_lease;
  return jsonb_build_object('allowed',true);
end $$;
revoke all on function public.record_browser_connection(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.browser_connection_counts() from public,anon,authenticated;
revoke all on function public.manage_lesson_viewing(uuid,uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.record_browser_connection(uuid,text,text,text) to service_role;
grant execute on function public.browser_connection_counts() to service_role;
grant execute on function public.manage_lesson_viewing(uuid,uuid,uuid,uuid,text,boolean) to service_role;
commit;
-- AFTER deploying the updated app:
-- update public.viewing_access_settings set enabled=true where singleton;
-- Rollback: set enabled=false. Browser counts continue; login is never device-limited.
