import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataResult } from '@/lib/data/config'
import { createClient } from '@/lib/supabase/client'
import type { TaskBatchLookup } from '@/lib/data/tasks'

export type ReviewDecision = 'Pending' | 'Approved' | 'Rejected' | 'Revision Requested'
export type ReviewStage = 'mentor' | 'hod' | 'qa'

export type TaskSubmissionListRow = {
  id: string
  taskId: string
  student: string
  task: string
  course: string
  batch: string
  batchId: string
  mentor: string
  submitted: string
  status: string
  mentorMark: string
  hodMark: string
  qaMark: string
  mentorStatus: string
  hodStatus: string
  qaStatus: string
  fileName: string
  studentNote: string
}

export type TaskSubmissionDetailRow = TaskSubmissionListRow & {
  mentorComment: string
  mentorDecision: ReviewDecision
  hodComment: string
  hodDecision: ReviewDecision
  qaComment: string
  qaDecision: ReviewDecision
  filePath: string | null
}

type DbReviewDecision = 'pending' | 'approved' | 'rejected' | 'revision_requested'
type DbSubmissionStatus = 'draft' | 'submitted' | 'in_review' | 'approved' | 'revision' | 'rejected'

type DbTaskSubmissionRow = {
  id: string
  task_id: string
  student_id: string
  status: DbSubmissionStatus
  submitted_at: string | null
  student_note: string | null
  file_path: string | null
  file_name: string | null
  mentor_mark: number | null
  mentor_comment: string | null
  mentor_decision: DbReviewDecision
  hod_mark: number | null
  hod_comment: string | null
  hod_decision: DbReviewDecision
  qa_mark: number | null
  qa_comment: string | null
  qa_decision: DbReviewDecision
  task:
    | {
        id: string
        title: string
        batch_id: string
        assigner: { full_name: string | null } | { full_name: string | null }[] | null
      }
    | {
        id: string
        title: string
        batch_id: string
        assigner: { full_name: string | null } | { full_name: string | null }[] | null
      }[]
    | null
  student:
    | {
        id: string
        profile: { full_name: string | null } | { full_name: string | null }[] | null
      }
    | {
        id: string
        profile: { full_name: string | null } | { full_name: string | null }[] | null
      }[]
    | null
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] || null : value
}

function formatMark(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return String(value)
}

export function mapReviewDecisionLabel(decision: DbReviewDecision | null | undefined): ReviewDecision {
  if (decision === 'approved') return 'Approved'
  if (decision === 'rejected') return 'Rejected'
  if (decision === 'revision_requested') return 'Revision Requested'
  return 'Pending'
}

function mapReviewDecisionToDb(decision: ReviewDecision): DbReviewDecision {
  if (decision === 'Approved') return 'approved'
  if (decision === 'Rejected') return 'rejected'
  if (decision === 'Revision Requested') return 'revision_requested'
  return 'pending'
}

function formatSubmittedDate(value: string | null | undefined): string {
  if (!value) return '-'
  return value.slice(0, 10)
}

function mapSubmissionStatusLabel(status: DbSubmissionStatus): string {
  if (status === 'submitted') return 'Submitted'
  if (status === 'in_review') return 'In Review'
  if (status === 'approved') return 'Approved'
  if (status === 'revision') return 'Revision Requested'
  if (status === 'rejected') return 'Rejected'
  return 'Draft'
}

export function getReviewStageLabel(row: Pick<TaskSubmissionListRow, 'mentorStatus' | 'hodStatus' | 'qaStatus' | 'status'>): string {
  const qa = row.qaStatus.toLowerCase()
  const hod = row.hodStatus.toLowerCase()
  const mentor = row.mentorStatus.toLowerCase()

  if (qa.includes('approved')) return 'Final QA Completed'
  if (hod.includes('approved')) return 'Ready for Final QA'
  if (mentor.includes('approved') || mentor.includes('reviewed')) return 'Ready for HOD'
  if (row.status.toLowerCase().includes('submitted')) return 'Waiting for Mentor'
  return 'Waiting for Mentor'
}

function mapDbSubmissionRow(
  row: DbTaskSubmissionRow,
  batchLookup?: Map<string, TaskBatchLookup>,
): TaskSubmissionListRow {
  const task = unwrap(row.task)
  const student = unwrap(row.student)
  const studentProfile = unwrap(student?.profile)
  const assigner = unwrap(task?.assigner)
  const batchMeta = task?.batch_id ? batchLookup?.get(task.batch_id) : undefined

  const mentorDecision = mapReviewDecisionLabel(row.mentor_decision)
  const hodDecision = mapReviewDecisionLabel(row.hod_decision)
  const qaDecision = mapReviewDecisionLabel(row.qa_decision)

  return {
    id: row.id,
    taskId: row.task_id,
    student: studentProfile?.full_name?.trim() || 'Student',
    task: task?.title?.trim() || 'Task',
    course: batchMeta?.courseName || 'Course',
    batch: batchMeta?.name || 'Batch',
    batchId: task?.batch_id || '',
    mentor: assigner?.full_name?.trim() || 'Staff',
    submitted: formatSubmittedDate(row.submitted_at),
    status: mapSubmissionStatusLabel(row.status),
    mentorMark: formatMark(row.mentor_mark),
    hodMark: formatMark(row.hod_mark),
    qaMark: formatMark(row.qa_mark),
    mentorStatus: mentorDecision === 'Pending' ? 'Pending' : 'Reviewed',
    hodStatus: hodDecision,
    qaStatus: qaDecision,
    fileName: row.file_name?.trim() || '-',
    studentNote: row.student_note?.trim() || '',
  }
}

