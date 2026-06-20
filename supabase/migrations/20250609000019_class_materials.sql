-- Class materials: daily notes + optional session links per batch

create type public.class_material_status as enum ('draft', 'published', 'archived');

create table public.class_materials (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  title text not null,
  description text,
  class_date date not null,
  notes_file_path text,
  notes_file_name text,
  class_link text,
  status public.class_material_status not null default 'published',
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index class_materials_batch_id_idx on public.class_materials (batch_id);
create index class_materials_class_date_idx on public.class_materials (class_date desc);

alter table public.class_materials enable row level security;

drop policy if exists "class_materials_select_scoped" on public.class_materials;
create policy "class_materials_select_scoped"
  on public.class_materials for select to authenticated
  using (
    public.is_super_admin()
    or public.user_enrolled_in_batch(batch_id)
    or exists (
      select 1
      from public.batch_staff_assignments bsa
      where bsa.batch_id = class_materials.batch_id
        and bsa.user_id = auth.uid()
    )
    or (
      public.user_has_permission('class-materials.view')
      and exists (
        select 1
        from public.batches b
        where b.id = class_materials.batch_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "class_materials_insert_scoped" on public.class_materials;
create policy "class_materials_insert_scoped"
  on public.class_materials for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      (public.user_has_permission('class-materials.upload') or public.user_has_permission('class-materials.edit'))
      and exists (
        select 1
        from public.batch_staff_assignments bsa
        where bsa.batch_id = class_materials.batch_id
          and bsa.user_id = auth.uid()
      )
    )
    or (
      (public.user_has_permission('class-materials.upload') or public.user_has_permission('class-materials.edit'))
      and exists (
        select 1
        from public.batches b
        where b.id = class_materials.batch_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "class_materials_update_scoped" on public.class_materials;
create policy "class_materials_update_scoped"
  on public.class_materials for update to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('class-materials.edit')
      and exists (
        select 1
        from public.batch_staff_assignments bsa
        where bsa.batch_id = class_materials.batch_id
          and bsa.user_id = auth.uid()
      )
    )
    or (
      public.user_has_permission('class-materials.edit')
      and exists (
        select 1
        from public.batches b
        where b.id = class_materials.batch_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      public.user_has_permission('class-materials.edit')
      and exists (
        select 1
        from public.batch_staff_assignments bsa
        where bsa.batch_id = class_materials.batch_id
          and bsa.user_id = auth.uid()
      )
    )
    or (
      public.user_has_permission('class-materials.edit')
      and exists (
        select 1
        from public.batches b
        where b.id = class_materials.batch_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "class_materials_delete_scoped" on public.class_materials;
create policy "class_materials_delete_scoped"
  on public.class_materials for delete to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('class-materials.delete')
      and exists (
        select 1
        from public.batch_staff_assignments bsa
        where bsa.batch_id = class_materials.batch_id
          and bsa.user_id = auth.uid()
      )
    )
    or (
      public.user_has_permission('class-materials.delete')
      and exists (
        select 1
        from public.batches b
        where b.id = class_materials.batch_id
          and b.branch_id in (select public.user_branch_ids())
      )
    )
  );

grant select, insert, update, delete on public.class_materials to authenticated;

insert into storage.buckets (id, name, public)
values ('class-materials', 'class-materials', false)
on conflict (id) do nothing;

drop policy if exists "class_materials_storage_select" on storage.objects;
create policy "class_materials_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'class-materials'
    and (
      public.is_super_admin()
      or public.user_has_permission('class-materials.view')
      or public.user_has_permission('class-materials.download')
    )
  );

drop policy if exists "class_materials_storage_insert" on storage.objects;
create policy "class_materials_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'class-materials'
    and (
      public.is_super_admin()
      or public.user_has_permission('class-materials.upload')
      or public.user_has_permission('class-materials.edit')
    )
  );

drop policy if exists "class_materials_storage_delete" on storage.objects;
create policy "class_materials_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'class-materials'
    and (
      public.is_super_admin()
      or public.user_has_permission('class-materials.delete')
    )
  );
