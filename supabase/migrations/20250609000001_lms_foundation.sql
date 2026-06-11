-- =============================================================================
-- Pixel Pluz LMS — Phase 1 foundation
-- Run ONCE on a fresh Supabase project (SQL Editor: paste this entire file).
-- Safe for new projects: system seeds use ON CONFLICT DO NOTHING.
-- No reference org demo data — create branches/departments/courses via the app.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Extensions & enums
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

create type public.profile_status as enum ('active', 'inactive');
create type public.staff_source as enum ('internal', 'neo_digital_hub', 'external');
create type public.branch_status as enum ('active', 'upcoming', 'planning', 'inactive');
create type public.course_type as enum ('basic', 'advanced', 'professional');
create type public.course_status as enum ('active', 'inactive', 'archived');
create type public.batch_mode as enum ('online', 'offline');
create type public.batch_status as enum ('active', 'full', 'upcoming', 'archived');
create type public.class_day_type as enum ('weekdays', 'weekend', 'custom');
-- hod, mentor, trainer, final_qa — matches batch UI staff roles (/batches)
create type public.batch_staff_type as enum ('hod', 'mentor', 'trainer', 'final_qa');
create type public.enrollment_status as enum ('active', 'completed', 'dropped');

-- ---------------------------------------------------------------------------
-- Parent roles (fixed — 6 categories)
-- ---------------------------------------------------------------------------

create table public.parent_roles (
  id text primary key,
  name text not null,
  level integer not null,
  created_at timestamptz not null default now()
);

insert into public.parent_roles (id, name, level) values
  ('super_admin', 'Super Admin', 1),
  ('company_admin', 'Company Admin', 2),
  ('branch_admin', 'Branch Admin', 3),
  ('mentor', 'Mentor', 4),
  ('student', 'Student', 5),
  ('placement', 'Placement', 6)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Branches (before profiles.branch_id FK)
-- ---------------------------------------------------------------------------

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  location text,
  controller_id uuid,
  status public.branch_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users — required for all login users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  parent_role_id text not null references public.parent_roles (id),
  branch_id uuid references public.branches (id) on delete set null,
  staff_source public.staff_source not null default 'internal',
  avatar_url text,
  status public.profile_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.branches
  add constraint branches_controller_id_fkey
  foreign key (controller_id) references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Permission catalog (LMS modules only — no companies.*)
-- ---------------------------------------------------------------------------

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  module_id text not null,
  action text not null,
  permission_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.permission_profiles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  parent_role_id text not null references public.parent_roles (id),
  is_system boolean not null default false,
  status public.profile_status not null default 'active',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_permissions (
  profile_id uuid not null references public.permission_profiles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (profile_id, permission_id)
);

create table public.user_permission_profiles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  profile_id uuid not null references public.permission_profiles (id) on delete cascade,
  is_primary boolean not null default true,
  assigned_at timestamptz not null default now(),
  primary key (user_id, profile_id)
);

create unique index user_permission_profiles_one_primary_idx
  on public.user_permission_profiles (user_id)
  where is_primary = true;

create table public.user_branch_assignments (
  user_id uuid not null references public.profiles (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, branch_id)
);

-- ---------------------------------------------------------------------------
-- Organization & curriculum
-- ---------------------------------------------------------------------------

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  status public.profile_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  name text not null,
  course_type public.course_type not null,
  duration_months integer not null,
  description text,
  tools text[] not null default '{}',
  pass_mark numeric(5, 2),
  status public.course_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete restrict,
  course_id uuid not null references public.courses (id) on delete restrict,
  name text not null,
  code text unique,
  mode public.batch_mode not null,
  schedule text,
  seat_capacity integer not null default 20,
  start_date date,
  end_date date,
  class_day_type public.class_day_type not null default 'weekdays',
  class_link text,
  status public.batch_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.batch_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  staff_type public.batch_staff_type not null,
  reports_to uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (batch_id, user_id, staff_type)
);

