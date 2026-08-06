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

async function callerIsElevatedAdmin(userId: string) {
  if (await callerIsSuperAdmin(userId)) return true

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('parent_role_id')
    .eq('id', userId)
    .maybeSingle()

  return profile?.parent_role_id === 'company_admin'
}

async function callerCanReviewStage(userId: string, stage: ReviewStage) {
  if (await callerIsElevatedAdmin(userId)) return true

  const hasMentor = await callerHasPermission(userId, 'submissions.review')
  const hasHod =
    (await callerHasPermission(userId, 'hod_review.review')) ||
    (await callerHasPermission(userId, 'hod_review.approve'))
  const hasQa =
    (await callerHasPermission(userId, 'final_qa.validate')) ||
    (await callerHasPermission(userId, 'final_qa.approve'))

  // HOD / Final QA profiles often include submissions.review — do not let them
  // overwrite the mentor stage. Mentor stage is mentor/trainer-only.
  if (stage === 'mentor') {
    return hasMentor && !hasHod && !hasQa
  }

  if (stage === 'hod') {
    return hasHod
  }

  return hasQa
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

    const { data: existingSubmission } = await supabaseAdmin
      .from('task_submissions')
      .select(
        'id, status, mentor_decision, hod_decision, qa_decision, resubmit_deadline_date, resubmit_deadline_time, file_path, file_name, submitted_at, resubmitted_at, submit_attempts',
      )
      .eq('task_id', taskId)
      .eq('student_id', student.id)
      .maybeSingle()

    const isResubmitAllowed =
      existingSubmission &&
      (existingSubmission.status === 'revision' ||
        existingSubmission.status === 'rejected' ||
        existingSubmission.mentor_decision === 'revision_requested' ||
        existingSubmission.mentor_decision === 'rejected' ||
        existingSubmission.hod_decision === 'revision_requested' ||
        existingSubmission.hod_decision === 'rejected' ||
        existingSubmission.qa_decision === 'revision_requested' ||
        existingSubmission.qa_decision === 'rejected')

    const today = new Date().toISOString().slice(0, 10)
    const now = new Date()

    if (isResubmitAllowed) {
      const resubmitDate = existingSubmission.resubmit_deadline_date
        ? String(existingSubmission.resubmit_deadline_date).slice(0, 10)
        : null
      const resubmitTime = existingSubmission.resubmit_deadline_time
        ? String(existingSubmission.resubmit_deadline_time).slice(0, 5)
        : null

      if (resubmitDate) {
        const resubmitPassed = resubmitTime
          ? now > new Date(`${resubmitDate}T${resubmitTime}:00`)
          : today > resubmitDate

        if (resubmitPassed) {
          return NextResponse.json(
            { error: 'Re-upload deadline is over. You cannot resubmit this task now.' },
            { status: 400 },
          )
        }
      }
    } else {
      const dueTime = task.due_time ? String(task.due_time).slice(0, 5) : null
      const deadlinePassed = dueTime
        ? now > new Date(`${task.due_date}T${dueTime}:00`)
        : today > task.due_date

      if (deadlinePassed) {
        return NextResponse.json(
          { error: 'Submission date is over. You cannot submit this task now.' },
          { status: 400 },
        )
      }

      if (task.status === 'closed') {
        return NextResponse.json({ error: 'This task is closed.' }, { status: 400 })
      }
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

    let filePath: string | null = existingSubmission?.file_path || null
    let fileName: string | null = existingSubmission?.file_name || null

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

    const nowIso = new Date().toISOString()
    const previousAttempts = Number(existingSubmission?.submit_attempts || 0)

    const upsertPayload: Record<string, unknown> = {
      task_id: taskId,
      student_id: student.id,
      status: 'submitted',
      student_note: studentNote || null,
      file_path: filePath,
      file_name: fileName,
      updated_at: nowIso,
    }

    if (isResubmitAllowed) {
      // Keep original first submission date; record re-upload separately.
      upsertPayload.submitted_at = existingSubmission.submitted_at || nowIso
      upsertPayload.resubmitted_at = nowIso
      upsertPayload.submit_attempts = Math.max(previousAttempts, 1) + 1
      // Keep trainer re-upload deadline for history until a new revision request overwrites it.
      upsertPayload.resubmit_deadline_date = existingSubmission.resubmit_deadline_date || null
      upsertPayload.resubmit_deadline_time = existingSubmission.resubmit_deadline_time || null

      upsertPayload.mentor_mark = null
      upsertPayload.mentor_comment = null
      upsertPayload.mentor_decision = 'pending'
      upsertPayload.mentor_reviewed_by = null
      upsertPayload.mentor_reviewed_at = null
      upsertPayload.hod_mark = null
      upsertPayload.hod_comment = null
      upsertPayload.hod_decision = 'pending'
      upsertPayload.hod_reviewed_by = null
      upsertPayload.hod_reviewed_at = null
      upsertPayload.qa_mark = null
      upsertPayload.qa_comment = null
      upsertPayload.qa_decision = 'pending'
      upsertPayload.qa_reviewed_by = null
      upsertPayload.qa_reviewed_at = null
    } else {
      upsertPayload.submitted_at = existingSubmission?.submitted_at || nowIso
      upsertPayload.resubmitted_at = existingSubmission?.resubmitted_at || null
      upsertPayload.submit_attempts = previousAttempts > 0 ? previousAttempts : 1
    }

    const { data: submissionRow, error: upsertError } = await supabaseAdmin
      .from('task_submissions')
      .upsert(upsertPayload, { onConflict: 'task_id,student_id' })
      .select('id')
      .single()

    if (upsertError || !submissionRow) {
      if (submissionFile && filePath && filePath !== existingSubmission?.file_path) {
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
      resubmitDeadlineDate?: string
      resubmitDeadlineTime?: string
    }

    const submissionId = String(body.submissionId || '').trim()
    const stage = body.stage
    const decision = body.decision || 'pending'
    const mark = parseMark(String(body.mark || ''))
    const comment = String(body.comment || '').trim()
    const resubmitDeadlineDate = String(body.resubmitDeadlineDate || '').trim()
    const resubmitDeadlineTime = String(body.resubmitDeadlineTime || '').trim().slice(0, 5)

    if (!submissionId || !stage) {
      return NextResponse.json({ error: 'Submission id and review stage are required.' }, { status: 400 })
    }

    if (!['mentor', 'hod', 'qa'].includes(stage)) {
      return NextResponse.json({ error: 'Invalid review stage.' }, { status: 400 })
    }

    if (decision === 'approved' && mark === null) {
      return NextResponse.json({ error: 'Mark is required before approval.' }, { status: 400 })
    }

    if (
      (decision === 'rejected' || decision === 'revision_requested') &&
      !resubmitDeadlineDate
    ) {
      return NextResponse.json(
        { error: 'Re-upload deadline date is required for reject or revision request.' },
        { status: 400 },
      )
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

    const { data: currentSubmission } = await supabaseAdmin
      .from('task_submissions')
      .select('mentor_decision, hod_decision')
      .eq('id', submissionId)
      .maybeSingle()

    if (stage === 'hod' && currentSubmission?.mentor_decision !== 'approved') {
      return NextResponse.json(
        { error: 'HOD review is available only after mentor approval.' },
        { status: 400 },
      )
    }

    if (stage === 'qa' && currentSubmission?.hod_decision !== 'approved') {
      return NextResponse.json(
        { error: 'Final QA review is available only after HOD approval.' },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const payload: Record<string, unknown> = {
      status: mapDecisionToStatus(decision, stage),
      updated_at: now,
    }

    if (decision === 'rejected' || decision === 'revision_requested') {
      payload.resubmit_deadline_date = resubmitDeadlineDate
      payload.resubmit_deadline_time = resubmitDeadlineTime || null
    } else {
      payload.resubmit_deadline_date = null
      payload.resubmit_deadline_time = null
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
      // HOD rejection restarts from mentor review.
      if (decision === 'rejected' || decision === 'revision_requested') {
        payload.mentor_decision = 'pending'
        payload.mentor_mark = null
        payload.mentor_comment = null
        payload.mentor_reviewed_by = null
        payload.mentor_reviewed_at = null
        payload.qa_decision = 'pending'
        payload.qa_mark = null
        payload.qa_comment = null
        payload.qa_reviewed_by = null
        payload.qa_reviewed_at = null
      }
    }

    if (stage === 'qa') {
      payload.qa_mark = mark
      payload.qa_comment = comment || null
      payload.qa_decision = decision
      payload.qa_reviewed_by = caller.id
      payload.qa_reviewed_at = now
      // Final QA rejection restarts from mentor review.
      if (decision === 'rejected' || decision === 'revision_requested') {
        payload.mentor_decision = 'pending'
        payload.mentor_mark = null
        payload.mentor_comment = null
        payload.mentor_reviewed_by = null
        payload.mentor_reviewed_at = null
        payload.hod_decision = 'pending'
        payload.hod_mark = null
        payload.hod_comment = null
        payload.hod_reviewed_by = null
        payload.hod_reviewed_at = null
      }
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
