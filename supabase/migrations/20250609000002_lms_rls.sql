-- =============================================================================
-- Pixel Pluz LMS — Row Level Security (Phase 1)
-- Run ONCE after 20250609000001_lms_foundation.sql on a fresh project.
-- =============================================================================

begin;

alter table public.parent_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.permission_profiles enable row level security;
alter table public.profile_permissions enable row level security;
alter table public.user_permission_profiles enable row level security;
alter table public.user_branch_assignments enable row level security;
alter table public.branches enable row level security;
alter table public.departments enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.batches enable row level security;
alter table public.batch_staff_assignments enable row level security;
alter table public.students enable row level security;
alter table public.student_batch_enrollments enable row level security;

-- Authenticated read for permission catalog
drop policy if exists "parent_roles_read_authenticated" on public.parent_roles;
create policy "parent_roles_read_authenticated"
  on public.parent_roles for select to authenticated using (true);

drop policy if exists "permissions_read_authenticated" on public.permissions;
create policy "permissions_read_authenticated"
  on public.permissions for select to authenticated using (true);

drop policy if exists "permission_profiles_read_authenticated" on public.permission_profiles;
create policy "permission_profiles_read_authenticated"
  on public.permission_profiles for select to authenticated using (true);

drop policy if exists "profile_permissions_read_authenticated" on public.profile_permissions;
create policy "profile_permissions_read_authenticated"
  on public.profile_permissions for select to authenticated using (true);

-- Profiles
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using (
    public.is_super_admin()
    or id = auth.uid()
    or public.user_has_permission('users.view')
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
  on public.profiles for insert to authenticated
  with check (public.is_super_admin() or public.user_has_permission('users.create'));

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
  on public.profiles for delete to authenticated
  using (public.is_super_admin() or public.user_has_permission('users.delete'));

-- User permission profiles
drop policy if exists "user_permission_profiles_select" on public.user_permission_profiles;
create policy "user_permission_profiles_select"
  on public.user_permission_profiles for select to authenticated
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or public.user_has_permission('users.view')
  );

drop policy if exists "user_permission_profiles_manage" on public.user_permission_profiles;
create policy "user_permission_profiles_manage"
  on public.user_permission_profiles for all to authenticated
  using (public.is_super_admin() or public.user_has_permission('users.assign'))
  with check (public.is_super_admin() or public.user_has_permission('users.assign'));

-- Branch assignments
drop policy if exists "user_branch_assignments_select" on public.user_branch_assignments;
create policy "user_branch_assignments_select"
  on public.user_branch_assignments for select to authenticated
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or public.user_has_permission('users.view')
  );

drop policy if exists "user_branch_assignments_manage" on public.user_branch_assignments;
create policy "user_branch_assignments_manage"
  on public.user_branch_assignments for all to authenticated
  using (public.is_super_admin() or public.user_has_permission('users.assign'))
  with check (public.is_super_admin() or public.user_has_permission('users.assign'));

-- Branches
drop policy if exists "branches_select_scoped" on public.branches;
create policy "branches_select_scoped"
  on public.branches for select to authenticated
  using (
    public.is_super_admin()
    or public.user_has_permission('branches.view')
    or id in (select public.user_branch_ids())
  );

drop policy if exists "branches_manage" on public.branches;
create policy "branches_manage"
  on public.branches for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_permission('branches.edit')
    or public.user_has_permission('branches.create')
  )
  with check (
    public.is_super_admin()
    or public.user_has_permission('branches.edit')
    or public.user_has_permission('branches.create')
  );

-- Departments (uses departments.* permissions)
drop policy if exists "departments_select" on public.departments;
create policy "departments_select"
  on public.departments for select to authenticated
  using (public.is_super_admin() or public.user_has_permission('departments.view'));

drop policy if exists "departments_manage" on public.departments;
create policy "departments_manage"
  on public.departments for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_permission('departments.edit')
    or public.user_has_permission('departments.create')
  )
  with check (
    public.is_super_admin()
    or public.user_has_permission('departments.edit')
    or public.user_has_permission('departments.create')
    or public.user_has_permission('departments.delete')
  );

-- Courses
drop policy if exists "courses_select" on public.courses;
create policy "courses_select"
  on public.courses for select to authenticated
  using (public.is_super_admin() or public.user_has_permission('courses.view'));

drop policy if exists "courses_manage" on public.courses;
create policy "courses_manage"
  on public.courses for all to authenticated
  using (public.is_super_admin() or public.user_has_permission('courses.edit'))
  with check (public.is_super_admin() or public.user_has_permission('courses.create') or public.user_has_permission('courses.edit'));

