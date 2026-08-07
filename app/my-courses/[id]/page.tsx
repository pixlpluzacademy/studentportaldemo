'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth/provider'
import type { CourseBlueprint } from '@/lib/data/course-blueprint'
import {
  buildCourseAttendanceSummaries,
  computeAttendancePercent,
  fetchAttendanceRecords,
  listExpectedClassDays,
  mapBatchListRowToAttendanceBatch,
  type CourseAttendanceSessionSummary,
} from '@/lib/data/attendance'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import {
  fetchAccessibleBatches,
  fetchMyCourseDetail,
  type MyCourseDetailBatch,
} from '@/lib/data/my-courses'
import { fetchTaskSubmissions, type TaskSubmissionListRow } from '@/lib/data/task-submissions'
import { fetchStudentIdByProfileId, fetchTasksForBatches, type CourseTaskRow } from '@/lib/data/tasks'
import { createClient } from '@/lib/supabase/client'

type WorkPackage = {
  id: string
  number: string
  title: string
  duration: string
  goal: string
  skills: string[]
  tools: string[]
  practiceTasks: string[]
  finalDeliverable: string
}

type CourseLevel = {
  id: string
  name: string
  color: 'green' | 'yellow' | 'pink'
  summary: string
  packages: WorkPackage[]
}

type CourseDetail = {
  id: string
  name: string
  type: string
  tagline: string
  description: string
  duration: string
  workPackages: number
  passMark: number
  levels: CourseLevel[]
  assignments: string[]
  rubric: { label: string; value: string }[]
  tools: string[]
}

type MarksRow = {
  id: string
  student: string
  task: string
  mentorScore: string
  hodStatus: string
  qaStatus: string
}

const tabs = ['Overview', 'Syllabus', 'Tasks', 'Attendance', 'Marks']

function mapBlueprintToDetail(blueprint: CourseBlueprint): CourseDetail {
  return {
    id: blueprint.id,
    name: blueprint.name,
    type: blueprint.typeLabel,
    tagline: blueprint.tagline,
    description: blueprint.description,
    duration: blueprint.duration,
    workPackages: blueprint.workPackages,
    passMark: blueprint.passMark,
    levels: blueprint.levels.map((level) => ({
      id: level.id,
      name: level.name,
      color: level.color,
      summary: level.summary,
      packages: level.packages.map((pkg) => ({
        id: pkg.id,
        number: pkg.number,
        title: pkg.title,
        duration: pkg.duration,
        goal: pkg.goal,
        skills: pkg.skills,
        tools: pkg.tools,
        practiceTasks: pkg.practiceTasks,
        finalDeliverable: pkg.finalDeliverable,
      })),
    })),
    assignments: blueprint.assignments,
    rubric: blueprint.rubric,
    tools: blueprint.tools,
  }
}

function mapSubmissionRow(row: TaskSubmissionListRow): MarksRow {
  return {
    id: row.id,
    student: row.student,
    task: row.task,
    mentorScore: row.mentorMark,
    hodStatus: row.hodStatus,
    qaStatus: row.qaStatus,
  }
}

function levelStyle(color: CourseLevel['color']) {
  if (color === 'green') return 'border-[#6ee75a] text-[#6ee75a] bg-[#6ee75a]/10'
  if (color === 'yellow') return 'border-yellow-500 text-yellow-500 bg-yellow-500/10'
  return 'border-pink-500 text-pink-500 bg-pink-500/10'
}

function levelBorder(color: CourseLevel['color']) {
  if (color === 'green') return 'border-[#6ee75a]'
  if (color === 'yellow') return 'border-yellow-500'
  return 'border-pink-500'
}

function getStatusClass(status: string) {
  const value = status.toLowerCase()

  if (value.includes('active') || value.includes('open') || value.includes('marked')) {
    return 'border-[#153e90]/30 bg-[#153e90]/10 text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white'
  }

  if (value.includes('review') || value.includes('pending')) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  }

  if (value.includes('approved') || value.includes('passed')) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
  }

  return 'border-border bg-background text-foreground'
}

