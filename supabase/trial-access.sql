-- Apply once in Supabase SQL Editor. Re-runnable; existing accounts are FULL
-- and permanently excluded from automatic trial deletion.
begin;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id=auth.uid()),false);
$$;
alter table public.profiles
  add column if not exists access_mode text not null default 'full',
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_expires_at timestamptz,
  add column if not exists trial_module_id uuid references public.modules(id) on delete restrict,
  add column if not exists ever_full_access boolean not null default true;

create or replace function public.guard_trial_profile()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.access_mode not in ('full','trial') then raise exception 'Invalid access mode'; end if;
  if tg_op='UPDATE' then
    if old.ever_full_access and (not new.ever_full_access or new.access_mode='trial') then
      raise exception 'Full accounts cannot be converted to deletable trials';
    end if;
    if (new.access_mode,new.trial_started_at,new.trial_expires_at,new.trial_module_id,new.ever_full_access,new.is_admin)
       is distinct from (old.access_mode,old.trial_started_at,old.trial_expires_at,old.trial_module_id,old.ever_full_access,old.is_admin)
       and current_user not in ('postgres','supabase_admin','service_role') then
      raise exception 'Access changes require a trusted administrator';
    end if;
  elsif current_user not in ('postgres','supabase_admin','service_role') then
    raise exception 'Profile creation requires a trusted administrator';
  end if;
  if new.access_mode='trial' then
    if new.is_admin or new.ever_full_access or new.trial_started_at is null or new.trial_module_id is null
       or new.trial_expires_at is distinct from new.trial_started_at+interval '7 days' then
      raise exception 'Invalid trial account';
    end if;
  else
    new.ever_full_access := true;
    new.trial_started_at := null; new.trial_expires_at := null; new.trial_module_id := null;
  end if;
  return new;
end $$;
drop trigger if exists protect_trial_access on public.profiles;
create trigger protect_trial_access before insert or update on public.profiles
for each row execute function public.guard_trial_profile();

-- No caller-supplied user ID: authenticated helpers always use auth.uid().
create or replace function public.trial_full_features()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and (p.is_admin or p.access_mode='full'));
$$;
create or replace function public.trial_account_active()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and
    (p.is_admin or p.access_mode='full' or (p.access_mode='trial' and p.trial_expires_at>now())));
$$;
create or replace function public.trial_module_allowed(p_module uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and
    (p.is_admin or p.access_mode='full' or (p.access_mode='trial' and p.trial_expires_at>now() and p.trial_module_id=p_module)));
$$;
create or replace function public.trial_lesson_allowed(p_lesson uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.lessons l where l.id=p_lesson and public.trial_module_allowed(l.module_id));
$$;
revoke all on function public.trial_full_features(), public.trial_account_active(), public.trial_module_allowed(uuid), public.trial_lesson_allowed(uuid) from public,anon;
grant execute on function public.trial_full_features(), public.trial_account_active(), public.trial_module_allowed(uuid), public.trial_lesson_allowed(uuid) to authenticated,service_role;

