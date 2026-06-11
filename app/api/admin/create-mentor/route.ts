import { NextResponse } from 'next/server'
import { callerHasPermission, getCallerFromBearerToken } from '@/lib/auth/admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  let createdUserId: string | null = null

  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    const canCreate =
      (await callerHasPermission(caller.id, 'mentors.create')) ||
      (await callerHasPermission(caller.id, 'users.create'))

    if (!canCreate) {
      return NextResponse.json({ error: 'You do not have permission to create mentors.' }, { status: 403 })
    }

    const formData = await request.formData()

    const fullName = String(formData.get('fullName') || '').trim()
    const email = String(formData.get('email') || '').trim().toLowerCase()
    const password = String(formData.get('password') || '').trim()
    const departmentId = String(formData.get('departmentId') || formData.get('department') || '').trim()
    const batchId = String(formData.get('batchId') || '').trim()
    const staffType = String(formData.get('staffType') || 'mentor').trim() as
      | 'hod'
      | 'mentor'
      | 'trainer'
      | 'final_qa'
    const permissionProfileSlug = String(formData.get('permissionProfileSlug') || 'mentor_trainer').trim()
    const branchId = String(formData.get('branchId') || '').trim()
    const profileImage = formData.get('profileImage') as File | null

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: 'Full name, email, and password are required.' },
        { status: 400 },
      )
    }

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 })
    }

    const { data: permissionProfile } = await supabaseAdmin
      .from('permission_profiles')
      .select('id, slug')
      .eq('slug', permissionProfileSlug)
      .maybeSingle()

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        parent_role_id: 'mentor',
        permission_profile_slug: permissionProfile?.slug || 'mentor_trainer',
      },
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Failed to create mentor user.' },
        { status: 400 },
      )
    }

    const userId = authData.user.id
    createdUserId = userId

    let profilePictureUrl: string | null = null

    if (profileImage && profileImage.size > 0) {
      const fileExt = profileImage.name.split('.').pop() || 'jpg'
      const filePath = `${userId}/profile.${fileExt}`

      const { error: uploadError } = await supabaseAdmin.storage
        .from('mentor-profiles')
        .upload(filePath, profileImage, {
          upsert: true,
          contentType: profileImage.type,
        })

      if (uploadError) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return NextResponse.json({ error: uploadError.message }, { status: 400 })
      }

      const { data: publicUrlData } = supabaseAdmin.storage.from('mentor-profiles').getPublicUrl(filePath)
      profilePictureUrl = publicUrlData.publicUrl
    }

    const profileUpdate: Record<string, unknown> = {
      full_name: fullName,
      email,
      parent_role_id: 'mentor',
      avatar_url: profilePictureUrl,
      staff_source: 'internal',
    }

    if (branchId) {
      profileUpdate.branch_id = branchId
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').update(profileUpdate).eq('id', userId)

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    if (permissionProfile?.id) {
      await supabaseAdmin.from('user_permission_profiles').upsert({
        user_id: userId,
        profile_id: permissionProfile.id,
        is_primary: true,
      })
    }

    if (branchId) {
      await supabaseAdmin.from('user_branch_assignments').upsert({
        user_id: userId,
        branch_id: branchId,
      })
    }

    if (batchId) {
      const { error: staffError } = await supabaseAdmin.from('batch_staff_assignments').insert({
        batch_id: batchId,
        user_id: userId,
        staff_type: ['hod', 'mentor', 'trainer', 'final_qa'].includes(staffType) ? staffType : 'mentor',
      })

      if (staffError) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return NextResponse.json({ error: staffError.message }, { status: 400 })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Mentor created successfully.',
      profileId: userId,
      departmentId: departmentId || null,
    })
  } catch {
    if (createdUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId)
    }

    return NextResponse.json(
      { error: 'Something went wrong while creating mentor.' },
      { status: 500 },
    )
  }
}
