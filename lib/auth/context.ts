import type { SupabaseClient } from '@supabase/supabase-js'
import type { DemoRole, DemoUser } from '@/lib/demo/types'
import { enabledModulesFromPermissions } from '@/lib/auth/modules'
import type { ParentRoleId, PermissionProfileRow, ProfileRow } from '@/lib/auth/types'
import { fetchPermissionProfiles, mapProfilesToDemoRoles } from '@/lib/data/permissions'

type PermissionJoinRow = {
  permission_key: string
}

function mapProfileToUser(
  profile: ProfileRow,
  profileSlug: string,
  branchIds: string[],
): DemoUser {
  const hasAllBranches =
    profile.parent_role_id === 'super_admin' ||
    profile.parent_role_id === 'company_admin'

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    roleId: legacyRoleIdFromSlug(profileSlug),
    companyId: 'c1',
    branchId: hasAllBranches ? 'all' : branchIds[0] || profile.branch_id || undefined,
    avatar: profile.avatar_url || undefined,
    status: profile.status,
  }
}

function legacyRoleIdFromSlug(slug: string): string {
  const map: Record<string, string> = {
    super_admin_full: 'superadmin',
    company_admin_default: 'admin',
    branch_admin_default: 'branch-controller',
    mentor_trainer: 'mentor',
    mentor_hod: 'hod',
    mentor_final_qa: 'final-qa',
    student_default: 'student',
    placement_default: 'placement',
  }
  return map[slug] || slug
}

function mapPermissionProfileToRole(
  permissionProfile: PermissionProfileRow,
  permissions: string[],
): DemoRole {
  return {
    id: legacyRoleIdFromSlug(permissionProfile.slug),
    name: permissionProfile.name,
    level: 1,
    parentRoleId: permissionProfile.parent_role_id,
    companyScope: 'c1',
    branchScope: 'b1',
    status: permissionProfile.status,
    createdBy: 'system',
    permissions: permissions as DemoRole['permissions'],
    enabledModules: enabledModulesFromPermissions(permissions),
  }
}

export async function loadAuthContext(supabase: SupabaseClient) {
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return {
      user: null,
      role: null,
      users: [] as DemoUser[],
      roles: [] as DemoRole[],
      permissions: [] as string[],
      parentRoleId: null as ParentRoleId | null,
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, parent_role_id, branch_id, status, avatar_url')
    .eq('id', authUser.id)
    .single()

  if (profileError || !profile) {
    return {
      user: null,
      role: null,
      users: [] as DemoUser[],
      roles: [] as DemoRole[],
      permissions: [] as string[],
      parentRoleId: null as ParentRoleId | null,
    }
  }

  const { data: userProfileLink } = await supabase
    .from('user_permission_profiles')
    .select('profile_id, permission_profiles(id, slug, name, parent_role_id, status)')
    .eq('user_id', authUser.id)
    .eq('is_primary', true)
    .maybeSingle()

  const permissionProfile = userProfileLink?.permission_profiles as PermissionProfileRow | null
  const profileSlug = permissionProfile?.slug || profile.parent_role_id

  let permissions: string[] = []

  if (permissionProfile?.id) {
    const { data: permissionRows } = await supabase
      .from('profile_permissions')
      .select('permissions(permission_key)')
      .eq('profile_id', permissionProfile.id)

    permissions =
      permissionRows
        ?.map((row) => (row.permissions as PermissionJoinRow | null)?.permission_key)
        .filter(Boolean) as string[] || []
  }

  if (profile.parent_role_id === 'super_admin') {
    const { data: allPermissions } = await supabase.from('permissions').select('permission_key')
    permissions = allPermissions?.map((p) => p.permission_key) || permissions
  }

  const { data: branchRows } = await supabase
    .from('user_branch_assignments')
    .select('branch_id')
    .eq('user_id', authUser.id)

  const branchIds = branchRows?.map((row) => row.branch_id) || []
  const mappedUser = mapProfileToUser(profile as ProfileRow, profileSlug, branchIds)
  const mappedRole = permissionProfile
    ? mapPermissionProfileToRole(permissionProfile, permissions)
    : mapPermissionProfileToRole(
        {
          id: profile.id,
          slug: profile.parent_role_id,
          name: profile.parent_role_id,
          parent_role_id: profile.parent_role_id as ParentRoleId,
          status: profile.status,
        },
        permissions,
      )

  let users: DemoUser[] = []
  let roles: DemoRole[] = []

  if (permissions.includes('users.view') || profile.parent_role_id === 'super_admin') {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name, email, parent_role_id, branch_id, status, avatar_url')
      .order('full_name')

    users =
      profileRows?.map((row) =>
        mapProfileToUser(row as ProfileRow, row.parent_role_id, branchIds),
      ) || []
  }

  if (permissions.includes('roles.view') || profile.parent_role_id === 'super_admin') {
    const profileResult = await fetchPermissionProfiles(supabase)
    roles = mapProfilesToDemoRoles(profileResult.data)
  }

  return {
    user: mappedUser,
    role: mappedRole,
    users,
    roles,
    permissions,
    parentRoleId: profile.parent_role_id as ParentRoleId,
  }
}
