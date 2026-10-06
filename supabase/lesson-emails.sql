-- Run once in the Supabase SQL editor. All email data and RPCs are service-role only.
create table if not exists public.lesson_email_jobs (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  recipient text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','held')),
  first_attempt_at timestamptz,
  locked_until timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (lesson_id, student_id)
);
alter table public.lesson_email_jobs enable row level security;
revoke all on public.lesson_email_jobs from anon, authenticated;
grant all on public.lesson_email_jobs to service_role;
create index if not exists lesson_email_pending on public.lesson_email_jobs(status, created_at);

-- Lesson and its recipient snapshot are committed together, or neither is saved.
create or replace function public.create_lesson_with_emails(lesson jsonb, email_from text, platform_url text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare saved public.lessons; course uuid;
begin
  insert into public.lessons(module_id,title,description,video_id,video_provider,resource_url,position)
  values ((lesson->>'module_id')::uuid,lesson->>'title',lesson->>'description',lesson->>'video_id',lesson->>'video_provider',lesson->>'resource_url',(lesson->>'position')::integer)
  returning * into saved;
  select course_id into course from public.modules where id = saved.module_id;
  insert into public.lesson_email_jobs(lesson_id,student_id,recipient,payload)
  select saved.id,e.student_id,u.email,jsonb_build_object('from',email_from,'title',saved.title,'url',platform_url || '/lesson/' || saved.id::text)
  from public.enrollments e join public.profiles p on p.id=e.student_id join auth.users u on u.id=e.student_id
  where e.course_id=course and not p.is_admin and u.email is not null and u.deleted_at is null;
  return to_jsonb(saved);
end $$;

-- A lease excludes parallel workers. Ambiguous deliveries older than Resend's
-- 24-hour idempotency window are held for review rather than sent twice.
create or replace function public.claim_lesson_email()
returns setof public.lesson_email_jobs language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.lesson_email_jobs set status='held',locked_until=null
  where status in ('pending','failed','sending') and first_attempt_at < now()-interval '23 hours'
    and (locked_until is null or locked_until < now());
  return query
  update public.lesson_email_jobs j set status='sending', locked_until=now()+interval '5 minutes', first_attempt_at=coalesce(j.first_attempt_at,now())
  where j.id=(select id from public.lesson_email_jobs
    where status in ('pending','failed','sending') and (locked_until is null or locked_until < now())
    order by created_at,id for update skip locked limit 1)
  returning j.*;
end $$;
revoke all on function public.create_lesson_with_emails(jsonb,text,text) from public,anon,authenticated;
revoke all on function public.claim_lesson_email() from public,anon,authenticated;
grant execute on function public.create_lesson_with_emails(jsonb,text,text) to service_role;
grant execute on function public.claim_lesson_email() to service_role;
