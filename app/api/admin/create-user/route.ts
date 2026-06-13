import { NextResponse } from 'next/server'
import { callerHasPermission, getCallerFromBearerToken, getCallerProfile } from '@/lib/auth/admin'
import { syncMentorDirectoryForProfile } from '@/lib/data/mentors'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  let createdUserId: string | null = null

  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    const canCreate = await callerHasPermission(caller.id, 'users.create')

    if (!canCreate) {
      return NextResponse.json({ error: 'You do not have permission to create users.' }, { status: 403 })
    }

    const body = await request.json()

    const fullName = String(body.full_name || body.fullName || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '').trim()
    const permissionProfileId = String(body.permission_profile_id || body.permissionProfileId || '').trim()
    const branchIdRaw = String(body.branch_id || body.branchId || '').trim()
    const branchId = branchIdRaw && branchIdRaw !== 'all' ? branchIdRaw : null
    const status = body.status === 'inactive' ? 'inactive' : 'active'

    if (!fullName || !email) {
      return NextResponse.json({ error: 'Full name and email are required.' }, { status: 400 })
    }

    if (!permissionProfileId) {
      return NextResponse.json({ error: 'Permission profile is required.' }, { status: 400 })
    }

    const temporaryPassword = password || `Welcome@${Math.random().toString(36).slice(2, 10)}`

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 })
    }

    const { data: permissionProfile, error: profileReadError } = await supabaseAdmin
      .from('permission_profiles')
      .select('id, slug, parent_role_id')
      .eq('id', permissionProfileId)
      .maybeSingle()

    if (profileReadError || !permissionProfile) {
      return NextResponse.json({ error: 'Permission profile not found.' }, { status: 400 })
    }

    if (permissionProfile.slug === 'super_admin_full') {
      return NextResponse.json({ error: 'Super Admin profile cannot be assigned from the UI.' }, { status: 400 })
    }

    const callerProfile = await getCallerProfile(caller.id)
    const callerIsSuperAdmin = callerProfile?.parent_role_id === 'super_admin'

    if (
      !callerIsSuperAdmin &&
      (permissionProfile.slug === 'company_admin_default' ||
        permissionProfile.parent_role_id === 'super_admin' ||
        permissionProfile.parent_role_id === 'company_admin')
    ) {
      return NextResponse.json(
        { error: 'Only Super Admin can create users with Super Admin or Company Admin profiles.' },
        { status: 403 },
      )
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        parent_role_id: permissionProfile.parent_role_id,
        permission_profile_slug: permissionProfile.slug,
      },
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Failed to create auth user.' },
        { status: 400 },
      )
    }

    const userId = authData.user.id
    createdUserId = userId

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        email,
        parent_role_id: permissionProfile.parent_role_id,
        branch_id: branchId,
        status,
      })
      .eq('id', userId)

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    await supabaseAdmin.from('user_permission_profiles').delete().eq('user_id', userId)

    const { error: permissionError } = await supabaseAdmin.from('user_permission_profiles').insert({
      user_id: userId,
      profile_id: permissionProfile.id,
      is_primary: true,
    })

    if (permissionError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: permissionError.message }, { status: 400 })
    }

    await supabaseAdmin.from('user_branch_assignments').delete().eq('user_id', userId)

    if (branchId) {
      const { error: branchError } = await supabaseAdmin.from('user_branch_assignments').insert({
        user_id: userId,
        branch_id: branchId,
      })

      if (branchError) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return NextResponse.json({ error: branchError.message }, { status: 400 })
      }
    }

    await syncMentorDirectoryForProfile(supabaseAdmin, userId, branchId, permissionProfile)

    return NextResponse.json({
      success: true,
      message: 'User created successfully.',
      profileId: userId,
      email,
      temporaryPassword,
    })
  } catch {
    if (createdUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId)
    }

    return NextResponse.json({ error: 'Something went wrong while creating user.' }, { status: 500 })
  }
}
