'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useAuth } from '@/lib/auth/provider'
import { fetchCourseList } from '@/lib/data/courses'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import { useStudentList } from '@/lib/data/hooks/use-students'
import { isStudentMyCoursesView } from '@/lib/data/my-courses'
import {
  applyStudentToJob,
  createPlacementJob,
  deletePlacementJob,
  fetchPlacementJobApplicantCounts,
  fetchPlacementJobs,
  fetchPlacementPipeline,
  updatePlacementApplicationStatus,
  updatePlacementJob,
  type PlacementApplicationStatus,
  type PlacementPipelineRow,
} from '@/lib/data/placement-jobs'
import { fetchStudentIdByProfileId } from '@/lib/data/tasks'

type JobRecord = {
  id: string
  title: string
  company: string
  course: string
  location: string
  type: string
  salary: string
  link: string
  status: 'open' | 'closed' | 'draft'
  applicants: number
  eligibleStudents: number
}

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

function createEmptyJob(defaultCourse = ''): JobRecord {
  return {
    id: '',
    title: '',
    company: '',
    course: defaultCourse,
    location: '',
    type: 'Full Time',
    salary: '',
    link: '',
    status: 'open',
    applicants: 0,
    eligibleStudents: 0,
  }
}

function toUiStatus(status: string) {
  return status.replace(/_/g, '-')
}

function toDbApplicationStatus(status: string): PlacementApplicationStatus {
  const value = status.replace(/-/g, '_')
  if (value === 'interviewing') return 'interviewing'
  if (value === 'selected') return 'selected'
  if (value === 'rejected') return 'rejected'
  if (value === 'on_hold') return 'on_hold'
  return 'applied'
}

function nextApplicationStatus(status: string): PlacementApplicationStatus {
  const current = toDbApplicationStatus(status)
  if (current === 'applied') return 'interviewing'
  if (current === 'interviewing') return 'selected'
  if (current === 'selected') return 'on_hold'
  if (current === 'on_hold') return 'rejected'
  return 'applied'
}

