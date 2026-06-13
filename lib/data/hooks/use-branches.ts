'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/provider'
import {
  fetchBranchControllerOptions,
  fetchBranchList,
  fetchBranchNavItems,
  type BranchControllerOption,
  type BranchListRow,
  type BranchNavItem,
} from '@/lib/data/branches'

export function useBranchList() {
  const [branches, setBranches] = useState<BranchListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchBranchList()
      setBranches(result.data)
      if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branches.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { branches, loading, error, reload }
}

export function useBranchNav() {
  const { sessionState, user } = useAuth()
  const [branches, setBranches] = useState<BranchNavItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchBranchNavItems()
      setBranches(result.data)
      if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branches.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionState === 'loading') return
    void reload()
  }, [reload, sessionState, user?.id])

  return { branches, loading, error, reload }
}

export function useBranchControllers() {
  const [controllers, setControllers] = useState<BranchControllerOption[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const options = await fetchBranchControllerOptions()
      setControllers(options)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { controllers, loading, reload }
}
