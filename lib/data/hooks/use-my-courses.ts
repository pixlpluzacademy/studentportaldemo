'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchMyCourses, isStudentMyCoursesView, type MyCourseRow } from '@/lib/data/my-courses'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'

type UseMyCoursesOptions = {
  parentRoleId: string | null
  userId?: string | null
}

export function useMyCourses({ parentRoleId, userId }: UseMyCoursesOptions) {
  const { activeBranchId, loading: branchLoading } = useBranchScope()

  const [courses, setCourses] = useState<MyCourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isStudent = isStudentMyCoursesView(parentRoleId)

  const reload = useCallback(async () => {
    if (!userId) {
      setCourses([])
      setError(null)
      setLoading(false)
      return
    }

    if (!isStudent && !activeBranchId) {
      setCourses([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await fetchMyCourses({
        branchId: activeBranchId || '',
        userId,
        parentRoleId,
      })

      setCourses(result.data)

      if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load courses.')
    } finally {
      setLoading(false)
    }
  }, [activeBranchId, isStudent, parentRoleId, userId])

  useEffect(() => {
    if (!isStudent && branchLoading) return
    void reload()
  }, [branchLoading, isStudent, reload])

  return {
    courses,
    activeBranchId,
    loading: isStudent ? loading : loading || branchLoading,
    error,
    reload,
  }
}
