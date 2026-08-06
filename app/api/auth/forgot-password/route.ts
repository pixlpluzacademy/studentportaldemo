import { NextResponse } from 'next/server'
import { createResetToken, getAppBaseUrl, hashResetToken } from '@/lib/auth/password-reset'
import { sendPasswordResetEmail } from '@/lib/mail/smtp'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string }
    const email = String(body.email || '')
      .trim()
      .toLowerCase()

    // Always return the same message to avoid email enumeration.
    const okResponse = NextResponse.json({
      ok: true,
      message: 'If that email exists, a reset link has been sent.',
    })

    if (!email || !email.includes('@')) {
      return okResponse
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, status')
      .ilike('email', email)
      .maybeSingle()

    if (profileError || !profile?.id || profile.status === 'inactive') {
      return okResponse
    }

    const token = createResetToken()
    const tokenHash = hashResetToken(token)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    // Invalidate previous unused tokens for this user.
    await supabaseAdmin
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', profile.id)
      .is('used_at', null)

    const { error: insertError } = await supabaseAdmin.from('password_reset_tokens').insert({
      user_id: profile.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })

    if (insertError) {
      console.error('password_reset_tokens insert failed:', insertError.message)
      return NextResponse.json({ ok: false, error: 'Could not start password reset.' }, { status: 500 })
    }

    const baseUrl = getAppBaseUrl(request.url)
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`

    try {
      await sendPasswordResetEmail({
        to: profile.email || email,
        resetUrl,
      })
    } catch (mailError) {
      console.error('SMTP send failed:', mailError)
      return NextResponse.json(
        { ok: false, error: 'Could not send reset email. Check SMTP settings.' },
        { status: 500 },
      )
    }

    return okResponse
  } catch (error) {
    console.error('forgot-password error:', error)
    return NextResponse.json({ ok: false, error: 'Unexpected error.' }, { status: 500 })
  }
}
