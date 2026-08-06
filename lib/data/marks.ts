import type { DataResult } from '@/lib/data/config'
import type { BatchListRow } from '@/lib/data/batches'
import type { StudentListRow } from '@/lib/data/students'
import {
  fetchTaskSubmissions,
  type TaskSubmissionListRow,
} from '@/lib/data/task-submissions'
import {
  getAssignmentMaxMarks,
  getAssignmentTypeLabel,
  type TaskBatchLookup,
} from '@/lib/data/tasks'

export type MarkRecord = {
  id: string
  studentId: string
  student: string
  course: string
  batch: string
  batchId: string
  department: string
  batchTime: string
  batchMode: string
  task: string
  assignmentType: string
  frequency: string
  maxMarks: number
  mentor: string
  fileName: string
  mentorMark: string | number
  hodMark: string | number
  finalQaMark: string | number
  finalScore: string | number
  percentage: string | number
  grade: string
  result: string
  status: string
}

export type StudentMarksSummary = {
  studentId: string
  student: string
  course: string
  batch: string
  batchId: string
  department: string
  batchTime: string
  batchMode: string
  mentor: string
  assignmentCount: number
  scoredCount: number
  finalizedCount: number
  totalAverage: string | number
  grade: string
  result: string
}

export type BatchMarksMeta = {
  name: string
  courseName: string
  departmentName: string
  batchTime: string
  batchMode: string
  enrolledCount: number
}

function toNumber(value: string | number) {
  const numberValue = Number(value)
  if (Number.isNaN(numberValue)) return 0
  return numberValue
}

