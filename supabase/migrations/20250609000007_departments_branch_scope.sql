-- Departments are branch-scoped (Kochi branch sees Kochi departments only).
-- Run in Supabase SQL Editor after prior LMS migrations.

begin;

alter table public.departments
  add column if not exists branch_id uuid references public.branches (id) on delete restrict;

-- Backfill existing rows to the oldest branch (adjust manually if needed).
update public.departments d
set branch_id = (
  select b.id
  from public.branches b
  order by b.created_at asc
  limit 1
)
where d.branch_id is null;

alter table public.departments
  alter column branch_id set not null;

alter table public.departments
  drop constraint if exists departments_slug_key;

create unique index if not exists departments_branch_slug_idx
  on public.departments (branch_id, slug);

create index if not exists departments_branch_id_idx
  on public.departments (branch_id);

-- Branch-scoped RLS
drop policy if exists "departments_select" on public.departments;
create policy "departments_select"
  on public.departments for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('departments.view')
      and branch_id in (select public.user_branch_ids())
    )
  );

drop policy if exists "departments_manage" on public.departments;
create policy "departments_manage"
  on public.departments for all to authenticated
  using (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('departments.edit')
        or public.user_has_permission('departments.create')
        or public.user_has_permission('departments.delete')
      )
      and branch_id in (select public.user_branch_ids())
    )
  )
  with check (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('departments.edit')
        or public.user_has_permission('departments.create')
        or public.user_has_permission('departments.delete')
      )
      and branch_id in (select public.user_branch_ids())
    )
  );

commit;
