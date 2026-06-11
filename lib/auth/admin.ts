import { supabaseAdmin } from '@/lib/supabase-admin'

export async function getCallerFromBearerToken(token: string | null | undefined) {
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null

  return data.user
}

export async function callerHasPermission(userId: string, permissionKey: string) {
  const { data, error } = await supabaseAdmin.rpc('user_has_permission', {
    p_permission_key: permissionKey,
    p_user_id: userId,
  })

  if (error) return false
  return Boolean(data)
}

export async function getCallerProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, parent_role_id, branch_id, status')
    .eq('id', userId)
    .single()

  if (error) return null
  return data
}
