'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useDemoAuth } from '@/lib/demo/auth'
import { batches, students, submissions, tasks } from '@/lib/demo/seed'

type DemoSubmission = {
  id: string
  student: string
  task: string
  course: string
  batch: string
  mentor: string
  submitted: string
  status: string
  mentorMark: string | number
  hodMark: string | number
  qaMark: string | number
  mentorStatus: string
  hodStatus: string
  qaStatus: string
  fileName: string
  studentNote: string
}

const today = new Date().toISOString().slice(0, 10)

const demoSubmissions: DemoSubmission[] = submissions.map((submission, index) => {
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
    mentorMark: submission.mentorScore || '-',
    hodMark: index === 2 ? 84 : '-',
    qaMark: '-',
    mentorStatus: String(submission.status).toLowerCase().includes('mentor') || String(submission.status).toLowerCase().includes('hod') ? 'Reviewed' : 'Pending',
    hodStatus: String(submission.hodStatus || 'Pending'),
    qaStatus: String(submission.qaStatus || 'Pending'),
    fileName:
      index === 0
        ? 'meta-ads-funnel-plan.pdf'
        : index === 1
          ? 'portfolio-landing-page.zip'
          : 'bedroom-interior-render.jpg',
    studentNote:
      index === 0
        ? 'I completed the campaign funnel plan with objective, audience, creative direction and KPI structure.'
        : index === 1
          ? 'I submitted the landing page source file and preview screenshot.'
          : 'Final bedroom render uploaded with lighting, material setup and camera output.',
  }
})

function getStatusClass(status: string) {
  const value = status.toLowerCase()

  if (value.includes('submitted')) {
    return 'border-[#153e90]/30 bg-[#153e90]/10 text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white'
  }

  if (value.includes('mentor')) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  }

  if (value.includes('hod')) {
    return 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-200'
  }

  if (value.includes('approved') || value.includes('validated')) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
  }

  if (value.includes('reject') || value.includes('revision')) {
    return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
  }

  return 'border-border bg-background text-foreground'
}

function getReviewStage(submission: DemoSubmission) {
  if (submission.qaStatus.toLowerCase().includes('validated') || submission.qaStatus.toLowerCase().includes('approved')) {
    return 'Final QA Completed'
  }

  if (submission.hodStatus.toLowerCase().includes('approved') || submission.status.toLowerCase().includes('hod')) {
    return 'Ready for Final QA'
  }

  if (submission.mentorStatus.toLowerCase().includes('reviewed') || submission.status.toLowerCase().includes('mentor')) {
    return 'Ready for HOD'
  }

  return 'Waiting for Mentor'
}

