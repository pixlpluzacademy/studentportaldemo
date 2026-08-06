import { NextResponse } from 'next/server'
import { callerHasPermission, getCallerFromBearerToken } from '@/lib/auth/admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = _request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = await callerHasPermission(caller.id, 'certificates.edit')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const { id: certificateId } = await params

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('certificates')
      .select('id, file_path, status')
      .eq('id', certificateId)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    if (!existing) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    if (!existing.file_path) {
      return NextResponse.json(
        { error: 'Upload a certificate file before issuing.' },
        { status: 400 },
      )
    }

    const { data, error } = await supabaseAdmin
      .from('certificates')
      .update({
        status: 'issued',
        issued_by: caller.id,
        issued_at: new Date().toISOString(),
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
