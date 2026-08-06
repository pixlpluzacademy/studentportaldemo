import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataResult } from '@/lib/data/config'
import { assignUserPermissionProfile } from '@/lib/data/permissions'
import { createClient } from '@/lib/supabase/client'

export type UserUiStatus = 'active' | 'inactive'

export type UserListRow = {
  id: string
  full_name: string
  email: string
  status: UserUiStatus
  branch_id: string | null
  branch_ids: string[]
  branch_name: string
  parent_role_id: string
  parent_role_name: string
  permission_profile_id: string | null
  permission_profile_name: string
  permission_profile_slug: string | null
  avatar_url: string | null
}

export type UserDetailRow = UserListRow & {
  created_at: string
  updated_at: string
}

export function isSuperAdminUserRow(
  item: Pick<UserListRow, 'permission_profile_slug' | 'parent_role_id'>,
) {
  return item.permission_profile_slug === 'super_admin_full' || item.parent_role_id === 'super_admin'
}

export function canManageDirectoryUser(
  item: Pick<UserListRow, 'permission_profile_slug' | 'parent_role_id'>,
  actorParentRoleId?: string | null,
) {
  if (!isSuperAdminUserRow(item)) return true
  return actorParentRoleId === 'super_admin'
}

/** Super Admin profiles are visible only to Super Admin actors. */
export function canViewDirectoryUser(
  item: Pick<UserListRow, 'permission_profile_slug' | 'parent_role_id'>,
  actorParentRoleId?: string | null,
) {
  return canManageDirectoryUser(item, actorParentRoleId)
}

export function sortUsersByParentRoleHierarchy(
  users: UserListRow[],
  parentRoles: Array<{ id: string; level: number }>,
): UserListRow[] {
  const levelByRole = new Map(parentRoles.map((role) => [role.id, role.level]))

  return [...users].sort((a, b) => {
    const levelA = levelByRole.get(a.parent_role_id) ?? Number.MAX_SAFE_INTEGER
    const levelB = levelByRole.get(b.parent_role_id) ?? Number.MAX_SAFE_INTEGER

    if (levelA !== levelB) return levelA - levelB

    return a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' })
  })
}

export type UserFormInput = {
  full_name: string
  email: string
  permission_profile_id: string
  branch_id: string | null
  status: UserUiStatus
}

type DbProfileRow = {
  id: string
  full_name: string
  email: string
  parent_role_id: string
  branch_id: string | null
  status: UserUiStatus
  avatar_url: string | null
  parent_role: { id: string; name: string } | { id: string; name: string }[] | null
  user_permission_profiles:
    | Array<{
        is_primary: boolean
        permission_profiles: {
          id: string
          slug: string
          name: string
          parent_role_id: string
        } | null
      }>
    | null
  user_branch_assignments: Array<{ branch_id: string }> | null
}

const userSelect = `
  id,
  full_name,
  email,
  parent_role_id,
  branch_id,
  status,
  avatar_url,
  parent_role:parent_roles!profiles_parent_role_id_fkey (
    id,
    name
  ),
  user_permission_profiles (
    is_primary,
    permission_profiles (
      id,
      slug,
      name,
      parent_role_id
    )
  ),
  user_branch_assignments (
    branch_id
  )
`

const userDetailSelect = `
  ${userSelect.trim()},
  created_at,
  updated_at
`

function unwrapParentRole(
  parentRole: DbProfileRow['parent_role'],
): { id: string; name: string } | null {
  if (!parentRole) return null
  return Array.isArray(parentRole) ? parentRole[0] || null : parentRole
}

function primaryPermissionProfile(row: DbProfileRow) {
  const links = row.user_permission_profiles || []
  const primary =
    links.find((link) => link.is_primary)?.permission_profiles ||
    links[0]?.permission_profiles ||
    null

  if (primary && !Array.isArray(primary)) {
    return primary
  }

  return null
}

