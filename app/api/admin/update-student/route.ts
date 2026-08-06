import { NextResponse } from 'next/server'
import { callerHasPermission, getCallerFromBearerToken } from '@/lib/auth/admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

const ALLOWED_STATUSES = new Set(['active', 'inactive'])

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    const canEdit =
      (await callerHasPermission(caller.id, 'students.edit')) ||
      (await callerHasPermission(caller.id, 'users.edit'))

    if (!canEdit) {
      return NextResponse.json({ error: 'You do not have permission to edit students.' }, { status: 403 })
    }

    const body = await request.json()

    const studentId = String(body.studentId || body.student_id || '').trim()
    const fullName = String(body.fullName || body.full_name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const phone = String(body.phone || '').trim()
    const joiningDate = String(body.joiningDate || body.joining_date || '').trim()
    const statusRaw = String(body.status || 'active').trim().toLowerCase()
    const status = ALLOWED_STATUSES.has(statusRaw) ? statusRaw : 'active'

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required.' }, { status: 400 })
    }

    if (!fullName) {
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 })
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const { data: student, error: studentReadError } = await supabaseAdmin
      .from('students')
      .select('id, profile_id, status')
      .eq('id', studentId)
      .maybeSingle()

    if (studentReadError || !student) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 })
    }

    if (status === 'active' && !student.profile_id) {
      return NextResponse.json(
        { error: 'Active students must have a linked profile/login.' },
        { status: 400 },
      )
    }

    if (student.profile_id) {
      const { data: emailOwner } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .neq('id', student.profile_id)
        .maybeSingle()

      if (emailOwner) {
        return NextResponse.json({ error: 'Another user already uses this email.' }, { status: 409 })
      }

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name: fullName,
          email,
          status,
        })
        .eq('id', student.profile_id)

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 })
      }
    }

    const { error: studentUpdateError } = await supabaseAdmin
      .from('students')
      .update({
        phone: phone || null,
        joining_date: joiningDate || null,
        status,
      })
      .eq('id', studentId)

    if (studentUpdateError) {
      return NextResponse.json({ error: studentUpdateError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Student updated successfully.',
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong while updating the student.' },
      { status: 500 },
    )
  }
}
