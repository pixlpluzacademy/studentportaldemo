import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchBatchAttendanceAverages, type AttendanceMark } from '@/lib/data/attendance'
import { fetchBatchList, type BatchListRow } from '@/lib/data/batches'
import { fetchDashboardStats } from '@/lib/data/dashboard'
import { fetchDepartmentList } from '@/lib/data/departments'
import { fetchAccessibleBatches } from '@/lib/data/my-courses'
import { fetchMentorList } from '@/lib/data/mentors'
import {
  fetchStudentAcademicPercents,
  fetchStudentPlacementAttendancePercents,
  getPlacementEligibility,
} from '@/lib/data/placement-eligibility'
import { fetchPlacementPipeline } from '@/lib/data/placement-jobs'
import { fetchStudentList, type StudentListRow } from '@/lib/data/students'
import { createClient } from '@/lib/supabase/client'

export type AttendanceTrendRange = 'weekly' | 'monthly'

export type AttendanceTrendSeries = {
  batchId: string
  batchName: string
  color: string
  dataKey: string
}

export type AttendanceTrendPoint = {
  label: string
  dateKey: string
  [dataKey: string]: string | number | null
}

const TREND_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']

export type ReportGraphPoint = {
  label: string
  value: number
  secondary?: number
}

export type ReportPiePoint = {
  label: string
  value: number
  count?: number
  color?: string
  students?: number
  batches?: number
  avgStudentsPerBatch?: number
}

/** One batch row for client-side department pie filters/aggregation. */
export type ReportDepartmentBatchStat = {
  departmentId: string | null
  departmentName: string
  batchId: string
  batchName: string
  batchMode: 'online' | 'offline'
  status: string
  studentCount: number
}

export type ReportFilterOption = {
  id: string
  name: string
}

export type ReportBatchOption = {
  id: string
  name: string
  departmentId: string | null
  departmentName: string
}

export type ReportMarksTaskOption = {
  id: string
  title: string
  batchId: string
  batchName?: string
}

export type ReportMarksStageCounts = {
  submitted: number
  mentorDone: number
  hodRevision: number
  qaRevision: number
  completed: number
  expected: number
}

/** One row per task for horizontal marks bar chart (actual mark numbers). */
export type ReportMarksBarMode = 'task' | 'student'

export type ReportMarksBarRow = {
  taskId: string
  task: string
  taskName: string
  taskNumber: number
  dueDate: string | null
  mode: ReportMarksBarMode
  studentId?: string | null
  mentorMark: number
  hodMark: number
  finalQaMark: number
  mentorCount: number
  hodCount: number
  qaCount: number
  maxMarks: number
}

export type ReportMentorOverviewPoint = {
  mentorId: string
  name: string
  shortName: string
  rating: number
  ratingLabel: string
  avatarUrl: string | null
  departmentName: string
  profileSlug: string | null
  profileName: string
  color: string
}

export type ReportMentorProfileOption = {
  id: string
  slug: string
  name: string
}

export type ReportsSnapshot = {
  studentCount: number
  batchCount: number
  mentorCount: number
  branchCount: number
  taskCount: number
  submissionCount: number
  attendanceAveragePercent: number
  academicAveragePercent: number
  pendingMentorReviewCount: number
  pendingHodReviewCount: number
  pendingQaCount: number
  revisionCount: number
  qaApprovedCount: number
  placementApplied: number
  placementInterviewing: number
  placementPlaced: number
  placementRejected: number
  placementEligibleStudents: number
  submissionStatus: ReportPiePoint[]
  reviewPipeline: ReportGraphPoint[]
  placementPipeline: ReportGraphPoint[]
  attendanceByBatch: ReportGraphPoint[]
  departmentBreakdown: ReportGraphPoint[]
  studentsByDepartment: ReportPiePoint[]
  batchesByDepartment: ReportPiePoint[]
  /** Per-batch rows so the department pie can filter by mode/status client-side. */
  departmentBatchStats: ReportDepartmentBatchStat[]
  departments: ReportFilterOption[]
  batches: ReportFilterOption[]
  /** Full branch-scoped batch list for searchable attendance pickers. */
  batchCatalog: ReportBatchOption[]
}

function emptySnapshot(): ReportsSnapshot {
  return {
    studentCount: 0,
    batchCount: 0,
    mentorCount: 0,
    branchCount: 0,
    taskCount: 0,
    submissionCount: 0,
    attendanceAveragePercent: 0,
    academicAveragePercent: 0,
    pendingMentorReviewCount: 0,
    pendingHodReviewCount: 0,
    pendingQaCount: 0,
    revisionCount: 0,
    qaApprovedCount: 0,
    placementApplied: 0,
    placementInterviewing: 0,
    placementPlaced: 0,
    placementRejected: 0,
    placementEligibleStudents: 0,
    submissionStatus: [],
    reviewPipeline: [],
    placementPipeline: [],
    attendanceByBatch: [],
    departmentBreakdown: [],
    studentsByDepartment: [],
    batchesByDepartment: [],
    departmentBatchStats: [],
    departments: [],
    batches: [],
    batchCatalog: [],
  }
}

function emptyMarksStages(): ReportMarksStageCounts {
  return {
    submitted: 0,
    mentorDone: 0,
    hodRevision: 0,
    qaRevision: 0,
    completed: 0,
    expected: 0,
  }
}

function maxMarksForFrequency(frequency: string | null | undefined) {
  const value = String(frequency || '').toLowerCase()
  if (value === 'daily') return 50
  if (value === 'weekly') return 75
  return 100
}

