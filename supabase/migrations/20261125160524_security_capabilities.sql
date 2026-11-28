-- Prepare security capabilities BEFORE deploying the matching application.
begin;
create table if not exists public.security_rate_limits(
 bucket text not null,
 key_hash text not null check(key_hash ~ '^[a-f0-9]{64}$'),
 hits integer not null check(hits>0),
 expires_at timestamptz not null,
 primary key(bucket,key_hash)
);
create index if not exists security_rate_limits_expiry on public.security_rate_limits(expires_at);
alter table public.security_rate_limits enable row level security;
revoke all on public.security_rate_limits from public,anon,authenticated;
grant all on public.security_rate_limits to service_role;

create or replace function public.take_security_rate_limit(p_bucket text,p_key text,p_limit integer,p_window_seconds integer)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare result public.security_rate_limits;
begin
 if p_bucket !~ '^[a-z-]{1,40}$' or p_key !~ '^[a-f0-9]{64}$' or p_limit not between 1 and 1000 or p_window_seconds not between 1 and 86400 then
   raise exception 'Invalid rate limit';
 end if;
 insert into public.security_rate_limits(bucket,key_hash,hits,expires_at)
 values(p_bucket,p_key,1,now()+make_interval(secs=>p_window_seconds))
 on conflict(bucket,key_hash) do update set
  hits=case when security_rate_limits.expires_at<=now() then 1 else least(security_rate_limits.hits+1,p_limit+1) end,
  expires_at=case when security_rate_limits.expires_at<=now() then now()+make_interval(secs=>p_window_seconds) else security_rate_limits.expires_at end
 returning * into result;
 return jsonb_build_object('allowed',result.hits<=p_limit,'retry_after',greatest(1,ceil(extract(epoch from result.expires_at-now()))));
end $fn$;
revoke all on function public.take_security_rate_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.take_security_rate_limit(text,text,integer,integer) to service_role;

create or replace function public.cleanup_security_rate_limits()
returns void language sql security definer set search_path='' as $fn$
 delete from public.security_rate_limits where expires_at<now()-interval '1 day';
$fn$;
revoke all on function public.cleanup_security_rate_limits() from public,anon,authenticated,service_role;
-- SCHEDULER BEGIN
select cron.schedule('cleanup-security-rate-limits','17 3 * * *','select public.cleanup_security_rate_limits()');
-- SCHEDULER END

create or replace function public.admin_mfa_status()
returns jsonb language sql stable security definer set search_path='' as $fn$
 with viewer as (select p.is_admin from public.profiles p where p.id=auth.uid()),
 factor as (select exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.status='verified') as enrolled)
 select jsonb_build_object('is_admin',coalesce((select is_admin from viewer),false),
 'required',coalesce((select is_admin from viewer),false) and factor.enrolled,
 'satisfied',coalesce((select is_admin from viewer),false) and (not factor.enrolled or coalesce(auth.jwt()->>'aal','')='aal2'))
 from factor;
$fn$;
revoke all on function public.admin_mfa_status() from public,anon;
grant execute on function public.admin_mfa_status() to authenticated,service_role;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path='' as $fn$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_admin and
  (not exists(select 1 from auth.mfa_factors f where f.user_id=p.id and f.status='verified') or coalesce(auth.jwt()->>'aal','')='aal2'));
$fn$;
-- Existing policies call is_admin for anon as well; it exposes only the caller's
-- own boolean, and returns false when auth.uid() is null.
create or replace function public.trial_full_features()
returns boolean language sql stable security definer set search_path='' as $fn$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and
 ((p.is_admin and public.is_admin()) or (not p.is_admin and p.access_mode='full')));
$fn$;
create or replace function public.trial_account_active()
returns boolean language sql stable security definer set search_path='' as $fn$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and
 ((p.is_admin and public.is_admin()) or (not p.is_admin and
 (p.access_mode='full' or (p.access_mode='trial' and p.trial_expires_at>now())))));
$fn$;
create or replace function public.trial_module_allowed(p_module uuid)
returns boolean language sql stable security definer set search_path='' as $fn$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and
 ((p.is_admin and public.is_admin()) or (not p.is_admin and
 (p.access_mode='full' or (p.access_mode='trial' and p.trial_expires_at>now() and p.trial_module_id=p_module)))));
$fn$;

create or replace function public.community_member_profiles(p_ids uuid[])
returns table(id uuid,display_name text,is_admin boolean,bio text,avatar_url text,instagram_url text,facebook_url text,tiktok_url text,linkedin_url text)
language plpgsql stable security definer set search_path='' as $fn$
begin
 if auth.uid() is null or not public.trial_full_features() then raise exception 'Full access required' using errcode='42501'; end if;
 if p_ids is null or cardinality(p_ids)>100 then raise exception 'Invalid profile request'; end if;
 return query select p.id,p.display_name,p.is_admin,p.bio,p.avatar_url,p.instagram_url,p.facebook_url,p.tiktok_url,p.linkedin_url
 from public.profiles p where p.id=any(p_ids) and (p.access_mode='full' or p.is_admin);
end $fn$;
revoke all on function public.community_member_profiles(uuid[]) from public,anon;
grant execute on function public.community_member_profiles(uuid[]) to authenticated,service_role;

-- Trigger functions cannot be called directly; remove unnecessary public grants.
revoke all on function public.notify_admins_on_new_question(),public.notify_asker_on_new_reply(),
 public.skip_trial_lesson_emails(),public.skip_trial_notifications(),public.guard_trial_profile()
 from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
