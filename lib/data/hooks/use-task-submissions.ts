'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  fetchTaskSubmissions,
  type TaskSubmissionListRow,
} from '@/lib/data/task-submissions'
import type { TaskBatchLookup } from '@/lib/data/tasks'

export function useTaskSubmissions(batchLookup?: Map<string, TaskBatchLookup>) {
  const [submissions, setSubmissions] = useState<TaskSubmissionListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchTaskSubmissions({ batchLookup })
      setSubmissions(result.data)

      if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task submissions.')
    } finally {
      setLoading(false)
    }
  }, [batchLookup])

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
