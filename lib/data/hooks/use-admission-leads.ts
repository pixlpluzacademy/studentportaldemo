'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchAdmissionLeads,
  type AdmissionLeadRow,
  type AdmissionLeadSource,
  type AdmissionLeadStatus,
} from '@/lib/data/admission-leads'

export function useAdmissionLeads(options?: {
  search?: string
  source?: AdmissionLeadSource | 'all'
  status?: AdmissionLeadStatus | 'all'
}) {
  const [leads, setLeads] = useState<AdmissionLeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const search = options?.search?.trim().toLowerCase() || ''
  const source = options?.source || 'all'
  const status = options?.status || 'all'

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchAdmissionLeads({ source, status })
      setLeads(result.data)
      if (result.error) setError(result.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admission leads.')
    } finally {
      setLoading(false)
    }
  }, [source, status])

  useEffect(() => {
    void reload()
  }, [reload])

  const filteredLeads = useMemo(() => {
    if (!search) return leads
    return leads.filter((row) => {
      const haystack = [
        row.fullName,
        row.email,
        row.phone,
        row.city,
        row.interest,
        row.message,
        row.note,
        row.source,
        row.status,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(search)
    })
  }, [leads, search])

  return { leads: filteredLeads, loading, error, reload }
}
