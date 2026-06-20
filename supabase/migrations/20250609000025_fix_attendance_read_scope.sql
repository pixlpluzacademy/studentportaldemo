-- Attendance read fixes:
-- 1) Trainers assigned to a batch could not read courses (courses_select only allowed enrolled students),
--    so attendance queries with courses!inner returned no rows for staff.
-- 2) Students/staff could not read profiles of users who marked attendance (e.g. super admin).

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
    or public.user_can_read_my_course(courses.id)
  );

create or replace function public.profile_visible_to_viewer(
  p_profile_id uuid,
  p_viewer_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_profile_id = p_viewer_id
    or exists (
      select 1
      from public.students s
      where s.profile_id = p_profile_id
        and public.student_visible_to_batch_staff(s.id, p_viewer_id)
    )
    or exists (
      select 1
      from public.batch_staff_assignments bsa_viewer
      join public.batch_staff_assignments bsa_target
        on bsa_target.batch_id = bsa_viewer.batch_id
      where bsa_viewer.user_id = p_viewer_id
        and bsa_target.user_id = p_profile_id
    )
    or exists (
      select 1
      from public.batch_staff_assignments bsa
      join public.student_batch_enrollments sbe on sbe.batch_id = bsa.batch_id
      join public.students s on s.id = sbe.student_id
      where bsa.user_id = p_profile_id
        and s.profile_id = p_viewer_id
    )
    or exists (
      select 1
      from public.student_attendance_records sar
      where sar.marked_by = p_profile_id
        and (
          public.user_enrolled_in_batch(sar.batch_id, p_viewer_id)
          or public.user_assigned_to_batch(sar.batch_id, p_viewer_id)
          or (
            public.user_has_permission('attendance.view', p_viewer_id)
            and exists (
              select 1
              from public.batches b
              where b.id = sar.batch_id
                and b.branch_id in (select public.user_branch_ids(p_viewer_id))
            )
          )
        )
    );
$$;

grant execute on function public.profile_visible_to_viewer(uuid, uuid) to authenticated;
grant execute on function public.profile_visible_to_viewer(uuid, uuid) to service_role;
