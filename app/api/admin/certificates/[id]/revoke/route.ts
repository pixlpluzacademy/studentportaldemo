import { NextResponse } from 'next/server'
import { callerHasPermission, getCallerFromBearerToken } from '@/lib/auth/admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = await callerHasPermission(caller.id, 'certificates.edit')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const reason = typeof body?.reason === 'string' ? body.reason : ''
    const { id: certificateId } = await params

    const { data, error } = await supabaseAdmin
      .from('certificates')
      .update({
        status: 'revoked',
        revoked_by: caller.id,
        revoked_at: new Date().toISOString(),
        revoke_reason: reason || null,
      })
      .eq('id', certificateId)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    return NextResponse.json({ certificate: data[0] })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
