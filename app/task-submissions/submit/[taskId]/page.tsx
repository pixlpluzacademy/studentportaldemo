'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth/provider'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import { fetchAccessibleBatches, isStudentMyCoursesView } from '@/lib/data/my-courses'
import {
  fetchStudentIdByProfileId,
  fetchTaskById,
  getAssignmentTypeLabel,
  isTaskSubmissionClosed,
  openTaskBriefFile,
  submitTask,
  type TaskListRow,
} from '@/lib/data/tasks'
import { createClient } from '@/lib/supabase/client'

function getStatusClass(status: string) {
  const value = status.toLowerCase()

  if (value.includes('open')) {
    return 'border-[#153e90]/30 bg-[#153e90]/10 text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white'
  }

  if (value.includes('review')) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  }

  if (value.includes('closed')) {
    return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
  }

  return 'border-border bg-background text-foreground'
}

async function getAccessToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

export default function TaskSubmitPage() {
  const params = useParams()
  const router = useRouter()
  const taskId = String(params.taskId || '')
  const { can, user, parentRoleId } = useAuth()
  const { activeBranchId, loading: branchLoading } = useBranchScope()

  const [task, setTask] = useState<TaskListRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [studentNote, setStudentNote] = useState('')
  const [submissionFile, setSubmissionFile] = useState<File | null>(null)

  const isStudent = isStudentMyCoursesView(parentRoleId)

  useEffect(() => {
    if (!user?.id || !taskId || branchLoading) {
      return
    }

    if (!isStudent && !activeBranchId) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadTask() {
      setLoading(true)
      setError(null)

      const { batches } = await fetchAccessibleBatches({
        branchId: activeBranchId || '',
        userId: user!.id,
        parentRoleId,
      })

      if (cancelled) return

      const lookup = new Map(
        batches.map((batch) => [
          batch.id,
          {
            name: batch.name,
            courseName: batch.course_name,
            enrolledCount: batch.enrolled_count,
          },
        ]),
      )

      const studentId = isStudent ? await fetchStudentIdByProfileId(user!.id) : null
      const result = await fetchTaskById(taskId, {
        batchLookup: lookup,
        studentId,
      })

      if (cancelled) return

      setTask(result.data)
      setError(result.error || (result.data ? null : 'Task not found or not in your scope.'))
      setLoading(false)
    }

    void loadTask()

    return () => {
      cancelled = true
    }
  }, [activeBranchId, branchLoading, isStudent, parentRoleId, taskId, user?.id])

  const canResubmit = Boolean(task?.canResubmit)

  const displayStatus = useMemo(() => {
    if (!task) return ''
    if (task.canResubmit) return 'Revision Requested'
    const closed = isTaskSubmissionClosed(task.due, task.dueTime) || task.status === 'Closed'
    if (closed) return 'Submission Closed'
    if (task.studentSubmitted) return 'Submitted'
    return task.status
  }, [task])

  const closed = useMemo(() => {
    if (!task) return false
    if (task.canResubmit) return false
    return isTaskSubmissionClosed(task.due, task.dueTime) || task.status === 'Closed'
  }, [task])

  const handleSubmit = async () => {
    if (!task) return

    if (closed) {
      setNotice('Submission is closed for this task.')
      return
    }

    if (task.studentSubmitted && task.studentSubmissionId && !task.canResubmit) {
      router.push(`/task-submissions/${task.studentSubmissionId}`)
      return
    }

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setNotice('Session expired. Please login again.')
      return
    }

    setSubmitting(true)
    setNotice('')

    const result = await submitTask(task.id, accessToken, {
      studentNote: studentNote.trim(),
      submissionFile,
    })
    setSubmitting(false)

    if (!result.ok) {
      setNotice(result.error || 'Failed to submit task.')
      return
    }

    if (result.submissionId) {
      router.push(`/task-submissions/${result.submissionId}`)
      return
    }

    router.push('/task-submissions')
  }

  const handleBriefAction = async (mode: 'view' | 'download') => {
    if (!task) return

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setNotice('Session expired. Please login again.')
      return
    }

    const result = await openTaskBriefFile(task, accessToken, mode)

    if (!result.ok) {
      setNotice(result.error || 'Failed to open brief file.')
    }
  }

  if (!isStudent) {
    return (
      <div className="space-y-4">
        <Link href="/tasks" className="inline-flex border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">
          Back to Tasks
        </Link>
        <div className="border border-border bg-card p-8">
          <h1 className="text-2xl font-bold">Student Submission Only</h1>
          <p className="mt-2 text-muted-foreground">
            This page is for students to submit assigned tasks. Staff and admin roles should use Tasks or Task Submissions.
          </p>
        </div>
      </div>
    )
  }

  if (!can('submissions.submit')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Submission Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot submit tasks.</p>
      </div>
    )
  }

  if (loading || branchLoading) {
    return (
      <div className="border border-border bg-card p-8 text-sm text-muted-foreground">Loading submission page…</div>
    )
  }

  if (!task) {
    return (
      <div className="space-y-4">
        <Link href="/tasks" className="inline-flex border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">
          Back to Tasks
        </Link>
        <div className="border border-border bg-card p-8">
          <h1 className="text-2xl font-bold">Task Not Found</h1>
          <p className="mt-2 text-muted-foreground">{error || 'This task is not available in your scope.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <Link href="/tasks" className="inline-flex border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">
            Back to Tasks
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`border px-2 py-1 text-xs font-semibold ${getStatusClass(displayStatus)}`}>
              {displayStatus}
            </span>
            <span className="border border-border bg-background px-2 py-1 text-xs font-semibold">{getAssignmentTypeLabel(task.frequency)}</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{task.title}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">{task.description}</p>
        </div>
      </div>

      {notice && (
        <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
          {notice}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">Course</div>
          <div className="mt-1 font-semibold">{task.course}</div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">Batch</div>
          <div className="mt-1 font-semibold">{task.batch}</div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">
            {canResubmit ? 'Re-upload Deadline' : 'Submission Deadline'}
          </div>
          <div className="mt-1 font-semibold">
            {canResubmit ? task.resubmitDeadlineDisplay || task.dueDisplay : task.dueDisplay}
          </div>
          {canResubmit ? (
            <div className="mt-2 text-xs text-[#153e90] dark:text-[#6ee75a]">
              Teacher requested revision — upload before this deadline
            </div>
          ) : (
            task.dueTime && (
              <div className="mt-2 text-xs text-[#153e90] dark:text-[#6ee75a]">Time scheduled for this task</div>
            )
          )}
        </div>
        <div className="border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">File Requirement</div>
          <div className="mt-1 font-semibold">{task.fileRequirement}</div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="border border-border bg-card p-5">
            <h2 className="text-xl font-bold">Assignment Details</h2>
            <div className="mt-5 space-y-4 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned By</div>
                <p className="mt-1 text-foreground">{task.assignedBy}</p>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submissions</div>
                <p className="mt-1 text-foreground">{task.submissions}</p>
              </div>
            </div>
          </div>

          <div className="border border-border bg-card p-5">
            <h2 className="text-xl font-bold">{canResubmit ? 'Re-upload Submission' : 'Your Submission'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {canResubmit
                ? `Re-upload before ${task.resubmitDeadlineDisplay !== '-' ? task.resubmitDeadlineDisplay : 'the re-upload deadline'}.`
                : `Submit before the deadline${task.dueTime ? ' and scheduled time' : ''}.`}
            </p>

            {closed ? (
              <div className="mt-5 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
                Submission is closed for this task.
              </div>
            ) : task.studentSubmitted && !canResubmit ? (
              <div className="mt-5 space-y-4">
                <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
                  You have already submitted this task.
                </div>
                {task.studentSubmissionId && (
                  <Link
                    href={`/task-submissions/${task.studentSubmissionId}`}
                    className="inline-flex border border-border px-5 py-2.5 text-sm font-semibold hover:bg-accent"
                  >
                    View Submission Status
                  </Link>
                )}
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {canResubmit && (
                  <div className="space-y-3">
                    <div className="border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
                      Revision requested. Upload your updated file before the re-upload deadline.
                    </div>

                    {task.revisionFeedback && (
                      <div className="border border-border bg-background/60 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-bold">
                            {task.revisionFeedback.stage} Feedback
                          </h3>
                          <span className="border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-700 dark:text-red-200">
                            {task.revisionFeedback.decision}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Mark
                            </div>
                            <p className="mt-1 text-sm font-semibold">{task.revisionFeedback.mark}</p>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Re-upload Deadline
                            </div>
                            <p className="mt-1 text-sm font-semibold">
                              {task.resubmitDeadlineDisplay !== '-'
                                ? task.resubmitDeadlineDisplay
                                : 'Not set'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Comment
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                            {task.revisionFeedback.comment || 'No comment added.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Student note (optional)</label>
                  <textarea
                    value={studentNote}
                    onChange={(event) => setStudentNote(event.target.value)}
                    rows={4}
                    placeholder="Add any notes about your submission for mentor review."
                    className="w-full resize-none border border-border bg-background px-4 py-3 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">
                    {canResubmit ? 'Upload revised work file' : 'Upload work file (optional)'}
                  </label>
                  <input
                    type="file"
                    onChange={(event) => setSubmissionFile(event.target.files?.[0] || null)}
                    className="h-11 w-full border border-border bg-background px-4 py-2 text-sm outline-none file:mr-3 file:border-0 file:bg-[#153e90] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white dark:file:bg-[#6ee75a] dark:file:text-black"
                  />
                </div>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSubmit()}
                  className="bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#153e90]/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
                >
                  {submitting ? (canResubmit ? 'Re-uploading…' : 'Submitting…') : canResubmit ? 'Re-upload Task' : 'Submit Task'}
                </button>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="border border-border bg-card p-5">
            <h3 className="text-lg font-bold">Attached Brief</h3>
            <p className="mt-1 text-sm text-muted-foreground">Reference file shared with this assignment.</p>

            {task.attachmentName ? (
              <div className="mt-5 space-y-3">
                <div className="border border-border bg-background/60 p-3 text-sm font-semibold">{task.attachmentName}</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleBriefAction('view')}
                    className="border border-[#153e90]/30 bg-[#153e90]/10 px-4 py-2 text-xs font-semibold text-[#153e90] hover:bg-[#153e90]/15 dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleBriefAction('download')}
                    className="border border-border px-4 py-2 text-xs font-semibold hover:bg-accent"
                  >
                    Download
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 border border-border bg-background/60 p-4 text-sm text-muted-foreground">
                No brief file attached.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