function averageMark(values: number[]) {
  if (!values.length) return 0
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

function classifyMarksSubmissionStage(row: {
  status: string
  mentor_decision: string
  hod_decision: string
  qa_decision: string
  mentor_mark: number | null
  hod_mark: number | null
  qa_mark: number | null
}): {
  submitted: boolean
  mentorDone: boolean
  hodRevision: boolean
  qaRevision: boolean
  completed: boolean
  /** Exclusive current pipeline bucket for bar chart values. */
  barBucket: 'submitted' | 'mentorReview' | 'hod' | 'finalQa' | null
} {
  const status = String(row.status || '')
  const mentorDecision = String(row.mentor_decision || '')
  const hodDecision = String(row.hod_decision || '')
  const qaDecision = String(row.qa_decision || '')

  const completed = qaDecision === 'approved' || status === 'approved'
  const qaRevision = !completed && (qaDecision === 'revision' || (status === 'revision' && hodDecision === 'approved'))
  const hodRevision =
    !completed &&
    !qaRevision &&
    (hodDecision === 'revision' || (status === 'revision' && mentorDecision === 'approved'))
  const mentorDone =
    row.mentor_mark !== null ||
    mentorDecision === 'approved' ||
    mentorDecision === 'revision' ||
    hodDecision !== 'pending' ||
    qaDecision !== 'pending' ||
    completed
  const submitted = status !== 'draft'

  // One bar bucket per student so chart values are not all identical.
  let barBucket: 'submitted' | 'mentorReview' | 'hod' | 'finalQa' | null = null
  if (submitted) {
    if (completed || qaRevision || qaDecision !== 'pending' || row.qa_mark !== null) {
      barBucket = 'finalQa'
    } else if (hodRevision || hodDecision !== 'pending' || row.hod_mark !== null || mentorDecision === 'approved') {
      barBucket = 'hod'
    } else if (mentorDone) {
      barBucket = 'mentorReview'
    } else {
      barBucket = 'submitted'
    }
  }

  return { submitted, mentorDone, hodRevision, qaRevision, completed, barBucket }
}

function shortLabel(value: string, max = 16) {
  const text = value.trim() || '—'
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function formatTaskDueLabel(dueDate: string | null | undefined) {
  if (!dueDate) return ''
  const parsed = new Date(`${dueDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return dueDate
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function average(values: number[]) {
  if (!values.length) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function toPercentParts(counts: { label: string; value: number; color?: string }[]): ReportPiePoint[] {
  const total = counts.reduce((sum, item) => sum + item.value, 0)
  if (!total) {
    return [{ label: 'No data', value: 100, color: '#64748b' }]
  }

  return counts
    .filter((item) => item.value > 0)
    .map((item) => ({
      label: item.label,
      value: Math.round((item.value / total) * 100),
      color: item.color,
    }))
}

function filterBatches(
  batches: BatchListRow[],
  options: {
    departmentId?: string | null
    batchId?: string | null
  },
) {
  return batches.filter((batch) => {
    if (options.departmentId && options.departmentId !== 'all' && batch.department_id !== options.departmentId) {
      return false
    }
    if (options.batchId && options.batchId !== 'all' && batch.id !== options.batchId) {
      return false
    }
    return true
  })
}

function filterStudents(students: StudentListRow[], batchIds: Set<string>, departmentName?: string | null) {
  return students.filter((student) => {
    if (batchIds.size && !batchIds.has(student.batch_id)) return false
    if (departmentName && departmentName !== 'all' && student.department_name !== departmentName) return false
    return true
  })
}

export async function fetchReportsSnapshot(options: {
  branchId?: string | null
  parentRoleId?: string | null
  userId?: string | null
  departmentId?: string | null
  batchId?: string | null
  supabase?: SupabaseClient
}): Promise<{ data: ReportsSnapshot; error?: string }> {
  const client = options.supabase ?? createClient()

  try {
    const staffScoped = options.parentRoleId === 'mentor'

    const [
      stats,
      batchesResult,
      studentsResult,
      mentorsResult,
      pipelineResult,
      branchesResult,
      departmentsResult,
    ] = await Promise.all([
      fetchDashboardStats({
        branchId: options.branchId,
        parentRoleId: options.parentRoleId,
        userId: options.userId,
      }),
      fetchBatchList(options.branchId || undefined),
      fetchStudentList({
        branchId: options.branchId,
        staffUserId: staffScoped ? options.userId : null,
      }),
      fetchMentorList(options.branchId || undefined),
      fetchPlacementPipeline(client),
      client.from('branches').select('id').eq('status', 'active'),
      fetchDepartmentList(options.branchId || undefined, client),
    ])

    let batches = batchesResult.data || []
    const allStudents = studentsResult.data || []
    const mentors = mentorsResult.data || []

    if (staffScoped && options.userId && options.branchId) {
      const accessible = await fetchAccessibleBatches({
        parentRoleId: options.parentRoleId,
        userId: options.userId,
        branchId: options.branchId,
      })
      const allowed = new Set(accessible.batches.map((batch) => batch.id))
      batches = batches.filter((batch) => allowed.has(batch.id))
    } else if (options.branchId) {
      batches = batches.filter((batch) => batch.branch_id === options.branchId)
    }

    const departmentMap = new Map<string, string>()
    for (const department of departmentsResult.data || []) {
      departmentMap.set(department.id, department.name)
    }
    for (const batch of batches) {
      if (batch.department_id) {
        departmentMap.set(batch.department_id, batch.department_name || 'Department')
      }
    }

    const departments = Array.from(departmentMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const selectedDepartmentName =
      options.departmentId && options.departmentId !== 'all'
        ? departmentMap.get(options.departmentId) || null
        : null

    const filterBatchOptions = filterBatches(batches, {
      departmentId: options.departmentId,
      batchId: null,
    }).map((batch) => ({
      id: batch.id,
      name: batch.name,
    }))

    const batchCatalog: ReportBatchOption[] = [...batches]
      .map((batch) => ({
        id: batch.id,
        name: batch.name,
        departmentId: batch.department_id,
        departmentName: batch.department_name || '—',
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const scopedBatches = filterBatches(batches, {
      departmentId: options.departmentId,
      batchId: options.batchId,
    })

    const batchIds = new Set(scopedBatches.map((batch) => batch.id))
    const students = filterStudents(allStudents, batchIds, selectedDepartmentName)
    const attendanceAverages = await fetchBatchAttendanceAverages([...batchIds], client)

    const attendanceValues = scopedBatches
      .map((batch) => attendanceAverages.get(batch.id)?.averagePercent)
      .filter((value): value is number => typeof value === 'number')

    const academicValues = students
      .map((student) => student.academic_percent)
      .filter((value): value is number => value !== null)

    const attendanceByBatch = scopedBatches.slice(0, 10).map((batch) => ({
      label: shortLabel(batch.name),
      value: attendanceAverages.get(batch.id)?.averagePercent || 0,
    }))

    const scopedBatchIds = scopedBatches.map((batch) => batch.id)
    const attendanceAveragePercent = average(attendanceValues) || stats.attendanceAveragePercent
    const academicAveragePercent = average(academicValues)

    const departmentBreakdownMap = new Map<string, { attendance: number[]; academic: number[]; students: number }>()
    for (const batch of scopedBatches) {
      const key = batch.department_name || '—'
      const current = departmentBreakdownMap.get(key) || { attendance: [], academic: [], students: 0 }
      const attendance = attendanceAverages.get(batch.id)?.averagePercent
      if (typeof attendance === 'number') current.attendance.push(attendance)
      const batchStudents = students.filter((student) => student.batch_id === batch.id)
      current.students += batchStudents.length
      for (const student of batchStudents) {
        if (student.academic_percent !== null) current.academic.push(student.academic_percent)
      }
      departmentBreakdownMap.set(key, current)
    }

    const departmentBreakdown = Array.from(departmentBreakdownMap.entries()).map(([label, item]) => ({
      label: shortLabel(label, 14),
      value: average(item.academic.length ? item.academic : item.attendance),
      secondary: item.students,
    }))

    const pieColors = ['#153e90', '#3b82f6', '#6ee75a', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#64748b']

    function toCountPie(items: { label: string; value: number }[]): ReportPiePoint[] {
      if (!items.length) {
        return [{ label: 'No data', value: 100, count: 0, color: '#64748b' }]
      }

      const total = items.reduce((sum, item) => sum + item.value, 0)
      return items.map((item, index) => ({
        label: item.label,
        value: total > 0 ? Math.round((item.value / total) * 100) : 0,
        count: item.value,
        color: pieColors[index % pieColors.length],
      }))
    }

    const studentCountByDepartment = new Map<string, number>()
    const batchCountByDepartment = new Map<string, number>()
    for (const department of departments) {
      studentCountByDepartment.set(department.name, 0)
      batchCountByDepartment.set(department.name, 0)
    }
    for (const [label, item] of departmentBreakdownMap.entries()) {
      studentCountByDepartment.set(label, item.students)
    }
    for (const batch of scopedBatches) {
      const key = batch.department_name || '—'
      if (!batchCountByDepartment.has(key)) {
        batchCountByDepartment.set(key, 0)
        studentCountByDepartment.set(key, studentCountByDepartment.get(key) || 0)
      }
      batchCountByDepartment.set(key, (batchCountByDepartment.get(key) || 0) + 1)
    }

    const studentsByDepartment = toCountPie(
      Array.from(studentCountByDepartment.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    )

    const batchesByDepartment = toCountPie(
      Array.from(batchCountByDepartment.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    )

    const departmentBatchStats: ReportDepartmentBatchStat[] = scopedBatches.map((batch) => {
      const studentCount = students.filter((student) => student.batch_id === batch.id).length
      return {
        departmentId: batch.department_id,
        departmentName: batch.department_name || '—',
        batchId: batch.id,
        batchName: batch.name,
        batchMode: batch.batch_mode,
        status: batch.status,
        studentCount,
      }
    })

    const pendingMentor = stats.pendingMentorReviewCount
    const pendingHod = stats.pendingHodReviewCount
    const pendingQa = stats.pendingQaCount
    const revision = stats.revisionCount
    const approved = stats.qaApprovedCount
    const submittedApprox = Math.max(
      stats.submissionCount - pendingMentor - pendingHod - pendingQa - revision - approved,
      0,
    )

    const submissionStatus = toPercentParts([
      { label: 'Mentor Queue', value: pendingMentor, color: '#153e90' },
      { label: 'HOD Queue', value: pendingHod, color: '#3b82f6' },
      { label: 'QA Queue', value: pendingQa, color: '#6ee75a' },
      { label: 'Revision', value: revision, color: '#f59e0b' },
      { label: 'Approved', value: approved, color: '#22c55e' },
      { label: 'Other', value: submittedApprox, color: '#64748b' },
    ])

    const reviewPipeline: ReportGraphPoint[] = [
      { label: 'Mentor', value: pendingMentor },
      { label: 'HOD', value: pendingHod },
      { label: 'QA', value: pendingQa },
      { label: 'Revision', value: revision },
      { label: 'Approved', value: approved },
    ]

    const courseNames = new Set(
      scopedBatches.map((batch) => batch.course_name.trim().toLowerCase()).filter(Boolean),
    )
    const departmentNames = new Set(
      scopedBatches.map((batch) => batch.department_name.trim().toLowerCase()).filter(Boolean),
    )

    const pipeline = (pipelineResult.data || []).filter((item) => {
      if (!options.departmentId && !options.batchId) return true
      if (options.departmentId === 'all' && (!options.batchId || options.batchId === 'all')) return true

      const course = item.courseName.trim().toLowerCase()
      if (options.batchId && options.batchId !== 'all') {
        const batch = scopedBatches.find((row) => row.id === options.batchId)
        if (!batch) return false
        return course === batch.course_name.trim().toLowerCase() || course.includes(batch.course_name.trim().toLowerCase())
      }

      return courseNames.has(course) || [...departmentNames].some((name) => course.includes(name) || name.includes(course))
    })

    const placementApplied = pipeline.filter((item) => item.applicationStatus === 'applied').length
    const placementInterviewing = pipeline.filter((item) => item.applicationStatus === 'interviewing').length
    const placementPlaced = pipeline.filter((item) => item.applicationStatus === 'selected').length
    const placementRejected = pipeline.filter(
      (item) => item.applicationStatus === 'rejected' || item.applicationStatus === 'on_hold',
    ).length
    const placementEligibleStudents = students.filter((student) => student.placement_ready).length

    const placementPipeline: ReportGraphPoint[] = [
      { label: 'Eligible', value: placementEligibleStudents },
      { label: 'Applied', value: placementApplied },
      { label: 'Interview', value: placementInterviewing },
      { label: 'Placed', value: placementPlaced },
      { label: 'Rejected', value: placementRejected },
    ]

    const filteredActive = Boolean(
      (options.departmentId && options.departmentId !== 'all') ||
        (options.batchId && options.batchId !== 'all'),
    )

    return {
      data: {
        studentCount: filteredActive ? students.length : stats.studentCount || students.length,
        batchCount: filteredActive ? scopedBatches.length : stats.batchCount || scopedBatches.length,
        mentorCount: mentors.length,
        branchCount: (branchesResult.data || []).length,
        taskCount: stats.taskCount,
        submissionCount: stats.submissionCount,
        attendanceAveragePercent,
        academicAveragePercent,
        pendingMentorReviewCount: pendingMentor,
        pendingHodReviewCount: pendingHod,
        pendingQaCount: pendingQa,
        revisionCount: revision,
        qaApprovedCount: approved,
        placementApplied,
        placementInterviewing,
        placementPlaced,
        placementRejected,
        placementEligibleStudents,
        submissionStatus,
        reviewPipeline,
        placementPipeline,
        attendanceByBatch: attendanceByBatch.length ? attendanceByBatch : [{ label: 'No data', value: 0 }],
        departmentBreakdown: departmentBreakdown.length
          ? departmentBreakdown
          : [{ label: 'No data', value: 0 }],
        studentsByDepartment: studentsByDepartment.length
          ? studentsByDepartment
          : [{ label: 'No data (0)', value: 100, color: '#64748b' }],
        batchesByDepartment: batchesByDepartment.length
          ? batchesByDepartment
          : [{ label: 'No data (0)', value: 100, color: '#64748b' }],
        departmentBatchStats,
        departments,
        batches: filterBatchOptions,
        batchCatalog,
      },
    }
  } catch (error) {
    return {
      data: emptySnapshot(),
      error: error instanceof Error ? error.message : 'Failed to load reports.',
    }
  }
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function getAttendanceTrendPresetDates(range: AttendanceTrendRange): {
  fromDate: string
  toDate: string
} {
  const today = startOfDay(new Date())

  if (range === 'weekly') {
    const from = new Date(today)
    from.setDate(today.getDate() - 6)
    return { fromDate: toDateKey(from), toDate: toDateKey(today) }
  }

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  return { fromDate: toDateKey(monthStart), toDate: toDateKey(today) }
}

function parseDateKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return startOfDay(date)
}

function buildTrendDateSlots(fromDate: string, toDate: string): { dateKey: string; label: string }[] {
  const start = parseDateKey(fromDate)
  const end = parseDateKey(toDate)
  if (!start || !end || start > end) return []

  const dayMs = 24 * 60 * 60 * 1000
  const spanDays = Math.round((end.getTime() - start.getTime()) / dayMs) + 1
  // Cap very wide ranges so the chart stays readable.
  const maxDays = 93
  const limitedEnd =
    spanDays > maxDays ? startOfDay(new Date(start.getTime() + (maxDays - 1) * dayMs)) : end

  const sameMonth =
    start.getFullYear() === limitedEnd.getFullYear() && start.getMonth() === limitedEnd.getMonth()
  const slots: { dateKey: string; label: string }[] = []
  const cursor = new Date(start)

  while (cursor <= limitedEnd) {
    const dateKey = toDateKey(cursor)
    let label: string
    if (spanDays <= 7) {
      label = cursor.toLocaleDateString('en-US', { weekday: 'short' })
    } else if (sameMonth) {
      label = String(cursor.getDate())
    } else {
      label = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    slots.push({ dateKey, label })
    cursor.setDate(cursor.getDate() + 1)
  }

  return slots
}

/**
 * Daily attendance % by student headcount.
 * present ÷ batch students × 100 (all present = 100%, 1 of 2 present = 50%).
 * Returns null when that day has no real marks (only unmarked / empty).
 */
function dailyAttendancePercent(
  studentStatuses: Map<string, AttendanceMark>,
  batchStudentCount: number,
): { percent: number; present: number; total: number } | null {
  if (!studentStatuses.size) return null

  const statuses = [...studentStatuses.values()]
  const marked = statuses.filter((status) => status !== 'unmarked')
  // Session row exists but nobody was marked yet — skip the day.
  if (!marked.length) return null

  const present = statuses.filter((status) => status === 'present').length
  const total = Math.max(batchStudentCount, studentStatuses.size)
  if (!total) return null

  return {
    percent: Math.round((present / total) * 100),
    present,
    total,
  }
}

/** Batch-wise attendance % trend for weekly / monthly / custom date range. */
export async function fetchAttendanceTrend(options: {
  batchIds: string[]
  batchNames?: Record<string, string>
  range?: AttendanceTrendRange
  fromDate?: string | null
  toDate?: string | null
  supabase?: SupabaseClient
}): Promise<{ points: AttendanceTrendPoint[]; series: AttendanceTrendSeries[]; error?: string }> {
  const client = options.supabase ?? createClient()
  const batchIds = [...new Set(options.batchIds.filter(Boolean))].slice(0, 4)

  if (!batchIds.length) {
    return { points: [], series: [] }
  }

  const preset = getAttendanceTrendPresetDates(options.range || 'weekly')
  const fromDate = options.fromDate || preset.fromDate
  const toDate = options.toDate || preset.toDate

  if (parseDateKey(fromDate) && parseDateKey(toDate) && fromDate > toDate) {
    return { points: [], series: [], error: 'From date must be on or before To date.' }
  }

  const slots = buildTrendDateSlots(fromDate, toDate)
  const startDate = slots[0]?.dateKey
  const endDate = slots[slots.length - 1]?.dateKey

  if (!startDate || !endDate) {
    return { points: [], series: [], error: 'Invalid date range.' }
  }

  const series: AttendanceTrendSeries[] = batchIds.map((batchId, index) => ({
    batchId,
    batchName: options.batchNames?.[batchId] || `Batch ${index + 1}`,
    color: TREND_COLORS[index % TREND_COLORS.length],
    dataKey: `b${index}`,
  }))

  try {
    const [attendanceResult, enrollmentResult] = await Promise.all([
      client
        .from('student_attendance_records')
        .select('batch_id, student_id, attendance_date, status')
        .in('batch_id', batchIds)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate),
      client
        .from('student_batch_enrollments')
        .select('batch_id, student_id, status')
        .in('batch_id', batchIds)
        .in('status', ['active', 'completed']),
    ])

    if (attendanceResult.error) {
      return { points: [], series, error: attendanceResult.error.message }
    }

    // Unique students per batch: enrollments + anyone who appears in attendance.
    const studentsByBatch = new Map<string, Set<string>>()
    for (const batchId of batchIds) {
      studentsByBatch.set(batchId, new Set())
    }

    for (const row of (enrollmentResult.data || []) as {
      batch_id: string
      student_id: string
    }[]) {
      studentsByBatch.get(row.batch_id)?.add(row.student_id)
    }

    // One status per student per batch/day.
    const grouped = new Map<string, Map<string, AttendanceMark>>()
    for (const row of (attendanceResult.data || []) as {
      batch_id: string
      student_id: string
      attendance_date: string
      status: AttendanceMark
    }[]) {
      studentsByBatch.get(row.batch_id)?.add(row.student_id)

      const key = `${row.batch_id}|${row.attendance_date}`
      const students = grouped.get(key) || new Map<string, AttendanceMark>()
      students.set(row.student_id, row.status)
      grouped.set(key, students)
    }

    const points: AttendanceTrendPoint[] = slots.map((slot) => {
      const point: AttendanceTrendPoint = {
        label: slot.label,
        dateKey: slot.dateKey,
      }

      for (const item of series) {
        const dayStudents = grouped.get(`${item.batchId}|${slot.dateKey}`) || new Map()
        const batchStudentCount = studentsByBatch.get(item.batchId)?.size || dayStudents.size
        const day = dailyAttendancePercent(dayStudents, batchStudentCount)
        point[item.dataKey] = day ? day.percent : null
        point[`${item.dataKey}_present`] = day ? day.present : null
        point[`${item.dataKey}_total`] = day ? day.total : null
      }

      return point
    })

    return { points, series }
  } catch (error) {
    return {
      points: [],
      series,
      error: error instanceof Error ? error.message : 'Failed to load attendance trend.',
    }
  }
}

/** Task-based marks bar data + review stage counts. */
const MARKS_CHART_TASK_LIMIT = 12
const MARKS_CHART_STUDENT_LIMIT = 20

export async function fetchMarksRadar(options: {
  batchIds: string[]
  batchNames?: Record<string, string>
  taskId?: string | null
  supabase?: SupabaseClient
}): Promise<{
  bars: ReportMarksBarRow[]
  stages: ReportMarksStageCounts
  tasks: ReportMarksTaskOption[]
  chartMode: ReportMarksBarMode
  selectedTaskCount: number
  chartItemCount: number
  chartItemLimit: number
  error?: string
}> {
  const client = options.supabase ?? createClient()
  const batchIds = [...new Set(options.batchIds.filter(Boolean))]
  const emptyResult = {
    bars: [] as ReportMarksBarRow[],
    stages: emptyMarksStages(),
    tasks: [] as ReportMarksTaskOption[],
    chartMode: 'task' as ReportMarksBarMode,
    selectedTaskCount: 0,
    chartItemCount: 0,
    chartItemLimit: MARKS_CHART_TASK_LIMIT,
  }

  if (!batchIds.length) {
    return emptyResult
  }

  try {
    const [{ data: taskRows, error: tasksError }, { data: enrollmentRows }] = await Promise.all([
      client
        .from('tasks')
        .select('id, title, batch_id, frequency, student_id, due_date')
        .in('batch_id', batchIds)
        .order('due_date', { ascending: true })
        .limit(40),
      client
        .from('student_batch_enrollments')
        .select('batch_id, student_id')
        .in('batch_id', batchIds)
        .in('status', ['active', 'completed']),
    ])

    if (tasksError) {
      return { ...emptyResult, error: tasksError.message }
    }

    const enrolledByBatch = new Map<string, number>()
    for (const row of (enrollmentRows || []) as { batch_id: string; student_id: string }[]) {
      enrolledByBatch.set(row.batch_id, (enrolledByBatch.get(row.batch_id) || 0) + 1)
    }

    const allTasks = (taskRows || []) as {
      id: string
      title: string
      batch_id: string
      frequency: string | null
      student_id: string | null
      due_date: string | null
    }[]

    const tasks: ReportMarksTaskOption[] = allTasks.map((task) => ({
      id: task.id,
      title: task.title,
      batchId: task.batch_id,
      batchName: options.batchNames?.[task.batch_id],
    }))

    const selectedTasks = options.taskId
      ? allTasks.filter((task) => task.id === options.taskId)
      : allTasks

    if (!selectedTasks.length) {
      return { ...emptyResult, tasks }
    }

    const singleTaskMode = Boolean(options.taskId) && selectedTasks.length === 1

    const taskMaxById = new Map<string, number>()
    for (const task of selectedTasks) {
      taskMaxById.set(task.id, maxMarksForFrequency(task.frequency))
    }

    const taskIds = selectedTasks.map((task) => task.id)
    const { data: submissionRows, error: submissionsError } = await client
      .from('task_submissions')
      .select('task_id, student_id, status, mentor_mark, hod_mark, qa_mark, mentor_decision, hod_decision, qa_decision')
      .in('task_id', taskIds)

    if (submissionsError) {
      return {
        ...emptyResult,
        tasks,
        selectedTaskCount: selectedTasks.length,
        error: submissionsError.message,
      }
    }

    type SubmissionMarkRow = {
      task_id: string
      student_id: string
      status: string
      mentor_mark: number | null
      hod_mark: number | null
      qa_mark: number | null
      mentor_decision: string
      hod_decision: string
      qa_decision: string
    }

    const submissions = (submissionRows || []) as SubmissionMarkRow[]

    const perTaskMarks = new Map<
      string,
      { mentor: number[]; hod: number[]; qa: number[] }
    >()
    for (const task of selectedTasks) {
      perTaskMarks.set(task.id, { mentor: [], hod: [], qa: [] })
    }

    const stages = emptyMarksStages()
    let expected = 0
    for (const task of selectedTasks) {
      expected += task.student_id ? 1 : enrolledByBatch.get(task.batch_id) || 0
    }
    stages.expected = expected

    for (const row of submissions) {
      const marks = perTaskMarks.get(row.task_id)
      if (!marks) continue

      if (row.mentor_mark !== null && row.mentor_mark !== undefined && !Number.isNaN(Number(row.mentor_mark))) {
        marks.mentor.push(Number(row.mentor_mark))
      }
      if (row.hod_mark !== null && row.hod_mark !== undefined && !Number.isNaN(Number(row.hod_mark))) {
        marks.hod.push(Number(row.hod_mark))
      }
      if (row.qa_mark !== null && row.qa_mark !== undefined && !Number.isNaN(Number(row.qa_mark))) {
        marks.qa.push(Number(row.qa_mark))
      }

      const stage = classifyMarksSubmissionStage(row)
      if (stage.submitted) stages.submitted += 1
      if (stage.mentorDone) stages.mentorDone += 1
      if (stage.hodRevision) stages.hodRevision += 1
      if (stage.qaRevision) stages.qaRevision += 1
      if (stage.completed) stages.completed += 1
    }

    if (!stages.expected) {
      stages.expected = Math.max(stages.submitted, stages.mentorDone, stages.completed)
    }

    let bars: ReportMarksBarRow[] = []
    let chartMode: ReportMarksBarMode = 'task'
    let chartItemCount = selectedTasks.length
    let chartItemLimit = MARKS_CHART_TASK_LIMIT

    if (singleTaskMode) {
      // One task → one bar group per student (not an average of the whole class).
      chartMode = 'student'
      chartItemLimit = MARKS_CHART_STUDENT_LIMIT
      const task = selectedTasks[0]
      const maxMarks = taskMaxById.get(task.id) || 100
      const batchName = options.batchNames?.[task.batch_id]
      const taskFullName = batchName ? `${task.title} (${batchName})` : task.title

      const markedSubmissions = submissions
        .filter((row) => row.task_id === task.id)
        .filter(
          (row) =>
            (row.mentor_mark !== null && row.mentor_mark !== undefined) ||
            (row.hod_mark !== null && row.hod_mark !== undefined) ||
            (row.qa_mark !== null && row.qa_mark !== undefined),
        )
        .sort((a, b) => a.student_id.localeCompare(b.student_id))

      chartItemCount = markedSubmissions.length
      const chartStudents = markedSubmissions.slice(0, MARKS_CHART_STUDENT_LIMIT)
      const studentIds = [...new Set(chartStudents.map((row) => row.student_id))]

      const nameByStudentId = new Map<string, string>()
      if (studentIds.length) {
        const { data: studentRows } = await client
          .from('students')
          .select('id, profile:profiles!students_profile_id_fkey(full_name)')
          .in('id', studentIds)

        for (const row of (studentRows || []) as {
          id: string
          profile: { full_name: string | null } | { full_name: string | null }[] | null
        }[]) {
          const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile
          nameByStudentId.set(row.id, profile?.full_name?.trim() || 'Student')
        }
      }

      bars = chartStudents.map((row, index) => {
        const studentNumber = index + 1
        const studentName = nameByStudentId.get(row.student_id) || 'Student'
        const shortName = shortLabel(studentName.split(' ')[0] || studentName, 10)
        const mentor =
          row.mentor_mark !== null && row.mentor_mark !== undefined && !Number.isNaN(Number(row.mentor_mark))
            ? Number(row.mentor_mark)
            : 0
        const hod =
          row.hod_mark !== null && row.hod_mark !== undefined && !Number.isNaN(Number(row.hod_mark))
            ? Number(row.hod_mark)
            : 0
        const qa =
          row.qa_mark !== null && row.qa_mark !== undefined && !Number.isNaN(Number(row.qa_mark))
            ? Number(row.qa_mark)
            : 0

        return {
          taskId: task.id,
          task: `#${studentNumber}\n${shortName}`,
          taskName: `${studentName} · ${taskFullName}`,
          taskNumber: studentNumber,
          dueDate: task.due_date,
          mode: 'student' as const,
          studentId: row.student_id,
          mentorMark: mentor,
          hodMark: hod,
          finalQaMark: qa,
          mentorCount: row.mentor_mark !== null && row.mentor_mark !== undefined ? 1 : 0,
          hodCount: row.hod_mark !== null && row.hod_mark !== undefined ? 1 : 0,
          qaCount: row.qa_mark !== null && row.qa_mark !== undefined ? 1 : 0,
          maxMarks,
        }
      })
    } else {
      // All tasks → class average per task (select one task to see each student).
      const recentTasks = [...selectedTasks]
        .sort((a, b) => {
          const aDue = a.due_date || ''
          const bDue = b.due_date || ''
          if (aDue !== bDue) return bDue.localeCompare(aDue)
          return b.id.localeCompare(a.id)
        })
        .slice(0, MARKS_CHART_TASK_LIMIT)
        .sort((a, b) => {
          const aDue = a.due_date || ''
          const bDue = b.due_date || ''
          if (aDue !== bDue) return aDue.localeCompare(bDue)
          return a.id.localeCompare(b.id)
        })

      bars = recentTasks.map((task, index) => {
        const marks = perTaskMarks.get(task.id) || { mentor: [], hod: [], qa: [] }
        const batchName = options.batchNames?.[task.batch_id]
        const fullName = batchName ? `${task.title} (${batchName})` : task.title
        const maxMarks = taskMaxById.get(task.id) || 100
        const taskNumber = index + 1
        const dueLabel = formatTaskDueLabel(task.due_date)

        return {
          taskId: task.id,
          task: dueLabel ? `#${taskNumber}\n${dueLabel}` : `#${taskNumber}`,
          taskName: fullName,
          taskNumber,
          dueDate: task.due_date,
          mode: 'task' as const,
          mentorMark: averageMark(marks.mentor),
          hodMark: averageMark(marks.hod),
          finalQaMark: averageMark(marks.qa),
          mentorCount: marks.mentor.length,
          hodCount: marks.hod.length,
          qaCount: marks.qa.length,
          maxMarks,
        }
      })
    }

    return {
      bars,
      stages,
      tasks,
      chartMode,
      selectedTaskCount: selectedTasks.length,
      chartItemCount,
      chartItemLimit,
    }
  } catch (error) {
    return {
      ...emptyResult,
      error: error instanceof Error ? error.message : 'Failed to load marks overview.',
    }
  }
}

