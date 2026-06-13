'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth/provider'
import {
  catalogActions,
  fetchAllParentRoles,
  fetchParentRoles,
  fetchPermissionCatalog,
  fetchPermissionProfiles,
  groupCatalogByModule,
  groupProfilesByParentRole,
  isElevatedPermissionProfile,
  type ParentRoleItem,
  type PermissionCatalogItem,
  type PermissionModuleGroup,
  type PermissionProfileItem,
} from '@/lib/data/permissions'

export function useRoleManagementData() {
  const { parentRoleId } = useAuth()
  const [profiles, setProfiles] = useState<PermissionProfileItem[]>([])
  const [catalog, setCatalog] = useState<PermissionCatalogItem[]>([])
  const [allParentRoles, setAllParentRoles] = useState<ParentRoleItem[]>([])
  const [assignableParentRoles, setAssignableParentRoles] = useState<ParentRoleItem[]>([])
  const [moduleGroups, setModuleGroups] = useState<PermissionModuleGroup[]>([])
  const [actions, setActions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [profileResult, catalogResult, allParentRoleResult, assignableParentRoleResult] =
        await Promise.all([
          fetchPermissionProfiles(),
          fetchPermissionCatalog(),
          fetchAllParentRoles(),
          fetchParentRoles(undefined, { actorParentRoleId: parentRoleId }),
        ])

      if (profileResult.error) setError(profileResult.error)
      if (catalogResult.error) setError(catalogResult.error)
      if (allParentRoleResult.error) setError(allParentRoleResult.error)
      if (assignableParentRoleResult.error) setError(assignableParentRoleResult.error)

      setProfiles(profileResult.data)
      setCatalog(catalogResult.data)
      setAllParentRoles(allParentRoleResult.data)
      setAssignableParentRoles(assignableParentRoleResult.data)
      setModuleGroups(groupCatalogByModule(catalogResult.data))
      setActions(catalogActions(catalogResult.data))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load role management data.')
    } finally {
      setLoading(false)
    }
  }, [parentRoleId])

  useEffect(() => {
    void reload()
  }, [reload])

  const profilesByParentRole = useMemo(
    () => groupProfilesByParentRole(profiles, allParentRoles),
    [profiles, allParentRoles],
  )

  return {
    profiles,
    profilesByParentRole,
    catalog,
    parentRoles: assignableParentRoles,
    allParentRoles,
    moduleGroups,
    actions,
    loading,
    error,
    reload,
  }
}
