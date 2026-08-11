-- Students must only see their own task submissions.
-- Previously any user with `submissions.view` in the same branch could read the
-- whole branch queue (students have that permission for their own page), which
-- leaked classmates' submissions. Restrict the branch-wide clause to admin
-- parent roles. Student self-access and batch staff access are unchanged.

drop policy if exists "task_submissions_select_scoped" on public.task_submissions;
create policy "task_submissions_select_scoped"
  on public.task_submissions for select to authenticated
  using (
    public.is_super_admin()
    or student_id = public.student_id_for_profile(auth.uid())
    or exists (
      select 1
      from public.tasks t
      join public.batch_staff_assignments bsa on bsa.batch_id = t.batch_id
      where t.id = task_submissions.task_id
        and bsa.user_id = auth.uid()
    )
    or (
      public.user_has_permission('submissions.view')
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.parent_role_id in ('super_admin', 'company_admin', 'branch_admin')
      )
      and exists (
        select 1
        from public.tasks t
        join public.batches b on b.id = t.batch_id
        where t.id = task_submissions.task_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  );
