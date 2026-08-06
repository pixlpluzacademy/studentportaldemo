-- Re-upload window set by mentor / HOD / Final QA when requesting revision or rejecting

alter table public.task_submissions
  add column if not exists resubmit_deadline_date date,
  add column if not exists resubmit_deadline_time time,
  add column if not exists resubmitted_at timestamptz,
  add column if not exists submit_attempts integer not null default 0;
