-- ============================================================
-- Djawed Khalfaoui Academy — Database Schema
-- Run this once in your Supabase project's SQL Editor.
-- ============================================================

-- Extend Supabase's built-in auth.users with a profile table.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  display_name text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Courses (you likely only have one for now, but this scales)
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

-- Which students can access which courses
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, course_id)
);

-- Modules (sections) inside a course
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  position int not null default 0
);

-- Lessons inside a module
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  description text,
  video_id text,          -- Bunny Stream / Vimeo video ID
  video_provider text default 'bunny',
  resource_url text,      -- link to a downloadable PDF/file in Supabase Storage
  position int not null default 0
);

-- Tracks which lessons a student has completed
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

-- Community: public questions
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- Community: public replies (anyone can reply, admin replies are flagged via profiles.is_admin)
create table public.replies (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security — enforced on the server, not just the UI
-- ============================================================

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.questions enable row level security;
alter table public.replies enable row level security;

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- profiles: a user can read their own profile; admins can read/write all
create policy "read own profile" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "admin manages profiles" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- courses: any authenticated user can view; only admin can modify
create policy "read courses" on public.courses
  for select using (auth.role() = 'authenticated');
create policy "admin manages courses" on public.courses
  for all using (public.is_admin()) with check (public.is_admin());

-- enrollments: student sees their own; admin sees/manages all
create policy "read own enrollments" on public.enrollments
  for select using (student_id = auth.uid() or public.is_admin());
create policy "admin manages enrollments" on public.enrollments
  for all using (public.is_admin()) with check (public.is_admin());

-- modules & lessons: visible only if the student is enrolled in the parent course
create policy "read modules if enrolled" on public.modules
  for select using (
    public.is_admin() or exists (
      select 1 from public.enrollments e
      where e.course_id = modules.course_id and e.student_id = auth.uid()
    )
  );
create policy "admin manages modules" on public.modules
  for all using (public.is_admin()) with check (public.is_admin());

create policy "read lessons if enrolled" on public.lessons
  for select using (
    public.is_admin() or exists (
      select 1 from public.modules m
      join public.enrollments e on e.course_id = m.course_id
      where m.id = lessons.module_id and e.student_id = auth.uid()
    )
  );
create policy "admin manages lessons" on public.lessons
  for all using (public.is_admin()) with check (public.is_admin());

-- lesson_progress: student manages only their own progress
create policy "read own progress" on public.lesson_progress
  for select using (student_id = auth.uid() or public.is_admin());
create policy "insert own progress" on public.lesson_progress
  for insert with check (student_id = auth.uid());
create policy "delete own progress" on public.lesson_progress
  for delete using (student_id = auth.uid());

-- questions: any authenticated user can read all, and post their own
create policy "read all questions" on public.questions
  for select using (auth.role() = 'authenticated');
create policy "post own question" on public.questions
  for insert with check (student_id = auth.uid());
create policy "delete own question or admin" on public.questions
  for delete using (student_id = auth.uid() or public.is_admin());

-- replies: any authenticated user can read all, and post their own
create policy "read all replies" on public.replies
  for select using (auth.role() = 'authenticated');
create policy "post own reply" on public.replies
  for insert with check (student_id = auth.uid());
create policy "delete own reply or admin" on public.replies
  for delete using (student_id = auth.uid() or public.is_admin());

-- ============================================================
-- Seed: your first course. Edit the title as needed, then add
-- modules/lessons from the admin panel once the app is running.
-- ============================================================
insert into public.courses (title, description)
values ('دورة السبونسور', 'دورة إعلانات ميتا من الصفر للمبتدئين وأصحاب الأعمال');
