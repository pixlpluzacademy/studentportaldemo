import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataResult } from '@/lib/data/config'
import type { BatchListRow, ClassDayType } from '@/lib/data/batches'
import { createClient } from '@/lib/supabase/client'

export type AttendanceMark = 'present' | 'absent' | 'late' | 'unmarked'

export type AttendanceBatch = {
  id: string
  name: string
  course: string
  mentor: string
  mode: 'online' | 'offline'
  time: string
  seats: string
  status: string
  start_date: string
  end_date: string
  class_day_type: ClassDayType
  custom_days?: string[]
  start_time: string | null
  end_time: string | null
  class_link: string | null
}

const WEEKDAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

/** True when the date falls within the batch start/end range. */
export function isDateInsideBatchRange(
  dateValue: string,
  startDate?: string | null,
  endDate?: string | null,
) {
  if (!dateValue || !startDate || !endDate) return false

  const selected = new Date(`${dateValue}T00:00:00`)
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)

  if (
    Number.isNaN(selected.getTime()) ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return false
  }

  return selected >= start && selected <= end
}

/** True when the date matches the batch class-day schedule. */
export function isScheduledClassDay(
  dateValue: string,
  classDayType: ClassDayType,
  customDays: string[] = [],
) {
  if (!dateValue) return false

  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return false

  const day = date.getDay()

  if (classDayType === 'weekdays') return day >= 1 && day <= 5
  if (classDayType === 'weekend') return day === 0 || day === 6

  const normalized = customDays
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  // Custom day picker is not persisted yet — treat as every day until configured.
  if (normalized.length === 0) return true

  return normalized.includes(WEEKDAY_NAMES[day])
}

