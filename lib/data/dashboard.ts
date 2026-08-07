import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchBatchList } from '@/lib/data/batches'
import { fetchComplaints } from '@/lib/data/complaints'
import { fetchMentorList } from '@/lib/data/mentors'
import { fetchAccessibleBatches } from '@/lib/data/my-courses'
import { fetchStudentList } from '@/lib/data/students'
import {
  computeAttendancePercent,
  fetchAttendanceRecords,
  fetchBatchAttendanceAverages,
  listExpectedClassDays,
} from '@/lib/data/attendance'
import { fetchBatchTaskStats, fetchStudentIdByProfileId } from '@/lib/data/tasks'
import { createClient } from '@/lib/supabase/client'
import type { ModuleId } from '@/lib/demo/types'

export type DashboardStats = {
  studentCount: number
  batchCount: number
  onlineBatchCount: number
  offlineBatchCount: number
  mentorCount: number
  taskCount: number
  openTaskCount: number
  submissionCount: number
  pendingMentorReviewCount: number
  pendingHodReviewCount: number
  pendingQaCount: number
  qaApprovedCount: number
  revisionCount: number
  openComplaintsCount: number
  classMaterialsCount: number
  attendanceAveragePercent: number
  studentAttendancePercent: number
  studentPendingTasks: number
  studentSubmittedTasks: number
  studentAverageMark: number
  studentOpenComplaints: number
  studentTaskProgress: number
}

export type DashboardRole =
  | 'superadmin'
  | 'admin'
  | 'branch_controller'
  | 'hod'
  | 'mentor'
  | 'final_qa'
  | 'student'
  | 'placement'

export type SummaryCard = {
  label: string
  value: string | number
  helper: string
  icon: string
  moduleId?: ModuleId
}

export type QuickAction = {
  label: string
  href: string
  moduleId: ModuleId
  icon: string
}

export type PendingItem = {
  title: string
  description: string
  badge: string
}

export type ChartItem = {
  label: string
  value: number
}

export type DashboardViewData = {
  title: string
  subtitle: string
  badge: string
  cards: SummaryCard[]
  pendingTitle: string
  pendingItems: PendingItem[]
  quickActions: QuickAction[]
  chartTitle: string
  chartData: ChartItem[]
}

const emptyStats: DashboardStats = {
  studentCount: 0,
  batchCount: 0,
  onlineBatchCount: 0,
  offlineBatchCount: 0,
  mentorCount: 0,
  taskCount: 0,
  openTaskCount: 0,
  submissionCount: 0,
  pendingMentorReviewCount: 0,
  pendingHodReviewCount: 0,
  pendingQaCount: 0,
  qaApprovedCount: 0,
  revisionCount: 0,
  openComplaintsCount: 0,
  classMaterialsCount: 0,
  attendanceAveragePercent: 0,
  studentAttendancePercent: 0,
  studentPendingTasks: 0,
  studentSubmittedTasks: 0,
  studentAverageMark: 0,
  studentOpenComplaints: 0,
  studentTaskProgress: 0,
}

export function getDashboardRoleKey(
  parentRoleId?: string | null,
  roleName?: string,
  roleId?: string,
): DashboardRole {
  const parent = (parentRoleId || '').toLowerCase()
  const value = `${roleId || ''} ${roleName || ''}`.toLowerCase()

  if (parent === 'super_admin' || value.includes('super')) return 'superadmin'
  if (parent === 'branch_admin' || value.includes('branch')) return 'branch_controller'
  if (parent === 'mentor' && (value.includes('hod') || value.includes('superior'))) return 'hod'
  if (parent === 'mentor') return 'mentor'
  if (value.includes('hod') || value.includes('superior')) return 'hod'
  if (value.includes('final') || value.includes('qa')) return 'final_qa'
  if (parent === 'student' || value.includes('student')) return 'student'
  if (parent === 'placement' || value.includes('placement')) return 'placement'
  if (parent === 'company_admin' || value.includes('admin')) return 'admin'

  return 'superadmin'
}

