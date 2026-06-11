-- Allow role managers to create/update permission profiles and their permissions.

begin;

drop policy if exists "permission_profiles_manage" on public.permission_profiles;
create policy "permission_profiles_manage"
  on public.permission_profiles for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_permission('roles.edit')
    or public.user_has_permission('roles.create')
    or public.user_has_permission('roles.delete')
  )
  with check (
    public.is_super_admin()
    or public.user_has_permission('roles.edit')
    or public.user_has_permission('roles.create')
  );

drop policy if exists "profile_permissions_manage" on public.profile_permissions;
create policy "profile_permissions_manage"
  on public.profile_permissions for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_permission('roles.edit')
    or public.user_has_permission('roles.create')
    or public.user_has_permission('roles.delete')
  )
  with check (
    public.is_super_admin()
    or public.user_has_permission('roles.edit')
    or public.user_has_permission('roles.create')
  );

commit;
