import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataResult } from '@/lib/data/config'
import { createClient } from '@/lib/supabase/client'

export type PlacementJobStatus = 'open' | 'closed' | 'draft'
export type PlacementApplicationStatus = 'applied' | 'interviewing' | 'selected' | 'rejected' | 'on_hold'
export type PlacementResumeStatus = 'pending' | 'approved' | 'revision_needed'

export type PlacementJobRow = {
  id: string
  title: string
  company: string
  courseName: string
  departmentName: string
  location: string
  jobType: string
  salaryRange: string
  jobLink: string
  status: PlacementJobStatus
  branchId: string | null
  createdAt: string
}

export type PlacementApplicationRow = {
  id: string
  jobId: string
  studentId: string
  status: PlacementApplicationStatus
  resumeStatus: PlacementResumeStatus
  appliedAt: string
  interviewAt: string | null
  notes: string
  job: PlacementJobRow | null
}

type DbPlacementJob = {
  id: string
  title: string
  company: string
  course_name: string
  department_name: string
  location: string
  job_type: string
  salary_range: string
  job_link: string
  status: PlacementJobStatus
  branch_id: string | null
  created_at: string
}

type DbPlacementApplication = {
  id: string
  job_id: string
  student_id: string
  status: PlacementApplicationStatus
  resume_status: PlacementResumeStatus
  applied_at: string
  interview_at: string | null
  notes: string | null
  job: DbPlacementJob | DbPlacementJob[] | null
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] || null : value
}

function mapJob(row: DbPlacementJob): PlacementJobRow {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    courseName: row.course_name || '—',
    departmentName: row.department_name || '—',
    location: row.location || '—',
    jobType: row.job_type || 'Full-time',
    salaryRange: row.salary_range || '—',
    jobLink: row.job_link || '',
    status: row.status,
    branchId: row.branch_id,
    createdAt: row.created_at,
  }
}

function mapApplication(row: DbPlacementApplication): PlacementApplicationRow {
  const job = unwrap(row.job)
  return {
    id: row.id,
    jobId: row.job_id,
    studentId: row.student_id,
    status: row.status,
    resumeStatus: row.resume_status,
    appliedAt: row.applied_at,
    interviewAt: row.interview_at,
    notes: row.notes?.trim() || '',
    job: job ? mapJob(job) : null,
  }
}

const jobSelect = `
  id,
  title,
  company,
  course_name,
  department_name,
  location,
  job_type,
  salary_range,
  job_link,
  status,
  branch_id,
  created_at
`

export type PlacementJobWriteInput = {
  title: string
  company: string
  courseName: string
  departmentName?: string
  location: string
  jobType: string
  salaryRange: string
  jobLink: string
  status: PlacementJobStatus
  branchId?: string | null
  createdBy?: string | null
}

export type PlacementPipelineRow = {
  id: string
  studentId: string
  studentName: string
  studentAvatar: string | null
  courseName: string
  companyName: string
  jobTitle: string
  location: string
  salaryRange: string
  jobLink: string
  resumeStatus: PlacementResumeStatus
  applicationStatus: PlacementApplicationStatus
  interviewAt: string | null
  appliedAt: string
}

export async function fetchPlacementJobs(options?: {
  status?: PlacementJobStatus | 'all'
  supabase?: SupabaseClient
}): Promise<DataResult<PlacementJobRow[]>> {
  const client = options?.supabase ?? createClient()

  try {
    let query = client.from('placement_jobs').select(jobSelect).order('created_at', { ascending: false })

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status)
    }

    const { data, error } = await query

    if (error) {
      return { source: 'supabase', data: [], error: error.message }
    }

    return {
      source: 'supabase',
      data: ((data || []) as DbPlacementJob[]).map(mapJob),
    }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load placement jobs.',
    }
  }
}

