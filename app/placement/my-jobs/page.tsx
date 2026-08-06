'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/lib/auth/provider'
import { isStudentMyCoursesView } from '@/lib/data/my-courses'
import {
  applyStudentToJob,
  fetchPlacementJobs,
  fetchStudentPlacementApplications,
  formatApplicationStatus,
  getEligibleJobsForStudent,
  type PlacementApplicationRow,
  type PlacementJobRow,
} from '@/lib/data/placement-jobs'
import { fetchStudentDetail, type StudentListRow } from '@/lib/data/students'
import { fetchStudentIdByProfileId } from '@/lib/data/tasks'

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

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return `${value}%`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return value.slice(0, 10)
}

export default function StudentEligibleJobsPage() {
  const { user, parentRoleId } = useAuth()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const isStudent = isStudentMyCoursesView(parentRoleId)

  const [student, setStudent] = useState<StudentListRow | null>(null)
  const [eligibleJobs, setEligibleJobs] = useState<PlacementJobRow[]>([])
  const [applications, setApplications] = useState<PlacementApplicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const loadData = useCallback(async () => {
    if (!user?.id || !isStudent) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setNotice('')

    try {
      const studentId = await fetchStudentIdByProfileId(user.id)
      if (!studentId) {
        setStudent(null)
        setEligibleJobs([])
        setApplications([])
        setError('Student profile not found.')
        setLoading(false)
        return
      }

      const studentResult = await fetchStudentDetail(studentId)
      if (!studentResult.data) {
        setStudent(null)
        setEligibleJobs([])
        setApplications([])
        setError(studentResult.error || 'Unable to load your placement profile.')
        setLoading(false)
        return
      }

      setStudent(studentResult.data)

      const [appsResult, jobsResult] = await Promise.all([
        fetchStudentPlacementApplications(studentResult.data.id),
        fetchPlacementJobs({ status: 'open' }),
      ])

      const applied = appsResult.data
      const appliedIds = new Set(applied.map((item) => item.jobId))

      setApplications(applied)

      if (studentResult.data.placement_ready) {
        setEligibleJobs(
          getEligibleJobsForStudent(jobsResult.data, appliedIds, {
            course_name: studentResult.data.course_name,
            department_name: studentResult.data.department_name,
          }),
        )
      } else {
        setEligibleJobs([])
      }

      const tableMissing =
        (appsResult.error || '').toLowerCase().includes('placement_applications') ||
        (jobsResult.error || '').toLowerCase().includes('placement_jobs') ||
        (appsResult.error || '').toLowerCase().includes('does not exist') ||
        (jobsResult.error || '').toLowerCase().includes('does not exist') ||
        (appsResult.error || '').toLowerCase().includes('schema cache') ||
        (jobsResult.error || '').toLowerCase().includes('schema cache')

      if (tableMissing) {
        setNotice(
          'Placement jobs tables are not applied yet. Ask admin to run migration 20250609000043_placement_jobs_applications.sql, then refresh.',
        )
      } else if (appsResult.error || jobsResult.error) {
        setNotice(appsResult.error || jobsResult.error || '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load eligible jobs.')
    } finally {
      setLoading(false)
    }
  }, [isStudent, user?.id])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const applyToJob = async (job: PlacementJobRow) => {
    if (!student?.id) return

    setApplyingJobId(job.id)
    setNotice('')

    const result = await applyStudentToJob(job.id, student.id)
    if (!result.ok) {
      setNotice(result.error || 'Failed to apply for this job.')
      setApplyingJobId(null)
      return
    }

    if (job.jobLink) {
      window.open(job.jobLink, '_blank', 'noopener,noreferrer')
    }

    setNotice(`Applied to ${job.title} at ${job.company}.`)
    setApplyingJobId(null)
    await loadData()
  }

  if (!isStudent) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Student Placement Only</h1>
        <p className="mt-2 text-muted-foreground">
          This page is for students. Staff can manage placement from Eligible Students, Jobs and Placed Students.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Placement</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Eligible Jobs</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Open jobs matching your course or department. Apply when you are placement eligible.
        </p>
      </div>

      {error && (
        <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      {notice && (
        <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
          {notice}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Placement Status</div>
          <div className="mt-2 text-2xl font-bold">{student?.placement || (loading ? '—' : 'Not Started')}</div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Attendance</div>
          <div className="mt-2 text-2xl font-bold">{formatPercent(student?.attendance_percent)}</div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Final Score</div>
          <div className="mt-2 text-2xl font-bold">{formatPercent(student?.academic_percent)}</div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Eligible Jobs</div>
          <div className="mt-2 text-2xl font-bold">{loading ? '—' : eligibleJobs.length}</div>
        </div>
      </div>

      {student && !student.placement_ready && !loading && (
        <div className="border border-border bg-card p-5">
          <h2 className="text-xl font-bold">Not Eligible Yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You can apply after batch end date has passed, attendance is at least 75%, and academic average is at least
            70%.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="border border-border bg-background px-4 py-3 text-sm">
              <div className="font-semibold">Batch</div>
              <div className="mt-1 text-muted-foreground">{student.batch_name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                End: {formatDate(student.batch_end_date)}
              </div>
            </div>
            <div className="border border-border bg-background px-4 py-3 text-sm">
              <div className="font-semibold">Attendance</div>
              <div className="mt-1 text-muted-foreground">{formatPercent(student.attendance_percent)} / 75%</div>
            </div>
            <div className="border border-border bg-background px-4 py-3 text-sm">
              <div className="font-semibold">Academic Score</div>
              <div className="mt-1 text-muted-foreground">{formatPercent(student.academic_percent)} / 70%</div>
            </div>
          </div>
        </div>
      )}

      <div className="border border-border bg-card p-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold">Jobs You Can Apply</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Matching open jobs for {student?.course_name || 'your course'} / {student?.department_name || 'department'}.
            </p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-semibold">Job</th>
                <th className="px-4 py-3 font-semibold">Company</th>
                <th className="px-4 py-3 font-semibold">Course / Dept</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Salary</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Loading eligible jobs...
                  </td>
                </tr>
              )}

              {!loading &&
                eligibleJobs.map((job) => (
                  <tr key={job.id} className="border-b border-border">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center border border-border bg-background">
                          <CustomIcon icon="career.svg" folder={iconFolder} alt="Job" className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold">{job.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{job.location}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{job.company}</td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {job.courseName}
                      <div className="mt-1 text-xs">{job.departmentName}</div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{job.jobType}</td>
                    <td className="px-4 py-4 text-muted-foreground">{job.salaryRange}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        {job.jobLink ? (
                          <a
                            href={job.jobLink}
                            target="_blank"
                            rel="noreferrer"
                            className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                          >
                            Open Job
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void applyToJob(job)}
                          disabled={applyingJobId === job.id}
                          className="bg-[#153e90] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-[#6ee75a] dark:text-black"
                        >
                          {applyingJobId === job.id ? 'Applying...' : 'Apply'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading && eligibleJobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {student?.placement_ready
                      ? 'No open matching jobs available right now.'
                      : 'Eligible jobs appear here once you meet placement criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <div>
          <h2 className="text-xl font-bold">My Applications</h2>
          <p className="mt-1 text-sm text-muted-foreground">Jobs you have already applied to and their current status.</p>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-semibold">Job</th>
                <th className="px-4 py-3 font-semibold">Company</th>
                <th className="px-4 py-3 font-semibold">Applied On</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Link</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Loading applications...
                  </td>
                </tr>
              )}

              {!loading &&
                applications.map((item) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="px-4 py-4 font-semibold">{item.job?.title || 'Job'}</td>
                    <td className="px-4 py-4 text-muted-foreground">{item.job?.company || '—'}</td>
                    <td className="px-4 py-4 text-muted-foreground">{formatDate(item.appliedAt)}</td>
                    <td className="px-4 py-4">
                      <span className="inline-flex border border-border bg-background px-2 py-1 text-xs font-semibold">
                        {formatApplicationStatus(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {item.job?.jobLink ? (
                        <a
                          href={item.job.jobLink}
                          target="_blank"
                          rel="noreferrer"
                          className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                        >
                          Open Job
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">No link</span>
                      )}
                    </td>
                  </tr>
                ))}

              {!loading && applications.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    You have not applied to any jobs yet.
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
