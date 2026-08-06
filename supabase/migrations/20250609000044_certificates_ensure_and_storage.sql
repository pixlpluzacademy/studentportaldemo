-- Ensure certificates table + private storage bucket exist.
-- Safe to re-run if migration 035 was never applied on this project.

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

alter table public.certificates enable row level security;

drop policy if exists "students_view_own_issued_certificates" on public.certificates;
create policy "students_view_own_issued_certificates"
  on public.certificates for select
  using (
    auth.uid() = student_id
    and status = 'issued'
  );

drop policy if exists "staff_view_batch_certificates" on public.certificates;
create policy "staff_view_batch_certificates"
  on public.certificates for select
  using (
    exists (
      select 1
      from public.batch_staff_assignments bsa
      where bsa.user_id = auth.uid()
        and bsa.batch_id = certificates.batch_id
    )
  );

drop policy if exists "branch_admin_view_certificates" on public.certificates;
create policy "branch_admin_view_certificates"
  on public.certificates for select
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

drop policy if exists "permission_view_certificates" on public.certificates;
create policy "permission_view_certificates"
  on public.certificates for select
  using (
    public.is_super_admin()
    or public.user_has_permission('certificates.view')
  );

drop policy if exists "superadmin_view_all_certificates" on public.certificates;
create policy "superadmin_view_all_certificates"
  on public.certificates for select
  using (public.is_super_admin());

drop policy if exists "admin_upload_certificates" on public.certificates;
create policy "admin_upload_certificates"
  on public.certificates for insert
  with check (
    public.is_super_admin()
    or public.user_has_permission('certificates.upload')
  );

drop policy if exists "admin_edit_certificates" on public.certificates;
create policy "admin_edit_certificates"
  on public.certificates for update
  using (
    public.is_super_admin()
    or public.user_has_permission('certificates.edit')
  )
  with check (
    public.is_super_admin()
    or public.user_has_permission('certificates.edit')
  );

drop policy if exists "admin_delete_certificates" on public.certificates;
create policy "admin_delete_certificates"
  on public.certificates for delete
  using (
    public.is_super_admin()
    or public.user_has_permission('certificates.delete')
  );

insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', false)
on conflict (id) do nothing;

drop policy if exists "certificates_storage_select" on storage.objects;
create policy "certificates_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'certificates'
    and (
      public.is_super_admin()
      or public.user_has_permission('certificates.view')
      or public.user_has_permission('certificates.download')
    )
  );

drop policy if exists "certificates_storage_insert" on storage.objects;
create policy "certificates_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'certificates'
    and (
      public.is_super_admin()
      or public.user_has_permission('certificates.upload')
    )
  );

drop policy if exists "certificates_storage_update" on storage.objects;
create policy "certificates_storage_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'certificates'
    and (
      public.is_super_admin()
      or public.user_has_permission('certificates.edit')
      or public.user_has_permission('certificates.upload')
    )
  )
  with check (
    bucket_id = 'certificates'
    and (
      public.is_super_admin()
      or public.user_has_permission('certificates.edit')
      or public.user_has_permission('certificates.upload')
    )
  );
