-- Optional submission deadline time on tasks

alter table public.tasks
  add column if not exists due_time time;

comment on column public.tasks.due_time is 'Optional deadline time on due_date. Null means end-of-day on the date.';

-- Respect optional due_time when students submit
drop policy if exists "task_submissions_insert_scoped" on public.task_submissions;
create policy "task_submissions_insert_scoped"
  on public.task_submissions for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      student_id = public.student_id_for_profile(auth.uid())
      and public.user_has_permission('submissions.submit')
      and exists (
        select 1
        from public.tasks t
        where t.id = task_submissions.task_id
          and (
            t.due_date > current_date
            or (
              t.due_date = current_date
              and (t.due_time is null or t.due_time >= current_time)
            )
          )
          and public.user_enrolled_in_batch(t.batch_id)
          and (t.student_id is null or t.student_id = task_submissions.student_id)
      )
    )
  );

-- Allow task viewers to read brief/reference files in storage
drop policy if exists "task_submissions_storage_select" on storage.objects;
create policy "task_submissions_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'task-submissions'
    and (
      public.is_super_admin()
      or public.user_has_permission('submissions.view')
      or public.user_has_permission('submissions.submit')
      or public.user_has_permission('tasks.view')
    )
  );
