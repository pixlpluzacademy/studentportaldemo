import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataResult } from '@/lib/data/config'
import { createClient } from '@/lib/supabase/client'

export type TaskUiStatus = 'Open' | 'Review' | 'Closed'
export type TaskFrequency = 'Daily' | 'Weekly' | 'One-time'

export type TaskListRow = {
  id: string
  title: string
  description: string
  course: string
  batch: string
  batchId: string
  assignedBy: string
  frequency: TaskFrequency
  due: string
  dueTime: string | null
  dueDisplay: string
  submissions: string
  status: TaskUiStatus
  fileRequirement: string
  attachmentName: string
  attachmentPath: string | null
  studentSubmitted: boolean
  studentSubmissionId: string | null
}

export type TaskBatchLookup = {
  name: string
  courseName: string
  enrolledCount: number
}

export type BatchTaskStats = {
  batchId: string
  tasksCount: number
  submissionsCount: number
  progress: number
}

export type CourseTaskRow = {
  id: string
  title: string
  batch: string
  batchId: string
  assignedBy: string
  due: string
  submissions: string
  status: TaskUiStatus
}

type DbTaskStatus = 'open' | 'review' | 'closed'
type DbTaskFrequency = 'daily' | 'weekly' | 'one_time'
type DbSubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'revision'
  | 'rejected'

type DbTaskRow = {
  id: string
  batch_id: string
  student_id: string | null
  title: string
  description: string | null
  frequency: DbTaskFrequency
  due_date: string
  due_time: string | null
  file_requirement: string | null
  attachment_path: string | null
  attachment_name: string | null
  status: DbTaskStatus
  assigner: { full_name: string | null } | { full_name: string | null }[] | null
}

const submittedStatuses: DbSubmissionStatus[] = [
  'submitted',
  'in_review',
  'approved',
  'revision',
  'rejected',
]

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] || null : value
}

function normalizeDueTimeValue(value: string | null | undefined): string | null {
  if (!value) return null
  return value.slice(0, 5)
}

export function formatTaskDueTimeLabel(dueTime: string | null | undefined): string {
  const normalized = normalizeDueTimeValue(dueTime)
  if (!normalized) return ''

  const [hours, minutes] = normalized.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)

  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function formatTaskDueDisplay(dueDate: string, dueTime?: string | null): string {
  const timeLabel = formatTaskDueTimeLabel(dueTime)
  return timeLabel ? `${dueDate} · ${timeLabel}` : dueDate
}

export function isTaskSubmissionClosed(dueDate: string, dueTime?: string | null): boolean {
  if (!dueDate) return false

  const normalizedTime = normalizeDueTimeValue(dueTime)

  if (!normalizedTime) {
    const today = new Date().toISOString().slice(0, 10)
    return today > dueDate
  }

  const deadline = new Date(`${dueDate}T${normalizedTime}:00`)
  return new Date() > deadline
}

function mapTaskStatusLabel(status: DbTaskStatus, dueDate: string, dueTime?: string | null): TaskUiStatus {
  if (status === 'review') return 'Review'
  if (status === 'closed' || isTaskSubmissionClosed(dueDate, dueTime)) return 'Closed'
  return 'Open'
}

function mapFrequencyLabel(frequency: DbTaskFrequency): TaskFrequency {
  if (frequency === 'daily') return 'Daily'
  if (frequency === 'weekly') return 'Weekly'
  return 'One-time'
}

export function mapFrequencyToDb(frequency: string): DbTaskFrequency {
  const value = frequency.toLowerCase()
  if (value === 'daily') return 'daily'
  if (value === 'weekly') return 'weekly'
  return 'one_time'
}

