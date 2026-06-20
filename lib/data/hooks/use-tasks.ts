'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  fetchTaskList,
  fetchStudentIdByProfileId,
  type TaskBatchLookup,
  type TaskListRow,
} from '@/lib/data/tasks'

export function useTasks(
  batchIds: string[],
  options?: {
    batchLookup?: Map<string, TaskBatchLookup>
    studentProfileId?: string | null
    isStudent?: boolean
  },
) {
  const [tasks, setTasks] = useState<TaskListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const batchKey = batchIds.join(',')

  const reload = useCallback(async () => {
    if (!batchKey) {
      setTasks([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const studentId =
        options?.isStudent && options.studentProfileId
          ? await fetchStudentIdByProfileId(options.studentProfileId)
          : null

      const result = await fetchTaskList(batchKey.split(',').filter(Boolean), {
        batchLookup: options?.batchLookup,
        studentId,
      })

      setTasks(result.data)

      if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks.')
    } finally {
      setLoading(false)
    }
  }, [batchKey, options?.batchLookup, options?.isStudent, options?.studentProfileId])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    tasks,
    loading,
    error,
    reload,
  }
}
