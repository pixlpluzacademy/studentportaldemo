import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataResult } from '@/lib/data/config'
import {
  buildBatchCodePreview,
  parseBatchSchedule,
  type BatchModeCode,
} from '@/lib/data/batch-code'
import type { CourseType } from '@/lib/data/courses'
import { createClient } from '@/lib/supabase/client'

export type BatchUiStatus = 'active' | 'inactive' | 'completed'
export type ClassDayType = 'weekdays' | 'weekend' | 'custom'
export type BatchStaffType = 'hod' | 'mentor' | 'trainer' | 'final_qa'

export type BatchStaffAssignmentRow = {
  id: string
  batch_id: string
  staff_id: string
  staff_name: string
  staff_type: BatchStaffType
  responsibility_title: string
  reports_to_assignment_id: string | null
  reports_to_name: string | null
}


export type BatchListRow = {
  id: string
  name: string
  batch_code: string | null
  description: string | null
  branch_id: string
  branch_name: string
  course_id: string
  course_name: string
  course_type: CourseType
  department_id: string | null
  department_name: string
  department_code: string | null
  batch_mode: BatchModeCode
  class_day_type: ClassDayType
  custom_days: string[]
  batch_start_time: string | null
  batch_end_time: string | null
  duration_months: number
  start_date: string | null
  end_date: string | null
  max_seats: number
  enrolled_count: number
  class_link: string | null
  status: BatchUiStatus
  created_at: string
  staff_assignments: BatchStaffAssignmentRow[]
}

export type BatchDetailRow = BatchListRow

export type BatchFormInput = {
  name: string
  description: string
  course_id: string
  hod_id: string
  trainer_id: string
  start_date: string
  end_date: string
  batch_mode: BatchModeCode
  class_day_type: ClassDayType
  batch_start_time: string
  batch_end_time: string
  max_seats: number
  class_link: string
  status: BatchUiStatus
}

type DbBatchStatus = 'active' | 'full' | 'upcoming' | 'archived'

type DbBatchStaffRow = {
  id: string
  batch_id: string
  user_id: string
  staff_type: BatchStaffType
  reports_to: string | null
  profile: { full_name: string } | { full_name: string }[] | null
  reports_to_profile: { full_name: string } | { full_name: string }[] | null
}

type DbBatchRow = {
  id: string
  branch_id: string
  course_id: string
  name: string
  code: string | null
  mode: BatchModeCode
  schedule: string | null
  seat_capacity: number
  start_date: string | null
  end_date: string | null
  class_day_type: ClassDayType
  class_link: string | null
  status: DbBatchStatus
  created_at: string
  branch: { id: string; name: string; code: string | null } | { id: string; name: string; code: string | null }[]
  course:
    | {
        id: string
        name: string
        course_type: CourseType
        duration_months: number
        department: { id: string; name: string; department_code: string | null } | { id: string; name: string; department_code: string | null }[]
      }
    | {
        id: string
        name: string
        course_type: CourseType
        duration_months: number
        department: { id: string; name: string; department_code: string | null } | { id: string; name: string; department_code: string | null }[]
      }[]
  batch_staff_assignments: DbBatchStaffRow[] | null
  student_batch_enrollments: { id: string }[] | null
}

const batchSelect = `
  id,
  branch_id,
  course_id,
  name,
  code,
  mode,
  schedule,
  seat_capacity,
  start_date,
  end_date,
  class_day_type,
  class_link,
  status,
  created_at,
  branch:branches!inner (
    id,
    name,
    code
  ),
  course:courses!inner (
    id,
    name,
    course_type,
    duration_months,
    department:departments!inner (
      id,
      name,
      department_code
    )
  ),
  batch_staff_assignments (
    id,
    batch_id,
    user_id,
    staff_type,
    reports_to,
    profile:profiles!batch_staff_assignments_user_id_fkey (full_name),
    reports_to_profile:profiles!batch_staff_assignments_reports_to_fkey (full_name)
  ),
  student_batch_enrollments (id)
`

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] || null : value
}

function formatDate(value: string | null | undefined) {
  if (!value) return null
  return value.slice(0, 10)
}

function mapDbStatusToUi(status: DbBatchStatus, enrolledCount: number, maxSeats: number): BatchUiStatus {
  if (status === 'full' || (maxSeats > 0 && enrolledCount >= maxSeats)) {
    return 'completed'
  }

  if (status === 'archived' || status === 'upcoming') {
    return 'inactive'
  }

  return 'active'
}

function mapUiStatusToDb(status: BatchUiStatus): DbBatchStatus {
  if (status === 'completed') return 'full'
  if (status === 'inactive') return 'archived'
  return 'active'
}

function staffTypeLabel(staffType: BatchStaffType) {
  switch (staffType) {
    case 'hod':
      return 'HOD'
    case 'trainer':
      return 'Trainer'
    case 'mentor':
      return 'Mentor'
    case 'final_qa':
      return 'Final QA'
    default:
      return 'Staff'
  }
}

