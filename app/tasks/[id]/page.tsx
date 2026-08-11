'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth/provider'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import { fetchAccessibleBatches, isStudentMyCoursesView } from '@/lib/data/my-courses'
import { fetchBatchById } from '@/lib/data/batches'
import { fetchBatchStudents, type BatchStudentRow } from '@/lib/data/students'
import {
  fetchTaskSubmissions,
  getReviewStageLabel,
  openTaskSubmissionFile,
  type TaskSubmissionListRow,
} from '@/lib/data/task-submissions'
import {
  deleteTask,
  fetchStudentIdByProfileId,
  fetchTaskById,
  getAssignmentTypeLabel,
  getStudentTaskSubmitHref,
  isTaskSubmissionClosed,
  openTaskBriefFile,
  type TaskListRow,
} from '@/lib/data/tasks'
import { createClient } from '@/lib/supabase/client'

type StudentSubmissionRow = {
  studentId: string
  studentName: string
  studentCode: string
  email: string
  submitted: boolean
  submission: TaskSubmissionListRow | null
}

function getStatusClass(status: string) {
  const value = status.toLowerCase()

  if (value.includes('open') || value.includes('submitted') || value.includes('waiting')) {
    return 'border-[#153e90]/30 bg-[#153e90]/10 text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white'
  }

  if (value.includes('review') || value.includes('ready') || value.includes('pending')) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  }

  if (value.includes('closed') || value.includes('reject') || value.includes('revision')) {
    return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
  }

  if (value.includes('completed') || value.includes('approved') || value.includes('final')) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
  }

  return 'border-border bg-background text-foreground'
}

async function getAccessToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

