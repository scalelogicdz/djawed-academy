-- Apply ONLY after the matching application is deployed and public community
-- profiles are loaded through community_member_profiles().
begin;
drop policy if exists "authenticated users can read profiles" on public.profiles;
drop policy if exists "profile owner or verified admin" on public.profiles;
create policy "profile owner or verified admin" on public.profiles for select to authenticated
 using(id=auth.uid() or public.is_admin());
notify pgrst,'reload schema';
commit;
