'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { storageKeys } from '@/lib/branding'
import { resolveHasAllBranchAccess } from '@/lib/auth/branch-access'
import { useAuth } from '@/lib/auth/provider'
import { useBranchNav } from '@/lib/data/hooks/use-branches'
import type { BranchNavItem } from '@/lib/data/branches'

type ActiveBranchContextValue = {
  activeBranchId: string | null
  activeBranch: BranchNavItem | null
  allowedBranches: BranchNavItem[]
  hasAllBranchAccess: boolean
  loading: boolean
  setActiveBranchId: (branchId: string) => void
}

const ActiveBranchContext = createContext<ActiveBranchContextValue | null>(null)

export function ActiveBranchProvider({ children }: { children: React.ReactNode }) {
  const { user, role, parentRoleId, can } = useAuth()
  const { branches: branchNavItems, loading: branchesLoading } = useBranchNav()

  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const hasAllBranchAccess = useMemo(
    () =>
      resolveHasAllBranchAccess({
        parentRoleId,
        branchId: user?.branchId ?? null,
        legacyRoleId: role?.id ?? null,
        canSwitchBranches: can('branches.switch'),
      }),
    [can, parentRoleId, role?.id, user?.branchId],
  )

  const allowedBranches = useMemo(() => {
    if (!user || hasAllBranchAccess) return branchNavItems
    if (!user.branchId) return branchNavItems
    return branchNavItems.filter((branch) => branch.id === user.branchId)
  }, [branchNavItems, hasAllBranchAccess, user])

  const setActiveBranchId = useCallback((branchId: string) => {
    setActiveBranchIdState(branchId)
    localStorage.setItem(storageKeys.activeBranch, branchId)
  }, [])

  useEffect(() => {
    const savedBranch = localStorage.getItem(storageKeys.activeBranch)
    if (savedBranch) {
      setActiveBranchIdState(savedBranch)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated || !allowedBranches.length) return

    const isValid = activeBranchId
      ? allowedBranches.some((branch) => branch.id === activeBranchId)
      : false

    if (!isValid) {
      setActiveBranchId(allowedBranches[0].id)
    }
  }, [activeBranchId, allowedBranches, hydrated, setActiveBranchId])

  const activeBranch = useMemo(() => {
    if (!activeBranchId) return allowedBranches[0] || null
    return allowedBranches.find((branch) => branch.id === activeBranchId) || allowedBranches[0] || null
  }, [activeBranchId, allowedBranches])

  const value = useMemo<ActiveBranchContextValue>(
    () => ({
      activeBranchId: activeBranch?.id || null,
      activeBranch,
      allowedBranches,
      hasAllBranchAccess,
      loading: branchesLoading || !hydrated,
      setActiveBranchId,
    }),
    [
      activeBranch,
      allowedBranches,
      branchesLoading,
      hasAllBranchAccess,
      hydrated,
      setActiveBranchId,
    ],
  )

  return <ActiveBranchContext.Provider value={value}>{children}</ActiveBranchContext.Provider>
}

export function useActiveBranch() {
  const context = useContext(ActiveBranchContext)
  if (!context) {
    throw new Error('useActiveBranch must be used inside ActiveBranchProvider')
  }
  return context
}