-- Students: profile_id links to auth when portal account exists.
-- Admin create-student API creates auth.users + profiles + students together.
-- Nullable profile_id allows future pre-enrollment records (inactive, no login yet).
-- Active students must have a profile (portal login required for LMS v1).
create table public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  student_code text not null unique,
  phone text,
  joining_date date,
  profile_picture_url text,
  status public.profile_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_active_requires_profile check (
    status <> 'active' or profile_id is not null
  )
);

create table public.student_batch_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  batch_id uuid not null references public.batches (id) on delete cascade,
  status public.enrollment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  unique (student_id, batch_id)
);

-- ---------------------------------------------------------------------------
-- Permission seed (LMS modules — companies.* removed; departments.* added)
-- ---------------------------------------------------------------------------

insert into public.permissions (module_id, action, permission_key) values
  ('dashboard', 'view', 'dashboard.view'),
  ('branches', 'view', 'branches.view'),
  ('branches', 'create', 'branches.create'),
  ('branches', 'edit', 'branches.edit'),
  ('branches', 'delete', 'branches.delete'),
  ('branches', 'assign', 'branches.assign'),
  ('departments', 'view', 'departments.view'),
  ('departments', 'create', 'departments.create'),
  ('departments', 'edit', 'departments.edit'),
  ('departments', 'delete', 'departments.delete'),
  ('users', 'view', 'users.view'),
  ('users', 'create', 'users.create'),
  ('users', 'edit', 'users.edit'),
  ('users', 'delete', 'users.delete'),
  ('users', 'assign', 'users.assign'),
  ('roles', 'view', 'roles.view'),
  ('roles', 'create', 'roles.create'),
  ('roles', 'edit', 'roles.edit'),
  ('roles', 'delete', 'roles.delete'),
  ('roles', 'assign', 'roles.assign'),
  ('courses', 'view', 'courses.view'),
  ('courses', 'create', 'courses.create'),
  ('courses', 'edit', 'courses.edit'),
  ('courses', 'delete', 'courses.delete'),
  ('my-courses', 'view', 'my-courses.view'),
  ('class-materials', 'view', 'class-materials.view'),
  ('class-materials', 'upload', 'class-materials.upload'),
  ('class-materials', 'edit', 'class-materials.edit'),
  ('class-materials', 'delete', 'class-materials.delete'),
  ('class-materials', 'download', 'class-materials.download'),
  ('batches', 'view', 'batches.view'),
  ('batches', 'create', 'batches.create'),
  ('batches', 'edit', 'batches.edit'),
  ('batches', 'delete', 'batches.delete'),
  ('batches', 'assign', 'batches.assign'),
  ('students', 'view', 'students.view'),
  ('students', 'create', 'students.create'),
  ('students', 'edit', 'students.edit'),
  ('students', 'delete', 'students.delete'),
  ('students', 'assign', 'students.assign'),
  ('mentors', 'view', 'mentors.view'),
  ('mentors', 'create', 'mentors.create'),
  ('mentors', 'edit', 'mentors.edit'),
  ('mentors', 'delete', 'mentors.delete'),
  ('mentors', 'assign', 'mentors.assign'),
  ('attendance', 'view', 'attendance.view'),
  ('attendance', 'mark', 'attendance.mark'),
  ('attendance', 'edit', 'attendance.edit'),
  ('attendance', 'export', 'attendance.export'),
  ('tasks', 'view', 'tasks.view'),
  ('tasks', 'create', 'tasks.create'),
  ('tasks', 'edit', 'tasks.edit'),
  ('tasks', 'delete', 'tasks.delete'),
  ('tasks', 'assign', 'tasks.assign'),
  ('submissions', 'view', 'submissions.view'),
  ('submissions', 'submit', 'submissions.submit'),
  ('submissions', 'review', 'submissions.review'),
  ('submissions', 'approve', 'submissions.approve'),
  ('submissions', 'edit', 'submissions.edit'),
  ('submissions', 'delete', 'submissions.delete'),
  ('marks', 'view', 'marks.view'),
  ('marks', 'upload', 'marks.upload'),
  ('marks', 'edit', 'marks.edit'),
  ('marks', 'approve', 'marks.approve'),
  ('marks', 'export', 'marks.export'),
  ('hod_review', 'view', 'hod_review.view'),
  ('hod_review', 'review', 'hod_review.review'),
  ('hod_review', 'approve', 'hod_review.approve'),
  ('hod_review', 'edit', 'hod_review.edit'),
  ('final_qa', 'view', 'final_qa.view'),
  ('final_qa', 'validate', 'final_qa.validate'),
  ('final_qa', 'lock', 'final_qa.lock'),
  ('final_qa', 'approve', 'final_qa.approve'),
  ('final_qa', 'export', 'final_qa.export'),
  ('placement', 'view', 'placement.view'),
  ('placement', 'create', 'placement.create'),
  ('placement', 'edit', 'placement.edit'),
  ('placement', 'delete', 'placement.delete'),
  ('placement', 'export', 'placement.export'),
  ('certificates', 'view', 'certificates.view'),
  ('certificates', 'upload', 'certificates.upload'),
  ('certificates', 'download', 'certificates.download'),
  ('certificates', 'edit', 'certificates.edit'),
  ('certificates', 'delete', 'certificates.delete'),
  ('complaints', 'view', 'complaints.view'),
  ('complaints', 'create', 'complaints.create'),
  ('complaints', 'reply', 'complaints.reply'),
  ('complaints', 'resolve', 'complaints.resolve'),
  ('complaints', 'edit', 'complaints.edit'),
  ('reports', 'view', 'reports.view'),
  ('reports', 'export', 'reports.export'),
  ('settings', 'view', 'settings.view'),
  ('settings', 'edit', 'settings.edit')