-- RESTRICTIVE policies AND with existing policies, so a legacy permissive
-- enrollment/community policy cannot accidentally reopen trial content.
do $$ declare t text; begin
  foreach t in array array['courses','enrollments','student_presence'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security',t);
      execute format('drop policy if exists "trial active account" on public.%I',t);
      execute format('create policy "trial active account" on public.%I as restrictive for all to authenticated using (public.trial_account_active()) with check (public.trial_account_active())',t);
    end if;
  end loop;
  foreach t in array array['questions','replies','notifications','community_alerts','support_requests','quiz_questions','quiz_attempts','quiz_results'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security',t);
      execute format('drop policy if exists "full access features only" on public.%I',t);
      execute format('create policy "full access features only" on public.%I as restrictive for all to authenticated using (public.trial_full_features()) with check (public.trial_full_features())',t);
    end if;
  end loop;
end $$;
drop policy if exists "trial profile scope" on public.profiles;
create policy "trial profile scope" on public.profiles as restrictive for all to authenticated
using (public.trial_full_features() or id=auth.uid())
with check (public.trial_full_features());
drop policy if exists "trial module scope" on public.modules;
create policy "trial module scope" on public.modules as restrictive for all to authenticated
using (public.trial_module_allowed(id)) with check (public.trial_full_features());
drop policy if exists "trial lesson scope" on public.lessons;
create policy "trial lesson scope" on public.lessons as restrictive for all to authenticated
using (public.trial_full_features()) with check (public.trial_full_features());
drop policy if exists "trial progress scope" on public.lesson_progress;
create policy "trial progress scope" on public.lesson_progress as restrictive for all to authenticated
using (public.trial_lesson_allowed(lesson_id)) with check (public.trial_lesson_allowed(lesson_id));
-- Trial videos/outline are delivered by the server after an exact module check.
-- No direct REST access to video IDs, downloads, descriptions or locked lessons.

create or replace function public.skip_trial_notifications()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.profiles p where p.id=new.recipient_id and p.access_mode='trial') then return null; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['notifications','community_alerts'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists skip_trial_notifications on public.%I',t);
      execute format('create trigger skip_trial_notifications before insert on public.%I for each row execute function public.skip_trial_notifications()',t);
    end if;
  end loop;
end $$;
create or replace function public.skip_trial_lesson_emails()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.profiles p where p.id=new.student_id and p.access_mode='trial') then return null; end if;
  return new;
end $$;
do $$ begin
  if to_regclass('public.lesson_email_jobs') is not null then
    drop trigger if exists skip_trial_lesson_emails on public.lesson_email_jobs;
    create trigger skip_trial_lesson_emails before insert on public.lesson_email_jobs for each row execute function public.skip_trial_lesson_emails();
  end if;
end $$;

-- Close SECURITY DEFINER notification RPC bypasses too. Keep the original
-- implementation private, then guard the public API wrappers.
do $$ begin
  if to_regprocedure('public.community_notification_inbox()') is not null
     and to_regprocedure('public.full_community_notification_inbox()') is null then
    alter function public.community_notification_inbox() rename to full_community_notification_inbox;
  end if;
  if to_regprocedure('public.mark_community_notifications_read(uuid,text)') is not null
     and to_regprocedure('public.full_mark_community_notifications_read(uuid,text)') is null then
    alter function public.mark_community_notifications_read(uuid,text) rename to full_mark_community_notifications_read;
  end if;
end $$;
do $$ begin
  if to_regprocedure('public.full_community_notification_inbox()') is not null then
    revoke all on function public.full_community_notification_inbox() from public,anon,authenticated;
    execute $fn$create or replace function public.community_notification_inbox()
      returns table(id uuid,type text,question_id uuid,reply_id uuid,is_read boolean,created_at timestamptz,actor_id uuid,actor_display_name text,source text)
      language plpgsql security definer set search_path='' as $body$
      begin
        if not public.trial_full_features() then raise exception 'Full access required' using errcode='42501'; end if;
        return query select * from public.full_community_notification_inbox();
      end $body$ $fn$;
    revoke all on function public.community_notification_inbox() from public,anon;
    grant execute on function public.community_notification_inbox() to authenticated;
  end if;
  if to_regprocedure('public.full_mark_community_notifications_read(uuid,text)') is not null then
    revoke all on function public.full_mark_community_notifications_read(uuid,text) from public,anon,authenticated;
    execute $fn$create or replace function public.mark_community_notifications_read(notification_id uuid default null, notification_source text default null)
      returns void language plpgsql security definer set search_path='' as $body$
      begin
        if not public.trial_full_features() then raise exception 'Full access required' using errcode='42501'; end if;
        perform public.full_mark_community_notifications_read(notification_id,notification_source);
      end $body$ $fn$;
    revoke all on function public.mark_community_notifications_read(uuid,text) from public,anon;
    grant execute on function public.mark_community_notifications_read(uuid,text) to authenticated;
  end if;
end $$;
do $$ begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists "trial storage lock" on storage.objects;
    create policy "trial storage lock" on storage.objects as restrictive for all to authenticated
      using (public.trial_full_features()) with check (public.trial_full_features());
  end if;
end $$;

-- All privileged functions below are service-only. No trial selection/expiry
-- supplied by the browser can become an authorization grant.
create or replace function public.create_trial_student(p_student uuid,p_name text,p_display text,p_course uuid)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare chosen uuid; started timestamptz:=now();
begin
  select m.id into chosen from public.modules m where m.course_id=p_course
    and exists(select 1 from public.lessons l where l.module_id=m.id)
    and not exists(select 1 from public.site_content s where s.key='module-visibility:'||m.id::text and s.content->>'hidden'='true')
    order by m.position,m.id limit 1;
  if chosen is null then raise exception 'No published first module available'; end if;
  insert into public.profiles(id,full_name,display_name,is_admin,access_mode,ever_full_access,trial_started_at,trial_expires_at,trial_module_id)
    values(p_student,p_name,p_display,false,'trial',false,started,started+interval '7 days',chosen);
  insert into public.enrollments(student_id,course_id) values(p_student,p_course);
  return started+interval '7 days';
end $$;
create or replace function public.upgrade_trial_student(p_student uuid,p_course uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  -- The same row lock is taken by deletion: upgrades and cleanup serialize.
  perform 1 from public.profiles where id=p_student and not is_admin for update;
  if not found then raise exception 'Student no longer exists'; end if;
  if not exists(select 1 from public.courses where id=p_course) then raise exception 'Invalid course'; end if;
  update public.profiles set access_mode='full',ever_full_access=true where id=p_student;
  insert into public.enrollments(student_id,course_id) values(p_student,p_course) on conflict(student_id,course_id) do nothing;
end $$;
create or replace function public.delete_expired_trial_accounts()
returns integer language plpgsql security definer set search_path='' as $$
declare candidate uuid; deleted integer:=0;
begin
  for candidate in select p.id from public.profiles p
    where p.access_mode='trial' and not p.is_admin and not p.ever_full_access and p.trial_expires_at<=now()
    order by p.trial_expires_at limit 100 for update skip locked
  loop
    -- Re-check under lock; failed deletes leave the account expired, never unlocked.
    begin
      delete from auth.users u using public.profiles p where u.id=candidate and p.id=u.id
        and p.access_mode='trial' and not p.is_admin and not p.ever_full_access and p.trial_expires_at<=now();
      if found then deleted:=deleted+1; end if;
    exception when others then raise warning 'Expired trial deletion failed for %',candidate;
    end;
  end loop;
  return deleted;
end $$;
revoke all on function public.create_trial_student(uuid,text,text,uuid),public.upgrade_trial_student(uuid,uuid),public.delete_expired_trial_accounts() from public,anon,authenticated;
grant execute on function public.create_trial_student(uuid,text,text,uuid),public.upgrade_trial_student(uuid,uuid) to service_role;
-- Cleanup is intentionally NOT exposed even to service_role: only the database job.

-- SCHEDULER BEGIN (omitted only in isolated PostgreSQL test harness)
create extension if not exists pg_cron;
select cron.schedule('delete-expired-djawed-trials','*/5 * * * *','select public.delete_expired_trial_accounts()');
-- SCHEDULER END
create or replace function public.trial_access_ready()
returns boolean language sql security definer set search_path='' as $$ select true; $$;
revoke all on function public.trial_access_ready() from public,anon,authenticated;
grant execute on function public.trial_access_ready() to service_role;
notify pgrst,'reload schema';
commit;
