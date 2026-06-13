-- Allow batch module users to read branch courses + departments (batch list embeds + create UI).
-- Run after 20250609000017_fix_enrollment_rls_recursion.sql

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
        or public.user_has_permission('batches.view')
        or public.user_has_permission('batches.create')
        or public.user_has_permission('batches.edit')
      )
      and branch_id in (select public.user_branch_ids())
    )
  );

drop policy if exists "courses_select" on public.courses;
create policy "courses_select"
  on public.courses for select to authenticated
  using (
    public.is_super_admin()
    or public.has_all_branch_scope()
    or (
      (
        public.user_has_permission('courses.view')
        or public.user_has_permission('batches.view')
        or public.user_has_permission('batches.create')
        or public.user_has_permission('batches.edit')
      )
      and exists (
        select 1
        from public.departments d
        where d.id = courses.department_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  );

commit;
