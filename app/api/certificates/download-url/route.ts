import { NextResponse } from 'next/server'
import { getCallerFromBearerToken } from '@/lib/auth/admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

const CERTIFICATES_BUCKET = 'certificates'
const DOWNLOAD_EXPIRY = 3600 // 1 hour in seconds

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = caller.id

    const body = await request.json()
    const { filePath } = body

    if (!filePath) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 })
    }

    const certificateId = filePath.split('/')[0]
    const { data: cert } = await supabaseAdmin
      .from('certificates')
      .select('student_id, status')
      .eq('id', certificateId)
      .maybeSingle()

    if (!cert) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('parent_role_id')
      .eq('id', userId)
      .maybeSingle()

    const isStudent = userProfile?.parent_role_id === 'student'

    if (isStudent && (cert.student_id !== userId || cert.status !== 'issued')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin.storage
      .from(CERTIFICATES_BUCKET)
      .createSignedUrl(filePath, DOWNLOAD_EXPIRY)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