function mapStaffAssignments(rows: DbBatchStaffRow[] | null | undefined): BatchStaffAssignmentRow[] {
  if (!rows?.length) return []

  return rows.map((row) => {
    const profile = unwrap(row.profile)
    const reportsToProfile = unwrap(row.reports_to_profile)

    return {
      id: row.id,
      batch_id: row.batch_id,
      staff_id: row.user_id,
      staff_name: profile?.full_name || 'Unknown',
      staff_type: row.staff_type,
      responsibility_title: staffTypeLabel(row.staff_type),
      reports_to_assignment_id: row.reports_to,
      reports_to_name: reportsToProfile?.full_name || null,
    }
  })
}

function mapDbBatchToListRow(row: DbBatchRow): BatchListRow {
  const branch = unwrap(row.branch)
  const course = unwrap(row.course)
  const department = course ? unwrap(course.department) : null
  const schedule = parseBatchSchedule(row.schedule)
  const enrolledCount = row.student_batch_enrollments?.length || 0
  const maxSeats = row.seat_capacity || 0

  return {
    id: row.id,
    name: row.name,
    batch_code: row.code,
    description: null,
    branch_id: row.branch_id,
    branch_name: branch?.name || 'Branch',
    course_id: row.course_id,
    course_name: course?.name || '—',
    course_type: course?.course_type || 'professional',
    department_id: department?.id || null,
    department_name: department?.name || '—',
    department_code: department?.department_code || null,
    batch_mode: row.mode,
    class_day_type: row.class_day_type,
    custom_days: [],
    batch_start_time: schedule.batch_start_time,
    batch_end_time: schedule.batch_end_time,
    duration_months: course?.duration_months || 1,
    start_date: formatDate(row.start_date),
    end_date: formatDate(row.end_date),
    max_seats: maxSeats,
    enrolled_count: enrolledCount,
    class_link: row.class_link,
    status: mapDbStatusToUi(row.status, enrolledCount, maxSeats),
    created_at: formatDate(row.created_at) || '',
    staff_assignments: mapStaffAssignments(row.batch_staff_assignments),
  }
}

export function batchMatchesBranch(batch: Pick<BatchListRow, 'branch_id'>, branchId?: string | null) {
  if (!branchId) return true
  return batch.branch_id === branchId
}

export function batchVisibleToUser(
  batch: Pick<BatchListRow, 'staff_assignments'>,
  userId: string | undefined,
  hasManagementAccess: boolean,
) {
  if (hasManagementAccess) return true
  if (!userId) return false

  return batch.staff_assignments.some(
    (assignment) =>
      assignment.staff_id === userId || assignment.reports_to_assignment_id === userId,
  )
}

export async function fetchBatchById(
  batchId: string,
  supabase?: SupabaseClient,
): Promise<DataResult<BatchDetailRow | null>> {
  const client = supabase ?? createClient()

  try {
    const { data, error } = await client.from('batches').select(batchSelect).eq('id', batchId).maybeSingle()

    if (error) {
      return { source: 'supabase', data: null, error: error.message }
    }

    if (!data) {
      return { source: 'supabase', data: null }
    }

    return {
      source: 'supabase',
      data: mapDbBatchToListRow(data as DbBatchRow),
    }
  } catch (error) {
    return {
      source: 'supabase',
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load batch.',
    }
  }
}

export async function fetchBatchList(
  branchId?: string | null,
  supabase?: SupabaseClient,
): Promise<DataResult<BatchListRow[]>> {
  const client = supabase ?? createClient()

  try {
    let query = client.from('batches').select(batchSelect).order('created_at', { ascending: false })

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data, error } = await query

    if (error) {
      return { source: 'supabase', data: [], error: error.message }
    }

    return {
      source: 'supabase',
      data: (data as DbBatchRow[]).map(mapDbBatchToListRow),
    }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load batches.',
    }
  }
}

export function previewBatchCode(input: {
  branchCode: string | null | undefined
  departmentCode: string | null | undefined
  mode: BatchModeCode
  startDate: string
  existingCodes?: string[]
}): string {
  return buildBatchCodePreview({
    branchCode: input.branchCode || '',
    departmentCode: input.departmentCode || '',
    mode: input.mode,
    startDate: input.startDate,
    existingCodes: input.existingCodes,
  })
}

export async function createBatchAccount(
  input: BatchFormInput,
  branchId: string,
  accessToken: string,
): Promise<{ ok: true; batchId: string; batchCode: string } | { ok: false; error: string }> {
  try {
    const response = await fetch('/api/admin/create-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        ...input,
        branch_id: branchId,
      }),
    })

    const payload = (await response.json()) as {
      error?: string
      batchId?: string
      batchCode?: string
    }

    if (!response.ok) {
      return { ok: false, error: payload.error || 'Could not create batch.' }
    }

    if (!payload.batchId || !payload.batchCode) {
      return { ok: false, error: 'Batch created but response was incomplete.' }
    }

    return { ok: true, batchId: payload.batchId, batchCode: payload.batchCode }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not create batch.',
    }
  }
}

export { mapUiStatusToDb }