function mapDbProfileToListRow(
  row: DbProfileRow,
  branchNameMap: Map<string, string>,
): UserListRow {
  const profile = primaryPermissionProfile(row)
  const branchIds = Array.from(
    new Set([
      ...(row.branch_id ? [row.branch_id] : []),
      ...(row.user_branch_assignments || []).map((item) => item.branch_id),
    ]),
  )

  const primaryBranchId = row.branch_id || branchIds[0] || null
  const parentRole = unwrapParentRole(row.parent_role)

  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    status: row.status,
    branch_id: primaryBranchId,
    branch_ids: branchIds,
    branch_name: primaryBranchId
      ? branchNameMap.get(primaryBranchId) || 'Assigned branch'
      : row.parent_role_id === 'super_admin' || row.parent_role_id === 'company_admin'
        ? 'All Branches'
        : 'Not assigned',
    parent_role_id: profile?.parent_role_id || row.parent_role_id,
    parent_role_name: parentRole?.name || row.parent_role_id,
    permission_profile_id: profile?.id || null,
    permission_profile_name: profile?.name || 'Not assigned',
    permission_profile_slug: profile?.slug || null,
    avatar_url: row.avatar_url,
  }
}

export function userMatchesBranch(user: UserListRow, branchId?: string | null) {
  if (!branchId) return true
  if (user.parent_role_id === 'super_admin' || user.parent_role_id === 'company_admin') {
    return true
  }
  if (user.branch_id === branchId) return true
  return user.branch_ids.includes(branchId)
}

export async function fetchUserList(
  branchId?: string | null,
  branchNameMap?: Map<string, string>,
  supabase?: SupabaseClient,
): Promise<DataResult<UserListRow[]>> {
  const client = supabase ?? createClient()

  try {
    const { data, error } = await client.from('profiles').select(userSelect).order('full_name')

    if (error) {
      return { source: 'supabase', data: [], error: error.message }
    }

    const names =
      branchNameMap ||
      new Map<string, string>(
        (
          await client.from('branches').select('id, name')
        ).data?.map((branch) => [branch.id, branch.name]) || [],
      )

    let rows = (data as DbProfileRow[]).map((row) => mapDbProfileToListRow(row, names))

    if (branchId) {
      rows = rows.filter((row) => userMatchesBranch(row, branchId))
    }

    return { source: 'supabase', data: rows }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load users.',
    }
  }
}

export async function fetchUserById(
  userId: string,
  branchNameMap?: Map<string, string>,
  supabase?: SupabaseClient,
): Promise<DataResult<UserDetailRow | null>> {
  const client = supabase ?? createClient()

  try {
    const { data, error } = await client
      .from('profiles')
      .select(userDetailSelect)
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      return { source: 'supabase', data: null, error: error.message }
    }

    if (!data) {
      return { source: 'supabase', data: null }
    }

    const names =
      branchNameMap ||
      new Map<string, string>(
        (
          await client.from('branches').select('id, name')
        ).data?.map((branch) => [branch.id, branch.name]) || [],
      )

    const row = data as DbProfileRow & { created_at: string; updated_at: string }
    const mapped = mapDbProfileToListRow(row, names)

    return {
      source: 'supabase',
      data: {
        ...mapped,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    }
  } catch (error) {
    return {
      source: 'supabase',
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load user.',
    }
  }
}

async function syncUserBranchAssignment(
  client: SupabaseClient,
  userId: string,
  branchId: string | null,
) {
  await client.from('user_branch_assignments').delete().eq('user_id', userId)

  if (branchId) {
    await client.from('user_branch_assignments').insert({
      user_id: userId,
      branch_id: branchId,
    })
  }
}

async function assertCanManageUser(
  client: SupabaseClient,
  targetUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    data: { user },
  } = await client.auth.getUser()

  if (!user) {
    return { ok: false, error: 'Unauthorized.' }
  }

  const { data: targetProfile, error: targetError } = await client
    .from('profiles')
    .select('parent_role_id')
    .eq('id', targetUserId)
    .maybeSingle()

  if (targetError || !targetProfile) {
    return { ok: false, error: targetError?.message || 'User not found.' }
  }

  if (targetProfile.parent_role_id !== 'super_admin') {
    return { ok: true }
  }

  const { data: actorProfile } = await client
    .from('profiles')
    .select('parent_role_id')
    .eq('id', user.id)
    .maybeSingle()

  if (actorProfile?.parent_role_id === 'super_admin') {
    return { ok: true }
  }

  return { ok: false, error: 'Only Super Admin can manage Super Admin users.' }
}

