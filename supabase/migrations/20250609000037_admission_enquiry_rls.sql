-- Admission enquiry table RLS for LMS portal (Admission Leads page).
-- Table may already exist from website setup; create if missing.

create table if not exists public.admission_enquiry (
  id uuid not null default gen_random_uuid(),
  source text not null default 'website'::text,
  full_name text not null,
  email text not null,
  phone text not null default ''::text,
  city text not null default ''::text,
  interest text not null default ''::text,
  message text not null default ''::text,
  created_at timestamp with time zone not null default now(),
  constraint admission_enquiry_pkey primary key (id),
  constraint admission_enquiry_source_check check (
    source = any (array['home'::text, 'contact'::text, 'website'::text])
  )
);

create index if not exists admission_enquiry_created_at_idx
  on public.admission_enquiry using btree (created_at desc);

create index if not exists admission_enquiry_source_idx
  on public.admission_enquiry using btree (source);

alter table public.admission_enquiry enable row level security;

drop policy if exists "admissions_view_admission_enquiry" on public.admission_enquiry;
create policy "admissions_view_admission_enquiry"
  on public.admission_enquiry
  for select
  to authenticated
  using (
    public.is_super_admin()
    or public.user_has_permission('admissions.view')
  );

grant select on public.admission_enquiry to authenticated;