async function resolveBatchIds(
  options: {
    branchId: string | null | undefined
    userId?: string | null
    parentRoleId?: string | null
  },
  client: SupabaseClient,
): Promise<string[]> {
  if (
    options.userId &&
    (options.parentRoleId === 'student' ||
      options.parentRoleId === 'mentor' ||
      options.parentRoleId === 'placement')
  ) {
    const { batches } = await fetchAccessibleBatches(
      {
        branchId: options.branchId || '',
        userId: options.userId,
        parentRoleId: options.parentRoleId,
      },
      client,
    )

    return batches.filter((batch) => batch.status !== 'inactive').map((batch) => batch.id)
  }

  if (!options.branchId) return []

  const batchesResult = await fetchBatchList(options.branchId, client)
  return (batchesResult.data || [])
    .filter((batch) => batch.status !== 'inactive')
    .map((batch) => batch.id)
}

export async function fetchDashboardStats(
  options: {
    branchId: string | null | undefined
    userId?: string | null
    parentRoleId?: string | null
  },
  supabase?: SupabaseClient,
): Promise<DashboardStats> {
  const client = supabase ?? createClient()
  const isStudent = options.parentRoleId === 'student'

  try {
    const batchIds = await resolveBatchIds(options, client)

    if (!batchIds.length && !options.branchId && !isStudent) {
      return emptyStats
    }

    const branchId = options.branchId || null
    const studentId =
      isStudent && options.userId ? await fetchStudentIdByProfileId(options.userId, client) : null

    const studentListOptions: { branchId?: string | null; staffUserId?: string | null } = {}

    if (branchId) {
      studentListOptions.branchId = branchId
    }

    if (options.parentRoleId === 'mentor' && options.userId) {
      studentListOptions.staffUserId = options.userId
    }

    const [
      batchesResult,
      studentsResult,
      mentorsResult,
      complaintsResult,
      attendanceAverages,
    ] = await Promise.all([
      branchId ? fetchBatchList(branchId, client) : Promise.resolve({ data: [], error: undefined }),
      Object.keys(studentListOptions).length
        ? fetchStudentList(studentListOptions, client)
        : Promise.resolve({ data: [], error: undefined }),
      branchId ? fetchMentorList(branchId, client) : Promise.resolve({ data: [], error: undefined }),
      fetchComplaints({ branchId }),
      fetchBatchAttendanceAverages(batchIds, client),
    ])

    const batches = (batchesResult.data || []).filter((batch) => batch.status !== 'inactive')
    const scopedBatchIds = batchIds.length ? batchIds : batches.map((batch) => batch.id)

    let studentCount = studentsResult.data?.length || 0

    if (!studentCount && scopedBatchIds.length) {
      const { count } = await client
        .from('student_batch_enrollments')
        .select('student_id', { count: 'exact', head: true })
        .in('batch_id', scopedBatchIds)

      studentCount = count || 0
    }

    const attendancePercents = scopedBatchIds
      .map((id) => attendanceAverages.get(id)?.averagePercent || 0)
      .filter((value) => value > 0)
    const attendanceAveragePercent = attendancePercents.length
      ? Math.round(attendancePercents.reduce((total, value) => total + value, 0) / attendancePercents.length)
      : 0

    let taskCount = 0
    let openTaskCount = 0
    let submissionCount = 0
    let pendingMentorReviewCount = 0
    let pendingHodReviewCount = 0
    let pendingQaCount = 0
    let qaApprovedCount = 0
    let revisionCount = 0
    let classMaterialsCount = 0

    let studentAttendancePercent = 0
    let studentPendingTasks = 0
    let studentSubmittedTasks = 0
    let studentAverageMark = 0
    let studentTaskProgress = 0

    if (scopedBatchIds.length) {
      const enrolledCounts = new Map(
        batches.map((batch) => [batch.id, batch.enrolled_count]),
      )

      const [{ data: branchTasks }, taskStats, materialsResult, studentAttendanceResult] =
        await Promise.all([
          client.from('tasks').select('id, status').in('batch_id', scopedBatchIds),
          fetchBatchTaskStats(scopedBatchIds, {
            studentId,
            enrolledCounts,
            supabase: client,
          }),
          client
            .from('class_materials')
            .select('id', { count: 'exact', head: true })
            .in('batch_id', scopedBatchIds),
          studentId
            ? fetchAttendanceRecords(scopedBatchIds, { studentId, supabase: client })
            : Promise.resolve({ data: [], error: undefined }),
        ])

      const tasks = branchTasks || []
      taskCount = tasks.length
      openTaskCount = tasks.filter((task) => task.status === 'open').length
      classMaterialsCount = materialsResult.count || 0

      if (studentId) {
        const statsList = Array.from(taskStats.values())
        const totalTasks = statsList.reduce((total, item) => total + item.tasksCount, 0)
        const totalSubmissions = statsList.reduce((total, item) => total + item.submissionsCount, 0)
        studentSubmittedTasks = totalSubmissions
        studentPendingTasks = Math.max(totalTasks - totalSubmissions, 0)
        studentTaskProgress =
          totalTasks > 0 ? Math.min(100, Math.round((totalSubmissions / totalTasks) * 100)) : 0

        if (studentId) {
          const records = studentAttendanceResult.data || []
          const percents: number[] = []

          for (const batch of batches) {
            const batchRecords = records.filter((record) => record.batchId === batch.id)
            const schedule = {
              startDate: batch.start_date,
              endDate: batch.end_date,
              classDayType: batch.class_day_type || 'weekdays',
              customDays: batch.custom_days,
            }
            const expected = listExpectedClassDays(schedule)
            if (!expected.length) continue
            percents.push(computeAttendancePercent(batchRecords, schedule))
          }

          if (percents.length) {
            studentAttendancePercent = Math.round(
              percents.reduce((total, value) => total + value, 0) / percents.length,
            )
          }
        }

        const { data: studentMarks } = await client
          .from('task_submissions')
          .select('mentor_mark')
          .eq('student_id', studentId)
          .not('mentor_mark', 'is', null)

        const marks = (studentMarks || [])
          .map((row) => Number(row.mentor_mark))
          .filter((value) => !Number.isNaN(value) && value > 0)

        if (marks.length) {
          studentAverageMark = Math.round(marks.reduce((total, value) => total + value, 0) / marks.length)
        }
      } else {
        submissionCount = Array.from(taskStats.values()).reduce(
          (total, item) => total + item.submissionsCount,
          0,
        )
      }

      const taskIds = tasks.map((task) => task.id)

      if (taskIds.length) {
        const { data: submissionRows } = await client
          .from('task_submissions')
          .select(
            'id, status, mentor_decision, hod_decision, qa_decision, student_id',
          )
          .in('task_id', taskIds)
          .neq('status', 'draft')

        const rows = (submissionRows || []).filter((row) => {
          if (!studentId) return true
          return row.student_id === studentId
        })

        if (!studentId) {
          submissionCount = rows.length
        }

        pendingMentorReviewCount = rows.filter(
          (row) =>
            row.mentor_decision === 'pending' &&
            ['submitted', 'in_review', 'revision'].includes(row.status),
        ).length

        pendingHodReviewCount = rows.filter(
          (row) => row.mentor_decision === 'approved' && row.hod_decision === 'pending',
        ).length

        pendingQaCount = rows.filter((row) => row.qa_decision === 'pending').length

        qaApprovedCount = rows.filter((row) => row.qa_decision === 'approved').length

        revisionCount = rows.filter(
          (row) =>
            row.status === 'revision' ||
            row.status === 'rejected' ||
            row.mentor_decision === 'rejected' ||
            row.mentor_decision === 'revision_requested' ||
            row.hod_decision === 'rejected' ||
            row.hod_decision === 'revision_requested' ||
            row.qa_decision === 'rejected' ||
            row.qa_decision === 'revision_requested',
        ).length
      }
    }

    const openComplaintsCount = (complaintsResult.data || []).filter((complaint) => {
      const status = complaint.status.toLowerCase()
      return status !== 'resolved' && status !== 'rejected'
    }).length

    const studentOpenComplaints = studentId
      ? (complaintsResult.data || []).filter(
          (complaint) =>
            complaint.studentId === studentId &&
            complaint.status.toLowerCase() !== 'resolved' &&
            complaint.status.toLowerCase() !== 'rejected',
        ).length
      : 0

    const onlineBatchCount = batches.filter((batch) => batch.batch_mode === 'online').length
    const offlineBatchCount = batches.filter((batch) => batch.batch_mode !== 'online').length
    const batchCount = scopedBatchIds.length || batches.length

    return {
      studentCount,
      batchCount,
      onlineBatchCount: onlineBatchCount || batches.filter((b) => scopedBatchIds.includes(b.id) && b.batch_mode === 'online').length,
      offlineBatchCount: offlineBatchCount || batches.filter((b) => scopedBatchIds.includes(b.id) && b.batch_mode !== 'online').length,
      mentorCount: mentorsResult.data?.length || 0,
      taskCount,
      openTaskCount,
      submissionCount,
      pendingMentorReviewCount,
      pendingHodReviewCount,
      pendingQaCount,
      qaApprovedCount,
      revisionCount,
      openComplaintsCount,
      classMaterialsCount,
      attendanceAveragePercent,
      studentAttendancePercent,
      studentPendingTasks,
      studentSubmittedTasks,
      studentAverageMark,
      studentOpenComplaints,
      studentTaskProgress,
    }
  } catch {
    return emptyStats
  }
}