const MENTOR_OVERVIEW_LIMIT = 16
/** Mid-tone palette — readable on both light and dark chart backgrounds. */
const MENTOR_OVERVIEW_COLORS = [
  '#0d9488', // teal
  '#ea580c', // orange
  '#ca8a04', // gold
  '#2563eb', // blue
  '#7c3aed', // violet
  '#db2777', // pink
  '#0891b2', // cyan
  '#16a34a', // green
  '#dc2626', // red
  '#9333ea', // purple
]

export async function fetchMentorOverview(options: {
  branchId?: string | null
  departmentId?: string | null
  /** Permission profile slug under Mentor parent (e.g. mentor_hod). Not Final QA. */
  profileSlug?: string | null
  supabase?: SupabaseClient
}): Promise<{
  points: ReportMentorOverviewPoint[]
  total: number
  profiles: ReportMentorProfileOption[]
  error?: string
}> {
  const client = options.supabase ?? createClient()
  const branchId = options.branchId || null
  const departmentId =
    options.departmentId && options.departmentId !== 'all' ? options.departmentId : null
  const profileSlug =
    options.profileSlug && options.profileSlug !== 'all' ? options.profileSlug : null

  if (!branchId) {
    return { points: [], total: 0, profiles: [] }
  }

  try {
    const [{ data: profileOptions, error: profilesError }, { data, error }] = await Promise.all([
      client
        .from('permission_profiles')
        .select('id, slug, name')
        .eq('parent_role_id', 'mentor')
        .neq('slug', 'mentor_final_qa')
        .order('name'),
      (() => {
        let query = client
          .from('mentor_details')
          .select(
            `
            profile_id,
            department_id,
            average_rating,
            profiles:profile_id (
              full_name,
              avatar_url,
              status,
              parent_role_id,
              user_permission_profiles (
                is_primary,
                permission_profiles (
                  id,
                  slug,
                  name,
                  parent_role_id
                )
              )
            ),
            departments:department_id (
              name
            )
          `,
          )
          .eq('branch_id', branchId)

        if (departmentId) {
          query = query.eq('department_id', departmentId)
        }

        return query.limit(120)
      })(),
    ])

    if (profilesError) {
      return { points: [], total: 0, profiles: [], error: profilesError.message }
    }

    if (error) {
      return { points: [], total: 0, profiles: [], error: error.message }
    }

    const profiles: ReportMentorProfileOption[] = ((profileOptions || []) as ReportMentorProfileOption[]).map(
      (row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
      }),
    )

    type ProfileLink = {
      is_primary: boolean | null
      permission_profiles:
        | { id: string; slug: string; name: string; parent_role_id: string }
        | { id: string; slug: string; name: string; parent_role_id: string }[]
        | null
    }

    const rows = (data || []) as {
      profile_id: string
      department_id: string | null
      average_rating: number | null
      profiles:
        | {
            full_name: string | null
            avatar_url: string | null
            status: string | null
            parent_role_id: string | null
            user_permission_profiles: ProfileLink[] | null
          }
        | {
            full_name: string | null
            avatar_url: string | null
            status: string | null
            parent_role_id: string | null
            user_permission_profiles: ProfileLink[] | null
          }[]
        | null
      departments: { name: string } | { name: string }[] | null
    }[]

    const mapped = rows
      .map((row, index) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        if (!profile || profile.status === 'inactive') return null
        if (profile.parent_role_id && profile.parent_role_id !== 'mentor') return null

        const links = profile.user_permission_profiles || []
        const primaryLink =
          links.find((link) => link.is_primary) || links[0] || null
        const permissionProfile = primaryLink
          ? Array.isArray(primaryLink.permission_profiles)
            ? primaryLink.permission_profiles[0]
            : primaryLink.permission_profiles
          : null

        if (!permissionProfile || permissionProfile.slug === 'mentor_final_qa') return null
        if (profileSlug && permissionProfile.slug !== profileSlug) return null

        const department = Array.isArray(row.departments) ? row.departments[0] : row.departments
        const name = profile.full_name?.trim() || 'Mentor'
        const rating =
          row.average_rating === null || row.average_rating === undefined || Number.isNaN(Number(row.average_rating))
            ? 0
            : Math.round(Number(row.average_rating) * 10) / 10

        return {
          mentorId: row.profile_id,
          name,
          shortName: shortLabel(name.split(' ')[0] || name, 10),
          rating,
          ratingLabel: rating > 0 ? rating.toFixed(1) : '—',
          avatarUrl: profile.avatar_url,
          departmentName: department?.name || 'Not assigned',
          profileSlug: permissionProfile.slug,
          profileName: permissionProfile.name,
          color: MENTOR_OVERVIEW_COLORS[index % MENTOR_OVERVIEW_COLORS.length],
        } satisfies ReportMentorOverviewPoint
      })
      .filter((row): row is ReportMentorOverviewPoint => Boolean(row))
      .sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
      .map((row, index) => ({
        ...row,
        color: MENTOR_OVERVIEW_COLORS[index % MENTOR_OVERVIEW_COLORS.length],
      }))

    return {
      points: mapped.slice(0, MENTOR_OVERVIEW_LIMIT),
      total: mapped.length,
      profiles,
    }
  } catch (error) {
    return {
      points: [],
      total: 0,
      profiles: [],
      error: error instanceof Error ? error.message : 'Failed to load mentor overview.',
    }
  }
}