function mapDbTaskRow(
  row: DbTaskRow,
  options?: {
    batchLookup?: Map<string, TaskBatchLookup>
    submissionCounts?: Map<string, number>
    studentSubmissionTaskIds?: Set<string>
    studentSubmissionIds?: Map<string, string>
    studentId?: string | null
  },
): TaskListRow {
  const assigner = unwrap(row.assigner)
  const batchMeta = options?.batchLookup?.get(row.batch_id)
  const batchName = batchMeta?.name || 'Batch'
  const courseName = batchMeta?.courseName || 'Course'
  const enrolled = batchMeta?.enrolledCount || 0
  const submittedCount = options?.submissionCounts?.get(row.id) || 0
  const studentSubmitted = options?.studentSubmissionTaskIds?.has(row.id) || false

  return {
    id: row.id,
    title: row.title,
    description: row.description?.trim() || '',
    course: courseName,
    batch: batchName,
    batchId: row.batch_id,
    assignedBy: assigner?.full_name?.trim() || 'Staff',
    frequency: mapFrequencyLabel(row.frequency),
    due: row.due_date,
    dueTime: normalizeDueTimeValue(row.due_time),
    dueDisplay: formatTaskDueDisplay(row.due_date, row.due_time),
    submissions: options?.studentId
      ? studentSubmitted
        ? 'Submitted'
        : 'Pending'
      : `${submittedCount}/${Math.max(enrolled, 0)}`,
    status: mapTaskStatusLabel(row.status, row.due_date, row.due_time),
    fileRequirement:
      row.file_requirement?.trim() ||
      'Student must upload the requested work file before the submission date.',
    attachmentName: row.attachment_name?.trim() || '',
    attachmentPath: row.attachment_path,
    studentSubmitted,
    studentSubmissionId: options?.studentSubmissionIds?.get(row.id) || null,
  }
}

export function computeBatchTaskProgress(input: {
  tasksCount: number
  submissionsCount: number
  studentsCount: number
  studentMode?: boolean
}) {
  if (input.tasksCount <= 0) return 0

  if (input.studentMode) {
    return Math.min(100, Math.round((input.submissionsCount / input.tasksCount) * 100))
  }

  const denominator = input.tasksCount * Math.max(input.studentsCount, 1)
  return Math.min(100, Math.round((input.submissionsCount / denominator) * 100))
}

export async function fetchStudentIdByProfileId(
  profileId: string,
  supabase?: SupabaseClient,
): Promise<string | null> {
  const client = supabase ?? createClient()
  const { data } = await client.from('students').select('id').eq('profile_id', profileId).maybeSingle()
  return data?.id || null
}

export async function fetchBatchTaskStats(
  batchIds: string[],
  options?: {
    studentId?: string | null
    enrolledCounts?: Map<string, number>
    supabase?: SupabaseClient
  },
): Promise<Map<string, BatchTaskStats>> {
  const client = options?.supabase ?? createClient()
  const result = new Map<string, BatchTaskStats>()

  batchIds.forEach((batchId) => {
    result.set(batchId, {
      batchId,
      tasksCount: 0,
      submissionsCount: 0,
      progress: 0,
    })
  })

  if (!batchIds.length) return result

  let tasksQuery = client.from('tasks').select('id, batch_id, student_id').in('batch_id', batchIds)

  const { data: tasks, error: tasksError } = await tasksQuery

  if (tasksError || !tasks?.length) {
    return result
  }

  const visibleTasks = (tasks as { id: string; batch_id: string; student_id: string | null }[]).filter(
    (task) => {
      if (!options?.studentId) return true
      return task.student_id === null || task.student_id === options.studentId
    },
  )

  const taskIds = visibleTasks.map((task) => task.id)

  const taskCountByBatch = new Map<string, number>()
  visibleTasks.forEach((task) => {
    taskCountByBatch.set(task.batch_id, (taskCountByBatch.get(task.batch_id) || 0) + 1)
  })

  let submissionCountByBatch = new Map<string, number>()

  if (taskIds.length) {
    let submissionsQuery = client
      .from('task_submissions')
      .select('id, task_id, student_id, status')
      .in('task_id', taskIds)
      .in('status', submittedStatuses)

    if (options?.studentId) {
      submissionsQuery = submissionsQuery.eq('student_id', options.studentId)
    }

    const { data: submissions } = await submissionsQuery

    const taskBatchMap = new Map(visibleTasks.map((task) => [task.id, task.batch_id]))

    submissionCountByBatch = (submissions || []).reduce((map, row) => {
      const batchId = taskBatchMap.get(row.task_id)
      if (!batchId) return map
      map.set(batchId, (map.get(batchId) || 0) + 1)
      return map
    }, new Map<string, number>())
  }

  batchIds.forEach((batchId) => {
    const tasksCount = taskCountByBatch.get(batchId) || 0
    const submissionsCount = submissionCountByBatch.get(batchId) || 0
    const studentsCount = options?.enrolledCounts?.get(batchId) || 0

    result.set(batchId, {
      batchId,
      tasksCount,
      submissionsCount,
      progress: computeBatchTaskProgress({
        tasksCount,
        submissionsCount,
        studentsCount,
        studentMode: Boolean(options?.studentId),
      }),
    })
  })

  return result
}

