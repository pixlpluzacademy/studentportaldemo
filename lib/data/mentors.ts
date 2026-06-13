import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataResult } from '@/lib/data/config'
import { assignUserPermissionProfile } from '@/lib/data/permissions'
import { createClient } from '@/lib/supabase/client'

export const MENTOR_FINAL_QA_SLUG = 'mentor_final_qa'
export const MENTOR_HOD_SLUG = 'mentor_hod'

export type MentorUiStatus = 'active' | 'inactive'

export type MentorListRow = {
  id: string
  full_name: string
  email: string
  status: MentorUiStatus
  avatar_url: string | null
  branch_id: string
  department_id: string
  department_name: string
  permission_profile_id: string | null
  permission_profile_slug: string | null
  permission_profile_name: string
  reports_to: string | null
  superior_name: string
  phone: string
  joining_date: string
  average_rating: string
}

export type MentorDetailRow = MentorListRow & {
  bio: string
  branch_name: string
  created_at: string
  updated_at: string
}

export type MentorFormInput = {
  full_name: string
  email: string
  phone: string
  permission_profile_id: string
  department_id: string
  reports_to: string | null
  joining_date: string
  status: MentorUiStatus
}

type DbMentorRow = {
  profile_id: string
  branch_id: string
  department_id: string
  reports_to: string | null
  phone: string | null
  joining_date: string | null
  average_rating: number | null
  bio: string | null
  created_at: string
  updated_at: string
  profiles: {
    id: string
    full_name: string
    email: string
    status: MentorUiStatus
    avatar_url: string | null
    user_permission_profiles:
      | Array<{
          is_primary: boolean
          permission_profiles: {
            id: string
            slug: string
            name: string
          } | null
        }>
      | null
  } | null
  departments: { id: string; name: string } | { id: string; name: string }[] | null
  superior: { full_name: string } | { full_name: string }[] | null
}

const mentorSelect = `
  profile_id,
  branch_id,
  department_id,
  reports_to,
  phone,
  joining_date,
  average_rating,
  bio,
  created_at,
  updated_at,
  profiles:profile_id (
    id,
    full_name,
    email,
    status,
    avatar_url,
    user_permission_profiles (
      is_primary,
      permission_profiles (
        id,
        slug,
        name
      )
    )
  ),
  departments:department_id (
    id,
    name
  ),
  superior:reports_to (
    full_name
  )
`

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] || null : value
}

function primaryPermissionProfileFromLinks(
  links: DbMentorProfileRow['user_permission_profiles'],
) {
  const profileLinks = links || []
  const primary =
    profileLinks.find((link) => link.is_primary)?.permission_profiles ||
    profileLinks[0]?.permission_profiles ||
    null

  if (primary && !Array.isArray(primary)) {
    return primary
  }

  return null
}

function primaryPermissionProfile(row: NonNullable<DbMentorRow['profiles']>) {
  return primaryPermissionProfileFromLinks(row.user_permission_profiles)
}

function formatDate(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 10)
}

function formatRating(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—'
  return Number(value).toFixed(1)
}

function mapDbMentorToListRow(
  row: DbMentorRow,
  departmentNameMap: Map<string, string>,
): MentorListRow | null {
  const profile = row.profiles
  if (!profile) return null

  const permissionProfile = primaryPermissionProfile(profile)
  if (permissionProfile?.slug === MENTOR_FINAL_QA_SLUG) return null

  const department = unwrapOne(row.departments)
  const superior = unwrapOne(row.superior)
  const departmentName =
    departmentNameMap.get(row.department_id) || department?.name || 'Not assigned'

  return {
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    status: profile.status,
    avatar_url: profile.avatar_url,
    branch_id: row.branch_id,
    department_id: row.department_id,
    department_name: departmentName,
    permission_profile_id: permissionProfile?.id || null,
    permission_profile_slug: permissionProfile?.slug || null,
    permission_profile_name: permissionProfile?.name || 'Not assigned',
    reports_to: row.reports_to,
    superior_name: superior?.full_name || 'Not assigned',
    phone: row.phone?.trim() || 'Not added',
    joining_date: formatDate(row.joining_date),
    average_rating: formatRating(row.average_rating),
  }
}

export function isMentorDirectoryProfile(slug: string | null | undefined) {
  return Boolean(slug && slug !== MENTOR_FINAL_QA_SLUG)
}

type DbMentorProfileRow = {
  id: string
  full_name: string
  email: string
  status: MentorUiStatus
  avatar_url: string | null
  branch_id: string | null
  user_permission_profiles:
    | Array<{
        is_primary: boolean
        permission_profiles: {
          id: string
          slug: string
          name: string
        } | null
      }>
    | null
  user_branch_assignments: Array<{ branch_id: string }> | null
}