export default function TaskDetailPage() {
  const params = useParams()
  const taskId = String(params.id || '')
  const { can, user, parentRoleId } = useAuth()
  const { activeBranchId, loading: branchLoading } = useBranchScope()

  const [task, setTask] = useState<TaskListRow | null>(null)
  const [assignedByRole, setAssignedByRole] = useState<string | null>(null)
  const [batchCode, setBatchCode] = useState<string | null>(null)
  const [studentRows, setStudentRows] = useState<StudentSubmissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [openingFileId, setOpeningFileId] = useState<string | null>(null)

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
            batchCode: batch.batch_code,
          },
        ]),
      )

      const studentId = isStudent ? await fetchStudentIdByProfileId(user!.id) : null
      const result = await fetchTaskById(taskId, {
        batchLookup: lookup,
        studentId,
      })

      if (cancelled) return

      let resolvedAssignedByRole: string | null = null
      let resolvedBatchCode: string | null = result.data?.batchCode ?? null

      if (result.data) {
        const batchDetail = await fetchBatchById(result.data.batchId)
        if (cancelled) return
        resolvedBatchCode = batchDetail.data?.batch_code ?? resolvedBatchCode
        const assignerName = result.data.assignedBy.trim().toLowerCase()
        const match = batchDetail.data?.staff_assignments.find(
          (staff) => staff.staff_name.trim().toLowerCase() === assignerName,
        )
        resolvedAssignedByRole = match?.responsibility_title ?? null
      }

      setAssignedByRole(resolvedAssignedByRole)
      setBatchCode(resolvedBatchCode)
      setTask(result.data)
      setError(result.error || (result.data ? null : 'Task not found or not in your scope.'))
      setLoading(false)

      if (!result.data || isStudent) {
        setStudentRows([])
        return
      }

      setStudentsLoading(true)

      const [studentsResult, submissionsResult] = await Promise.all([
        fetchBatchStudents(result.data.batchId),
        fetchTaskSubmissions({
          taskId: result.data.id,
          batchLookup: lookup,
          batchIds: [result.data.batchId],
        }),
      ])

      if (cancelled) return

      const submissionByStudent = new Map(
        submissionsResult.data.map((submission) => [submission.studentId, submission]),
      )

      const rows: StudentSubmissionRow[] = (studentsResult.data as BatchStudentRow[])
        .map((student) => {
          const submission = submissionByStudent.get(student.id) || null
          return {
            studentId: student.id,
            studentName: student.full_name,
            studentCode: student.student_code,
            email: student.email,
            submitted: Boolean(submission),
            submission,
          }
        })
        .sort((a, b) => {
          if (a.submitted !== b.submitted) return a.submitted ? -1 : 1
          return a.studentName.localeCompare(b.studentName)
        })

      setStudentRows(rows)
      setStudentsLoading(false)

      if (studentsResult.error || submissionsResult.error) {
        setNotice(studentsResult.error || submissionsResult.error || '')
      }
    }

    void loadTask()

    return () => {
      cancelled = true
    }
  }, [activeBranchId, branchLoading, isStudent, parentRoleId, taskId, user?.id])

  const displayStatus = useMemo(() => {
    if (!task) return ''
    const closed = isTaskSubmissionClosed(task.due, task.dueTime) || task.status === 'Closed'
    return closed ? 'Submission Closed' : task.status
  }, [task])

  const handleDelete = async () => {
    if (!task) return

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setNotice('Session expired. Please login again.')
      return
    }

    const result = await deleteTask(task.id, accessToken)

    if (!result.ok) {
      setNotice(result.error || 'Failed to delete task.')
      return
    }

    window.location.href = '/tasks'
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

  const handleViewSubmissionFile = async (submission: TaskSubmissionListRow) => {
    setNotice('')
    setOpeningFileId(submission.id)

    const accessToken = await getAccessToken()
    if (!accessToken) {
      setNotice('Session expired. Please login again.')
      setOpeningFileId(null)
      return
    }

    const result = await openTaskSubmissionFile(submission, accessToken, 'view')
    setOpeningFileId(null)

    if (!result.ok) {
      setNotice(result.error || 'Failed to open submission file.')
    }
  }

  const submittedCount = studentRows.filter((row) => row.submitted).length
  const pendingCount = studentRows.length - submittedCount

  if (!can('tasks.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Task Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view this task.</p>
      </div>
    )
  }

  if (loading || branchLoading) {
    return (
      <div className="border border-border bg-card p-8 text-sm text-muted-foreground">Loading task details…</div>
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

  const closed = isTaskSubmissionClosed(task.due, task.dueTime) || task.status === 'Closed'

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
          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-muted-foreground">{task.description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {can('tasks.delete') && !isStudent && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="border border-border px-4 py-2 text-sm font-semibold hover:bg-red-500/10"
            >
              Delete Task
            </button>
          )}
        </div>
      </div>

      {(error || notice) && (
        <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
          {notice || error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isStudent ? (
          <div className="border border-emerald-500/30 bg-emerald-500/10 p-5 xl:col-span-1">
            <div className="text-xs text-emerald-700 dark:text-emerald-300">Assigned By</div>
            <div className="mt-1 font-semibold">{task.assignedBy}</div>
            {assignedByRole && (
              <div className="mt-0.5 text-xs text-muted-foreground">{assignedByRole}</div>
            )}
          </div>
        ) : (
          <>
            <div className="border border-emerald-500/30 bg-emerald-500/10 p-5 xl:col-span-1">
              <div className="text-xs text-emerald-700 dark:text-emerald-300">Course</div>
              <div className="mt-1 font-semibold">{task.course}</div>
            </div>

            <div className="border border-emerald-500/30 bg-emerald-500/10 p-5 xl:col-span-1">
              <div className="text-xs text-emerald-700 dark:text-emerald-300">Batch</div>
              <div className="mt-1 font-semibold">{task.batch}</div>
            </div>

            <div className="border border-emerald-500/30 bg-emerald-500/10 p-5 xl:col-span-1">
              <div className="text-xs text-emerald-700 dark:text-emerald-300">Batch ID</div>
              <div className="mt-1 font-mono text-sm font-semibold [overflow-wrap:anywhere]">
                {batchCode || '—'}
              </div>
            </div>

            <div className="border border-border bg-card p-5 xl:col-span-1">
              <div className="text-xs text-muted-foreground">Assigned By</div>
              <div className="mt-1 font-semibold">{task.assignedBy}</div>
              {assignedByRole && (
                <div className="mt-0.5 text-xs text-muted-foreground">{assignedByRole}</div>
              )}
            </div>
          </>
        )}

        <div className="border border-purple-500/30 bg-purple-500/10 p-5 xl:col-span-1">
          <div className="text-xs text-purple-700 dark:text-purple-300">Submission Deadline</div>
          <div className="mt-1 font-semibold">{task.dueDisplay}</div>
          {task.dueTime && (
            <div className="mt-2 text-xs text-purple-700 dark:text-purple-300">Time scheduled for this task</div>
          )}
        </div>

        <div
          className={`border border-red-500/30 bg-red-500/10 p-5 ${
            isStudent ? 'md:col-span-2 xl:col-span-2' : 'md:col-span-2 xl:col-span-3'
          }`}
        >
          <div className="text-xs text-red-700 dark:text-red-300">File Requirement</div>
          <div className="mt-1 text-sm font-medium leading-relaxed text-foreground [overflow-wrap:anywhere]">
            {task.fileRequirement}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4 xl:items-start">
        <div className="space-y-4 xl:col-span-3">
          <div className="border border-border bg-card p-5">
            <h2 className="text-xl font-bold">Assignment Details</h2>
            <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submissions</div>
                <p className="mt-1 text-foreground">{task.submissions}</p>
              </div>
            </div>
          </div>

          {isStudent && can('submissions.submit') && (
            <div className="border border-border bg-card p-5">
              <h2 className="text-xl font-bold">Student Submission</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Submit before the deadline{task.dueTime ? ' and scheduled time' : ''}.
              </p>

              <div className="mt-5">
                {closed ? (
                  <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
                    Submission is closed for this task.
                  </div>
                ) : task.studentSubmitted ? (
                  <Link
                    href={
                      task.studentSubmissionId
                        ? `/task-submissions/${task.studentSubmissionId}`
                        : getStudentTaskSubmitHref(task)
                    }
                    className="inline-flex border border-border px-5 py-2.5 text-sm font-semibold hover:bg-accent"
                  >
                    View Submission
                  </Link>
                ) : (
                  <Link
                    href={getStudentTaskSubmitHref(task)}
                    className="inline-flex bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
                  >
                    Open Submission Page
                  </Link>
                )}
              </div>
            </div>
          )}

        </div>

        <aside className="space-y-4 xl:col-span-1">
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

      {!isStudent && (
        <div className="border border-border bg-card p-5">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold">Student Submissions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Each student in this batch with their submission status and review details.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{submittedCount}</span> submitted ·{' '}
              <span className="font-semibold text-foreground">{pendingCount}</span> pending ·{' '}
              <span className="font-semibold text-foreground">{studentRows.length}</span> total
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Submission</th>
                  <th className="px-4 py-3 font-semibold">File</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold">Mentor</th>
                  <th className="px-4 py-3 font-semibold">HOD</th>
                  <th className="px-4 py-3 font-semibold">Final QA</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {studentsLoading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      Loading student submissions...
                    </td>
                  </tr>
                )}

                {!studentsLoading &&
                  studentRows.map((row) => {
                    const submission = row.submission
                    const stageLabel = submission ? getReviewStageLabel(submission) : 'Not Submitted'

                    return (
                      <tr key={row.studentId} className="border-b border-border">
                        <td className="px-4 py-4 align-top">
                          <div className="font-semibold text-foreground">{row.studentName}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {row.studentCode} · {row.email}
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <span
                            className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${
                              row.submitted
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                                : 'border-border bg-background text-muted-foreground'
                            }`}
                          >
                            {row.submitted ? 'Submitted' : 'Not Submitted'}
                          </span>
                        </td>

                        <td className="px-4 py-4 align-top text-muted-foreground">
                          <div className="max-w-[180px]">{submission?.fileName || '—'}</div>
                          {submission?.studentNote ? (
                            <div className="mt-1 max-w-[180px] text-xs text-muted-foreground">
                              Note: {submission.studentNote}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-4 align-top text-muted-foreground">
                          <div>{submission?.submitted || '—'}</div>
                          {submission && submission.resubmitted !== '-' ? (
                            <div className="mt-1 text-xs">Re: {submission.resubmitted}</div>
                          ) : null}
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="font-semibold">{submission?.mentorMark || '—'}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {submission?.mentorStatus || '—'}
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="font-semibold">{submission?.hodMark || '—'}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {submission?.hodStatus || '—'}
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="font-semibold">{submission?.qaMark || '—'}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {submission?.qaStatus || '—'}
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <span
                            className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getStatusClass(stageLabel)}`}
                          >
                            {stageLabel}
                          </span>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            {submission ? (
                              <>
                                {can('submissions.view') && (
                                  <button
                                    type="button"
                                    onClick={() => void handleViewSubmissionFile(submission)}
                                    disabled={openingFileId === submission.id}
                                    className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-60"
                                  >
                                    {openingFileId === submission.id ? 'Opening…' : 'View File'}
                                  </button>
                                )}
                                <Link
                                  href={`/task-submissions/${submission.id}`}
                                  className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                                >
                                  Review
                                </Link>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">No file</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                {!studentsLoading && studentRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      No students enrolled in this batch yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
