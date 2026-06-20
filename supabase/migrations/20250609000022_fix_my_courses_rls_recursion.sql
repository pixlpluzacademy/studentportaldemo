-- Break RLS recursion: departments <-> courses for my-courses student reads.
-- Run after 20250609000021_student_my_courses_read.sql

create or replace function public.user_enrolled_in_course(
  p_course_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_batch_enrollments sbe
    join public.students s on s.id = sbe.student_id
    join public.batches b on b.id = sbe.batch_id
    where b.course_id = p_course_id
      and s.profile_id is not null
      and s.profile_id = p_user_id
  );
$$;

create or replace function public.user_enrolled_in_department(
  p_department_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_batch_enrollments sbe
    join public.students s on s.id = sbe.student_id
    join public.batches b on b.id = sbe.batch_id
    join public.courses c on c.id = b.course_id
    where c.department_id = p_department_id
      and s.profile_id is not null
      and s.profile_id = p_user_id
  );
$$;

create or replace function public.user_enrolled_in_branch(
  p_branch_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_batch_enrollments sbe
    join public.students s on s.id = sbe.student_id
    join public.batches b on b.id = sbe.batch_id
    where b.branch_id = p_branch_id
      and s.profile_id is not null
      and s.profile_id = p_user_id
  );
$$;

create or replace function public.course_in_user_branch_scope(
  p_course_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses c
    join public.departments d on d.id = c.department_id
    where c.id = p_course_id
      and d.branch_id in (select public.user_branch_ids(p_user_id))
  );
$$;

grant execute on function public.user_enrolled_in_course(uuid, uuid) to authenticated;
grant execute on function public.user_enrolled_in_department(uuid, uuid) to authenticated;
grant execute on function public.user_enrolled_in_branch(uuid, uuid) to authenticated;
grant execute on function public.course_in_user_branch_scope(uuid, uuid) to authenticated;

grant execute on function public.user_enrolled_in_course(uuid, uuid) to service_role;
grant execute on function public.user_enrolled_in_department(uuid, uuid) to service_role;
grant execute on function public.user_enrolled_in_branch(uuid, uuid) to service_role;
grant execute on function public.course_in_user_branch_scope(uuid, uuid) to service_role;

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
    or (
      public.user_has_permission('my-courses.view')
      and public.user_enrolled_in_department(departments.id)
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
      and public.course_in_user_branch_scope(courses.id)
    )
    or (
      public.user_has_permission('my-courses.view')
      and public.user_enrolled_in_course(courses.id)
    )
  );

drop policy if exists "branches_select_scoped" on public.branches;
create policy "branches_select_scoped"
  on public.branches for select to authenticated
  using (
    public.is_super_admin()
    or public.user_has_permission('branches.view')
    or id in (select public.user_branch_ids())
    or public.user_enrolled_in_branch(branches.id)
  );
