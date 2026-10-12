-- Djawed Logic community alerts. Safe to run again. Does not replay old posts.
begin;
create table if not exists public.community_notification_settings (
  id boolean primary key default true check (id),
  activated_at timestamptz not null default now(),
  next_send_at timestamptz not null default now()
);
insert into public.community_notification_settings(id) values(true) on conflict do nothing;
create table if not exists public.community_alerts (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check(type in ('admin_post','admin_reply')),
  question_id uuid not null references public.questions(id) on delete cascade,
  reply_id uuid references public.replies(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  check(recipient_id <> actor_id)
);
create unique index if not exists community_alert_post_unique on public.community_alerts(question_id,recipient_id) where reply_id is null;
create unique index if not exists community_alert_reply_unique on public.community_alerts(reply_id,recipient_id) where reply_id is not null;
create index if not exists community_alert_inbox on public.community_alerts(recipient_id,created_at desc);
create table if not exists public.community_email_jobs (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null unique references public.community_alerts(id) on delete cascade,
  recipient text not null,
  payload jsonb,
  status text not null default 'pending' check(status in ('pending','sending','sent','failed','held')),
  first_attempt_at timestamptz,
  locked_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  attempts integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists community_email_pending on public.community_email_jobs(status,next_attempt_at);
alter table public.replies add column if not exists reply_to_id uuid references public.replies(id) on delete set null;

alter table public.community_notification_settings enable row level security;
alter table public.community_alerts enable row level security;
alter table public.community_email_jobs enable row level security;
revoke all on public.community_notification_settings,public.community_alerts,public.community_email_jobs from anon,authenticated;
grant all on public.community_notification_settings,public.community_alerts,public.community_email_jobs to service_role;

-- The target is derived from a real reply in the same thread, never from a client user ID.
create or replace function public.validate_community_reply_target()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.reply_to_id is not null and not exists(
    select 1 from public.replies where id=new.reply_to_id and question_id=new.question_id
  ) then raise exception 'Reply target must belong to the same discussion'; end if;
  return new;
end $$;
drop trigger if exists community_reply_target_check on public.replies;
create trigger community_reply_target_check before insert or update of reply_to_id,question_id on public.replies
for each row execute function public.validate_community_reply_target();

-- Alerts and email jobs are committed in the same transaction as the post/reply.
create or replace function public.queue_admin_community_alerts()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare target uuid; qid uuid; rid uuid; kind text;
begin
  if not exists(select 1 from public.profiles where id=new.student_id and is_admin) then return new; end if;
  if tg_table_name='questions' then
    qid:=new.id; rid:=null; kind:='admin_post';
  else
    qid:=new.question_id; rid:=new.id; kind:='admin_reply';
    if new.reply_to_id is not null then
      select student_id into target from public.replies where id=new.reply_to_id and question_id=qid;
    else
      select student_id into target from public.questions where id=qid;
    end if;
  end if;
  with inserted as (
    insert into public.community_alerts(recipient_id,actor_id,type,question_id,reply_id)
    select p.id,new.student_id,kind,qid,rid from public.profiles p
    where p.id<>new.student_id and not p.is_admin
      and (kind='admin_post' or p.id=target)
    on conflict do nothing returning id,recipient_id
  )
  insert into public.community_email_jobs(alert_id,recipient)
  select i.id,u.email from inserted i join auth.users u on u.id=i.recipient_id
  where u.email is not null and u.deleted_at is null;
  return new;
end $$;
drop trigger if exists queue_admin_community_post on public.questions;
create trigger queue_admin_community_post after insert on public.questions for each row execute function public.queue_admin_community_alerts();
drop trigger if exists queue_admin_community_reply on public.replies;
create trigger queue_admin_community_reply after insert on public.replies for each row execute function public.queue_admin_community_alerts();

-- Preserve the original student notifications and pre-migration history. New
-- admin alerts come only from the targeted queue, hiding legacy trigger duplicates.
create or replace function public.community_notification_inbox()
returns table(id uuid,type text,question_id uuid,reply_id uuid,is_read boolean,created_at timestamptz,actor_id uuid,actor_display_name text,source text)
language sql security definer stable set search_path=public,pg_temp as $$
  select n.id,n.type::text,n.question_id,null::uuid,n.is_read,n.created_at,n.actor_id,p.display_name,'legacy'::text
  from public.notifications n left join public.profiles p on p.id=n.actor_id
  where n.recipient_id=auth.uid() and (not coalesce(p.is_admin,false) or n.created_at < (select activated_at from public.community_notification_settings where id))
  union all
  select n.id,n.type,n.question_id,n.reply_id,n.is_read,n.created_at,n.actor_id,p.display_name,'community'::text
  from public.community_alerts n left join public.profiles p on p.id=n.actor_id where n.recipient_id=auth.uid()
$$;
create or replace function public.mark_community_notifications_read(notification_id uuid default null, notification_source text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if notification_source is null or notification_source='legacy' then
    update public.notifications set is_read=true where recipient_id=auth.uid() and (notification_id is null or id=notification_id);
  end if;
  if notification_source is null or notification_source='community' then
    update public.community_alerts set is_read=true where recipient_id=auth.uid() and (notification_id is null or id=notification_id);
  end if;
end $$;

create or replace function public.claim_community_email(email_from text, platform_url text)
returns setof public.community_email_jobs language plpgsql security definer set search_path=public,pg_temp as $$
declare jid uuid;
begin
  -- A global pacing row prevents concurrent workers from overwhelming Resend.
  perform 1 from public.community_notification_settings where id and next_send_at<=now() for update skip locked;
  if not found then return; end if;
  update public.community_email_jobs set status='held',locked_until=null
    where status in ('pending','failed','sending') and first_attempt_at<now()-interval '23 hours' and (locked_until is null or locked_until<now());
  select j.id into jid from public.community_email_jobs j where j.status in ('pending','failed','sending')
    and j.next_attempt_at<=now() and (j.locked_until is null or j.locked_until<now())
    order by j.created_at,j.id for update skip locked limit 1;
  if jid is null then return; end if;
  update public.community_notification_settings set next_send_at=now()+interval '700 milliseconds' where id;
  return query update public.community_email_jobs j set status='sending',locked_until=now()+interval '5 minutes',
    first_attempt_at=coalesce(j.first_attempt_at,now()),attempts=j.attempts+1,
    payload=coalesce(j.payload,jsonb_build_object('from',email_from,'url',platform_url,'type',(select a.type from public.community_alerts a where a.id=j.alert_id)))
    where j.id=jid returning j.*;
end $$;
revoke all on function public.validate_community_reply_target(),public.queue_admin_community_alerts(),public.community_notification_inbox(),public.mark_community_notifications_read(uuid,text),public.claim_community_email(text,text) from public,anon,authenticated;
grant execute on function public.community_notification_inbox(),public.mark_community_notifications_read(uuid,text) to authenticated;
grant execute on function public.claim_community_email(text,text) to service_role;
notify pgrst,'reload schema';
commit;
