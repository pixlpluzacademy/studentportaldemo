'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useDemoAuth } from '@/lib/demo/auth'
import { attendance, batches, courses, students, submissions, tasks } from '@/lib/demo/seed'

type MyCourseRecord = {
  id: string
  name: string
  track: string
  duration: string
  tools: string
  batch: string
  mentor: string
  mode: string
  time: string
  seats: string
  studentsCount: number
  tasksCount: number
  submissionsCount: number
  attendanceAverage: string
  progress: number
  status: string
}

function getSeatCurrent(seats: string) {
  const current = seats.split('/')[0]
  return Number(current || 0)
}

function getCourseProgress(tasksCount: number, submissionsCount: number) {
  if (tasksCount === 0) return 0
  return Math.min(100, Math.round((submissionsCount / tasksCount) * 100))
}

function getStatusClass(status: string) {
  const value = status.toLowerCase()

  if (value.includes('active')) {
    return 'border-[#153e90]/30 bg-[#153e90]/10 text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white'
  }

  if (value.includes('full')) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  }

  if (value.includes('completed')) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
  }

  return 'border-border bg-background text-foreground'
}

function buildMyCourseRecords() {
  return courses.map((course) => {
    const relatedBatches = batches.filter((batch) => batch.course === course.name)
    const mainBatch = relatedBatches[0]
    const relatedStudents = students.filter((student) => student.course === course.name)
    const relatedTasks = tasks.filter((task) => task.course === course.name)
    const relatedSubmissions = submissions.filter((submission) => relatedTasks.some((task) => task.title === submission.task))
    const relatedAttendance = attendance.filter((item) => relatedBatches.some((batch) => batch.name === item.batch))

    const averageAttendance =
      relatedStudents.length > 0
        ? `${Math.round(
            relatedStudents.reduce((total, student) => total + Number(String(student.attendance).replace('%', '')), 0) /
              relatedStudents.length,
          )}%`
        : '0%'

    return {
      id: course.id,
      name: course.name,
      track: course.track,
      duration: course.duration,
      tools: course.tools,
      batch: mainBatch?.name || 'No active batch',
      mentor: mainBatch?.mentor || 'Not assigned',
      mode: mainBatch?.mode || '-',
      time: mainBatch?.time || '-',
      seats: mainBatch?.seats || '0/0',
      studentsCount: relatedStudents.length || getSeatCurrent(mainBatch?.seats || '0/0'),
      tasksCount: relatedTasks.length,
      submissionsCount: relatedSubmissions.length,
      attendanceAverage: averageAttendance,
      progress: getCourseProgress(relatedTasks.length, relatedSubmissions.length),
      status: mainBatch?.status || course.status,
    } satisfies MyCourseRecord
  })
}

