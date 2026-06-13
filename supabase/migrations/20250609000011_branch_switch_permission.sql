-- Header branch switcher: branches.switch grants all-branch scope (like Super Admin / Company Admin).
-- Assign via Role Management on any permission profile.

insert into public.permissions (module_id, action, permission_key) values
  ('branches', 'switch', 'branches.switch')
on conflict (permission_key) do nothing;

insert into public.profile_permissions (profile_id, permission_id)
select pp.id, p.id
from public.permission_profiles pp
join public.permissions p on p.permission_key = 'branches.switch'
where pp.slug = 'company_admin_default'
on conflict do nothing;

insert into public.profile_permissions (profile_id, permission_id)
select pp.id, p.id
from public.permission_profiles pp
cross join public.permissions p
where pp.slug = 'super_admin_full'
  and p.permission_key = 'branches.switch'
on conflict do nothing;

create or replace function public.has_all_branch_scope(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin(p_user_id)
    or exists (
      select 1
      from public.profiles p
      where p.id = p_user_id
        and p.parent_role_id = 'company_admin'
        and p.status = 'active'
    )
    or public.user_has_permission('branches.switch', p_user_id);
$$;

create or replace function public.user_branch_ids(p_user_id uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.id
  from public.branches b
  where public.has_all_branch_scope(p_user_id)
  union
  select uba.branch_id
  from public.user_branch_assignments uba
  where uba.user_id = p_user_id
  union
  select p.branch_id
  from public.profiles p
  where p.id = p_user_id
    and p.branch_id is not null;
$$;

grant execute on function public.has_all_branch_scope(uuid) to authenticated;

comment on function public.has_all_branch_scope(uuid) is
  'True when the user may switch the header branch across all academy branches (super admin, company admin, or branches.switch permission).';