on conflict (permission_key) do nothing;

-- ---------------------------------------------------------------------------
-- Default permission profiles
-- ---------------------------------------------------------------------------

insert into public.permission_profiles (slug, name, parent_role_id, is_system) values
  ('super_admin_full', 'Super Admin', 'super_admin', true),
  ('company_admin_default', 'Company Admin', 'company_admin', true),
  ('branch_admin_default', 'Branch Admin', 'branch_admin', true),
  ('mentor_trainer', 'Trainer / Mentor', 'mentor', true),
  ('mentor_hod', 'HOD / Superior Mentor', 'mentor', true),
  ('mentor_final_qa', 'Final QA', 'mentor', true),
  ('student_default', 'Student', 'student', true),
  ('placement_default', 'Placement Cell', 'placement', true)
on conflict (slug) do nothing;

create or replace function public.link_profile_permissions(p_slug text, p_keys text[])
returns void
language plpgsql
as $$
declare
  v_profile_id uuid;
begin
  select id into v_profile_id from public.permission_profiles where slug = p_slug;
  if v_profile_id is null then
    raise exception 'Permission profile not found: %', p_slug;
  end if;

  insert into public.profile_permissions (profile_id, permission_id)
  select v_profile_id, p.id
  from public.permissions p
  where p.permission_key = any (p_keys)
  on conflict do nothing;
end;
$$;

-- Super Admin: all permissions in catalog
insert into public.profile_permissions (profile_id, permission_id)
select pp.id, p.id
from public.permission_profiles pp
cross join public.permissions p
where pp.slug = 'super_admin_full'
on conflict do nothing;