const mentorProfileSelect = `
  id,
  full_name,
  email,
  status,
  avatar_url,
  branch_id,
  user_permission_profiles (
    is_primary,
    permission_profiles (
      id,
      slug,
      name
    )
  ),
  user_branch_assignments (
    branch_id
  )
`

function profileMatchesBranch(row: DbMentorProfileRow, branchId: string) {
  if (row.branch_id === branchId) return true
  return (row.user_branch_assignments || []).some((item) => item.branch_id === branchId)
}

function mapDbMentorToDetailRow(
  row: DbMentorRow,
  departmentNameMap: Map<string, string>,
  branchNameMap: Map<string, string>,
): MentorDetailRow | null {
  const base = mapDbMentorToListRow(row, departmentNameMap)
  if (!base) return null

  return {
    ...base,
    bio: row.bio?.trim() || '—',
    branch_name: branchNameMap.get(row.branch_id) || 'Assigned branch',
    created_at: formatDate(row.created_at),
    updated_at: formatDate(row.updated_at),
  }
}

function mapProfileToMentorDetailRow(
  row: DbMentorProfileRow,
  branchId: string,
  branchNameMap: Map<string, string>,
): MentorDetailRow | null {
  const base = mapProfileToMentorListRow(row, branchId)
  if (!base) return null

  return {
    ...base,
    bio: '—',
    branch_name: branchNameMap.get(branchId) || 'Assigned branch',
    created_at: '—',
    updated_at: '—',
  }
}

export function mentorMatchesBranch(mentor: Pick<MentorListRow, 'branch_id'>, branchId?: string | null) {
  if (!branchId) return true
  return mentor.branch_id === branchId
}

function mapProfileToMentorListRow(
  row: DbMentorProfileRow,
  branchId: string,
): MentorListRow | null {
  const permissionProfile = primaryPermissionProfileFromLinks(row.user_permission_profiles)
  if (!permissionProfile || permissionProfile.slug === MENTOR_FINAL_QA_SLUG) return null

  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    status: row.status,
    avatar_url: row.avatar_url,
    branch_id: branchId,
    department_id: '',
    department_name: 'Not assigned',
    permission_profile_id: permissionProfile.id,
    permission_profile_slug: permissionProfile.slug,
    permission_profile_name: permissionProfile.name,
    reports_to: null,
    superior_name: 'Not assigned',
    phone: 'Not added',
    joining_date: '',
    average_rating: '—',
  }
}

export async function syncMentorDirectoryForProfile(
  client: SupabaseClient,
  profileId: string,
  branchId: string | null,
  permissionProfile: { slug: string; parent_role_id: string },
): Promise<void> {
  if (permissionProfile.parent_role_id !== 'mentor') return
  if (permissionProfile.slug === MENTOR_FINAL_QA_SLUG) return
  if (!branchId) return

  const { data: existing } = await client
    .from('mentor_details')
    .select('profile_id')
    .eq('profile_id', profileId)
    .maybeSingle()

  if (existing) return

  const { data: firstDept } = await client
    .from('departments')
    .select('id')
    .eq('branch_id', branchId)
    .eq('status', 'active')
    .order('name')
    .limit(1)
    .maybeSingle()

  if (!firstDept) return

  await client.from('mentor_details').insert({
    profile_id: profileId,
    branch_id: branchId,
    department_id: firstDept.id,
  })
}

async function fetchDepartmentNameMap(
  client: SupabaseClient,
  branchId?: string | null,
): Promise<Map<string, string>> {
  let query = client.from('departments').select('id, name').order('name')

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data } = await query
  return new Map((data || []).map((row) => [row.id as string, row.name as string]))
}

