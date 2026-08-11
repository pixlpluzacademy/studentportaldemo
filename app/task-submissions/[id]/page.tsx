'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useAuth } from '@/lib/auth/provider'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import { fetchAccessibleBatches, isStudentMyCoursesView } from '@/lib/data/my-courses'
import { getAssignmentMaxMarks, getAssignmentTypeLabel } from '@/lib/data/tasks'
import {
  fetchTaskSubmissionById,
  getFinalSubmissionStatus,
  getStudentResubmitHref,
  openTaskSubmissionFile,
  updateTaskSubmissionReview,
  type ReviewDecision,
  type TaskSubmissionDetailRow,
} from '@/lib/data/task-submissions'
import { createClient } from '@/lib/supabase/client'

function CustomIcon({
  icon,
  folder,
  alt = '',
  className = '',
}: {
  icon: string
  folder: string
  alt?: string
  className?: string
}) {
  return (
    <Image
      src={`/icons/${folder}/${icon}`}
      alt={alt}
      width={24}
      height={24}
      className={`shrink-0 object-contain ${className}`}
      onError={(event) => {
        event.currentTarget.src = `/icons/${folder}/dashboard.svg`
      }}
    />
  )
}

function getDecisionClass(decision: string) {
  const value = decision.toLowerCase()

  if (value.includes('approved')) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
  }

  if (value.includes('rejected') || value.includes('revision')) {
    return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
  }

  if (value.includes('pending')) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  }

  return 'border-border bg-background text-foreground'
}

