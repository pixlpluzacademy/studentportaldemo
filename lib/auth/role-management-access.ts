/** System profiles only Super Admin may edit, delete, or assign. */
export const ELEVATED_PROFILE_SLUGS = new Set(['super_admin_full', 'company_admin_default'])

export function isSuperAdminParentRole(parentRoleId?: string | null) {
  return parentRoleId === 'super_admin'
}

export function isElevatedPermissionProfile(profile: {
  slug: string
  parent_role_id?: string
}) {
  if (ELEVATED_PROFILE_SLUGS.has(profile.slug)) return true
  if (profile.parent_role_id === 'super_admin') return true
  return false
}

export function canManagePermissionProfile(
  actorParentRoleId: string | null | undefined,
  profile: { slug: string; parent_role_id?: string },
) {
  if (!isElevatedPermissionProfile(profile)) return true
  return actorParentRoleId === 'super_admin'
}

export function canCreateProfileUnderParent(
  actorParentRoleId: string | null | undefined,
  parentRoleId: string,
) {
  if (parentRoleId === 'super_admin' || parentRoleId === 'company_admin') {
    return actorParentRoleId === 'super_admin'
  }
  return true
}
