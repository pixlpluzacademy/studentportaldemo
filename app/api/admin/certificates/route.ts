import { NextResponse } from 'next/server'
import { callerHasPermission, getCallerFromBearerToken } from '@/lib/auth/admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = await callerHasPermission(caller.id, 'certificates.view')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const search = url.searchParams.get('search')

    let query = supabaseAdmin.from('certificates').select(
      `
      id,
      student_id,
      batch_id,
      course_id,
      title,
      certificate_no,
      status,
      file_path,
      file_name,
      issued_by,
      issued_at,
      revoked_by,
      revoked_at,
      revoke_reason,
      created_at,
      updated_at,
      student:student_id(full_name),
      batch:batch_id(name),
      course:course_id(name)
    `
    )

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let rows = data || []

    if (search) {
      const term = search.toLowerCase()
      rows = rows.filter((row: any) => {
        const studentName = row.student?.full_name || ''
        const batchName = row.batch?.name || ''
        const courseName = row.course?.name || ''
        return (
          studentName.toLowerCase().includes(term) ||
          batchName.toLowerCase().includes(term) ||
          courseName.toLowerCase().includes(term) ||
          row.title.toLowerCase().includes(term) ||
          row.certificate_no.toLowerCase().includes(term)
        )
      })
    }

    return NextResponse.json({ certificates: rows })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
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

    const body = await request.json()
    const { studentId, batchId, courseId, title, certificateNo } = body

    if (!studentId || !batchId || !certificateNo) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    let resolvedCourseId = courseId || null
    if (!resolvedCourseId) {
      const { data: batch } = await supabaseAdmin
        .from('batches')
        .select('course_id')
        .eq('id', batchId)
        .maybeSingle()
      resolvedCourseId = batch?.course_id || null
    }

    const { data, error } = await supabaseAdmin.from('certificates').insert({
      student_id: studentId,
      batch_id: batchId,
      course_id: resolvedCourseId,
      title: title || 'Course Completion Certificate',
      certificate_no: certificateNo,
      status: 'pending',
    }).select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ certificate: data?.[0] }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