function getGrade(score: number) {
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

export default function Page() {
  const params = useParams()
  const { can, user, parentRoleId } = useAuth()
  const { activeBranchId } = useBranchScope()

  const [activeTab, setActiveTab] = useState('Overview')
  const [openPackage, setOpenPackage] = useState('')
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [relatedBatches, setRelatedBatches] = useState<MyCourseDetailBatch[]>([])
  const [relatedTasks, setRelatedTasks] = useState<CourseTaskRow[]>([])
  const [relatedAttendance, setRelatedAttendance] = useState<CourseAttendanceSessionSummary[]>([])
  const [relatedSubmissions, setRelatedSubmissions] = useState<MarksRow[]>([])
  const [averageAttendance, setAverageAttendance] = useState('—')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const courseId = String(params?.id || '')

  const isStudent = parentRoleId === 'student'
  const isMentor = parentRoleId === 'mentor'

  useEffect(() => {
    async function loadCourse() {
      if (!courseId || !user?.id) {
        setLoading(false)
        return
      }

      if (!isStudent && !activeBranchId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      const result = await fetchMyCourseDetail(courseId, {
        branchId: activeBranchId || '',
        userId: user.id,
        parentRoleId,
      })

      if (result.error || !result.data) {
        setCourse(null)
        setRelatedBatches([])
        setRelatedTasks([])
        setRelatedAttendance([])
        setRelatedSubmissions([])
        setAverageAttendance('—')
        setError(result.error || 'Course not found.')
        setLoading(false)
        return
      }

      const { course: blueprint, batches } = result.data
      setCourse(mapBlueprintToDetail(blueprint))
      setRelatedBatches(batches)

      const batchIds = batches.map((batch) => batch.id)

      if (!batchIds.length) {
        setRelatedTasks([])
        setRelatedAttendance([])
        setRelatedSubmissions([])
        setAverageAttendance('—')
        setLoading(false)
        return
      }

      const { batches: accessibleBatches } = await fetchAccessibleBatches({
        branchId: activeBranchId || '',
        userId: user.id,
        parentRoleId,
      })

      const scopedBatches = accessibleBatches.filter((batch) => batchIds.includes(batch.id))
      const attendanceBatches = scopedBatches.map(mapBatchListRowToAttendanceBatch)
      const batchesById = new Map(attendanceBatches.map((batch) => [batch.id, batch]))
      const batchNames = new Map(batches.map((batch) => [batch.id, batch.name]))
      const enrolledCounts = new Map(scopedBatches.map((batch) => [batch.id, batch.enrolled_count]))
      const batchLookup = new Map(
        scopedBatches.map((batch) => [
          batch.id,
          {
            name: batch.name,
            courseName: batch.course_name,
            enrolledCount: batch.enrolled_count,
          },
        ]),
      )

      const studentId = isStudent ? await fetchStudentIdByProfileId(user.id) : null

      const [tasksResult, attendanceResult, submissionsResult] = await Promise.all([
        fetchTasksForBatches(batchIds, {
          studentId,
          batchNames,
          enrolledCounts,
        }),
        fetchAttendanceRecords(batchIds, {
          studentId: studentId || undefined,
          batchesById,
        }),
        fetchTaskSubmissions({ batchLookup }),
      ])

      setRelatedTasks(tasksResult.data || [])

      const summaries = buildCourseAttendanceSummaries(attendanceBatches, attendanceResult.data || [])
      setRelatedAttendance(summaries)

      const filteredSubmissions = (submissionsResult.data || []).filter((row) =>
        batchIds.includes(row.batchId),
      )
      setRelatedSubmissions(filteredSubmissions.map(mapSubmissionRow))

      if (isStudent) {
        const records = attendanceResult.data || []
        const percents: number[] = []

        for (const batch of attendanceBatches) {
          const batchRecords = records.filter((record) => record.batchId === batch.id)
          const schedule = {
            startDate: batch.start_date,
            endDate: batch.end_date,
            classDayType: batch.class_day_type || 'weekdays',
            customDays: batch.custom_days,
          }
          if (!listExpectedClassDays(schedule).length) continue
          percents.push(computeAttendancePercent(batchRecords, schedule))
        }

        setAverageAttendance(
          percents.length
            ? `${Math.round(percents.reduce((total, value) => total + value, 0) / percents.length)}%`
            : '—',
        )
      } else if (summaries.length) {
        const totalPresent = summaries.reduce((total, item) => total + item.present, 0)
        const totalMarked = summaries.reduce(
          (total, item) => total + item.present + item.absent + item.late,
          0,
        )
        setAverageAttendance(
          totalMarked > 0 ? `${Math.round((totalPresent / totalMarked) * 100)}%` : '—',
        )
      } else {
        setAverageAttendance('—')
      }

      setLoading(false)
    }

    void loadCourse()
  }, [activeBranchId, courseId, isStudent, parentRoleId, user?.id])

  const courseProgress = useMemo(() => {
    if (!relatedTasks.length) return 0
    const completedCount = relatedSubmissions.length
    return Math.min(100, Math.round((completedCount / relatedTasks.length) * 100))
  }, [relatedSubmissions.length, relatedTasks.length])

  const averageScore = useMemo(() => {
    if (!relatedSubmissions.length) return 0

    const scores = relatedSubmissions
      .map((submission) => Number(submission.mentorScore))
      .filter((value) => !Number.isNaN(value) && value > 0)

    if (!scores.length) return 0

    return Math.round(scores.reduce((total, value) => total + value, 0) / scores.length)
  }, [relatedSubmissions])

  if (!can('my-courses.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">My Courses Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view courses.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl border border-border bg-card p-8">
        <p className="text-sm text-muted-foreground">Loading course details...</p>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Link href="/my-courses" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
          ← My Courses
        </Link>
        <div className="border border-border bg-card p-8">
          <h1 className="text-2xl font-bold">Course Unavailable</h1>
          <p className="mt-2 text-muted-foreground">{error || 'This course could not be loaded.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <Link href="/my-courses" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
          ← My Courses
        </Link>

        <div className="flex flex-wrap gap-2">
          <Link href="/tasks" className="border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
            View Tasks
          </Link>
          <Link
            href="/task-submissions"
            className="bg-[#153e90] px-4 py-2 text-sm font-semibold text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black"
          >
            View Submissions
          </Link>
        </div>
      </div>

      <div className="border border-border bg-card p-6">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex h-14 w-14 items-center justify-center bg-[#153e90]/10 text-xl font-bold text-[#153e90] dark:bg-[#6ee75a]/10 dark:text-[#6ee75a]">
            {course.name.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1">
            <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">{course.type}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{course.name}</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">{course.tagline}</p>
            <p className="mt-4 max-w-4xl leading-7 text-muted-foreground">{course.description}</p>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Duration</p>
                <p className="mt-1 text-lg font-bold">{course.duration}</p>
              </div>

              <div className="border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Work Packages</p>
                <p className="mt-1 text-lg font-bold">{course.workPackages}</p>
              </div>

              <div className="border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pass Mark</p>
                <p className="mt-1 text-lg font-bold">{course.passMark}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{courseProgress}%</div>
          <div className="mt-1 text-sm text-muted-foreground">Course Progress</div>
          <div className="mt-3 h-2 bg-muted">
            <div className="h-2 bg-[#153e90] dark:bg-[#6ee75a]" style={{ width: `${courseProgress}%` }} />
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{averageAttendance}</div>
          <div className="mt-1 text-sm text-muted-foreground">Attendance</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Batch average</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{relatedTasks.length}</div>
          <div className="mt-1 text-sm text-muted-foreground">Assigned Tasks</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">
            {relatedSubmissions.length} submissions
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{averageScore || '-'}</div>
          <div className="mt-1 text-sm text-muted-foreground">Average Mark</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">
            {averageScore ? `Grade ${getGrade(averageScore)}` : 'No marks yet'}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border border-border bg-card">
        <div className="flex min-w-[900px]">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={
                activeTab === tab
                  ? 'border-b-2 border-[#153e90] px-5 py-4 text-sm font-semibold text-[#153e90] dark:border-[#6ee75a] dark:text-[#6ee75a]'
                  : 'border-b-2 border-transparent px-5 py-4 text-sm font-semibold text-muted-foreground hover:text-foreground'
              }
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Overview' && (
        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <div className="border border-border bg-card p-6">
              <h2 className="text-xl font-bold">Course Overview</h2>
              <p className="mt-3 leading-7 text-muted-foreground">
                This page is focused on the learner and mentor view. Students can understand what they are learning,
                what tasks are pending, how attendance is performing and how their marks are progressing.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {relatedBatches.map((batch) => (
                  <div key={batch.id} className="border border-border bg-background/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold">{batch.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {batch.mode} · {batch.time}
                        </p>
                      </div>
                      <span
                        className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getStatusClass(batch.status)}`}
                      >
                        {batch.status}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mentor</span>
                        <span className="font-semibold">{batch.mentor}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Seats</span>
                        <span className="font-semibold">{batch.seats}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-border bg-card p-6">
              <h2 className="text-xl font-bold">Learning Summary</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <Link href="/tasks" className="border border-border bg-background/60 p-4 hover:bg-accent">
                  <div className="text-2xl font-bold">{relatedTasks.length}</div>
                  <div className="mt-1 text-sm text-muted-foreground">Tasks Assigned</div>
                </Link>
                <Link href="/task-submissions" className="border border-border bg-background/60 p-4 hover:bg-accent">
                  <div className="text-2xl font-bold">{relatedSubmissions.length}</div>
                  <div className="mt-1 text-sm text-muted-foreground">Submissions</div>
                </Link>
                <Link href="/marks" className="border border-border bg-background/60 p-4 hover:bg-accent">
                  <div className="text-2xl font-bold">{averageScore || '-'}</div>
                  <div className="mt-1 text-sm text-muted-foreground">Current Mark</div>
                </Link>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="border border-border bg-card p-5">
              <h3 className="text-lg font-bold">Role View</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {isStudent
                  ? 'You are viewing the course connected to your batch.'
                  : isMentor
                    ? 'You are viewing course details connected to your assigned batches.'
                    : 'Management can view connected batches, students, tasks and progress.'}
              </p>
            </div>

            <div className="border border-border bg-card p-5">
              <h3 className="text-lg font-bold">Course Tools</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {course.tools.length > 0 ? (
                  course.tools.map((tool) => (
                    <span key={tool} className="border border-border bg-background px-3 py-1 text-xs font-semibold">
                      {tool}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No tools added yet.</p>
                )}
              </div>
            </div>

            <div className="border border-border bg-card p-5">
              <h3 className="text-lg font-bold">Marking Criteria</h3>
              {course.rubric.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No marking criteria added yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {course.rubric.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between border border-border bg-background/60 p-3 text-sm"
                    >
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-bold">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {activeTab === 'Syllabus' && (
        <div className="space-y-5">
          {course.levels.map((level) => (
            <div key={level.id} className={`border bg-card p-5 ${levelBorder(level.color)}`}>
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <span className={`inline-flex border px-3 py-1 text-xs font-semibold ${levelStyle(level.color)}`}>
                    {level.name}
                  </span>
                  <h2 className="mt-3 text-xl font-bold">{level.name} Level</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{level.summary}</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {level.packages.map((pkg) => (
                  <div key={pkg.id} className="border border-border bg-background/60">
                    <button
                      type="button"
                      onClick={() => setOpenPackage(openPackage === pkg.id ? '' : pkg.id)}
                      className="flex w-full items-center justify-between gap-4 p-4 text-left"
                    >
                      <div>
                        <div className="text-xs font-semibold text-[#153e90] dark:text-[#6ee75a]">
                          Package {pkg.number}
                        </div>
                        <div className="mt-1 font-bold">{pkg.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{pkg.duration}</div>
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground">
                        {openPackage === pkg.id ? 'Close' : 'View'}
                      </span>
                    </button>

                    {openPackage === pkg.id && (
                      <div className="border-t border-border p-4">
                        <p className="text-sm leading-6 text-muted-foreground">{pkg.goal}</p>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <h4 className="text-sm font-bold">Skills</h4>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {pkg.skills.map((skill) => (
                                <span key={skill} className="border border-border bg-card px-3 py-1 text-xs font-semibold">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold">Tools</h4>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {pkg.tools.map((tool) => (
                                <span key={tool} className="border border-border bg-card px-3 py-1 text-xs font-semibold">
                                  {tool}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <h4 className="text-sm font-bold">Practice Tasks</h4>
                          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                            {pkg.practiceTasks.map((task) => (
                              <li key={task} className="flex gap-2">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#153e90] dark:bg-[#6ee75a]" />
                                {task}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="mt-4 border border-[#153e90]/25 bg-[#153e90]/10 p-4 text-sm text-[#153e90] dark:border-[#6ee75a]/25 dark:bg-[#6ee75a]/10 dark:text-white">
                          Final Deliverable: {pkg.finalDeliverable}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Tasks' && (
        <div className="border border-border bg-card p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold">Course Tasks</h2>
              <p className="mt-1 text-sm text-muted-foreground">Tasks assigned to the connected batch.</p>
            </div>
            <Link href="/tasks" className="border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">
              Open Tasks Page
            </Link>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-3 font-semibold">Task</th>
                  <th className="px-4 py-3 font-semibold">Batch</th>
                  <th className="px-4 py-3 font-semibold">Assigned By</th>
                  <th className="px-4 py-3 font-semibold">Due</th>
                  <th className="px-4 py-3 font-semibold">Submissions</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {relatedTasks.map((task) => (
                  <tr key={task.id} className="border-b border-border">
                    <td className="px-4 py-4 font-semibold">{task.title}</td>
                    <td className="px-4 py-4 text-muted-foreground">{task.batch}</td>
                    <td className="px-4 py-4 text-muted-foreground">{task.assignedBy}</td>
                    <td className="px-4 py-4 text-muted-foreground">{task.due}</td>
                    <td className="px-4 py-4 text-muted-foreground">{task.submissions}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getStatusClass(task.status)}`}
                      >
                        {task.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {relatedTasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No tasks found for this course.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Attendance' && (
        <div className="border border-border bg-card p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold">Attendance Summary</h2>
              <p className="mt-1 text-sm text-muted-foreground">Attendance connected to this course batch.</p>
            </div>
            <Link href="/attendance" className="border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">
              Open Attendance
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {relatedAttendance.map((item) => (
              <div key={item.id} className="border border-border bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{item.session}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.date} · {item.batch}
                    </p>
                  </div>
                  <span
                    className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getStatusClass(item.status)}`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="border border-border bg-card p-3">
                    <div className="text-xl font-bold">{item.present}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Present</div>
                  </div>
                  <div className="border border-border bg-card p-3">
                    <div className="text-xl font-bold">{item.absent}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Absent</div>
                  </div>
                  <div className="border border-border bg-card p-3">
                    <div className="text-xl font-bold">{item.late}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Late</div>
                  </div>
                </div>
              </div>
            ))}

            {relatedAttendance.length === 0 && (
              <div className="border border-border bg-background/60 p-8 text-center text-sm text-muted-foreground md:col-span-2">
                No attendance records found for this course.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'Marks' && (
        <div className="border border-border bg-card p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold">Marks Summary</h2>
              <p className="mt-1 text-sm text-muted-foreground">Marks are connected with task submissions.</p>
            </div>
            <Link href="/marks" className="border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">
              Open Marks
            </Link>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  {!isStudent && <th className="px-4 py-3 font-semibold">Student</th>}
                  <th className="px-4 py-3 font-semibold">Task</th>
                  <th className="px-4 py-3 font-semibold">Mentor Mark</th>
                  <th className="px-4 py-3 font-semibold">HOD</th>
                  <th className="px-4 py-3 font-semibold">Final QA</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {relatedSubmissions.map((submission) => (
                  <tr key={submission.id} className="border-b border-border">
                    {!isStudent && <td className="px-4 py-4 font-semibold">{submission.student}</td>}
                    <td className="px-4 py-4 text-muted-foreground">{submission.task}</td>
                    <td className="px-4 py-4 text-muted-foreground">{submission.mentorScore}</td>
                    <td className="px-4 py-4 text-muted-foreground">{submission.hodStatus}</td>
                    <td className="px-4 py-4 text-muted-foreground">{submission.qaStatus}</td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/task-submissions/${submission.id}`}
                        className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}

                {relatedSubmissions.length === 0 && (
                  <tr>
                    <td colSpan={isStudent ? 5 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No marks found for this course.
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
