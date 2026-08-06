-- Placement jobs and student applications.

create table if not exists public.placement_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text not null,
  course_name text not null default '',
  department_name text not null default '',
  location text not null default '',
  job_type text not null default 'Full-time',
  salary_range text not null default '',
  job_link text not null default '',
  status text not null default 'open' check (status in ('open', 'closed', 'draft')),
  branch_id uuid references public.branches (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists placement_jobs_status_idx on public.placement_jobs (status);
create index if not exists placement_jobs_course_name_idx on public.placement_jobs (course_name);
create index if not exists placement_jobs_branch_id_idx on public.placement_jobs (branch_id);

create table if not exists public.placement_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.placement_jobs (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status text not null default 'applied'
    check (status in ('applied', 'interviewing', 'selected', 'rejected', 'on_hold')),
  resume_status text not null default 'pending'
    check (resume_status in ('pending', 'approved', 'revision_needed')),
  applied_at timestamptz not null default now(),
  interview_at date,
  notes text,
  updated_at timestamptz not null default now(),
  unique (job_id, student_id)
);

create index if not exists placement_applications_student_id_idx
  on public.placement_applications (student_id);
create index if not exists placement_applications_job_id_idx
  on public.placement_applications (job_id);
create index if not exists placement_applications_status_idx
  on public.placement_applications (status);

alter table public.placement_jobs enable row level security;
alter table public.placement_applications enable row level security;

drop policy if exists "placement_jobs_select_authenticated" on public.placement_jobs;
create policy "placement_jobs_select_authenticated"
  on public.placement_jobs for select to authenticated
  using (
    public.is_super_admin()
    or public.user_has_permission('placement.view')
    or public.user_has_permission('students.view')
    or exists (
      select 1
      from public.students s
      where s.profile_id = auth.uid()
    )
  );

drop policy if exists "placement_jobs_write_staff" on public.placement_jobs;
create policy "placement_jobs_write_staff"
  on public.placement_jobs for all to authenticated
  using (
    public.is_super_admin()
    or public.user_has_permission('placement.create')
    or public.user_has_permission('placement.edit')
  )
  with check (
    public.is_super_admin()
    or public.user_has_permission('placement.create')
    or public.user_has_permission('placement.edit')
  );

drop policy if exists "placement_applications_select_scoped" on public.placement_applications;
create policy "placement_applications_select_scoped"
  on public.placement_applications for select to authenticated
  using (
    public.is_super_admin()
    or public.user_has_permission('placement.view')
    or public.user_has_permission('students.view')
    or exists (
      select 1
      from public.students s
      where s.id = placement_applications.student_id
        and s.profile_id = auth.uid()
    )
  );

drop policy if exists "placement_applications_insert_scoped" on public.placement_applications;
create policy "placement_applications_insert_scoped"
  on public.placement_applications for insert to authenticated
  with check (
    public.is_super_admin()
    or public.user_has_permission('placement.create')
    or public.user_has_permission('placement.edit')
    or exists (
      select 1
      from public.students s
      where s.id = placement_applications.student_id
        and s.profile_id = auth.uid()
    )
  );

drop policy if exists "placement_applications_update_staff" on public.placement_applications;
create policy "placement_applications_update_staff"
  on public.placement_applications for update to authenticated
  using (
    public.is_super_admin()
    or public.user_has_permission('placement.edit')
  )
  with check (
    public.is_super_admin()
    or public.user_has_permission('placement.edit')
  );
