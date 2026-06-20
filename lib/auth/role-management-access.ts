/** Profiles that are permanently locked — not editable or assignable from the UI. */
export const IMMUTABLE_SUPER_ADMIN_PROFILE_SLUGS = new Set(['super_admin_full'])

/** Company Admin system profile — only Super Admin may manage (not the Super Admin profile itself). */
export const ELEVATED_PROFILE_SLUGS = new Set(['company_admin_default'])

export function isSuperAdminParentRole(parentRoleId?: string | null) {
  return parentRoleId === 'super_admin'
}

export function isImmutableSuperAdminProfile(profile: {
  slug: string
  parent_role_id?: string
}) {
  return IMMUTABLE_SUPER_ADMIN_PROFILE_SLUGS.has(profile.slug) || profile.parent_role_id === 'super_admin'
}

export function isElevatedPermissionProfile(profile: {
  slug: string
  parent_role_id?: string
}) {
  if (isImmutableSuperAdminProfile(profile)) return true
  if (ELEVATED_PROFILE_SLUGS.has(profile.slug)) return true
  if (profile.parent_role_id === 'company_admin') return true
  return false
}

/** Super Admin profile is never manageable from UI — even by Super Admin. */
export function canManagePermissionProfile(
  actorParentRoleId: string | null | undefined,
  profile: { slug: string; parent_role_id?: string },
) {
  if (isImmutableSuperAdminProfile(profile)) return false
  if (ELEVATED_PROFILE_SLUGS.has(profile.slug) || profile.parent_role_id === 'company_admin') {
    return actorParentRoleId === 'super_admin'
  }
  return true
}

/** Super Admin parent category cannot be used when creating custom profiles. */
export function canCreateProfileUnderParent(
  actorParentRoleId: string | null | undefined,
  parentRoleId: string,
) {
  if (parentRoleId === 'super_admin') return false
  if (parentRoleId === 'company_admin') {
    return actorParentRoleId === 'super_admin'
  }
  return true
}
