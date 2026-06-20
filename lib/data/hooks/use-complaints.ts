'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchComplaints, type ComplaintListRow } from '@/lib/data/complaints'

export function useComplaints(branchId?: string | null) {
  const [complaints, setComplaints] = useState<ComplaintListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchComplaints({ branchId: branchId || null })
      setComplaints(result.data)

      if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load complaints.')
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    complaints,
    loading,
    error,
    reload,
  }
}
