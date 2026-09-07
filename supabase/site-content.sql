-- Editable text content for the Services and Guidelines pages.
-- Run this once in Supabase SQL Editor.

create table if not exists public.site_content (
  key text primary key,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

drop policy if exists "read site content" on public.site_content;
create policy "read site content" on public.site_content
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "admin manages site content" on public.site_content;
create policy "admin manages site content" on public.site_content
  for all
  using (public.is_admin())
  with check (public.is_admin());
