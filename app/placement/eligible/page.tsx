'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/lib/auth/provider'
import { useStudentList } from '@/lib/data/hooks/use-students'

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

const inputClass =
  'h-10 w-full border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[#153e90] dark:focus:border-[#6ee75a] dark:[color-scheme:dark]'

const selectClass =
  'h-10 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a] dark:[color-scheme:dark]'

const optionClass = 'bg-background text-foreground'

export default function EligibleStudentsPage() {
  const { can, user, parentRoleId } = useAuth()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const { students, loading, error } = useStudentList({
    parentRoleId,
    userId: user?.id,
  })

  const [search, setSearch] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('all')
  const [filterCourse, setFilterCourse] = useState('all')
  const [filterBatch, setFilterBatch] = useState('all')
  const [filterGrade, setFilterGrade] = useState('all')

  const eligibleStudents = useMemo(
    () => students.filter((student) => student.placement_ready),
    [students],
  )

  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Set(eligibleStudents.map((student) => student.department_name).filter((item) => item && item !== '—')),
      ).sort(),
    [eligibleStudents],
  )

  const courseOptions = useMemo(
    () =>
      Array.from(
        new Set(eligibleStudents.map((student) => student.course_name).filter((item) => item && item !== '—')),
      ).sort(),
    [eligibleStudents],
  )

  const batchOptions = useMemo(
    () =>
      Array.from(
        new Set(eligibleStudents.map((student) => student.batch_name).filter((item) => item && item !== '—')),
      ).sort(),
    [eligibleStudents],
  )

  const gradeOptions = useMemo(
    () =>
      Array.from(
        new Set(eligibleStudents.map((student) => student.grade).filter((item) => item && item !== '—')),
      ).sort(),
    [eligibleStudents],
  )

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return eligibleStudents.filter((student) => {
      const matchesSearch =
        !keyword ||
        student.full_name.toLowerCase().includes(keyword) ||
        student.email.toLowerCase().includes(keyword) ||
        student.student_code.toLowerCase().includes(keyword) ||
        student.course_name.toLowerCase().includes(keyword) ||
        student.department_name.toLowerCase().includes(keyword) ||
        student.batch_name.toLowerCase().includes(keyword)

      return (
        matchesSearch &&
        (filterDepartment === 'all' || student.department_name === filterDepartment) &&
        (filterCourse === 'all' || student.course_name === filterCourse) &&
        (filterBatch === 'all' || student.batch_name === filterBatch) &&
        (filterGrade === 'all' || student.grade === filterGrade)
      )
    })
  }, [eligibleStudents, search, filterDepartment, filterCourse, filterBatch, filterGrade])

  const resetFilters = () => {
    setSearch('')
    setFilterDepartment('all')
    setFilterCourse('all')
    setFilterBatch('all')
    setFilterGrade('all')
  }

  if (!can('placement.view') && !can('students.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Placement Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view eligible students.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Placement module</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Eligible Students</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Students ready for placement after batch completion, with attendance 75%+ and academic average 70%+.
          </p>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold">Filters</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Filter by department, course, batch and grade.
            </p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
          >
            Clear Filters
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={inputClass}
            placeholder="Search student, course, batch"
          />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select
              value={filterDepartment}
              onChange={(event) => setFilterDepartment(event.target.value)}
              className={selectClass}
            >
              <option value="all" className={optionClass}>
                All Departments
              </option>
              {departmentOptions.map((item) => (
                <option key={item} value={item} className={optionClass}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={filterCourse}
              onChange={(event) => setFilterCourse(event.target.value)}
              className={selectClass}
            >
              <option value="all" className={optionClass}>
                All Courses
              </option>
              {courseOptions.map((item) => (
                <option key={item} value={item} className={optionClass}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={filterBatch}
              onChange={(event) => setFilterBatch(event.target.value)}
              className={selectClass}
            >
              <option value="all" className={optionClass}>
                All Batches
              </option>
              {batchOptions.map((item) => (
                <option key={item} value={item} className={optionClass}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={filterGrade}
              onChange={(event) => setFilterGrade(event.target.value)}
              className={selectClass}
            >
              <option value="all" className={optionClass}>
                All Grades
              </option>
              {gradeOptions.map((item) => (
                <option key={item} value={item} className={optionClass}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold">Eligible Student List</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Showing {filteredStudents.length} of {eligibleStudents.length} eligible students. View more opens the
              student profile.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-semibold">Student</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Final Score</th>
                <th className="px-4 py-3 font-semibold">Grade</th>
                <th className="px-4 py-3 font-semibold">Attendance</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Loading eligible students...
                  </td>
                </tr>
              )}

              {!loading &&
                filteredStudents.map((student) => (
                  <tr key={`${student.id}-${student.batch_id}`} className="border-b border-border">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center overflow-hidden border border-border bg-background">
                          <Image
                            src={student.avatar_url || '/avatar.svg'}
                            alt={student.full_name}
                            width={44}
                            height={44}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-semibold">{student.full_name}</p>
                          <p className="text-xs text-muted-foreground">{student.student_code}</p>
                          <p className="text-xs text-muted-foreground">{student.batch_name}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-muted-foreground">{student.department_name}</td>

                    <td className="px-4 py-4">
                      <span className="inline-flex min-w-12 justify-center border border-[#153e90]/30 bg-[#153e90]/10 px-3 py-1 text-sm font-bold text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white">
                        {student.academic_percent === null ? '-' : `${student.academic_percent}%`}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span className="inline-flex min-w-10 justify-center border border-border bg-background px-3 py-1 text-sm font-bold">
                        {student.grade}
                      </span>
                    </td>

                    <td className="px-4 py-4 font-semibold">
                      {student.attendance_percent === null ? '-' : `${student.attendance_percent}%`}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-end">
                        <Link
                          href={`/placement/eligible/${student.id}`}
                          className="inline-flex items-center border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                        >
                          <CustomIcon
                            icon="dashboard.svg"
                            folder={iconFolder}
                            alt="View More"
                            className="mr-2 h-4 w-4"
                          />
                          View More
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading && filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No eligible students found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