export default function Page() {
  const { role, user } = useDemoAuth()

  const isStudent = role?.id === 'student'
  const ismentor = role?.id === 'mentor' || role?.id === 'mentor'
  const isHod = role?.id === 'hod'

  const currentStudent = useMemo(() => {
    return students.find((student) => student.name === user?.fullName) || students[0]
  }, [user?.fullName])

  const records = useMemo(() => buildMyCourseRecords(), [])

  const visibleCourses = useMemo(() => {
    if (isStudent) {
      return records.filter((course) => course.name === currentStudent?.course)
    }

    if (ismentor && user?.fullName) {
      const assignedCourseNames = batches.filter((batch) => batch.mentor === user.fullName).map((batch) => batch.course)
      return records.filter((course) => assignedCourseNames.includes(course.name))
    }

    if (isHod) {
      return records
    }

    return records
  }, [currentStudent?.course, isHod, isStudent, ismentor, records, user?.fullName])

  const totalStudents = visibleCourses.reduce((total, course) => total + course.studentsCount, 0)
  const totalTasks = visibleCourses.reduce((total, course) => total + course.tasksCount, 0)
  const totalSubmissions = visibleCourses.reduce((total, course) => total + course.submissionsCount, 0)

  const averageProgress =
    visibleCourses.length > 0
      ? Math.round(visibleCourses.reduce((total, course) => total + course.progress, 0) / visibleCourses.length)
      : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Learning and teaching view</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">My Courses</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Students can view their own course details. mentors can view all courses connected to their assigned batches.
          </p>
        </div>

        <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Current role:</span> {role?.name || 'Not selected'}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{visibleCourses.length}</div>
          <div className="mt-1 text-sm text-muted-foreground">{isStudent ? 'My Course' : 'Courses'}</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Visible based on role</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{totalStudents}</div>
          <div className="mt-1 text-sm text-muted-foreground">{isStudent ? 'My Batch Students' : 'Students'}</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">From connected batches</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{totalTasks}</div>
          <div className="mt-1 text-sm text-muted-foreground">Assigned Tasks</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">{totalSubmissions} submissions</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{averageProgress}%</div>
          <div className="mt-1 text-sm text-muted-foreground">Average Progress</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Demo calculation</div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <div className="border border-border bg-card p-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-bold">{isStudent ? 'My Course Overview' : 'Assigned Course Overview'}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Open any course to see syllabus, tasks, attendance, submissions and marks summary.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {isStudent && (
                  <span className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 font-semibold text-[#153e90] dark:text-white">
                    Student: own course only
                  </span>
                )}

                {ismentor && (
                  <span className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 font-semibold text-[#153e90] dark:text-white">
                    mentor: assigned batches only
                  </span>
                )}

                {!isStudent && !ismentor && (
                  <span className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 font-semibold text-[#153e90] dark:text-white">
                    Management overview
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              {visibleCourses.map((course) => (
                <div key={course.id} className="border border-border bg-background/60 p-5">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="flex gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-[#153e90]/10 text-lg font-bold text-[#153e90] dark:bg-[#6ee75a]/10 dark:text-[#6ee75a]">
                        {course.name.slice(0, 2).toUpperCase()}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-bold">{course.name}</h3>
                          <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getStatusClass(course.status)}`}>
                            {course.status}
                          </span>
                        </div>

                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                          {course.track} course with {course.duration} duration. Tools include {course.tools}.
                        </p>

                        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                          <div className="border border-border bg-card p-3">
                            <div className="text-xs text-muted-foreground">Batch</div>
                            <div className="mt-1 font-semibold">{course.batch}</div>
                          </div>

                          <div className="border border-border bg-card p-3">
                            <div className="text-xs text-muted-foreground">Mentor</div>
                            <div className="mt-1 font-semibold">{course.mentor}</div>
                          </div>

                          <div className="border border-border bg-card p-3">
                            <div className="text-xs text-muted-foreground">Mode and Time</div>
                            <div className="mt-1 font-semibold">
                              {course.mode} · {course.time}
                            </div>
                          </div>

                          <div className="border border-border bg-card p-3">
                            <div className="text-xs text-muted-foreground">Attendance</div>
                            <div className="mt-1 font-semibold">{course.attendanceAverage}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-3 lg:w-44">
                      <Link
                        href={`/my-courses/${course.id}`}
                        className="bg-[#153e90] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
                      >
                        View Course
                      </Link>

                      <Link
                        href="/tasks"
                        className="border border-border px-4 py-2.5 text-center text-sm font-semibold hover:bg-accent"
                      >
                        View Tasks
                      </Link>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>Course Progress</span>
                      <span>{course.progress}%</span>
                    </div>
                    <div className="mt-2 h-2 bg-muted">
                      <div className="h-2 bg-[#153e90] dark:bg-[#6ee75a]" style={{ width: `${course.progress}%` }} />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="border border-border bg-card p-3">
                      <div className="text-2xl font-bold">{course.studentsCount}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Students</div>
                    </div>

                    <div className="border border-border bg-card p-3">
                      <div className="text-2xl font-bold">{course.tasksCount}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Tasks</div>
                    </div>

                    <div className="border border-border bg-card p-3">
                      <div className="text-2xl font-bold">{course.submissionsCount}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Submissions</div>
                    </div>

                    <div className="border border-border bg-card p-3">
                      <div className="text-2xl font-bold">{course.seats}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Batch Seats</div>
                    </div>
                  </div>
                </div>
              ))}

              {visibleCourses.length === 0 && (
                <div className="border border-border bg-background/60 p-8 text-center text-sm text-muted-foreground">
                  No courses found for the selected role.
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="border border-border bg-card p-5">
            <h3 className="text-lg font-bold">Page Purpose</h3>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#153e90] dark:bg-[#6ee75a]" />
                Students use this page to see their own course and learning progress.
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#153e90] dark:bg-[#6ee75a]" />
                mentors use this page to see courses linked with assigned batches.
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#153e90] dark:bg-[#6ee75a]" />
                Detailed course page connects syllabus, tasks, attendance, submissions and marks.
              </li>
            </ul>
          </div>

          <div className="border border-border bg-card p-5">
            <h3 className="text-lg font-bold">Connected Modules</h3>
            <div className="mt-4 grid gap-3 text-sm">
              <Link href="/tasks" className="border border-border bg-background/60 p-3 font-semibold hover:bg-accent">
                Tasks / Assignments
              </Link>
              <Link href="/task-submissions" className="border border-border bg-background/60 p-3 font-semibold hover:bg-accent">
                Task Submissions
              </Link>
              <Link href="/marks" className="border border-border bg-background/60 p-3 font-semibold hover:bg-accent">
                Marks / Evaluation
              </Link>
              <Link href="/attendance" className="border border-border bg-background/60 p-3 font-semibold hover:bg-accent">
                Attendance
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}