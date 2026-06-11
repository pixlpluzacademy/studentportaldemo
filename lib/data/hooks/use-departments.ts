'use client'



import { useCallback, useEffect, useState } from 'react'

import {

  fetchDepartmentList,

  type DepartmentListRow,

} from '@/lib/data/departments'

import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'



export function useDepartmentList() {

  const { activeBranchId, activeBranch, loading: branchLoading } = useBranchScope()



  const [departments, setDepartments] = useState<DepartmentListRow[]>([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)



  const reload = useCallback(async () => {

    if (!activeBranchId) {

      setDepartments([])

      setError(null)

      setLoading(false)

      return

    }



    setLoading(true)

    setError(null)



    try {

      const result = await fetchDepartmentList(activeBranchId)

      setDepartments(result.data)



      if (result.error) {

        setError(result.error)

      }

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Failed to load departments.')

    } finally {

      setLoading(false)

    }

  }, [activeBranchId])



  useEffect(() => {

    if (branchLoading) return

    void reload()

  }, [branchLoading, reload])



  return {

    departments,

    activeBranchId,

    activeBranch,

    branchLoading,

    loading: loading || branchLoading,

    error,

    reload,

  }

}

