'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  fetchCourseList,
  type CourseFilter,
  type CourseListRow,
} from '@/lib/data/courses'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'

export function useCourseList(filter: CourseFilter = 'all') {
  const { activeBranchId, activeBranch, loading: branchLoading } = useBranchScope()

  const [courses, setCourses] = useState<CourseListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!activeBranchId) {
      setCourses([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await fetchCourseList(
        activeBranchId,
        filter === 'all' ? undefined : filter,
      )
      setCourses(result.data)

      if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load courses.')
    } finally {
      setLoading(false)
    }
  }, [activeBranchId, filter])

  useEffect(() => {
    if (branchLoading) return
    void reload()
  }, [branchLoading, reload])

  return {
    courses,
    activeBranchId,
    activeBranch,
    branchLoading,
    loading: loading || branchLoading,
    error,
    reload,
  }
}
