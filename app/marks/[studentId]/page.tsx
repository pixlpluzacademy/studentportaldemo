'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/provider'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import {
  buildBatchMarksMetaMap,
  fetchStudentMarksDetail,
  getMarkGrade,
  getMarkResult,
  toTaskBatchLookup,
  type MarkRecord,
} from '@/lib/data/marks'
import { fetchAccessibleBatches, isStudentMyCoursesView } from '@/lib/data/my-courses'
import { fetchStudentIdByProfileId } from '@/lib/data/tasks'

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

  if (result.toLowerCase() === 'pending') {
    return 'border-border bg-background text-muted-foreground'
  }

  return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
}

export default function Page() {
  const params = useParams()
  const studentId = String(params.studentId || '')
  const { can, user, parentRoleId } = useAuth()
  const { activeBranchId, loading: branchLoading } = useBranchScope()

  const [marks, setMarks] = useState<MarkRecord[]>([])
  const [totalAverage, setTotalAverage] = useState<string | number>('-')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isStudent = isStudentMyCoursesView(parentRoleId)

  useEffect(() => {
    if (!studentId || branchLoading || !user?.id) {
      setMarks([])
      setLoading(branchLoading || !studentId)
      return
    }

    if (!isStudent && !activeBranchId) {
      setMarks([])
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadDetail() {
      setLoading(true)
      setError(null)

      try {
        if (isStudent) {
          const ownStudentId = await fetchStudentIdByProfileId(user!.id)
          if (!ownStudentId || ownStudentId !== studentId) {
            if (!cancelled) {
              setError('You can only view your own marks.')
              setMarks([])
              setLoading(false)
            }
            return
          }
        }

        const { batches } = await fetchAccessibleBatches({
          branchId: activeBranchId || '',
          userId: user!.id,
          parentRoleId,
        })

        if (cancelled) return

        const batchMetaMap = buildBatchMarksMetaMap(batches)
        const batchLookup = toTaskBatchLookup(batchMetaMap)
        const batchIds = batches.map((batch) => batch.id)

        const result = await fetchStudentMarksDetail(studentId, {
          batchLookup,
          batchMetaMap,
          batchIds: isStudent ? undefined : batchIds,
        })

        if (cancelled) return

        setMarks(result.data.marks)
        setTotalAverage(result.data.totalAverage)
        if (result.error) {
          setError(result.error)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load student marks.')
          setMarks([])
          setTotalAverage('-')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      cancelled = true
    }
  }, [activeBranchId, branchLoading, isStudent, parentRoleId, studentId, user?.id])

  const studentName = marks[0]?.student || 'Student'
  const studentMeta = marks[0]

  const scoredCount = marks.filter((mark) => mark.percentage !== '-').length
  const finalizedCount = marks.filter((mark) => mark.status === 'Finalized').length
  const totalGrade = totalAverage === '-' ? '-' : getMarkGrade(Number(totalAverage))
  const totalResult = totalAverage === '-' ? 'Pending' : getMarkResult(Number(totalAverage))

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
          <Link href="/marks" className="text-sm font-semibold text-[#153e90] hover:underline dark:text-[#6ee75a]">
            ← Back to Marks
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{studentName}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Daily = /50, Weekly = /75, Final Project = /100. Total average uses percentage so different types compare fairly.
          </p>
        </div>

        {studentMeta && (
          <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
            <div>
              <span className="font-semibold">Batch:</span> {studentMeta.batch}
            </div>
            <div className="mt-1 text-muted-foreground">
              {studentMeta.department} · {studentMeta.course} · {studentMeta.batchTime} · {studentMeta.batchMode}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{loading ? '-' : marks.length}</div>
          <div className="mt-1 text-sm text-muted-foreground">Assignments</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">{scoredCount} scored</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{loading ? '-' : totalAverage === '-' ? '-' : `${totalAverage}%`}</div>
          <div className="mt-1 text-sm text-muted-foreground">Total Average Mark</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Average of assignment %</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{loading ? '-' : totalGrade}</div>
          <div className="mt-1 text-sm text-muted-foreground">Overall Grade</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">{finalizedCount} finalized</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{loading ? '-' : totalResult}</div>
          <div className="mt-1 text-sm text-muted-foreground">Overall Result</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Pass mark 50+</div>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold">Assignment Marks</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each row is one task. Final score = average of mentor / HOD / Final QA marks, shown out of the assignment max.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-semibold">Task / Assignment</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Out Of</th>
                <th className="px-4 py-3 font-semibold">Work Submitted</th>
                <th className="px-4 py-3 font-semibold">Mentor Mark</th>
                <th className="px-4 py-3 font-semibold">HOD Mark</th>
                <th className="px-4 py-3 font-semibold">Final QA Mark</th>
                <th className="px-4 py-3 font-semibold">Final Score</th>
                <th className="px-4 py-3 font-semibold">%</th>
                <th className="px-4 py-3 font-semibold">Grade</th>
                <th className="px-4 py-3 font-semibold">Result</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Review</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Loading assignment marks...
                  </td>
                </tr>
              )}

              {!loading &&
                marks.map((record) => (
                  <tr key={record.id} className="border-b border-border">
                    <td className="px-4 py-4 align-top">
                      <div className="max-w-[240px] font-semibold text-foreground">{record.task}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{record.mentor}</div>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <span className="inline-flex whitespace-nowrap border border-border bg-background px-2 py-1 text-xs font-semibold">
                        {record.assignmentType}
                      </span>
                    </td>

                    <td className="px-4 py-4 align-top font-semibold">{record.maxMarks}</td>

                    <td className="px-4 py-4 align-top text-muted-foreground">
                      <div className="max-w-[200px]">{record.fileName}</div>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <span className="inline-flex min-w-12 justify-center border border-border bg-background px-3 py-1 text-sm font-semibold">
                        {record.mentorMark === '-' ? '-' : `${record.mentorMark}/${record.maxMarks}`}
                      </span>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <span className="inline-flex min-w-12 justify-center border border-border bg-background px-3 py-1 text-sm font-semibold">
                        {record.hodMark === '-' ? '-' : `${record.hodMark}/${record.maxMarks}`}
                      </span>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <span className="inline-flex min-w-12 justify-center border border-border bg-background px-3 py-1 text-sm font-semibold">
                        {record.finalQaMark === '-' ? '-' : `${record.finalQaMark}/${record.maxMarks}`}
                      </span>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <span className="inline-flex min-w-12 justify-center border border-[#153e90]/30 bg-[#153e90]/10 px-3 py-1 text-sm font-bold text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white">
                        {record.finalScore === '-' ? '-' : `${record.finalScore}/${record.maxMarks}`}
                      </span>
                    </td>

                    <td className="px-4 py-4 align-top font-semibold">
                      {record.percentage === '-' ? '-' : `${record.percentage}%`}
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

              {!loading && marks.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No assignment marks found for this student.
                  </td>
                </tr>
              )}
            </tbody>

            {!loading && marks.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40">
                  <td className="px-4 py-4 font-bold" colSpan={7}>
                    Total Average Mark
                    <div className="mt-1 text-xs font-normal text-muted-foreground">
                      Average of assignment percentages ({scoredCount} scored) · Daily /50 · Weekly /75 · Final Project /100
                    </div>
                  </td>
                  <td className="px-4 py-4" colSpan={2}>
                    <span className="inline-flex min-w-12 justify-center border border-[#153e90]/30 bg-[#153e90]/10 px-3 py-1 text-sm font-bold text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white">
                      {totalAverage === '-' ? '-' : `${totalAverage}%`}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex min-w-10 justify-center border border-border bg-background px-3 py-1 text-sm font-bold">
                      {totalGrade}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getResultClass(totalResult)}`}>
                      {totalResult}
                    </span>
                  </td>
                  <td className="px-4 py-4" colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
