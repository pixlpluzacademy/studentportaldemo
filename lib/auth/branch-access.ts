import type { ParentRoleId } from '@/lib/auth/types'

export function resolveHasAllBranchAccess(options: {
  parentRoleId?: ParentRoleId | string | null
  branchId?: string | null
  legacyRoleId?: string | null
  canSwitchBranches: boolean
}) {
  if (options.canSwitchBranches) return true
  if (options.parentRoleId === 'super_admin' || options.parentRoleId === 'company_admin') {
    return true
  }
  if (options.branchId === 'all') return true
  if (options.legacyRoleId === 'superadmin' || options.legacyRoleId === 'admin') {
    return true
  }
  return false
}
