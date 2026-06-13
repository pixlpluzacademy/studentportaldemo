-- Branch-scoped mentor directory with department, superior mentor hierarchy, and student ratings.
-- Run after 20250609000007_departments_branch_scope.sql

begin;

create table public.mentor_details (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete restrict,
  department_id uuid not null references public.departments (id) on delete restrict,
  reports_to uuid references public.profiles (id) on delete set null,
  phone text,
  joining_date date,
  average_rating numeric(3, 2),
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentor_details_reports_to_not_self check (reports_to is null or reports_to <> profile_id)
);

create index mentor_details_branch_id_idx on public.mentor_details (branch_id);
create index mentor_details_department_id_idx on public.mentor_details (department_id);
create index mentor_details_reports_to_idx on public.mentor_details (reports_to);

alter table public.mentor_details enable row level security;

drop policy if exists "mentor_details_select" on public.mentor_details;
create policy "mentor_details_select"
  on public.mentor_details for select to authenticated
  using (
    public.is_super_admin()
    or public.has_all_branch_scope()
    or (
      public.user_has_permission('mentors.view')
      and branch_id in (select public.user_branch_ids())
    )
    or profile_id = auth.uid()
  );

drop policy if exists "mentor_details_manage" on public.mentor_details;
create policy "mentor_details_manage"
  on public.mentor_details for all to authenticated
  using (
    public.is_super_admin()
    or public.has_all_branch_scope()
    or (
      (
        public.user_has_permission('mentors.create')
        or public.user_has_permission('mentors.edit')
        or public.user_has_permission('mentors.delete')
      )
      and branch_id in (select public.user_branch_ids())
    )
  )
  with check (
    public.is_super_admin()
    or public.has_all_branch_scope()
    or (
      (
        public.user_has_permission('mentors.create')
        or public.user_has_permission('mentors.edit')
        or public.user_has_permission('mentors.delete')
      )
      and branch_id in (select public.user_branch_ids())
    )
  );

-- Mentors page needs to read mentor profile rows.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using (
    public.is_super_admin()
    or id = auth.uid()
    or public.user_has_permission('users.view')
    or (
      public.user_has_permission('mentors.view')
      and parent_role_id = 'mentor'
    )
  );

drop policy if exists "profiles_update_manage" on public.profiles;
create policy "profiles_update_manage"
  on public.profiles for update to authenticated
  using (
    id = auth.uid()
    or public.is_super_admin()
    or public.user_has_permission('users.edit')
    or public.user_has_permission('mentors.edit')
  )
  with check (
    id = auth.uid()
    or public.is_super_admin()
    or public.user_has_permission('users.edit')
    or public.user_has_permission('mentors.edit')
  );

drop trigger if exists mentor_details_updated_at on public.mentor_details;
create trigger mentor_details_updated_at before update on public.mentor_details
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.mentor_details to authenticated;

commit;
