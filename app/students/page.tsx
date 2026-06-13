'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/provider'
import { useStudentList } from '@/lib/data/hooks/use-students'
import type { StudentListRow, StudentUiStatus } from '@/lib/data/students'

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

function getStatusClass(status: StudentUiStatus) {
  if (status === 'active') {
    return 'border border-[#153e90]/30 bg-[#153e90]/10 px-3 py-1 text-xs font-medium text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white'
  }

  if (status === 'completed') {
    return 'border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-200'
  }

  return 'border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground'
}

function getStudentViewId(student: StudentListRow) {
  return student.profile_id || student.id
}

export default function Page() {
  const { can, user, parentRoleId } = useAuth()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const { students, loading, error: loadError, staffScoped } = useStudentList({
    parentRoleId,
    userId: user?.id,
  })

  const [search, setSearch] = useState('')
  const [filterCourse, setFilterCourse] = useState('all')
  const [filterBatch, setFilterBatch] = useState('all')
  const [filterPlacement, setFilterPlacement] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterGrade, setFilterGrade] = useState('all')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const canExportStudent = can('students.export')

  const courseOptions = useMemo(() => {
    return Array.from(new Set(students.map((student) => student.course_name).filter(Boolean))).sort()
  }, [students])

  const batchOptions = useMemo(() => {
    return Array.from(new Set(students.map((student) => student.batch_name).filter(Boolean))).sort()
  }, [students])

  const placementOptions = useMemo(() => {
    return Array.from(new Set(students.map((student) => student.placement).filter(Boolean))).sort()
  }, [students])

  const gradeOptions = useMemo(() => {
    return Array.from(new Set(students.map((student) => student.grade).filter(Boolean))).sort()
  }, [students])

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return students.filter((student) => {
      const matchesSearch =
        !keyword ||
        student.full_name.toLowerCase().includes(keyword) ||
        student.email.toLowerCase().includes(keyword) ||
        student.phone.toLowerCase().includes(keyword) ||
        student.student_code.toLowerCase().includes(keyword) ||
        student.course_name.toLowerCase().includes(keyword) ||
        student.batch_name.toLowerCase().includes(keyword) ||
        student.placement.toLowerCase().includes(keyword) ||
        student.status.toLowerCase().includes(keyword)

      return (
        matchesSearch &&
        (filterCourse === 'all' || student.course_name === filterCourse) &&
        (filterBatch === 'all' || student.batch_name === filterBatch) &&
        (filterPlacement === 'all' || student.placement === filterPlacement) &&
        (filterStatus === 'all' || student.status === filterStatus) &&
        (filterGrade === 'all' || student.grade === filterGrade)
      )
    })
  }, [students, search, filterCourse, filterBatch, filterPlacement, filterStatus, filterGrade])

  const activeStudents = filteredStudents.filter((student) => student.status === 'active')
  const placementEligible = filteredStudents.filter((student) => {
    return student.placement.toLowerCase() !== 'not started'
  })

  const resetFilters = () => {
    setSearch('')
    setFilterCourse('all')
    setFilterBatch('all')
    setFilterPlacement('all')
    setFilterStatus('all')
    setFilterGrade('all')
  }

  const exportStudents = () => {
    setError('')
    setMessage('')

    if (!canExportStudent) {
      setError('Your current permission cannot export students.')
      return
    }

    setMessage('Export will be available in a later phase.')
  }

  if (!can('students.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Students Locked</h1>
        <p className="mt-2 text-muted-foreground">
          Your current permission cannot view students.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border border-border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Student Directory</p>
            <h1 className="mt-2 text-3xl font-bold">Students</h1>
            <p className="mt-3 max-w-4xl text-muted-foreground">
              {staffScoped
                ? 'View students from your assigned batches only. New students are created from the batch page.'
                : 'View student records with batch allocation, attendance, grade and placement status. New students are created from the batch page.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {canExportStudent && !staffScoped && (
              <Button type="button" variant="outline" onClick={exportStudents}>
                Export
              </Button>
            )}
          </div>
        </div>
      </div>

      {(error || loadError) && (
        <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error || loadError}
        </div>
      )}

      {message && (
        <div className="border border-[#153e90]/30 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white">
          {message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            {staffScoped ? 'Assigned Students' : 'Students'}
          </p>
          <p className="mt-4 text-4xl font-bold">{filteredStudents.length}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            {staffScoped ? 'From your batches' : 'Filtered list'}
          </p>
        </div>

        <div className="border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Average Attendance</p>
          <p className="mt-4 text-4xl font-bold">—</p>
          <p className="mt-4 text-sm text-muted-foreground">Available in attendance phase</p>
        </div>

        <div className="border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Placement Eligible</p>
          <p className="mt-4 text-4xl font-bold">{placementEligible.length}</p>
          <p className="mt-4 text-sm text-muted-foreground">Ready pipeline</p>
        </div>

        <div className="border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="mt-4 text-4xl font-bold">{activeStudents.length}</p>
          <p className="mt-4 text-sm text-muted-foreground">Current learners</p>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold">Filters</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Filter students by course, batch, grade, placement and status.
            </p>
          </div>

          <Button type="button" variant="outline" onClick={resetFilters}>
            Clear Filters
          </Button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={inputClass}
            placeholder="Search student"
          />

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

          <select
            value={filterPlacement}
            onChange={(event) => setFilterPlacement(event.target.value)}
            className={selectClass}
          >
            <option value="all" className={optionClass}>
              All Placement
            </option>
            {placementOptions.map((item) => (
              <option key={item} value={item} className={optionClass}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
            className={selectClass}
          >
            <option value="all" className={optionClass}>
              All Status
            </option>
            <option value="active" className={optionClass}>
              Active
            </option>
            <option value="inactive" className={optionClass}>
              Inactive
            </option>
            <option value="completed" className={optionClass}>
              Completed
            </option>
            <option value="archived" className={optionClass}>
              Archived
            </option>
          </select>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {staffScoped ? 'Assigned Batch Students' : 'Student Directory'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Student list is scoped by current permission and batch assignment.
            </p>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredStudents.length}</span> records
          </div>
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="border border-border bg-background/50 p-6 text-sm text-muted-foreground">
              Loading students…
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="border border-border bg-background/50 p-6 text-sm text-muted-foreground">
              {staffScoped
                ? 'No students found under your assigned batches.'
                : 'No students found.'}
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[1040px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Course</th>
                    <th className="px-4 py-3 font-semibold">Batch</th>
                    <th className="px-4 py-3 font-semibold">Attendance</th>
                    <th className="px-4 py-3 font-semibold">Grade</th>
                    <th className="px-4 py-3 font-semibold">Placement</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={`${student.id}-${student.batch_id}`} className="border-b border-border">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden border border-border bg-background">
                            <Image
                              src={student.avatar_url || '/avatar.svg'}
                              alt={student.full_name}
                              width={40}
                              height={40}
                              className="h-full w-full object-cover"
                            />
                          </div>

                          <div>
                            <p className="font-semibold">{student.full_name}</p>
                            <p className="text-xs text-muted-foreground">{student.email}</p>
                            <p className="text-xs text-muted-foreground">{student.student_code}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-muted-foreground">{student.course_name}</td>
                      <td className="px-4 py-4 text-muted-foreground">
                        <Link href={`/batches/${student.batch_id}`} className="hover:underline">
                          {student.batch_name}
                        </Link>
                      </td>
                      <td className="px-4 py-4">{student.attendance}</td>
                      <td className="px-4 py-4">{student.grade}</td>
                      <td className="px-4 py-4">{student.placement}</td>
                      <td className="px-4 py-4">
                        <span className={getStatusClass(student.status)}>{student.status}</span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/students/${getStudentViewId(student)}`}>
                              <CustomIcon
                                icon="dashboard.svg"
                                folder={iconFolder}
                                alt="View More"
                                className="mr-2 h-4 w-4"
                              />
                              View More
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
