'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useDemoAuth } from '@/lib/demo/auth'
import { demoModules, submissions, tasks, students, batches } from '@/lib/demo/seed'
import type { ModuleId } from '@/lib/demo/types'
import { cn } from '@/lib/utils'

type DashboardRole =
  | 'superadmin'
  | 'admin'
  | 'branch_controller'
  | 'hod'
  | 'mentor'
  | 'final_qa'
  | 'student'
  | 'placement'

type SummaryCard = {
  label: string
  value: string | number
  helper: string
  icon: string
  moduleId?: ModuleId
}

type QuickAction = {
  label: string
  href: string
  moduleId: ModuleId
  icon: string
}

type PendingItem = {
  title: string
  description: string
  badge: string
}

type ChartItem = {
  label: string
  value: number
}

function CustomIcon({
  icon,
  folder,
  alt = '',
  className,
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
      className={cn('h-5 w-5 shrink-0 object-contain', className)}
      onError={(event) => {
        event.currentTarget.src = `/icons/${folder}/dashboard.svg`
      }}
    />
  )
}

function getRoleKey(roleName?: string, roleId?: string): DashboardRole {
  const value = `${roleId || ''} ${roleName || ''}`.toLowerCase()

  if (value.includes('super')) return 'superadmin'
  if (value.includes('branch')) return 'branch_controller'
  if (value.includes('hod') || value.includes('superior')) return 'hod'
  if (value.includes('mentor') || value.includes('mentor')) return 'mentor'
  if (value.includes('final') || value.includes('qa')) return 'final_qa'
  if (value.includes('student')) return 'student'
  if (value.includes('placement')) return 'placement'
  if (value.includes('admin')) return 'admin'

  return 'superadmin'
}

function getBatchCount(mode?: string) {
  if (!mode) return batches.length

  return (batches as any[]).filter((batch) => String(batch.mode || '').toLowerCase() === mode).length
}

function StatCard({ card, iconFolder }: { card: SummaryCard; iconFolder: string }) {
  return (
    <div className="border border-border bg-card p-5 transition hover:border-[#153e90]/40 dark:hover:border-[#6ee75a]/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{card.label}</p>
          <div className="mt-3 text-3xl font-bold tracking-tight">{card.value}</div>
        </div>

        <div className="flex h-11 w-11 items-center justify-center bg-[#153e90]/10 dark:bg-[#6ee75a]/10">
          <CustomIcon icon={card.icon} folder={iconFolder} alt={card.label} />
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{card.helper}</p>
    </div>
  )
}

