'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useDemoAuth } from '@/lib/demo/auth'
import { students, submissions, tasks } from '@/lib/demo/seed'

type ReviewDecision = 'Pending' | 'Approved' | 'Rejected' | 'Revision Requested'

type DemoSubmissionDetail = {
  id: string
  student: string
  task: string
  course: string
  batch: string
  mentor: string
  submitted: string
  status: string
  fileName: string
  studentNote: string
  mentorMark: string
  mentorComment: string
  mentorDecision: ReviewDecision
  hodMark: string
  hodComment: string
  hodDecision: ReviewDecision
  qaMark: string
  qaComment: string
  qaDecision: ReviewDecision
}

const demoSubmissionDetails: DemoSubmissionDetail[] = submissions.map((submission, index) => {
  const task = tasks.find((item) => item.title === submission.task)
  const student = students.find((item) => item.name === submission.student)

  return {
    id: String(submission.id),
    student: String(submission.student),
    task: String(submission.task),
    course: task?.course || student?.course || 'Course not selected',
    batch: task?.batch || student?.batch || 'Batch not selected',
    mentor: String(submission.mentor),
    submitted: String(submission.submitted),
    status: String(submission.status),
    fileName:
      index === 0
        ? 'meta-ads-funnel-plan.pdf'
        : index === 1
          ? 'portfolio-landing-page.zip'
          : 'bedroom-interior-render.jpg',
    studentNote:
      index === 0
        ? 'I completed the campaign funnel plan with objective, audience, creative direction, budget split and KPI structure.'
        : index === 1
          ? 'I submitted the landing page source file, preview screenshot and responsive layout.'
          : 'Final bedroom interior render uploaded with lighting setup, materials and camera output.',
    mentorMark: index === 1 ? '' : String(submission.mentorScore || '82'),
    mentorComment:
      index === 0
        ? 'Good structure. Improve the budget split explanation and add one more creative reference.'
        : index === 1
          ? ''
          : 'Strong render quality with good lighting balance.',
    mentorDecision: index === 1 ? 'Pending' : 'Approved',
    hodMark: index === 2 ? '84' : '',
    hodComment: index === 2 ? 'Approved for final QA check. Presentation quality is good.' : '',
    hodDecision: index === 2 ? 'Approved' : 'Pending',
    qaMark: '',
    qaComment: '',
    qaDecision: 'Pending',
  }
})

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

function getFinalStatus(submission: DemoSubmissionDetail) {
  if (submission.qaDecision === 'Approved') {
    return 'Final QA Approved'
  }

  if (submission.qaDecision === 'Rejected') {
    return 'Rejected by Final QA'
  }

  if (submission.hodDecision === 'Approved') {
    return 'Waiting for Final QA'
  }

  if (submission.hodDecision === 'Rejected') {
    return 'Rejected by HOD'
  }

  if (submission.mentorDecision === 'Approved') {
    return 'Waiting for HOD'
  }

  if (submission.mentorDecision === 'Rejected') {
    return 'Rejected by Mentor'
  }

  if (submission.mentorDecision === 'Revision Requested' || submission.hodDecision === 'Revision Requested' || submission.qaDecision === 'Revision Requested') {
    return 'Revision Requested'
  }

  return 'Waiting for Mentor Review'
}