-- Company Admin (no companies.* — LMS only)
select public.link_profile_permissions('company_admin_default', array[
  'dashboard.view',
  'branches.view','branches.create','branches.edit','branches.delete','branches.assign',
  'departments.view','departments.create','departments.edit','departments.delete',
  'users.view','users.create','users.edit','users.delete','users.assign',
  'roles.view','roles.create','roles.edit','roles.assign',
  'courses.view','courses.create','courses.edit','courses.delete',
  'my-courses.view','class-materials.view','class-materials.upload','class-materials.edit','class-materials.delete','class-materials.download',
  'batches.view','batches.create','batches.edit','batches.delete','batches.assign',
  'students.view','students.create','students.edit','students.delete','students.assign',
  'mentors.view','mentors.create','mentors.edit','mentors.delete','mentors.assign',
  'attendance.view','attendance.mark','attendance.edit','attendance.export',
  'tasks.view','tasks.create','tasks.edit','tasks.delete','tasks.assign',
  'submissions.view','submissions.submit','submissions.review','submissions.approve','submissions.edit','submissions.delete',
  'marks.view','marks.upload','marks.edit','marks.approve','marks.export',
  'hod_review.view','hod_review.review','hod_review.approve','hod_review.edit',
  'placement.view','placement.create','placement.edit','placement.delete','placement.export',
  'certificates.view','certificates.upload','certificates.download','certificates.edit','certificates.delete',
  'complaints.view','complaints.create','complaints.reply','complaints.resolve','complaints.edit',
  'reports.view','reports.export','settings.view','settings.edit'
]);

select public.link_profile_permissions('branch_admin_default', array[
  'dashboard.view',
  'departments.view','departments.create','departments.edit','departments.delete',
  'users.view','users.create','users.edit','users.assign',
  'courses.view','courses.create','courses.edit','courses.delete',
  'my-courses.view','class-materials.view','class-materials.upload','class-materials.edit','class-materials.delete',
  'batches.view','batches.create','batches.edit','batches.delete','batches.assign',
  'students.view','students.create','students.edit','students.delete','students.assign',
  'mentors.view','mentors.create','mentors.edit','mentors.delete','mentors.assign',
  'attendance.view','attendance.mark','attendance.edit','attendance.export',
  'tasks.view','tasks.create','tasks.edit','tasks.delete','tasks.assign',
  'submissions.view','submissions.submit','submissions.review','submissions.approve','submissions.edit','submissions.delete',
  'marks.view','marks.upload','marks.edit','marks.approve','marks.export',
  'hod_review.view','hod_review.review','hod_review.approve','hod_review.edit',
  'placement.view','placement.create','placement.edit','placement.delete','placement.export',
  'certificates.view','certificates.upload','certificates.download','certificates.edit','certificates.delete',
  'complaints.view','complaints.create','complaints.reply','complaints.resolve','complaints.edit',
  'reports.view','reports.export','settings.view'
]);

select public.link_profile_permissions('mentor_trainer', array[
  'dashboard.view','my-courses.view','class-materials.view','class-materials.upload','class-materials.edit','class-materials.delete',
  'batches.view','students.view','attendance.view','attendance.mark',
  'tasks.view','tasks.create','tasks.edit','tasks.assign',
  'submissions.view','submissions.review','submissions.approve',
  'marks.view','marks.upload','complaints.view','complaints.reply','settings.view'
]);

select public.link_profile_permissions('mentor_hod', array[
  'dashboard.view','my-courses.view','class-materials.view','class-materials.upload','class-materials.edit','class-materials.delete',
  'batches.view','mentors.view','students.view','tasks.view',
  'submissions.view','submissions.review','marks.view','marks.edit','marks.approve',
  'hod_review.view','hod_review.review','hod_review.approve','hod_review.edit',
  'complaints.view','complaints.reply','complaints.resolve','reports.view','settings.view'
]);

select public.link_profile_permissions('mentor_final_qa', array[
  'dashboard.view','submissions.view','marks.view',
  'final_qa.view','final_qa.validate','final_qa.lock','final_qa.approve','final_qa.export',
  'certificates.view','reports.view','reports.export','settings.view'
]);

