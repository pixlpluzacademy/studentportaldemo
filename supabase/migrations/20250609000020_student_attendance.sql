-- Student attendance records per batch per day

do $$
begin
  create type public.attendance_status as enum ('present', 'absent', 'late', 'unmarked');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.student_attendance_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  attendance_date date not null,
  status public.attendance_status not null default 'unmarked',
  notes text,
  class_link text,
  marked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, student_id, attendance_date)
);

create index if not exists student_attendance_records_batch_id_idx
  on public.student_attendance_records (batch_id);

create index if not exists student_attendance_records_student_id_idx
  on public.student_attendance_records (student_id);

create index if not exists student_attendance_records_date_idx
  on public.student_attendance_records (attendance_date desc);

alter table public.student_attendance_records enable row level security;

drop policy if exists "student_attendance_select_scoped" on public.student_attendance_records;
create policy "student_attendance_select_scoped"
  on public.student_attendance_records for select to authenticated
  using (
    public.is_super_admin()
    or public.user_enrolled_in_batch(batch_id)
    or exists (
      select 1
      from public.batch_staff_assignments bsa
      where bsa.batch_id = student_attendance_records.batch_id
        and bsa.user_id = auth.uid()
    )
    or (
      public.user_has_permission('attendance.view')
      and exists (
        select 1
        from public.batches b
        where b.id = student_attendance_records.batch_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "student_attendance_insert_scoped" on public.student_attendance_records;
create policy "student_attendance_insert_scoped"
  on public.student_attendance_records for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      (public.user_has_permission('attendance.mark') or public.user_has_permission('attendance.edit'))
      and exists (
        select 1
        from public.batch_staff_assignments bsa
        where bsa.batch_id = student_attendance_records.batch_id
          and bsa.user_id = auth.uid()
      )
    )
    or (
      (public.user_has_permission('attendance.mark') or public.user_has_permission('attendance.edit'))
      and exists (
        select 1
        from public.batches b
        where b.id = student_attendance_records.batch_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "student_attendance_update_scoped" on public.student_attendance_records;
create policy "student_attendance_update_scoped"
  on public.student_attendance_records for update to authenticated
  using (
    public.is_super_admin()
    or (
      (public.user_has_permission('attendance.mark') or public.user_has_permission('attendance.edit'))
      and exists (
        select 1
        from public.batch_staff_assignments bsa
        where bsa.batch_id = student_attendance_records.batch_id
          and bsa.user_id = auth.uid()
      )
    )
    or (
      (public.user_has_permission('attendance.mark') or public.user_has_permission('attendance.edit'))
      and exists (
        select 1
        from public.batches b
        where b.id = student_attendance_records.batch_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      (public.user_has_permission('attendance.mark') or public.user_has_permission('attendance.edit'))
      and exists (
        select 1
        from public.batch_staff_assignments bsa
        where bsa.batch_id = student_attendance_records.batch_id
          and bsa.user_id = auth.uid()
      )
    )
    or (
      (public.user_has_permission('attendance.mark') or public.user_has_permission('attendance.edit'))
      and exists (
        select 1
        from public.batches b
        where b.id = student_attendance_records.batch_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "student_attendance_delete_scoped" on public.student_attendance_records;
create policy "student_attendance_delete_scoped"
  on public.student_attendance_records for delete to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('attendance.edit')
      and exists (
        select 1
        from public.batch_staff_assignments bsa
        where bsa.batch_id = student_attendance_records.batch_id
          and bsa.user_id = auth.uid()
      )
    )
    or (
      public.user_has_permission('attendance.edit')
      and exists (
        select 1
        from public.batches b
        where b.id = student_attendance_records.batch_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  );

grant select, insert, update, delete on public.student_attendance_records to authenticated;