function formatRoleLabel(parentRoleId: string | null, roleName?: string) {
  if (roleName) return roleName
  if (!parentRoleId) return 'User'
  return parentRoleId
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

async function getAccessToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

function ReviewBlock({
  title,
  roleLabel,
  mark,
  maxMark,
  comment,
  decision,
  canReview,
  saving,
  showResubmitDeadline,
  resubmitDeadlineDate,
  resubmitDeadlineTime,
  resubmitUseTime,
  onResubmitDeadlineDateChange,
  onResubmitDeadlineTimeChange,
  onResubmitUseTimeChange,
  onMarkChange,
  onCommentChange,
  onDecision,
}: {
  title: string
  roleLabel: string
  mark: string
  maxMark: number
  comment: string
  decision: ReviewDecision
  canReview: boolean
  saving: boolean
  showResubmitDeadline?: boolean
  resubmitDeadlineDate?: string
  resubmitDeadlineTime?: string
  resubmitUseTime?: boolean
  onResubmitDeadlineDateChange?: (value: string) => void
  onResubmitDeadlineTimeChange?: (value: string) => void
  onResubmitUseTimeChange?: (value: boolean) => void
  onMarkChange: (value: string) => void
  onCommentChange: (value: string) => void
  onDecision: (decision: ReviewDecision) => void
}) {
  return (
    <div className="border border-border bg-card p-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{roleLabel} can add mark, comment and decision.</p>
        </div>

        <span className={`inline-flex whitespace-nowrap border px-3 py-1 text-xs font-semibold ${getDecisionClass(decision)}`}>
          {decision}
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[160px_1fr]">
        <div className="space-y-2">
          <label className="text-sm font-semibold">Mark (out of {maxMark})</label>
          <input
            type="number"
            min={0}
            max={maxMark}
            value={mark}
            onChange={(event) => onMarkChange(event.target.value)}
            disabled={!canReview || saving}
            placeholder={`0 - ${maxMark}`}
            className="h-11 w-full border border-border bg-background px-4 text-sm outline-none focus:border-[#153e90] disabled:cursor-not-allowed disabled:opacity-60 dark:focus:border-[#6ee75a]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Comment</label>
          <textarea
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            disabled={!canReview || saving}
            rows={4}
            placeholder="Write review comment, correction note or approval feedback."
            className="w-full resize-none border border-border bg-background px-4 py-3 text-sm outline-none focus:border-[#153e90] disabled:cursor-not-allowed disabled:opacity-60 dark:focus:border-[#6ee75a]"
          />
        </div>
      </div>

      {showResubmitDeadline && canReview && (
        <div className="mt-5 grid gap-4 border border-border bg-background/60 p-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Re-upload deadline date</label>
            <input
              type="date"
              value={resubmitDeadlineDate || ''}
              onChange={(event) => onResubmitDeadlineDateChange?.(event.target.value)}
              className="h-11 w-full border border-border bg-background px-4 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={Boolean(resubmitUseTime)}
                onChange={(event) => onResubmitUseTimeChange?.(event.target.checked)}
                className="h-4 w-4 border border-border"
              />
              Set re-upload time (optional)
            </label>
            <input
              type="time"
              value={resubmitDeadlineTime || ''}
              disabled={!resubmitUseTime}
              onChange={(event) => onResubmitDeadlineTimeChange?.(event.target.value)}
              className="h-11 w-full border border-border bg-background px-4 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:[color-scheme:dark]"
            />
          </div>
        </div>
      )}

      {canReview && (
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => onDecision('Approved')}
            className="bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#153e90]/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
          >
            Approve
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => onDecision('Revision Requested')}
            className="border border-border px-5 py-2.5 text-sm font-semibold hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            Request Revision
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => onDecision('Rejected')}
            className="border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-200"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

export default function Page() {
  const params = useParams()
  const submissionId = String(params?.id || '')
  const { can, role, parentRoleId, user } = useAuth()
  const { activeBranchId, loading: branchLoading } = useBranchScope()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const [submission, setSubmission] = useState<TaskSubmissionDetailRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [resubmitDeadlineDate, setResubmitDeadlineDate] = useState('')
  const [resubmitUseTime, setResubmitUseTime] = useState(false)
  const [resubmitDeadlineTime, setResubmitDeadlineTime] = useState('')

  const isStudent = isStudentMyCoursesView(parentRoleId)
  const isElevatedAdmin =
    parentRoleId === 'super_admin' || parentRoleId === 'company_admin'

  // Stage ownership: HOD / Final QA profiles often also have submissions.review,
  // but they must not edit the mentor block. Elevated admins can edit all stages.
  const hasHodReviewPermission =
    can('hod_review.review') || can('hod_review.approve')
  const hasQaReviewPermission =
    can('final_qa.validate') || can('final_qa.approve')
  const hasMentorReviewPermission = can('submissions.review')

  const canMentorReview =
    !isStudent &&
    (isElevatedAdmin ||
      (hasMentorReviewPermission && !hasHodReviewPermission && !hasQaReviewPermission))
  const canHodReview = !isStudent && (isElevatedAdmin || hasHodReviewPermission)
  const canQaReview = !isStudent && (isElevatedAdmin || hasQaReviewPermission)

  const mentorStageOpen =
    canMentorReview &&
    (submission?.mentorDecision === 'Pending' ||
      submission?.mentorDecision === 'Revision Requested' ||
      submission?.mentorDecision === 'Rejected' ||
      !submission)
  const hodStageOpen =
    canHodReview &&
    submission?.mentorDecision === 'Approved' &&
    (submission?.hodDecision === 'Pending' ||
      submission?.hodDecision === 'Revision Requested' ||
      submission?.hodDecision === 'Rejected')
  const qaStageOpen =
    canQaReview &&
    submission?.hodDecision === 'Approved' &&
    (submission?.qaDecision === 'Pending' ||
      submission?.qaDecision === 'Revision Requested' ||
      submission?.qaDecision === 'Rejected')

  useEffect(() => {
    if (!submissionId || branchLoading || !user?.id) return

    if (!isStudent && !activeBranchId) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadSubmission() {
      setLoading(true)
      setError(null)

      const { batches } = await fetchAccessibleBatches({
        branchId: activeBranchId || '',
        userId: user!.id,
        parentRoleId,
        branchWide: hasQaReviewPermission,
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

      const result = await fetchTaskSubmissionById(submissionId, { batchLookup: lookup })

      if (cancelled) return

      setSubmission(result.data)
      if (result.data?.resubmitDeadlineDate) {
        setResubmitDeadlineDate(result.data.resubmitDeadlineDate)
        setResubmitUseTime(Boolean(result.data.resubmitDeadlineTime))
        setResubmitDeadlineTime(result.data.resubmitDeadlineTime || '')
      }
      setError(result.error || (result.data ? null : 'Submission not found or not in your scope.'))
      setLoading(false)
    }

    void loadSubmission()

    return () => {
      cancelled = true
    }
  }, [activeBranchId, branchLoading, hasQaReviewPermission, isStudent, parentRoleId, submissionId, user?.id])

  const finalStatus = useMemo(() => {
    if (!submission) return ''
    return getFinalSubmissionStatus(submission)
  }, [submission])

  const saveReview = async (stage: 'mentor' | 'hod' | 'qa', decision: ReviewDecision) => {
    if (!submission) return

    const mark =
      stage === 'mentor' ? submission.mentorMark : stage === 'hod' ? submission.hodMark : submission.qaMark
    const comment =
      stage === 'mentor' ? submission.mentorComment : stage === 'hod' ? submission.hodComment : submission.qaComment

    if (decision === 'Approved' && !mark.trim()) {
      setNotice('Please add a mark before approval.')
      return
    }

    if ((decision === 'Rejected' || decision === 'Revision Requested') && !resubmitDeadlineDate) {
      setNotice('Please set a re-upload deadline date before reject or revision.')
      return
    }

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setNotice('Session expired. Please login again.')
      return
    }

    setSaving(true)
    setNotice('')

    const result = await updateTaskSubmissionReview(
      {
        submissionId: submission.id,
        stage,
        mark,
        comment,
        decision,
        resubmitDeadlineDate:
          decision === 'Rejected' || decision === 'Revision Requested' ? resubmitDeadlineDate : undefined,
        resubmitDeadlineTime:
          (decision === 'Rejected' || decision === 'Revision Requested') && resubmitUseTime
            ? resubmitDeadlineTime
            : undefined,
      },
      accessToken,
    )

    setSaving(false)

    if (!result.ok) {
      setNotice(result.error || 'Failed to save review.')
      return
    }

    setSubmission((current) => {
      if (!current) return current

      const isSendBack = decision === 'Rejected' || decision === 'Revision Requested'
      const stageStatus =
        decision === 'Approved'
          ? current.status
          : decision === 'Rejected'
            ? stage === 'hod'
              ? 'Rejected by HOD'
              : stage === 'qa'
                ? 'Rejected by Final QA'
                : 'Rejected'
            : stage === 'hod'
              ? 'HOD Revision Requested'
              : stage === 'qa'
                ? 'Final QA Revision Requested'
                : 'Mentor Revision Requested'

      const deadlineDisplay = isSendBack
        ? `${resubmitDeadlineDate}${resubmitUseTime && resubmitDeadlineTime ? ` · ${resubmitDeadlineTime}` : ''}`
        : current.resubmitDeadlineDisplay

      if (stage === 'mentor') {
        return {
          ...current,
          status: stageStatus,
          mentorDecision: decision,
          mentorStatus: decision,
          canResubmit: isSendBack,
          resubmitDeadlineDisplay: deadlineDisplay,
          resubmitDeadlineDate: isSendBack ? resubmitDeadlineDate : current.resubmitDeadlineDate,
          resubmitDeadlineTime:
            isSendBack && resubmitUseTime ? resubmitDeadlineTime : current.resubmitDeadlineTime,
        }
      }

      if (stage === 'hod') {
        // HOD send-back clears mentor marks so review restarts after student re-upload.
        return {
          ...current,
          status: stageStatus,
          hodDecision: decision,
          hodStatus: decision,
          canResubmit: isSendBack,
          resubmitDeadlineDisplay: deadlineDisplay,
          resubmitDeadlineDate: isSendBack ? resubmitDeadlineDate : current.resubmitDeadlineDate,
          resubmitDeadlineTime:
            isSendBack && resubmitUseTime ? resubmitDeadlineTime : current.resubmitDeadlineTime,
          ...(isSendBack
            ? {
                mentorDecision: 'Pending' as ReviewDecision,
                mentorStatus: 'Pending',
                mentorMark: '-',
                mentorComment: 'No mentor comment yet.',
                qaDecision: 'Pending' as ReviewDecision,
                qaStatus: 'Pending',
                qaMark: '-',
                qaComment: 'No final QA comment yet.',
              }
            : {}),
        }
      }

      return {
        ...current,
        status: stageStatus,
        qaDecision: decision,
        qaStatus: decision,
        canResubmit: isSendBack,
        resubmitDeadlineDisplay: deadlineDisplay,
        resubmitDeadlineDate: isSendBack ? resubmitDeadlineDate : current.resubmitDeadlineDate,
        resubmitDeadlineTime:
          isSendBack && resubmitUseTime ? resubmitDeadlineTime : current.resubmitDeadlineTime,
        ...(isSendBack
          ? {
              mentorDecision: 'Pending' as ReviewDecision,
              mentorStatus: 'Pending',
              mentorMark: '-',
              mentorComment: 'No mentor comment yet.',
              hodDecision: 'Pending' as ReviewDecision,
              hodStatus: 'Pending',
              hodMark: '-',
              hodComment: 'No HOD comment yet.',
            }
          : {}),
      }
    })

    setNotice(`${stage === 'mentor' ? 'Mentor' : stage === 'hod' ? 'HOD' : 'Final QA'} decision saved as ${decision}.`)
  }

  const handlePreviewHistoryFile = async (attempt: number) => {
    if (!submission) return

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setNotice('Session expired. Please login again.')
      return
    }

    const result = await openTaskSubmissionFile(submission, accessToken, 'view', { historyAttempt: attempt })

    if (!result.ok) {
      setNotice(result.error || 'Failed to open submission file.')
    }
  }

  const handlePreviewFile = async () => {
    if (!submission) return

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setNotice('Session expired. Please login again.')
      return
    }

    const result = await openTaskSubmissionFile(submission, accessToken, 'view')

    if (!result.ok) {
      setNotice(result.error || 'Failed to open submission file.')
    }
  }

  if (!can('submissions.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Submission Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view this submission.</p>
      </div>
    )
  }

  if (loading || branchLoading) {
    return (
      <div className="border border-border bg-card p-8 text-sm text-muted-foreground">Loading submission details…</div>
    )
  }

  if (!submission) {
    return (
      <div className="space-y-4">
        <Link href="/task-submissions" className="inline-flex items-center border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">
          <CustomIcon icon="arrow.svg" folder={iconFolder} alt="Back" className="mr-2 h-3 w-3 rotate-180" />
          Back to Task Submissions
        </Link>
        <div className="border border-border bg-card p-8">
          <h1 className="text-2xl font-bold">Submission Not Found</h1>
          <p className="mt-2 text-muted-foreground">{error || 'This submission is not available in your scope.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Link href="/task-submissions" className="inline-flex items-center text-sm font-semibold text-[#153e90] hover:underline dark:text-[#6ee75a]">
            <CustomIcon icon="arrow.svg" folder={iconFolder} alt="Back" className="mr-2 h-3 w-3 rotate-180" />
            Back to Task Submissions
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Submission Review</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Review one submitted task with mentor mark, HOD mark, final QA mark, comments and approval decisions.
          </p>
        </div>

        <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Current role:</span> {formatRoleLabel(parentRoleId, role?.name)}
        </div>
      </div>

      {(notice || error) && (
        <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
          {notice || error}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="border border-border bg-card p-5">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h2 className="text-xl font-bold">{submission.task}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Submitted by {submission.student}</p>
              </div>

              <span className={`inline-flex whitespace-nowrap border px-3 py-1 text-xs font-semibold ${getDecisionClass(finalStatus)}`}>
                {finalStatus}
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs text-muted-foreground">Student</div>
                <div className="mt-1 font-semibold">{submission.student}</div>
              </div>

              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs text-muted-foreground">Course</div>
                <div className="mt-1 font-semibold">{submission.course}</div>
              </div>

              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs text-muted-foreground">Batch</div>
                <div className="mt-1 font-semibold">{submission.batch}</div>
              </div>

              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs text-muted-foreground">Assignment Type</div>
                <div className="mt-1 font-semibold">{getAssignmentTypeLabel(submission.frequency)}</div>
              </div>

              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs text-muted-foreground">Max Mark</div>
                <div className="mt-1 font-semibold">{getAssignmentMaxMarks(submission.frequency)}</div>
              </div>

              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs text-muted-foreground">Mentor</div>
                <div className="mt-1 font-semibold">{submission.mentor}</div>
              </div>

              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs text-muted-foreground">Submitted Date</div>
                <div className="mt-1 font-semibold">{submission.submitted}</div>
              </div>
              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs text-muted-foreground">Re-submission Date</div>
                <div className="mt-1 font-semibold">{submission.resubmitted}</div>
              </div>

              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs text-muted-foreground">Submit Attempts</div>
                <div className="mt-1 font-semibold">{submission.submitAttempts}</div>
              </div>

              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs text-muted-foreground">Re-upload Deadline</div>
                <div className="mt-1 font-semibold">{submission.resubmitDeadlineDisplay}</div>
              </div>
            </div>

            {isStudent && submission.canResubmit && (
              <div className="mt-5 border border-[#153e90]/25 bg-[#153e90]/10 p-4">
                <p className="text-sm text-[#153e90] dark:text-white">
                  Your submission was rejected or needs revision. Re-upload before {submission.resubmitDeadlineDisplay}.
                </p>
                <Link
                  href={getStudentResubmitHref(submission.taskId)}
                  className="mt-4 inline-flex bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black"
                >
                  Re-upload Submission
                </Link>
              </div>
            )}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uploaded File</div>
                <div className="mt-2 font-semibold">{submission.fileName}</div>
                {(submission.filePath || (submission.fileName && submission.fileName !== '-')) && (
                  <button
                    type="button"
                    onClick={() => void handlePreviewFile()}
                    className="mt-4 border border-border px-4 py-2 text-xs font-semibold hover:bg-accent"
                  >
                    Preview File
                  </button>
                )}
              </div>

              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Student Note</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {submission.studentNote || 'No note added.'}
                </p>
              </div>
            </div>
          </div>

          {(submission.submissionHistory?.length || 0) > 0 && (
            <div className="border border-border bg-card p-5">
              <h3 className="text-lg font-bold">Submission History</h3>
              <p className="mt-1 text-sm text-muted-foreground">Every submit and re-upload attempt is stored here.</p>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th className="px-4 py-3 font-semibold">Attempt</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Submitted At</th>
                      <th className="px-4 py-3 font-semibold">File</th>
                      <th className="px-4 py-3 font-semibold">Note</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submission.submissionHistory.map((entry) => (
                      <tr key={entry.attempt} className="border-b border-border">
                        <td className="px-4 py-3 font-semibold">{entry.attempt}</td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">{entry.type}</td>
                        <td className="px-4 py-3 text-muted-foreground">{entry.submitted_at.slice(0, 16).replace('T', ' ')}</td>
                        <td className="px-4 py-3 text-muted-foreground">{entry.file_name || '-'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{entry.student_note || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          {entry.file_path && (
                            <button
                              type="button"
                              onClick={() => void handlePreviewHistoryFile(entry.attempt)}
                              className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                            >
                              View
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <ReviewBlock
            title="Mentor Review"
            roleLabel="Mentor / Trainer"
            mark={submission.mentorMark === '-' ? '' : submission.mentorMark}
            maxMark={getAssignmentMaxMarks(submission.frequency)}
            comment={submission.mentorComment}
            decision={submission.mentorDecision}
            canReview={Boolean(mentorStageOpen)}
            saving={saving}
            showResubmitDeadline={Boolean(mentorStageOpen)}
            resubmitDeadlineDate={resubmitDeadlineDate}
            resubmitDeadlineTime={resubmitDeadlineTime}
            resubmitUseTime={resubmitUseTime}
            onResubmitDeadlineDateChange={setResubmitDeadlineDate}
            onResubmitDeadlineTimeChange={setResubmitDeadlineTime}
            onResubmitUseTimeChange={setResubmitUseTime}
            onMarkChange={(value) => setSubmission((prev) => (prev ? { ...prev, mentorMark: value } : prev))}
            onCommentChange={(value) => setSubmission((prev) => (prev ? { ...prev, mentorComment: value } : prev))}
            onDecision={(decision) => void saveReview('mentor', decision)}
          />

          <ReviewBlock
            title="HOD Review"
            roleLabel="HOD"
            mark={submission.hodMark === '-' ? '' : submission.hodMark}
            maxMark={getAssignmentMaxMarks(submission.frequency)}
            comment={submission.hodComment}
            decision={submission.hodDecision}
            canReview={Boolean(hodStageOpen)}
            saving={saving}
            showResubmitDeadline={Boolean(hodStageOpen)}
            resubmitDeadlineDate={resubmitDeadlineDate}
            resubmitDeadlineTime={resubmitDeadlineTime}
            resubmitUseTime={resubmitUseTime}
            onResubmitDeadlineDateChange={setResubmitDeadlineDate}
            onResubmitDeadlineTimeChange={setResubmitDeadlineTime}
            onResubmitUseTimeChange={setResubmitUseTime}
            onMarkChange={(value) => setSubmission((prev) => (prev ? { ...prev, hodMark: value } : prev))}
            onCommentChange={(value) => setSubmission((prev) => (prev ? { ...prev, hodComment: value } : prev))}
            onDecision={(decision) => void saveReview('hod', decision)}
          />

          <ReviewBlock
            title="Final QA Review"
            roleLabel="Final QA"
            mark={submission.qaMark === '-' ? '' : submission.qaMark}
            maxMark={getAssignmentMaxMarks(submission.frequency)}
            comment={submission.qaComment}
            decision={submission.qaDecision}
            canReview={Boolean(qaStageOpen)}
            saving={saving}
            showResubmitDeadline={Boolean(qaStageOpen)}
            resubmitDeadlineDate={resubmitDeadlineDate}
            resubmitDeadlineTime={resubmitDeadlineTime}
            resubmitUseTime={resubmitUseTime}
            onResubmitDeadlineDateChange={setResubmitDeadlineDate}
            onResubmitDeadlineTimeChange={setResubmitDeadlineTime}
            onResubmitUseTimeChange={setResubmitUseTime}
            onMarkChange={(value) => setSubmission((prev) => (prev ? { ...prev, qaMark: value } : prev))}
            onCommentChange={(value) => setSubmission((prev) => (prev ? { ...prev, qaComment: value } : prev))}
            onDecision={(decision) => void saveReview('qa', decision)}
          />
        </div>

        <aside className="space-y-5">
          <div className="border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold">Marks Summary</h3>
              <span className="border border-border bg-background/60 px-2 py-1 text-xs font-semibold text-muted-foreground">
                Max {getAssignmentMaxMarks(submission.frequency)}
              </span>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between border border-border bg-background/60 p-3">
                <span className="text-muted-foreground">Mentor Mark</span>
                <span className="font-bold">
                  {submission.mentorMark}
                  {submission.mentorMark !== '-' && ` / ${getAssignmentMaxMarks(submission.frequency)}`}
                </span>
              </div>

              <div className="flex items-center justify-between border border-border bg-background/60 p-3">
                <span className="text-muted-foreground">HOD Mark</span>
                <span className="font-bold">
                  {submission.hodMark}
                  {submission.hodMark !== '-' && ` / ${getAssignmentMaxMarks(submission.frequency)}`}
                </span>
              </div>

              <div className="flex items-center justify-between border border-border bg-background/60 p-3">
                <span className="text-muted-foreground">Final QA Mark</span>
                <span className="font-bold">
                  {submission.qaMark}
                  {submission.qaMark !== '-' && ` / ${getAssignmentMaxMarks(submission.frequency)}`}
                </span>
              </div>
            </div>
          </div>

          <div className="border border-border bg-card p-5">
            <h3 className="text-lg font-bold">Review Progress</h3>

            <div className="mt-5 space-y-3 text-sm">
              <div className={`border p-3 ${getDecisionClass('Approved')}`}>
                <div className="font-semibold">Student Submitted</div>
                <div className="mt-1 text-xs">Submitted on {submission.submitted}</div>
                {submission.resubmitted !== '-' && (
                  <div className="mt-1 text-xs">Last re-upload on {submission.resubmitted}</div>
                )}
              </div>

              <div className={`border p-3 ${getDecisionClass(submission.mentorDecision)}`}>
                <div className="font-semibold">Mentor Review</div>
                <div className="mt-1 text-xs">{submission.mentorDecision}</div>
              </div>

              <div className={`border p-3 ${getDecisionClass(submission.hodDecision)}`}>
                <div className="font-semibold">HOD Review</div>
                <div className="mt-1 text-xs">{submission.hodDecision}</div>
              </div>

              <div className={`border p-3 ${getDecisionClass(submission.qaDecision)}`}>
                <div className="font-semibold">Final QA Review</div>
                <div className="mt-1 text-xs">{submission.qaDecision}</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
