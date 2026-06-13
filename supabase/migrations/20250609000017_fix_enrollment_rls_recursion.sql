-- Break RLS recursion: batches <-> student_batch_enrollments <-> students
-- Run after 20250609000002_lms_rls.sql

create or replace function public.student_profile_id(p_student_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.profile_id
  from public.students s
  where s.id = p_student_id;
$$;

create or replace function public.user_enrolled_in_batch(
  p_batch_id uuid,
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
    where sbe.batch_id = p_batch_id
      and s.profile_id is not null
      and s.profile_id = p_user_id
  );
$$;

create or replace function public.student_in_user_branch_scope(
  p_student_id uuid,
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
    join public.batches b on b.id = sbe.batch_id
    where sbe.student_id = p_student_id
      and b.branch_id in (select public.user_branch_ids(p_user_id))
  );
$$;

create or replace function public.student_visible_to_batch_staff(
  p_student_id uuid,
  p_staff_user_id uuid default auth.uid()
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
    join public.batch_staff_assignments bsa on bsa.batch_id = sbe.batch_id
    where sbe.student_id = p_student_id
      and bsa.user_id = p_staff_user_id
  );
$$;

grant execute on function public.student_profile_id(uuid) to authenticated;
grant execute on function public.user_enrolled_in_batch(uuid, uuid) to authenticated;
grant execute on function public.student_in_user_branch_scope(uuid, uuid) to authenticated;
grant execute on function public.student_visible_to_batch_staff(uuid, uuid) to authenticated;

grant execute on function public.student_profile_id(uuid) to service_role;
grant execute on function public.user_enrolled_in_batch(uuid, uuid) to service_role;
grant execute on function public.student_in_user_branch_scope(uuid, uuid) to service_role;
grant execute on function public.student_visible_to_batch_staff(uuid, uuid) to service_role;

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
      select 1
      from public.batch_staff_assignments bsa
      where bsa.batch_id = batches.id
        and bsa.user_id = auth.uid()
    )
    or public.user_enrolled_in_batch(batches.id)
  );

drop policy if exists "students_select_scoped" on public.students;
create policy "students_select_scoped"
  on public.students for select to authenticated
  using (
    public.is_super_admin()
    or (profile_id is not null and profile_id = auth.uid())
    or (
      public.user_has_permission('students.view')
      and public.student_in_user_branch_scope(students.id)
    )
    or public.student_visible_to_batch_staff(students.id)
  );

drop policy if exists "enrollments_select_scoped" on public.student_batch_enrollments;
create policy "enrollments_select_scoped"
  on public.student_batch_enrollments for select to authenticated
  using (
    public.is_super_admin()
    or public.student_profile_id(student_batch_enrollments.student_id) = auth.uid()
    or public.user_has_permission('students.view')
  );