function mapDbSubmissionDetailRow(
  row: DbTaskSubmissionRow,
  batchLookup?: Map<string, TaskBatchLookup>,
): TaskSubmissionDetailRow {
  const listRow = mapDbSubmissionRow(row, batchLookup)

  return {
    ...listRow,
    mentorComment: row.mentor_comment?.trim() || '',
    mentorDecision: mapReviewDecisionLabel(row.mentor_decision),
    hodComment: row.hod_comment?.trim() || '',
    hodDecision: mapReviewDecisionLabel(row.hod_decision),
    qaComment: row.qa_comment?.trim() || '',
    qaDecision: mapReviewDecisionLabel(row.qa_decision),
    filePath: row.file_path,
  }
}

const submissionSelect = `
  id,
  task_id,
  student_id,
  status,
  submitted_at,
  student_note,
  file_path,
  file_name,
  mentor_mark,
  mentor_comment,
  mentor_decision,
  hod_mark,
  hod_comment,
  hod_decision,
  qa_mark,
  qa_comment,
  qa_decision,
  task:tasks (
    id,
    title,
    batch_id,
    assigner:profiles!tasks_assigned_by_fkey (
      full_name
    )
  ),
  student:students (
    id,
    profile:profiles (
      full_name
    )
  )
`

export async function fetchTaskSubmissions(options?: {
  batchLookup?: Map<string, TaskBatchLookup>
  supabase?: SupabaseClient
}): Promise<DataResult<TaskSubmissionListRow[]>> {
  const client = options?.supabase ?? createClient()

  try {
    const { data, error } = await client
      .from('task_submissions')
      .select(submissionSelect)
      .neq('status', 'draft')
      .order('submitted_at', { ascending: false })

    if (error) {
      return { source: 'supabase', data: [], error: error.message }
    }

    const rows = ((data || []) as DbTaskSubmissionRow[]).map((row) =>
      mapDbSubmissionRow(row, options?.batchLookup),
    )

    return { source: 'supabase', data: rows }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load task submissions.',
    }
  }
}

export async function fetchTaskSubmissionById(
  submissionId: string,
  options?: {
    batchLookup?: Map<string, TaskBatchLookup>
    supabase?: SupabaseClient
  },
): Promise<DataResult<TaskSubmissionDetailRow | null>> {
  const client = options?.supabase ?? createClient()

  if (!submissionId) {
    return { source: 'supabase', data: null, error: 'Submission id is required.' }
  }

  try {
    const { data, error } = await client
      .from('task_submissions')
      .select(submissionSelect)
      .eq('id', submissionId)
      .maybeSingle()

    if (error) {
      return { source: 'supabase', data: null, error: error.message }
    }

    if (!data) {
      return { source: 'supabase', data: null, error: 'Submission not found.' }
    }

    return {
      source: 'supabase',
      data: mapDbSubmissionDetailRow(data as DbTaskSubmissionRow, options?.batchLookup),
    }
  } catch (error) {
    return {
      source: 'supabase',
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load submission.',
    }
  }
}

export async function getTaskSubmissionFileUrl(
  submissionId: string,
  accessToken: string,
  options?: { inline?: boolean },
): Promise<{ url?: string; fileName?: string; error?: string }> {
  const params = new URLSearchParams({ id: submissionId })
  if (options?.inline) {
    params.set('inline', '1')
  }

  const response = await fetch(`/api/admin/task-submissions?${params.toString()}`, {
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

export async function openTaskSubmissionFile(
  submission: Pick<TaskSubmissionDetailRow, 'id' | 'fileName' | 'filePath'>,
  accessToken: string,
  mode: 'view' | 'download',
): Promise<{ ok: boolean; error?: string }> {
  if (!submission.filePath && !submission.fileName) {
    return { ok: false, error: 'No submission file available.' }
  }

  const result = await getTaskSubmissionFileUrl(submission.id, accessToken, {
    inline: mode === 'view',
  })

  if (!result.url) {
    return { ok: false, error: result.error || 'Failed to prepare file link.' }
  }

  if (mode === 'download') {
    const anchor = document.createElement('a')
    anchor.href = result.url
    anchor.download = result.fileName || submission.fileName || 'submission'
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  } else {
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  return { ok: true }
}

export async function updateTaskSubmissionReview(
  input: {
    submissionId: string
    stage: ReviewStage
    mark: string
    comment: string
    decision: ReviewDecision
  },
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch('/api/admin/task-submissions', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      submissionId: input.submissionId,
      stage: input.stage,
      mark: input.mark,
      comment: input.comment,
      decision: mapReviewDecisionToDb(input.decision),
    }),
  })

  const payload = (await response.json()) as { error?: string }

  if (!response.ok) {
    return { ok: false, error: payload.error || 'Failed to save review.' }
  }

  return { ok: true }
}

export function getFinalSubmissionStatus(submission: Pick<
  TaskSubmissionDetailRow,
  'mentorDecision' | 'hodDecision' | 'qaDecision'
>): string {
  if (submission.qaDecision === 'Approved') return 'Final QA Approved'
  if (submission.qaDecision === 'Rejected') return 'Rejected by Final QA'
  if (submission.hodDecision === 'Approved') return 'Waiting for Final QA'
  if (submission.hodDecision === 'Rejected') return 'Rejected by HOD'
  if (submission.mentorDecision === 'Approved') return 'Waiting for HOD'
  if (submission.mentorDecision === 'Rejected') return 'Rejected by Mentor'
  if (
    submission.mentorDecision === 'Revision Requested' ||
    submission.hodDecision === 'Revision Requested' ||
    submission.qaDecision === 'Revision Requested'
  ) {
    return 'Revision Requested'
  }
  return 'Waiting for Mentor Review'
}