export async function fetchTaskList(
  batchIds: string[],
  options?: {
    studentId?: string | null
    batchLookup?: Map<string, TaskBatchLookup>
    supabase?: SupabaseClient
  },
): Promise<DataResult<TaskListRow[]>> {
  const client = options?.supabase ?? createClient()

  if (!batchIds.length) {
    return { source: 'supabase', data: [] }
  }

  try {
    const { data, error } = await client
      .from('tasks')
      .select(
        `
        id,
        batch_id,
        student_id,
        title,
        description,
        frequency,
        due_date,
        due_time,
        file_requirement,
        attachment_path,
        attachment_name,
        status,
        assigner:profiles!tasks_assigned_by_fkey (
          full_name
        )
      `,
      )
      .in('batch_id', batchIds)
      .order('due_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return { source: 'supabase', data: [], error: error.message }
    }

    const rows = ((data || []) as DbTaskRow[]).filter((task) => {
      if (!options?.studentId) return true
      return task.student_id === null || task.student_id === options.studentId
    })

    const taskIds = rows.map((task) => task.id)
    const submissionCounts = new Map<string, number>()
    const studentSubmissionTaskIds = new Set<string>()
    const studentSubmissionIds = new Map<string, string>()

    if (taskIds.length) {
      let submissionsQuery = client
        .from('task_submissions')
        .select('id, task_id, student_id, status')
        .in('task_id', taskIds)
        .in('status', submittedStatuses)

      if (options?.studentId) {
        submissionsQuery = submissionsQuery.eq('student_id', options.studentId)
      }

      const { data: submissions } = await submissionsQuery

      ;(submissions || []).forEach((row) => {
        submissionCounts.set(row.task_id, (submissionCounts.get(row.task_id) || 0) + 1)
        if (options?.studentId && row.student_id === options.studentId) {
          studentSubmissionTaskIds.add(row.task_id)
          studentSubmissionIds.set(row.task_id, row.id)
        }
      })
    }

    return {
      source: 'supabase',
      data: rows.map((row) =>
        mapDbTaskRow(row, {
          batchLookup: options?.batchLookup,
          submissionCounts,
          studentSubmissionTaskIds,
          studentSubmissionIds,
          studentId: options?.studentId,
        }),
      ),
    }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load tasks.',
    }
  }
}

