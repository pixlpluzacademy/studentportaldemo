import { NextResponse } from 'next/server'
import { callerHasPermission, getCallerFromBearerToken } from '@/lib/auth/admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

const CERTIFICATES_BUCKET = 'certificates'

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

    const hasPermission = await callerHasPermission(caller.id, 'certificates.upload')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const { id: certificateId } = await params
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const { data: cert } = await supabaseAdmin
      .from('certificates')
      .select('id')
      .eq('id', certificateId)
      .maybeSingle()

    if (!cert) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    const buffer = await file.arrayBuffer()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileName = `${certificateId}-${Date.now()}-${safeName}`
    const filePath = `${certificateId}/${fileName}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from(CERTIFICATES_BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data, error } = await supabaseAdmin
      .from('certificates')
      .update({
        file_path: filePath,
        file_name: file.name,
      })
      .eq('id', certificateId)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ certificate: data?.[0] })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