-- Course modules
drop policy if exists "course_modules_select" on public.course_modules;
create policy "course_modules_select"
  on public.course_modules for select to authenticated
  using (public.is_super_admin() or public.user_has_permission('courses.view'));

drop policy if exists "course_modules_manage" on public.course_modules;
create policy "course_modules_manage"
  on public.course_modules for all to authenticated
  using (public.is_super_admin() or public.user_has_permission('courses.edit'))
  with check (public.is_super_admin() or public.user_has_permission('courses.edit'));

-- Batches
drop policy if exists "batches_select_scoped" on public.batches;
create policy "batches_select_scoped"
  on public.batches for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('batches.view')
      and branch_id in (select public.user_branch_ids())
    )
    or exists (
      select 1 from public.batch_staff_assignments bsa
      where bsa.batch_id = batches.id and bsa.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.student_batch_enrollments sbe
      join public.students s on s.id = sbe.student_id
      where sbe.batch_id = batches.id
        and s.profile_id is not null
        and s.profile_id = auth.uid()
    )
  );

drop policy if exists "batches_manage" on public.batches;
create policy "batches_manage"
  on public.batches for all to authenticated
  using (public.is_super_admin() or public.user_has_permission('batches.edit'))
  with check (public.is_super_admin() or public.user_has_permission('batches.create') or public.user_has_permission('batches.edit'));

-- Batch staff (includes final_qa staff_type)
drop policy if exists "batch_staff_select" on public.batch_staff_assignments;
create policy "batch_staff_select"
  on public.batch_staff_assignments for select to authenticated
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or public.user_has_permission('mentors.view')
    or public.user_has_permission('batches.view')
  );

drop policy if exists "batch_staff_manage" on public.batch_staff_assignments;
create policy "batch_staff_manage"
  on public.batch_staff_assignments for all to authenticated
  using (public.is_super_admin() or public.user_has_permission('batches.assign'))
  with check (public.is_super_admin() or public.user_has_permission('batches.assign'));

-- Students (profile_id nullable for pre-enrollment; active requires profile)
drop policy if exists "students_select_scoped" on public.students;
create policy "students_select_scoped"
  on public.students for select to authenticated
  using (
    public.is_super_admin()
    or (profile_id is not null and profile_id = auth.uid())
    or (
      public.user_has_permission('students.view')
      and exists (
        select 1
        from public.student_batch_enrollments sbe
        join public.batches b on b.id = sbe.batch_id
        where sbe.student_id = students.id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
    or exists (
      select 1
      from public.student_batch_enrollments sbe
      join public.batch_staff_assignments bsa on bsa.batch_id = sbe.batch_id
      where sbe.student_id = students.id and bsa.user_id = auth.uid()
    )
  );

drop policy if exists "students_manage" on public.students;
create policy "students_manage"
  on public.students for all to authenticated
  using (public.is_super_admin() or public.user_has_permission('students.edit'))
  with check (public.is_super_admin() or public.user_has_permission('students.create') or public.user_has_permission('students.edit'));

-- Enrollments
drop policy if exists "enrollments_select_scoped" on public.student_batch_enrollments;
create policy "enrollments_select_scoped"
  on public.student_batch_enrollments for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.students s
      where s.id = student_batch_enrollments.student_id
        and s.profile_id is not null
        and s.profile_id = auth.uid()
    )
    or public.user_has_permission('students.view')
  );

drop policy if exists "enrollments_manage" on public.student_batch_enrollments;
create policy "enrollments_manage"
  on public.student_batch_enrollments for all to authenticated
  using (public.is_super_admin() or public.user_has_permission('students.assign'))
  with check (public.is_super_admin() or public.user_has_permission('students.assign'));

-- Grants
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.profiles to authenticated;
grant insert, update, delete on public.branches to authenticated;
grant insert, update, delete on public.departments to authenticated;
grant insert, update, delete on public.courses to authenticated;
grant insert, update, delete on public.course_modules to authenticated;
grant insert, update, delete on public.batches to authenticated;
grant insert, update, delete on public.batch_staff_assignments to authenticated;
grant insert, update, delete on public.students to authenticated;
grant insert, update, delete on public.student_batch_enrollments to authenticated;
grant insert, update, delete on public.user_permission_profiles to authenticated;
grant insert, update, delete on public.user_branch_assignments to authenticated;
grant insert, update, delete on public.permission_profiles to authenticated;
grant insert, update, delete on public.profile_permissions to authenticated;

grant execute on function public.is_super_admin(uuid) to authenticated;
grant execute on function public.user_has_permission(text, uuid) to authenticated;
grant execute on function public.user_branch_ids(uuid) to authenticated;
grant execute on function public.generate_student_code(uuid) to authenticated;

commit;
