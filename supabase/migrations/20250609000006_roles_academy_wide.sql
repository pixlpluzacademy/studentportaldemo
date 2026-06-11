-- Permission profiles are academy-wide (not branch-scoped).

comment on table public.permission_profiles is
  'Academy-wide permission profiles. Not branch-scoped — the same profiles are available for every branch.';

comment on table public.parent_roles is
  'Fixed parent role categories for the LMS. Academy-wide, not branch-scoped.';
