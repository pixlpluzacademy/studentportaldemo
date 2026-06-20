-- Complaints desk + student mentor star ratings

begin;

do $$
begin
  create type public.complaint_status as enum ('open', 'in_review', 'resolved', 'rejected');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.complaint_priority as enum ('low', 'medium', 'high', 'urgent');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  mentor_id uuid not null references public.profiles (id) on delete restrict,
  branch_id uuid not null references public.branches (id) on delete restrict,
  batch_id uuid not null references public.batches (id) on delete restrict,
  mentor_staff_type public.batch_staff_type not null,
  title text not null,
  category text not null,
  description text not null,
  priority public.complaint_priority not null default 'medium',
  status public.complaint_status not null default 'open',
  attachment_path text,
  attachment_name text,
  admin_reply text,
  replied_by uuid references public.profiles (id) on delete set null,
  replied_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists complaints_student_id_idx on public.complaints (student_id);
create index if not exists complaints_branch_id_idx on public.complaints (branch_id);
create index if not exists complaints_batch_id_idx on public.complaints (batch_id);
create index if not exists complaints_mentor_id_idx on public.complaints (mentor_id);
create index if not exists complaints_status_idx on public.complaints (status);
create index if not exists complaints_created_at_idx on public.complaints (created_at desc);

create table if not exists public.mentor_ratings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  mentor_id uuid not null references public.profiles (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete restrict,
  batch_id uuid not null references public.batches (id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, mentor_id)
);

create index if not exists mentor_ratings_mentor_id_idx on public.mentor_ratings (mentor_id);
create index if not exists mentor_ratings_student_id_idx on public.mentor_ratings (student_id);

insert into public.permissions (module_id, action, permission_key)
values
  ('ratings', 'submit', 'ratings.submit'),
  ('ratings', 'view', 'ratings.view')
on conflict (permission_key) do nothing;

delete from public.profile_permissions ppp
using public.permission_profiles pp, public.permissions p
where ppp.profile_id = pp.id
  and ppp.permission_id = p.id
  and pp.slug in ('mentor_trainer', 'mentor_hod')
  and p.permission_key like 'complaints.%';

delete from public.profile_permissions ppp
using public.permission_profiles pp, public.permissions p
where ppp.profile_id = pp.id
  and ppp.permission_id = p.id
  and pp.slug = 'student_default'
  and p.permission_key = 'complaints.reply';

insert into public.profile_permissions (profile_id, permission_id)
select pp.id, p.id
from public.permission_profiles pp
cross join public.permissions p
where pp.slug = 'student_default'
  and p.permission_key = 'ratings.submit'
on conflict do nothing;

insert into public.profile_permissions (profile_id, permission_id)
select pp.id, p.id
from public.permission_profiles pp
cross join public.permissions p
where pp.slug = 'mentor_trainer'
  and p.permission_key = 'ratings.view'
on conflict do nothing;

create or replace function public.student_assigned_mentor_ids(p_student_id uuid)
returns table (
  mentor_id uuid,
  batch_id uuid,
  branch_id uuid,
  mentor_staff_type public.batch_staff_type
)
language sql
stable
security definer
set search_path = public
as $$
  select bsa.user_id, bsa.batch_id, b.branch_id, bsa.staff_type
  from public.student_batch_enrollments sbe
  join public.batches b on b.id = sbe.batch_id
  join public.batch_staff_assignments bsa on bsa.batch_id = sbe.batch_id
  where sbe.student_id = p_student_id
    and bsa.staff_type in ('hod', 'mentor', 'trainer');
$$;

grant execute on function public.student_assigned_mentor_ids(uuid) to authenticated;
grant execute on function public.student_assigned_mentor_ids(uuid) to service_role;

