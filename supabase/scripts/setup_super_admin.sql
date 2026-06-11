-- Run AFTER migrations, in Supabase SQL Editor.
-- 1. Create the user in Authentication → Users (email + password).
--    (The auth trigger will temporarily assign student_default — this script fixes that.)
-- 2. Replace the email below and run this script once.

do $$
declare
  v_user_id uuid;
  v_profile_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower('pixlpluz@gmail.com')
  limit 1;

  if v_user_id is null then
    raise exception 'Create the Supabase Auth user first, then update the email in this script.';
  end if;

  select id into v_profile_id
  from public.permission_profiles
  where slug = 'super_admin_full';

  if v_profile_id is null then
    raise exception 'super_admin_full profile not found. Run foundation migration first.';
  end if;

  -- Auth trigger may have assigned student_default as primary — clear before re-assigning.
  delete from public.user_permission_profiles
  where user_id = v_user_id;

  update public.profiles
  set
    parent_role_id = 'super_admin',
    status = 'active'
  where id = v_user_id;

  insert into public.user_permission_profiles (user_id, profile_id, is_primary)
  values (v_user_id, v_profile_id, true);

  raise notice 'Super Admin configured for user %', v_user_id;
end;
$$;