select public.link_profile_permissions('student_default', array[
  'dashboard.view','my-courses.view','class-materials.view','class-materials.download',
  'attendance.view','tasks.view','submissions.view','submissions.submit',
  'marks.view','certificates.view','certificates.download',
  'complaints.view','complaints.create','complaints.reply','settings.view','settings.edit'
]);

select public.link_profile_permissions('placement_default', array[
  'dashboard.view','students.view','placement.view','placement.create','placement.edit','placement.export',
  'reports.view','reports.export','settings.view'
]);

drop function public.link_profile_permissions(text, text[]);

-- ---------------------------------------------------------------------------
-- Auth helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_super_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.parent_role_id = 'super_admin'
      and p.status = 'active'
  );
$$;

create or replace function public.user_has_permission(
  p_permission_key text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin(p_user_id)
    or exists (
      select 1
      from public.user_permission_profiles upp
      join public.profile_permissions pp on pp.profile_id = upp.profile_id
      join public.permissions perm on perm.id = pp.permission_id
      where upp.user_id = p_user_id
        and perm.permission_key = p_permission_key
    );
$$;

create or replace function public.user_branch_ids(p_user_id uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.id
  from public.branches b
  where public.is_super_admin(p_user_id)
  union
  select uba.branch_id
  from public.user_branch_assignments uba
  where uba.user_id = p_user_id
  union
  select p.branch_id
  from public.profiles p
  where p.id = p_user_id
    and p.branch_id is not null;
$$;

create or replace function public.generate_student_code(p_batch_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_code text;
  v_next integer;
begin
  select coalesce(b.code, upper(left(replace(b.name, ' ', ''), 6)))
  into v_batch_code
  from public.batches b
  where b.id = p_batch_id;

  if v_batch_code is null then
    raise exception 'Batch not found';
  end if;

  select count(*) + 1
  into v_next
  from public.student_batch_enrollments e
  where e.batch_id = p_batch_id;

  return v_batch_code || '-S' || lpad(v_next::text, 3, '0');
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_role text;
  v_profile_slug text;
  v_profile_id uuid;
begin
  v_parent_role := coalesce(new.raw_user_meta_data->>'parent_role_id', 'student');

  insert into public.profiles (id, full_name, email, parent_role_id, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    lower(new.email),
    v_parent_role,
    'active'
  )
  on conflict (id) do nothing;

  v_profile_slug := coalesce(
    new.raw_user_meta_data->>'permission_profile_slug',
    case v_parent_role
      when 'super_admin' then 'super_admin_full'
      when 'company_admin' then 'company_admin_default'
      when 'branch_admin' then 'branch_admin_default'
      when 'mentor' then 'mentor_trainer'
      when 'placement' then 'placement_default'
      else 'student_default'
    end
  );

  select id into v_profile_id
  from public.permission_profiles
  where slug = v_profile_slug;

  if v_profile_id is not null then
    insert into public.user_permission_profiles (user_id, profile_id, is_primary)
    values (new.id, v_profile_id, true)
    on conflict (user_id, profile_id) do update set is_primary = excluded.is_primary;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists branches_updated_at on public.branches;
create trigger branches_updated_at before update on public.branches
  for each row execute function public.set_updated_at();

drop trigger if exists departments_updated_at on public.departments;
create trigger departments_updated_at before update on public.departments
  for each row execute function public.set_updated_at();

drop trigger if exists courses_updated_at on public.courses;
create trigger courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

drop trigger if exists batches_updated_at on public.batches;
create trigger batches_updated_at before update on public.batches
  for each row execute function public.set_updated_at();

drop trigger if exists students_updated_at on public.students;
create trigger students_updated_at before update on public.students
  for each row execute function public.set_updated_at();

drop trigger if exists permission_profiles_updated_at on public.permission_profiles;
create trigger permission_profiles_updated_at before update on public.permission_profiles
  for each row execute function public.set_updated_at();

commit;