function emptyReviewPipeline(): ReportGraphPoint[] {
  return [
    { label: 'Mentor', value: 0 },
    { label: 'HOD', value: 0 },
    { label: 'QA', value: 0 },
    { label: 'Revision', value: 0 },
    { label: 'Approved', value: 0 },
  ]
}

export type ReportReviewTaskOption = {
  id: string
  title: string
  batchId: string
  batchName?: string
  assignedByName?: string
}

/** Review queue counts scoped to department / batch / task in that batch. */
export async function fetchReviewPipeline(options: {
  batchIds: string[]
  batchNames?: Record<string, string>
  taskId?: string | null
  supabase?: SupabaseClient
}): Promise<{
  data: ReportGraphPoint[]
  tasks: ReportReviewTaskOption[]
  error?: string
}> {
  const client = options.supabase ?? createClient()
  const batchIds = [...new Set(options.batchIds.filter(Boolean))]

  if (!batchIds.length) {
    return { data: emptyReviewPipeline(), tasks: [] }
  }

  try {
    const { data: taskRows, error: tasksError } = await client
      .from('tasks')
      .select('id, title, batch_id')
      .in('batch_id', batchIds)
      .order('due_date', { ascending: false })
      .limit(200)

    if (tasksError) {
      return { data: emptyReviewPipeline(), tasks: [], error: tasksError.message }
    }

    type TaskRow = {
      id: string
      title: string
      batch_id: string
    }

    const batchTasks = (taskRows || []) as TaskRow[]

    const tasks: ReportReviewTaskOption[] = batchTasks.map((task) => ({
      id: task.id,
      title: task.title,
      batchId: task.batch_id,
      batchName: options.batchNames?.[task.batch_id],
    }))

    const selectedTasks = options.taskId
      ? batchTasks.filter((task) => task.id === options.taskId)
      : batchTasks

    const taskIds = selectedTasks.map((task) => task.id)
    if (!taskIds.length) {
      return { data: emptyReviewPipeline(), tasks }
    }

    const { data: submissionRows, error: submissionsError } = await client
      .from('task_submissions')
      .select('id, status, mentor_decision, hod_decision, qa_decision')
      .in('task_id', taskIds)
      .neq('status', 'draft')

    if (submissionsError) {
      return { data: emptyReviewPipeline(), tasks, error: submissionsError.message }
    }

    const rows = (submissionRows || []) as {
      id: string
      status: string
      mentor_decision: string
      hod_decision: string
      qa_decision: string
    }[]

    const pendingMentor = rows.filter(
      (row) =>
        row.mentor_decision === 'pending' &&
        ['submitted', 'in_review', 'revision'].includes(row.status),
    ).length

    const pendingHod = rows.filter(
      (row) => row.mentor_decision === 'approved' && row.hod_decision === 'pending',
    ).length

    const pendingQa = rows.filter((row) => row.qa_decision === 'pending').length

    const approved = rows.filter((row) => row.qa_decision === 'approved').length

    const revision = rows.filter(
      (row) =>
        row.status === 'revision' ||
        row.status === 'rejected' ||
        row.mentor_decision === 'rejected' ||
        row.mentor_decision === 'revision_requested' ||
        row.hod_decision === 'rejected' ||
        row.hod_decision === 'revision_requested' ||
        row.qa_decision === 'rejected' ||
        row.qa_decision === 'revision_requested',
    ).length

    return {
      data: [
        { label: 'Mentor', value: pendingMentor },
        { label: 'HOD', value: pendingHod },
        { label: 'QA', value: pendingQa },
        { label: 'Revision', value: revision },
        { label: 'Approved', value: approved },
      ],
      tasks,
    }
  } catch (error) {
    return {
      data: emptyReviewPipeline(),
      tasks: [],
      error: error instanceof Error ? error.message : 'Failed to load review pipeline.',
    }
  }
}

