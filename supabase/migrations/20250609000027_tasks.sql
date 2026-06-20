-- Batch tasks and student submissions (my-courses + tasks module foundation)

do $$
begin
  create type public.task_frequency as enum ('daily', 'weekly', 'one_time');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.task_status as enum ('open', 'review', 'closed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.task_submission_status as enum (
    'draft',
    'submitted',
    'in_review',
    'approved',
    'revision',
    'rejected'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,
  title text not null,
  description text,
  frequency public.task_frequency not null default 'one_time',
  due_date date not null,
  file_requirement text,
  attachment_path text,
  attachment_name text,
  status public.task_status not null default 'open',
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_batch_id_idx on public.tasks (batch_id);
create index if not exists tasks_student_id_idx on public.tasks (student_id);
create index if not exists tasks_due_date_idx on public.tasks (due_date desc);

create table if not exists public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status public.task_submission_status not null default 'draft',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, student_id)
);

create index if not exists task_submissions_task_id_idx on public.task_submissions (task_id);
create index if not exists task_submissions_student_id_idx on public.task_submissions (student_id);

create or replace function public.student_id_for_profile(
  p_profile_id uuid default auth.uid()
)
returns uuid
language sql
stable
security definer
set search_path = public
as $
  select s.id
  from public.students s
  where s.profile_id = p_profile_id
  limit 1;
$;

grant execute on function public.student_id_for_profile(uuid) to authenticated;
grant execute on function public.student_id_for_profile(uuid) to service_role;

alter table public.tasks enable row level security;
alter table public.task_submissions enable row level security;

drop policy if exists "tasks_select_scoped" on public.tasks;
create policy "tasks_select_scoped"
  on public.tasks for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_enrolled_in_batch(batch_id)
      and (
        student_id is null
        or student_id = public.student_id_for_profile(auth.uid())
      )
    )
    or exists (
      select 1
      from public.batch_staff_assignments bsa
      where bsa.batch_id = tasks.batch_id
        and bsa.user_id = auth.uid()
    )
    or (
      public.user_has_permission('tasks.view')
      and exists (
        select 1
        from public.batches b
        where b.id = tasks.batch_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "tasks_insert_scoped" on public.tasks;
create policy "tasks_insert_scoped"
  on public.tasks for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      (public.user_has_permission('tasks.create') or public.user_has_permission('tasks.assign'))
      and exists (
        select 1
        from public.batch_staff_assignments bsa
        where bsa.batch_id = tasks.batch_id
          and bsa.user_id = auth.uid()
      )
    )
    or (
      (public.user_has_permission('tasks.create') or public.user_has_permission('tasks.assign'))
      and exists (
        select 1
        from public.batches b
        where b.id = tasks.batch_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "tasks_update_scoped" on public.tasks;
create policy "tasks_update_scoped"
  on public.tasks for update to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('tasks.edit')
      and exists (
        select 1
        from public.batch_staff_assignments bsa
        where bsa.batch_id = tasks.batch_id
          and bsa.user_id = auth.uid()
      )
    )
    or (
      public.user_has_permission('tasks.edit')
      and exists (
        select 1
        from public.batches b
        where b.id = tasks.batch_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      public.user_has_permission('tasks.edit')
      and exists (
        select 1
        from public.batch_staff_assignments bsa
        where bsa.batch_id = tasks.batch_id
          and bsa.user_id = auth.uid()
      )
    )
    or (
      public.user_has_permission('tasks.edit')
      and exists (
        select 1
        from public.batches b
        where b.id = tasks.batch_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "tasks_delete_scoped" on public.tasks;
create policy "tasks_delete_scoped"
  on public.tasks for delete to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('tasks.delete')
      and exists (
        select 1
        from public.batch_staff_assignments bsa
        where bsa.batch_id = tasks.batch_id
          and bsa.user_id = auth.uid()
      )
    )
    or (
      public.user_has_permission('tasks.delete')
      and exists (
        select 1
        from public.batches b
        where b.id = tasks.batch_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  );

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
        from public.tasks t
        join public.batches b on b.id = t.batch_id
        where t.id = task_submissions.task_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  );

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
          and t.due_date >= current_date
          and public.user_enrolled_in_batch(t.batch_id)
          and (t.student_id is null or t.student_id = task_submissions.student_id)
      )
    )
  );

drop policy if exists "task_submissions_update_scoped" on public.task_submissions;
create policy "task_submissions_update_scoped"
  on public.task_submissions for update to authenticated
  using (
    public.is_super_admin()
    or (
      student_id = public.student_id_for_profile(auth.uid())
      and public.user_has_permission('submissions.submit')
    )
    or (
      public.user_has_permission('submissions.review')
      and exists (
        select 1
        from public.tasks t
        join public.batch_staff_assignments bsa on bsa.batch_id = t.batch_id
        where t.id = task_submissions.task_id
          and bsa.user_id = auth.uid()
      )
    )
    or (
      (public.user_has_permission('submissions.edit') or public.user_has_permission('submissions.approve'))
      and exists (
        select 1
        from public.tasks t
        join public.batches b on b.id = t.batch_id
        where t.id = task_submissions.task_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      student_id = public.student_id_for_profile(auth.uid())
      and public.user_has_permission('submissions.submit')
    )
    or (
      public.user_has_permission('submissions.review')
      and exists (
        select 1
        from public.tasks t
        join public.batch_staff_assignments bsa on bsa.batch_id = t.batch_id
        where t.id = task_submissions.task_id
          and bsa.user_id = auth.uid()
      )
    )
    or (
      (public.user_has_permission('submissions.edit') or public.user_has_permission('submissions.approve'))
      and exists (
        select 1
        from public.tasks t
        join public.batches b on b.id = t.batch_id
        where t.id = task_submissions.task_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "task_submissions_delete_scoped" on public.task_submissions;
create policy "task_submissions_delete_scoped"
  on public.task_submissions for delete to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('submissions.delete')
      and exists (
        select 1
        from public.tasks t
        join public.batches b on b.id = t.batch_id
        where t.id = task_submissions.task_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  );

grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.task_submissions to authenticated;

insert into storage.buckets (id, name, public)
values ('task-submissions', 'task-submissions', false)
on conflict (id) do nothing;

drop policy if exists "task_submissions_storage_select" on storage.objects;
create policy "task_submissions_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'task-submissions'
    and (
      public.is_super_admin()
      or public.user_has_permission('submissions.view')
      or public.user_has_permission('submissions.submit')
    )
  );

drop policy if exists "task_submissions_storage_insert" on storage.objects;
create policy "task_submissions_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'task-submissions'
    and (
      public.is_super_admin()
      or public.user_has_permission('submissions.submit')
    )
  );

drop policy if exists "task_submissions_storage_delete" on storage.objects;
create policy "task_submissions_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'task-submissions'
    and (
      public.is_super_admin()
      or public.user_has_permission('submissions.delete')
    )
  );
