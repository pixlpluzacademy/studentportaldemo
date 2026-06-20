-- Task submission files, student notes, and mentor / HOD / Final QA review fields

do $$
begin
  create type public.task_review_decision as enum ('pending', 'approved', 'rejected', 'revision_requested');
exception
  when duplicate_object then null;
end $$;

alter table public.task_submissions
  add column if not exists student_note text,
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists mentor_mark numeric(5, 2),
  add column if not exists mentor_comment text,
  add column if not exists mentor_decision public.task_review_decision not null default 'pending',
  add column if not exists mentor_reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists mentor_reviewed_at timestamptz,
  add column if not exists hod_mark numeric(5, 2),
  add column if not exists hod_comment text,
  add column if not exists hod_decision public.task_review_decision not null default 'pending',
  add column if not exists hod_reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists hod_reviewed_at timestamptz,
  add column if not exists qa_mark numeric(5, 2),
  add column if not exists qa_comment text,
  add column if not exists qa_decision public.task_review_decision not null default 'pending',
  add column if not exists qa_reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists qa_reviewed_at timestamptz;
