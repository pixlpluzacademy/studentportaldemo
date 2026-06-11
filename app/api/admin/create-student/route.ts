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
      (await callerHasPermission(caller.id, 'students.create')) ||
      (await callerHasPermission(caller.id, 'users.create'))

    if (!canCreate) {
      return NextResponse.json({ error: 'You do not have permission to create students.' }, { status: 403 })
    }

    const formData = await request.formData()

    const fullName = String(formData.get('fullName') || '').trim()
    const email = String(formData.get('email') || '').trim().toLowerCase()
    const password = String(formData.get('password') || '').trim()
    const phone = String(formData.get('phone') || '').trim()
    const batchId = String(formData.get('batchId') || formData.get('cohortId') || '').trim()
    const profileImage = formData.get('profileImage') as File | null

    if (!fullName || !email || !password || !batchId) {
      return NextResponse.json(
        { error: 'Full name, email, password, and batch are required.' },
        { status: 400 },
      )
    }

    const { data: batchData, error: batchError } = await supabaseAdmin
      .from('batches')
      .select('id, code, name')
      .eq('id', batchId)
      .single()

    if (batchError || !batchData) {
      return NextResponse.json({ error: 'Selected batch not found.' }, { status: 400 })
    }

    const { data: studentCode, error: codeError } = await supabaseAdmin.rpc('generate_student_code', {
      p_batch_id: batchId,
    })

    if (codeError || !studentCode) {
      return NextResponse.json(
        { error: codeError?.message || 'Failed to generate student code.' },
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

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        parent_role_id: 'student',
        permission_profile_slug: 'student_default',
      },
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Failed to create student user.' },
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
        .from('student-profiles')
        .upload(filePath, profileImage, {
          upsert: true,
          contentType: profileImage.type,
        })

      if (uploadError) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return NextResponse.json({ error: uploadError.message }, { status: 400 })
      }

      const { data: publicUrlData } = supabaseAdmin.storage.from('student-profiles').getPublicUrl(filePath)
      profilePictureUrl = publicUrlData.publicUrl

      await supabaseAdmin.from('profiles').update({ avatar_url: profilePictureUrl }).eq('id', userId)
    }

    const { data: batchRow } = await supabaseAdmin
      .from('batches')
      .select('branch_id')
      .eq('id', batchId)
      .single()

    if (batchRow?.branch_id) {
      await supabaseAdmin.from('profiles').update({ branch_id: batchRow.branch_id }).eq('id', userId)
      await supabaseAdmin.from('user_branch_assignments').upsert({
        user_id: userId,
        branch_id: batchRow.branch_id,
      })
    }

    const { data: studentRow, error: studentError } = await supabaseAdmin
      .from('students')
      .insert({
        profile_id: userId,
        student_code: studentCode,
        phone: phone || null,
        status: 'active',
        joining_date: new Date().toISOString().split('T')[0],
        profile_picture_url: profilePictureUrl,
      })
      .select('id')
      .single()

    if (studentError || !studentRow) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: studentError?.message || 'Failed to create student record.' },
        { status: 400 },
      )
    }

    const { error: enrollmentError } = await supabaseAdmin.from('student_batch_enrollments').insert({
      student_id: studentRow.id,
      batch_id: batchId,
      status: 'active',
    })

    if (enrollmentError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: enrollmentError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Student created successfully.',
      studentCode,
    })
  } catch {
    if (createdUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId)
    }

    return NextResponse.json(
      { error: 'Something went wrong while creating student.' },
      { status: 500 },
    )
  }
}
