'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchBatchList, type BatchListRow } from '@/lib/data/batches'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'

export function useBatchList() {
  const { activeBranchId, activeBranch, loading: branchLoading } = useBranchScope()

  const [batches, setBatches] = useState<BatchListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!activeBranchId) {
      setBatches([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await fetchBatchList(activeBranchId)
      setBatches(result.data)

      if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load batches.')
    } finally {
      setLoading(false)
    }
  }, [activeBranchId])

  useEffect(() => {
    if (branchLoading) return
    void reload()
  }, [branchLoading, reload])

  return {
    batches,
    activeBranchId,
    activeBranch,
    branchLoading,
    loading: loading || branchLoading,
    error,
    reload,
  }
}
