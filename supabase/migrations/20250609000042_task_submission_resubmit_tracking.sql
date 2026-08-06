-- Track student re-upload date and attempt count

alter table public.task_submissions
  add column if not exists resubmitted_at timestamptz,
  add column if not exists submit_attempts integer not null default 0;

-- Backfill attempts for existing submitted rows
update public.task_submissions
set submit_attempts = 1
where submitted_at is not null
  and submit_attempts = 0;
