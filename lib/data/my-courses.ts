import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataResult } from '@/lib/data/config'
import { fetchCourseBlueprint, type CourseBlueprint } from '@/lib/data/course-blueprint'
import { fetchBatchList, fetchBatchesByIds, type BatchListRow } from '@/lib/data/batches'
import {
  durationLabelByType,
  fetchCourseList,
  type CourseListRow,
  type CourseType,
} from '@/lib/data/courses'
import { fetchBatchTaskStats, fetchStudentIdByProfileId } from '@/lib/data/tasks'
import { fetchStaffAssignedBatchIds } from '@/lib/data/students'
import { fetchBatchAttendanceAverages } from '@/lib/data/attendance'
import { createClient } from '@/lib/supabase/client'

export type MyCourseRow = {
  id: string
  batch_id: string
  course_id: string
  name: string
  course_type: CourseType
  track: string
  duration: string
  tools: string
  description: string
  batch: string
  batch_code: string | null
  mentor: string
  hod: string
  mode: string
  time: string
  seats: string
  studentsCount: number
  tasksCount: number
  submissionsCount: number
  attendanceAverage: string
  progress: number
  status: string
}

export type FetchMyCoursesOptions = {
  branchId: string
  userId: string
  parentRoleId: string | null
  /**
   * Force branch-wide access (all batches in the branch) regardless of role.
   * Used for reviewers like Final QA who validate every submission in the branch.
   * Never applies to students.
   */
  branchWide?: boolean
}

const courseTypeLabels: Record<CourseType, string> = {
  basic: 'Basic',
  advanced: 'Advanced',
  professional: 'Professional',
}

