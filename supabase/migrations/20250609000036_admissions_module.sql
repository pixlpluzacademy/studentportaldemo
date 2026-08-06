-- Admissions module for website registration / enquiry visibility in LMS portal.
-- Catalog permissions + default grants for Super Admin, Company Admin, Branch Admin, Placement.

insert into public.permissions (module_id, action, permission_key) values
  ('admissions', 'view', 'admissions.view'),
  ('admissions', 'export', 'admissions.export')
on conflict (permission_key) do nothing;

-- Super Admin: pick up any newly added catalog permissions
insert into public.profile_permissions (profile_id, permission_id)
select pp.id, p.id
from public.permission_profiles pp
cross join public.permissions p
where pp.slug = 'super_admin_full'
  and p.module_id = 'admissions'
on conflict do nothing;

create or replace function public.link_profile_permissions(p_slug text, p_keys text[])
returns void
language plpgsql
as $$
declare
  v_profile_id uuid;
begin
  select id into v_profile_id from public.permission_profiles where slug = p_slug;
  if v_profile_id is null then
    raise exception 'Permission profile not found: %', p_slug;
  end if;

  insert into public.profile_permissions (profile_id, permission_id)
  select v_profile_id, p.id
  from public.permissions p
  where p.permission_key = any (p_keys)
  on conflict do nothing;
end;
$$;

select public.link_profile_permissions('company_admin_default', array[
  'admissions.view',
  'admissions.export'
]);

select public.link_profile_permissions('branch_admin_default', array[
  'admissions.view',
  'admissions.export'
]);

select public.link_profile_permissions('placement_default', array[
  'admissions.view',
  'admissions.export'
]);

drop function public.link_profile_permissions(text, text[]);