function buildPendingItems(stats: DashboardStats, roleKey: DashboardRole): PendingItem[] {
  const items: PendingItem[] = []

  if (stats.pendingQaCount > 0) {
    items.push({
      title: `${stats.pendingQaCount} submission(s) waiting Final QA`,
      description: 'Review mentor and HOD marks before final validation.',
      badge: 'Final QA',
    })
  }

  if (stats.pendingMentorReviewCount > 0) {
    items.push({
      title: `${stats.pendingMentorReviewCount} submission(s) waiting mentor review`,
      description: 'Student work needs mentor evaluation.',
      badge: 'Review',
    })
  }

  if (stats.pendingHodReviewCount > 0) {
    items.push({
      title: `${stats.pendingHodReviewCount} submission(s) waiting HOD review`,
      description: 'Mentor-reviewed submissions need HOD approval.',
      badge: 'HOD',
    })
  }

  if (stats.openComplaintsCount > 0) {
    items.push({
      title: `${stats.openComplaintsCount} open complaint(s)`,
      description: 'Student support requests need attention.',
      badge: 'Support',
    })
  }

  if (roleKey === 'student' && stats.studentPendingTasks > 0) {
    items.push({
      title: `${stats.studentPendingTasks} task(s) pending submission`,
      description: 'Complete assignments before the deadline.',
      badge: 'Task',
    })
  }

  if (items.length === 0) {
    items.push({
      title: 'No urgent actions right now',
      description: 'Your dashboard counts are synced from the database.',
      badge: 'Updated',
    })
  }

  return items.slice(0, 3)
}