export default function Page() {
  const { can, user, parentRoleId, role } = useAuth()
  const { activeBranchId, loading: branchLoading } = useBranchScope()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const isStudent = isStudentMyCoursesView(parentRoleId)
  const { students } = useStudentList({
    parentRoleId,
    userId: user?.id,
  })

  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [pipeline, setPipeline] = useState<PlacementPipelineRow[]>([])
  const [courseOptions, setCourseOptions] = useState<{ id: string; name: string }[]>([])
  const [formJob, setFormJob] = useState<JobRecord>(() => createEmptyJob())
  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [jobSearchTerm, setJobSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [jobStatusFilter, setJobStatusFilter] = useState('all')
  const [courseFilter, setCourseFilter] = useState('all')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null)

  const canManagePlacement =
    can('placement.create') ||
    can('placement.edit') ||
    can('placement.delete') ||
    parentRoleId === 'super_admin' ||
    parentRoleId === 'company_admin' ||
    parentRoleId === 'placement'

  const eligibleStudents = useMemo(
    () => students.filter((student) => student.placement_ready),
    [students],
  )

  const eligibleCount = eligibleStudents.length
  const interviewingCount = pipeline.filter((item) => item.applicationStatus === 'interviewing').length
  const resumeApprovedCount = pipeline.filter((item) => item.resumeStatus === 'approved').length
  const openJobsCount = jobs.filter((item) => item.status === 'open').length

  const selectedJob = useMemo(() => {
    return jobs.find((item) => item.id === selectedJobId) || jobs[0]
  }, [jobs, selectedJobId])

  const filteredJobs = useMemo(() => {
    return jobs.filter((item) => {
      const term = jobSearchTerm.trim().toLowerCase()

      const matchesSearch =
        !term ||
        item.title.toLowerCase().includes(term) ||
        item.company.toLowerCase().includes(term) ||
        item.course.toLowerCase().includes(term) ||
        item.location.toLowerCase().includes(term)

      const matchesStatus = jobStatusFilter === 'all' || item.status === jobStatusFilter
      const matchesCourse = courseFilter === 'all' || item.course === courseFilter

      return matchesSearch && matchesStatus && matchesCourse
    })
  }, [jobs, jobSearchTerm, jobStatusFilter, courseFilter])

  const filteredPlacements = useMemo(() => {
    return pipeline.filter((item) => {
      const term = searchTerm.trim().toLowerCase()
      const status = toUiStatus(item.applicationStatus)

      const matchesSearch =
        !term ||
        item.studentName.toLowerCase().includes(term) ||
        item.courseName.toLowerCase().includes(term) ||
        item.companyName.toLowerCase().includes(term) ||
        item.jobTitle.toLowerCase().includes(term) ||
        status.includes(term)

      const matchesStatus = statusFilter === 'all' || status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [pipeline, searchTerm, statusFilter])

  const loadData = async () => {
    setLoading(true)

    const [jobsResult, pipelineResult] = await Promise.all([
      fetchPlacementJobs(),
      fetchPlacementPipeline(),
    ])

    const jobIds = jobsResult.data.map((job) => job.id)
    const applicantCounts = await fetchPlacementJobApplicantCounts(jobIds)

    const mappedJobs: JobRecord[] = jobsResult.data.map((job) => {
      const eligibleForCourse = eligibleStudents.filter((student) => {
        const course = student.course_name.trim().toLowerCase()
        const jobCourse = job.courseName.trim().toLowerCase()
        return (
          !jobCourse ||
          jobCourse === '—' ||
          jobCourse === 'all' ||
          course === jobCourse ||
          course.includes(jobCourse) ||
          jobCourse.includes(course)
        )
      }).length

      return {
        id: job.id,
        title: job.title,
        company: job.company,
        course: job.courseName,
        location: job.location,
        type: job.jobType,
        salary: job.salaryRange,
        link: job.jobLink,
        status: job.status,
        applicants: applicantCounts.get(job.id) || 0,
        eligibleStudents: eligibleForCourse,
      }
    })

    setJobs(mappedJobs)
    setPipeline(pipelineResult.data)

    if (!selectedJobId && mappedJobs[0]) {
      setSelectedJobId(mappedJobs[0].id)
    } else if (selectedJobId && !mappedJobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(mappedJobs[0]?.id || '')
    }

    if (jobsResult.error || pipelineResult.error) {
      setNotice(jobsResult.error || pipelineResult.error || '')
    }

    setLoading(false)
  }

  useEffect(() => {
    if (branchLoading || !user?.id) return

    let cancelled = false

    async function bootstrap() {
      if (activeBranchId) {
        const coursesResult = await fetchCourseList(activeBranchId)
        if (!cancelled) {
          const options = coursesResult.data.map((course) => ({ id: course.id, name: course.name }))
          setCourseOptions(options)
          setFormJob((prev) => ({
            ...prev,
            course: prev.course || options[0]?.name || '',
          }))
        }
      }

      if (isStudent) {
        const studentId = await fetchStudentIdByProfileId(user!.id)
        if (!cancelled) setCurrentStudentId(studentId)
      }

      if (!cancelled) {
        await loadData()
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchId, branchLoading, isStudent, user?.id, eligibleStudents.length])

  const resetJobForm = () => {
    setFormJob(createEmptyJob(courseOptions[0]?.name || ''))
    setEditingJobId(null)
  }

  const saveJob = async () => {
    if (!canManagePlacement) {
      setNotice('Your current role cannot create or edit job details.')
      return
    }

    if (!formJob.title.trim()) {
      setNotice('Please enter job title.')
      return
    }

    if (!formJob.company.trim()) {
      setNotice('Please enter company name.')
      return
    }

    if (!formJob.link.trim()) {
      setNotice('Please add job link.')
      return
    }

    setSaving(true)

    const payload = {
      title: formJob.title.trim(),
      company: formJob.company.trim(),
      courseName: formJob.course.trim(),
      location: formJob.location.trim(),
      jobType: formJob.type.trim(),
      salaryRange: formJob.salary.trim(),
      jobLink: formJob.link.trim(),
      status: formJob.status,
      branchId: activeBranchId || null,
      createdBy: user?.id || null,
    }

    const result = editingJobId
      ? await updatePlacementJob(editingJobId, payload)
      : await createPlacementJob(payload)

    setSaving(false)

    if (!result.ok) {
      setNotice(result.error || 'Failed to save job.')
      return
    }

    setNotice(editingJobId ? 'Job details updated successfully.' : 'New job details added successfully.')
    setSelectedJobId(result.job.id)
    resetJobForm()
    await loadData()
  }

  const editJob = (item: JobRecord) => {
    if (!canManagePlacement) {
      setNotice('Your current role cannot edit job details.')
      return
    }

    setFormJob({ ...item })
    setEditingJobId(item.id)
    setSelectedJobId(item.id)
    setNotice(`Editing ${item.title}.`)
  }

  const deleteJob = async (jobId: string) => {
    if (!canManagePlacement) {
      setNotice('Your current role cannot delete job details.')
      return
    }

    const result = await deletePlacementJob(jobId)
    if (!result.ok) {
      setNotice(result.error || 'Failed to delete job.')
      return
    }

    setNotice('Job removed from placement list.')
    if (selectedJobId === jobId) {
      setSelectedJobId('')
    }
    if (editingJobId === jobId) {
      resetJobForm()
    }
    await loadData()
  }

  const openJobLink = (link: string) => {
    if (!link) {
      setNotice('No job link added for this job.')
      return
    }

    window.open(link, '_blank', 'noopener,noreferrer')
  }

  const applyToJob = async (item: JobRecord) => {
    if (item.status !== 'open') {
      setNotice('This job is not open for applications.')
      return
    }

    if (!currentStudentId) {
      setNotice('Student profile not found for application.')
      return
    }

    const result = await applyStudentToJob(item.id, currentStudentId)
    if (!result.ok) {
      setNotice(result.error || 'Failed to apply for this job.')
      return
    }

    setNotice(`Applied successfully for ${item.title}.`)
    openJobLink(item.link)
    await loadData()
  }

  const updateStudentStatus = async (item: PlacementPipelineRow) => {
    if (!canManagePlacement) {
      setNotice('Only Placement Cell, Admin or Super Admin can update student placement status.')
      return
    }

    const nextStatus = nextApplicationStatus(item.applicationStatus)
    const result = await updatePlacementApplicationStatus(item.id, nextStatus)
    if (!result.ok) {
      setNotice(result.error || 'Failed to update status.')
      return
    }

    setNotice(`Updated ${item.studentName} status to ${toUiStatus(nextStatus).replace('-', ' ')}.`)
    await loadData()
  }

  if (!can('placement.view') && !can('students.view') && !isStudent) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Placement Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view placement jobs.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">
            Placement and job tracking module
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Placement</h1>
          <p className="mt-2 max-w-4xl text-muted-foreground">
            Add job details, job links, company openings, eligible students, resume status, interview progress and offer pipeline. Students can view open jobs and apply, while Placement Cell manages job records.
          </p>
        </div>

        <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Current access:</span>{' '}
          {canManagePlacement ? 'Placement management' : role?.name || 'Student job view'}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">{loading ? '-' : eligibleCount}</div>
              <div className="mt-1 text-sm text-muted-foreground">Eligible Students</div>
              <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Ready for placement process</div>
            </div>
            <CustomIcon icon="students.svg" folder={iconFolder} alt="Eligible" className="h-8 w-8" />
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">{loading ? '-' : interviewingCount}</div>
              <div className="mt-1 text-sm text-muted-foreground">Interviewing</div>
              <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Active interview stage</div>
            </div>
            <CustomIcon icon="reviews.svg" folder={iconFolder} alt="Interviewing" className="h-8 w-8" />
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">{loading ? '-' : resumeApprovedCount}</div>
              <div className="mt-1 text-sm text-muted-foreground">Resumes Approved</div>
              <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Placement ready resumes</div>
            </div>
            <CustomIcon icon="submissions.svg" folder={iconFolder} alt="Resume" className="h-8 w-8" />
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">{loading ? '-' : openJobsCount}</div>
              <div className="mt-1 text-sm text-muted-foreground">Open Jobs</div>
              <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Available for students</div>
            </div>
            <CustomIcon icon="workstream.svg" folder={iconFolder} alt="Jobs" className="h-8 w-8" />
          </div>
        </div>
      </div>

      {notice && (
        <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
          {notice}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {canManagePlacement && (
            <div className="border border-border bg-card p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <h2 className="text-xl font-bold">{editingJobId ? 'Edit Job Details' : 'Add New Job Details'}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add company openings with job link, course match, salary range and location for student applications.
                  </p>
                </div>

                {editingJobId && (
                  <button
                    type="button"
                    onClick={resetJobForm}
                    className="inline-flex items-center gap-2 border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
                  >
                    <CustomIcon icon="reviews.svg" folder={iconFolder} alt="Cancel" className="h-4 w-4" />
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-sm font-semibold">Job Title</span>
                  <input
                    value={formJob.title}
                    onChange={(event) => setFormJob({ ...formJob, title: event.target.value })}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                    placeholder="Frontend Developer"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold">Company Name</span>
                  <input
                    value={formJob.company}
                    onChange={(event) => setFormJob({ ...formJob, company: event.target.value })}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                    placeholder="Company name"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold">Related Course</span>
                  <select
                    value={formJob.course}
                    onChange={(event) => setFormJob({ ...formJob, course: event.target.value })}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                  >
                    {courseOptions.length === 0 && <option value="">No courses</option>}
                    {courseOptions.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold">Location</span>
                  <input
                    value={formJob.location}
                    onChange={(event) => setFormJob({ ...formJob, location: event.target.value })}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                    placeholder="Kochi / Remote"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold">Job Type</span>
                  <select
                    value={formJob.type}
                    onChange={(event) => setFormJob({ ...formJob, type: event.target.value })}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                  >
                    <option value="Full Time">Full Time</option>
                    <option value="Internship">Internship</option>
                    <option value="Part Time">Part Time</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Remote">Remote</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold">Salary Range</span>
                  <input
                    value={formJob.salary}
                    onChange={(event) => setFormJob({ ...formJob, salary: event.target.value })}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                    placeholder="₹15,000 - ₹25,000"
                  />
                </label>

                <label className="space-y-2 xl:col-span-2">
                  <span className="text-sm font-semibold">Job Link</span>
                  <input
                    value={formJob.link}
                    onChange={(event) => setFormJob({ ...formJob, link: event.target.value })}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                    placeholder="https://company.com/careers/job"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold">Job Status</span>
                  <select
                    value={formJob.status}
                    onChange={(event) => setFormJob({ ...formJob, status: event.target.value as JobRecord['status'] })}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                  >
                    <option value="open">Open</option>
                    <option value="draft">Draft</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void saveJob()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-[#153e90] px-5 py-3 font-semibold text-white disabled:opacity-60"
                >
                  <CustomIcon icon="workstream.svg" folder={iconFolder} alt="Save Job" className="h-4 w-4" />
                  {editingJobId ? 'Update Job' : 'Add Job'}
                </button>

                <button
                  type="button"
                  onClick={resetJobForm}
                  className="inline-flex items-center gap-2 border border-border px-5 py-3 font-semibold hover:bg-accent"
                >
                  <CustomIcon icon="reviews.svg" folder={iconFolder} alt="Reset" className="h-4 w-4" />
                  Reset
                </button>
              </div>
            </div>
          )}

          <div className="border border-border bg-card p-5">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
              <div>
                <h2 className="text-xl font-bold">Job Openings</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Placement Cell can add jobs. Students can view open jobs and apply using the job link.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <input
                  value={jobSearchTerm}
                  onChange={(event) => setJobSearchTerm(event.target.value)}
                  className="h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90]"
                  placeholder="Search job"
                />

                <select
                  value={courseFilter}
                  onChange={(event) => setCourseFilter(event.target.value)}
                  className="h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90]"
                >
                  <option value="all">All Courses</option>
                  {courseOptions.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>

                <select
                  value={jobStatusFilter}
                  onChange={(event) => setJobStatusFilter(event.target.value)}
                  className="h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90]"
                >
                  <option value="all">All Jobs</option>
                  <option value="open">Open</option>
                  <option value="draft">Draft</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div className="mt-5 w-full overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="px-4 py-3 font-semibold">Job</th>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 font-semibold">Course</th>
                    <th className="px-4 py-3 font-semibold">Location</th>
                    <th className="px-4 py-3 font-semibold">Salary</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredJobs.map((item) => {
                    const isSelected = selectedJobId === item.id

                    return (
                      <tr
                        key={item.id}
                        className={
                          isSelected
                            ? 'border-b border-border bg-[#153e90]/5 dark:bg-[#6ee75a]/5'
                            : 'border-b border-border'
                        }
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden border border-border bg-background">
                              <CustomIcon icon="workstream.svg" folder={iconFolder} alt="Job" className="h-5 w-5" />
                            </div>

                            <div>
                              <p className="font-semibold text-foreground">{item.title}</p>
                              <p className="text-xs text-muted-foreground">{item.type}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">{item.company}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.course}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.location || 'Not added'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.salary || 'Not disclosed'}</td>

                        <td className="px-4 py-3">
                          <span
                            className={
                              item.status === 'open'
                                ? 'border border-[#153e90]/25 bg-[#153e90]/10 px-2 py-1 text-xs font-semibold capitalize text-[#153e90] dark:border-[#6ee75a]/25 dark:bg-[#6ee75a]/10 dark:text-white'
                                : 'border border-border bg-background px-2 py-1 text-xs font-semibold capitalize text-muted-foreground'
                            }
                          >
                            {item.status}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedJobId(item.id)}
                              className="border border-border p-2 hover:bg-accent"
                              title="View Details"
                            >
                              <CustomIcon icon="dashboard.svg" folder={iconFolder} alt="View" className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => openJobLink(item.link)}
                              className="border border-border p-2 hover:bg-accent"
                              title="Open Job Link"
                            >
                              <CustomIcon icon="submissions.svg" folder={iconFolder} alt="Job Link" className="h-4 w-4" />
                            </button>

                            {!canManagePlacement && (
                              <button
                                type="button"
                                onClick={() => void applyToJob(item)}
                                disabled={item.status !== 'open'}
                                className="border border-border p-2 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                                title="Apply"
                              >
                                <CustomIcon icon="attendance.svg" folder={iconFolder} alt="Apply" className="h-4 w-4" />
                              </button>
                            )}

                            {canManagePlacement && (
                              <button
                                type="button"
                                onClick={() => editJob(item)}
                                className="border border-border p-2 hover:bg-accent"
                                title="Edit"
                              >
                                <CustomIcon icon="reviews.svg" folder={iconFolder} alt="Edit" className="h-4 w-4" />
                              </button>
                            )}

                            {canManagePlacement && (
                              <button
                                type="button"
                                onClick={() => void deleteJob(item.id)}
                                className="border border-border p-2 hover:bg-red-500/10"
                                title="Delete"
                              >
                                <CustomIcon icon="attendance.svg" folder={iconFolder} alt="Delete" className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {(loading || filteredJobs.length === 0) && (
              <div className="mt-5 border border-border bg-background p-6 text-center text-sm text-muted-foreground">
                {loading ? 'Loading job openings...' : 'No job openings found for the selected filters.'}
              </div>
            )}
          </div>

          <div className="border border-border bg-card p-5">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
              <div>
                <h2 className="text-xl font-bold">Student Placement Pipeline</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Track student readiness, resume approval, interview status and final offer status.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90]"
                  placeholder="Search student"
                />

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90]"
                >
                  <option value="all">All Status</option>
                  <option value="eligible">Eligible</option>
                  <option value="applied">Applied</option>
                  <option value="interviewing">Interviewing</option>
                  <option value="selected">Selected</option>
                  <option value="rejected">Rejected</option>
                  <option value="on-hold">On Hold</option>
                </select>
              </div>
            </div>

            <div className="mt-5 w-full overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Course</th>
                    <th className="px-4 py-3 font-semibold">Resume</th>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 font-semibold">Interview</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPlacements.map((item) => {
                    const status = toUiStatus(item.applicationStatus)
                    const resume = toUiStatus(item.resumeStatus)
                    const interview = item.interviewAt ? item.interviewAt.slice(0, 10) : 'not-scheduled'

                    return (
                      <tr key={item.id} className="border-b border-border">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden border border-border bg-background">
                              <Image
                                src={item.studentAvatar || '/avatar.svg'}
                                alt={item.studentName}
                                width={40}
                                height={40}
                                className="h-full w-full object-cover"
                              />
                            </div>

                            <div>
                              <p className="font-semibold text-foreground">{item.studentName}</p>
                              <p className="text-xs text-muted-foreground">{item.jobTitle || 'Placement candidate'}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">{item.courseName}</td>

                        <td className="px-4 py-3">
                          <span
                            className={
                              resume === 'approved'
                                ? 'border border-[#153e90]/25 bg-[#153e90]/10 px-2 py-1 text-xs font-semibold capitalize text-[#153e90] dark:border-[#6ee75a]/25 dark:bg-[#6ee75a]/10 dark:text-white'
                                : 'border border-border bg-background px-2 py-1 text-xs font-semibold capitalize text-muted-foreground'
                            }
                          >
                            {resume.replace('-', ' ')}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">{item.companyName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{interview.replace('-', ' ')}</td>

                        <td className="px-4 py-3">
                          <span
                            className={
                              status === 'selected'
                                ? 'border border-[#153e90]/25 bg-[#153e90]/10 px-2 py-1 text-xs font-semibold capitalize text-[#153e90] dark:border-[#6ee75a]/25 dark:bg-[#6ee75a]/10 dark:text-white'
                                : 'border border-border bg-background px-2 py-1 text-xs font-semibold capitalize text-muted-foreground'
                            }
                          >
                            {status.replace('-', ' ')}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void updateStudentStatus(item)}
                              className="border border-border p-2 hover:bg-accent"
                              title="Update Status"
                            >
                              <CustomIcon icon="reviews.svg" folder={iconFolder} alt="Update" className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setNotice(
                                  item.jobLink
                                    ? `Job link for ${item.studentName}: ${item.jobLink}`
                                    : `No job link for ${item.studentName}.`,
                                )
                              }
                              className="border border-border p-2 hover:bg-accent"
                              title="Report"
                            >
                              <CustomIcon icon="dashboard.svg" folder={iconFolder} alt="Report" className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {filteredPlacements.length === 0 && (
              <div className="mt-5 border border-border bg-background p-6 text-center text-sm text-muted-foreground">
                No placement records found for the selected filters.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="border border-border bg-card p-5">
            <CustomIcon icon="workstream.svg" folder={iconFolder} alt="Selected Job" className="mb-4 h-10 w-10" />
            <h2 className="text-xl font-bold">Selected Job</h2>

            {selectedJob ? (
              <div className="mt-5 space-y-4 text-sm">
                <div className="border border-border bg-background p-4">
                  <p className="font-semibold">{selectedJob.title}</p>
                  <p className="mt-1 text-muted-foreground">{selectedJob.company}</p>
                </div>

                <div className="grid gap-3">
                  <div className="border border-border bg-background p-4">
                    <p className="text-xs text-muted-foreground">Course Match</p>
                    <p className="mt-1 font-semibold">{selectedJob.course}</p>
                  </div>

                  <div className="border border-border bg-background p-4">
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="mt-1 font-semibold">{selectedJob.location || 'Not added'}</p>
                  </div>

                  <div className="border border-border bg-background p-4">
                    <p className="text-xs text-muted-foreground">Salary</p>
                    <p className="mt-1 font-semibold">{selectedJob.salary || 'Not disclosed'}</p>
                  </div>

                  <div className="border border-border bg-background p-4">
                    <p className="text-xs text-muted-foreground">Applicants</p>
                    <p className="mt-1 font-semibold">{selectedJob.applicants}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openJobLink(selectedJob.link)}
                  className="w-full bg-[#153e90] px-5 py-3 font-semibold text-white"
                >
                  Open Job Link
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Select a job to view details.</p>
            )}
          </div>

          <div className="border border-border bg-card p-5">
            <h2 className="text-xl font-bold">Placement Flow</h2>

            <div className="mt-5 space-y-4 text-sm">
              <div className="border border-border bg-background p-4">
                <p className="font-semibold">1. Add Job</p>
                <p className="mt-1 text-muted-foreground">
                  Placement Cell adds job title, company, location, salary and job link.
                </p>
              </div>

              <div className="border border-border bg-background p-4">
                <p className="font-semibold">2. Student Applies</p>
                <p className="mt-1 text-muted-foreground">
                  Student can view open jobs and apply through the job link.
                </p>
              </div>

              <div className="border border-border bg-background p-4">
                <p className="font-semibold">3. Placement Tracking</p>
                <p className="mt-1 text-muted-foreground">
                  Resume, interview, selection and offer status are tracked by Placement Cell.
                </p>
              </div>
            </div>
          </div>

          <div className="border border-border bg-card p-5">
            <h2 className="text-xl font-bold">Access Rules</h2>

            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>Placement Cell can create, edit and delete job openings.</p>
              <p>Admin and Super Admin can view and manage all placement records.</p>
              <p>Students can view open jobs and apply through the given job link.</p>
              <p className="font-semibold text-[#153e90] dark:text-[#6ee75a]">
                Student cannot create or delete job records.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
