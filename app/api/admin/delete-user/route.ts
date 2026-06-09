import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
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
      !['admin', 'superadmin', 'super admin'].includes(callerProfile.role)
    ) {
      return NextResponse.json(
        { error: 'Only Admin and Super Admin can delete users.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const profileId = String(body.profileId || '').trim()
    const mentorId = String(body.mentorId || '').trim()

    if (!profileId || !mentorId) {
      return NextResponse.json(
        { error: 'Profile ID and Mentor ID are required.' },
        { status: 400 }
      )
    }

    if (profileId === callerData.user.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account.' },
        { status: 400 }
      )
    }

    const { error: mentorDeleteError } = await supabaseAdmin
      .from('mentors')
      .delete()
      .eq('id', mentorId)

    if (mentorDeleteError) {
      return NextResponse.json(
        { error: mentorDeleteError.message },
        { status: 400 }
      )
    }

    const { error: authDeleteError } =
      await supabaseAdmin.auth.admin.deleteUser(profileId)

    if (authDeleteError) {
      return NextResponse.json(
        { error: authDeleteError.message },
        { status: 400 }
      )
    }

    await supabaseAdmin.from('profiles').delete().eq('id', profileId)

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully.',
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong while deleting user.' },
      { status: 500 }
    )
  }
}