export async function fetchPlacementJobApplicantCounts(
  jobIds: string[],
  supabase?: SupabaseClient,
): Promise<Map<string, number>> {
  const client = supabase ?? createClient()
  const counts = new Map<string, number>()
  jobIds.forEach((id) => counts.set(id, 0))

  if (!jobIds.length) return counts

  const { data, error } = await client
    .from('placement_applications')
    .select('job_id')
    .in('job_id', jobIds)

  if (error || !data?.length) return counts

  for (const row of data as { job_id: string }[]) {
    counts.set(row.job_id, (counts.get(row.job_id) || 0) + 1)
  }

  return counts
}

export async function createPlacementJob(
  input: PlacementJobWriteInput,
  supabase?: SupabaseClient,
): Promise<{ ok: true; job: PlacementJobRow } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  try {
    const { data, error } = await client
      .from('placement_jobs')
      .insert({
        title: input.title.trim(),
        company: input.company.trim(),
        course_name: input.courseName.trim(),
        department_name: input.departmentName?.trim() || '',
        location: input.location.trim(),
        job_type: input.jobType.trim() || 'Full-time',
        salary_range: input.salaryRange.trim(),
        job_link: input.jobLink.trim(),
        status: input.status,
        branch_id: input.branchId || null,
        created_by: input.createdBy || null,
        updated_at: new Date().toISOString(),
      })
      .select(jobSelect)
      .single()

    if (error || !data) {
      return { ok: false, error: error?.message || 'Failed to create job.' }
    }

    return { ok: true, job: mapJob(data as DbPlacementJob) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to create job.',
    }
  }
}

export async function updatePlacementJob(
  jobId: string,
  input: PlacementJobWriteInput,
  supabase?: SupabaseClient,
): Promise<{ ok: true; job: PlacementJobRow } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  if (!jobId) return { ok: false, error: 'Job id is required.' }

  try {
    const { data, error } = await client
      .from('placement_jobs')
      .update({
        title: input.title.trim(),
        company: input.company.trim(),
        course_name: input.courseName.trim(),
        department_name: input.departmentName?.trim() || '',
        location: input.location.trim(),
        job_type: input.jobType.trim() || 'Full-time',
        salary_range: input.salaryRange.trim(),
        job_link: input.jobLink.trim(),
        status: input.status,
        branch_id: input.branchId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select(jobSelect)
      .single()

    if (error || !data) {
      return { ok: false, error: error?.message || 'Failed to update job.' }
    }

    return { ok: true, job: mapJob(data as DbPlacementJob) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to update job.',
    }
  }
}

export async function deletePlacementJob(
  jobId: string,
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  if (!jobId) return { ok: false, error: 'Job id is required.' }

  try {
    const { error } = await client.from('placement_jobs').delete().eq('id', jobId)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to delete job.',
    }
  }
}

export async function fetchPlacementPipeline(
  supabase?: SupabaseClient,
): Promise<DataResult<PlacementPipelineRow[]>> {
  const client = supabase ?? createClient()

  try {
    const { data, error } = await client
      .from('placement_applications')
      .select(
        `
        id,
        job_id,
        student_id,
        status,
        resume_status,
        applied_at,
        interview_at,
        notes,
        job:placement_jobs (
          ${jobSelect}
        ),
        student:students (
          id,
          profile_picture_url,
          profile:profiles (
            full_name,
            avatar_url
          )
        )
      `,
      )
      .order('applied_at', { ascending: false })

    if (error) {
      return { source: 'supabase', data: [], error: error.message }
    }

    type DbPipelineRow = DbPlacementApplication & {
      student:
        | {
            id: string
            profile_picture_url: string | null
            profile: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null
          }
        | {
            id: string
            profile_picture_url: string | null
            profile: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null
          }[]
        | null
    }

    const rows = ((data || []) as DbPipelineRow[]).map((row) => {
      const job = unwrap(row.job)
      const student = unwrap(row.student)
      const profile = unwrap(student?.profile)

      return {
        id: row.id,
        studentId: row.student_id,
        studentName: profile?.full_name?.trim() || 'Student',
        studentAvatar: student?.profile_picture_url || profile?.avatar_url || null,
        courseName: job?.course_name || '—',
        companyName: job?.company || '—',
        jobTitle: job?.title || 'Job',
        location: job?.location?.trim() || '—',
        salaryRange: job?.salary_range?.trim() || '—',
        jobLink: job?.job_link || '',
        resumeStatus: row.resume_status,
        applicationStatus: row.status,
        interviewAt: row.interview_at,
        appliedAt: row.applied_at,
      } satisfies PlacementPipelineRow
    })

    return { source: 'supabase', data: rows }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load placement pipeline.',
    }
  }
}