function MiniChart({
  title,
  data,
  iconFolder,
}: {
  title: string
  data: ChartItem[]
  iconFolder: string
}) {
  const max = Math.max(...data.map((item) => item.value), 1)

  return (
    <div className="border border-border bg-card p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>

        <div className="flex h-9 w-9 items-center justify-center bg-[#153e90]/10 dark:bg-[#6ee75a]/10">
          <CustomIcon icon="analytics.svg" folder={iconFolder} alt="Analytics" />
        </div>
      </div>

      <div className="space-y-4">
        {data.map((item) => {
          const width = `${Math.max((item.value / max) * 100, 8)}%`

          return (
            <div key={item.label}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-semibold">{item.value}</span>
              </div>

              <div className="h-2 bg-muted">
                <div className="h-2 bg-[#153e90] dark:bg-[#6ee75a]" style={{ width }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { role, user, canModule } = useDemoAuth()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const iconFolder = mounted && resolvedTheme === 'light' ? 'light-mode' : 'dark-mode'

  const roleKey = getRoleKey(role?.name, role?.id)
  const visibleModules = demoModules.filter((module) => canModule(module.id))

  const commonAdminCards: SummaryCard[] = [
    {
      label: 'Total Branches',
      value: 5,
      helper: 'Kochi active, future branches ready',
      icon: 'workstream.svg',
      moduleId: 'branches',
    },
    {
      label: 'Total Students',
      value: students.length,
      helper: 'All active academic records',
      icon: 'students.svg',
      moduleId: 'students',
    },
    {
      label: 'Active Batches',
      value: batches.length,
      helper: 'Running online and offline batches',
      icon: 'patch.svg',
      moduleId: 'batches',
    },
    {
      label: 'Online Batches',
      value: getBatchCount('online') || 3,
      helper: 'Zoom integration can support attendance',
      icon: 'workstream.svg',
      moduleId: 'batches',
    },
    {
      label: 'Offline Batches',
      value: getBatchCount('offline') || 2,
      helper: 'Manual attendance required',
      icon: 'attendance.svg',
      moduleId: 'attendance',
    },
    {
      label: 'Pending Approvals',
      value: 12,
      helper: 'Role, batch, and academic approvals',
      icon: 'reviews.svg',
      moduleId: 'roles',
    },
    {
      label: 'Final QA Pending',
      value: submissions.length,
      helper: 'Waiting for final validation',
      icon: 'reviews.svg',
      moduleId: 'final_qa',
    },
    {
      label: 'Open Complaints',
      value: 4,
      helper: 'Student support requests',
      icon: 'admission.svg',
      moduleId: 'complaints',
    },
  ]

  const dashboardData: Record<
    DashboardRole,
    {
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
  > = {
    superadmin: {
      title: `Welcome, ${user?.fullName || 'Chairman'}`,
      subtitle:
        'Full pixlpluzportal system overview across all branches. Super Admin controls roles, branches, permissions, users, reports, and all academic operations.',
      badge: 'Chairman / Super Admin',
      cards: commonAdminCards,
      pendingTitle: 'Today / Pending System Actions',
      pendingItems: [
        {
          title: 'Final QA validation waiting',
          description: 'Several submissions are ready for final score validation and lock.',
          badge: 'Final QA',
        },
        {
          title: 'Branch controller setup',
          description: 'New branch-level admin access can be created and assigned.',
          badge: 'Branch',
        },
        {
          title: 'Open complaints',
          description: 'High priority academic complaints require attention.',
          badge: 'Support',
        },
      ],
      quickActions: [
        { label: 'Create Role', href: '/role-management', moduleId: 'roles', icon: 'workstream.svg' },
        { label: 'Add Branch', href: '/branches', moduleId: 'branches', icon: 'patch.svg' },
        { label: 'Add User', href: '/users', moduleId: 'users', icon: 'users.svg' },
        { label: 'View Reports', href: '/reports', moduleId: 'reports', icon: 'analytics.svg' },
        { label: 'Manage Permissions', href: '/role-management', moduleId: 'roles', icon: 'reviews.svg' },
      ],
      chartTitle: 'System Performance Overview',
      chartData: [
        { label: 'Students', value: students.length },
        { label: 'Batches', value: batches.length },
        { label: 'Tasks', value: tasks.length },
        { label: 'QA Pending', value: submissions.length },
        { label: 'Complaints', value: 4 },
      ],
    },

    admin: {
      title: `Welcome, ${user?.fullName || 'CEO'}`,
      subtitle:
        'Company Admin manages pixlpluzportal operations under Super Admin control. Admin can manage branches, users, reports, and permissions only when allowed.',
      badge: 'CEO / Company Admin',
      cards: commonAdminCards,
      pendingTitle: 'Today / Pending Admin Actions',
      pendingItems: [
        {
          title: 'Branch activity review',
          description: 'Check batch and attendance progress across assigned branches.',
          badge: 'Branches',
        },
        {
          title: 'Pending branch controller actions',
          description: 'Branch admins need approval for new academic setup changes.',
          badge: 'Users',
        },
        {
          title: 'Final QA waiting list',
          description: 'Submissions are pending final QA validation.',
          badge: 'QA',
        },
      ],
      quickActions: [
        { label: 'Create Role', href: '/role-management', moduleId: 'roles', icon: 'workstream.svg' },
        { label: 'Add Branch', href: '/branches', moduleId: 'branches', icon: 'patch.svg' },
        { label: 'Add Branch Controller', href: '/users', moduleId: 'users', icon: 'users.svg' },
        { label: 'View Reports', href: '/reports', moduleId: 'reports', icon: 'analytics.svg' },
        { label: 'Manage Permissions', href: '/role-management', moduleId: 'roles', icon: 'reviews.svg' },
      ],
      chartTitle: 'Company Admin Overview',
      chartData: [
        { label: 'Branches', value: 5 },
        { label: 'Students', value: students.length },
        { label: 'Online Batches', value: getBatchCount('online') || 3 },
        { label: 'Offline Batches', value: getBatchCount('offline') || 2 },
        { label: 'Placements', value: 6 },
      ],
    },

    branch_controller: {
      title: `Welcome, ${user?.fullName || 'Branch Controller'}`,
      subtitle:
        'Branch Controller manages only assigned branch data, including students, mentors, batches, classes, attendance, tasks, and complaints.',
      badge: 'Branch Controller / Branch Admin',
      cards: [
        {
          label: 'Branch Students',
          value: students.length,
          helper: 'Students in assigned branch',
          icon: 'students.svg',
          moduleId: 'students',
        },
        {
          label: 'Branch Mentors',
          value: 8,
          helper: 'Mentors assigned to branch',
          icon: 'mentors.svg',
          moduleId: 'mentors',
        },
        {
          label: 'Active Online Batches',
          value: getBatchCount('online') || 3,
          helper: 'Online classes and Zoom sessions',
          icon: 'workstream.svg',
          moduleId: 'batches',
        },
        {
          label: 'Active Offline Batches',
          value: getBatchCount('offline') || 2,
          helper: 'Offline classroom batches',
          icon: 'patch.svg',
          moduleId: 'batches',
        },
        {
          label: 'Today’s Classes',
          value: 7,
          helper: 'Scheduled sessions today',
          icon: 'courses.svg',
          moduleId: 'batches',
        },
        {
          label: 'Attendance Summary',
          value: '86%',
          helper: 'Average branch attendance',
          icon: 'attendance.svg',
          moduleId: 'attendance',
        },
        {
          label: 'Pending Submissions',
          value: submissions.length,
          helper: 'Waiting for review',
          icon: 'submissions.svg',
          moduleId: 'submissions',
        },
        {
          label: 'Placement Progress',
          value: '62%',
          helper: 'Eligible to placed progress',
          icon: 'career.svg',
          moduleId: 'placement',
        },
      ],
      pendingTitle: 'Today / Pending Branch Actions',
      pendingItems: [
        {
          title: 'Attendance not marked',
          description: 'Offline batch attendance must be marked by mentors.',
          badge: 'Attendance',
        },
        {
          title: 'Tasks pending review',
          description: 'Student submissions are waiting for mentor review.',
          badge: 'Tasks',
        },
        {
          title: 'Students needing attention',
          description: 'Some students have low attendance or delayed submissions.',
          badge: 'Students',
        },
      ],
      quickActions: [
        { label: 'Add Student', href: '/students', moduleId: 'students', icon: 'students.svg' },
        { label: 'Add Mentor', href: '/mentors', moduleId: 'mentors', icon: 'mentors.svg' },
        { label: 'Create Batch', href: '/batches', moduleId: 'batches', icon: 'patch.svg' },
        { label: 'Create Class Session', href: '/batches', moduleId: 'batches', icon: 'courses.svg' },
        { label: 'Assign Task', href: '/tasks', moduleId: 'tasks', icon: 'tasks.svg' },
        { label: 'View Attendance', href: '/attendance', moduleId: 'attendance', icon: 'attendance.svg' },
      ],
      chartTitle: 'Branch Performance',
      chartData: [
        { label: 'Attendance', value: 86 },
        { label: 'Task Completion', value: 72 },
        { label: 'Placement Ready', value: 62 },
        { label: 'Mentor Reviews', value: 54 },
      ],
    },

    hod: {
      title: `Welcome, ${user?.fullName || 'HOD'}`,
      subtitle:
        'HOD  dashboard is focused on mentor monitoring, submission review, marks approval, and student performance issues.',
      badge: 'HOD ',
      cards: [
        {
          label: 'Assigned Mentors',
          value: 6,
          helper: 'Mentors monitored by HOD',
          icon: 'mentors.svg',
          moduleId: 'mentors',
        },
        {
          label: 'Pending HOD Reviews',
          value: submissions.length,
          helper: 'Submissions waiting for HOD review',
          icon: 'reviews.svg',
          moduleId: 'hod_review',
        },
        {
          label: 'Mentor Performance',
          value: '88%',
          helper: 'Average mentor review quality',
          icon: 'analytics.svg',
          moduleId: 'reports',
        },
        {
          label: 'Student Performance Issues',
          value: 5,
          helper: 'Low score or repeated delay cases',
          icon: 'students.svg',
          moduleId: 'students',
        },
        {
          label: 'Tasks Waiting Approval',
          value: 9,
          helper: 'Tasks and marks awaiting review',
          icon: 'tasks.svg',
          moduleId: 'tasks',
        },
        {
          label: 'Revision Requests',
          value: 4,
          helper: 'Returned submissions',
          icon: 'submissions.svg',
          moduleId: 'submissions',
        },
      ],
      pendingTitle: 'Today / Pending HOD Reviews',
      pendingItems: [
        {
          title: 'Submissions waiting for HOD review',
          description: 'Review mentor scores and approve or request revision.',
          badge: 'Review',
        },
        {
          title: 'Mentors with delayed reviews',
          description: 'Some mentors have pending student evaluation work.',
          badge: 'Mentor',
        },
        {
          title: 'Low-performing students',
          description: 'Students need attention based on marks and task status.',
          badge: 'Student',
        },
      ],
      quickActions: [
        { label: 'Review Submission', href: '/hod-review', moduleId: 'hod_review', icon: 'reviews.svg' },
        { label: 'Approve Marks', href: '/marks-evaluation', moduleId: 'marks', icon: 'reviews.svg' },
        { label: 'Request Revision', href: '/task-submissions', moduleId: 'submissions', icon: 'submissions.svg' },
        { label: 'View Mentor Report', href: '/reports', moduleId: 'reports', icon: 'analytics.svg' },
      ],
      chartTitle: 'HOD Monitoring Overview',
      chartData: [
        { label: 'Mentor Reviews', value: 76 },
        { label: 'Approved Marks', value: 58 },
        { label: 'Revision Requests', value: 22 },
        { label: 'Student Issues', value: 18 },
      ],
    },

    mentor: {
      title: `Welcome, ${user?.fullName || 'Mentor'}`,
      subtitle:
        'Mentor dashboard shows only assigned online and offline batches, today’s classes, task review, notes/video uploads, and attendance work.',
      badge: 'Mentor / mentor',
      cards: [
        {
          label: 'Today’s Classes',
          value: 3,
          helper: 'Online and offline sessions today',
          icon: 'courses.svg',
          moduleId: 'batches',
        },
        {
          label: 'Assigned Batches',
          value: 4,
          helper: 'Online and offline batches assigned',
          icon: 'patch.svg',
          moduleId: 'batches',
        },
        {
          label: 'Students Count',
          value: students.length,
          helper: 'Students in assigned batches',
          icon: 'students.svg',
          moduleId: 'students',
        },
        {
          label: 'Tasks Created',
          value: tasks.length,
          helper: 'Created assignments and projects',
          icon: 'tasks.svg',
          moduleId: 'tasks',
        },
        {
          label: 'Pending Reviews',
          value: submissions.length,
          helper: 'Submissions waiting for mentor review',
          icon: 'submissions.svg',
          moduleId: 'submissions',
        },
        {
          label: 'Attendance Pending',
          value: 2,
          helper: 'Offline classes need manual attendance',
          icon: 'attendance.svg',
          moduleId: 'attendance',
        },
        {
          label: 'Average Performance',
          value: '81%',
          helper: 'Average student progress',
          icon: 'analytics.svg',
          moduleId: 'reports',
        },
      ],
      pendingTitle: 'Today / Pending Mentor Actions',
      pendingItems: [
        {
          title: 'Offline attendance pending',
          description: 'Manual attendance is required for offline batches only.',
          badge: 'Offline',
        },
        {
          title: 'Submissions waiting for review',
          description: 'Student submissions need mentor marks and feedback.',
          badge: 'Review',
        },
        {
          title: 'Upload notes or video',
          description: 'Class materials can be uploaded after the session.',
          badge: 'Upload',
        },
      ],
      quickActions: [
        { label: 'Mark Attendance', href: '/attendance', moduleId: 'attendance', icon: 'attendance.svg' },
        { label: 'Create Task', href: '/tasks', moduleId: 'tasks', icon: 'tasks.svg' },
        { label: 'Upload Notes or Videos', href: '/batches', moduleId: 'batches', icon: 'courses.svg' },
        { label: 'Review Submission', href: '/task-submissions', moduleId: 'submissions', icon: 'submissions.svg' },
        { label: 'Upload Marks', href: '/marks-evaluation', moduleId: 'marks', icon: 'reviews.svg' },
      ],
      chartTitle: 'Mentor Batch Performance',
      chartData: [
        { label: 'Attendance', value: 84 },
        { label: 'Submissions', value: 71 },
        { label: 'Marks Uploaded', value: 63 },
        { label: 'Class Materials', value: 92 },
      ],
    },

    final_qa: {
      title: `Welcome, ${user?.fullName || 'Final QA'}`,
      subtitle:
        'Final QA dashboard focuses on final validation, all-stage marks visibility, score locking, rejected cases, and certificate readiness.',
      badge: 'Final QA',
      cards: [
        {
          label: 'Waiting Validation',
          value: submissions.length,
          helper: 'Submissions waiting final QA',
          icon: 'reviews.svg',
          moduleId: 'final_qa',
        },
        {
          label: 'QA Approved',
          value: 18,
          helper: 'Validated submissions',
          icon: 'submissions.svg',
          moduleId: 'final_qa',
        },
        {
          label: 'Rejected / Revision',
          value: 4,
          helper: 'Rejected or revision requested',
          icon: 'reviews.svg',
          moduleId: 'final_qa',
        },
        {
          label: 'Scores Locked',
          value: 15,
          helper: 'Final scores locked',
          icon: 'portfolio.svg',
          moduleId: 'final_qa',
        },
        {
          label: 'Ready for Certificate',
          value: 11,
          helper: 'Students eligible for certificate',
          icon: 'portfolio.svg',
          moduleId: 'certificates',
        },
      ],
      pendingTitle: 'Today / Pending Final QA Actions',
      pendingItems: [
        {
          title: 'Pending final validation',
          description: 'Review mentor and HOD marks before final score lock.',
          badge: 'Validate',
        },
        {
          title: 'Scores waiting to be locked',
          description: 'Approved evaluations can be locked by Final QA.',
          badge: 'Lock',
        },
        {
          title: 'Certificate-ready students',
          description: 'Validated students can move to certificate upload.',
          badge: 'Certificate',
        },
      ],
      quickActions: [
        { label: 'Validate Submission', href: '/final-qa', moduleId: 'final_qa', icon: 'reviews.svg' },
        { label: 'Lock Final Score', href: '/final-qa', moduleId: 'final_qa', icon: 'portfolio.svg' },
        { label: 'View Evaluation History', href: '/marks-evaluation', moduleId: 'marks', icon: 'analytics.svg' },
        { label: 'View All Stage Marks', href: '/marks-evaluation', moduleId: 'marks', icon: 'submissions.svg' },
      ],
      chartTitle: 'Final QA Status',
      chartData: [
        { label: 'Waiting', value: submissions.length },
        { label: 'Approved', value: 18 },
        { label: 'Revision', value: 4 },
        { label: 'Locked', value: 15 },
      ],
    },

    student: {
      title: `Welcome, ${user?.fullName || 'Student'}`,
      subtitle:
        'Student dashboard shows only personal learning data, attendance, pending tasks, submissions, marks, certificate, placement, and complaints.',
      badge: 'Student',
      cards: [
        {
          label: 'Attendance Percentage',
          value: '89%',
          helper: 'Current attendance status',
          icon: 'attendance.svg',
          moduleId: 'attendance',
        },
        {
          label: 'Pending Tasks',
          value: 3,
          helper: 'Tasks waiting for submission',
          icon: 'tasks.svg',
          moduleId: 'tasks',
        },
        {
          label: 'Submitted Tasks',
          value: 8,
          helper: 'Submitted assignments',
          icon: 'submissions.svg',
          moduleId: 'submissions',
        },
        {
          label: 'Marks / Feedback',
          value: '82%',
          helper: 'Average score and mentor feedback',
          icon: 'reviews.svg',
          moduleId: 'marks',
        },
        {
          label: 'Certificate Status',
          value: 'Pending',
          helper: 'Certificate will unlock after completion',
          icon: 'portfolio.svg',
          moduleId: 'certificates',
        },
        {
          label: 'Placement Status',
          value: 'Eligible',
          helper: 'Placement progress status',
          icon: 'career.svg',
          moduleId: 'placement',
        },
        {
          label: 'Complaint Status',
          value: '1 Open',
          helper: 'Support request tracking',
          icon: 'admission.svg',
          moduleId: 'complaints',
        },
      ],
      pendingTitle: 'Today / Pending Student Actions',
      pendingItems: [
        {
          title: 'Upcoming class',
          description: 'Next scheduled session is visible from your batch timeline.',
          badge: 'Class',
        },
        {
          title: 'Pending submission',
          description: 'One task is nearing due date.',
          badge: 'Task',
        },
        {
          title: 'Latest mentor feedback',
          description: 'Review comments are available for your recent submission.',
          badge: 'Feedback',
        },
      ],
      quickActions: [
        { label: 'Submit Task', href: '/task-submissions', moduleId: 'submissions', icon: 'submissions.svg' },
        { label: 'View Attendance', href: '/attendance', moduleId: 'attendance', icon: 'attendance.svg' },
        { label: 'Download Certificate', href: '/certificates', moduleId: 'certificates', icon: 'portfolio.svg' },
        { label: 'Raise Complaint', href: '/complaints', moduleId: 'complaints', icon: 'admission.svg' },
        { label: 'View Feedback', href: '/marks-evaluation', moduleId: 'marks', icon: 'reviews.svg' },
      ],
      chartTitle: 'My Learning Progress',
      chartData: [
        { label: 'Attendance', value: 89 },
        { label: 'Tasks Submitted', value: 74 },
        { label: 'Average Marks', value: 82 },
        { label: 'Course Progress', value: 68 },
      ],
    },

    placement: {
      title: `Welcome, ${user?.fullName || 'Placement Cell'}`,
      subtitle:
        'Placement Cell dashboard tracks eligible students, resume status, interview progress, company details, and placement reports.',
      badge: 'Placement Cell',
      cards: [
        {
          label: 'Eligible Students',
          value: 24,
          helper: 'Students ready for placement process',
          icon: 'students.svg',
          moduleId: 'placement',
        },
        {
          label: 'Resume Submitted',
          value: 19,
          helper: 'Students submitted resumes',
          icon: 'submissions.svg',
          moduleId: 'placement',
        },
        {
          label: 'Resume Approved',
          value: 15,
          helper: 'Approved for company sharing',
          icon: 'reviews.svg',
          moduleId: 'placement',
        },
        {
          label: 'Interviews Scheduled',
          value: 8,
          helper: 'Upcoming interview rounds',
          icon: 'attendance.svg',
          moduleId: 'placement',
        },
        {
          label: 'Students Selected',
          value: 5,
          helper: 'Selected candidates',
          icon: 'career.svg',
          moduleId: 'placement',
        },
        {
          label: 'Students Placed',
          value: 4,
          helper: 'Confirmed placement',
          icon: 'career.svg',
          moduleId: 'placement',
        },
      ],
      pendingTitle: 'Today / Pending Placement Actions',
      pendingItems: [
        {
          title: 'Resume review pending',
          description: 'Review students who submitted updated resumes.',
          badge: 'Resume',
        },
        {
          title: 'Upcoming interviews',
          description: 'Follow up with students and companies.',
          badge: 'Interview',
        },
        {
          title: 'Students ready for company sharing',
          description: 'Eligible students can be shared with hiring partners.',
          badge: 'Eligible',
        },
      ],
      quickActions: [
        { label: 'Update Placement Status', href: '/placement', moduleId: 'placement', icon: 'career.svg' },
        { label: 'Review Resume', href: '/placement', moduleId: 'placement', icon: 'submissions.svg' },
        { label: 'Schedule Interview', href: '/placement', moduleId: 'placement', icon: 'attendance.svg' },
        { label: 'Add Company Details', href: '/placement', moduleId: 'placement', icon: 'workstream.svg' },
        { label: 'Export Placement Report', href: '/reports', moduleId: 'reports', icon: 'analytics.svg' },
      ],
      chartTitle: 'Placement Funnel',
      chartData: [
        { label: 'Eligible', value: 24 },
        { label: 'Resume Approved', value: 15 },
        { label: 'Interviews', value: 8 },
        { label: 'Selected', value: 5 },
        { label: 'Placed', value: 4 },
      ],
    },
  }

  const data = dashboardData[roleKey]

  const visibleCards = data.cards.filter((card) => !card.moduleId || canModule(card.moduleId))
  const visibleActions = data.quickActions.filter((action) => canModule(action.moduleId))

  return (
    <div className="space-y-6">
      <div className="border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">{data.badge}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{data.title}</h1>
            <p className="mt-2 max-w-4xl text-muted-foreground">{data.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleCards.map((card) => (
          <StatCard key={card.label} card={card} iconFolder={iconFolder} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <div className="border border-border bg-card p-5">
            <SectionHeader title={data.pendingTitle} subtitle="Important actions and updates that need attention." />

            <div className="mt-5 space-y-3">
              {data.pendingItems.map((item) => (
                <div key={item.title} className="flex items-start justify-between gap-4 border border-border bg-background p-4">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </div>

                  <span className="shrink-0 bg-[#153e90]/10 px-3 py-1 text-xs font-semibold text-[#153e90] dark:bg-[#6ee75a]/10 dark:text-[#6ee75a]">
                    {item.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <MiniChart title={data.chartTitle} data={data.chartData} iconFolder={iconFolder} />
        </div>

        <div className="space-y-5">
          <div className="border border-border bg-card p-5">
            <SectionHeader title="Quick Actions" subtitle="Actions visible only when permission is enabled." />

            <div className="mt-5 space-y-3">
              {visibleActions.length > 0 ? (
                visibleActions.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="group flex items-center justify-between border border-border bg-background p-4 transition hover:border-[#153e90]/50 dark:hover:border-[#6ee75a]/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center bg-[#153e90]/10 dark:bg-[#6ee75a]/10">
                        <CustomIcon icon={action.icon} folder={iconFolder} alt={action.label} className="h-4 w-4" />
                      </span>

                      <span className="font-semibold">{action.label}</span>
                    </div>

                    <span className="text-xl leading-none text-[#153e90] transition group-hover:translate-x-1 dark:text-[#6ee75a]">
                      ›
                    </span>
                  </Link>
                ))
              ) : (
                <div className="border border-border bg-background p-4 text-sm text-muted-foreground">
                  No quick actions are enabled for this role.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}