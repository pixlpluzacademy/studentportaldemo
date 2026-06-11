import type { DemoRole, DemoUser, ModuleId, PermissionKey } from '@/lib/demo/types'

export type ParentRoleId =
  | 'super_admin'
  | 'company_admin'
  | 'branch_admin'
  | 'mentor'
  | 'student'
  | 'placement'

export type AuthSessionState = 'loading' | 'authenticated' | 'unauthenticated'

export type AuthContextValue = {
  user: DemoUser | null
  role: DemoRole | null
  users: DemoUser[]
  roles: DemoRole[]
  sessionState: AuthSessionState
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>
  logout: () => Promise<void>
  can: (permission: PermissionKey | string) => boolean
  canModule: (moduleId: ModuleId) => boolean
  updateRoles: (roles: DemoRole[]) => void
  updateUsers: (users: DemoUser[]) => void
  switchRole: (roleId: string) => void
  refreshSession: () => Promise<void>
}

export type ProfileRow = {
  id: string
  full_name: string
  email: string
  parent_role_id: ParentRoleId
  branch_id: string | null
  status: 'active' | 'inactive'
  avatar_url: string | null
}

export type PermissionProfileRow = {
  id: string
  slug: string
  name: string
  parent_role_id: ParentRoleId
  status: 'active' | 'inactive'
}
