'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchCourseBlueprint, type CourseBlueprint } from '@/lib/data/course-blueprint'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'

export function useCourseDetail(courseId: string) {
  const { activeBranchId, activeBranch, loading: branchLoading } = useBranchScope()

  const [course, setCourse] = useState<CourseBlueprint | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!courseId) {
      setCourse(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await fetchCourseBlueprint(courseId, activeBranchId)

      if (!result.ok) {
        setCourse(null)
        setError(result.error)
        return
      }

      setCourse(result.course)
    } catch (err) {
      setCourse(null)
      setError(err instanceof Error ? err.message : 'Failed to load course.')
    } finally {
      setLoading(false)
    }
  }, [activeBranchId, courseId])

  useEffect(() => {
    if (branchLoading) return
    void reload()
  }, [branchLoading, reload])

  return {
    course,
    activeBranchId,
    activeBranch,
    branchLoading,
    loading: loading || branchLoading,
    error,
    reload,
  }
}
