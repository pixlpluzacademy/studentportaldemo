import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataResult } from '@/lib/data/config'
import { ensureCourseBlueprintLevels } from '@/lib/data/course-blueprint'
import { createClient } from '@/lib/supabase/client'

export type CourseType = 'basic' | 'advanced' | 'professional'
export type CourseStatus = 'active' | 'inactive' | 'archived'
export type CourseFilter = 'all' | CourseType

export type CourseListRow = {
  id: string
  department_id: string
  department_name: string
  department_code: string | null
  branch_id: string
  name: string
  course_type: CourseType
  duration_months: number
  description: string
  tools: string[]
  modules: string[]
  pass_mark: number
  status: CourseStatus
  created_at: string
  updated_at: string
}

export type CourseFormInput = {
  name: string
  department_id: string
  course_type: CourseType
  description: string
  status: CourseStatus
  tools: string[]
  modules: string[]
  pass_mark: number
}

type DbCourseModuleRow = {
  id: string
  title: string
  sort_order: number
}

type DbDepartmentJoin = {
  id: string
  name: string
  branch_id: string
  department_code: string | null
}

type DbCourseRow = {
  id: string
  department_id: string
  name: string
  course_type: CourseType
  duration_months: number
  description: string | null
  tools: string[] | null
  pass_mark: number | null
  status: CourseStatus
  created_at: string
  updated_at: string
  department: DbDepartmentJoin | DbDepartmentJoin[]
  course_modules: DbCourseModuleRow[] | null
}

export const durationMonthsByType: Record<CourseType, number> = {
  basic: 4,
  advanced: 2,
  professional: 1,
}

export const durationLabelByType: Record<CourseType, string> = {
  basic: '4 Months - 3 Months Course + 1 Month Internship',
  advanced: '2 Months',
  professional: '1 Month',
}

const courseSelect = `
  id,
  department_id,
  name,
  course_type,
  duration_months,
  description,
  tools,
  pass_mark,
  status,
  created_at,
  updated_at,
  department:departments!inner (
    id,
    name,
    branch_id,
    department_code
  ),
  course_modules (
    id,
    title,
    sort_order
  )
`

function formatDate(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10)
  return value.slice(0, 10)
}

function unwrapDepartment(department: DbDepartmentJoin | DbDepartmentJoin[]): DbDepartmentJoin {
  return Array.isArray(department) ? department[0] : department
}

function mapModules(modules: DbCourseModuleRow[] | null | undefined): string[] {
  if (!modules?.length) return []
  return [...modules].sort((a, b) => a.sort_order - b.sort_order).map((item) => item.title)
}

function mapDbCourseToListRow(row: DbCourseRow): CourseListRow {
  const department = unwrapDepartment(row.department)

  return {
    id: row.id,
    department_id: row.department_id,
    department_name: department.name,
    department_code: department.department_code,
    branch_id: department.branch_id,
    name: row.name,
    course_type: row.course_type,
    duration_months: row.duration_months,
    description: row.description || '—',
    tools: row.tools || [],
    modules: mapModules(row.course_modules),
    pass_mark: Number(row.pass_mark ?? 70),
    status: row.status,
    created_at: formatDate(row.created_at),
    updated_at: formatDate(row.updated_at),
  }
}

async function verifyDepartmentInBranch(
  client: SupabaseClient,
  departmentId: string,
  branchId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await client
    .from('departments')
    .select('id, branch_id')
    .eq('id', departmentId)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, error: error?.message || 'Department not found.' }
  }

  if (data.branch_id !== branchId) {
    return { ok: false, error: 'Selected department does not belong to the active branch.' }
  }

  return { ok: true }
}

async function syncCourseModules(
  client: SupabaseClient,
  courseId: string,
  moduleTitles: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: deleteError } = await client.from('course_modules').delete().eq('course_id', courseId)

  if (deleteError) {
    return { ok: false, error: deleteError.message }
  }

  const titles = moduleTitles.map((title) => title.trim()).filter(Boolean)

  if (!titles.length) {
    return { ok: true }
  }

  const { error: insertError } = await client.from('course_modules').insert(
    titles.map((title, index) => ({
      course_id: courseId,
      title,
      sort_order: index,
    })),
  )

  if (insertError) {
    return { ok: false, error: insertError.message }
  }

  return { ok: true }
}

