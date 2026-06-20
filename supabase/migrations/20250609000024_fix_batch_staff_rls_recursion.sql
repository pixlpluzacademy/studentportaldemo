-- Break RLS recursion: batch_staff_assignments policy must not self-query the same table.
-- Run after 20250609000023_batch_scope_profile_blueprint_read.sql

create or replace function public.user_assigned_to_batch(
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
    from public.batch_staff_assignments bsa
    where bsa.batch_id = p_batch_id
      and bsa.user_id = p_user_id
  );
$$;

grant execute on function public.user_assigned_to_batch(uuid, uuid) to authenticated;
grant execute on function public.user_assigned_to_batch(uuid, uuid) to service_role;

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
