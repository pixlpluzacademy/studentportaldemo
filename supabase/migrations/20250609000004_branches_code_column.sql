-- Ensure branches.code exists (foundation migration may already have created it).
-- Safe to run on existing projects.

begin;

alter table public.branches
  add column if not exists code text;

create unique index if not exists branches_code_unique_idx
  on public.branches (code)
  where code is not null;

comment on column public.branches.code is 'Short unique branch identifier (e.g. KOCHI, CLT).';

commit;
