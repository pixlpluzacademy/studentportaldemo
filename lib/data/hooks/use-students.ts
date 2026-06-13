'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchStudentList, isStaffScopedStudentView, type StudentListRow } from '@/lib/data/students'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'

type UseStudentListOptions = {
  parentRoleId: string | null
  userId?: string | null
}

export function useStudentList({ parentRoleId, userId }: UseStudentListOptions) {
  const { activeBranchId, loading: branchLoading } = useBranchScope()

  const [students, setStudents] = useState<StudentListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const staffScoped = isStaffScopedStudentView(parentRoleId)

  const reload = useCallback(async () => {
    if (!activeBranchId) {
      setStudents([])
      setError(null)
      setLoading(false)
      return
    }

    if (staffScoped && !userId) {
      setStudents([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await fetchStudentList({
        branchId: activeBranchId,
        staffUserId: staffScoped ? userId : null,
      })

      setStudents(result.data)

      if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students.')
    } finally {
      setLoading(false)
    }
  }, [activeBranchId, staffScoped, userId])

  useEffect(() => {
    if (branchLoading) return
    void reload()
  }, [branchLoading, reload])

  return {
    students,
    activeBranchId,
    loading: loading || branchLoading,
    error,
    reload,
    staffScoped,
  }
}
