import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataResult } from '@/lib/data/config'
import { createClient } from '@/lib/supabase/client'

export type BatchStudentRow = {
  id: string
  profile_id: string | null
  full_name: string
  email: string
  student_code: string
  phone: string
  joining_date: string | null
  status: string
  avatar_url: string | null
}

export type StudentUiStatus = 'active' | 'inactive' | 'completed' | 'archived'

export type StudentListRow = {
  id: string
  profile_id: string | null
  full_name: string
  email: string
  student_code: string
  phone: string
  joining_date: string | null
  status: StudentUiStatus
  avatar_url: string | null
  batch_id: string
  batch_name: string
  batch_code: string | null
  course_name: string
  branch_id: string
  attendance: string
  grade: string
  placement: string
}

export type FetchStudentListOptions = {
  branchId?: string | null
  /** When set, only students enrolled in batches assigned to this staff user. */
  staffUserId?: string | null
}

type DbStudentProfileRow = {
  full_name: string
  email: string
  avatar_url: string | null
}

type DbEnrollmentStudentRow = {
  id: string
  profile_id: string | null
  student_code: string
  phone: string | null
  joining_date: string | null
  status: string
  profile_picture_url: string | null
  profile: DbStudentProfileRow | DbStudentProfileRow[] | null
}

type DbEnrollmentRow = {
  student: DbEnrollmentStudentRow | DbEnrollmentStudentRow[] | null
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] || null : value
}

function mapEnrollmentToStudentRow(row: DbEnrollmentRow): BatchStudentRow | null {
  const student = unwrap(row.student)
  if (!student) return null

  const profile = unwrap(student.profile)

  return {
    id: student.id,
    profile_id: student.profile_id,
    full_name: profile?.full_name || 'Unknown',
    email: profile?.email || '—',
    student_code: student.student_code,
    phone: student.phone?.trim() || 'Not added',
    joining_date: student.joining_date ? student.joining_date.slice(0, 10) : null,
    status: student.status,
    avatar_url: student.profile_picture_url || profile?.avatar_url || null,
  }
}

type DbStudentListBatchRow = {
  id: string
  name: string
  code: string | null
  branch_id: string
  course: { name: string } | { name: string }[] | null
}

type DbStudentListEnrollmentRow = {
  student: DbEnrollmentStudentRow | DbEnrollmentStudentRow[] | null
  batch: DbStudentListBatchRow | DbStudentListBatchRow[] | null
}

function mapStudentStatus(status: string): StudentUiStatus {
  if (status === 'active') return 'active'
  if (status === 'inactive') return 'inactive'
  if (status === 'archived') return 'archived'
  return 'completed'
}

function mapEnrollmentToStudentListRow(row: DbStudentListEnrollmentRow): StudentListRow | null {
  const student = unwrap(row.student)
  const batch = unwrap(row.batch)
  if (!student || !batch) return null

  const profile = unwrap(student.profile)
  const course = unwrap(batch.course)

  return {
    id: student.id,
    profile_id: student.profile_id,
    full_name: profile?.full_name || 'Unknown',
    email: profile?.email || '—',
    student_code: student.student_code,
    phone: student.phone?.trim() || 'Not added',
    joining_date: student.joining_date ? student.joining_date.slice(0, 10) : null,
    status: mapStudentStatus(student.status),
    avatar_url: student.profile_picture_url || profile?.avatar_url || null,
    batch_id: batch.id,
    batch_name: batch.name,
    batch_code: batch.code,
    course_name: course?.name || '—',
    branch_id: batch.branch_id,
    attendance: '—',
    grade: '—',
    placement: 'Not Started',
  }
}

export function hasBranchWideStudentAccess(parentRoleId: string | null | undefined) {
  return (
    parentRoleId === 'super_admin' ||
    parentRoleId === 'company_admin' ||
    parentRoleId === 'branch_admin'
  )
}

export function isStaffScopedStudentView(parentRoleId: string | null | undefined) {
  return parentRoleId === 'mentor'
}

