-- Include batch HOD (superior mentor) in student complaint/rating mentor list.

begin;

create or replace function public.student_assigned_mentor_ids(p_student_id uuid)
returns table (
  mentor_id uuid,
  batch_id uuid,
  branch_id uuid,
  mentor_staff_type public.batch_staff_type
)
language sql
stable
security definer
set search_path = public
as $$
  select bsa.user_id, bsa.batch_id, b.branch_id, bsa.staff_type
  from public.student_batch_enrollments sbe
  join public.batches b on b.id = sbe.batch_id
  join public.batch_staff_assignments bsa on bsa.batch_id = sbe.batch_id
  where sbe.student_id = p_student_id
    and bsa.staff_type in ('hod', 'mentor', 'trainer');
$$;

grant execute on function public.student_assigned_mentor_ids(uuid) to authenticated;
grant execute on function public.student_assigned_mentor_ids(uuid) to service_role;

commit;
