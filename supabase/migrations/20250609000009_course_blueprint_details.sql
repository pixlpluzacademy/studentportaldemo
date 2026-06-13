-- Course blueprint detail tables (overview levels, syllabus packages, assignments, rubric, outputs).
-- Run after 20250609000008_courses_branch_scope.sql

begin;

alter table public.courses
  add column if not exists tagline text;

create type public.course_level_color as enum ('green', 'yellow', 'pink');

create table if not exists public.course_levels (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  slug text not null,
  name text not null,
  color public.course_level_color not null default 'green',
  summary text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (course_id, slug)
);

create table if not exists public.course_work_packages (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.course_levels (id) on delete cascade,
  package_number text not null,
  title text not null,
  duration text,
  goal text,
  skills text[] not null default '{}',
  tools text[] not null default '{}',
  practice_tasks text[] not null default '{}',
  final_deliverable text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.course_assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.course_rubric_items (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  label text not null,
  weight_label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.course_portfolio_outputs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists course_levels_course_id_idx on public.course_levels (course_id);
create index if not exists course_work_packages_level_id_idx on public.course_work_packages (level_id);
create index if not exists course_assignments_course_id_idx on public.course_assignments (course_id);
create index if not exists course_rubric_items_course_id_idx on public.course_rubric_items (course_id);
create index if not exists course_portfolio_outputs_course_id_idx on public.course_portfolio_outputs (course_id);

-- Branch-scoped RLS via course -> department
drop policy if exists "course_levels_select" on public.course_levels;
create policy "course_levels_select"
  on public.course_levels for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('courses.view')
      and exists (
        select 1
        from public.courses c
        join public.departments d on d.id = c.department_id
        where c.id = course_levels.course_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "course_levels_manage" on public.course_levels;
create policy "course_levels_manage"
  on public.course_levels for all to authenticated
  using (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('courses.edit')
        or public.user_has_permission('courses.create')
      )
      and exists (
        select 1
        from public.courses c
        join public.departments d on d.id = c.department_id
        where c.id = course_levels.course_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('courses.edit')
        or public.user_has_permission('courses.create')
      )
      and exists (
        select 1
        from public.courses c
        join public.departments d on d.id = c.department_id
        where c.id = course_levels.course_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
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
        join public.courses c on c.id = cl.course_id
        join public.departments d on d.id = c.department_id
        where cl.id = course_work_packages.level_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "course_work_packages_manage" on public.course_work_packages;
create policy "course_work_packages_manage"
  on public.course_work_packages for all to authenticated
  using (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('courses.edit')
        or public.user_has_permission('courses.create')
      )
      and exists (
        select 1
        from public.course_levels cl
        join public.courses c on c.id = cl.course_id
        join public.departments d on d.id = c.department_id
        where cl.id = course_work_packages.level_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('courses.edit')
        or public.user_has_permission('courses.create')
      )
      and exists (
        select 1
        from public.course_levels cl
        join public.courses c on c.id = cl.course_id
        join public.departments d on d.id = c.department_id
        where cl.id = course_work_packages.level_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "course_assignments_select" on public.course_assignments;
create policy "course_assignments_select"
  on public.course_assignments for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('courses.view')
      and exists (
        select 1
        from public.courses c
        join public.departments d on d.id = c.department_id
        where c.id = course_assignments.course_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "course_assignments_manage" on public.course_assignments;
create policy "course_assignments_manage"
  on public.course_assignments for all to authenticated
  using (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('courses.edit')
        or public.user_has_permission('courses.create')
      )
      and exists (
        select 1
        from public.courses c
        join public.departments d on d.id = c.department_id
        where c.id = course_assignments.course_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('courses.edit')
        or public.user_has_permission('courses.create')
      )
      and exists (
        select 1
        from public.courses c
        join public.departments d on d.id = c.department_id
        where c.id = course_assignments.course_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "course_rubric_items_select" on public.course_rubric_items;
create policy "course_rubric_items_select"
  on public.course_rubric_items for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('courses.view')
      and exists (
        select 1
        from public.courses c
        join public.departments d on d.id = c.department_id
        where c.id = course_rubric_items.course_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "course_rubric_items_manage" on public.course_rubric_items;
create policy "course_rubric_items_manage"
  on public.course_rubric_items for all to authenticated
  using (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('courses.edit')
        or public.user_has_permission('courses.create')
      )
      and exists (
        select 1
        from public.courses c
        join public.departments d on d.id = c.department_id
        where c.id = course_rubric_items.course_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('courses.edit')
        or public.user_has_permission('courses.create')
      )
      and exists (
        select 1
        from public.courses c
        join public.departments d on d.id = c.department_id
        where c.id = course_rubric_items.course_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "course_portfolio_outputs_select" on public.course_portfolio_outputs;
create policy "course_portfolio_outputs_select"
  on public.course_portfolio_outputs for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('courses.view')
      and exists (
        select 1
        from public.courses c
        join public.departments d on d.id = c.department_id
        where c.id = course_portfolio_outputs.course_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "course_portfolio_outputs_manage" on public.course_portfolio_outputs;
create policy "course_portfolio_outputs_manage"
  on public.course_portfolio_outputs for all to authenticated
  using (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('courses.edit')
        or public.user_has_permission('courses.create')
      )
      and exists (
        select 1
        from public.courses c
        join public.departments d on d.id = c.department_id
        where c.id = course_portfolio_outputs.course_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('courses.edit')
        or public.user_has_permission('courses.create')
      )
      and exists (
        select 1
        from public.courses c
        join public.departments d on d.id = c.department_id
        where c.id = course_portfolio_outputs.course_id
          and d.branch_id in (select public.user_branch_ids())
      )
    )
  );

grant insert, update, delete on public.course_levels to authenticated;
grant insert, update, delete on public.course_work_packages to authenticated;
grant insert, update, delete on public.course_assignments to authenticated;
grant insert, update, delete on public.course_rubric_items to authenticated;
grant insert, update, delete on public.course_portfolio_outputs to authenticated;

commit;
