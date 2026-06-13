'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/provider'
import { canManagePermissionProfile } from '@/lib/data/permissions'
import { fetchUserList, type UserListRow } from '@/lib/data/users'
import { fetchAllParentRoles, fetchPermissionProfiles, type PermissionProfileItem, type ParentRoleItem } from '@/lib/data/permissions'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'

export function useUsersData() {
  const {
    activeBranchId,
    activeBranch,
    allowedBranches,
    hasAllBranchAccess,
    loading: branchLoading,
  } = useBranchScope()
  const { parentRoleId } = useAuth()

  const [users, setUsers] = useState<UserListRow[]>([])
  const [permissionProfiles, setPermissionProfiles] = useState<PermissionProfileItem[]>([])
  const [allPermissionProfiles, setAllPermissionProfiles] = useState<PermissionProfileItem[]>([])
  const [parentRoles, setParentRoles] = useState<ParentRoleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    const branchNameMap = new Map(allowedBranches.map((branch) => [branch.id, branch.name]))
    const listBranchId = hasAllBranchAccess ? null : activeBranchId

    try {
      const [usersResult, profilesResult, parentRolesResult] = await Promise.all([
        fetchUserList(listBranchId, branchNameMap),
        fetchPermissionProfiles(),
        fetchAllParentRoles(),
      ])

      setUsers(usersResult.data)

      const visibleProfiles = profilesResult.data.filter((profile) => profile.slug !== 'super_admin_full')
      setAllPermissionProfiles(visibleProfiles)
      setPermissionProfiles(
        visibleProfiles.filter((profile) => canManagePermissionProfile(parentRoleId, profile)),
      )
      setParentRoles(parentRolesResult.data)

      if (usersResult.error) {
        setError(usersResult.error)
      } else if (profilesResult.error) {
        setError(profilesResult.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }, [activeBranchId, allowedBranches, hasAllBranchAccess, parentRoleId])

  useEffect(() => {
    if (branchLoading) return
    void reload()
  }, [branchLoading, reload])

  return {
    users,
    permissionProfiles,
    allPermissionProfiles,
    parentRoles,
    activeBranchId,
    activeBranch,
    allowedBranches,
    hasAllBranchAccess,
    branchLoading,
    loading: loading || branchLoading,
    error,
    reload,
  }
}
