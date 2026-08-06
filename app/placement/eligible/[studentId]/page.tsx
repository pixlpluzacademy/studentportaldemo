'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth/provider'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import {
  fetchPlacementJobs,
  fetchStudentPlacementApplications,
  formatApplicationStatus,
  getEligibleJobsForStudent,
  PLACEMENT_APPLICATION_STATUS_OPTIONS,
  updatePlacementApplicationStatus,
  type PlacementApplicationRow,
  type PlacementApplicationStatus,
  type PlacementJobRow,
} from '@/lib/data/placement-jobs'
import { fetchStudentDetail, isStaffScopedStudentView, type StudentListRow } from '@/lib/data/students'

function getStatusClass(status: string) {
  const value = status.toLowerCase()

  if (value.includes('eligible') || value.includes('selected') || value.includes('approved') || value.includes('open')) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
  }

  if (value.includes('interview') || value.includes('applied') || value.includes('pending')) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  }

  if (value.includes('reject') || value.includes('not') || value.includes('closed') || value.includes('hold')) {
    return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
  }

  return 'border-border bg-background text-muted-foreground'
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = value.slice(0, 10)
  return date || '—'
}

export default function EligibleStudentDetailPage() {
  const params = useParams()
  const studentId = String(params.studentId || '')
  const { can, user, parentRoleId } = useAuth()
  const { activeBranchId, loading: branchLoading } = useBranchScope()

  const [student, setStudent] = useState<StudentListRow | null>(null)
  const [applications, setApplications] = useState<PlacementApplicationRow[]>([])
  const [eligibleJobs, setEligibleJobs] = useState<PlacementJobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [jobsNotice, setJobsNotice] = useState('')

  const staffScoped = isStaffScopedStudentView(parentRoleId)

  const canUpdateApplicationStatus =
    can('placement.edit') ||
    can('placement.create') ||
    parentRoleId === 'placement' ||
    parentRoleId === 'super_admin' ||
    parentRoleId === 'company_admin' ||
    parentRoleId === 'branch_admin'

  const handleStatusChange = async (
    applicationId: string,
    status: PlacementApplicationStatus,
  ) => {
    setUpdatingStatusId(applicationId)
    setJobsNotice('')

    const result = await updatePlacementApplicationStatus(applicationId, status)
    if (!result.ok) {
      setJobsNotice(result.error || 'Failed to update application status.')
      setUpdatingStatusId(null)
      return
    }

    setApplications((prev) =>
      prev.map((item) => (item.id === applicationId ? { ...item, status } : item)),
    )
    setJobsNotice(`Status updated to ${formatApplicationStatus(status)}.`)
    setUpdatingStatusId(null)
  }

  useEffect(() => {
    if (!studentId || branchLoading || !user?.id) {
      setLoading(branchLoading || !studentId)
      return
    }

    if (!activeBranchId && parentRoleId !== 'student') {
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadDetail() {
      setLoading(true)
      setError(null)
      setJobsNotice('')

      try {
        const studentResult = await fetchStudentDetail(studentId, {
          branchId: activeBranchId,
          staffUserId: staffScoped ? user!.id : null,
        })

        if (cancelled) return

        if (!studentResult.data) {
          setStudent(null)
          setError(studentResult.error || 'Student not found.')
          setLoading(false)
          return
        }

        if (!studentResult.data.placement_ready) {
          setStudent(studentResult.data)
          setError('This student is not currently eligible for placement.')
          setApplications([])
          setEligibleJobs([])
          setLoading(false)
          return
        }

        setStudent(studentResult.data)

        const [appsResult, jobsResult] = await Promise.all([
          fetchStudentPlacementApplications(studentResult.data.id),
          fetchPlacementJobs({ status: 'open' }),
        ])

        if (cancelled) return

        const applied = appsResult.data
        const appliedIds = new Set(applied.map((item) => item.jobId))
        const eligible = getEligibleJobsForStudent(jobsResult.data, appliedIds, {
          course_name: studentResult.data.course_name,
          department_name: studentResult.data.department_name,
        })

        setApplications(applied)
        setEligibleJobs(eligible)

        const tableMissing =
          (appsResult.error || '').toLowerCase().includes('placement_applications') ||
          (jobsResult.error || '').toLowerCase().includes('placement_jobs') ||
          (appsResult.error || '').toLowerCase().includes('does not exist') ||
          (jobsResult.error || '').toLowerCase().includes('does not exist') ||
          (appsResult.error || '').toLowerCase().includes('schema cache') ||
          (jobsResult.error || '').toLowerCase().includes('schema cache')

        if (tableMissing) {
          setJobsNotice(
            'Placement jobs tables are not applied yet. Run migration 20250609000043_placement_jobs_applications.sql on your LMS Supabase, then refresh.',
          )
        } else if (appsResult.error || jobsResult.error) {
          setJobsNotice(appsResult.error || jobsResult.error || '')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load placement details.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadDetail()

    return () => {
      cancelled = true
    }
  }, [activeBranchId, branchLoading, parentRoleId, staffScoped, studentId, user?.id])

  const appliedCount = applications.length
  const eligibleCount = eligibleJobs.length

  const readinessItems = useMemo(() => {
    if (!student) return []
    return [
      {
        label: 'Batch completed',
        value: student.placement_batch_completed ? 'Yes' : 'No',
        ok: student.placement_batch_completed,
      },
      {
        label: 'Attendance 75%+',
        value: student.attendance_percent === null ? '—' : `${student.attendance_percent}%`,
        ok: student.placement_attendance_ok,
      },
      {
        label: 'Academic 70%+',
        value: student.academic_percent === null ? '—' : `${student.academic_percent}%`,
        ok: student.placement_academic_ok,
      },
    ]
  }, [student])

  if (!can('placement.view') && !can('students.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Placement Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view placement details.</p>
      </div>
    )
  }

  if (loading || branchLoading) {
    return (
      <div className="border border-border bg-card p-8 text-sm text-muted-foreground">
        Loading student placement details…
      </div>
    )
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <Link
          href="/placement/eligible"
          className="inline-flex border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
        >
          Back to Eligible Students
        </Link>
        <div className="border border-border bg-card p-8">
          <h1 className="text-2xl font-bold">Student Not Found</h1>
          <p className="mt-2 text-muted-foreground">{error || 'This student is not available in your scope.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <Link
            href="/placement/eligible"
            className="inline-flex border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
          >
            Back to Eligible Students
          </Link>

          <div className="mt-4 flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden border border-border bg-background">
              <Image
                src={student.avatar_url || '/avatar.svg'}
                alt={student.full_name}
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`border px-2 py-1 text-xs font-semibold ${getStatusClass(student.placement)}`}>
                  {student.placement}
                </span>
                <span className="border border-border bg-background px-2 py-1 text-xs font-semibold">
                  {student.department_name}
                </span>
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">{student.full_name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {student.student_code} · {student.email}
              </p>
            </div>
          </div>
        </div>

        <Link
          href={`/students/${student.id}`}
          className="border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
        >
          Open Full Student Profile
        </Link>
      </div>

      {(error || jobsNotice) && (
        <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
          {error || jobsNotice}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">Final Score</div>
          <div className="mt-1 text-2xl font-bold">
            {student.academic_percent === null ? '—' : `${student.academic_percent}%`}
          </div>
          <div className="mt-2 text-xs text-[#153e90] dark:text-[#6ee75a]">Grade {student.grade}</div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">Attendance</div>
          <div className="mt-1 text-2xl font-bold">
            {student.attendance_percent === null ? '—' : `${student.attendance_percent}%`}
          </div>
          <div className="mt-2 text-xs text-[#153e90] dark:text-[#6ee75a]">Required 75%+</div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">Jobs Applied</div>
          <div className="mt-1 text-2xl font-bold">{appliedCount}</div>
          <div className="mt-2 text-xs text-[#153e90] dark:text-[#6ee75a]">Application history</div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">Eligible To Apply</div>
          <div className="mt-1 text-2xl font-bold">{eligibleCount}</div>
          <div className="mt-2 text-xs text-[#153e90] dark:text-[#6ee75a]">Open matching jobs</div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="border border-border bg-card p-5">
          <h2 className="text-xl font-bold">Placement Details</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="border border-border bg-background/50 p-4">
              <p className="text-xs text-muted-foreground">Course</p>
              <p className="mt-1 font-semibold">{student.course_name}</p>
            </div>
            <div className="border border-border bg-background/50 p-4">
              <p className="text-xs text-muted-foreground">Batch</p>
              <p className="mt-1 font-semibold">{student.batch_name}</p>
            </div>
            <div className="border border-border bg-background/50 p-4">
              <p className="text-xs text-muted-foreground">Department</p>
              <p className="mt-1 font-semibold">{student.department_name}</p>
            </div>
            <div className="border border-border bg-background/50 p-4">
              <p className="text-xs text-muted-foreground">Batch End Date</p>
              <p className="mt-1 font-semibold">{student.batch_end_date || '—'}</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {readinessItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between border border-border bg-background/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.value}</p>
                </div>
                <span className={`border px-2 py-1 text-xs font-semibold ${getStatusClass(item.ok ? 'eligible' : 'not')}`}>
                  {item.ok ? 'Met' : 'Not met'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <h2 className="text-xl font-bold">Readiness Summary</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Placement opens after batch completion. Student must keep attendance at 75%+ and academic average at 70%+.
          </p>
          <div className="mt-5 border border-border bg-background/50 p-4">
            <p className="text-sm text-muted-foreground">Ready for Placement</p>
            <p className="mt-2 text-2xl font-bold">{student.placement_ready ? 'Yes' : 'No'}</p>
            <p className="mt-2 text-sm text-muted-foreground">Current status: {student.placement}</p>
          </div>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold">Jobs Applied</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              All jobs this student has already applied for, with current application status.
            </p>
          </div>
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
              {applications.map((application) => (
                <tr key={application.id} className="border-b border-border">
                  <td className="px-4 py-4">
                    <div className="font-semibold">{application.job?.title || 'Job'}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {application.job?.courseName || '—'} · {application.job?.location || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{application.job?.company || '—'}</td>
                  <td className="px-4 py-4 text-muted-foreground">{formatDate(application.appliedAt)}</td>
                  <td className="px-4 py-4">
                    {canUpdateApplicationStatus ? (
                      <select
                        value={application.status}
                        disabled={updatingStatusId === application.id}
                        onChange={(event) =>
                          void handleStatusChange(
                            application.id,
                            event.target.value as PlacementApplicationStatus,
                          )
                        }
                        className={`h-9 min-w-[190px] border bg-background px-2 text-xs font-semibold outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a] disabled:opacity-60 ${getStatusClass(application.status)}`}
                      >
                        {PLACEMENT_APPLICATION_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value} className="bg-background text-foreground">
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`inline-flex border px-2 py-1 text-xs font-semibold ${getStatusClass(application.status)}`}
                      >
                        {formatApplicationStatus(application.status)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {application.job?.jobLink ? (
                      <a
                        href={application.job.jobLink}
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

              {applications.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No job applications yet for this student.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold">Eligible To Apply</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Open jobs matching this student&apos;s course or department that they have not applied to yet.
            </p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-semibold">Job</th>
                <th className="px-4 py-3 font-semibold">Company</th>
                <th className="px-4 py-3 font-semibold">Course / Dept</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Salary</th>
                <th className="px-4 py-3 text-right font-semibold">Link</th>
              </tr>
            </thead>
            <tbody>
              {eligibleJobs.map((job) => (
                <tr key={job.id} className="border-b border-border">
                  <td className="px-4 py-4">
                    <div className="font-semibold">{job.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{job.location}</div>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{job.company}</td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {job.courseName}
                    <div className="mt-1 text-xs">{job.departmentName}</div>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{job.jobType}</td>
                  <td className="px-4 py-4 text-muted-foreground">{job.salaryRange}</td>
                  <td className="px-4 py-4 text-right">
                    {job.jobLink ? (
                      <a
                        href={job.jobLink}
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

              {eligibleJobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No open matching jobs available right now.
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
