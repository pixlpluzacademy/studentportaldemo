import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataResult } from '@/lib/data/config'
import { createClient } from '@/lib/supabase/client'
import { fetchStudentIdByProfileId } from '@/lib/data/tasks'

export type ComplaintStatus = 'Open' | 'In Review' | 'Resolved' | 'Rejected'
export type ComplaintPriority = 'Low' | 'Medium' | 'High' | 'Urgent'

export type StudentAssignedMentor = {
  mentorId: string
  mentorName: string
  staffType: DbStaffType
  staffRoleLabel: string
  batchId: string
  batchName: string
  branchId: string
  branchName: string
}

export type ComplaintListRow = {
  id: string
  studentId: string
  studentName: string
  branchId: string
  branchName: string
  batchId: string
  batchName: string
  mentorId: string
  mentorName: string
  mentorStaffRole: string
  title: string
  category: string
  description: string
  priority: ComplaintPriority
  status: ComplaintStatus
  adminReply: string
  createdDate: string
  updatedDate: string
}

type DbComplaintStatus = 'open' | 'in_review' | 'resolved' | 'rejected'
type DbComplaintPriority = 'low' | 'medium' | 'high' | 'urgent'
type DbStaffType = 'hod' | 'mentor' | 'trainer' | 'final_qa'

type DbComplaintRow = {
  id: string
  student_id: string
  mentor_id: string
  branch_id: string
  batch_id: string
  mentor_staff_type: DbStaffType
  title: string
  category: string
  description: string
  priority: DbComplaintPriority
  status: DbComplaintStatus
  admin_reply: string | null
  created_at: string
  updated_at: string
  student:
    | { profile: { full_name: string | null } | { full_name: string | null }[] | null }
    | { profile: { full_name: string | null } | { full_name: string | null }[] | null }[]
    | null
  mentor: { full_name: string | null } | { full_name: string | null }[] | null
  branch: { name: string | null } | { name: string | null }[] | null
  batch: { name: string | null } | { name: string | null }[] | null
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] || null : value
}

const COMPLAINT_STAFF_TYPES: DbStaffType[] = ['hod', 'mentor', 'trainer']

function batchStaffComplaintLabel(staffType: DbStaffType): string {
  if (staffType === 'hod') return 'Superior Mentor (HOD)'
  return 'Mentor'
}

function mapStatusLabel(status: DbComplaintStatus): ComplaintStatus {
  if (status === 'in_review') return 'In Review'
  if (status === 'resolved') return 'Resolved'
  if (status === 'rejected') return 'Rejected'
  return 'Open'
}

function mapPriorityLabel(priority: DbComplaintPriority): ComplaintPriority {
  if (priority === 'low') return 'Low'
  if (priority === 'high') return 'High'
  if (priority === 'urgent') return 'Urgent'
  return 'Medium'
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  return value.slice(0, 10)
}

function mapDbComplaintRow(row: DbComplaintRow): ComplaintListRow {
  const student = unwrap(row.student)
  const studentProfile = unwrap(student?.profile)
  const mentor = unwrap(row.mentor)
  const branch = unwrap(row.branch)
  const batch = unwrap(row.batch)

  return {
    id: row.id,
    studentId: row.student_id,
    studentName: studentProfile?.full_name?.trim() || 'Student',
    branchId: row.branch_id,
    branchName: branch?.name?.trim() || 'Branch',
    batchId: row.batch_id,
    batchName: batch?.name?.trim() || 'Batch',
    mentorId: row.mentor_id,
    mentorName: mentor?.full_name?.trim() || 'Mentor',
    mentorStaffRole: batchStaffComplaintLabel(row.mentor_staff_type),
    title: row.title,
    category: row.category,
    description: row.description,
    priority: mapPriorityLabel(row.priority),
    status: mapStatusLabel(row.status),
    adminReply: row.admin_reply?.trim() || '',
    createdDate: formatDate(row.created_at),
    updatedDate: formatDate(row.updated_at),
  }
}

const complaintSelect = `
  id,
  student_id,
  mentor_id,
  branch_id,
  batch_id,
  mentor_staff_type,
  title,
  category,
  description,
  priority,
  status,
  admin_reply,
  created_at,
  updated_at,
  student:students (
    profile:profiles (
      full_name
    )
  ),
  mentor:profiles!complaints_mentor_id_fkey (
    full_name
  ),
  branch:branches (
    name
  ),
  batch:batches (
    name
  )
`

