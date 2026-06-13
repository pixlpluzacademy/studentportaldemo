-- Add optional branch-unique department code (e.g. DM, WD).
-- Run after 20250609000007_departments_branch_scope.sql

alter table public.departments
  add column if not exists department_code text;

create unique index if not exists departments_department_code_unique
  on public.departments (department_code)
  where department_code is not null;
