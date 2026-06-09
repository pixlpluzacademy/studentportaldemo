import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  let createdUserId: string | null = null

  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login again.' },
        { status: 401 }
      )
    }

    const { data: callerData, error: callerError } =
      await supabaseAdmin.auth.getUser(token)

    if (callerError || !callerData.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Invalid session.' },
        { status: 401 }
      )
    }

    const { data: callerProfile, error: callerProfileError } =
      await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', callerData.user.id)
        .single()

    if (
      callerProfileError ||
      !callerProfile ||
      !['admin', 'superadmin'].includes(callerProfile.role)
    ) {
      return NextResponse.json(
        { error: 'Only Admin and Super Admin can create mentors.' },
        { status: 403 }
      )
    }

    const formData = await request.formData()

    const fullName = String(formData.get('fullName') || '').trim()
    const email = String(formData.get('email') || '').trim().toLowerCase()
    const password = String(formData.get('password') || '').trim()
    const department = String(formData.get('department') || '').trim()
    const courseId = String(formData.get('courseId') || '').trim()
    const profileImage = formData.get('profileImage') as File | null

    if (!fullName || !email || !password || !courseId) {
      return NextResponse.json(
        { error: 'Full name, email, password, and course are required.' },
        { status: 400 }
      )
    }

    const { data: mentorCode, error: codeError } = await supabaseAdmin.rpc(
      'generate_mentor_code',
      {
        p_course_id: courseId,
      }
    )

    if (codeError || !mentorCode) {
      return NextResponse.json(
        { error: codeError?.message || 'Failed to generate mentor code.' },
        { status: 400 }
      )
    }

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json(
        { error: 'A user with this email already exists.' },
        { status: 409 }
      )
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: 'mentor',
        },
      })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Failed to create mentor user.' },
        { status: 400 }
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

        return NextResponse.json(
          { error: uploadError.message },
          { status: 400 }
        )
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from('mentor-profiles')
        .getPublicUrl(filePath)

      profilePictureUrl = publicUrlData.publicUrl
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: userId,
          full_name: fullName,
          email,
          role: 'mentor',
          avatar_url: profilePictureUrl,
        },
        {
          onConflict: 'id',
        }
      )

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)

      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      )
    }

    const { data: mentorData, error: mentorError } = await supabaseAdmin
      .from('mentors')
      .insert({
        profile_id: userId,
        mentor_code: mentorCode,
        course_id: courseId,
        department: department || null,
        profile_picture_url: profilePictureUrl,
        status: 'active',
      })
      .select('id, mentor_code')
      .single()

    if (mentorError || !mentorData) {
      await supabaseAdmin.auth.admin.deleteUser(userId)

      return NextResponse.json(
        { error: mentorError?.message || 'Failed to create mentor row.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Mentor created successfully.',
      mentorId: mentorData.id,
      mentorCode: mentorData.mentor_code,
    })
  } catch {
    if (createdUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId)
    }

    return NextResponse.json(
      { error: 'Something went wrong while creating mentor.' },
      { status: 500 }
    )
  }
}