export async function fetchTaskById(
  taskId: string,
  options?: {
    batchLookup?: Map<string, TaskBatchLookup>
    studentId?: string | null
    supabase?: SupabaseClient
  },
): Promise<DataResult<TaskListRow | null>> {
  const client = options?.supabase ?? createClient()

  if (!taskId) {
    return { source: 'supabase', data: null, error: 'Task id is required.' }
  }

  try {
    const { data, error } = await client
      .from('tasks')
      .select(
        `
        id,
        batch_id,
        student_id,
        title,
        description,
        frequency,
        due_date,
        due_time,
        file_requirement,
        attachment_path,
        attachment_name,
        status,
        assigner:profiles!tasks_assigned_by_fkey (
          full_name
        )
      `,
      )
      .eq('id', taskId)
      .maybeSingle()

    if (error) {
      return { source: 'supabase', data: null, error: error.message }
    }

    if (!data) {
      return { source: 'supabase', data: null, error: 'Task not found.' }
    }

    const row = data as DbTaskRow

    if (options?.studentId && row.student_id && row.student_id !== options.studentId) {
      return { source: 'supabase', data: null, error: 'Task not found.' }
    }

    const submissionCounts = new Map<string, number>()
    const studentSubmissionTaskIds = new Set<string>()
    const studentSubmissionIds = new Map<string, string>()

    let submissionsQuery = client
      .from('task_submissions')
      .select('id, task_id, student_id, status')
      .eq('task_id', taskId)
      .in('status', submittedStatuses)

    if (options?.studentId) {
      submissionsQuery = submissionsQuery.eq('student_id', options.studentId)
    }

    const { data: submissions } = await submissionsQuery

    ;(submissions || []).forEach((submission) => {
      submissionCounts.set(submission.task_id, (submissionCounts.get(submission.task_id) || 0) + 1)
      if (options?.studentId && submission.student_id === options.studentId) {
        studentSubmissionTaskIds.add(submission.task_id)
        studentSubmissionIds.set(submission.task_id, submission.id)
      }
    })

    return {
      source: 'supabase',
      data: mapDbTaskRow(row, {
        batchLookup: options?.batchLookup,
        submissionCounts,
        studentSubmissionTaskIds,
        studentSubmissionIds,
        studentId: options?.studentId,
      }),
    }
  } catch (error) {
    return {
      source: 'supabase',
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load task.',
    }
  }
}

