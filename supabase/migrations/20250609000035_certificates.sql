-- Certificates table for storing issued/pending certificates after final QA approval

do $$
begin
  create type public.certificate_status as enum ('draft', 'pending', 'issued', 'revoked');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.certificates (
  id uuid not null default gen_random_uuid() primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  batch_id uuid not null references public.batches (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  title text not null default 'Course Completion Certificate',
  certificate_no text not null unique,
  status public.certificate_status not null default 'pending',
  file_path text,
  file_name text,
  issued_by uuid references public.profiles (id) on delete set null,
  issued_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_certificates_student_id on public.certificates (student_id);
create index if not exists idx_certificates_batch_id on public.certificates (batch_id);
create index if not exists idx_certificates_status on public.certificates (status);
create index if not exists idx_certificates_certificate_no on public.certificates (certificate_no);

-- RLS policies for certificates

alter table public.certificates enable row level security;

-- Students can view their own issued certificates only
create policy "students_view_own_issued_certificates"
  on public.certificates
  for select
  using (
    auth.uid() = student_id
    and status = 'issued'
  );

-- Mentors/HOD/Trainers can view certificates for students in their assigned batches
create policy "staff_view_batch_certificates"
  on public.certificates
  for select
  using (
    exists (
      select 1
      from public.batch_staff_assignments bsa
      where bsa.user_id = auth.uid()
        and bsa.batch_id = certificates.batch_id
    )
  );

-- Branch admins can view certificates for their branch
create policy "branch_admin_view_certificates"
  on public.certificates
  for select
  using (
    public.user_has_permission('certificates.view')
    and exists (
      select 1
      from public.user_branch_assignments uba
      join public.batches b on b.branch_id = uba.branch_id
      where uba.user_id = auth.uid()
        and b.id = certificates.batch_id
    )
  );

-- Super admins can view all certificates
create policy "superadmin_view_all_certificates"
  on public.certificates
  for select
  using (
    public.is_super_admin()
  );

-- Only super admin and users with certificates.upload permission can insert
create policy "admin_upload_certificates"
  on public.certificates
  for insert
  with check (
    public.is_super_admin()
    or public.user_has_permission('certificates.upload')
  );

-- Only super admin and users with certificates.edit permission can update
create policy "admin_edit_certificates"
  on public.certificates
  for update
  using (
    public.is_super_admin()
    or public.user_has_permission('certificates.edit')
  )
  with check (
    public.is_super_admin()
    or public.user_has_permission('certificates.edit')
  );

-- Only super admin and users with certificates.delete permission can delete
create policy "admin_delete_certificates"
  on public.certificates
  for delete
  using (
    public.is_super_admin()
    or public.user_has_permission('certificates.delete')
  );
