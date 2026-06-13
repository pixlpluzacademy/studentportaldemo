-- Only Super Admin may manage Super Admin / Company Admin system permission profiles.

begin;

create or replace function public.is_elevated_permission_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.permission_profiles pp
    where pp.id = p_profile_id
      and (
        pp.slug in ('super_admin_full', 'company_admin_default')
        or pp.parent_role_id = 'super_admin'
      )
  );
$$;

create or replace function public.is_restricted_profile_parent(p_parent_role_id text)
returns boolean
language sql
immutable
as $$
  select p_parent_role_id in ('super_admin', 'company_admin');
$$;

drop policy if exists "permission_profiles_manage" on public.permission_profiles;
create policy "permission_profiles_manage"
  on public.permission_profiles for all to authenticated
  using (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('roles.edit')
        or public.user_has_permission('roles.create')
        or public.user_has_permission('roles.delete')
      )
      and not public.is_elevated_permission_profile(id)
    )
  )
  with check (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('roles.edit')
        or public.user_has_permission('roles.create')
      )
      and not public.is_elevated_permission_profile(id)
      and not public.is_restricted_profile_parent(parent_role_id)
    )
  );

drop policy if exists "profile_permissions_manage" on public.profile_permissions;
create policy "profile_permissions_manage"
  on public.profile_permissions for all to authenticated
  using (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('roles.edit')
        or public.user_has_permission('roles.create')
        or public.user_has_permission('roles.delete')
      )
      and not public.is_elevated_permission_profile(profile_id)
    )
  )
  with check (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('roles.edit')
        or public.user_has_permission('roles.create')
      )
      and not public.is_elevated_permission_profile(profile_id)
    )
  );

grant execute on function public.is_elevated_permission_profile(uuid) to authenticated;
grant execute on function public.is_restricted_profile_parent(text) to authenticated;

comment on function public.is_elevated_permission_profile(uuid) is
  'True for Super Admin and Company Admin system profiles — editable only by Super Admin.';

commit;
