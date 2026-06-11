'use client'

import { useCallback, useMemo } from 'react'
import { useActiveBranch } from '@/lib/data/active-branch-context'
import {
  demoBatchNamesForBranch,
  filterByActiveBranch,
  filterByBatchNames,
  matchesActiveBranch,
} from '@/lib/data/branch-scope'

export function useBranchScope() {
  const {
    activeBranchId,
    activeBranch,
    allowedBranches,
    hasAllBranchAccess,
    loading,
    setActiveBranchId,
  } = useActiveBranch()

  const branchNavIds = useMemo(
    () => allowedBranches.map((branch) => branch.id),
    [allowedBranches],
  )

  const activeDemoBatchNames = useMemo(
    () => demoBatchNamesForBranch(branchNavIds, activeBranchId),
    [activeBranchId, branchNavIds],
  )

  const matchesBranch = useCallback(
    (branchId?: string | null) => matchesActiveBranch(branchId, activeBranchId),
    [activeBranchId],
  )

  const filterByBranch = useCallback(
    <T,>(items: T[], getBranchId: (item: T) => string | null | undefined) =>
      filterByActiveBranch(items, getBranchId, activeBranchId),
    [activeBranchId],
  )

  const filterByActiveBatches = useCallback(
    <T,>(items: T[], getBatchName: (item: T) => string) =>
      filterByBatchNames(items, getBatchName, activeDemoBatchNames),
    [activeDemoBatchNames],
  )

  return {
    activeBranchId,
    activeBranch,
    allowedBranches,
    hasAllBranchAccess,
    loading,
    setActiveBranchId,
    activeDemoBatchNames,
    matchesBranch,
    filterByBranch,
    filterByActiveBatches,
  }
}