function ReviewBlock({
  title,
  roleLabel,
  mark,
  comment,
  decision,
  canReview,
  onMarkChange,
  onCommentChange,
  onDecision,
}: {
  title: string
  roleLabel: string
  mark: string
  comment: string
  decision: ReviewDecision
  canReview: boolean
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
          <label className="text-sm font-semibold">Mark</label>
          <input
            value={mark}
            onChange={(event) => onMarkChange(event.target.value)}
            disabled={!canReview}
            placeholder="Example: 85"
            className="h-11 w-full border border-border bg-background px-4 text-sm outline-none focus:border-[#153e90] disabled:cursor-not-allowed disabled:opacity-60 dark:focus:border-[#6ee75a]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Comment</label>
          <textarea
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            disabled={!canReview}
            rows={4}
            placeholder="Write review comment, correction note or approval feedback."
            className="w-full resize-none border border-border bg-background px-4 py-3 text-sm outline-none focus:border-[#153e90] disabled:cursor-not-allowed disabled:opacity-60 dark:focus:border-[#6ee75a]"
          />
        </div>
      </div>

      {canReview && (
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onDecision('Approved')}
            className="bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
          >
            Approve
          </button>

          <button
            type="button"
            onClick={() => onDecision('Revision Requested')}
            className="border border-border px-5 py-2.5 text-sm font-semibold hover:bg-accent"
          >
            Request Revision
          </button>

          <button
            type="button"
            onClick={() => onDecision('Rejected')}
            className="border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-500/15 dark:text-red-200"
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
  const { role } = useDemoAuth()
  const submissionId = String(params?.id || '')

  const selectedSubmission = useMemo(() => {
    return demoSubmissionDetails.find((submission) => submission.id === submissionId) || demoSubmissionDetails[0]
  }, [submissionId])

  const [submission, setSubmission] = useState<DemoSubmissionDetail>(selectedSubmission)
  const [notice, setNotice] = useState('')

  const isStudent = role?.id === 'student'
  const ismentor = role?.id === 'mentor' || role?.id === 'mentor'
  const isHod = role?.id === 'hod'
  const isFinalQa = role?.id === 'final-qa'
  const isAdminLevel = role?.id === 'super-admin' || role?.id === 'admin' || role?.id === 'branch-admin' || role?.id === 'branch-controller'

  const canMentorReview = !isStudent && (ismentor || isAdminLevel)
  const canHodReview = !isStudent && (isHod || isAdminLevel)
  const canQaReview = !isStudent && (isFinalQa || isAdminLevel)

  const handleMentorDecision = (decision: ReviewDecision) => {
    if (!submission.mentorMark.trim() && decision === 'Approved') {
      setNotice('Please add mentor mark before approval.')
      return
    }

    setSubmission((prev) => ({
      ...prev,
      mentorDecision: decision,
      status: decision === 'Approved' ? 'Mentor Reviewed' : decision,
    }))
    setNotice(`Mentor decision updated as ${decision}.`)
  }

  const handleHodDecision = (decision: ReviewDecision) => {
    if (!submission.hodMark.trim() && decision === 'Approved') {
      setNotice('Please add HOD mark before approval.')
      return
    }

    setSubmission((prev) => ({
      ...prev,
      hodDecision: decision,
      status: decision === 'Approved' ? 'HOD Reviewed' : decision,
    }))
    setNotice(`HOD decision updated as ${decision}.`)
  }

  const handleQaDecision = (decision: ReviewDecision) => {
    if (!submission.qaMark.trim() && decision === 'Approved') {
      setNotice('Please add Final QA mark before approval.')
      return
    }

    setSubmission((prev) => ({
      ...prev,
      qaDecision: decision,
      status: decision === 'Approved' ? 'Final QA Approved' : decision,
    }))
    setNotice(`Final QA decision updated as ${decision}.`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Link href="/task-submissions" className="text-sm font-semibold text-[#153e90] hover:underline dark:text-[#6ee75a]">
            Back to Task Submissions
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Submission Review</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Review one submitted task with mentor mark, HOD mark, final QA mark, comments and approval decisions.
          </p>
        </div>

        <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Current role:</span> {role?.name || 'Not selected'}
        </div>
      </div>

      {notice && (
        <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
          {notice}
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

              <span className={`inline-flex whitespace-nowrap border px-3 py-1 text-xs font-semibold ${getDecisionClass(getFinalStatus(submission))}`}>
                {getFinalStatus(submission)}
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs text-muted-foreground">Course</div>
                <div className="mt-1 font-semibold">{submission.course}</div>
              </div>

              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs text-muted-foreground">Batch</div>
                <div className="mt-1 font-semibold">{submission.batch}</div>
              </div>

              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs text-muted-foreground">Mentor</div>
                <div className="mt-1 font-semibold">{submission.mentor}</div>
              </div>

              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs text-muted-foreground">Submitted Date</div>
                <div className="mt-1 font-semibold">{submission.submitted}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uploaded File</div>
                <div className="mt-2 font-semibold">{submission.fileName}</div>
                <button
                  type="button"
                  onClick={() => setNotice('Demo file preview opened. Real file will be loaded from Supabase storage.')}
                  className="mt-4 border border-border px-4 py-2 text-xs font-semibold hover:bg-accent"
                >
                  Preview File
                </button>
              </div>

              <div className="border border-border bg-background/60 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Student Note</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{submission.studentNote}</p>
              </div>
            </div>
          </div>

          <ReviewBlock
            title="Mentor Review"
            roleLabel="Mentor / mentor"
            mark={submission.mentorMark}
            comment={submission.mentorComment}
            decision={submission.mentorDecision}
            canReview={canMentorReview}
            onMarkChange={(value) => setSubmission((prev) => ({ ...prev, mentorMark: value }))}
            onCommentChange={(value) => setSubmission((prev) => ({ ...prev, mentorComment: value }))}
            onDecision={handleMentorDecision}
          />

          <ReviewBlock
            title="HOD Review"
            roleLabel="HOD"
            mark={submission.hodMark}
            comment={submission.hodComment}
            decision={submission.hodDecision}
            canReview={canHodReview}
            onMarkChange={(value) => setSubmission((prev) => ({ ...prev, hodMark: value }))}
            onCommentChange={(value) => setSubmission((prev) => ({ ...prev, hodComment: value }))}
            onDecision={handleHodDecision}
          />

          <ReviewBlock
            title="Final QA Review"
            roleLabel="Final QA"
            mark={submission.qaMark}
            comment={submission.qaComment}
            decision={submission.qaDecision}
            canReview={canQaReview}
            onMarkChange={(value) => setSubmission((prev) => ({ ...prev, qaMark: value }))}
            onCommentChange={(value) => setSubmission((prev) => ({ ...prev, qaComment: value }))}
            onDecision={handleQaDecision}
          />
        </div>

        <aside className="space-y-5">
          <div className="border border-border bg-card p-5">
            <h3 className="text-lg font-bold">Marks Summary</h3>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between border border-border bg-background/60 p-3">
                <span className="text-muted-foreground">Mentor Mark</span>
                <span className="font-bold">{submission.mentorMark || '-'}</span>
              </div>

              <div className="flex items-center justify-between border border-border bg-background/60 p-3">
                <span className="text-muted-foreground">HOD Mark</span>
                <span className="font-bold">{submission.hodMark || '-'}</span>
              </div>

              <div className="flex items-center justify-between border border-border bg-background/60 p-3">
                <span className="text-muted-foreground">Final QA Mark</span>
                <span className="font-bold">{submission.qaMark || '-'}</span>
              </div>
            </div>
          </div>

          <div className="border border-border bg-card p-5">
            <h3 className="text-lg font-bold">Review Progress</h3>

            <div className="mt-5 space-y-3 text-sm">
              <div className={`border p-3 ${getDecisionClass('Approved')}`}>
                <div className="font-semibold">Student Submitted</div>
                <div className="mt-1 text-xs">File uploaded on {submission.submitted}</div>
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

          <div className="border border-border bg-card p-5">
            <h3 className="text-lg font-bold">Demo Notes</h3>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#153e90] dark:bg-[#6ee75a]" />
                Each stage can give separate mark and comment.
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#153e90] dark:bg-[#6ee75a]" />
                Reviewers can approve, reject or request revision.
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#153e90] dark:bg-[#6ee75a]" />
                In Supabase, each review action will be saved with reviewer ID and timestamp.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}