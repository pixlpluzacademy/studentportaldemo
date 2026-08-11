'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchComplaints, type ComplaintListRow } from '@/lib/data/complaints'

export function useComplaints(options?: {
  branchId?: string | null
  studentId?: string | null
  /** When true, skip fetch until studentId is ready (student My Complaints). */
  requireStudentId?: boolean
}) {
  const branchId = options?.branchId ?? null
  const studentId = options?.studentId ?? null
  const requireStudentId = Boolean(options?.requireStudentId)
  const [complaints, setComplaints] = useState<ComplaintListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (requireStudentId && !studentId) {
      setComplaints([])
      setLoading(true)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await fetchComplaints({
        branchId: studentId ? null : branchId,
        studentId,
      })
      setComplaints(result.data)

      if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load complaints.')
    } finally {
      setLoading(false)
    }
  }, [branchId, requireStudentId, studentId])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    complaints,
    loading: loading || (requireStudentId && !studentId),
    error,
    reload,
  }
}