create or replace function public.sync_mentor_average_rating(p_mentor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg numeric(3, 2);
begin
  select round(avg(rating)::numeric, 2)
  into v_avg
  from public.mentor_ratings
  where mentor_id = p_mentor_id;

  update public.mentor_details
  set average_rating = v_avg,
      updated_at = now()
  where profile_id = p_mentor_id;
end;
$$;

grant execute on function public.sync_mentor_average_rating(uuid) to service_role;

create or replace function public.mentor_ratings_sync_average_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_mentor_average_rating(coalesce(new.mentor_id, old.mentor_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists mentor_ratings_sync_average on public.mentor_ratings;
create trigger mentor_ratings_sync_average
  after insert or update or delete on public.mentor_ratings
  for each row execute function public.mentor_ratings_sync_average_trigger();

create or replace function public.get_my_mentor_rating_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_avg numeric(3, 2);
  v_total bigint;
  v_dist jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object('average_rating', null, 'total_ratings', 0, 'distribution', '{}'::jsonb);
  end if;

  if not (
    public.is_super_admin(v_user_id)
    or public.user_has_permission('ratings.view', v_user_id)
  ) then
    return jsonb_build_object('average_rating', null, 'total_ratings', 0, 'distribution', '{}'::jsonb);
  end if;

  select round(avg(rating)::numeric, 2), count(*)
  into v_avg, v_total
  from public.mentor_ratings
  where mentor_id = v_user_id;

  select coalesce(
    jsonb_object_agg(rating::text, rating_count),
    '{}'::jsonb
  )
  into v_dist
  from (
    select rating, count(*) as rating_count
    from public.mentor_ratings
    where mentor_id = v_user_id
    group by rating
  ) grouped;

  return jsonb_build_object(
    'average_rating', v_avg,
    'total_ratings', coalesce(v_total, 0),
    'distribution', coalesce(v_dist, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.get_my_mentor_rating_summary() to authenticated;

alter table public.complaints enable row level security;
alter table public.mentor_ratings enable row level security;

drop policy if exists "complaints_select_scoped" on public.complaints;
create policy "complaints_select_scoped"
  on public.complaints for select to authenticated
  using (
    public.is_super_admin()
    or (
      student_id = public.student_id_for_profile()
      and public.user_has_permission('complaints.view')
    )
    or (
      public.user_has_permission('complaints.view')
      and (
        public.has_all_branch_scope()
        or branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "complaints_insert_student" on public.complaints;
create policy "complaints_insert_student"
  on public.complaints for insert to authenticated
  with check (
    student_id = public.student_id_for_profile()
    and public.user_has_permission('complaints.create')
    and exists (
      select 1
      from public.student_assigned_mentor_ids(student_id) sam
      where sam.mentor_id = complaints.mentor_id
        and sam.batch_id = complaints.batch_id
        and sam.branch_id = complaints.branch_id
        and sam.mentor_staff_type = complaints.mentor_staff_type
    )
  );

drop policy if exists "complaints_update_admin" on public.complaints;
create policy "complaints_update_admin"
  on public.complaints for update to authenticated
  using (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('complaints.edit')
        or public.user_has_permission('complaints.resolve')
      )
      and (
        public.has_all_branch_scope()
        or branch_id in (select public.user_branch_ids())
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      (
        public.user_has_permission('complaints.edit')
        or public.user_has_permission('complaints.resolve')
      )
      and (
        public.has_all_branch_scope()
        or branch_id in (select public.user_branch_ids())
      )
    )
  );

drop policy if exists "mentor_ratings_select_own" on public.mentor_ratings;
create policy "mentor_ratings_select_own"
  on public.mentor_ratings for select to authenticated
  using (
    public.is_super_admin()
    or student_id = public.student_id_for_profile()
  );

drop policy if exists "mentor_ratings_insert_student" on public.mentor_ratings;
create policy "mentor_ratings_insert_student"
  on public.mentor_ratings for insert to authenticated
  with check (
    student_id = public.student_id_for_profile()
    and public.user_has_permission('ratings.submit')
    and exists (
      select 1
      from public.student_assigned_mentor_ids(student_id) sam
      where sam.mentor_id = mentor_ratings.mentor_id
        and sam.batch_id = mentor_ratings.batch_id
        and sam.branch_id = mentor_ratings.branch_id
    )
  );

drop policy if exists "mentor_ratings_update_student" on public.mentor_ratings;
create policy "mentor_ratings_update_student"
  on public.mentor_ratings for update to authenticated
  using (
    student_id = public.student_id_for_profile()
    and public.user_has_permission('ratings.submit')
  )
  with check (
    student_id = public.student_id_for_profile()
    and public.user_has_permission('ratings.submit')
    and exists (
      select 1
      from public.student_assigned_mentor_ids(student_id) sam
      where sam.mentor_id = mentor_ratings.mentor_id
        and sam.batch_id = mentor_ratings.batch_id
        and sam.branch_id = mentor_ratings.branch_id
    )
  );

drop policy if exists "mentor_ratings_delete_student" on public.mentor_ratings;
create policy "mentor_ratings_delete_student"
  on public.mentor_ratings for delete to authenticated
  using (
    student_id = public.student_id_for_profile()
    and public.user_has_permission('ratings.submit')
  );

drop trigger if exists complaints_updated_at on public.complaints;
create trigger complaints_updated_at before update on public.complaints
  for each row execute function public.set_updated_at();

drop trigger if exists mentor_ratings_updated_at on public.mentor_ratings;
create trigger mentor_ratings_updated_at before update on public.mentor_ratings
  for each row execute function public.set_updated_at();

grant select, insert, update on public.complaints to authenticated;
grant select, insert, update, delete on public.mentor_ratings to authenticated;

commit;
