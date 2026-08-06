import type { SupabaseClient } from '@supabase/supabase-js'
import type { DemoRole, PermissionKey } from '@/lib/demo/types'
import type { DataResult } from '@/lib/data/config'
import {
  canCreateProfileUnderParent,
  canManagePermissionProfile,
  isElevatedPermissionProfile,
  isImmutableSuperAdminProfile,
} from '@/lib/auth/role-management-access'
import { createClient } from '@/lib/supabase/client'

/**
 * Permission profiles and parent roles are academy-wide.
 * They are NOT branch-scoped — the same profiles appear for every branch.
 * Branch context only filters operational data (students, batches, etc.).
 */
export const ROLES_ARE_ACADEMY_WIDE = true as const

export type PermissionCatalogItem = {
  module_id: string
  action: string
  permission_key: string
}

export type PermissionProfileItem = {
  id: string
  slug: string
  name: string
  parent_role_id: string
  is_system: boolean
  status: 'active' | 'inactive'
  permissions: PermissionKey[]
}

export type ParentRoleItem = {
  id: string
  name: string
  level: number
}

export type PermissionModuleGroup = {
  module_id: string
  label: string
  permissions: PermissionCatalogItem[]
}

export type PermissionProfileInput = {
  name: string
  parent_role_id: string
  status: 'active' | 'inactive'
  permissionKeys: PermissionKey[]
}

const permissionActionOrder = [
  'view',
  'create',
  'edit',
  'delete',
  'assign',
  'switch',
  'review',
  'approve',
  'upload',
  'download',
  'export',
  'lock',
  'submit',
  'mark',
  'reply',
  'resolve',
  'validate',
] as const

const moduleLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  departments: 'Departments',
  branches: 'Branches',
  users: 'Users',
  roles: 'Role Management',
  courses: 'Courses',
  'my-courses': 'Course Overview',
  'class-materials': 'Class Materials',
  batches: 'Batches',
  students: 'Students',
  mentors: 'Mentors',
  attendance: 'Attendance',
  tasks: 'Tasks',
  submissions: 'Task Submissions',
  marks: 'Marks / Evaluation',
  hod_review: 'HOD Review',
  final_qa: 'Final QA',
  placement: 'Placement',
  admissions: 'Admissions / Leads',
  certificates: 'Certificates',
  complaints: 'Complaints',
  ratings: 'Mentor Ratings',
  reports: 'Reports',
  settings: 'Settings',
}

export function moduleLabelFromId(moduleId: string) {
  return moduleLabels[moduleId] || moduleId.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function groupCatalogByModule(catalog: PermissionCatalogItem[]): PermissionModuleGroup[] {
  const grouped = new Map<string, PermissionCatalogItem[]>()

  for (const item of catalog) {
    // Hidden for now — data layer kept; re-enable when Admissions UI ships.
    if (item.module_id === 'companies' || item.module_id === 'admissions') continue
    const list = grouped.get(item.module_id) || []
    list.push(item)
    grouped.set(item.module_id, list)
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([module_id, permissions]) => ({
      module_id,
      label: moduleLabelFromId(module_id),
      permissions: permissions.sort((a, b) => a.action.localeCompare(b.action)),
    }))
}

export function catalogActions(catalog: PermissionCatalogItem[]) {
  const actions = Array.from(new Set(catalog.map((item) => item.action)))
  return permissionActionOrder.filter((action) => actions.includes(action))
}

export function enabledModulesFromPermissionKeys(permissionKeys: string[]) {
  return Array.from(
    new Set(
      permissionKeys
        .filter((key) => key.endsWith('.view'))
        .map((key) => key.replace('.view', '')),
    ),
  )
}

function slugifyProfileName(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return base || `profile_${Date.now()}`
}

async function resolveActorParentRoleId(
  client: SupabaseClient,
  provided?: string | null,
): Promise<string | null> {
  if (provided) return provided

  const {
    data: { user },
  } = await client.auth.getUser()

  if (!user) return null

  const { data: profile } = await client
    .from('profiles')
    .select('parent_role_id')
    .eq('id', user.id)
    .maybeSingle()

  return profile?.parent_role_id ?? null
}

async function syncProfilePermissions(
  supabase: SupabaseClient,
  profileId: string,
  permissionKeys: PermissionKey[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: deleteError } = await supabase
    .from('profile_permissions')
    .delete()
    .eq('profile_id', profileId)

  if (deleteError) {
    return { ok: false, error: deleteError.message }
  }

  if (!permissionKeys.length) {
    return { ok: true }
  }

  const { data: permissionRows, error: permissionError } = await supabase
    .from('permissions')
    .select('id, permission_key')
    .in('permission_key', permissionKeys)

  if (permissionError) {
    return { ok: false, error: permissionError.message }
  }

  if (!permissionRows?.length) {
    return { ok: true }
  }

  const { error: insertError } = await supabase.from('profile_permissions').insert(
    permissionRows.map((row) => ({
      profile_id: profileId,
      permission_id: row.id,
    })),
  )

  if (insertError) {
    return { ok: false, error: insertError.message }
  }

  return { ok: true }
}

async function fetchSupabasePermissionCatalog(
  supabase: SupabaseClient,
): Promise<{ data: PermissionCatalogItem[]; error?: string }> {
  const { data, error } = await supabase
    .from('permissions')
    .select('module_id, action, permission_key')
    .order('module_id')
    .order('action')

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: (data || []) as PermissionCatalogItem[] }
}