function formatTimeLabel(timeValue: string | null | undefined) {
  if (!timeValue) return ''
  const [hourText, minuteText = '00'] = timeValue.slice(0, 5).split(':')
  const hour = Number(hourText)
  if (Number.isNaN(hour)) return timeValue.slice(0, 5)

  const suffix = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minuteText} ${suffix}`
}

export function formatBatchTimeLabel(start: string | null | undefined, end: string | null | undefined) {
  const startLabel = formatTimeLabel(start)
  const endLabel = formatTimeLabel(end)
  if (startLabel && endLabel) return `${startLabel} – ${endLabel}`
  return startLabel || endLabel || '—'
}

export function formatBatchModeLabel(mode: string | null | undefined) {
  if (!mode) return '—'
  return mode.charAt(0).toUpperCase() + mode.slice(1)
}

export function getMarkGrade(score: number) {
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

export function getMarkResult(score: number) {
  return score >= 50 ? 'Passed' : 'Failed'
}

function getMarkStatus(mentorMark: string, hodMark: string, finalQaMark: string) {
  if (finalQaMark !== '-') return 'Finalized'
  if (hodMark !== '-') return 'HOD Reviewed'
  if (mentorMark !== '-') return 'Mentor Reviewed'
  return 'Pending'
}

export function averageFromScores(scores: number[]) {
  if (!scores.length) return '-' as const
  return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
}

export function mapSubmissionToMarkRecord(
  submission: TaskSubmissionListRow,
  batchMeta?: BatchMarksMeta | null,
): MarkRecord {
  const mentorMark = submission.mentorMark || '-'
  const hodMark = submission.hodMark || '-'
  const finalQaMark = submission.qaMark || '-'
  const frequency = submission.frequency || 'one_time'
  const maxMarks = getAssignmentMaxMarks(frequency)
  const assignmentType = getAssignmentTypeLabel(frequency)

  const availableMarks = [mentorMark, hodMark, finalQaMark]
    .filter((mark) => mark !== '-')
    .map((mark) => toNumber(mark))

  const finalScore = averageFromScores(availableMarks)
  const percentage =
    finalScore === '-'
      ? '-'
      : Math.round((Math.min(Number(finalScore), maxMarks) / maxMarks) * 100)

  return {
    id: submission.id,
    studentId: submission.studentId,
    student: submission.student,
    course: batchMeta?.courseName || submission.course,
    batch: batchMeta?.name || submission.batch,
    batchId: submission.batchId,
    department: batchMeta?.departmentName || '—',
    batchTime: batchMeta?.batchTime || '—',
    batchMode: batchMeta?.batchMode || '—',
    task: submission.task,
    assignmentType,
    frequency,
    maxMarks,
    mentor: submission.mentor,
    fileName: submission.fileName || '-',
    mentorMark,
    hodMark,
    finalQaMark,
    finalScore,
    percentage,
    grade: percentage === '-' ? '-' : getMarkGrade(Number(percentage)),
    result: percentage === '-' ? 'Pending' : getMarkResult(Number(percentage)),
    status: getMarkStatus(mentorMark, hodMark, finalQaMark),
  }
}

export function buildBatchMarksMetaMap(batches: BatchListRow[]): Map<string, BatchMarksMeta> {
  return new Map(
    batches.map((batch) => [
      batch.id,
      {
        name: batch.name,
        courseName: batch.course_name,
        departmentName: batch.department_name || '—',
        batchTime: formatBatchTimeLabel(batch.batch_start_time, batch.batch_end_time),
        batchMode: formatBatchModeLabel(batch.batch_mode),
        enrolledCount: batch.enrolled_count,
      },
    ]),
  )
}

export function toTaskBatchLookup(batchMetaMap: Map<string, BatchMarksMeta>): Map<string, TaskBatchLookup> {
  return new Map(
    Array.from(batchMetaMap.entries()).map(([id, meta]) => [
      id,
      {
        name: meta.name,
        courseName: meta.courseName,
        enrolledCount: meta.enrolledCount,
      },
    ]),
  )
}

export function buildStudentMarksSummaries(marks: MarkRecord[]): StudentMarksSummary[] {
  const grouped = new Map<string, MarkRecord[]>()

  for (const mark of marks) {
    const existing = grouped.get(mark.studentId) || []
    existing.push(mark)
    grouped.set(mark.studentId, existing)
  }

  return Array.from(grouped.entries())
    .map(([studentId, rows]) => {
      const first = rows[0]
      // Normalize by assignment max (Daily 50 / Weekly 75 / Final Project 100).
      const scoredPercentages = rows
        .filter((row) => row.percentage !== '-')
        .map((row) => Number(row.percentage))
      const totalAverage = averageFromScores(scoredPercentages)

      return {
        studentId,
        student: first.student,
        course: first.course,
        batch: first.batch,
        batchId: first.batchId,
        department: first.department,
        batchTime: first.batchTime,
        batchMode: first.batchMode,
        mentor: first.mentor,
        assignmentCount: rows.length,
        scoredCount: scoredPercentages.length,
        finalizedCount: rows.filter((row) => row.status === 'Finalized').length,
        totalAverage,
        grade: totalAverage === '-' ? '-' : getMarkGrade(Number(totalAverage)),
        result: totalAverage === '-' ? 'Pending' : getMarkResult(Number(totalAverage)),
      }
    })
    .sort((a, b) => a.student.localeCompare(b.student))
}

/** Include every scoped student, even if they have zero submissions yet. */
export function mergeStudentsWithMarks(
  students: StudentListRow[],
  marks: MarkRecord[],
  batchMetaMap: Map<string, BatchMarksMeta>,
): StudentMarksSummary[] {
  const markSummaries = new Map(
    buildStudentMarksSummaries(marks).map((summary) => [summary.studentId, summary]),
  )
  const seen = new Set<string>()
  const merged: StudentMarksSummary[] = []

  for (const student of students) {
    if (seen.has(student.id)) continue
    seen.add(student.id)

    const fromMarks = markSummaries.get(student.id)
    if (fromMarks) {
      merged.push(fromMarks)
      markSummaries.delete(student.id)
      continue
    }

    const meta = batchMetaMap.get(student.batch_id)

    merged.push({
      studentId: student.id,
      student: student.full_name,
      course: meta?.courseName || student.course_name,
      batch: meta?.name || student.batch_name,
      batchId: student.batch_id,
      department: meta?.departmentName || '—',
      batchTime: meta?.batchTime || '—',
      batchMode: meta?.batchMode || '—',
      mentor: '—',
      assignmentCount: 0,
      scoredCount: 0,
      finalizedCount: 0,
      totalAverage: '-',
      grade: '-',
      result: 'Pending',
    })
  }

  for (const leftover of markSummaries.values()) {
    merged.push(leftover)
  }

  return merged.sort((a, b) => a.student.localeCompare(b.student))
}

export async function fetchMarks(options?: {
  batchLookup?: Map<string, TaskBatchLookup>
  batchMetaMap?: Map<string, BatchMarksMeta>
  studentId?: string | null
  batchIds?: string[]
}): Promise<DataResult<MarkRecord[]>> {
  const result = await fetchTaskSubmissions({
    batchLookup: options?.batchLookup,
    studentId: options?.studentId,
    batchIds: options?.batchIds,
  })

  return {
    source: result.source,
    data: result.data.map((row) =>
      mapSubmissionToMarkRecord(row, options?.batchMetaMap?.get(row.batchId) || null),
    ),
    error: result.error,
  }
}

export async function fetchStudentMarksDetail(
  studentId: string,
  options?: {
    batchLookup?: Map<string, TaskBatchLookup>
    batchMetaMap?: Map<string, BatchMarksMeta>
    batchIds?: string[]
  },
): Promise<DataResult<{ marks: MarkRecord[]; totalAverage: string | number }>> {
  if (!studentId) {
    return { source: 'supabase', data: { marks: [], totalAverage: '-' }, error: 'Student id is required.' }
  }

  const result = await fetchMarks({
    ...options,
    studentId,
  })

  const scoredPercentages = result.data
    .filter((row) => row.percentage !== '-')
    .map((row) => Number(row.percentage))

  return {
    source: result.source,
    data: {
      marks: result.data,
      totalAverage: averageFromScores(scoredPercentages),
    },
    error: result.error,
  }
}