export async function fetchStudentAssignedMentors(
  profileId: string,
  supabase?: SupabaseClient,
): Promise<DataResult<StudentAssignedMentor[]>> {
  const client = supabase ?? createClient()

  try {
    const studentId = await fetchStudentIdByProfileId(profileId, client)

    if (!studentId) {
      return { source: 'supabase', data: [], error: 'Student profile not found.' }
    }

    const { data: enrollments, error: enrollmentError } = await client
      .from('student_batch_enrollments')
      .select(
        `
        batch_id,
        batch:batches (
          id,
          name,
          branch_id,
          branch:branches (
            name
          ),
          batch_staff_assignments (
            user_id,
            staff_type,
            profile:profiles!batch_staff_assignments_user_id_fkey (
              full_name
            )
          )
        )
      `,
      )
      .eq('student_id', studentId)

    if (enrollmentError) {
      return { source: 'supabase', data: [], error: enrollmentError.message }
    }

    const mentors: StudentAssignedMentor[] = []

    for (const enrollment of enrollments || []) {
      const batch = unwrap(enrollment.batch as Parameters<typeof unwrap>[0])
      if (!batch) continue

      const branch = unwrap((batch as { branch?: unknown }).branch as Parameters<typeof unwrap>[0])
      const assignments =
        ((batch as { batch_staff_assignments?: unknown[] }).batch_staff_assignments as Array<{
          user_id: string
          staff_type: DbStaffType
          profile: { full_name: string | null } | { full_name: string | null }[] | null
        }>) || []

      for (const assignment of assignments) {
        if (!COMPLAINT_STAFF_TYPES.includes(assignment.staff_type)) continue

        const profile = unwrap(assignment.profile)

        mentors.push({
          mentorId: assignment.user_id,
          mentorName: profile?.full_name?.trim() || batchStaffComplaintLabel(assignment.staff_type),
          staffType: assignment.staff_type,
          staffRoleLabel: batchStaffComplaintLabel(assignment.staff_type),
          batchId: (batch as { id: string }).id || enrollment.batch_id,
          batchName: (batch as { name?: string }).name?.trim() || 'Batch',
          branchId: (batch as { branch_id: string }).branch_id,
          branchName: (branch as { name?: string } | null)?.name?.trim() || 'Branch',
        })
      }
    }

    const unique = new Map<string, StudentAssignedMentor>()
    mentors.forEach((mentor) => {
      unique.set(`${mentor.batchId}:${mentor.mentorId}:${mentor.staffType}`, mentor)
    })

    const staffTypeOrder: Record<DbStaffType, number> = {
      hod: 0,
      mentor: 1,
      trainer: 2,
      final_qa: 3,
    }

    return {
      source: 'supabase',
      data: Array.from(unique.values()).sort((left, right) => {
        const orderDiff = staffTypeOrder[left.staffType] - staffTypeOrder[right.staffType]
        if (orderDiff !== 0) return orderDiff
        return left.mentorName.localeCompare(right.mentorName)
      }),
    }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load assigned mentors.',
    }
  }
}

export async function fetchComplaints(options?: {
  branchId?: string | null
  /** When set, only return this student's complaints (My Complaints). */
  studentId?: string | null
  supabase?: SupabaseClient
}): Promise<DataResult<ComplaintListRow[]>> {
  const client = options?.supabase ?? createClient()

  try {
    let query = client.from('complaints').select(complaintSelect).order('created_at', { ascending: false })

    if (options?.studentId) {
      query = query.eq('student_id', options.studentId)
    } else if (options?.branchId) {
      query = query.eq('branch_id', options.branchId)
    }

    const { data, error } = await query

    if (error) {
      return { source: 'supabase', data: [], error: error.message }
    }

    return {
      source: 'supabase',
      data: ((data || []) as DbComplaintRow[]).map(mapDbComplaintRow),
    }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load complaints.',
    }
  }
}

export async function createComplaint(
  input: {
    mentorId: string
    batchId: string
    branchId: string
    mentorStaffType: DbStaffType
    title: string
    category: string
    description: string
    priority: ComplaintPriority
  },
  accessToken: string,
): Promise<{ ok: boolean; error?: string; complaintId?: string }> {
  const response = await fetch('/api/admin/complaints', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mentorId: input.mentorId,
      batchId: input.batchId,
      branchId: input.branchId,
      mentorStaffType: input.mentorStaffType,
      title: input.title,
      category: input.category,
      description: input.description,
      priority: input.priority.toLowerCase(),
    }),
  })

  const payload = (await response.json()) as { error?: string; complaintId?: string }

  if (!response.ok) {
    return { ok: false, error: payload.error || 'Failed to submit complaint.' }
  }

  return { ok: true, complaintId: payload.complaintId }
}

export async function updateComplaintAdmin(
  input: {
    complaintId: string
    status: ComplaintStatus
    adminReply?: string
  },
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch('/api/admin/complaints', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      complaintId: input.complaintId,
      status: input.status.toLowerCase().replace(' ', '_'),
      adminReply: input.adminReply || '',
    }),
  })

  const payload = (await response.json()) as { error?: string }

  if (!response.ok) {
    return { ok: false, error: payload.error || 'Failed to update complaint.' }
  }

  return { ok: true }
}

export function isAdminComplaintView(parentRoleId: string | null | undefined) {
  return (
    parentRoleId === 'super_admin' ||
    parentRoleId === 'company_admin' ||
    parentRoleId === 'branch_admin'
  )
}
