import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { callerHasPermission, getCallerFromBearerToken } from '@/lib/auth/admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

const TASK_FILES_BUCKET = 'task-submissions'

type ReviewStage = 'mentor' | 'hod' | 'qa'
type DbReviewDecision = 'pending' | 'approved' | 'rejected' | 'revision_requested'

async function callerIsSuperAdmin(userId: string) {
  const { data } = await supabaseAdmin.rpc('is_super_admin', { p_user_id: userId })
  return Boolean(data)
}

async function callerCanAccessSubmission(userId: string, batchId: string) {
  if (await callerIsSuperAdmin(userId)) return true

  const { data: enrolled } = await supabaseAdmin.rpc('user_enrolled_in_batch', {
    p_batch_id: batchId,
    p_user_id: userId,
  })

  if (enrolled) return true

  const { data: assignment } = await supabaseAdmin
    .from('batch_staff_assignments')
    .select('id')
    .eq('batch_id', batchId)
    .eq('user_id', userId)
    .maybeSingle()

  if (assignment) return true

  if (!(await callerHasPermission(userId, 'submissions.view'))) {
    return false
  }

  const { data: batch } = await supabaseAdmin.from('batches').select('branch_id').eq('id', batchId).maybeSingle()

  if (!batch?.branch_id) return false

  const { data: branchAssignment } = await supabaseAdmin
    .from('user_branch_assignments')
    .select('id')
    .eq('user_id', userId)
    .eq('branch_id', batch.branch_id)
    .maybeSingle()

  return Boolean(branchAssignment)
}

async function getSubmissionBatchId(submissionId: string) {
  const { data } = await supabaseAdmin
    .from('task_submissions')
    .select('id, task:tasks(batch_id)')
    .eq('id', submissionId)
    .maybeSingle()

  const task = Array.isArray(data?.task) ? data?.task[0] : data?.task
  return task?.batch_id as string | undefined
}

function parseMark(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (Number.isNaN(parsed)) return null
  return parsed
}

function mapDecisionToStatus(decision: DbReviewDecision, stage: ReviewStage): string {
  if (decision === 'approved') {
    if (stage === 'qa') return 'approved'
    return 'in_review'
  }
  if (decision === 'rejected') return 'rejected'
  if (decision === 'revision_requested') return 'revision'
  return 'submitted'
}

