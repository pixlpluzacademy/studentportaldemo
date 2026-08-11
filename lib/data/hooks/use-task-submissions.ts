'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  fetchTaskSubmissions,
  type TaskSubmissionListRow,
} from '@/lib/data/task-submissions'
import type { TaskBatchLookup } from '@/lib/data/tasks'

export function useTaskSubmissions(
  batchLookup?: Map<string, TaskBatchLookup>,
  options?: { studentId?: string | null; requireStudentId?: boolean },
) {
  const studentId = options?.studentId ?? null
  const requireStudentId = options?.requireStudentId ?? false

  const [submissions, setSubmissions] = useState<TaskSubmissionListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    // Wait until the student id is resolved so we never fetch an unscoped list.
    if (requireStudentId && !studentId) {
      setSubmissions([])
      setLoading(true)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await fetchTaskSubmissions({ batchLookup, studentId })
      setSubmissions(result.data)

      if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task submissions.')
    } finally {
      setLoading(false)
    }
  }, [batchLookup, studentId, requireStudentId])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    submissions,
    loading,
    error,
    reload,
  }
}