function buildCoursePayload(input: CourseFormInput) {
  return {
    department_id: input.department_id,
    name: input.name.trim(),
    course_type: input.course_type,
    duration_months: durationMonthsByType[input.course_type],
    description: input.description.trim() || null,
    tools: input.tools,
    pass_mark: input.pass_mark,
    status: input.status,
  }
}

export async function fetchCourseList(
  branchId?: string | null,
  courseType?: CourseType,
  supabase?: SupabaseClient,
): Promise<DataResult<CourseListRow[]>> {
  const client = supabase ?? createClient()

  if (!branchId) {
    return { source: 'supabase', data: [] }
  }

  try {
    let query = client
      .from('courses')
      .select(courseSelect)
      .eq('department.branch_id', branchId)
      .order('name')

    if (courseType) {
      query = query.eq('course_type', courseType)
    }

    const { data, error } = await query

    if (error) {
      return { source: 'supabase', data: [], error: error.message }
    }

    return {
      source: 'supabase',
      data: (data as DbCourseRow[]).map(mapDbCourseToListRow),
    }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load courses.',
    }
  }
}

export async function fetchCourseById(
  courseId: string,
  branchId?: string | null,
  supabase?: SupabaseClient,
): Promise<{ ok: true; course: CourseListRow } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  try {
    const { data, error } = await client.from('courses').select(courseSelect).eq('id', courseId).maybeSingle()

    if (error || !data) {
      return { ok: false, error: error?.message || 'Course not found.' }
    }

    const course = mapDbCourseToListRow(data as DbCourseRow)

    if (branchId && course.branch_id !== branchId) {
      return { ok: false, error: 'Course is not available in the selected branch.' }
    }

    return { ok: true, course }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to load course.',
    }
  }
}

export async function createCourseRecord(
  input: CourseFormInput,
  branchId: string,
  supabase?: SupabaseClient,
): Promise<{ ok: true; course: CourseListRow } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  if (!branchId) {
    return { ok: false, error: 'Select a branch before creating a course.' }
  }

  if (!input.department_id) {
    return { ok: false, error: 'Select a department for this course.' }
  }

  try {
    const departmentCheck = await verifyDepartmentInBranch(client, input.department_id, branchId)
    if (!departmentCheck.ok) {
      return departmentCheck
    }

    const { data, error } = await client
      .from('courses')
      .insert(buildCoursePayload(input))
      .select('id')
      .single()

    if (error || !data) {
      return { ok: false, error: error?.message || 'Could not save course.' }
    }

    const syncResult = await syncCourseModules(client, data.id, input.modules)
    if (!syncResult.ok) {
      return syncResult
    }

    const levelsResult = await ensureCourseBlueprintLevels(data.id, client)
    if (!levelsResult.ok) {
      return { ok: false, error: levelsResult.error }
    }

    const loaded = await fetchCourseById(data.id, branchId, client)
    if (!loaded.ok) {
      return loaded
    }

    return { ok: true, course: loaded.course }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not save course.',
    }
  }
}

export async function updateCourseRecord(
  courseId: string,
  input: CourseFormInput,
  branchId: string,
  supabase?: SupabaseClient,
): Promise<{ ok: true; course: CourseListRow } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  if (!branchId) {
    return { ok: false, error: 'Branch is required to update a course.' }
  }

  try {
    const departmentCheck = await verifyDepartmentInBranch(client, input.department_id, branchId)
    if (!departmentCheck.ok) {
      return departmentCheck
    }

    const { error } = await client
      .from('courses')
      .update(buildCoursePayload(input))
      .eq('id', courseId)

    if (error) {
      return { ok: false, error: error.message }
    }

    const syncResult = await syncCourseModules(client, courseId, input.modules)
    if (!syncResult.ok) {
      return syncResult
    }

    const loaded = await fetchCourseById(courseId, branchId, client)
    if (!loaded.ok) {
      return loaded
    }

    return { ok: true, course: loaded.course }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to update course.',
    }
  }
}

export async function deleteCourseRecord(
  courseId: string,
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  try {
    const { error } = await client.from('courses').delete().eq('id', courseId)

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not delete course.',
    }
  }
}

export function courseTypeLabel(type: CourseType) {
  if (type === 'basic') return 'Basic'
  if (type === 'advanced') return 'Advanced'
  return 'Professional'
}

export function shortCourseId(id: string) {
  return id.slice(0, 8).toUpperCase()
}
