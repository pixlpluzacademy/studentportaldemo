-- Allow user managers to update profiles (edit, status, branch) via users.edit permission.
-- Run after 20250609000002_lms_rls.sql

begin;

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_manage"
  on public.profiles for update to authenticated
  using (
    id = auth.uid()
    or public.is_super_admin()
    or public.user_has_permission('users.edit')
  )
  with check (
    id = auth.uid()
    or public.is_super_admin()
    or public.user_has_permission('users.edit')
  );

commit;