export function buildDashboardView(options: {
  roleKey: DashboardRole
  stats: DashboardStats
  userName?: string
  branchCode?: string
  branchName?: string
}): DashboardViewData {
  const { roleKey, stats } = options
  const userName = options.userName || 'User'
  const branchLabel = options.branchCode || options.branchName || '—'

  const commonAdminCards: SummaryCard[] = [
    {
      label: 'Active Branch',
      value: branchLabel,
      helper: options.branchName || 'Branch selected in header',
      icon: 'workstream.svg',
      moduleId: 'branches',
    },
    {
      label: 'Total Students',
      value: stats.studentCount,
      helper: 'Active student records in scope',
      icon: 'students.svg',
      moduleId: 'students',
    },
    {
      label: 'Active Batches',
      value: stats.batchCount,
      helper: 'Running online and offline batches',
      icon: 'patch.svg',
      moduleId: 'batches',
    },
    {
      label: 'Online Batches',
      value: stats.onlineBatchCount,
      helper: 'Online classes in this branch',
      icon: 'workstream.svg',
      moduleId: 'batches',
    },
    {
      label: 'Offline Batches',
      value: stats.offlineBatchCount,
      helper: 'Onsite classroom batches',
      icon: 'attendance.svg',
      moduleId: 'attendance',
    },
    {
      label: 'Assigned Tasks',
      value: stats.taskCount,
      helper: `${stats.openTaskCount} open for submission`,
      icon: 'tasks.svg',
      moduleId: 'tasks',
    },
    {
      label: 'Final QA Pending',
      value: stats.pendingQaCount,
      helper: 'Waiting for final validation',
      icon: 'reviews.svg',
      moduleId: 'final_qa',
    },
    {
      label: 'Open Complaints',
      value: stats.openComplaintsCount,
      helper: 'Student support requests',
      icon: 'admission.svg',
      moduleId: 'complaints',
    },
  ]

  const adminChart: ChartItem[] = [
    { label: 'Students', value: stats.studentCount },
    { label: 'Batches', value: stats.batchCount },
    { label: 'Tasks', value: stats.taskCount },
    { label: 'Submissions', value: stats.submissionCount },
    { label: 'Complaints', value: stats.openComplaintsCount },
  ]

  const views: Record<DashboardRole, DashboardViewData> = {
    superadmin: {
      title: `Welcome, ${userName}`,
      subtitle: 'System overview for the selected branch, loaded from Supabase.',
      badge: 'Super Admin',
      cards: commonAdminCards,
      pendingTitle: 'Pending System Actions',
      pendingItems: buildPendingItems(stats, 'superadmin'),
      quickActions: [
        { label: 'Manage Users', href: '/users', moduleId: 'users', icon: 'users.svg' },
        { label: 'Manage Branches', href: '/branches', moduleId: 'branches', icon: 'patch.svg' },
        { label: 'View Reports', href: '/reports', moduleId: 'reports', icon: 'analytics.svg' },
        { label: 'Manage Permissions', href: '/role-management', moduleId: 'roles', icon: 'reviews.svg' },
      ],
      chartTitle: 'Branch Overview',
      chartData: adminChart,
    },
    admin: {
      title: `Welcome, ${userName}`,
      subtitle: 'Company admin view for the active branch with live counts.',
      badge: 'Company Admin',
      cards: commonAdminCards,
      pendingTitle: 'Pending Admin Actions',
      pendingItems: buildPendingItems(stats, 'admin'),
      quickActions: [
        { label: 'Manage Branches', href: '/branches', moduleId: 'branches', icon: 'patch.svg' },
        { label: 'Manage Users', href: '/users', moduleId: 'users', icon: 'users.svg' },
        { label: 'View Reports', href: '/reports', moduleId: 'reports', icon: 'analytics.svg' },
        { label: 'Manage Permissions', href: '/role-management', moduleId: 'roles', icon: 'reviews.svg' },
      ],
      chartTitle: 'Company Admin Overview',
      chartData: adminChart,
    },
    branch_controller: {
      title: `Welcome, ${userName}`,
      subtitle: 'Branch operations dashboard with live student, batch, and academic counts.',
      badge: 'Branch Admin',
      cards: [
        {
          label: 'Branch Students',
          value: stats.studentCount,
          helper: 'Students in assigned branch',
          icon: 'students.svg',
          moduleId: 'students',
        },
        {
          label: 'Branch Mentors',
          value: stats.mentorCount,
          helper: 'Mentors assigned to branch',
          icon: 'mentors.svg',
          moduleId: 'mentors',
        },
        {
          label: 'Online Batches',
          value: stats.onlineBatchCount,
          helper: 'Online classes',
          icon: 'workstream.svg',
          moduleId: 'batches',
        },
        {
          label: 'Offline Batches',
          value: stats.offlineBatchCount,
          helper: 'Onsite batches',
          icon: 'patch.svg',
          moduleId: 'batches',
        },
        {
          label: 'Attendance Average',
          value: stats.attendanceAveragePercent > 0 ? `${stats.attendanceAveragePercent}%` : '—',
          helper: 'Average marked attendance in scope',
          icon: 'attendance.svg',
          moduleId: 'attendance',
        },
        {
          label: 'Pending Submissions',
          value: stats.pendingMentorReviewCount,
          helper: 'Waiting for mentor review',
          icon: 'submissions.svg',
          moduleId: 'submissions',
        },
        {
          label: 'Class Materials',
          value: stats.classMaterialsCount,
          helper: 'Uploaded daily notes and files',
          icon: 'courses.svg',
          moduleId: 'class-materials',
        },
        {
          label: 'Open Complaints',
          value: stats.openComplaintsCount,
          helper: 'Support requests needing action',
          icon: 'admission.svg',
          moduleId: 'complaints',
        },
      ],
      pendingTitle: 'Pending Branch Actions',
      pendingItems: buildPendingItems(stats, 'branch_controller'),
      quickActions: [
        { label: 'Add Student', href: '/students', moduleId: 'students', icon: 'students.svg' },
        { label: 'Add Mentor', href: '/mentors', moduleId: 'mentors', icon: 'mentors.svg' },
        { label: 'Create Batch', href: '/batches', moduleId: 'batches', icon: 'patch.svg' },
        { label: 'Assign Task', href: '/tasks', moduleId: 'tasks', icon: 'tasks.svg' },
        { label: 'View Attendance', href: '/attendance', moduleId: 'attendance', icon: 'attendance.svg' },
      ],
      chartTitle: 'Branch Performance',
      chartData: [
        { label: 'Attendance', value: stats.attendanceAveragePercent },
        { label: 'Tasks', value: stats.taskCount },
        { label: 'Submissions', value: stats.submissionCount },
        { label: 'Materials', value: stats.classMaterialsCount },
      ],
    },
    hod: {
      title: `Welcome, ${userName}`,
      subtitle: 'HOD view with live mentor review and submission counts.',
      badge: 'HOD',
      cards: [
        {
          label: 'Assigned Mentors',
          value: stats.mentorCount,
          helper: 'Mentors in branch scope',
          icon: 'mentors.svg',
          moduleId: 'mentors',
        },
        {
          label: 'Pending HOD Reviews',
          value: stats.pendingHodReviewCount,
          helper: 'Submissions waiting for HOD review',
          icon: 'reviews.svg',
          moduleId: 'hod_review',
        },
        {
          label: 'Mentor Reviews Pending',
          value: stats.pendingMentorReviewCount,
          helper: 'Still waiting on mentor side',
          icon: 'submissions.svg',
          moduleId: 'submissions',
        },
        {
          label: 'Revision Requests',
          value: stats.revisionCount,
          helper: 'Rejected or revision requested',
          icon: 'reviews.svg',
          moduleId: 'submissions',
        },
        {
          label: 'Students in Scope',
          value: stats.studentCount,
          helper: 'Students under assigned batches',
          icon: 'students.svg',
          moduleId: 'students',
        },
        {
          label: 'Open Tasks',
          value: stats.openTaskCount,
          helper: 'Tasks still accepting submission',
          icon: 'tasks.svg',
          moduleId: 'tasks',
        },
      ],
      pendingTitle: 'Pending HOD Actions',
      pendingItems: buildPendingItems(stats, 'hod'),
      quickActions: [
        { label: 'Review Submissions', href: '/task-submissions', moduleId: 'submissions', icon: 'submissions.svg' },
        { label: 'View Marks', href: '/marks', moduleId: 'marks', icon: 'reviews.svg' },
        { label: 'View Students', href: '/students', moduleId: 'students', icon: 'students.svg' },
        { label: 'View Mentors', href: '/mentors', moduleId: 'mentors', icon: 'mentors.svg' },
      ],
      chartTitle: 'Review Pipeline',
      chartData: [
        { label: 'Mentor Pending', value: stats.pendingMentorReviewCount },
        { label: 'HOD Pending', value: stats.pendingHodReviewCount },
        { label: 'QA Pending', value: stats.pendingQaCount },
        { label: 'Revisions', value: stats.revisionCount },
      ],
    },
    mentor: {
      title: `Welcome, ${userName}`,
      subtitle: 'Mentor dashboard with live batch task and submission counts.',
      badge: 'Mentor',
      cards: [
        {
          label: 'Assigned Batches',
          value: stats.batchCount,
          helper: 'Batches linked to your assignments',
          icon: 'patch.svg',
          moduleId: 'batches',
        },
        {
          label: 'Students in Scope',
          value: stats.studentCount,
          helper: 'Students in your assigned batches',
          icon: 'students.svg',
          moduleId: 'students',
        },
        {
          label: 'Assigned Tasks',
          value: stats.taskCount,
          helper: `${stats.openTaskCount} still open`,
          icon: 'tasks.svg',
          moduleId: 'tasks',
        },
        {
          label: 'Submissions Received',
          value: stats.submissionCount,
          helper: 'Non-draft submissions in scope',
          icon: 'submissions.svg',
          moduleId: 'submissions',
        },
        {
          label: 'Pending Your Review',
          value: stats.pendingMentorReviewCount,
          helper: 'Waiting for mentor review',
          icon: 'reviews.svg',
          moduleId: 'submissions',
        },
        {
          label: 'Class Materials',
          value: stats.classMaterialsCount,
          helper: 'Uploaded notes in your batches',
          icon: 'courses.svg',
          moduleId: 'class-materials',
        },
      ],
      pendingTitle: 'Pending Mentor Actions',
      pendingItems: buildPendingItems(stats, 'mentor'),
      quickActions: [
        { label: 'Mark Attendance', href: '/attendance', moduleId: 'attendance', icon: 'attendance.svg' },
        { label: 'Assign Task', href: '/tasks', moduleId: 'tasks', icon: 'tasks.svg' },
        { label: 'Review Submissions', href: '/task-submissions', moduleId: 'submissions', icon: 'submissions.svg' },
        { label: 'Upload Notes', href: '/class-materials', moduleId: 'class-materials', icon: 'courses.svg' },
      ],
      chartTitle: 'Mentor Batch Performance',
      chartData: [
        { label: 'Attendance', value: stats.attendanceAveragePercent },
        { label: 'Tasks', value: stats.taskCount },
        { label: 'Submissions', value: stats.submissionCount },
        { label: 'Pending Review', value: stats.pendingMentorReviewCount },
      ],
    },
    final_qa: {
      title: `Welcome, ${userName}`,
      subtitle: 'Final QA dashboard with live validation queue counts.',
      badge: 'Final QA',
      cards: [
        {
          label: 'Waiting Validation',
          value: stats.pendingQaCount,
          helper: 'Submissions waiting final QA',
          icon: 'reviews.svg',
          moduleId: 'final_qa',
        },
        {
          label: 'QA Approved',
          value: stats.qaApprovedCount,
          helper: 'Validated submissions',
          icon: 'submissions.svg',
          moduleId: 'final_qa',
        },
        {
          label: 'Revision / Rejected',
          value: stats.revisionCount,
          helper: 'Returned submissions',
          icon: 'reviews.svg',
          moduleId: 'final_qa',
        },
        {
          label: 'Total Submissions',
          value: stats.submissionCount,
          helper: 'All non-draft submissions in scope',
          icon: 'submissions.svg',
          moduleId: 'submissions',
        },
        {
          label: 'HOD Pending',
          value: stats.pendingHodReviewCount,
          helper: 'Still waiting before QA',
          icon: 'reviews.svg',
          moduleId: 'hod_review',
        },
      ],
      pendingTitle: 'Pending Final QA Actions',
      pendingItems: buildPendingItems(stats, 'final_qa'),
      quickActions: [
        { label: 'Validate Submission', href: '/task-submissions', moduleId: 'final_qa', icon: 'reviews.svg' },
        { label: 'View Marks', href: '/marks', moduleId: 'marks', icon: 'submissions.svg' },
        { label: 'View Submissions', href: '/task-submissions', moduleId: 'submissions', icon: 'submissions.svg' },
      ],
      chartTitle: 'Final QA Status',
      chartData: [
        { label: 'Waiting', value: stats.pendingQaCount },
        { label: 'Approved', value: stats.qaApprovedCount },
        { label: 'Revision', value: stats.revisionCount },
        { label: 'Total', value: stats.submissionCount },
      ],
    },
    student: {
      title: `Welcome, ${userName}`,
      subtitle: 'Your personal learning dashboard loaded from your enrolled batch data.',
      badge: 'Student',
      cards: [
        {
          label: 'Attendance',
          value: stats.studentAttendancePercent > 0 ? `${stats.studentAttendancePercent}%` : '—',
          helper: 'Your marked attendance',
          icon: 'attendance.svg',
          moduleId: 'attendance',
        },
        {
          label: 'Pending Tasks',
          value: stats.studentPendingTasks,
          helper: 'Tasks waiting for submission',
          icon: 'tasks.svg',
          moduleId: 'tasks',
        },
        {
          label: 'Submitted Tasks',
          value: stats.studentSubmittedTasks,
          helper: 'Assignments already submitted',
          icon: 'submissions.svg',
          moduleId: 'submissions',
        },
        {
          label: 'Average Mark',
          value: stats.studentAverageMark > 0 ? stats.studentAverageMark : '—',
          helper: 'Average mentor mark received',
          icon: 'reviews.svg',
          moduleId: 'marks',
        },
        {
          label: 'Course Progress',
          value: `${stats.studentTaskProgress}%`,
          helper: 'Submitted tasks vs assigned tasks',
          icon: 'courses.svg',
          moduleId: 'my-courses',
        },
        {
          label: 'Open Complaints',
          value: stats.studentOpenComplaints,
          helper: 'Your active support requests',
          icon: 'admission.svg',
          moduleId: 'complaints',
        },
      ],
      pendingTitle: 'Your Pending Actions',
      pendingItems: buildPendingItems(stats, 'student'),
      quickActions: [
        { label: 'Submit Task', href: '/tasks', moduleId: 'submissions', icon: 'submissions.svg' },
        { label: 'View Attendance', href: '/attendance', moduleId: 'attendance', icon: 'attendance.svg' },
        { label: 'My Courses', href: '/my-courses', moduleId: 'my-courses', icon: 'courses.svg' },
        { label: 'Raise Complaint', href: '/complaints', moduleId: 'complaints', icon: 'admission.svg' },
      ],
      chartTitle: 'My Learning Progress',
      chartData: [
        { label: 'Attendance', value: stats.studentAttendancePercent },
        { label: 'Submitted', value: stats.studentSubmittedTasks },
        { label: 'Pending', value: stats.studentPendingTasks },
        { label: 'Progress', value: stats.studentTaskProgress },
      ],
    },
    placement: {
      title: `Welcome, ${userName}`,
      subtitle: 'Placement view using live student counts until placement records are migrated.',
      badge: 'Placement Cell',
      cards: [
        {
          label: 'Students in Branch',
          value: stats.studentCount,
          helper: 'Active students in selected branch',
          icon: 'students.svg',
          moduleId: 'placement',
        },
        {
          label: 'Active Batches',
          value: stats.batchCount,
          helper: 'Batches available for placement tracking',
          icon: 'patch.svg',
          moduleId: 'batches',
        },
        {
          label: 'Course Completions',
          value: stats.qaApprovedCount,
          helper: 'QA-approved submissions as completion signal',
          icon: 'submissions.svg',
          moduleId: 'placement',
        },
        {
          label: 'Open Complaints',
          value: stats.openComplaintsCount,
          helper: 'Student issues that may affect placement',
          icon: 'admission.svg',
          moduleId: 'complaints',
        },
      ],
      pendingTitle: 'Placement Actions',
      pendingItems: buildPendingItems(stats, 'placement'),
      quickActions: [
        { label: 'View Students', href: '/students', moduleId: 'students', icon: 'students.svg' },
        { label: 'Open Placement', href: '/placement', moduleId: 'placement', icon: 'career.svg' },
        { label: 'View Reports', href: '/reports', moduleId: 'reports', icon: 'analytics.svg' },
      ],
      chartTitle: 'Placement Overview',
      chartData: [
        { label: 'Students', value: stats.studentCount },
        { label: 'Batches', value: stats.batchCount },
        { label: 'QA Approved', value: stats.qaApprovedCount },
        { label: 'Complaints', value: stats.openComplaintsCount },
      ],
    },
  }

  return views[roleKey]
}
