-- Djawed Academy production security hardening.
-- Run this in Supabase SQL Editor AFTER the matching application code is deployed.
-- Safe to re-run.

-- Harden SECURITY DEFINER helper against search_path manipulation.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ============================================================
-- Quiz questions
-- Students may read quiz questions only for courses they can access.
-- Only admins may create/update/delete quiz questions.
-- ============================================================
do $$
declare
  policy_row record;
begin
  if to_regclass('public.quiz_questions') is not null then
    execute 'alter table public.quiz_questions enable row level security';

    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = 'quiz_questions'
    loop
      execute format('drop policy if exists %I on public.quiz_questions', policy_row.policyname);
    end loop;

    execute $policy$
      create policy "read quiz questions if enrolled"
      on public.quiz_questions
      for select
      using (
        public.is_admin()
        or exists (
          select 1
          from public.lessons l
          join public.modules m on m.id = l.module_id
          join public.enrollments e on e.course_id = m.course_id
          where l.id = quiz_questions.lesson_id
            and e.student_id = auth.uid()
        )
      )
    $policy$;

    execute $policy$
      create policy "admin manages quiz questions"
      on public.quiz_questions
      for all
      using (public.is_admin())
      with check (public.is_admin())
    $policy$;
  end if;
end
$$;

-- ============================================================
-- Support requests
-- The browser no longer writes directly to this table.
-- The authenticated server endpoint writes with the service role.
-- Students cannot enumerate or tamper with support requests.
-- ============================================================
do $$
declare
  policy_row record;
begin
  if to_regclass('public.support_requests') is not null then
    execute 'alter table public.support_requests enable row level security';

    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = 'support_requests'
    loop
      execute format('drop policy if exists %I on public.support_requests', policy_row.policyname);
    end loop;

    execute $policy$
      create policy "admin manages support requests"
      on public.support_requests
      for all
      using (public.is_admin())
      with check (public.is_admin())
    $policy$;

    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.support_requests'::regclass
        and conname = 'support_request_subject_length'
    ) then
      execute $constraint$
        alter table public.support_requests
        add constraint support_request_subject_length
        check (char_length(trim(subject)) between 2 and 160)
        not valid
      $constraint$;
    end if;

    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.support_requests'::regclass
        and conname = 'support_request_message_length'
    ) then
      execute $constraint$
        alter table public.support_requests
        add constraint support_request_message_length
        check (char_length(trim(message)) between 2 and 3000)
        not valid
      $constraint$;
    end if;
  end if;
end
$$;

-- ============================================================
-- Notifications
-- Audit only for now. The notification trigger/policies were created
-- outside the repository, so we do not replace them blindly.
-- After running this file, inspect the audit output below before
-- changing notification policies.
-- ============================================================

-- ============================================================
-- Community body limits.
-- NOT VALID keeps existing historical rows from blocking deployment,
-- while PostgreSQL still enforces the checks on new/updated rows.
-- ============================================================
do $$
begin
  if to_regclass('public.questions') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.questions'::regclass
         and conname = 'questions_body_length'
     ) then
    execute $constraint$
      alter table public.questions
      add constraint questions_body_length
      check (char_length(trim(body)) between 1 and 5000)
      not valid
    $constraint$;
  end if;

  if to_regclass('public.replies') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.replies'::regclass
         and conname = 'replies_body_length'
     ) then
    execute $constraint$
      alter table public.replies
      add constraint replies_body_length
      check (char_length(trim(body)) between 1 and 5000)
      not valid
    $constraint$;
  end if;
end
$$;

-- Audit result: verify RLS state for newer tables.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('quiz_questions', 'support_requests', 'notifications', 'questions', 'replies')
order by c.relname;

-- Read-only audit of notification policies.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'notifications'
order by policyname;

-- Read-only audit of question/reply/notification triggers.
select
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in ('questions', 'replies', 'notifications')
order by event_object_table, trigger_name, event_manipulation;
