import type { DataResult } from '@/lib/data/config'
import { createClient } from '@/lib/supabase/client'

export type AdmissionLeadSource = 'home' | 'contact' | 'website'

export type AdmissionLeadStatus =
  | 'new_request'
  | 'follow_up'
  | 'interested'
  | 'candidate'
  | 'not_interested'

export const ADMISSION_LEAD_STATUSES: {
  value: AdmissionLeadStatus
  label: string
  meaning: string
}[] = [
  {
    value: 'new_request',
    label: 'New Request',
    meaning: 'Enquiry received and not yet contacted',
  },
  {
    value: 'follow_up',
    label: 'Follow-up',
    meaning: 'Contacted, but another call is required',
  },
  {
    value: 'interested',
    label: 'Interested',
    meaning: 'Person showed interest',
  },
  {
    value: 'candidate',
    label: 'Candidate',
    meaning: 'Confirmed and moved to the candidate process',
  },
  {
    value: 'not_interested',
    label: 'Not Interested',
    meaning: 'Not interested, unreachable, invalid, or no further action',
  },
]

export type AdmissionLeadRow = {
  id: string
  source: AdmissionLeadSource | string
  fullName: string
  email: string
  phone: string
  city: string
  interest: string
  message: string
  status: AdmissionLeadStatus
  note: string
  createdAt: string
  updatedAt: string
}

type DbAdmissionEnquiryRow = {
  id: string
  source: string
  full_name: string
  email: string
  phone: string | null
  city: string | null
  interest: string | null
  message: string | null
  status: string | null
  note: string | null
  created_at: string
  updated_at: string | null
}

function isAdmissionLeadStatus(value: string): value is AdmissionLeadStatus {
  return ADMISSION_LEAD_STATUSES.some((item) => item.value === value)
}

export function admissionLeadStatusLabel(status: string) {
  return ADMISSION_LEAD_STATUSES.find((item) => item.value === status)?.label || status
}

function mapRow(row: DbAdmissionEnquiryRow): AdmissionLeadRow {
  const status =
    row.status && isAdmissionLeadStatus(row.status) ? row.status : 'new_request'

  return {
    id: row.id,
    source: row.source,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone || '',
    city: row.city || '',
    interest: row.interest || '',
    message: row.message || '',
    status,
    note: row.note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  }
}

export async function fetchAdmissionLeads(options?: {
  search?: string
  source?: AdmissionLeadSource | 'all'
  status?: AdmissionLeadStatus | 'all'
}): Promise<DataResult<AdmissionLeadRow[]>> {
  const supabase = createClient()
  const search = options?.search?.trim().toLowerCase() || ''
  const source = options?.source && options.source !== 'all' ? options.source : null
  const status = options?.status && options.status !== 'all' ? options.status : null

  let query = supabase
    .from('admission_enquiry')
    .select(
      'id, source, full_name, email, phone, city, interest, message, status, note, created_at, updated_at',
    )
    .order('created_at', { ascending: false })

  if (source) {
    query = query.eq('source', source)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return { data: [], source: 'supabase', error: error.message }
  }

  let rows = ((data || []) as DbAdmissionEnquiryRow[]).map(mapRow)

  if (search) {
    rows = rows.filter((row) => {
      const haystack = [
        row.fullName,
        row.email,
        row.phone,
        row.city,
        row.interest,
        row.message,
        row.note,
        row.source,
        admissionLeadStatusLabel(row.status),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(search)
    })
  }

  return { data: rows, source: 'supabase', error: null }
}

export async function fetchAdmissionLeadById(
  id: string,
): Promise<DataResult<AdmissionLeadRow | null>> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('admission_enquiry')
    .select(
      'id, source, full_name, email, phone, city, interest, message, status, note, created_at, updated_at',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return { data: null, source: 'supabase', error: error.message }
  }

  if (!data) {
    return { data: null, source: 'supabase', error: 'Lead not found.' }
  }

  return {
    data: mapRow(data as DbAdmissionEnquiryRow),
    source: 'supabase',
    error: null,
  }
}

export async function updateAdmissionLead(
  id: string,
  input: {
    status: AdmissionLeadStatus
    note: string
  },
): Promise<DataResult<AdmissionLeadRow | null>> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('admission_enquiry')
    .update({
      status: input.status,
      note: input.note.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(
      'id, source, full_name, email, phone, city, interest, message, status, note, created_at, updated_at',
    )
    .maybeSingle()

  if (error) {
    return { data: null, source: 'supabase', error: error.message }
  }

  if (!data) {
    return { data: null, source: 'supabase', error: 'Lead not found or update was blocked.' }
  }

  return {
    data: mapRow(data as DbAdmissionEnquiryRow),
    source: 'supabase',
    error: null,
  }
}
