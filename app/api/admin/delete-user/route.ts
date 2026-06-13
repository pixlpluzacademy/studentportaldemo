import { NextResponse } from 'next/server'
import { callerHasPermission, getCallerFromBearerToken, getCallerProfile } from '@/lib/auth/admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    const canDelete = await callerHasPermission(caller.id, 'users.delete')

    if (!canDelete) {
      return NextResponse.json({ error: 'You do not have permission to delete users.' }, { status: 403 })
    }

    const body = await request.json()
    const profileId = String(body.profileId || '').trim()
    const studentId = String(body.studentId || body.mentorId || '').trim()

    if (!profileId) {
      return NextResponse.json({ error: 'Profile ID is required.' }, { status: 400 })
    }

    if (profileId === caller.id) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
    }

    const targetProfile = await getCallerProfile(profileId)
    const callerProfile = await getCallerProfile(caller.id)

    if (
      targetProfile?.parent_role_id === 'super_admin' &&
      callerProfile?.parent_role_id !== 'super_admin'
    ) {
      return NextResponse.json(
        { error: 'Only Super Admin can delete Super Admin users.' },
        { status: 403 },
      )
    }

    if (studentId) {
      await supabaseAdmin.from('students').delete().eq('id', studentId)
    }

    await supabaseAdmin.from('batch_staff_assignments').delete().eq('user_id', profileId)
    await supabaseAdmin.from('user_permission_profiles').delete().eq('user_id', profileId)
    await supabaseAdmin.from('user_branch_assignments').delete().eq('user_id', profileId)

    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(profileId)

    if (authDeleteError) {
      return NextResponse.json({ error: authDeleteError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully.',
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong while deleting user.' },
      { status: 500 },
    )
  }
}
