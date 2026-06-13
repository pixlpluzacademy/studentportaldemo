-- Courses are branch-scoped via departments.branch_id.
-- Run in Supabase SQL Editor after 20250609000007_departments_branch_scope.sql.

begin;

drop policy if exists "courses_select" on public.courses;
create policy "courses_select"
  on public.courses for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('courses.view')
      and exists (
        select 1
        from public.departments d
        where d.id = courses.department_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "courses_manage" on public.courses;
create policy "courses_manage"
  on public.courses for all to authenticated
  using (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('courses.edit')
        or public.user_has_permission('courses.create')
        or public.user_has_permission('courses.delete')
      )
      and exists (
        select 1
        from public.departments d
        where d.id = courses.department_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('courses.edit')
        or public.user_has_permission('courses.create')
        or public.user_has_permission('courses.delete')
      )
      and exists (
        select 1
        from public.departments d
        where d.id = courses.department_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "course_modules_select" on public.course_modules;
create policy "course_modules_select"
  on public.course_modules for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('courses.view')
      and exists (
        select 1
        from public.courses c
        join public.departments d on d.id = c.department_id
        where c.id = course_modules.course_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "course_modules_manage" on public.course_modules;
create policy "course_modules_manage"
  on public.course_modules for all to authenticated
  using (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('courses.edit')
        or public.user_has_permission('courses.create')
      )
      and exists (
        select 1
        from public.courses c
        join public.departments d on d.id = c.department_id
        where c.id = course_modules.course_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('courses.edit')
        or public.user_has_permission('courses.create')
      )
      and exists (
        select 1
        from public.courses c
        join public.departments d on d.id = c.department_id
        where c.id = course_modules.course_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  );

grant insert, update, delete on public.course_modules to authenticated;

commit;