export async function updateUserProfile(
  userId: string,
  input: UserFormInput,
  supabase?: SupabaseClient,
): Promise<{ ok: true; row: UserListRow } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  try {
    const accessCheck = await assertCanManageUser(client, userId)
    if (!accessCheck.ok) {
      return accessCheck
    }

    const branchId = input.branch_id === 'all' ? null : input.branch_id

    const { data: profileRow, error: profileError } = await client
      .from('profiles')
      .update({
        full_name: input.full_name.trim(),
        email: input.email.trim().toLowerCase(),
        status: input.status,
        branch_id: branchId,
      })
      .eq('id', userId)
      .select(userSelect)
      .single()

    if (profileError || !profileRow) {
      return { ok: false, error: profileError?.message || 'Could not update user profile.' }
    }

    await syncUserBranchAssignment(client, userId, branchId)

    if (input.permission_profile_id) {
      const assignResult = await assignUserPermissionProfile(userId, input.permission_profile_id, client)
      if (!assignResult.ok) {
        return assignResult
      }
    }

    const branchNames = new Map<string, string>(
      (
        await client.from('branches').select('id, name')
      ).data?.map((branch) => [branch.id, branch.name]) || [],
    )

    return {
      ok: true,
      row: mapDbProfileToListRow(profileRow as DbProfileRow, branchNames),
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not update user.',
    }
  }
}

export async function updateUserStatus(
  userId: string,
  status: UserUiStatus,
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  const accessCheck = await assertCanManageUser(client, userId)
  if (!accessCheck.ok) {
    return accessCheck
  }

  const { error } = await client.from('profiles').update({ status }).eq('id', userId)

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

export async function assignUserProfile(
  userId: string,
  permissionProfileId: string,
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  const { data: permissionProfile, error: readError } = await client
    .from('permission_profiles')
    .select('id, parent_role_id, slug')
    .eq('id', permissionProfileId)
    .maybeSingle()

  if (readError || !permissionProfile) {
    return { ok: false, error: readError?.message || 'Permission profile not found.' }
  }

  if (permissionProfile.slug === 'super_admin_full') {
    return { ok: false, error: 'Super Admin profile cannot be assigned from the UI.' }
  }

  const { error: profileError } = await client
    .from('profiles')
    .update({ parent_role_id: permissionProfile.parent_role_id })
    .eq('id', userId)

  if (profileError) {
    return { ok: false, error: profileError.message }
  }

  return assignUserPermissionProfile(userId, permissionProfileId, client)
}

export type CreateUserInput = UserFormInput & {
  password: string
}

export async function createUserAccount(
  input: CreateUserInput,
  accessToken: string,
): Promise<
  { ok: true; userId: string; email: string; temporaryPassword: string } | { ok: false; error: string }
> {
  try {
    const response = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
    })

    const payload = (await response.json()) as {
      error?: string
      profileId?: string
      email?: string
      temporaryPassword?: string
    }

    if (!response.ok) {
      return { ok: false, error: payload.error || 'Could not create user.' }
    }

    if (!payload.temporaryPassword || !payload.email) {
      return { ok: false, error: 'User created but login credentials were not returned.' }
    }

    return {
      ok: true,
      userId: payload.profileId || '',
      email: payload.email,
      temporaryPassword: payload.temporaryPassword,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not create user.',
    }
  }
}

export async function deleteUserAccount(
  profileId: string,
  accessToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ profileId }),
    })

    const payload = (await response.json()) as { error?: string }

    if (!response.ok) {
      return { ok: false, error: payload.error || 'Could not delete user.' }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not delete user.',
    }
  }
}

export async function updateStaffPassword(
  profileId: string,
  password: string,
  confirmPassword: string,
  accessToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch('/api/admin/update-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ profileId, password, confirmPassword }),
    })

    const payload = (await response.json()) as { error?: string }

    if (!response.ok) {
      return { ok: false, error: payload.error || 'Could not update password.' }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not update password.',
    }
  }
}

export function getAccessScope(user: UserListRow) {
  if (user.permission_profile_slug === 'super_admin_full') return 'Full system access'
  if (!user.branch_id && (user.parent_role_id === 'company_admin' || user.parent_role_id === 'super_admin')) {
    return 'Company level access'
  }
  if (user.parent_role_id === 'student') return 'Own student data only'
  if (user.parent_role_id === 'mentor') return 'Assigned batches only'
  return 'Assigned branch access'
}
