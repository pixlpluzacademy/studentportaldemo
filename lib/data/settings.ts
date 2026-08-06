import { createClient } from '@/lib/supabase/client'

export async function updateMyProfile(input: {
  fullName: string
  email: string
  avatarFile?: File | null
}): Promise<{ ok: true; avatarUrl: string | null } | { ok: false; error: string }> {
  const supabase = createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { ok: false, error: 'Not authenticated. Please login again.' }
  }

  const fullName = input.fullName.trim()
  const email = input.email.trim().toLowerCase()

  if (!fullName) return { ok: false, error: 'Full name is required.' }
  if (!email) return { ok: false, error: 'Email is required.' }

  let avatarUrl: string | null = null

  if (input.avatarFile) {
    const file = input.avatarFile
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `profiles/${user.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('student-profiles')
      .upload(path, file, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      return {
        ok: false,
        error: `Avatar upload failed: ${uploadError.message}. Ensure the student-profiles storage bucket exists.`,
      }
    }

    const { data: publicUrl } = supabase.storage.from('student-profiles').getPublicUrl(path)
    avatarUrl = publicUrl.publicUrl
  }

  const authUpdate: { email?: string; data?: { full_name: string } } = {
    data: { full_name: fullName },
  }

  if (email !== (user.email || '').toLowerCase()) {
    authUpdate.email = email
  }

  const { error: authError } = await supabase.auth.updateUser(authUpdate)
  if (authError) {
    return { ok: false, error: authError.message }
  }

  const profileUpdate: {
    full_name: string
    email: string
    avatar_url?: string
    updated_at?: string
  } = {
    full_name: fullName,
    email,
    updated_at: new Date().toISOString(),
  }

  if (avatarUrl) {
    profileUpdate.avatar_url = avatarUrl
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('id', user.id)

  if (profileError) {
    return { ok: false, error: profileError.message }
  }

  return { ok: true, avatarUrl }
}

export async function updateMyPassword(input: {
  newPassword: string
  confirmPassword: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { ok: false, error: 'Not authenticated. Please login again.' }
  }

  if (!input.newPassword || !input.confirmPassword) {
    return { ok: false, error: 'Please enter and confirm your new password.' }
  }

  if (input.newPassword !== input.confirmPassword) {
    return { ok: false, error: 'New password and confirm password do not match.' }
  }

  if (input.newPassword.length < 6) {
    return { ok: false, error: 'Password should be at least 6 characters.' }
  }

  const { error } = await supabase.auth.updateUser({
    password: input.newPassword,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
