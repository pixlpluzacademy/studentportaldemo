-- Add a per-task flag: when true, students must attach a file to submit.
-- Default false keeps existing tasks optional (backward compatible).

alter table public.tasks
  add column if not exists file_required boolean not null default false;