async function callerCanReviewStage(userId: string, stage: ReviewStage) {
  if (await callerIsSuperAdmin(userId)) return true

  if (stage === 'mentor') {
    return callerHasPermission(userId, 'submissions.review')
  }

  if (stage === 'hod') {
    return (
      (await callerHasPermission(userId, 'hod_review.review')) ||
      (await callerHasPermission(userId, 'hod_review.approve'))
    )
  }

  return (
    (await callerHasPermission(userId, 'final_qa.validate')) ||
    (await callerHasPermission(userId, 'final_qa.approve'))
  )
}

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    const submissionId = new URL(request.url).searchParams.get('id')?.trim()
    const inline = new URL(request.url).searchParams.get('inline') === '1'

    if (!submissionId) {
      return NextResponse.json({ error: 'Submission id is required.' }, { status: 400 })
    }

    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('task_submissions')
      .select('id, file_path, file_name, task:tasks(batch_id)')
      .eq('id', submissionId)
      .maybeSingle()

    if (submissionError || !submission) {
      return NextResponse.json({ error: 'Submission not found.' }, { status: 404 })
    }

    if (!submission.file_path) {
      return NextResponse.json({ error: 'No submission file available.' }, { status: 404 })
    }

    const task = Array.isArray(submission.task) ? submission.task[0] : submission.task
    const batchId = task?.batch_id as string | undefined

    if (!batchId) {
      return NextResponse.json({ error: 'Submission batch not found.' }, { status: 404 })
    }

    const canAccess = await callerCanAccessSubmission(caller.id, batchId)

    if (!canAccess) {
      return NextResponse.json({ error: 'You do not have permission to view this submission file.' }, { status: 403 })
    }

    const signedUrlResult = inline
      ? await supabaseAdmin.storage
          .from(TASK_FILES_BUCKET)
          .createSignedUrl(submission.file_path, 60 * 60)
      : await supabaseAdmin.storage
          .from(TASK_FILES_BUCKET)
          .createSignedUrl(submission.file_path, 60 * 60, {
            download: submission.file_name || 'submission',
          })

    if (signedUrlResult.error || !signedUrlResult.data?.signedUrl) {
      return NextResponse.json(
        { error: signedUrlResult.error?.message || 'Failed to create download link.' },
        { status: 400 },
      )
    }

    return NextResponse.json({
      url: signedUrlResult.data.signedUrl,
      fileName: submission.file_name,
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while preparing download.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    if (!(await callerHasPermission(caller.id, 'submissions.submit')) && !(await callerIsSuperAdmin(caller.id))) {
      return NextResponse.json({ error: 'You do not have permission to submit tasks.' }, { status: 403 })
    }

    const contentType = request.headers.get('content-type') || ''
    let taskId = ''
    let studentNote = ''
    let submissionFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      taskId = String(formData.get('taskId') || '').trim()
      studentNote = String(formData.get('studentNote') || '').trim()
      submissionFile = formData.get('submissionFile') as File | null
    } else {
      const body = (await request.json()) as { taskId?: string; studentNote?: string }
      taskId = String(body.taskId || '').trim()
      studentNote = String(body.studentNote || '').trim()
    }

    if (!taskId) {
      return NextResponse.json({ error: 'Task id is required.' }, { status: 400 })
    }

    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('profile_id', caller.id)
      .maybeSingle()

    if (studentError || !student) {
      return NextResponse.json({ error: 'Student profile not found.' }, { status: 400 })
    }

    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, batch_id, due_date, due_time, student_id, status')
      .eq('id', taskId)
      .maybeSingle()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const now = new Date()
    const dueTime = task.due_time ? String(task.due_time).slice(0, 5) : null
    const deadlinePassed = dueTime
      ? now > new Date(`${task.due_date}T${dueTime}:00`)
      : today > task.due_date

    if (deadlinePassed) {
      return NextResponse.json({ error: 'Submission date is over. You cannot submit this task now.' }, { status: 400 })
    }

    if (task.status === 'closed') {
      return NextResponse.json({ error: 'This task is closed.' }, { status: 400 })
    }

    const { data: enrolled } = await supabaseAdmin.rpc('user_enrolled_in_batch', {
      p_batch_id: task.batch_id,
      p_user_id: caller.id,
    })

    if (!enrolled) {
      return NextResponse.json({ error: 'You are not enrolled in this task batch.' }, { status: 403 })
    }

    if (task.student_id && task.student_id !== student.id) {
      return NextResponse.json({ error: 'This task is not assigned to you.' }, { status: 403 })
    }

    let filePath: string | null = null
    let fileName: string | null = null

    if (submissionFile && submissionFile.size > 0) {
      const sanitizedName = submissionFile.name.replace(/[^\w.\-() ]+/g, '_')
      filePath = `submissions/${task.batch_id}/${randomUUID()}/${sanitizedName}`
      fileName = submissionFile.name

      const { error: uploadError } = await supabaseAdmin.storage
        .from(TASK_FILES_BUCKET)
        .upload(filePath, submissionFile, {
          upsert: false,
          contentType: submissionFile.type || 'application/octet-stream',
        })

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 400 })
      }
    }

    const { data: submissionRow, error: upsertError } = await supabaseAdmin
      .from('task_submissions')
      .upsert(
        {
          task_id: taskId,
          student_id: student.id,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          student_note: studentNote || null,
          file_path: filePath,
          file_name: fileName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'task_id,student_id' },
      )
      .select('id')
      .single()

    if (upsertError || !submissionRow) {
      if (filePath) {
        await supabaseAdmin.storage.from(TASK_FILES_BUCKET).remove([filePath])
      }
      return NextResponse.json({ error: upsertError?.message || 'Could not save submission.' }, { status: 400 })
    }

    return NextResponse.json({ success: true, submissionId: submissionRow.id })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while submitting the task.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    const body = (await request.json()) as {
      submissionId?: string
      stage?: ReviewStage
      mark?: string
      comment?: string
      decision?: DbReviewDecision
    }

    const submissionId = String(body.submissionId || '').trim()
    const stage = body.stage
    const decision = body.decision || 'pending'
    const mark = parseMark(String(body.mark || ''))
    const comment = String(body.comment || '').trim()

    if (!submissionId || !stage) {
      return NextResponse.json({ error: 'Submission id and review stage are required.' }, { status: 400 })
    }

    if (!['mentor', 'hod', 'qa'].includes(stage)) {
      return NextResponse.json({ error: 'Invalid review stage.' }, { status: 400 })
    }

    if (decision === 'approved' && mark === null) {
      return NextResponse.json({ error: 'Mark is required before approval.' }, { status: 400 })
    }

    const batchId = await getSubmissionBatchId(submissionId)

    if (!batchId) {
      return NextResponse.json({ error: 'Submission not found.' }, { status: 404 })
    }

    const canReview = await callerCanReviewStage(caller.id, stage)
    const canAccess = await callerCanAccessSubmission(caller.id, batchId)

    if (!canReview || !canAccess) {
      return NextResponse.json({ error: 'You do not have permission to review this submission.' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const payload: Record<string, unknown> = {
      status: mapDecisionToStatus(decision, stage),
      updated_at: now,
    }

    if (stage === 'mentor') {
      payload.mentor_mark = mark
      payload.mentor_comment = comment || null
      payload.mentor_decision = decision
      payload.mentor_reviewed_by = caller.id
      payload.mentor_reviewed_at = now
    }

    if (stage === 'hod') {
      payload.hod_mark = mark
      payload.hod_comment = comment || null
      payload.hod_decision = decision
      payload.hod_reviewed_by = caller.id
      payload.hod_reviewed_at = now
    }

    if (stage === 'qa') {
      payload.qa_mark = mark
      payload.qa_comment = comment || null
      payload.qa_decision = decision
      payload.qa_reviewed_by = caller.id
      payload.qa_reviewed_at = now
    }

    const { error: updateError } = await supabaseAdmin
      .from('task_submissions')
      .update(payload)
      .eq('id', submissionId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while saving the review.' }, { status: 500 })
  }
}