function formatTimeLabel(timeValue: string | null) {
  if (!timeValue) return 'No time'

  const [hourValue, minuteValue] = timeValue.split(':')
  const hour = Number(hourValue)
  const minute = Number(minuteValue || '0')

  if (Number.isNaN(hour)) return timeValue

  const period = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12

  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`
}

function formatTimeRange(start: string | null, end: string | null) {
  if (!start && !end) return '—'
  return `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`
}

function mapBatchStatusLabel(status: BatchListRow['status']) {
  if (status === 'full') return 'Full'
  if (status === 'completed') return 'Completed'
  if (status === 'inactive') return 'Inactive'
  return 'Active'
}

function mapBatchToMyCourse(
  batch: BatchListRow,
  course?: CourseListRow | null,
  attendanceAverage = '—',
  taskStats?: { tasksCount: number; submissionsCount: number; progress: number },
): MyCourseRow {
  const trainer =
    batch.staff_assignments.find((assignment) => assignment.staff_type === 'trainer')?.staff_name ||
    'Not assigned'
  const hod =
    batch.staff_assignments.find((assignment) => assignment.staff_type === 'hod')?.staff_name ||
    'Not assigned'
  const tools = course?.tools?.length ? course.tools.join(', ') : '—'
  const description = course?.description?.trim() || 'No description added.'

  return {
    id: batch.course_id,
    batch_id: batch.id,
    course_id: batch.course_id,
    name: batch.course_name,
    course_type: batch.course_type,
    track: courseTypeLabels[batch.course_type] || 'Professional',
    duration: durationLabelByType[batch.course_type] || `${batch.duration_months} months`,
    tools,
    description,
    batch: batch.name,
    batch_code: batch.batch_code,
    mentor: trainer,
    hod,
    mode: batch.batch_mode === 'online' ? 'Online' : 'Onsite',
    time: formatTimeRange(batch.batch_start_time, batch.batch_end_time),
    seats: `${batch.enrolled_count}/${batch.max_seats}`,
    studentsCount: batch.enrolled_count,
    tasksCount: taskStats?.tasksCount ?? 0,
    submissionsCount: taskStats?.submissionsCount ?? 0,
    attendanceAverage,
    progress: taskStats?.progress ?? 0,
    status: mapBatchStatusLabel(batch.status),
  }
}

export function hasBranchWideMyCoursesAccess(parentRoleId: string | null | undefined) {
  return (
    parentRoleId === 'super_admin' ||
    parentRoleId === 'company_admin' ||
    parentRoleId === 'branch_admin'
  )
}

export function isStudentMyCoursesView(parentRoleId: string | null | undefined) {
  return parentRoleId === 'student'
}

async function fetchStudentEnrolledBatchIds(
  userId: string,
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle()

  if (studentError || !student) return []

  const { data: enrollments, error: enrollmentError } = await supabase
    .from('student_batch_enrollments')
    .select('batch_id')
    .eq('student_id', student.id)

  if (enrollmentError || !enrollments?.length) return []

  return enrollments.map((row) => row.batch_id)
}

export async function fetchAccessibleBatches(
  options: FetchMyCoursesOptions,
  supabase?: SupabaseClient,
): Promise<{ batches: BatchListRow[]; error?: string }> {
  const client = supabase ?? createClient()
  const batchResult = await fetchBatchList(options.branchId, client)

  if (batchResult.error) {
    return { batches: [], error: batchResult.error }
  }

  if (isStudentMyCoursesView(options.parentRoleId)) {
    const batchIds = await fetchStudentEnrolledBatchIds(options.userId, client)

    if (!batchIds.length) {
      return { batches: [] }
    }

    const batchResult = await fetchBatchesByIds(batchIds, client)

    if (batchResult.error) {
      return { batches: [], error: batchResult.error }
    }

    return { batches: batchResult.data }
  }

  // Reviewers with branch-wide scope (e.g. Final QA) see every batch in the branch.
  if (options.branchWide) {
    return { batches: batchResult.data }
  }

  if (options.parentRoleId === 'mentor') {
    const batchIds = await fetchStaffAssignedBatchIds(options.userId, options.branchId, client)
    return {
      batches: batchResult.data.filter((batch) => batchIds.includes(batch.id)),
    }
  }

  if (hasBranchWideMyCoursesAccess(options.parentRoleId)) {
    return { batches: batchResult.data }
  }

  if (options.parentRoleId === 'placement') {
    return { batches: batchResult.data }
  }

  return { batches: batchResult.data }
}

export async function fetchMyCourses(
  options: FetchMyCoursesOptions,
  supabase?: SupabaseClient,
): Promise<DataResult<MyCourseRow[]>> {
  const client = supabase ?? createClient()

  try {
    const { batches, error: batchError } = await fetchAccessibleBatches(options, client)

    if (batchError) {
      return { source: 'supabase', data: [], error: batchError }
    }

    if (!batches.length) {
      return { source: 'supabase', data: [] }
    }

    const courseResult = await fetchCourseList(options.branchId, undefined, client)
    const courseMap = new Map(courseResult.data.map((course) => [course.id, course]))
    const attendanceAverages = await fetchBatchAttendanceAverages(
      batches.map((batch) => batch.id),
      client,
    )

    const studentId = isStudentMyCoursesView(options.parentRoleId)
      ? await fetchStudentIdByProfileId(options.userId, client)
      : null

    const enrolledCounts = new Map(batches.map((batch) => [batch.id, batch.enrolled_count]))
    const taskStats = await fetchBatchTaskStats(
      batches.map((batch) => batch.id),
      {
        studentId,
        enrolledCounts,
        supabase: client,
      },
    )

    const rows = batches
      .map((batch) =>
        mapBatchToMyCourse(
          batch,
          courseMap.get(batch.course_id),
          attendanceAverages.get(batch.id)?.averageLabel || '—',
          taskStats.get(batch.id),
        ),
      )
      .sort((a, b) => a.name.localeCompare(b.name))

    return { source: 'supabase', data: rows }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load courses.',
    }
  }
}

export function filterMyCourses(rows: MyCourseRow[], keyword: string) {
  const value = keyword.trim().toLowerCase()
  if (!value) return rows

  return rows.filter((course) => {
    return (
      course.name.toLowerCase().includes(value) ||
      course.batch.toLowerCase().includes(value) ||
      (course.batch_code || '').toLowerCase().includes(value) ||
      course.track.toLowerCase().includes(value) ||
      course.mentor.toLowerCase().includes(value) ||
      course.hod.toLowerCase().includes(value) ||
      course.mode.toLowerCase().includes(value) ||
      course.tools.toLowerCase().includes(value) ||
      course.status.toLowerCase().includes(value)
    )
  })
}

export type MyCourseDetailBatch = {
  id: string
  name: string
  mode: string
  time: string
  mentor: string
  hod: string
  seats: string
  status: string
}

export type MyCourseDetailPageData = {
  course: CourseBlueprint
  batches: MyCourseDetailBatch[]
}

function mapBatchToOverviewBatch(batch: BatchListRow): MyCourseDetailBatch {
  const trainer =
    batch.staff_assignments.find((assignment) => assignment.staff_type === 'trainer')?.staff_name ||
    'Not assigned'
  const hod =
    batch.staff_assignments.find((assignment) => assignment.staff_type === 'hod')?.staff_name ||
    'Not assigned'

  return {
    id: batch.id,
    name: batch.name,
    mode: batch.batch_mode === 'online' ? 'Online' : 'Onsite',
    time: formatTimeRange(batch.batch_start_time, batch.batch_end_time),
    mentor: trainer,
    hod,
    seats: `${batch.enrolled_count}/${batch.max_seats}`,
    status: mapBatchStatusLabel(batch.status),
  }
}

export async function fetchMyCourseDetail(
  courseId: string,
  options: FetchMyCoursesOptions,
  supabase?: SupabaseClient,
): Promise<DataResult<MyCourseDetailPageData | null>> {
  const client = supabase ?? createClient()

  try {
    const skipBranchGate =
      isStudentMyCoursesView(options.parentRoleId) || options.parentRoleId === 'mentor'

    const blueprintResult = await fetchCourseBlueprint(
      courseId,
      skipBranchGate ? null : options.branchId,
      client,
    )

    if (!blueprintResult.ok) {
      return { source: 'supabase', data: null, error: blueprintResult.error }
    }

    const { batches, error: batchError } = await fetchAccessibleBatches(options, client)

    if (batchError) {
      return { source: 'supabase', data: null, error: batchError }
    }

    const relatedBatches = batches
      .filter((batch) => batch.course_id === courseId)
      .map(mapBatchToOverviewBatch)

    const canViewWithoutBatch =
      hasBranchWideMyCoursesAccess(options.parentRoleId) ||
      options.parentRoleId === 'placement'

    if (!canViewWithoutBatch && relatedBatches.length === 0) {
      return { source: 'supabase', data: null, error: 'This course is outside your permission scope.' }
    }

    return {
      source: 'supabase',
      data: {
        course: blueprintResult.course,
        batches: relatedBatches,
      },
    }
  } catch (error) {
    return {
      source: 'supabase',
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load course details.',
    }
  }
}
