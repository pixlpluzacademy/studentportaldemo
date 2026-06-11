import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataResult } from '@/lib/data/config'
import { createClient } from '@/lib/supabase/client'

export type BranchUiStatus = 'active' | 'inactive'

export type BranchControllerOption = {
  id: string
  name: string
}

/** Row shape used by /branches page UI */
export type BranchListRow = {
  id: string
  code: string
  branch_name: string
  location: string
  branch_controller: string
  controller_id: string | null
  status: BranchUiStatus
  created_at: string
  updated_at: string
}

/** Minimal shape for header branch switcher */
export type BranchNavItem = {
  id: string
  name: string
  code?: string | null
}

export type BranchFormInput = {
  code: string
  branch_name: string
  location: string
  controller_id: string | null
  status: BranchUiStatus
}

type DbBranchStatus = 'active' | 'upcoming' | 'planning' | 'inactive'

type DbBranchRow = {
  id: string
  name: string
  code: string | null
  location: string | null
  status: DbBranchStatus
  created_at: string
  updated_at: string
  controller_id: string | null
  controller_profile: { full_name: string } | { full_name: string }[] | null
}

const branchSelect = `
  id,
  name,
  code,
  location,
  status,
  controller_id,
  created_at,
  updated_at,
  controller_profile:profiles!branches_controller_id_fkey(full_name)
`

function formatDate(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10)
  return value.slice(0, 10)
}

function mapDbStatusToUi(status: DbBranchStatus): BranchUiStatus {
  return status === 'active' ? 'active' : 'inactive'
}

function mapUiStatusToDb(status: BranchUiStatus): DbBranchStatus {
  return status === 'active' ? 'active' : 'inactive'
}

function mapDbBranchToListRow(row: DbBranchRow): BranchListRow {
  const controller = Array.isArray(row.controller_profile)
    ? row.controller_profile[0]?.full_name
    : row.controller_profile?.full_name

  return {
    id: row.id,
    code: row.code || row.id.slice(0, 8).toUpperCase(),
    branch_name: row.name,
    location: row.location || '—',
    branch_controller: controller || 'Not Assigned',
    controller_id: row.controller_id,
    status: mapDbStatusToUi(row.status),
    created_at: formatDate(row.created_at),
    updated_at: formatDate(row.updated_at),
  }
}

export function mapListRowToNavItem(row: BranchListRow): BranchNavItem {
  return { id: row.id, name: row.branch_name, code: row.code }
}

async function fetchSupabaseBranchRows(
  supabase: SupabaseClient,
): Promise<{ ok: true; rows: BranchListRow[] } | { ok: false; error: string }> {
  const { data, error } = await supabase.from('branches').select(branchSelect).order('name')

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, rows: (data as DbBranchRow[]).map(mapDbBranchToListRow) }
}

export async function fetchBranchList(
  supabase?: SupabaseClient,
): Promise<DataResult<BranchListRow[]>> {
  const client = supabase ?? createClient()

  try {
    const result = await fetchSupabaseBranchRows(client)
    if (result.ok) {
      return { source: 'supabase', data: result.rows }
    }

    return { source: 'supabase', data: [], error: result.error }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load branches.',
    }
  }
}

export async function fetchBranchNavItems(
  supabase?: SupabaseClient,
): Promise<DataResult<BranchNavItem[]>> {
  const list = await fetchBranchList(supabase)
  return {
    source: list.source,
    data: list.data.map(mapListRowToNavItem),
    error: list.error,
  }
}

export async function fetchBranchControllerOptions(
  supabase?: SupabaseClient,
): Promise<BranchControllerOption[]> {
  const client = supabase ?? createClient()

  const { data, error } = await client
    .from('profiles')
    .select('id, full_name')
    .in('parent_role_id', ['branch_admin', 'company_admin'])
    .eq('status', 'active')
    .order('full_name')

  if (error || !data?.length) {
    return []
  }

  return data.map((row) => ({ id: row.id, name: row.full_name }))
}

function normalizeBranchCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20)
}

function slugifyBranchCode(name: string) {
  return normalizeBranchCode(name.replace(/\s+/g, '-')) || 'BRANCH'
}

async function isBranchCodeTaken(
  client: SupabaseClient,
  code: string,
  excludeId?: string,
): Promise<boolean> {
  let query = client.from('branches').select('id').eq('code', code)
  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data } = await query.maybeSingle()
  return Boolean(data)
}

async function resolveBranchCode(
  client: SupabaseClient,
  input: BranchFormInput,
  excludeId?: string,
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const explicit = normalizeBranchCode(input.code)
  const fromName = slugifyBranchCode(input.branch_name)

  let candidate = explicit || fromName
  if (!candidate) {
    return { ok: false, error: 'Branch code is required.' }
  }

  if (!(await isBranchCodeTaken(client, candidate, excludeId))) {
    return { ok: true, code: candidate }
  }

  if (explicit) {
    return { ok: false, error: 'Branch code is already in use.' }
  }

  let suffix = 1
  while (suffix < 20) {
    const next = `${candidate}-${suffix}`
    if (!(await isBranchCodeTaken(client, next, excludeId))) {
      return { ok: true, code: next }
    }
    suffix += 1
  }

  return { ok: false, error: 'Could not generate a unique branch code.' }
}

function buildBranchPayload(input: BranchFormInput, code: string) {
  return {
    name: input.branch_name.trim(),
    code,
    location: input.location.trim(),
    status: mapUiStatusToDb(input.status),
    controller_id: input.controller_id || null,
  }
}

export async function createBranchRecord(
  input: BranchFormInput,
  supabase?: SupabaseClient,
): Promise<{ ok: true; row: BranchListRow } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  try {
    const codeResult = await resolveBranchCode(client, input)
    if (!codeResult.ok) {
      return { ok: false, error: codeResult.error }
    }

    const { data, error } = await client
      .from('branches')
      .insert(buildBranchPayload(input, codeResult.code))
      .select(branchSelect)
      .single()

    if (error || !data) {
      return { ok: false, error: error?.message || 'Could not save branch.' }
    }

    return { ok: true, row: mapDbBranchToListRow(data as DbBranchRow) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not save branch.',
    }
  }
}

export async function updateBranchRecord(
  id: string,
  input: BranchFormInput,
  supabase?: SupabaseClient,
): Promise<{ ok: true; row: BranchListRow } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  try {
    const codeResult = await resolveBranchCode(client, input, id)
    if (!codeResult.ok) {
      return { ok: false, error: codeResult.error }
    }

    const { data, error } = await client
      .from('branches')
      .update(buildBranchPayload(input, codeResult.code))
      .eq('id', id)
      .select(branchSelect)
      .single()

    if (error || !data) {
      return { ok: false, error: error?.message || 'Could not update branch.' }
    }

    return { ok: true, row: mapDbBranchToListRow(data as DbBranchRow) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not update branch.',
    }
  }
}

export async function deleteBranchRecord(
  id: string,
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  try {
    const { error } = await client.from('branches').delete().eq('id', id)

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not delete branch.',
    }
  }
}
