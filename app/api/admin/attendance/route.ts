import { NextResponse } from 'next/server'
import { callerHasPermission, getCallerFromBearerToken } from '@/lib/auth/admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

const VALID_STATUSES = new Set(['present', 'absent', 'late', 'unmarked'])

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

async function callerIsSuperAdmin(userId: string) {
  const { data } = await supabaseAdmin.rpc('is_super_admin', { p_user_id: userId })
  return Boolean(data)
}

async function callerCanMarkBatch(userId: string, batchId: string) {
  if (await callerIsSuperAdmin(userId)) return true

  const canMark =
    (await callerHasPermission(userId, 'attendance.mark')) ||
    (await callerHasPermission(userId, 'attendance.edit'))

  if (!canMark) return false

  const { data: assignment } = await supabaseAdmin
    .from('batch_staff_assignments')
    .select('id')
    .eq('batch_id', batchId)
    .eq('user_id', userId)
    .maybeSingle()

  if (assignment) return true

  const { data: batch } = await supabaseAdmin.from('batches').select('branch_id').eq('id', batchId).maybeSingle()

  if (!batch?.branch_id) return false

  const { data: branchAssignment } = await supabaseAdmin
    .from('user_branch_assignments')
    .select('id')
    .eq('user_id', userId)
    .eq('branch_id', batch.branch_id)
    .maybeSingle()

  return Boolean(branchAssignment)
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    const body = (await request.json()) as {
      batchId?: string
      attendanceDate?: string
      classLink?: string
      marks?: { studentId: string; status: string; note?: string }[]
    }

    const batchId = String(body.batchId || '').trim()
    const attendanceDate = String(body.attendanceDate || '').trim()
    const classLink = String(body.classLink || '').trim()
    const marks = Array.isArray(body.marks) ? body.marks : []

    if (!batchId || !attendanceDate) {
      return NextResponse.json({ error: 'Batch and attendance date are required.' }, { status: 400 })
    }

    const today = todayIsoDate()
    if (attendanceDate > today) {
      return NextResponse.json({ error: 'Attendance cannot be marked for a future date.' }, { status: 400 })
    }

    if (!marks.length) {
      return NextResponse.json({ error: 'No attendance marks provided.' }, { status: 400 })
    }

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('batches')
      .select('id, mode, class_link')
      .eq('id', batchId)
      .single()

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Selected batch not found.' }, { status: 400 })
    }

    // Class link is optional for attendance. Prefer submitted link, then existing day link, then batch link.
    let resolvedClassLink = classLink
    if (batch.mode === 'online' && !resolvedClassLink) {
      const { data: existingLink } = await supabaseAdmin
        .from('student_attendance_records')
        .select('class_link')
        .eq('batch_id', batchId)
        .eq('attendance_date', attendanceDate)
        .not('class_link', 'is', null)
        .limit(1)
        .maybeSingle()

      resolvedClassLink =
        String(existingLink?.class_link || '').trim() || String(batch.class_link || '').trim()
    }

    const canMark = await callerCanMarkBatch(caller.id, batchId)

    if (!canMark) {
      return NextResponse.json({ error: 'You do not have permission to mark attendance for this batch.' }, { status: 403 })
    }

    const rows = marks
      .filter((mark) => mark.studentId && VALID_STATUSES.has(mark.status))
      .map((mark) => ({
        batch_id: batchId,
        student_id: mark.studentId,
        attendance_date: attendanceDate,
        status: mark.status,
        notes: mark.note?.trim() || null,
        class_link: batch.mode === 'online' ? resolvedClassLink || null : null,
        marked_by: caller.id,
        updated_at: new Date().toISOString(),
      }))

    if (!rows.length) {
      return NextResponse.json({ error: 'No valid attendance marks provided.' }, { status: 400 })
    }

    const { error: upsertError } = await supabaseAdmin
      .from('student_attendance_records')
      .upsert(rows, { onConflict: 'batch_id,student_id,attendance_date' })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while saving attendance.' }, { status: 500 })
  }
}
