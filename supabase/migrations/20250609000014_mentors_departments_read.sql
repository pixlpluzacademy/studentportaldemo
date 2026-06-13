-- Allow mentor module users to read branch departments (for mentor create/filter UI).
-- Run after 20250609000007_departments_branch_scope.sql

begin;

drop policy if exists "departments_select" on public.departments;
create policy "departments_select"
  on public.departments for select to authenticated
  using (
    public.is_super_admin()
    or public.has_all_branch_scope()
    or (
      (
        public.user_has_permission('departments.view')
        or public.user_has_permission('mentors.view')
        or public.user_has_permission('mentors.create')
        or public.user_has_permission('mentors.edit')
      )
      and branch_id in (select public.user_branch_ids())
    )
  );

commit;
