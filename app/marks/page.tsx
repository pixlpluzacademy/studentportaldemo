'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useDemoAuth } from '@/lib/demo/auth'
import { batches, students, submissions, tasks } from '@/lib/demo/seed'

type MarkRecord = {
  id: string
  student: string
  course: string
  batch: string
  task: string
  mentor: string
  mentorMark: string | number
  hodMark: string | number
  finalQaMark: string | number
  finalScore: string | number
  grade: string
  result: string
  status: string
}

function toNumber(value: string | number) {
  const numberValue = Number(value)

  if (Number.isNaN(numberValue)) {
    return 0
  }

  return numberValue
}

function getGrade(score: number) {
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

function getResult(score: number) {
  return score >= 50 ? 'Passed' : 'Failed'
}

function getStatusClass(status: string) {
  const value = status.toLowerCase()

  if (value.includes('final')) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
  }

  if (value.includes('hod')) {
    return 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-200'
  }

  if (value.includes('mentor')) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  }

  if (value.includes('pending')) {
    return 'border-border bg-background text-muted-foreground'
  }

  return 'border-[#153e90]/30 bg-[#153e90]/10 text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white'
}

function getResultClass(result: string) {
  if (result.toLowerCase() === 'passed') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
  }

  return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
}

const markRecords: MarkRecord[] = submissions.map((submission, index) => {
  const task = tasks.find((item) => item.title === submission.task)
  const student = students.find((item) => item.name === submission.student)

  const mentorMark = submission.mentorScore || (index === 0 ? 82 : index === 1 ? 76 : 88)
  const hodMark = index === 0 ? 85 : index === 1 ? '-' : 84
  const finalQaMark = index === 0 ? 88 : index === 1 ? '-' : '-'

  const availableMarks = [mentorMark, hodMark, finalQaMark]
    .filter((mark) => mark !== '-')
    .map((mark) => toNumber(mark))

  const finalScore =
    availableMarks.length > 0
      ? Math.round(availableMarks.reduce((total, mark) => total + mark, 0) / availableMarks.length)
      : '-'

  const status =
    finalQaMark !== '-'
      ? 'Finalized'
      : hodMark !== '-'
        ? 'HOD Reviewed'
        : mentorMark !== '-'
          ? 'Mentor Reviewed'
          : 'Pending'

  return {
    id: String(submission.id),
    student: String(submission.student),
    course: task?.course || student?.course || 'Course not selected',
    batch: task?.batch || student?.batch || 'Batch not selected',
    task: String(submission.task),
    mentor: String(submission.mentor),
    mentorMark,
    hodMark,
    finalQaMark,
    finalScore,
    grade: finalScore === '-' ? '-' : getGrade(Number(finalScore)),
    result: finalScore === '-' ? 'Pending' : getResult(Number(finalScore)),
    status,
  }
})