export async function applyStudentToJob(
  jobId: string,
  studentId: string,
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  if (!jobId || !studentId) {
    return { ok: false, error: 'Job and student are required.' }
  }

  try {
    const { error } = await client.from('placement_applications').upsert(
      {
        job_id: jobId,
        student_id: studentId,
        status: 'applied',
        resume_status: 'pending',
        applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'job_id,student_id' },
    )

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to apply for job.',
    }
  }
}

export async function updatePlacementApplicationStatus(
  applicationId: string,
  status: PlacementApplicationStatus,
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  if (!applicationId) return { ok: false, error: 'Application id is required.' }

  try {
    const { error } = await client
      .from('placement_applications')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to update application status.',
    }
  }
}

export async function fetchStudentPlacementApplications(
  studentId: string,
  supabase?: SupabaseClient,
): Promise<DataResult<PlacementApplicationRow[]>> {
  const client = supabase ?? createClient()

  if (!studentId) {
    return { source: 'supabase', data: [], error: 'Student id is required.' }
  }

  try {
    const { data, error } = await client
      .from('placement_applications')
      .select(
        `
        id,
        job_id,
        student_id,
        status,
        resume_status,
        applied_at,
        interview_at,
        notes,
        job:placement_jobs (
          ${jobSelect}
        )
      `,
      )
      .eq('student_id', studentId)
      .order('applied_at', { ascending: false })

    if (error) {
      return { source: 'supabase', data: [], error: error.message }
    }

    return {
      source: 'supabase',
      data: ((data || []) as DbPlacementApplication[]).map(mapApplication),
    }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load applications.',
    }
  }
}

export function getEligibleJobsForStudent(
  jobs: PlacementJobRow[],
  appliedJobIds: Set<string>,
  student: {
    course_name: string
    department_name: string
  },
): PlacementJobRow[] {
  const course = student.course_name.trim().toLowerCase()
  const department = student.department_name.trim().toLowerCase()

  return jobs.filter((job) => {
    if (job.status !== 'open') return false
    if (appliedJobIds.has(job.id)) return false

    const jobCourse = job.courseName.trim().toLowerCase()
    const jobDepartment = job.departmentName.trim().toLowerCase()

    const courseMatch =
      !jobCourse ||
      jobCourse === '—' ||
      jobCourse === 'all' ||
      jobCourse === course ||
      course.includes(jobCourse) ||
      jobCourse.includes(course)

    const departmentMatch =
      !jobDepartment ||
      jobDepartment === '—' ||
      jobDepartment === 'all' ||
      jobDepartment === department ||
      department.includes(jobDepartment) ||
      jobDepartment.includes(department)

    return courseMatch || departmentMatch
  })
}

export const PLACEMENT_APPLICATION_STATUS_OPTIONS: {
  value: PlacementApplicationStatus
  label: string
}[] = [
  { value: 'applied', label: 'Applied' },
  { value: 'on_hold', label: 'Selected to next step' },
  { value: 'interviewing', label: 'Interview scheduled' },
  { value: 'selected', label: 'Placed' },
  { value: 'rejected', label: 'Rejected' },
]

export function formatApplicationStatus(status: string) {
  const match = PLACEMENT_APPLICATION_STATUS_OPTIONS.find((item) => item.value === status)
  if (match) return match.label
  if (status === 'on_hold') return 'Selected to next step'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function formatResumeStatus(status: string) {
  if (status === 'revision_needed') return 'Revision Needed'
  return status.charAt(0).toUpperCase() + status.slice(1)
}
