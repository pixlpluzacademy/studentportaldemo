'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth/provider'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import {
  buildBatchMarksMetaMap,
  fetchMarks,
  mergeStudentsWithMarks,
  toTaskBatchLookup,
  type StudentMarksSummary,
} from '@/lib/data/marks'
import { fetchAccessibleBatches, isStudentMyCoursesView } from '@/lib/data/my-courses'
import { fetchStudentList, isStaffScopedStudentView } from '@/lib/data/students'
import { fetchStudentIdByProfileId } from '@/lib/data/tasks'

const inputClass =
  'h-10 w-full border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[#153e90] dark:focus:border-[#6ee75a] dark:[color-scheme:dark]'

const selectClass =
  'h-10 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a] dark:[color-scheme:dark]'

const optionClass = 'bg-background text-foreground'

function getResultClass(result: string) {
  if (result.toLowerCase() === 'passed') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
  }

  if (result.toLowerCase() === 'pending') {
    return 'border-border bg-background text-muted-foreground'
  }

  return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
}

function formatRoleLabel(parentRoleId: string | null, roleName?: string) {
  if (roleName) return roleName
  if (!parentRoleId) return 'Not selected'
  return parentRoleId
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function Page() {
  const { can, user, role, parentRoleId } = useAuth()
  const { activeBranchId, loading: branchLoading } = useBranchScope()
  const [summaries, setSummaries] = useState<StudentMarksSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('all')
  const [filterBatch, setFilterBatch] = useState('all')
  const [filterTime, setFilterTime] = useState('all')
  const [filterMode, setFilterMode] = useState('all')
  const [filterCourse, setFilterCourse] = useState('all')

  const isStudent = isStudentMyCoursesView(parentRoleId)
  const isMentor = parentRoleId === 'mentor'
  const staffScoped = isStaffScopedStudentView(parentRoleId)

  useEffect(() => {
    if (branchLoading || !user?.id) {
      setSummaries([])
      setLoading(branchLoading)
      return
    }

    if (!isStudent && !activeBranchId) {
      setSummaries([])
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadMarks() {
      setLoading(true)
      setError(null)

      try {
        const { batches } = await fetchAccessibleBatches({
          branchId: activeBranchId || '',
          userId: user!.id,
          parentRoleId,
        })

        if (cancelled) return

        const batchMetaMap = buildBatchMarksMetaMap(batches)
        const batchLookup = toTaskBatchLookup(batchMetaMap)
        const studentId = isStudent ? await fetchStudentIdByProfileId(user!.id) : null
        const batchIds = batches.map((batch) => batch.id)

        const [marksResult, studentsResult] = await Promise.all([
          fetchMarks({
            batchLookup,
            batchMetaMap,
            studentId,
            batchIds: isStudent ? undefined : batchIds,
          }),
          isStudent
            ? Promise.resolve({ data: [], error: undefined as string | undefined })
            : fetchStudentList({
                branchId: activeBranchId,
                staffUserId: staffScoped ? user!.id : null,
              }),
        ])

        if (cancelled) return

        if (isStudent) {
          setSummaries(mergeStudentsWithMarks([], marksResult.data, batchMetaMap))
        } else {
          setSummaries(mergeStudentsWithMarks(studentsResult.data, marksResult.data, batchMetaMap))
        }

        if (marksResult.error || studentsResult.error) {
          setError(marksResult.error || studentsResult.error || null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load marks.')
          setSummaries([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadMarks()

    return () => {
      cancelled = true
    }
  }, [activeBranchId, branchLoading, isStudent, parentRoleId, staffScoped, user?.id])

  const departmentOptions = useMemo(
    () => Array.from(new Set(summaries.map((item) => item.department).filter((item) => item && item !== '—'))).sort(),
    [summaries],
  )
  const batchOptions = useMemo(
    () => Array.from(new Set(summaries.map((item) => item.batch).filter(Boolean))).sort(),
    [summaries],
  )
  const timeOptions = useMemo(
    () => Array.from(new Set(summaries.map((item) => item.batchTime).filter((item) => item && item !== '—'))).sort(),
    [summaries],
  )
  const modeOptions = useMemo(
    () => Array.from(new Set(summaries.map((item) => item.batchMode).filter((item) => item && item !== '—'))).sort(),
    [summaries],
  )
  const courseOptions = useMemo(
    () => Array.from(new Set(summaries.map((item) => item.course).filter(Boolean))).sort(),
    [summaries],
  )

  const filteredSummaries = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return summaries.filter((item) => {
      const matchesSearch =
        !keyword ||
        item.student.toLowerCase().includes(keyword) ||
        item.batch.toLowerCase().includes(keyword) ||
        item.course.toLowerCase().includes(keyword) ||
        item.department.toLowerCase().includes(keyword) ||
        item.mentor.toLowerCase().includes(keyword)

      return (
        matchesSearch &&
        (filterDepartment === 'all' || item.department === filterDepartment) &&
        (filterBatch === 'all' || item.batch === filterBatch) &&
        (filterTime === 'all' || item.batchTime === filterTime) &&
        (filterMode === 'all' || item.batchMode === filterMode) &&
        (filterCourse === 'all' || item.course === filterCourse)
      )
    })
  }, [summaries, search, filterDepartment, filterBatch, filterTime, filterMode, filterCourse])

  const scoredAverages = filteredSummaries
    .filter((item) => item.totalAverage !== '-')
    .map((item) => Number(item.totalAverage))

  const averageScore =
    scoredAverages.length > 0
      ? Math.round(scoredAverages.reduce((total, score) => total + score, 0) / scoredAverages.length)
      : '-'

  const passedCount = filteredSummaries.filter((item) => item.result === 'Passed').length
  const pendingCount = filteredSummaries.filter((item) => item.result === 'Pending').length

  const resetFilters = () => {
    setSearch('')
    setFilterDepartment('all')
    setFilterBatch('all')
    setFilterTime('all')
    setFilterMode('all')
    setFilterCourse('all')
  }

  if (!can('marks.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Marks Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view marks.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Permission controlled module</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Marks / Evaluation</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Student marks overview. Open a student to see every assignment, stage marks, and total average.
          </p>
        </div>

        <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Current role:</span>{' '}
          {formatRoleLabel(parentRoleId, role?.name)}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{loading ? '-' : filteredSummaries.length}</div>
          <div className="mt-1 text-sm text-muted-foreground">{isStudent ? 'My Profile' : 'Students'}</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Visible based on role</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{loading ? '-' : averageScore === '-' ? '-' : `${averageScore}%`}</div>
          <div className="mt-1 text-sm text-muted-foreground">Average Score</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Across filtered students</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{loading ? '-' : passedCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Passed</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Pass mark 50+</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{loading ? '-' : pendingCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Pending</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">No scored assignments yet</div>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold">Filters</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Filter students by department, batch, time, mode and course.
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

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={inputClass}
            placeholder="Search student"
          />

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
            value={filterTime}
            onChange={(event) => setFilterTime(event.target.value)}
            className={selectClass}
          >
            <option value="all" className={optionClass}>
              All Times
            </option>
            {timeOptions.map((item) => (
              <option key={item} value={item} className={optionClass}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filterMode}
            onChange={(event) => setFilterMode(event.target.value)}
            className={selectClass}
          >
            <option value="all" className={optionClass}>
              All Modes
            </option>
            {modeOptions.map((item) => (
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
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold">{isStudent ? 'My Marks' : 'Students Marks'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Click a student name to open all assignment marks and the total average.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {isStudent && (
              <span className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 font-semibold text-[#153e90] dark:text-white">
                Student view
              </span>
            )}

            {isMentor && (
              <span className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 font-semibold text-[#153e90] dark:text-white">
                Assigned batches only
              </span>
            )}

            {!isStudent && !isMentor && (
              <span className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 font-semibold text-[#153e90] dark:text-white">
                Management overview
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-semibold">Student</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Course</th>
                <th className="px-4 py-3 font-semibold">Batch</th>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Mode</th>
                <th className="px-4 py-3 font-semibold">Assignments</th>
                <th className="px-4 py-3 font-semibold">Total Average</th>
                <th className="px-4 py-3 font-semibold">Grade</th>
                <th className="px-4 py-3 font-semibold">Result</th>
                <th className="px-4 py-3 text-right font-semibold">Details</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Loading students marks...
                  </td>
                </tr>
              )}

              {!loading &&
                filteredSummaries.map((item) => (
                  <tr key={item.studentId} className="border-b border-border">
                    <td className="px-4 py-4 align-top">
                      <Link
                        href={`/marks/${item.studentId}`}
                        className="font-semibold text-[#153e90] hover:underline dark:text-[#6ee75a]"
                      >
                        {item.student}
                      </Link>
                      <div className="mt-1 text-xs text-muted-foreground">{item.mentor}</div>
                    </td>

                    <td className="px-4 py-4 align-top text-muted-foreground">{item.department}</td>
                    <td className="px-4 py-4 align-top text-muted-foreground">{item.course}</td>
                    <td className="px-4 py-4 align-top text-muted-foreground">{item.batch}</td>
                    <td className="px-4 py-4 align-top text-muted-foreground">{item.batchTime}</td>
                    <td className="px-4 py-4 align-top text-muted-foreground">{item.batchMode}</td>

                    <td className="px-4 py-4 align-top">
                      <div className="font-semibold">{item.assignmentCount}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.scoredCount} scored · {item.finalizedCount} finalized
                      </div>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <span className="inline-flex min-w-12 justify-center border border-[#153e90]/30 bg-[#153e90]/10 px-3 py-1 text-sm font-bold text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white">
                        {item.totalAverage === '-' ? '-' : `${item.totalAverage}%`}
                      </span>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <span className="inline-flex min-w-10 justify-center border border-border bg-background px-3 py-1 text-sm font-bold">
                        {item.grade}
                      </span>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getResultClass(item.result)}`}>
                        {item.result}
                      </span>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <div className="flex justify-end">
                        <Link
                          href={`/marks/${item.studentId}`}
                          className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                        >
                          View Marks
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading && filteredSummaries.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No students with marks found for the selected filters.
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