export async function fetchStaffAssignedBatchIds(
  userId: string,
  branchId?: string | null,
  supabase?: SupabaseClient,
): Promise<string[]> {
  const client = supabase ?? createClient()

  const { data, error } = await client
    .from('batch_staff_assignments')
    .select(
      `
      batch_id,
      batch:batches!inner (
        branch_id
      )
    `,
    )
    .eq('user_id', userId)

  if (error || !data?.length) return []

  type StaffBatchRow = {
    batch_id: string
    batch: { branch_id: string } | { branch_id: string }[] | null
  }

  return (data as StaffBatchRow[])
    .filter((row) => {
      if (!branchId) return true
      const batch = unwrap(row.batch)
      return batch?.branch_id === branchId
    })
    .map((row) => row.batch_id)
}

async function fetchBatchIdsInBranch(branchId: string, supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('batches').select('id').eq('branch_id', branchId)

  if (error || !data?.length) return []

  return data.map((row) => row.id)
}

export async function fetchStudentList(
  options: FetchStudentListOptions = {},
  supabase?: SupabaseClient,
): Promise<DataResult<StudentListRow[]>> {
  const client = supabase ?? createClient()

  try {
    let batchIds: string[] | null = null

    if (options.staffUserId) {
      batchIds = await fetchStaffAssignedBatchIds(options.staffUserId, options.branchId, client)
      if (batchIds.length === 0) {
        return { source: 'supabase', data: [] }
      }
    } else if (options.branchId) {
      batchIds = await fetchBatchIdsInBranch(options.branchId, client)
      if (batchIds.length === 0) {
        return { source: 'supabase', data: [] }
      }
    }

    let query = client
      .from('student_batch_enrollments')
      .select(
        `
        student:students!inner (
          id,
          profile_id,
          student_code,
          phone,
          joining_date,
          status,
          profile_picture_url,
          profile:profiles (
            full_name,
            email,
            avatar_url
          )
        ),
        batch:batches!inner (
          id,
          name,
          code,
          branch_id,
          course:courses!inner (
            name
          )
        )
      `,
      )
      .order('enrolled_at', { ascending: false })

    if (batchIds) {
      query = query.in('batch_id', batchIds)
    }

    const { data, error } = await query

    if (error) {
      return { source: 'supabase', data: [], error: error.message }
    }

    const students = (data as DbStudentListEnrollmentRow[])
      .map(mapEnrollmentToStudentListRow)
      .filter((row): row is StudentListRow => Boolean(row))

    return { source: 'supabase', data: students }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load students.',
    }
  }
}

export async function fetchBatchStudents(
  batchId: string,
  supabase?: SupabaseClient,
): Promise<DataResult<BatchStudentRow[]>> {
  const client = supabase ?? createClient()

  try {
    const { data, error } = await client
      .from('student_batch_enrollments')
      .select(
        `
        student:students!inner (
          id,
          profile_id,
          student_code,
          phone,
          joining_date,
          status,
          profile_picture_url,
          profile:profiles (
            full_name,
            email,
            avatar_url
          )
        )
      `,
      )
      .eq('batch_id', batchId)
      .order('enrolled_at', { ascending: false })

    if (error) {
      return { source: 'supabase', data: [], error: error.message }
    }

    const students = (data as DbEnrollmentRow[])
      .map(mapEnrollmentToStudentRow)
      .filter((row): row is BatchStudentRow => Boolean(row))

    return { source: 'supabase', data: students }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load batch students.',
    }
  }
}

export function generateStudentPassword() {
  return `Welcome@${Math.random().toString(36).slice(2, 10)}`
}

export async function createStudentAccount(
  input: {
    fullName: string
    email: string
    phone: string
    batchId: string
    password: string
  },
  accessToken: string,
): Promise<
  { ok: true; studentCode: string; email: string; password: string } | { ok: false; error: string }
> {
  try {
    const formData = new FormData()
    formData.append('fullName', input.fullName.trim())
    formData.append('email', input.email.trim().toLowerCase())
    formData.append('password', input.password)
    formData.append('phone', input.phone.trim())
    formData.append('batchId', input.batchId)

    const response = await fetch('/api/admin/create-student', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    })

    const payload = (await response.json()) as {
      error?: string
      studentCode?: string
    }

    if (!response.ok) {
      return { ok: false, error: payload.error || 'Could not create student.' }
    }

    if (!payload.studentCode) {
      return { ok: false, error: 'Student created but response was incomplete.' }
    }

    return {
      ok: true,
      studentCode: payload.studentCode,
      email: input.email.trim().toLowerCase(),
      password: input.password,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not create student.',
    }
  }
}