export default function Page() {
  const { role, user } = useDemoAuth()

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

  const visibleMarks = useMemo(() => {
    if (isStudent) {
      return markRecords.filter((record) => record.student === currentStudent?.name)
    }

    if (ismentor && user?.fullName) {
      return markRecords.filter((record) => record.mentor === user.fullName || assignedBatchNames.includes(record.batch))
    }

    return markRecords
  }, [assignedBatchNames, currentStudent?.name, isStudent, ismentor, user?.fullName])

  const finalizedCount = visibleMarks.filter((record) => record.status === 'Finalized').length
  const passedCount = visibleMarks.filter((record) => record.result === 'Passed').length
  const pendingCount = visibleMarks.filter((record) => record.status !== 'Finalized').length

  const averageScore = useMemo(() => {
    const scores = visibleMarks
      .filter((record) => record.finalScore !== '-')
      .map((record) => Number(record.finalScore))

    if (scores.length === 0) {
      return '-'
    }

    return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
  }, [visibleMarks])

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Permission controlled module</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Marks / Evaluation</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Final marks overview for students. Detailed mentor, HOD and Final QA comments are connected to each task submission.
          </p>
        </div>

        <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Current role:</span> {role?.name || 'Not selected'}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{visibleMarks.length}</div>
          <div className="mt-1 text-sm text-muted-foreground">{isStudent ? 'My Evaluations' : 'Evaluations'}</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Visible based on role</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{averageScore}</div>
          <div className="mt-1 text-sm text-muted-foreground">Average Score</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Calculated from available marks</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{passedCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Passed</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Pass mark 50+</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{pendingCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Pending Finalization</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">{finalizedCount} finalized</div>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold">{isStudent ? 'My Marks' : 'Evaluation Marks Table'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Marks summary only. Open details to view submission file, reviewer comments and review decisions.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {isStudent && (
              <span className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 font-semibold text-[#153e90] dark:text-white">
                Student view
              </span>
            )}

            {ismentor && (
              <span className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 font-semibold text-[#153e90] dark:text-white">
                Assigned batches only
              </span>
            )}

            {!isStudent && !ismentor && (
              <span className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 font-semibold text-[#153e90] dark:text-white">
                Management overview
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1160px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                {!isStudent && <th className="px-4 py-3 font-semibold">Student</th>}
                <th className="px-4 py-3 font-semibold">Task</th>
                <th className="px-4 py-3 font-semibold">Course</th>
                <th className="px-4 py-3 font-semibold">Batch</th>
                <th className="px-4 py-3 font-semibold">Mentor Mark</th>
                <th className="px-4 py-3 font-semibold">HOD Mark</th>
                <th className="px-4 py-3 font-semibold">Final QA Mark</th>
                <th className="px-4 py-3 font-semibold">Final Score</th>
                <th className="px-4 py-3 font-semibold">Grade</th>
                <th className="px-4 py-3 font-semibold">Result</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Details</th>
              </tr>
            </thead>

            <tbody>
              {visibleMarks.map((record) => (
                <tr key={record.id} className="border-b border-border">
                  {!isStudent && (
                    <td className="px-4 py-4 align-top">
                      <div className="font-semibold text-foreground">{record.student}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{record.mentor}</div>
                    </td>
                  )}

                  <td className="px-4 py-4 align-top">
                    <div className="max-w-[250px] text-muted-foreground">{record.task}</div>
                  </td>

                  <td className="px-4 py-4 align-top text-muted-foreground">{record.course}</td>
                  <td className="px-4 py-4 align-top text-muted-foreground">{record.batch}</td>

                  <td className="px-4 py-4 align-top">
                    <span className="inline-flex min-w-12 justify-center border border-border bg-background px-3 py-1 text-sm font-semibold">
                      {record.mentorMark}
                    </span>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <span className="inline-flex min-w-12 justify-center border border-border bg-background px-3 py-1 text-sm font-semibold">
                      {record.hodMark}
                    </span>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <span className="inline-flex min-w-12 justify-center border border-border bg-background px-3 py-1 text-sm font-semibold">
                      {record.finalQaMark}
                    </span>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <span className="inline-flex min-w-12 justify-center border border-[#153e90]/30 bg-[#153e90]/10 px-3 py-1 text-sm font-bold text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white">
                      {record.finalScore}
                    </span>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <span className="inline-flex min-w-10 justify-center border border-border bg-background px-3 py-1 text-sm font-bold">
                      {record.grade}
                    </span>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getResultClass(record.result)}`}>
                      {record.result}
                    </span>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getStatusClass(record.status)}`}>
                      {record.status}
                    </span>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="flex justify-end">
                      <Link
                        href={`/task-submissions/${record.id}`}
                        className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                      >
                        View Details
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {visibleMarks.length === 0 && (
                <tr>
                  <td colSpan={isStudent ? 11 : 12} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No marks found for the selected role.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="border border-border bg-card p-5">
          <h3 className="text-lg font-bold">Student View</h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Students see only their own marks, final score, grade and result. They can open details to check reviewer comments.
          </p>
        </div>

        <div className="border border-border bg-card p-5">
          <h3 className="text-lg font-bold">Reviewer Marks</h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Mentor, HOD and Final QA marks stay separate, so management can track each review level clearly.
          </p>
        </div>

        <div className="border border-border bg-card p-5">
          <h3 className="text-lg font-bold">Connected Details</h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            The detailed review page remains inside Task Submissions, avoiding duplicate review workflows.
          </p>
        </div>
      </div>
    </div>
  )
}