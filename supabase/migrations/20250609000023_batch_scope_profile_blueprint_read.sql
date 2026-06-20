-- Batch-scoped profile/staff visibility + my-courses blueprint read access.

create or replace function public.user_assigned_to_course(
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
    from public.batch_staff_assignments bsa
    join public.batches b on b.id = bsa.batch_id
    where b.course_id = p_course_id
      and bsa.user_id = p_user_id
  );
$$;

create or replace function public.user_can_read_my_course(
  p_course_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.user_has_permission('my-courses.view', p_user_id)
    and (
      public.user_enrolled_in_course(p_course_id, p_user_id)
      or public.user_assigned_to_course(p_course_id, p_user_id)
    );
$$;

create or replace function public.user_can_read_my_course_level(
  p_level_id uuid,
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
    from public.course_levels cl
    where cl.id = p_level_id
      and public.user_can_read_my_course(cl.course_id, p_user_id)
  );
$$;

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
    );
$$;

grant execute on function public.user_assigned_to_course(uuid, uuid) to authenticated;
grant execute on function public.user_can_read_my_course(uuid, uuid) to authenticated;
grant execute on function public.user_can_read_my_course_level(uuid, uuid) to authenticated;
grant execute on function public.profile_visible_to_viewer(uuid, uuid) to authenticated;

grant execute on function public.user_assigned_to_course(uuid, uuid) to service_role;
grant execute on function public.user_can_read_my_course(uuid, uuid) to service_role;
grant execute on function public.user_can_read_my_course_level(uuid, uuid) to service_role;
grant execute on function public.profile_visible_to_viewer(uuid, uuid) to service_role;

create or replace function public.user_assigned_to_batch(
  p_batch_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $
  select exists (
    select 1
    from public.batch_staff_assignments bsa
    where bsa.batch_id = p_batch_id
      and bsa.user_id = p_user_id
  );
$;

grant execute on function public.user_assigned_to_batch(uuid, uuid) to authenticated;
grant execute on function public.user_assigned_to_batch(uuid, uuid) to service_role;

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
    or public.profile_visible_to_viewer(profiles.id)
  );

drop policy if exists "batch_staff_select" on public.batch_staff_assignments;
create policy "batch_staff_select"
  on public.batch_staff_assignments for select to authenticated
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or public.user_has_permission('mentors.view')
    or public.user_has_permission('batches.view')
    or public.user_enrolled_in_batch(batch_id)
    or public.user_assigned_to_batch(batch_id)
  );

drop policy if exists "course_levels_select" on public.course_levels;
create policy "course_levels_select"
  on public.course_levels for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('courses.view')
      and public.course_in_user_branch_scope(course_levels.course_id)
    )
    or public.user_can_read_my_course(course_levels.course_id)
  );

drop policy if exists "course_work_packages_select" on public.course_work_packages;
create policy "course_work_packages_select"
  on public.course_work_packages for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('courses.view')
      and exists (
        select 1
        from public.course_levels cl
        where cl.id = course_work_packages.level_id
          and public.course_in_user_branch_scope(cl.course_id)
      )
    )
    or public.user_can_read_my_course_level(course_work_packages.level_id)
  );

drop policy if exists "course_assignments_select" on public.course_assignments;
create policy "course_assignments_select"
  on public.course_assignments for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('courses.view')
      and public.course_in_user_branch_scope(course_assignments.course_id)
    )
    or public.user_can_read_my_course(course_assignments.course_id)
  );

drop policy if exists "course_rubric_items_select" on public.course_rubric_items;
create policy "course_rubric_items_select"
  on public.course_rubric_items for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('courses.view')
      and public.course_in_user_branch_scope(course_rubric_items.course_id)
    )
    or public.user_can_read_my_course(course_rubric_items.course_id)
  );

drop policy if exists "course_portfolio_outputs_select" on public.course_portfolio_outputs;
create policy "course_portfolio_outputs_select"
  on public.course_portfolio_outputs for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('courses.view')
      and public.course_in_user_branch_scope(course_portfolio_outputs.course_id)
    )
    or public.user_can_read_my_course(course_portfolio_outputs.course_id)
  );
