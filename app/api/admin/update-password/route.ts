import { NextResponse } from 'next/server'
import { getCallerFromBearerToken, getCallerProfile } from '@/lib/auth/admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    const callerProfile = await getCallerProfile(caller.id)
    if (
      !callerProfile ||
      (callerProfile.parent_role_id !== 'super_admin' &&
        callerProfile.parent_role_id !== 'company_admin')
    ) {
      return NextResponse.json(
        { error: 'Only Super Admin or Company Admin can update staff passwords.' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const profileId = String(body.profileId || body.userId || '').trim()
    const password = String(body.password || '')
    const confirmPassword = String(body.confirmPassword || body.confirm_password || password)

    if (!profileId) {
      return NextResponse.json({ error: 'Profile ID is required.' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters.' },
        { status: 400 },
      )
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Password and confirm password do not match.' },
        { status: 400 },
      )
    }

    const targetProfile = await getCallerProfile(profileId)
    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }

    if (
      targetProfile.parent_role_id === 'super_admin' &&
      callerProfile.parent_role_id !== 'super_admin'
    ) {
      return NextResponse.json(
        { error: 'Only Super Admin can update Super Admin passwords.' },
        { status: 403 },
      )
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profileId, {
      password,
    })

    if (updateError) {
      console.error('admin password update failed:', updateError.message)
      return NextResponse.json({ error: 'Could not update password.' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully.',
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong while updating password.' },
      { status: 500 },
    )
  }
}
