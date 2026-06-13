import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataResult } from '@/lib/data/config'
import { createClient } from '@/lib/supabase/client'

export type DepartmentUiStatus = 'active' | 'inactive'

/** Row shape used by /departments page UI */
export type DepartmentListRow = {
  id: string
  branch_id: string
  name: string
  slug: string
  department_code: string | null
  description: string
  status: DepartmentUiStatus
  created_at: string
  updated_at: string
}

export type DepartmentFormInput = {
  name: string
  department_code: string
  description: string
  status: DepartmentUiStatus
}

type DbDepartmentStatus = 'active' | 'inactive'

type DbDepartmentRow = {
  id: string
  branch_id: string
  name: string
  slug: string
  department_code: string | null
  description: string | null
  status: DbDepartmentStatus
  created_at: string
  updated_at: string
}

const departmentSelect = `
  id,
  branch_id,
  name,
  slug,
  department_code,
  description,
  status,
  created_at,
  updated_at
`

function formatDate(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10)
  return value.slice(0, 10)
}

function mapDbStatusToUi(status: DbDepartmentStatus): DepartmentUiStatus {
  return status === 'active' ? 'active' : 'inactive'
}

function mapUiStatusToDb(status: DepartmentUiStatus): DbDepartmentStatus {
  return status === 'active' ? 'active' : 'inactive'
}

function normalizeDepartmentCode(value: string) {
  return value.trim().toUpperCase()
}

function mapDbDepartmentToListRow(row: DbDepartmentRow): DepartmentListRow {
  return {
    id: row.id,
    branch_id: row.branch_id,
    name: row.name,
    slug: row.slug,
    department_code: row.department_code,
    description: row.description || '—',
    status: mapDbStatusToUi(row.status),
    created_at: formatDate(row.created_at),
    updated_at: formatDate(row.updated_at),
  }
}

async function fetchSupabaseDepartmentRows(
  supabase: SupabaseClient,
  branchId?: string | null,
): Promise<{ ok: true; rows: DepartmentListRow[] } | { ok: false; error: string }> {
  let query = supabase.from('departments').select(departmentSelect).order('name')

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, rows: (data as DbDepartmentRow[]).map(mapDbDepartmentToListRow) }
}

export async function fetchDepartmentList(
  branchId?: string | null,
  supabase?: SupabaseClient,
): Promise<DataResult<DepartmentListRow[]>> {
  const client = supabase ?? createClient()

  try {
    const result = await fetchSupabaseDepartmentRows(client, branchId)

    if (result.ok) {
      return { source: 'supabase', data: result.rows }
    }

    return { source: 'supabase', data: [], error: result.error }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load departments.',
    }
  }
}

function slugifyDepartmentName(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'department'
  )
}

async function isDepartmentSlugTaken(
  client: SupabaseClient,
  slug: string,
  branchId: string,
  excludeId?: string,
): Promise<boolean> {
  let query = client.from('departments').select('id').eq('slug', slug).eq('branch_id', branchId)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data } = await query.maybeSingle()
  return Boolean(data)
}

async function resolveDepartmentSlug(
  client: SupabaseClient,
  input: DepartmentFormInput,
  branchId: string,
  excludeId?: string,
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const baseSlug = slugifyDepartmentName(input.name)

  if (!(await isDepartmentSlugTaken(client, baseSlug, branchId, excludeId))) {
    return { ok: true, slug: baseSlug }
  }

  let suffix = 1

  while (suffix < 20) {
    const nextSlug = `${baseSlug}-${suffix}`

    if (!(await isDepartmentSlugTaken(client, nextSlug, branchId, excludeId))) {
      return { ok: true, slug: nextSlug }
    }

    suffix += 1
  }

  return { ok: false, error: 'Could not generate a unique department slug.' }
}

async function isDepartmentCodeTaken(
  client: SupabaseClient,
  departmentCode: string,
  excludeId?: string,
): Promise<boolean> {
  let query = client
    .from('departments')
    .select('id')
    .eq('department_code', departmentCode)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data } = await query.maybeSingle()
  return Boolean(data)
}

function buildDepartmentPayload(input: DepartmentFormInput, slug: string, branchId: string) {
  const departmentCode = normalizeDepartmentCode(input.department_code)

  return {
    branch_id: branchId,
    name: input.name.trim(),
    slug,
    department_code: departmentCode || null,
    description: input.description.trim() || null,
    status: mapUiStatusToDb(input.status),
  }
}

export async function createDepartmentRecord(
  input: DepartmentFormInput,
  branchId: string,
  supabase?: SupabaseClient,
): Promise<{ ok: true; row: DepartmentListRow } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  if (!branchId) {
    return { ok: false, error: 'Select a branch before creating a department.' }
  }

  try {
    const departmentCode = normalizeDepartmentCode(input.department_code)

    if (!departmentCode) {
      return { ok: false, error: 'Department code is required.' }
    }

    if (await isDepartmentCodeTaken(client, departmentCode)) {
      return { ok: false, error: 'This department code is already in use.' }
    }

    const slugResult = await resolveDepartmentSlug(client, input, branchId)

    if (!slugResult.ok) {
      return { ok: false, error: slugResult.error }
    }

    const { data, error } = await client
      .from('departments')
      .insert(buildDepartmentPayload(input, slugResult.slug, branchId))
      .select(departmentSelect)
      .single()

    if (error || !data) {
      return { ok: false, error: error?.message || 'Could not save department.' }
    }

    return { ok: true, row: mapDbDepartmentToListRow(data as DbDepartmentRow) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not save department.',
    }
  }
}

export async function updateDepartmentRecord(
  id: string,
  input: DepartmentFormInput,
  branchId: string,
  supabase?: SupabaseClient,
): Promise<{ ok: true; row: DepartmentListRow } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  if (!branchId) {
    return { ok: false, error: 'Branch is required to update a department.' }
  }

  try {
    const departmentCode = normalizeDepartmentCode(input.department_code)

    if (!departmentCode) {
      return { ok: false, error: 'Department code is required.' }
    }

    if (await isDepartmentCodeTaken(client, departmentCode, id)) {
      return { ok: false, error: 'This department code is already in use.' }
    }

    const slugResult = await resolveDepartmentSlug(client, input, branchId, id)

    if (!slugResult.ok) {
      return { ok: false, error: slugResult.error }
    }

    const { data, error } = await client
      .from('departments')
      .update(buildDepartmentPayload(input, slugResult.slug, branchId))
      .eq('id', id)
      .eq('branch_id', branchId)
      .select(departmentSelect)
      .single()

    if (error || !data) {
      return { ok: false, error: error?.message || 'Could not update department.' }
    }

    return { ok: true, row: mapDbDepartmentToListRow(data as DbDepartmentRow) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not update department.',
    }
  }
}

export async function deleteDepartmentRecord(
  id: string,
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  try {
    const { error } = await client.from('departments').delete().eq('id', id)

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not delete department.',
    }
  }
}