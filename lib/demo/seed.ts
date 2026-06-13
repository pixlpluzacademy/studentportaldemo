import { DEFAULT_COMPANY_NAME, demoEmail } from '@/lib/branding'
import type { DemoModule, DemoRole, DemoUser, ModuleId, PermissionAction, PermissionKey } from './types'

export const permissionActions: PermissionAction[] = [
  'view',
  'create',
  'edit',
  'delete',
  'assign',
  'review',
  'approve',
  'upload',
  'export',
  'lock',
  'submit',
  'mark',
  'reply',
  'resolve',
  'download',
  'validate',
]

export const demoModules: DemoModule[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', description: 'Overview, KPIs, quick activity and branch health.', actions: ['view'] },
  { id: 'departments', label: 'Departments', href: '/departments', description: 'Skill areas / specializations linking courses and eligible mentors.', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'branches', label: 'Branches', href: '/branches', description: 'Branch setup and branch controller allocation.', actions: ['view', 'create', 'edit', 'delete', 'assign', 'switch'] },
  { id: 'users', label: 'Users', href: '/users', description: 'Create users and assign roles, company and branch scope.', actions: ['view', 'create', 'edit', 'delete', 'assign'] },
  { id: 'roles', label: 'Role Management', href: '/role-management', description: 'CRM style role builder with module and action permissions.', actions: ['view', 'create', 'edit', 'delete', 'assign'] },
  { id: 'courses', label: 'Courses', href: '/courses', description: 'Course blueprint, curriculum, tracks, tools and tasks.', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'my-courses', label: 'Course Overview', href: '/my-courses', description: 'Student and mentor course view with syllabus, tasks, attendance, submissions and marks.', actions: ['view'] },
  { id: 'class-materials', label: 'Class Materials', href: '/class-materials', description: 'Daily class notes, videos, references and learning resources.', actions: ['view', 'upload', 'edit', 'delete', 'download'] },
  { id: 'batches', label: 'Batches', href: '/batches', description: 'Online/offline batches, seats, timing and mentor assignment.', actions: ['view', 'create', 'edit', 'delete', 'assign'] },
  { id: 'students', label: 'Students', href: '/students', description: 'Student records, batch allocation and academic status.', actions: ['view', 'create', 'edit', 'delete', 'assign'] },
  { id: 'mentors', label: 'Mentors / mentors', href: '/mentors', description: 'mentor directory, department and HOD assignment.', actions: ['view', 'create', 'edit', 'delete', 'assign'] },
  { id: 'attendance', label: 'Attendance', href: '/attendance', description: 'Class attendance marking and percentage tracking.', actions: ['view', 'mark', 'edit', 'export'] },
  { id: 'tasks', label: 'Tasks', href: '/tasks', description: 'Assignment and task creation for batches or students.', actions: ['view', 'create', 'edit', 'delete', 'assign'] },
  { id: 'submissions', label: 'Task Submissions', href: '/task-submissions', description: 'Student submissions, files, status and mentor review.', actions: ['view', 'submit', 'review', 'approve', 'edit', 'delete'] },
  { id: 'marks', label: 'Marks / Evaluation', href: '/marks', description: 'Mentor marks, HOD score, QA score and final score.', actions: ['view', 'upload', 'edit', 'approve', 'export'] },
  { id: 'hod_review', label: 'HOD Review', href: '/hod-review', description: 'Superior mentor review of submissions and mentor scoring.', actions: ['view', 'review', 'approve', 'edit'] },
  { id: 'final_qa', label: 'Final QA', href: '/final-qa', description: 'Final validation, QA comments and score locking.', actions: ['view', 'validate', 'lock', 'approve', 'export'] },
  { id: 'placement', label: 'Placement', href: '/placement', description: 'Placement readiness, resume status, interviews and offers.', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { id: 'certificates', label: 'Certificates', href: '/certificates', description: 'Manual certificate upload, issue date and student download.', actions: ['view', 'upload', 'download', 'edit', 'delete'] },
  { id: 'complaints', label: 'Complaints', href: '/complaints', description: 'Student complaints, replies, priorities and resolution.', actions: ['view', 'create', 'reply', 'resolve', 'edit'] },
  { id: 'reports', label: 'Reports', href: '/reports', description: 'Academic, attendance, placement and branch reports.', actions: ['view', 'export'] },
  { id: 'settings', label: 'Settings', href: '/settings', description: 'Profile, theme and demo portal settings.', actions: ['view', 'edit'] },
]

const allModuleIds = demoModules.map((module) => module.id)

const permissionsForModules = (
  moduleIds: ModuleId[],
  only?: Partial<Record<ModuleId, PermissionAction[]>>,
): PermissionKey[] => {
  return moduleIds.flatMap((id) => {
    const module = demoModules.find((item) => item.id === id)!
    const actions = only?.[id] || module.actions
    return actions.map((action) => `${id}.${action}` as PermissionKey)
  })
}

export const defaultRoles: DemoRole[] = [
  {
    id: 'superadmin',
    name: 'Super Admin',
    level: 1,
    companyScope: 'all',
    branchScope: 'all',
    status: 'active',
    createdBy: 'system',
    enabledModules: allModuleIds,
    permissions: permissionsForModules(allModuleIds),
  },
  {
    id: 'admin',
    name: 'Admin',
    level: 2,
    parentRoleId: 'superadmin',
    companyScope: 'c1',
    branchScope: 'all',
    status: 'active',
    createdBy: 'superadmin',
    enabledModules: allModuleIds.filter((id) => !['final_qa'].includes(id)),
    permissions: permissionsForModules(
      allModuleIds.filter((id) => !['final_qa'].includes(id)),
      {
        roles: ['view', 'create', 'edit', 'assign'],
        reports: ['view', 'export'],
        settings: ['view', 'edit'],
      },
    ),
  },
  {
    id: 'branch-controller',
    name: 'Branch Admin',
    level: 3,
    parentRoleId: 'admin',
    companyScope: 'c1',
    branchScope: 'b1',
    status: 'active',
    createdBy: 'admin',
    enabledModules: [
      'dashboard',
      'branches',
      'departments',
      'users',
      'courses',
      'my-courses',
      'class-materials',
      'batches',
      'students',
      'mentors',
      'attendance',
      'tasks',
      'submissions',
      'marks',
      'hod_review',
      'placement',
      'certificates',
      'complaints',
      'reports',
      'settings',
    ],
    permissions: permissionsForModules(
      [
        'dashboard',
        'branches',
        'departments',
        'users',
        'courses',
        'my-courses',
        'class-materials',
        'batches',
        'students',
        'mentors',
        'attendance',
        'tasks',
        'submissions',
        'marks',
        'hod_review',
        'placement',
        'certificates',
        'complaints',
        'reports',
        'settings',
      ],
      {
        branches: ['view', 'create', 'edit', 'delete', 'assign'],
        departments: ['view', 'create', 'edit', 'delete'],
        users: ['view', 'create', 'edit', 'assign'],
        'my-courses': ['view'],
        'class-materials': ['view', 'upload', 'edit', 'delete'],
        batches: ['view', 'create', 'edit', 'delete', 'assign'],
        reports: ['view', 'export'],
        settings: ['view'],
      },
    ),
  },
  {
    id: 'mentor',
    name: 'Mentor',
    level: 4,
    parentRoleId: 'branch-controller',
    companyScope: 'c1',
    branchScope: 'b1',
    status: 'active',
    createdBy: 'branch-controller',
    enabledModules: [
      'dashboard',
      'my-courses',
      'class-materials',
      'batches',
      'students',
      'attendance',
      'tasks',
      'submissions',
      'marks',
      'complaints',
      'settings',
    ],
    permissions: permissionsForModules(
      [
        'dashboard',
        'my-courses',
        'class-materials',
        'batches',
        'students',
        'attendance',
        'tasks',
        'submissions',
        'marks',
        'complaints',
        'settings',
      ],
      {
        'my-courses': ['view'],
        'class-materials': ['view', 'upload', 'edit', 'delete'],
        batches: ['view'],
        students: ['view'],
        attendance: ['view', 'mark'],
        tasks: ['view', 'create', 'edit', 'assign'],
        submissions: ['view', 'review', 'approve'],
        marks: ['view', 'upload'],
        complaints: ['view', 'reply'],
        settings: ['view'],
      },
    ),
  },
  {
    id: 'hod',
    name: 'HOD',
    level: 4,
    parentRoleId: 'branch-controller',
    companyScope: 'c1',
    branchScope: 'b1',
    status: 'active',
    createdBy: 'branch-controller',
    enabledModules: [
      'dashboard',
      'my-courses',
      'class-materials',
      'batches',
      'mentors',
      'students',
      'tasks',
      'submissions',
      'marks',
      'hod_review',
      'complaints',
      'reports',
      'settings',
    ],
    permissions: permissionsForModules(
      [
        'dashboard',
        'my-courses',
        'class-materials',
        'batches',
        'mentors',
        'students',
        'tasks',
        'submissions',
        'marks',
        'hod_review',
        'complaints',
        'reports',
        'settings',
      ],
      {
        'my-courses': ['view'],
        'class-materials': ['view', 'upload', 'edit', 'delete'],
        batches: ['view'],
        mentors: ['view'],
        students: ['view'],
        tasks: ['view'],
        submissions: ['view', 'review'],
        marks: ['view', 'edit', 'approve'],
        hod_review: ['view', 'review', 'approve', 'edit'],
        complaints: ['view', 'reply', 'resolve'],
        reports: ['view'],
        settings: ['view'],
      },
    ),
  },
  {
    id: 'final-qa',
    name: 'Final QA',
    level: 4,
    parentRoleId: 'branch-controller',
    companyScope: 'c1',
    branchScope: 'b1',
    status: 'active',
    createdBy: 'branch-controller',
    enabledModules: [
      'dashboard',
      'submissions',
      'marks',
      'final_qa',
      'certificates',
      'reports',
      'settings',
    ],
    permissions: permissionsForModules(
      [
        'dashboard',
        'submissions',
        'marks',
        'final_qa',
        'certificates',
        'reports',
        'settings',
      ],
      {
        submissions: ['view'],
        marks: ['view'],
        final_qa: ['view', 'validate', 'lock', 'approve'],
        certificates: ['view'],
        reports: ['view', 'export'],
        settings: ['view'],
      },
    ),
  },
  {
    id: 'student',
    name: 'Student',
    level: 5,
    parentRoleId: 'branch-controller',
    companyScope: 'c1',
    branchScope: 'b1',
    status: 'active',
    createdBy: 'branch-controller',
    enabledModules: [
      'dashboard',
      'my-courses',
      'class-materials',
      'attendance',
      'tasks',
      'submissions',
      'marks',
      'certificates',
      'complaints',
      'settings',
    ],
    permissions: permissionsForModules(
      [
        'dashboard',
        'my-courses',
        'class-materials',
        'attendance',
        'tasks',
        'submissions',
        'marks',
        'certificates',
        'complaints',
        'settings',
      ],
      {
        'my-courses': ['view'],
        'class-materials': ['view', 'download'],
        attendance: ['view'],
        tasks: ['view'],
        submissions: ['view', 'submit'],
        marks: ['view'],
        certificates: ['view', 'download'],
        complaints: ['view', 'create', 'reply'],
        settings: ['view', 'edit'],
      },
    ),
  },
  {
    id: 'placement',
    name: 'Placement Cell',
    level: 4,
    parentRoleId: 'branch-controller',
    companyScope: 'c1',
    branchScope: 'b1',
    status: 'active',
    createdBy: 'branch-controller',
    enabledModules: [
      'dashboard',
      'students',
      'placement',
      'reports',
      'settings',
    ],
    permissions: permissionsForModules(
      [
        'dashboard',
        'students',
        'placement',
        'reports',
        'settings',
      ],
      {
        students: ['view'],
        placement: ['view', 'create', 'edit', 'export'],
        reports: ['view', 'export'],
        settings: ['view'],
      },
    ),
  },
]

export const defaultUsers: DemoUser[] = [
  { id: 'u1', fullName: 'Super Admin', email: demoEmail('superadmin'), password: 'demo123', roleId: 'superadmin', companyId: 'all', branchId: 'all', status: 'active' },
  { id: 'u2', fullName: 'Ananya Menon', email: demoEmail('admin'), password: 'demo123', roleId: 'admin', companyId: 'c1', branchId: 'all', status: 'active' },
  { id: 'u3', fullName: 'Rohit Nair', email: demoEmail('branch'), password: 'demo123', roleId: 'branch-controller', companyId: 'c1', branchId: 'b1', status: 'active' },
  { id: 'u4', fullName: 'Nisha Varghese', email: demoEmail('mentor'), password: 'demo123', roleId: 'mentor', companyId: 'c1', branchId: 'b1', status: 'active' },
  { id: 'u5', fullName: 'Arjun Das', email: demoEmail('hod'), password: 'demo123', roleId: 'hod', companyId: 'c1', branchId: 'b1', status: 'active' },
  { id: 'u6', fullName: 'Maya Joseph', email: demoEmail('qa'), password: 'demo123', roleId: 'final-qa', companyId: 'c1', branchId: 'b1', status: 'active' },
  { id: 'u7', fullName: 'Akhil Suresh', email: demoEmail('student'), password: 'demo123', roleId: 'student', companyId: 'c1', branchId: 'b1', status: 'active' },
  { id: 'u8', fullName: 'Farah Khan', email: demoEmail('placement'), password: 'demo123', roleId: 'placement', companyId: 'c1', branchId: 'b1', status: 'active' },
]

export const companies = [
  { id: 'c1', name: DEFAULT_COMPANY_NAME, location: 'Kochi, Kerala', branches: 2, status: 'Active' },
  { id: 'c2', name: 'pixlpluzportal ', location: 'Dubai, UAE', branches: 1, status: 'Planning' },
]

export const branches = [
  { id: 'b1', companyId: 'c1', name: 'Kochi Main Branch', controller: 'Rohit Nair', students: 68, batches: 5, status: 'Active' },
  { id: 'b2', companyId: 'c1', name: 'Calicut Satellite', controller: 'To be assigned', students: 18, batches: 2, status: 'Upcoming' },
  { id: 'b3', companyId: 'c2', name: 'Dubai Training Hub', controller: 'To be assigned', students: 0, batches: 0, status: 'Planning' },
]

export const courses = [
  { id: 'co1', name: 'Digital Marketing', track: 'Professional', duration: '1 Month', tools: 'Meta Ads, GA4, Canva', tasks: 12, status: 'Active' },
  { id: 'co2', name: '3D Visualization', track: 'Advanced', duration: '2 Months', tools: '3ds Max, V-Ray, Corona', tasks: 16, status: 'Active' },
  { id: 'co3', name: 'Website Development', track: 'Basic + Internship', duration: '4 Months', tools: 'Next.js, Supabase, Tailwind', tasks: 24, status: 'Active' },
]

export const batches = [
  { id: 'ba1', name: 'DM Morning Batch', course: 'Digital Marketing', mentor: 'Nisha Varghese', mode: 'Offline', time: '7:00 AM', seats: '16/20', status: 'Active' },
  { id: 'ba2', name: 'Web Evening Batch', course: 'Website Development', mentor: 'Nisha Varghese', mode: 'Online', time: '7:30 PM', seats: '13/20', status: 'Active' },
  { id: 'ba3', name: '3D Weekend Batch', course: '3D Visualization', mentor: 'Rahul Mathew', mode: 'Offline', time: '10:00 AM', seats: '20/20', status: 'Full' },
]

export const students = [
  { id: 's1', name: 'Akhil Suresh', course: 'Digital Marketing', batch: 'DM Morning Batch', attendance: '92%', grade: 'A', placement: 'Eligible', status: 'Active' },
  { id: 's2', name: 'Sneha Raj', course: 'Website Development', batch: 'Web Evening Batch', attendance: '88%', grade: 'B+', placement: 'Not Started', status: 'Active' },
  { id: 's3', name: 'Mohammed Adil', course: '3D Visualization', batch: '3D Weekend Batch', attendance: '96%', grade: 'A+', placement: 'Interviewing', status: 'Active' },
]

export const mentors = [
  { id: 'm1', name: 'Nisha Varghese', department: 'Digital Marketing', hod: 'Arjun Das', batches: 2, rating: '4.8', status: 'Active' },
  { id: 'm2', name: 'Rahul Mathew', department: '3D Visualization', hod: 'Arjun Das', batches: 1, rating: '4.7', status: 'Active' },
  { id: 'm3', name: 'Devika Iyer', department: 'Web Development', hod: 'Arjun Das', batches: 1, rating: '4.6', status: 'Active' },
]

export const attendance = [
  { id: 'a1', date: '2026-06-01', batch: 'DM Morning Batch', session: 'Meta Ads Campaign Structure', markedBy: 'Nisha Varghese', present: 15, absent: 1, late: 2, status: 'Marked' },
  { id: 'a2', date: '2026-06-01', batch: 'Web Evening Batch', session: 'Next.js App Router', markedBy: 'Devika Iyer', present: 12, absent: 1, late: 0, status: 'Marked' },
  { id: 'a3', date: '2026-06-02', batch: '3D Weekend Batch', session: 'Interior Lighting Setup', markedBy: 'Rahul Mathew', present: 0, absent: 0, late: 0, status: 'Pending' },
]

export const tasks = [
  { id: 't1', title: 'Create Meta Ads Funnel Plan', course: 'Digital Marketing', batch: 'DM Morning Batch', assignedBy: 'Nisha Varghese', due: '2026-06-05', submissions: '13/16', status: 'Open' },
  { id: 't2', title: 'Build Portfolio Landing Page', course: 'Website Development', batch: 'Web Evening Batch', assignedBy: 'Devika Iyer', due: '2026-06-07', submissions: '8/13', status: 'Open' },
  { id: 't3', title: 'Render Bedroom Interior Scene', course: '3D Visualization', batch: '3D Weekend Batch', assignedBy: 'Rahul Mathew', due: '2026-06-09', submissions: '18/20', status: 'Review' },
]

export const submissions = [
  { id: 'sub1', student: 'Akhil Suresh', task: 'Create Meta Ads Funnel Plan', mentor: 'Nisha Varghese', submitted: '2026-06-01', status: 'Mentor Reviewed', mentorScore: 82, hodStatus: 'Pending', qaStatus: 'Waiting' },
  { id: 'sub2', student: 'Sneha Raj', task: 'Build Portfolio Landing Page', mentor: 'Devika Iyer', submitted: '2026-06-01', status: 'Submitted', mentorScore: '-', hodStatus: 'Waiting', qaStatus: 'Waiting' },
  { id: 'sub3', student: 'Mohammed Adil', task: 'Render Bedroom Interior Scene', mentor: 'Rahul Mathew', submitted: '2026-05-31', status: 'HOD Reviewed', mentorScore: 88, hodStatus: 'Approved', qaStatus: 'Pending' },
]

export const placements = [
  { id: 'p1', student: 'Mohammed Adil', course: '3D Visualization', resume: 'Approved', company: 'BlackWhite Visualization', interview: '2026-06-08', status: 'Interviewing' },
  { id: 'p2', student: 'Akhil Suresh', course: 'Digital Marketing', resume: 'Submitted', company: 'Lathief Production', interview: 'Not Scheduled', status: 'Eligible' },
  { id: 'p3', student: 'Sneha Raj', course: 'Website Development', resume: 'Pending', company: '-', interview: '-', status: 'Not Started' },
]

export const certificates = [
  { id: 'cer1', student: 'Akhil Suresh', course: 'Digital Marketing', title: 'Professional Digital Marketing Certificate', issueDate: 'Pending', status: 'Pending' },
  { id: 'cer2', student: 'Mohammed Adil', course: '3D Visualization', title: 'Advanced 3D Visualization Certificate', issueDate: '2026-05-28', status: 'Issued' },
]

export const complaints = [
  { id: 'cm1', student: 'Akhil Suresh', category: 'Academic', subject: 'Need more time for campaign task', priority: 'Medium', assignedTo: 'Arjun Das', status: 'In Review' },
  { id: 'cm2', student: 'Sneha Raj', category: 'Platform', subject: 'Unable to upload file', priority: 'High', assignedTo: 'Rohit Nair', status: 'Open' },
]