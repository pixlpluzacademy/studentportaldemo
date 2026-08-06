-- Admission lead workflow: status + coordinator notes, and edit permission for portal updates.

alter table public.admission_enquiry
  add column if not exists status text not null default 'new_request',
  add column if not exists note text not null default '',
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admission_enquiry_status_check'
  ) then
    alter table public.admission_enquiry
      add constraint admission_enquiry_status_check check (
        status = any (
          array[
            'new_request'::text,
            'follow_up'::text,
            'interested'::text,
            'candidate'::text,
            'not_interested'::text
          ]
        )
      );
  end if;
end $$;

create index if not exists admission_enquiry_status_idx
  on public.admission_enquiry using btree (status);

update public.admission_enquiry
set status = 'new_request'
where status is null or status = '';

insert into public.permissions (module_id, action, permission_key) values
  ('admissions', 'edit', 'admissions.edit')
on conflict (permission_key) do nothing;

insert into public.profile_permissions (profile_id, permission_id)
select pp.id, p.id
from public.permission_profiles pp
cross join public.permissions p
where pp.slug = 'super_admin_full'
  and p.permission_key = 'admissions.edit'
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

select public.link_profile_permissions('company_admin_default', array['admissions.edit']);
select public.link_profile_permissions('branch_admin_default', array['admissions.edit']);
select public.link_profile_permissions('placement_default', array['admissions.edit']);

drop function public.link_profile_permissions(text, text[]);

drop policy if exists "admissions_update_admission_enquiry" on public.admission_enquiry;
create policy "admissions_update_admission_enquiry"
  on public.admission_enquiry
  for update
  to authenticated
  using (
    public.is_super_admin()
    or public.user_has_permission('admissions.edit')
  )
  with check (
    public.is_super_admin()
    or public.user_has_permission('admissions.edit')
  );

grant update on public.admission_enquiry to authenticated;