async function fetchSupabasePermissionProfiles(
  supabase: SupabaseClient,
): Promise<{ data: PermissionProfileItem[]; error?: string }> {
  const { data: profiles, error: profilesError } = await supabase
    .from('permission_profiles')
    .select('id, slug, name, parent_role_id, is_system, status')
    .order('name')

  if (profilesError) {
    return { data: [], error: profilesError.message }
  }

  if (!profiles?.length) {
    return { data: [] }
  }

  const results: PermissionProfileItem[] = []

  for (const profile of profiles) {
    const { data: permissionRows } = await supabase
      .from('profile_permissions')
      .select('permissions(permission_key)')
      .eq('profile_id', profile.id)

    const permissions =
      permissionRows
        ?.map((row) => {
          const perm = row.permissions as { permission_key: string } | { permission_key: string }[] | null
          if (Array.isArray(perm)) return perm[0]?.permission_key
          return perm?.permission_key
        })
        .filter(Boolean) as PermissionKey[] || []

    results.push({
      ...profile,
      status: profile.status as 'active' | 'inactive',
      permissions,
    })
  }

  return { data: results }
}

export async function fetchPermissionCatalog(
  supabase?: SupabaseClient,
): Promise<DataResult<PermissionCatalogItem[]>> {
  const client = supabase ?? createClient()

  try {
    const result = await fetchSupabasePermissionCatalog(client)
    return { source: 'supabase', data: result.data, error: result.error }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load permissions.',
    }
  }
}

export async function fetchPermissionProfiles(
  supabase?: SupabaseClient,
): Promise<DataResult<PermissionProfileItem[]>> {
  const client = supabase ?? createClient()

  try {
    const result = await fetchSupabasePermissionProfiles(client)
    return { source: 'supabase', data: result.data, error: result.error }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load permission profiles.',
    }
  }
}

/** Maps permission profile slugs to legacy demo role ids used by existing pages. */
export function legacyRoleIdFromSlug(slug: string): string {
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

export function mapProfilesToDemoRoles(
  profiles: Array<{
    slug: string
    name: string
    parent_role_id: string
    status: 'active' | 'inactive'
    permissions: PermissionKey[]
  }>,
): DemoRole[] {
  return profiles.map((profile) => ({
    id: legacyRoleIdFromSlug(profile.slug),
    name: profile.name,
    level: 1,
    parentRoleId: profile.parent_role_id,
    companyScope: 'all',
    branchScope: 'all',
    status: profile.status,
    createdBy: 'system',
    permissions: profile.permissions,
    enabledModules: enabledModulesFromPermissionKeys(profile.permissions) as DemoRole['enabledModules'],
  }))
}

/** All fixed parent role categories (includes Super Admin for display). */
export async function fetchAllParentRoles(
  supabase?: SupabaseClient,
): Promise<{ data: ParentRoleItem[]; error?: string }> {
  const client = supabase ?? createClient()

  const { data, error } = await client
    .from('parent_roles')
    .select('id, name, level')
    .order('level')

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: (data || []) as ParentRoleItem[] }
}

