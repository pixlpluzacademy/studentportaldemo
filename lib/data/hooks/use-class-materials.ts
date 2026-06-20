'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  fetchClassMaterials,
  type ClassMaterialBatchLookup,
  type ClassMaterialRow,
} from '@/lib/data/class-materials'

export function useClassMaterials(batchLookup?: Map<string, ClassMaterialBatchLookup>) {
  const [materials, setMaterials] = useState<ClassMaterialRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchClassMaterials({ batchLookup })
      setMaterials(result.data)

      if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load class materials.')
    } finally {
      setLoading(false)
    }
  }, [batchLookup])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    materials,
    loading,
    error,
    reload,
  }
}