export default function Page() {
  const { role, user } = useDemoAuth()
  const [records] = useState<DemoSubmission[]>(demoSubmissions)

  const isStudent = role?.id === 'student'
  const ismentor = role?.id === 'mentor' || role?.id === 'mentor'

  const currentStudent = useMemo(() => {
    return students.find((student) => student.name === user?.fullName) || students[0]
  }, [user?.fullName])

  const assignedBatchNames = useMemo(() => {
    if (ismentor && user?.fullName) {
      return batches.filter((batch) => batch.mentor === user.fullName).map((batch) => batch.name)
    }

    return batches.map((batch) => batch.name)
  }, [ismentor, user?.fullName])

  const visibleSubmissions = useMemo(() => {
    if (isStudent) {
      return records.filter((submission) => submission.student === currentStudent?.name)
    }

    if (ismentor && user?.fullName) {
      return records.filter((submission) => submission.mentor === user.fullName || assignedBatchNames.includes(submission.batch))
    }

    return records
  }, [assignedBatchNames, currentStudent?.name, isStudent, ismentor, records, user?.fullName])

  const submittedCount = visibleSubmissions.filter((submission) => submission.status.toLowerCase().includes('submitted')).length
  const mentorReviewedCount = visibleSubmissions.filter((submission) => submission.mentorStatus.toLowerCase().includes('reviewed')).length
  const hodReviewedCount = visibleSubmissions.filter((submission) => submission.hodStatus.toLowerCase().includes('approved')).length
  const qaCompletedCount = visibleSubmissions.filter((submission) => submission.qaStatus.toLowerCase().includes('validated') || submission.qaStatus.toLowerCase().includes('approved')).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Permission controlled module</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Task Submissions</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Student submission queue with mentor mark, HOD mark, final QA mark and complete review workflow.
          </p>
        </div>

        <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Current role:</span> {role?.name || 'Not selected'}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{submittedCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Submitted</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Waiting for review</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{mentorReviewedCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Mentor Reviewed</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Mark and comment added</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{hodReviewedCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">HOD Reviewed</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Ready for final QA</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{qaCompletedCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Final QA Done</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Final validation</div>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold">Submission Queue</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Open each submission to review, add mark, comment, approve, reject or request revision.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="border border-border bg-background px-3 py-2 font-semibold">Today: {today}</span>
            {isStudent && (
              <span className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 font-semibold text-[#153e90] dark:text-white">
                My submissions only
              </span>
            )}
            {ismentor && (
              <span className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 font-semibold text-[#153e90] dark:text-white">
                Assigned batches only
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-semibold">Student</th>
                <th className="px-4 py-3 font-semibold">Task</th>
                <th className="px-4 py-3 font-semibold">Course</th>
                <th className="px-4 py-3 font-semibold">Batch</th>
                <th className="px-4 py-3 font-semibold">Mentor</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Stage</th>
                <th className="px-4 py-3 font-semibold">Mentor Mark</th>
                <th className="px-4 py-3 font-semibold">HOD Mark</th>
                <th className="px-4 py-3 font-semibold">Final QA Mark</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody>
              {visibleSubmissions.map((submission) => (
                <tr key={submission.id} className="border-b border-border">
                  <td className="px-4 py-4 align-top">
                    <div className="font-semibold text-foreground">{submission.student}</div>
                    <div className="mt-1 max-w-[150px] break-words text-xs text-muted-foreground">{submission.fileName}</div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="max-w-[240px] text-muted-foreground">{submission.task}</div>
                  </td>

                  <td className="px-4 py-4 align-top text-muted-foreground">{submission.course}</td>
                  <td className="px-4 py-4 align-top text-muted-foreground">{submission.batch}</td>
                  <td className="px-4 py-4 align-top text-muted-foreground">{submission.mentor}</td>
                  <td className="px-4 py-4 align-top text-muted-foreground">{submission.submitted}</td>

                  <td className="px-4 py-4 align-top">
                    <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getStatusClass(getReviewStage(submission))}`}>
                      {getReviewStage(submission)}
                    </span>
                  </td>

                  <td className="px-4 py-4 align-top text-muted-foreground">{submission.mentorMark}</td>
                  <td className="px-4 py-4 align-top text-muted-foreground">{submission.hodMark}</td>
                  <td className="px-4 py-4 align-top text-muted-foreground">{submission.qaMark}</td>

                  <td className="px-4 py-4 align-top">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/task-submissions/${submission.id}`}
                        className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                      >
                        View
                      </Link>

                      {!isStudent && (
                        <Link
                          href={`/task-submissions/${submission.id}`}
                          className="border border-[#153e90]/30 bg-[#153e90]/10 px-3 py-2 text-xs font-semibold text-[#153e90] hover:bg-[#153e90]/15 dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white"
                        >
                          Review
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {visibleSubmissions.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No submissions found for the selected role.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <h3 className="text-lg font-bold">Workflow</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="border border-border bg-background/60 p-4">
            <div className="text-sm font-bold">1. Student Submit</div>
            <p className="mt-2 text-sm text-muted-foreground">Student uploads task file with a note before the deadline.</p>
          </div>

          <div className="border border-border bg-background/60 p-4">
            <div className="text-sm font-bold">2. Mentor Review</div>
            <p className="mt-2 text-sm text-muted-foreground">Mentor adds mark, comment, approve, reject or revision request.</p>
          </div>

          <div className="border border-border bg-background/60 p-4">
            <div className="text-sm font-bold">3. HOD Review</div>
            <p className="mt-2 text-sm text-muted-foreground">HOD checks quality, adds mark and approval comment.</p>
          </div>

          <div className="border border-border bg-background/60 p-4">
            <div className="text-sm font-bold">4. Final QA</div>
            <p className="mt-2 text-sm text-muted-foreground">Final QA validates the work and gives final mark.</p>
          </div>
        </div>
      </div>
    </div>
  )
}