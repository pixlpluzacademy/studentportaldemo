-- Student code format: {BATCH_CODE}S{n}
-- Example: KOCDMOS0726B1S1 (no hyphen, no zero padding)

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

  return v_batch_code || 'S' || v_next::text;
end;
$$;

grant execute on function public.generate_student_code(uuid) to authenticated;
