import { demoModules } from '@/lib/demo/seed'
import type { ModuleId, PermissionKey } from '@/lib/demo/types'

export function getModuleByHref(pathname: string) {
  const matches = demoModules
    .filter((m) => pathname === m.href || pathname.startsWith(`${m.href}/`))
    .sort((a, b) => b.href.length - a.href.length)

  return matches[0] || null
}

export function enabledModulesFromPermissions(permissions: string[]): ModuleId[] {
  const moduleIds = new Set<ModuleId>()
  for (const key of permissions) {
    if (key.endsWith('.view')) {
      moduleIds.add(key.replace('.view', '') as ModuleId)
    }
  }
  return Array.from(moduleIds)
}

export function isSuperAdminParentRole(parentRoleId: string | undefined) {
  return parentRoleId === 'super_admin'
}

export function canPermission(
  permissions: string[],
  parentRoleId: string | undefined,
  permission: PermissionKey | string,
) {
  if (isSuperAdminParentRole(parentRoleId)) return true
  return permissions.includes(permission)
}

export function canModuleAccess(
  permissions: string[],
  parentRoleId: string | undefined,
  moduleId: ModuleId,
) {
  if (isSuperAdminParentRole(parentRoleId)) return true
  return (
    enabledModulesFromPermissions(permissions).includes(moduleId) &&
    permissions.includes(`${moduleId}.view`)
  )
}