export async function fetchMentorList(
  branchId?: string | null,
  supabase?: SupabaseClient,
): Promise<DataResult<MentorListRow[]>> {
  const client = supabase ?? createClient()

  try {
    if (!branchId) {
      return { source: 'supabase', data: [] }
    }

    let detailsQuery = client
      .from('mentor_details')
      .select(mentorSelect)
      .eq('branch_id', branchId)
      .order('joining_date', { ascending: false })

    const [{ data: detailsData, error: detailsError }, departmentNameMap, { data: profileData, error: profilesError }] =
      await Promise.all([
        detailsQuery,
        fetchDepartmentNameMap(client, branchId),
        client.from('profiles').select(mentorProfileSelect).eq('parent_role_id', 'mentor'),
      ])

    if (detailsError) {
      return { source: 'supabase', data: [], error: detailsError.message }
    }

    if (profilesError) {
      return { source: 'supabase', data: [], error: profilesError.message }
    }

    const detailsRows = (detailsData as DbMentorRow[]) || []
    const detailsByProfileId = new Map(detailsRows.map((row) => [row.profile_id, row]))

    const fromDetails = detailsRows
      .map((row) => mapDbMentorToListRow(row, departmentNameMap))
      .filter((row): row is MentorListRow => Boolean(row))

    const fromProfiles = ((profileData as DbMentorProfileRow[]) || [])
      .filter((row) => profileMatchesBranch(row, branchId))
      .filter((row) => !detailsByProfileId.has(row.id))
      .map((row) => mapProfileToMentorListRow(row, branchId))
      .filter((row): row is MentorListRow => Boolean(row))

    const merged = [...fromDetails, ...fromProfiles].sort((a, b) =>
      a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' }),
    )

    return { source: 'supabase', data: merged }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load mentors.',
    }
  }
}

export async function fetchMentorById(
  mentorId: string,
  branchNameMap?: Map<string, string>,
  supabase?: SupabaseClient,
): Promise<DataResult<MentorDetailRow | null>> {
  const client = supabase ?? createClient()

  try {
    const names =
      branchNameMap ||
      new Map<string, string>(
        (
          await client.from('branches').select('id, name')
        ).data?.map((branch) => [branch.id, branch.name]) || [],
      )

    const { data, error } = await client
      .from('mentor_details')
      .select(mentorSelect)
      .eq('profile_id', mentorId)
      .maybeSingle()

    if (error) {
      return { source: 'supabase', data: null, error: error.message }
    }

    if (data) {
      const row = data as DbMentorRow
      const departmentNameMap = await fetchDepartmentNameMap(client, row.branch_id)
      const mapped = mapDbMentorToDetailRow(row, departmentNameMap, names)
      if (mapped) {
        return { source: 'supabase', data: mapped }
      }
    }

    const { data: profileRow, error: profileError } = await client
      .from('profiles')
      .select(mentorProfileSelect)
      .eq('id', mentorId)
      .eq('parent_role_id', 'mentor')
      .maybeSingle()

    if (profileError) {
      return { source: 'supabase', data: null, error: profileError.message }
    }

    if (!profileRow) {
      return { source: 'supabase', data: null }
    }

    const profile = profileRow as DbMentorProfileRow
    const branchId =
      profile.branch_id || profile.user_branch_assignments?.[0]?.branch_id || null

    if (!branchId) {
      return { source: 'supabase', data: null }
    }

    return {
      source: 'supabase',
      data: mapProfileToMentorDetailRow(profile, branchId, names),
    }
  } catch (error) {
    return {
      source: 'supabase',
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load mentor.',
    }
  }
}

export type CreateMentorInput = MentorFormInput & {
  branch_id: string
  password?: string
}

export async function createMentorAccount(
  input: CreateMentorInput,
  accessToken: string,
): Promise<
  { ok: true; userId: string; email: string; temporaryPassword: string } | { ok: false; error: string }
> {
  try {
    const response = await fetch('/api/admin/create-mentor', {
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
      return { ok: false, error: payload.error || 'Could not create mentor.' }
    }

    if (!payload.temporaryPassword || !payload.email) {
      return { ok: false, error: 'Mentor created but login credentials were not returned.' }
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
      error: error instanceof Error ? error.message : 'Could not create mentor.',
    }
  }
}

export async function updateMentorRecord(
  mentorId: string,
  input: MentorFormInput,
  branchId: string,
  accessToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch('/api/admin/update-mentor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        mentorId,
        branchId,
        ...input,
      }),
    })

    const payload = (await response.json()) as { error?: string }

    if (!response.ok) {
      return { ok: false, error: payload.error || 'Could not update mentor.' }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not update mentor.',
    }
  }
}

export async function deleteMentorAccount(
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
      return { ok: false, error: payload.error || 'Could not delete mentor.' }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not delete mentor.',
    }
  }
}

export async function upsertMentorDetailsLocally(
  mentorId: string,
  input: Pick<MentorFormInput, 'department_id' | 'reports_to' | 'phone' | 'joining_date'> & {
    branch_id: string
  },
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  const { error } = await client.from('mentor_details').upsert({
    profile_id: mentorId,
    branch_id: input.branch_id,
    department_id: input.department_id,
    reports_to: input.reports_to || null,
    phone: input.phone.trim() || null,
    joining_date: input.joining_date || null,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

export async function assignMentorPermissionProfile(
  mentorId: string,
  permissionProfileId: string,
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()
  return assignUserPermissionProfile(mentorId, permissionProfileId, client)
}