export type PlacementBatchModeFilter = 'all' | 'online' | 'offline'

export type PlacementStagePoint = {
  stage: string
  value: number
}

function emptyPlacementStages(): PlacementStagePoint[] {
  return [
    { stage: 'Eligible', value: 0 },
    { stage: 'Applied', value: 0 },
    { stage: 'Interview', value: 0 },
    { stage: 'Rejected', value: 0 },
    { stage: 'Placed', value: 0 },
  ]
}

/** Placement stage counts for area chart (X = stage, Y = count), scoped by batch filters. */
export async function fetchPlacementBatchLine(options: {
  branchId?: string | null
  departmentId?: string | null
  fromDate?: string | null
  toDate?: string | null
  mode?: PlacementBatchModeFilter
  supabase?: SupabaseClient
}): Promise<{ points: PlacementStagePoint[]; error?: string }> {
  const client = options.supabase ?? createClient()
  const branchId = options.branchId || null
  const departmentId =
    options.departmentId && options.departmentId !== 'all' ? options.departmentId : null
  const mode = options.mode && options.mode !== 'all' ? options.mode : null
  const fromDate = options.fromDate?.trim() || null
  const toDate = options.toDate?.trim() || null

  if (!branchId) {
    return { points: emptyPlacementStages() }
  }

  try {
    // Real schema: batches → courses → departments (no batches.department_id).
    let batchQuery = client
      .from('batches')
      .select(
        `
        id,
        name,
        mode,
        start_date,
        end_date,
        course:courses!inner (
          id,
          department_id
        )
      `,
      )
      .eq('branch_id', branchId)
      .order('start_date', { ascending: true })

    if (mode) {
      batchQuery = batchQuery.eq('mode', mode)
    }

    const { data: batchRows, error: batchesError } = await batchQuery.limit(120)

    if (batchesError) {
      return { points: emptyPlacementStages(), error: batchesError.message }
    }

    const batches = ((batchRows || []) as {
      id: string
      name: string
      mode: string | null
      start_date: string | null
      end_date: string | null
      course: { id: string; department_id: string | null } | { id: string; department_id: string | null }[] | null
    }[])
      .map((batch) => {
        const course = Array.isArray(batch.course) ? batch.course[0] : batch.course
        return {
          id: batch.id,
          name: batch.name,
          mode: batch.mode,
          start_date: batch.start_date,
          end_date: batch.end_date,
          department_id: course?.department_id || null,
        }
      })
      .filter((batch) => {
        if (departmentId && batch.department_id !== departmentId) return false
        if (fromDate && batch.start_date && batch.start_date < fromDate) return false
        if (toDate && batch.start_date && batch.start_date > toDate) return false
        if (fromDate && !batch.start_date) return false
        if (toDate && !batch.start_date) return false
        return true
      })

    if (!batches.length) {
      return { points: emptyPlacementStages() }
    }

    const batchIds = batches.map((batch) => batch.id)
    const batchEndById = new Map(batches.map((batch) => [batch.id, batch.end_date]))

    const [{ data: enrollmentRows }, { data: applicationRows }] = await Promise.all([
      client
        .from('student_batch_enrollments')
        .select('batch_id, student_id')
        .in('batch_id', batchIds)
        .in('status', ['active', 'completed']),
      client.from('placement_applications').select('student_id, status'),
    ])

    const enrollments = ((enrollmentRows || []) as { batch_id: string; student_id: string }[]).map(
      (row) => ({
        studentId: row.student_id,
        batchId: row.batch_id,
      }),
    )

    const studentIds = new Set(enrollments.map((row) => row.studentId))

    const [attendancePercents, academicPercents] = await Promise.all([
      fetchStudentPlacementAttendancePercents(enrollments, client),
      fetchStudentAcademicPercents([...studentIds], client),
    ])

    const placedStudentIds = new Set<string>()
    let applied = 0
    let interview = 0
    let placed = 0
    let rejected = 0

    for (const row of (applicationRows || []) as { student_id: string; status: string }[]) {
      if (!studentIds.has(row.student_id)) continue
      if (row.status === 'applied') applied += 1
      else if (row.status === 'interviewing') interview += 1
      else if (row.status === 'selected') {
        placed += 1
        placedStudentIds.add(row.student_id)
      } else if (row.status === 'rejected' || row.status === 'on_hold') rejected += 1
    }

    // Same rule as students module, but skip students already placed.
    const eligibleStudentIds = new Set<string>()
    for (const enrollment of enrollments) {
      if (placedStudentIds.has(enrollment.studentId)) continue
      const key = `${enrollment.studentId}:${enrollment.batchId}`
      const eligibility = getPlacementEligibility(
        attendancePercents.get(key) ?? null,
        academicPercents.get(enrollment.studentId) ?? null,
        batchEndById.get(enrollment.batchId),
      )
      if (eligibility.ready) {
        eligibleStudentIds.add(enrollment.studentId)
      }
    }

    return {
      points: [
        { stage: 'Eligible', value: eligibleStudentIds.size },
        { stage: 'Applied', value: applied },
        { stage: 'Interview', value: interview },
        { stage: 'Rejected', value: rejected },
        { stage: 'Placed', value: placed },
      ],
    }
  } catch (error) {
    return {
      points: emptyPlacementStages(),
      error: error instanceof Error ? error.message : 'Failed to load placement pipeline.',
    }
  }
}
