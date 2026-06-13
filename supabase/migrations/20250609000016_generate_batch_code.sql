-- Atomic batch code: {BRANCH_CODE}{DEPT_CODE}{ON|OS}{MMYY}B{n}
-- Example: KOCWDON0626B2
-- Run after 20250609000015_departments_department_code.sql

create or replace function public.generate_batch_code(
  p_branch_id uuid,
  p_course_id uuid,
  p_mode public.batch_mode,
  p_start_date date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_code text;
  v_dept_code text;
  v_mode_code text;
  v_mmyy text;
  v_prefix text;
  v_next integer;
begin
  if p_start_date is null then
    raise exception 'Batch start date is required for code generation';
  end if;

  select upper(trim(b.code))
  into v_branch_code
  from public.branches b
  where b.id = p_branch_id;

  if v_branch_code is null or v_branch_code = '' then
    raise exception 'Branch code is required. Set it on the branch before creating batches.';
  end if;

  select upper(trim(d.department_code))
  into v_dept_code
  from public.courses c
  join public.departments d on d.id = c.department_id
  where c.id = p_course_id;

  if v_dept_code is null or v_dept_code = '' then
    raise exception 'Department code is required. Set it on the department before creating batches.';
  end if;

  v_mode_code := case when p_mode = 'online'::public.batch_mode then 'ON' else 'OS' end;
  v_mmyy := to_char(p_start_date, 'MMYY');
  v_prefix := v_branch_code || v_dept_code || v_mode_code || v_mmyy;

  select coalesce(
    max(
      nullif(
        regexp_replace(b.code, '^' || v_prefix || 'B([0-9]+)$', '\1'),
        b.code
      )::integer
    ),
    0
  ) + 1
  into v_next
  from public.batches b
  where b.code like v_prefix || 'B%';

  return v_prefix || 'B' || v_next::text;
end;
$$;

grant execute on function public.generate_batch_code(uuid, uuid, public.batch_mode, date) to authenticated;
grant execute on function public.generate_batch_code(uuid, uuid, public.batch_mode, date) to service_role;
