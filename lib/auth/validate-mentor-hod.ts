import type { SupabaseClient } from '@supabase/supabase-js'
import { MENTOR_HOD_SLUG } from '@/lib/data/mentors'

type HodProfileRow = {
  id: string
  parent_role_id: string
  branch_id: string | null
  user_permission_profiles:
    | Array<{
        is_primary: boolean
        permission_profiles: { slug: string } | { slug: string }[] | null
      }>
    | null
  user_branch_assignments: Array<{ branch_id: string }> | null
}

function primaryProfileSlug(row: HodProfileRow) {
  const links = row.user_permission_profiles || []
  const primary =
    links.find((link) => link.is_primary)?.permission_profiles || links[0]?.permission_profiles || null

  if (!primary) return null
  return Array.isArray(primary) ? primary[0]?.slug || null : primary.slug
}

function profileBranchIds(row: HodProfileRow) {
  return new Set<string>([
    ...(row.branch_id ? [row.branch_id] : []),
    ...(row.user_branch_assignments || []).map((item) => item.branch_id),
  ])
}

/** Validates HOD assignment using profile + branch scope (not mentor_details row). */
export async function validateHodAssignment(
  client: SupabaseClient,
  reportsTo: string,
  branchId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await client
    .from('profiles')
    .select(
      `
      id,
      parent_role_id,
      branch_id,
      user_permission_profiles (
        is_primary,
        permission_profiles ( slug )
      ),
      user_branch_assignments ( branch_id )
    `,
    )
    .eq('id', reportsTo)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, error: 'HOD not found in this branch.' }
  }

  const profile = data as HodProfileRow

  if (profile.parent_role_id !== 'mentor') {
    return { ok: false, error: 'Assigned HOD must be a mentor profile.' }
  }

  if (primaryProfileSlug(profile) !== MENTOR_HOD_SLUG) {
    return { ok: false, error: 'Assigned HOD must have the HOD / Superior Mentor profile.' }
  }

  if (!profileBranchIds(profile).has(branchId)) {
    return { ok: false, error: 'HOD must belong to the same branch.' }
  }

  return { ok: true }
}
