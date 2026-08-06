'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth/provider'
import { useStudentList } from '@/lib/data/hooks/use-students'
import {
  fetchPlacementPipeline,
  type PlacementPipelineRow,
} from '@/lib/data/placement-jobs'

const inputClass =
  'h-10 w-full border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[#153e90] dark:focus:border-[#6ee75a] dark:[color-scheme:dark]'

const selectClass =
  'h-10 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a] dark:[color-scheme:dark]'

const optionClass = 'bg-background text-foreground'

type PlacedStudentRow = {
  id: string
  studentId: string
  studentName: string
  studentAvatar: string | null
  studentCode: string
  departmentName: string
  courseName: string
  batchName: string
  companyName: string
  jobTitle: string
  location: string
  salaryPackage: string
  placedOn: string
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return value.slice(0, 10)
}

export default function PlacedStudentsPage() {
  const { can, user, parentRoleId } = useAuth()
  const { students, loading: studentsLoading, error: studentsError } = useStudentList({
    parentRoleId,
    userId: user?.id,
  })

  const [pipeline, setPipeline] = useState<PlacementPipelineRow[]>([])
  const [loadingPipeline, setLoadingPipeline] = useState(true)
  const [pipelineError, setPipelineError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('all')
  const [filterCourse, setFilterCourse] = useState('all')
  const [filterBatch, setFilterBatch] = useState('all')
  const [filterCompany, setFilterCompany] = useState('all')

  useEffect(() => {
    let cancelled = false

    async function loadPipeline() {
      setLoadingPipeline(true)
      setPipelineError(null)

      const result = await fetchPlacementPipeline()
      if (cancelled) return

      setPipeline(result.data.filter((item) => item.applicationStatus === 'selected'))
      if (result.error) setPipelineError(result.error)
      setLoadingPipeline(false)
    }

    void loadPipeline()

    return () => {
      cancelled = true
    }
  }, [])

  const placedStudents = useMemo(() => {
    const studentMap = new Map(students.map((student) => [student.id, student]))

    return pipeline.map((item): PlacedStudentRow => {
      const student = studentMap.get(item.studentId)

      return {
        id: item.id,
        studentId: item.studentId,
        studentName: student?.full_name || item.studentName,
        studentAvatar: student?.avatar_url || item.studentAvatar,
        studentCode: student?.student_code || '—',
        departmentName: student?.department_name || '—',
        courseName: student?.course_name || item.courseName || '—',
        batchName: student?.batch_name || '—',
        companyName: item.companyName || '—',
        jobTitle: item.jobTitle || '—',
        location: item.location || '—',
        salaryPackage: item.salaryRange || '—',
        placedOn: formatDate(item.appliedAt),
      }
    })
  }, [pipeline, students])

  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Set(placedStudents.map((item) => item.departmentName).filter((item) => item && item !== '—')),
      ).sort(),
    [placedStudents],
  )

  const courseOptions = useMemo(
    () =>
      Array.from(
        new Set(placedStudents.map((item) => item.courseName).filter((item) => item && item !== '—')),
      ).sort(),
    [placedStudents],
  )

  const batchOptions = useMemo(
    () =>
      Array.from(
        new Set(placedStudents.map((item) => item.batchName).filter((item) => item && item !== '—')),
      ).sort(),
    [placedStudents],
  )

  const companyOptions = useMemo(
    () =>
      Array.from(
        new Set(placedStudents.map((item) => item.companyName).filter((item) => item && item !== '—')),
      ).sort(),
    [placedStudents],
  )

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return placedStudents.filter((item) => {
      const matchesSearch =
        !keyword ||
        item.studentName.toLowerCase().includes(keyword) ||
        item.studentCode.toLowerCase().includes(keyword) ||
        item.courseName.toLowerCase().includes(keyword) ||
        item.departmentName.toLowerCase().includes(keyword) ||
        item.batchName.toLowerCase().includes(keyword) ||
        item.companyName.toLowerCase().includes(keyword) ||
        item.jobTitle.toLowerCase().includes(keyword)

      return (
        matchesSearch &&
        (filterDepartment === 'all' || item.departmentName === filterDepartment) &&
        (filterCourse === 'all' || item.courseName === filterCourse) &&
        (filterBatch === 'all' || item.batchName === filterBatch) &&
        (filterCompany === 'all' || item.companyName === filterCompany)
      )
    })
  }, [placedStudents, search, filterDepartment, filterCourse, filterBatch, filterCompany])

  const resetFilters = () => {
    setSearch('')
    setFilterDepartment('all')
    setFilterCourse('all')
    setFilterBatch('all')
    setFilterCompany('all')
  }

  const loading = studentsLoading || loadingPipeline
  const error = studentsError || pipelineError

  if (!can('placement.view') && !can('students.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Placement Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view placed students.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Placement module</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Placed Students</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Students marked as selected for a job. Filter by department, course, batch and company.
          </p>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold">Filters</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Filter by department, course, batch and company.
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
            placeholder="Search student, company, job, batch"
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
              value={filterCompany}
              onChange={(event) => setFilterCompany(event.target.value)}
              className={selectClass}
            >
              <option value="all" className={optionClass}>
                All Companies
              </option>
              {companyOptions.map((item) => (
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
            <h2 className="text-xl font-bold">Placed Student List</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Showing {filteredStudents.length} of {placedStudents.length} placed students.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-center text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left align-middle font-semibold">Student</th>
                <th className="px-4 py-3 align-middle font-semibold">Department</th>
                <th className="px-4 py-3 align-middle font-semibold">Company</th>
                <th className="px-4 py-3 align-middle font-semibold">Job Title</th>
                <th className="px-4 py-3 align-middle font-semibold">Location</th>
                <th className="px-4 py-3 align-middle font-semibold">Salary Package</th>
                <th className="px-4 py-3 align-middle font-semibold">Placed Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 align-middle text-muted-foreground">
                    Loading placed students...
                  </td>
                </tr>
              )}

              {!loading &&
                filteredStudents.map((item) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="px-4 py-4 text-left align-middle">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden border border-border bg-background">
                          <Image
                            src={item.studentAvatar || '/avatar.svg'}
                            alt={item.studentName}
                            width={44}
                            height={44}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="font-semibold leading-5">{item.studentName}</p>
                          <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{item.studentCode}</p>
                          <p className="text-xs leading-4 text-muted-foreground">{item.courseName}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 align-middle text-muted-foreground">{item.departmentName}</td>
                    <td className="px-4 py-4 align-middle font-semibold">{item.companyName}</td>
                    <td className="px-4 py-4 align-middle text-muted-foreground">{item.jobTitle}</td>
                    <td className="px-4 py-4 align-middle text-muted-foreground">{item.location}</td>
                    <td className="px-4 py-4 align-middle text-muted-foreground">{item.salaryPackage}</td>
                    <td className="px-4 py-4 align-middle text-muted-foreground">{item.placedOn}</td>
                  </tr>
                ))}

              {!loading && filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 align-middle text-muted-foreground">
                    No placed students found. Students appear here when their application status is set to Placed.
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
