-- Extend the existing private, leased email queue; historical payloads stay intact.
begin;
alter table public.lesson_email_jobs alter column lesson_id drop not null;
alter table public.lesson_email_jobs add column if not exists module_id uuid references public.modules(id) on delete cascade;
alter table public.lesson_email_jobs add constraint lesson_email_content_target check (num_nonnulls(lesson_id,module_id)=1);
create unique index if not exists module_email_student_unique on public.lesson_email_jobs(module_id,student_id) where module_id is not null;

create or replace function public.create_module_with_emails(module jsonb,email_from text,platform_url text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare saved public.modules;
begin
  insert into public.modules(course_id,title,description,thumbnail_url,position)
  values((module->>'course_id')::uuid,module->>'title',module->>'description',module->>'thumbnail_url',(module->>'position')::integer)
  returning * into saved;
  insert into public.lesson_email_jobs(module_id,student_id,recipient,payload)
  select saved.id,e.student_id,u.email,jsonb_build_object('from',email_from,'title',saved.title,'module_title',saved.title,'kind','module','template_version',2,'url',platform_url)
  from public.enrollments e join public.profiles p on p.id=e.student_id join auth.users u on u.id=e.student_id
  where e.course_id=saved.course_id and not p.is_admin and p.access_mode='full' and u.email is not null and u.deleted_at is null;
  return to_jsonb(saved);
end $fn$;
revoke all on function public.create_module_with_emails(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.create_module_with_emails(jsonb,text,text) to service_role;

create or replace function public.create_lesson_with_emails(lesson jsonb,email_from text,platform_url text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare saved public.lessons; parent public.modules;
begin
  select * into strict parent from public.modules where id=(lesson->>'module_id')::uuid;
  if exists(select 1 from public.site_content where key='module-visibility:'||parent.id::text and content->>'hidden'='true') then
    raise exception 'Module is hidden';
  end if;
  insert into public.lessons(module_id,title,description,video_id,video_provider,resource_url,position)
  values(parent.id,lesson->>'title',lesson->>'description',lesson->>'video_id',lesson->>'video_provider',lesson->>'resource_url',(lesson->>'position')::integer)
  returning * into saved;
  insert into public.lesson_email_jobs(lesson_id,student_id,recipient,payload)
  select saved.id,e.student_id,u.email,jsonb_build_object('from',email_from,'title',saved.title,'module_title',parent.title,'kind','lesson','template_version',2,'url',platform_url)
  from public.enrollments e join public.profiles p on p.id=e.student_id join auth.users u on u.id=e.student_id
  where e.course_id=parent.course_id and not p.is_admin and p.access_mode='full' and u.email is not null and u.deleted_at is null;
  return to_jsonb(saved);
end $fn$;
revoke all on function public.create_lesson_with_emails(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.create_lesson_with_emails(jsonb,text,text) to service_role;
notify pgrst,'reload schema';
commit;
