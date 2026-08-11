'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth/provider'
import { useMyCourses } from '@/lib/data/hooks/use-my-courses'
import { filterMyCourses, isStudentMyCoursesView } from '@/lib/data/my-courses'

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

function formatRoleLabel(parentRoleId: string | null, roleName?: string) {
  if (roleName) return roleName

  if (!parentRoleId) return 'User'

  return parentRoleId
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function Page() {
  const { can, user, role, parentRoleId } = useAuth()
  const { courses, loading, error } = useMyCourses({
    parentRoleId,
    userId: user?.id,
  })

  const [search, setSearch] = useState('')

  const isStudent = isStudentMyCoursesView(parentRoleId)
  const isMentor = parentRoleId === 'mentor'

  const visibleCourses = useMemo(() => {
    if (isStudent) return courses
    return filterMyCourses(courses, search)
  }, [courses, isStudent, search])

  const totalStudents = visibleCourses.reduce((total, course) => total + course.studentsCount, 0)
  const totalTasks = visibleCourses.reduce((total, course) => total + course.tasksCount, 0)
  const totalSubmissions = visibleCourses.reduce((total, course) => total + course.submissionsCount, 0)

  const averageProgress =
    visibleCourses.length > 0
      ? Math.round(visibleCourses.reduce((total, course) => total + course.progress, 0) / visibleCourses.length)
      : 0

  if (!can('my-courses.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">My Courses Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view courses.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Learning and teaching view</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">My Courses</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Students see their enrolled course. Mentors and staff see courses linked to assigned batches in the
            active branch.
          </p>
        </div>

        <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Current role:</span> {formatRoleLabel(parentRoleId, role?.name)}
        </div>
      </div>

      {error && (
        <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{visibleCourses.length}</div>
          <div className="mt-1 text-sm text-muted-foreground">{isStudent ? 'My Course' : 'Courses'}</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Visible based on role</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{totalStudents}</div>
          <div className="mt-1 text-sm text-muted-foreground">{isStudent ? 'Batch Students' : 'Students'}</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">From connected batches</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{totalTasks}</div>
          <div className="mt-1 text-sm text-muted-foreground">Assigned Tasks</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">
            {totalSubmissions} submissions across visible courses
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{averageProgress}%</div>
          <div className="mt-1 text-sm text-muted-foreground">Average Progress</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Based on task submissions</div>
        </div>
      </div>

      <div className="grid gap-5 ">
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

                {isMentor && (
                  <span className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 font-semibold text-[#153e90] dark:text-white">
                    Mentor: assigned batches only
                  </span>
                )}

                {!isStudent && !isMentor && (
                  <span className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 font-semibold text-[#153e90] dark:text-white">
                    Branch overview
                  </span>
                )}
              </div>
            </div>

            {!isStudent && (
              <div className="mt-5">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a] md:max-w-md"
                  placeholder="Search by course, batch, mentor, mode, or tools"
                />
              </div>
            )}

            <div className="mt-5 grid gap-4">
              {loading ? (
                <div className="border border-border bg-background/60 p-8 text-center text-sm text-muted-foreground">
                  Loading courses…
                </div>
              ) : visibleCourses.length === 0 ? (
                <div className="border border-border bg-background/60 p-8 text-center text-sm text-muted-foreground">
                  {isStudent
                    ? 'No enrolled course found for your account in this branch.'
                    : search.trim()
                      ? 'No courses match your search.'
                      : 'No courses found for your role in this branch.'}
                </div>
              ) : (
                visibleCourses.map((course) => (
                  <div key={course.batch_id} className="border border-border bg-background/60 p-5">
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div className="flex gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-[#153e90]/10 text-lg font-bold text-[#153e90] dark:bg-[#6ee75a]/10 dark:text-[#6ee75a]">
                          {course.name.slice(0, 2).toUpperCase()}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-bold">{course.name}</h3>
                            <span
                              className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getStatusClass(course.status)}`}
                            >
                              {course.status}
                            </span>
                          </div>

                          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                            {course.track} course with {course.duration}. Tools include {course.tools}.
                          </p>

                          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                            <div className="border border-border bg-card p-3">
                              <div className="text-xs text-muted-foreground">Batch</div>
                              <div className="mt-1 font-semibold">{course.batch}</div>
                              {course.batch_code ? (
                                <div className="mt-1 text-xs text-muted-foreground">{course.batch_code}</div>
                              ) : null}
                            </div>

                            <div className="border border-border bg-card p-3">
                              <div className="text-xs text-muted-foreground">Trainer</div>
                              <div className="mt-1 font-semibold">{course.mentor}</div>
                              <div className="mt-1 text-xs text-muted-foreground">HOD: {course.hod}</div>
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
                          href={`/my-courses/${course.course_id}`}
                          className="bg-[#153e90] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
                        >
                          View Course
                        </Link>

                        {!isStudent && (
                          <Link
                            href={`/batches/${course.batch_id}`}
                            className="border border-border px-4 py-2.5 text-center text-sm font-semibold hover:bg-accent"
                          >
                            View Batch
                          </Link>
                        )}
                      </div>
                    </div>

                    {!isStudent && (
                      <>
                        <div className="mt-5">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span>Course Progress</span>
                            <span>{course.progress}%</span>
                          </div>
                          <div className="mt-2 h-2 bg-muted">
                            <div
                              className="h-2 bg-[#153e90] dark:bg-[#6ee75a]"
                              style={{ width: `${course.progress}%` }}
                            />
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
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>


      </div>
    </div>
  )
}
