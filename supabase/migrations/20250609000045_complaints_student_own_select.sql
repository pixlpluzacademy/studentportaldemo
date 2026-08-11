-- Students must only see their own complaints.
-- Branch-wide complaint queue is limited to admin parent roles.

drop policy if exists "complaints_select_scoped" on public.complaints;
create policy "complaints_select_scoped"
  on public.complaints for select to authenticated
  using (
    public.is_super_admin()
    or (
      student_id = public.student_id_for_profile()
      and public.user_has_permission('complaints.view')
    )
    or (
      public.user_has_permission('complaints.view')
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.parent_role_id in ('super_admin', 'company_admin', 'branch_admin')
      )
      and (
        public.has_all_branch_scope()
        or branch_id in (select public.user_branch_ids())
      )
    )
  );
