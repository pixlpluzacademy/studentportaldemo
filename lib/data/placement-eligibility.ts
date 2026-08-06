import type { SupabaseClient } from '@supabase/supabase-js'
import type { AttendanceMark } from '@/lib/data/attendance'
import { getMarkGrade } from '@/lib/data/marks'
import { getAssignmentMaxMarks } from '@/lib/data/tasks'
import { createClient } from '@/lib/supabase/client'

/** Placement readiness thresholds used across LMS. */
export const PLACEMENT_ATTENDANCE_MIN = 75
export const PLACEMENT_ACADEMIC_MIN = 70

export type PlacementEligibilityStatus = 'Eligible' | 'Not Eligible' | 'Not Started'

export type PlacementEligibility = {
  status: PlacementEligibilityStatus
  ready: boolean
  batchCompleted: boolean
  attendanceOk: boolean
  academicOk: boolean
  attendancePercent: number | null
  academicPercent: number | null
  batchEndDate: string | null
  grade: string
}

type SubmissionMarkRow = {
  student_id: string
  mentor_mark: number | null
  hod_mark: number | null
  qa_mark: number | null
  task: { frequency: string | null } | { frequency: string | null }[] | null
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] || null : value
}

function average(scores: number[]) {
  if (!scores.length) return null
  return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
}

/** Present + late count as attended (same idea as student attendance eligibility UI). */
export function computePlacementAttendancePercent(statuses: AttendanceMark[]): {
  percent: number | null
  hasRecords: boolean
} {
  const marked = statuses.filter((status) => status !== 'unmarked')
  if (!marked.length) {
    return { percent: null, hasRecords: false }
  }

  const attended = marked.filter((status) => status === 'present' || status === 'late').length
  return {
    percent: Math.round((attended / marked.length) * 100),
    hasRecords: true,
  }
}

export function parseAttendancePercentLabel(label: string | null | undefined): number | null {
  if (!label || label === '—') return null
  const value = Number(String(label).replace('%', '').trim())
  return Number.isFinite(value) ? value : null
}

function localTodayDateString(today = new Date()) {
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Placement opens only after the batch end date has passed. */
export function isBatchCompletedForPlacement(
  batchEndDate: string | null | undefined,
  today = new Date(),
): boolean {
  if (!batchEndDate) return false
  const end = batchEndDate.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return false
  return localTodayDateString(today) > end
}

export function getPlacementEligibility(
  attendancePercent: number | null,
  academicPercent: number | null,
  batchEndDate?: string | null,
): PlacementEligibility {
  const hasAttendance = attendancePercent !== null
  const hasAcademic = academicPercent !== null
  const batchCompleted = isBatchCompletedForPlacement(batchEndDate)
  const grade = academicPercent === null ? '—' : getMarkGrade(academicPercent)

  // Placement process has not started while the batch is still running.
  if (!batchCompleted) {
    return {
      status: 'Not Started',
      ready: false,
      batchCompleted: false,
      attendanceOk: false,
      academicOk: false,
      attendancePercent,
      academicPercent,
      batchEndDate: batchEndDate?.slice(0, 10) || null,
      grade,
    }
  }

  if (!hasAttendance && !hasAcademic) {
    return {
      status: 'Not Started',
      ready: false,
      batchCompleted: true,
      attendanceOk: false,
      academicOk: false,
      attendancePercent: null,
      academicPercent: null,
      batchEndDate: batchEndDate?.slice(0, 10) || null,
      grade: '—',
    }
  }

  const attendanceOk = hasAttendance && (attendancePercent as number) >= PLACEMENT_ATTENDANCE_MIN
  const academicOk = hasAcademic && (academicPercent as number) >= PLACEMENT_ACADEMIC_MIN
  const ready = attendanceOk && academicOk

  return {
    status: ready ? 'Eligible' : 'Not Eligible',
    ready,
    batchCompleted: true,
    attendanceOk,
    academicOk,
    attendancePercent,
    academicPercent,
    batchEndDate: batchEndDate?.slice(0, 10) || null,
    grade,
  }
}

function assignmentPercentage(
  mentorMark: number | null,
  hodMark: number | null,
  qaMark: number | null,
  frequency: string | null | undefined,
): number | null {
  const maxMarks = getAssignmentMaxMarks(frequency)
  const available = [mentorMark, hodMark, qaMark].filter(
    (mark): mark is number => mark !== null && mark !== undefined && Number.isFinite(mark),
  )

  if (!available.length) return null

  const finalScore = Math.round(available.reduce((total, mark) => total + mark, 0) / available.length)
  return Math.round((Math.min(finalScore, maxMarks) / maxMarks) * 100)
}

/** Academic % = average of each assignment's stage-mark percentage for the student. */
export async function fetchStudentAcademicPercents(
  studentIds: string[],
  supabase?: SupabaseClient,
): Promise<Map<string, number | null>> {
  const client = supabase ?? createClient()
  const result = new Map<string, number | null>()

  studentIds.forEach((id) => result.set(id, null))
  if (!studentIds.length) return result

  const { data, error } = await client
    .from('task_submissions')
    .select(
      `
      student_id,
      mentor_mark,
      hod_mark,
      qa_mark,
      task:tasks (
        frequency
      )
    `,
    )
    .in('student_id', studentIds)
    .neq('status', 'draft')

  if (error || !data?.length) return result

  const grouped = new Map<string, number[]>()

  for (const row of data as SubmissionMarkRow[]) {
    const task = unwrap(row.task)
    const percent = assignmentPercentage(
      row.mentor_mark,
      row.hod_mark,
      row.qa_mark,
      task?.frequency,
    )
    if (percent === null) continue

    const list = grouped.get(row.student_id) || []
    list.push(percent)
    grouped.set(row.student_id, list)
  }

  grouped.forEach((scores, studentId) => {
    result.set(studentId, average(scores))
  })

  return result
}

export async function fetchStudentPlacementAttendancePercents(
  enrollments: { studentId: string; batchId: string }[],
  supabase?: SupabaseClient,
): Promise<Map<string, number | null>> {
  const client = supabase ?? createClient()
  const result = new Map<string, number | null>()

  enrollments.forEach((item) => {
    result.set(`${item.studentId}:${item.batchId}`, null)
  })

  if (!enrollments.length) return result

  const batchIds = Array.from(new Set(enrollments.map((item) => item.batchId).filter(Boolean)))
  const studentIds = Array.from(new Set(enrollments.map((item) => item.studentId).filter(Boolean)))

  if (!batchIds.length || !studentIds.length) return result

  const { data, error } = await client
    .from('student_attendance_records')
    .select('batch_id, student_id, status')
    .in('batch_id', batchIds)
    .in('student_id', studentIds)

  if (error || !data?.length) return result

  const grouped = new Map<string, AttendanceMark[]>()

  for (const row of data as { batch_id: string; student_id: string; status: AttendanceMark }[]) {
    const key = `${row.student_id}:${row.batch_id}`
    const list = grouped.get(key) || []
    list.push(row.status)
    grouped.set(key, list)
  }

  grouped.forEach((statuses, key) => {
    const { percent } = computePlacementAttendancePercent(statuses)
    result.set(key, percent)
  })

  return result
}