export async function getTaskBriefUrl(
  taskId: string,
  accessToken: string,
  options?: { inline?: boolean },
): Promise<{ url?: string; fileName?: string; error?: string }> {
  const params = new URLSearchParams({ id: taskId })
  if (options?.inline) {
    params.set('inline', '1')
  }

  const response = await fetch(`/api/admin/tasks?${params.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const payload = (await response.json()) as { url?: string; fileName?: string; error?: string }

  if (!response.ok) {
    return { error: payload.error || 'Failed to prepare file link.' }
  }

  return { url: payload.url, fileName: payload.fileName }
}

export async function openTaskBriefFile(
  task: Pick<TaskListRow, 'id' | 'attachmentName' | 'attachmentPath'>,
  accessToken: string,
  mode: 'view' | 'download',
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!task.attachmentPath && !task.attachmentName) {
    return { ok: false, error: 'No brief file available.' }
  }

  const result = await getTaskBriefUrl(task.id, accessToken, {
    inline: mode === 'view',
  })

  if (!result.url) {
    return { ok: false, error: result.error || 'Failed to prepare file link.' }
  }

  if (mode === 'download') {
    const anchor = document.createElement('a')
    anchor.href = result.url
    anchor.download = result.fileName || task.attachmentName || 'task-brief'
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  } else {
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  return { ok: true, url: result.url }
}

export function getStudentTaskSubmitHref(task: Pick<TaskListRow, 'id'>): string {
  return `/task-submissions/submit/${task.id}`
}

export async function createTask(
  formData: FormData,
  accessToken: string,
): Promise<{ ok: boolean; error?: string; taskId?: string }> {
  const response = await fetch('/api/admin/tasks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  })

  const payload = (await response.json()) as { error?: string; taskId?: string }

  if (!response.ok) {
    return { ok: false, error: payload.error || 'Failed to create task.' }
  }

  return { ok: true, taskId: payload.taskId }
}

export async function deleteTask(
  taskId: string,
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`/api/admin/tasks?id=${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const payload = (await response.json()) as { error?: string }

  if (!response.ok) {
    return { ok: false, error: payload.error || 'Failed to delete task.' }
  }

  return { ok: true }
}

export async function submitTask(
  taskId: string,
  accessToken: string,
  options?: { studentNote?: string; submissionFile?: File | null },
): Promise<{ ok: boolean; error?: string; submissionId?: string }> {
  const useFormData = Boolean(options?.submissionFile)

  const response = await fetch('/api/admin/task-submissions', {
    method: 'POST',
    headers: useFormData
      ? { Authorization: `Bearer ${accessToken}` }
      : {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
    body: useFormData
      ? (() => {
          const payload = new FormData()
          payload.append('taskId', taskId)
          if (options?.studentNote) payload.append('studentNote', options.studentNote)
          if (options?.submissionFile) payload.append('submissionFile', options.submissionFile)
          return payload
        })()
      : JSON.stringify({ taskId, studentNote: options?.studentNote || '' }),
  })

  const payload = (await response.json()) as { error?: string; submissionId?: string }

  if (!response.ok) {
    return { ok: false, error: payload.error || 'Failed to submit task.' }
  }

  return { ok: true, submissionId: payload.submissionId }
}

export async function fetchTasksForBatches(
  batchIds: string[],
  options?: {
    studentId?: string | null
    batchNames?: Map<string, string>
    enrolledCounts?: Map<string, number>
    supabase?: SupabaseClient
  },
): Promise<DataResult<CourseTaskRow[]>> {
  const client = options?.supabase ?? createClient()

  if (!batchIds.length) {
    return { source: 'supabase', data: [] }
  }

  try {
    const { data, error } = await client
      .from('tasks')
      .select(
        `
        id,
        batch_id,
        student_id,
        title,
        due_date,
        due_time,
        status,
        assigner:profiles!tasks_assigned_by_fkey (
          full_name
        )
      `,
      )
      .in('batch_id', batchIds)
      .order('due_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return { source: 'supabase', data: [], error: error.message }
    }

    const rows = ((data || []) as DbTaskRow[]).filter((task) => {
      if (!options?.studentId) return true
      return task.student_id === null || task.student_id === options.studentId
    })

    const taskIds = rows.map((task) => task.id)
    const submissionCounts = new Map<string, number>()

    if (taskIds.length) {
      let submissionsQuery = client
        .from('task_submissions')
        .select('task_id')
        .in('task_id', taskIds)
        .in('status', submittedStatuses)

      if (options?.studentId) {
        submissionsQuery = submissionsQuery.eq('student_id', options.studentId)
      }

      const { data: submissions } = await submissionsQuery

      ;(submissions || []).forEach((row) => {
        submissionCounts.set(row.task_id, (submissionCounts.get(row.task_id) || 0) + 1)
      })
    }

    const mapped = rows.map((task) => {
        const assigner = unwrap(task.assigner)
        const batchName = options?.batchNames?.get(task.batch_id) || 'Batch'
        const enrolled = options?.enrolledCounts?.get(task.batch_id) || 0
        const submittedCount = submissionCounts.get(task.id) || 0
        const denominator = options?.studentId ? 1 : Math.max(enrolled, 0)

        return {
          id: task.id,
          title: task.title,
          batch: batchName,
          batchId: task.batch_id,
          assignedBy: assigner?.full_name?.trim() || 'Staff',
          due: task.due_date,
          dueTime: normalizeDueTimeValue(task.due_time),
          dueDisplay: formatTaskDueDisplay(task.due_date, task.due_time),
          submissions: options?.studentId ? (submittedCount > 0 ? 'Submitted' : 'Pending') : `${submittedCount}/${denominator || 0}`,
          status: mapTaskStatusLabel(task.status, task.due_date, task.due_time),
        }
      })

    return { source: 'supabase', data: mapped }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load tasks.',
    }
  }
}

export { mapFrequencyLabel }
