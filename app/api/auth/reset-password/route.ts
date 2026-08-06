import { NextResponse } from 'next/server'
import { hashResetToken } from '@/lib/auth/password-reset'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string
      password?: string
      confirmPassword?: string
    }

    const token = String(body.token || '').trim()
    const password = String(body.password || '')
    const confirmPassword = String(body.confirmPassword || '')

    if (!token) {
      return NextResponse.json({ ok: false, error: 'Reset token is required.' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'Password must be at least 6 characters.' },
        { status: 400 },
      )
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { ok: false, error: 'Password and confirm password do not match.' },
        { status: 400 },
      )
    }

    const tokenHash = hashResetToken(token)
    const nowIso = new Date().toISOString()

    const { data: resetRow, error: tokenError } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (tokenError || !resetRow) {
      return NextResponse.json(
        { ok: false, error: 'Invalid or expired reset link.' },
        { status: 400 },
      )
    }

    if (resetRow.used_at) {
      return NextResponse.json(
        { ok: false, error: 'This reset link was already used.' },
        { status: 400 },
      )
    }

    if (new Date(resetRow.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { ok: false, error: 'This reset link has expired. Request a new one.' },
        { status: 400 },
      )
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(resetRow.user_id, {
      password,
    })

    if (updateError) {
      console.error('auth password update failed:', updateError.message)
      return NextResponse.json(
        { ok: false, error: 'Could not update password.' },
        { status: 500 },
      )
    }

    await supabaseAdmin
      .from('password_reset_tokens')
      .update({ used_at: nowIso })
      .eq('id', resetRow.id)

    return NextResponse.json({
      ok: true,
      message: 'Password updated successfully. You can log in now.',
    })
  } catch (error) {
    console.error('reset-password error:', error)
    return NextResponse.json({ ok: false, error: 'Unexpected error.' }, { status: 500 })
  }
}