/** Parent roles available when creating a custom permission profile. */
export async function fetchParentRoles(
  supabase?: SupabaseClient,
  options?: { actorParentRoleId?: string | null },
): Promise<{ data: ParentRoleItem[]; error?: string }> {
  const result = await fetchAllParentRoles(supabase)
  if (result.error) {
    return result
  }

  const isSuperAdmin = options?.actorParentRoleId === 'super_admin'

  return {
    data: result.data.filter((role) => {
      if (role.id === 'super_admin') return false
      if (!isSuperAdmin && role.id === 'company_admin') return false
      return true
    }),
  }
}

export {
  isElevatedPermissionProfile,
  canManagePermissionProfile,
  canCreateProfileUnderParent,
  isImmutableSuperAdminProfile,
} from '@/lib/auth/role-management-access'

export function groupProfilesByParentRole(
  profiles: PermissionProfileItem[],
  parentRoles: ParentRoleItem[],
): Array<{ parentRole: ParentRoleItem; profiles: PermissionProfileItem[] }> {
  return parentRoles
    .map((parentRole) => ({
      parentRole,
      profiles: profiles
        .filter((profile) => profile.parent_role_id === parentRole.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((group) => group.profiles.length > 0)
}

export async function savePermissionProfile(
  input: PermissionProfileInput,
  profileId?: string | null,
  supabase?: SupabaseClient,
  options?: { actorParentRoleId?: string | null },
): Promise<{ ok: true; profile: PermissionProfileItem } | { ok: false; error: string }> {
  const client = supabase ?? createClient()
  const actorParentRoleId = await resolveActorParentRoleId(client, options?.actorParentRoleId)

  if (!canCreateProfileUnderParent(actorParentRoleId, input.parent_role_id)) {
    if (input.parent_role_id === 'super_admin') {
      return {
        ok: false,
        error: 'Super Admin parent role cannot be assigned to permission profiles from the UI.',
      }
    }

    return {
      ok: false,
      error: 'Only Super Admin can manage Company Admin permission profiles.',
    }
  }

  try {
    if (profileId) {
      const { data: existingProfile, error: readError } = await client
        .from('permission_profiles')
        .select('id, slug, name, parent_role_id, is_system, status')
        .eq('id', profileId)
        .maybeSingle()

      if (readError || !existingProfile) {
        return { ok: false, error: readError?.message || 'Permission profile not found.' }
      }

      if (isImmutableSuperAdminProfile(existingProfile)) {
        return {
          ok: false,
          error: 'Super Admin permission profile is system-locked and cannot be edited.',
        }
      }

      if (!canManagePermissionProfile(actorParentRoleId, existingProfile)) {
        return {
          ok: false,
          error: 'Only Super Admin can edit Company Admin profiles.',
        }
      }

      if (input.parent_role_id === 'super_admin') {
        return {
          ok: false,
          error: 'Super Admin parent role cannot be assigned to permission profiles from the UI.',
        }
      }

      const { data, error } = await client
        .from('permission_profiles')
        .update({
          name: input.name.trim(),
          parent_role_id: input.parent_role_id,
          status: input.status,
        })
        .eq('id', profileId)
        .select('id, slug, name, parent_role_id, is_system, status')
        .single()

      if (error || !data) {
        const message = error?.message || 'Could not update permission profile.'
        if (message.toLowerCase().includes('policy') || message.toLowerCase().includes('permission')) {
          return {
            ok: false,
            error: `${message} — run migration 20250609000005_permission_profiles_manage_rls.sql in Supabase if you have not already.`,
          }
        }
        return { ok: false, error: message }
      }

      const syncResult = await syncProfilePermissions(client, profileId, input.permissionKeys)
      if (!syncResult.ok) {
        return syncResult
      }

      return {
        ok: true,
        profile: {
          ...(data as Omit<PermissionProfileItem, 'permissions'>),
          status: data.status as 'active' | 'inactive',
          permissions: input.permissionKeys,
        },
      }
    }

    let slug = slugifyProfileName(input.name)
    let suffix = 0

    while (suffix < 20) {
      const candidate = suffix === 0 ? slug : `${slug}_${suffix}`
      const { data: existing } = await client
        .from('permission_profiles')
        .select('id')
        .eq('slug', candidate)
        .maybeSingle()

      if (!existing) {
        slug = candidate
        break
      }

      suffix += 1
    }

    const { data, error } = await client
      .from('permission_profiles')
      .insert({
        slug,
        name: input.name.trim(),
        parent_role_id: input.parent_role_id,
        status: input.status,
        is_system: false,
      })
      .select('id, slug, name, parent_role_id, is_system, status')
      .single()

    if (error || !data) {
      return { ok: false, error: error?.message || 'Could not create permission profile.' }
    }

    const syncResult = await syncProfilePermissions(client, data.id, input.permissionKeys)
    if (!syncResult.ok) {
      return syncResult
    }

    return {
      ok: true,
      profile: {
        ...(data as Omit<PermissionProfileItem, 'permissions'>),
        status: data.status as 'active' | 'inactive',
        permissions: input.permissionKeys,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not save permission profile.',
    }
  }
}

export async function deletePermissionProfile(
  profileId: string,
  supabase?: SupabaseClient,
  options?: { actorParentRoleId?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()
  const actorParentRoleId = await resolveActorParentRoleId(client, options?.actorParentRoleId)

  const { data: profile, error: readError } = await client
    .from('permission_profiles')
    .select('id, is_system, slug, parent_role_id')
    .eq('id', profileId)
    .maybeSingle()

  if (readError || !profile) {
    return { ok: false, error: readError?.message || 'Permission profile not found.' }
  }

  if (isImmutableSuperAdminProfile(profile)) {
    return {
      ok: false,
      error: 'Super Admin permission profile cannot be deleted.',
    }
  }

  if (!canManagePermissionProfile(actorParentRoleId, profile)) {
    return {
      ok: false,
      error: 'Only Super Admin can delete Company Admin profiles.',
    }
  }

  if (profile.is_system || profile.slug === 'super_admin_full') {
    return { ok: false, error: 'System permission profiles cannot be deleted.' }
  }

  const { error } = await client.from('permission_profiles').delete().eq('id', profileId)

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

export async function assignUserPermissionProfile(
  userId: string,
  profileId: string,
  supabase?: SupabaseClient,
  options?: { actorParentRoleId?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()
  const actorParentRoleId = await resolveActorParentRoleId(client, options?.actorParentRoleId)

  const { data: profile, error: profileError } = await client
    .from('permission_profiles')
    .select('slug, parent_role_id')
    .eq('id', profileId)
    .maybeSingle()

  if (profileError || !profile) {
    return { ok: false, error: profileError?.message || 'Permission profile not found.' }
  }

  if (isImmutableSuperAdminProfile(profile)) {
    return { ok: false, error: 'Super Admin profile cannot be assigned from the UI.' }
  }

  if (!canManagePermissionProfile(actorParentRoleId, profile)) {
    return {
      ok: false,
      error: 'Only Super Admin can assign Company Admin profiles.',
    }
  }

  if (profile.slug === 'super_admin_full') {
    return { ok: false, error: 'Super Admin profile cannot be assigned from the UI.' }
  }

  const { error: clearError } = await client
    .from('user_permission_profiles')
    .delete()
    .eq('user_id', userId)

  if (clearError) {
    return { ok: false, error: clearError.message }
  }

  const { error: insertError } = await client.from('user_permission_profiles').insert({
    user_id: userId,
    profile_id: profileId,
    is_primary: true,
  })

  if (insertError) {
    return { ok: false, error: insertError.message }
  }

  return { ok: true }
}