/** True when the date is both inside the batch range and on a scheduled class day. */
export function isAttendanceClassDay(
  dateValue: string,
  options: {
    startDate?: string | null
    endDate?: string | null
    classDayType: ClassDayType
    customDays?: string[]
  },
) {
  // If batch dates exist, anything outside that window is not a class day.
  if (options.startDate && options.endDate) {
    if (!isDateInsideBatchRange(dateValue, options.startDate, options.endDate)) {
      return false
    }
  }

  return isScheduledClassDay(dateValue, options.classDayType, options.customDays || [])
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export type AttendanceScheduleOptions = {
  startDate?: string | null
  endDate?: string | null
  classDayType: ClassDayType
  customDays?: string[]
  /** Inclusive end for expected days. Defaults to today (local). */
  throughDate?: string | null
}

/**
 * Scheduled class days from batch start through min(today, batch end).
 * Future class days are excluded so they do not drag attendance down early.
 */
export function listExpectedClassDays(options: AttendanceScheduleOptions): string[] {
  const start = options.startDate?.slice(0, 10)
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return []

  const today = (options.throughDate || toLocalIsoDate(new Date())).slice(0, 10)
  const batchEnd = options.endDate?.slice(0, 10)
  const through =
    batchEnd && /^\d{4}-\d{2}-\d{2}$/.test(batchEnd) && batchEnd < today ? batchEnd : today

  if (through < start) return []

  const days: string[] = []
  const cursor = new Date(`${start}T00:00:00`)
  const last = new Date(`${through}T00:00:00`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return []

  while (cursor <= last) {
    const iso = toLocalIsoDate(cursor)
    if (
      isAttendanceClassDay(iso, {
        startDate: options.startDate,
        endDate: options.endDate || through,
        classDayType: options.classDayType,
        customDays: options.customDays,
      })
    ) {
      days.push(iso)
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

export type AttendanceScheduleInput = {
  startDate?: string | null
  endDate?: string | null
  classDayType?: ClassDayType | null
  customDays?: string[]
  throughDate?: string | null
}

export type AttendanceStudent = {
  id: string
  name: string
  course: string
  batch: string
  batchId: string
  attendance: string
  status: string
  email: string
  phone: string
  avatar_url: string | null
}

export type DailyAttendanceRecord = {
  id: string
  studentId: string
  studentName: string
  batch: string
  batchId: string
  course: string
  date: string
  sessionTime: string
  status: AttendanceMark
  markedBy: string
  note: string
  classLink: string | null
}

export type BatchAttendanceAverage = {
  batchId: string
  averageLabel: string
  averagePercent: number
}

export type CourseAttendanceSessionSummary = {
  id: string
  session: string
  date: string
  batch: string
  status: string
  present: number
  absent: number
  late: number
}

type DbAttendanceRow = {
  id: string
  batch_id: string
  student_id: string
  attendance_date: string
  status: AttendanceMark
  notes: string | null
  class_link: string | null
  marked_by: string | null
  marker: { full_name: string | null } | { full_name: string | null }[] | null
  batch:
    | {
        id: string
        name: string
        schedule: string | null
        course: { name: string } | { name: string }[] | null
      }
    | {
        id: string
        name: string
        schedule: string | null
        course: { name: string } | { name: string }[] | null
      }[]
  student:
    | {
        id: string
        profile: { full_name: string | null } | { full_name: string | null }[] | null
      }
    | {
        id: string
        profile: { full_name: string | null } | { full_name: string | null }[] | null
      }[]
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] || null : value
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
  return `${formatTimeLabel(start)} to ${formatTimeLabel(end)}`
}

function mapBatchStatusLabel(status: BatchListRow['status']) {
  if (status === 'full') return 'Full'
  if (status === 'completed') return 'Completed'
  if (status === 'inactive') return 'Inactive'
  return 'Active'
}

export function mapBatchListRowToAttendanceBatch(batch: BatchListRow): AttendanceBatch {
  const trainer =
    batch.staff_assignments.find((assignment) => assignment.staff_type === 'trainer')?.staff_name ||
    'Not assigned'

  return {
    id: batch.id,
    name: batch.name,
    course: batch.course_name,
    mentor: trainer,
    mode: batch.batch_mode,
    time: formatTimeRange(batch.batch_start_time, batch.batch_end_time),
    seats: `${batch.enrolled_count}/${batch.max_seats}`,
    status: mapBatchStatusLabel(batch.status),
    start_date: batch.start_date || '',
    end_date: batch.end_date || '',
    class_day_type: batch.class_day_type,
    custom_days: batch.custom_days || [],
    start_time: batch.batch_start_time,
    end_time: batch.batch_end_time,
    class_link: batch.class_link,
  }
}

/** Day weight: present = full day, late = half day, absent = none. */
export function attendanceStatusWeight(status: AttendanceMark): number {
  if (status === 'present') return 1
  if (status === 'late') return 0.5
  return 0
}

/**
 * Attendance % against scheduled class days (through today).
 * Present=1, late=0.5, absent=0, unmarked/missed class day=0.
 * Denominator is expected class days — not only marked days — so skipped marking lowers %.
 */
export function computeAttendancePercent(
  records: Array<{ status: AttendanceMark; date?: string | null }>,
  schedule?: AttendanceScheduleInput | null,
): number {
  const classDayType = schedule?.classDayType || 'weekdays'
  const expectedDays = schedule
    ? listExpectedClassDays({
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        classDayType,
        customDays: schedule.customDays,
        throughDate: schedule.throughDate,
      })
    : []

  if (expectedDays.length > 0) {
    const byDate = new Map<string, AttendanceMark>()
    for (const record of records) {
      if (!record.date || record.status === 'unmarked') continue
      byDate.set(record.date.slice(0, 10), record.status)
    }

    let score = 0
    for (const day of expectedDays) {
      const status = byDate.get(day)
      if (status) score += attendanceStatusWeight(status)
    }

    return Math.round((score / expectedDays.length) * 100)
  }

  // Fallback when batch schedule is missing: marked days only.
  const marked = records.filter((record) => record.status !== 'unmarked')
  if (!marked.length) return 0

  const score = marked.reduce(
    (total, record) => total + attendanceStatusWeight(record.status),
    0,
  )
  return Math.round((score / marked.length) * 100)
}

export function formatAttendanceAverageLabel(percent: number, hasRecords: boolean) {
  if (!hasRecords) return '—'
  return `${percent}%`
}

type BatchScheduleRow = {
  id: string
  start_date: string | null
  end_date: string | null
  class_day_type: ClassDayType | null
}

async function fetchBatchSchedulesById(
  batchIds: string[],
  client: SupabaseClient,
): Promise<Map<string, BatchScheduleRow>> {
  const map = new Map<string, BatchScheduleRow>()
  if (!batchIds.length) return map

  const { data } = await client
    .from('batches')
    .select('id, start_date, end_date, class_day_type')
    .in('id', batchIds)

  for (const row of (data || []) as BatchScheduleRow[]) {
    map.set(row.id, row)
  }

  return map
}

function mapDbRowToDailyRecord(row: DbAttendanceRow, batch?: AttendanceBatch | null): DailyAttendanceRecord {
  const batchRow = unwrap(row.batch)
  const studentRow = unwrap(row.student)
  const profile = unwrap(studentRow?.profile)
  const course = unwrap(batchRow?.course)
  const marker = unwrap(row.marker)

  const sessionTime = batch ? formatTimeRange(batch.start_time, batch.end_time) : '—'

  return {
    id: row.id,
    studentId: row.student_id,
    studentName: profile?.full_name?.trim() || 'Unknown',
    batch: batch?.name || batchRow?.name || 'Unknown batch',
    batchId: row.batch_id,
    course: batch?.course || course?.name || 'Unknown course',
    date: row.attendance_date,
    sessionTime,
    status: row.status,
    markedBy: marker?.full_name?.trim() || (row.marked_by ? 'Staff' : '—'),
    note: row.notes?.trim() || '',
    classLink: row.class_link,
  }
}

export async function fetchAttendanceRecords(
  batchIds: string[],
  options?: {
    studentId?: string
    supabase?: SupabaseClient
    batchesById?: Map<string, AttendanceBatch>
  },
): Promise<DataResult<DailyAttendanceRecord[]>> {
  const client = options?.supabase ?? createClient()

  if (!batchIds.length) {
    return { source: 'supabase', data: [] }
  }

  try {
    let query = client
      .from('student_attendance_records')
      .select(
        `
        id,
        batch_id,
        student_id,
        attendance_date,
        status,
        notes,
        class_link,
        marked_by,
        marker:profiles!student_attendance_records_marked_by_fkey (
          full_name
        ),
        student:students (
          id,
          profile:profiles!students_profile_id_fkey (
            full_name
          )
        )
      `,
      )
      .in('batch_id', batchIds)
      .order('attendance_date', { ascending: false })

    if (options?.studentId) {
      query = query.eq('student_id', options.studentId)
    }

    const { data, error } = await query

    if (error) {
      return { source: 'supabase', data: [], error: error.message }
    }

    const rows = ((data || []) as DbAttendanceRow[]).map((row) =>
      mapDbRowToDailyRecord(row, options?.batchesById?.get(row.batch_id) || null),
    )
    return { source: 'supabase', data: rows }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load attendance records.',
    }
  }
}

export async function fetchBatchAttendanceAverages(
  batchIds: string[],
  supabase?: SupabaseClient,
): Promise<Map<string, BatchAttendanceAverage>> {
  const client = supabase ?? createClient()
  const result = new Map<string, BatchAttendanceAverage>()

  if (!batchIds.length) return result

  batchIds.forEach((batchId) => {
    result.set(batchId, { batchId, averageLabel: '—', averagePercent: 0 })
  })

  const [schedules, { data, error }] = await Promise.all([
    fetchBatchSchedulesById(batchIds, client),
    client
      .from('student_attendance_records')
      .select('batch_id, student_id, status, attendance_date')
      .in('batch_id', batchIds),
  ])

  if (error || !data?.length) return result

  const grouped = new Map<string, { status: AttendanceMark; date: string }[]>()

  for (const row of data as {
    batch_id: string
    student_id: string
    status: AttendanceMark
    attendance_date: string
  }[]) {
    const key = `${row.batch_id}:${row.student_id}`
    const list = grouped.get(key) || []
    list.push({ status: row.status, date: row.attendance_date })
    grouped.set(key, list)
  }

  const percentsByBatch = new Map<string, number[]>()

  grouped.forEach((records, key) => {
    const batchId = key.split(':')[0]
    const schedule = schedules.get(batchId)
    const percent = computeAttendancePercent(records, {
      startDate: schedule?.start_date,
      endDate: schedule?.end_date,
      classDayType: schedule?.class_day_type || 'weekdays',
    })
    const list = percentsByBatch.get(batchId) || []
    list.push(percent)
    percentsByBatch.set(batchId, list)
  })

  batchIds.forEach((batchId) => {
    const schedule = schedules.get(batchId)
    const expectedDays = listExpectedClassDays({
      startDate: schedule?.start_date,
      endDate: schedule?.end_date,
      classDayType: schedule?.class_day_type || 'weekdays',
    })
    const percents = percentsByBatch.get(batchId) || []
    const hasSchedule = expectedDays.length > 0
    const averagePercent = percents.length
      ? Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length)
      : hasSchedule
        ? 0
        : 0

    result.set(batchId, {
      batchId,
      averageLabel: formatAttendanceAverageLabel(averagePercent, hasSchedule || percents.length > 0),
      averagePercent,
    })
  })

  return result
}

/** Per student+batch attendance label for directory lists. Key: `${studentId}:${batchId}` */
export async function fetchEnrollmentAttendanceLabels(
  enrollments: { studentId: string; batchId: string }[],
  supabase?: SupabaseClient,
): Promise<Map<string, string>> {
  const client = supabase ?? createClient()
  const labels = new Map<string, string>()

  if (!enrollments.length) return labels

  const batchIds = Array.from(new Set(enrollments.map((item) => item.batchId).filter(Boolean)))
  const studentIds = Array.from(new Set(enrollments.map((item) => item.studentId).filter(Boolean)))

  enrollments.forEach((item) => {
    labels.set(`${item.studentId}:${item.batchId}`, '—')
  })

  if (!batchIds.length || !studentIds.length) return labels

  const [schedules, { data, error }] = await Promise.all([
    fetchBatchSchedulesById(batchIds, client),
    client
      .from('student_attendance_records')
      .select('batch_id, student_id, status, attendance_date')
      .in('batch_id', batchIds)
      .in('student_id', studentIds),
  ])

  if (error) return labels

  const grouped = new Map<string, { status: AttendanceMark; date: string }[]>()

  for (const row of (data || []) as {
    batch_id: string
    student_id: string
    status: AttendanceMark
    attendance_date: string
  }[]) {
    const key = `${row.student_id}:${row.batch_id}`
    const list = grouped.get(key) || []
    list.push({ status: row.status, date: row.attendance_date })
    grouped.set(key, list)
  }

  enrollments.forEach((item) => {
    const key = `${item.studentId}:${item.batchId}`
    const schedule = schedules.get(item.batchId)
    const expectedDays = listExpectedClassDays({
      startDate: schedule?.start_date,
      endDate: schedule?.end_date,
      classDayType: schedule?.class_day_type || 'weekdays',
    })
    if (!expectedDays.length) {
      labels.set(key, '—')
      return
    }

    const records = grouped.get(key) || []
    const percent = computeAttendancePercent(records, {
      startDate: schedule?.start_date,
      endDate: schedule?.end_date,
      classDayType: schedule?.class_day_type || 'weekdays',
    })
    labels.set(key, formatAttendanceAverageLabel(percent, true))
  })

  return labels
}

export function buildCourseAttendanceSummaries(
  batches: AttendanceBatch[],
  records: DailyAttendanceRecord[],
): CourseAttendanceSessionSummary[] {
  const batchMap = new Map(batches.map((batch) => [batch.id, batch]))
  const grouped = new Map<string, DailyAttendanceRecord[]>()

  records.forEach((record) => {
    const key = `${record.batchId}:${record.date}`
    const list = grouped.get(key) || []
    list.push(record)
    grouped.set(key, list)
  })

  return Array.from(grouped.entries())
    .map(([key, sessionRecords]) => {
      const [batchId, date] = key.split(':')
      const batch = batchMap.get(batchId)

      return {
        id: key,
        session: batch ? formatTimeRange(batch.start_time, batch.end_time) : sessionRecords[0]?.sessionTime || '—',
        date,
        batch: batch?.name || sessionRecords[0]?.batch || 'Unknown batch',
        status: 'Marked',
        present: sessionRecords.filter((record) => record.status === 'present').length,
        absent: sessionRecords.filter((record) => record.status === 'absent').length,
        late: sessionRecords.filter((record) => record.status === 'late').length,
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

export type SaveAttendanceMarkInput = {
  batchId: string
  attendanceDate: string
  classLink?: string
  marks: {
    studentId: string
    status: AttendanceMark
    note?: string
  }[]
}

export async function saveAttendanceMarks(
  payload: SaveAttendanceMarkInput,
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch('/api/admin/attendance', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const body = (await response.json()) as { error?: string }

  if (!response.ok) {
    return { ok: false, error: body.error || 'Failed to save attendance.' }
  }

  return { ok: true }
}

export async function fetchStudentsForBatches(
  batchIds: string[],
  supabase?: SupabaseClient,
): Promise<
  DataResult<
    {
      id: string
      full_name: string
      email: string
      phone: string
      status: string
      avatar_url: string | null
      batch_id: string
    }[]
  >
> {
  const client = supabase ?? createClient()

  if (!batchIds.length) {
    return { source: 'supabase', data: [] }
  }

  try {
    const { data, error } = await client
      .from('student_batch_enrollments')
      .select(
        `
        batch_id,
        student:students!inner (
          id,
          phone,
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
      .in('batch_id', batchIds)

    if (error) {
      return { source: 'supabase', data: [], error: error.message }
    }

    type Row = {
      batch_id: string
      student:
        | {
            id: string
            phone: string | null
            status: string
            profile_picture_url: string | null
            profile: { full_name: string | null; email: string | null; avatar_url: string | null } | { full_name: string | null; email: string | null; avatar_url: string | null }[] | null
          }
        | {
            id: string
            phone: string | null
            status: string
            profile_picture_url: string | null
            profile: { full_name: string | null; email: string | null; avatar_url: string | null } | { full_name: string | null; email: string | null; avatar_url: string | null }[] | null
          }[]
    }

    const rows = ((data || []) as Row[])
      .map((row) => {
        const student = unwrap(row.student)
        const profile = unwrap(student?.profile)

        if (!student) return null

        return {
          id: student.id,
          full_name: profile?.full_name?.trim() || 'Unknown',
          email: profile?.email?.trim() || '',
          phone: student.phone?.trim() || '',
          status: student.status,
          avatar_url: profile?.avatar_url || student.profile_picture_url,
          batch_id: row.batch_id,
        }
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))

    return { source: 'supabase', data: rows }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load batch students.',
    }
  }
}

export async function fetchStudentIdByProfile(
  profileId: string,
  supabase?: SupabaseClient,
): Promise<string | null> {
  const client = supabase ?? createClient()

  const { data } = await client.from('students').select('id').eq('profile_id', profileId).maybeSingle()

  return data?.id || null
}

export function mapBatchStudentsToAttendanceStudents(
  students: {
    id: string
    full_name: string
    email: string
    phone: string
    status: string
    avatar_url: string | null
  }[],
  batch: AttendanceBatch,
  records: DailyAttendanceRecord[],
): AttendanceStudent[] {
  const schedule = {
    startDate: batch.start_date,
    endDate: batch.end_date,
    classDayType: batch.class_day_type || 'weekdays',
    customDays: batch.custom_days,
  }
  const expectedDays = listExpectedClassDays(schedule)

  return students.map((student) => {
    const studentRecords = records.filter((record) => record.studentId === student.id)
    const percent = computeAttendancePercent(studentRecords, schedule)

    return {
      id: student.id,
      name: student.full_name,
      course: batch.course,
      batch: batch.name,
      batchId: batch.id,
      attendance: expectedDays.length > 0 ? `${percent}%` : '—',
      status: student.status,
      email: student.email,
      phone: student.phone,
      avatar_url: student.avatar_url,
    }
  })
}
