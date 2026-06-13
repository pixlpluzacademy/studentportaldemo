export type DemoRoleId =
  | 'superadmin'
  | 'admin'
  | 'branch-controller'
  | 'mentor'
  | 'hod'
  | 'final-qa'
  | 'student'
  | 'placement'

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'assign'
  | 'switch'
  | 'review'
  | 'approve'
  | 'upload'
  | 'export'
  | 'lock'
  | 'submit'
  | 'mark'
  | 'reply'
  | 'resolve'
  | 'download'
  | 'validate'

export type ModuleId =
  | 'dashboard'
  | 'companies'
  | 'departments'
  | 'branches'
  | 'users'
  | 'roles'
  | 'courses'
  | 'my-courses'
  | 'class-materials'
  | 'batches'
  | 'students'
  | 'mentors'
  | 'attendance'
  | 'tasks'
  | 'submissions'
  | 'marks'
  | 'hod_review'
  | 'final_qa'
  | 'placement'
  | 'certificates'
  | 'complaints'
  | 'reports'
  | 'settings'

export type PermissionKey = `${ModuleId}.${PermissionAction}`

export interface DemoModule {
  id: ModuleId
  label: string
  href: string
  description: string
  actions: PermissionAction[]
}

export interface DemoRole {
  id: DemoRoleId | string
  name: string
  level: number
  parentRoleId?: string
  companyScope: 'all' | string
  branchScope: 'all' | string
  status: 'active' | 'inactive'
  createdBy: string
  permissions: PermissionKey[]
  enabledModules: ModuleId[]
}

export interface DemoUser {
  id: string
  fullName: string
  email: string
  password: string
  roleId: string
  companyId?: string
  branchId?: string
  avatar?: string
  status: 'active' | 'inactive'
}
