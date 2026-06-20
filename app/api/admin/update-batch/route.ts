import { NextResponse } from 'next/server'
import { callerHasPermission, getCallerFromBearerToken } from '@/lib/auth/admin'
import { buildBatchSchedule } from '@/lib/data/batch-code'
import { mapUiStatusToDb, type BatchFormInput } from '@/lib/data/batches'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    if (!(await callerHasPermission(caller.id, 'batches.edit'))) {
      return NextResponse.json({ error: 'You do not have permission to edit batches.' }, { status: 403 })
    }

    const body = (await request.json()) as BatchFormInput & { batch_id?: string }

    const batchId = String(body.batch_id || '').trim()
    const courseId = String(body.course_id || '').trim()
    const hodId = String(body.hod_id || '').trim()
    const trainerId = String(body.trainer_id || '').trim()
    const name = String(body.name || '').trim()
    const startDate = String(body.start_date || '').trim()
    const endDate = String(body.end_date || '').trim()
    const classDayType = body.class_day_type || 'weekdays'
    const batchStartTime = String(body.batch_start_time || '').trim()
    const batchEndTime = String(body.batch_end_time || '').trim()
    const maxSeats = Number(body.max_seats)
    const classLink = String(body.class_link || '').trim()
    const status = mapUiStatusToDb(body.status || 'active')

    if (!batchId) {
      return NextResponse.json({ error: 'Batch ID is required.' }, { status: 400 })
    }

    if (!courseId) {
      return NextResponse.json({ error: 'Course is required.' }, { status: 400 })
    }

    if (!hodId || !trainerId) {
      return NextResponse.json({ error: 'HOD and trainer are required.' }, { status: 400 })
    }

    if (hodId === trainerId) {
      return NextResponse.json({ error: 'HOD and trainer must be different people.' }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: 'Batch name is required.' }, { status: 400 })
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Batch start and end dates are required.' }, { status: 400 })
    }

    if (!batchStartTime || !batchEndTime) {
      return NextResponse.json({ error: 'Batch start and end times are required.' }, { status: 400 })
    }

    if (!maxSeats || maxSeats < 1) {
      return NextResponse.json({ error: 'Maximum seats must be at least 1.' }, { status: 400 })
    }

    const { data: existingBatch, error: batchReadError } = await supabaseAdmin
      .from('batches')
      .select(
        `
        id,
        branch_id,
        mode,
        student_batch_enrollments (id)
      `,
      )
      .eq('id', batchId)
      .maybeSingle()

    if (batchReadError || !existingBatch) {
      return NextResponse.json({ error: 'Batch not found.' }, { status: 404 })
    }

    const enrolledCount = existingBatch.student_batch_enrollments?.length || 0

    if (maxSeats < enrolledCount) {
      return NextResponse.json(
        { error: `Maximum seats cannot be less than current enrollment (${enrolledCount}).` },
        { status: 400 },
      )
    }

    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select(
        `
        id,
        department:departments!inner (
          id,
          branch_id
        )
      `,
      )
      .eq('id', courseId)
      .maybeSingle()

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 400 })
    }

    const department = Array.isArray(course.department) ? course.department[0] : course.department

    if (!department || department.branch_id !== existingBatch.branch_id) {
      return NextResponse.json({ error: 'Course must belong to the same branch as the batch.' }, { status: 400 })
    }

    const staffIds = [hodId, trainerId]
    const { data: staffProfiles, error: staffError } = await supabaseAdmin
      .from('profiles')
      .select('id, parent_role_id')
      .in('id', staffIds)

    if (staffError || !staffProfiles || staffProfiles.length !== 2) {
      return NextResponse.json({ error: 'Selected HOD or trainer was not found.' }, { status: 400 })
    }

    for (const profile of staffProfiles) {
      if (profile.parent_role_id !== 'mentor') {
        return NextResponse.json({ error: 'Batch staff must be mentor users.' }, { status: 400 })
      }
    }

    const batchMode = existingBatch.mode
    const { error: batchUpdateError } = await supabaseAdmin
      .from('batches')
      .update({
        course_id: courseId,
        name,
        schedule: buildBatchSchedule(batchStartTime, batchEndTime),
        seat_capacity: maxSeats,
        start_date: startDate,
        end_date: endDate,
        class_day_type: classDayType,
        class_link: batchMode === 'online' ? classLink || null : null,
        status,
      })
      .eq('id', batchId)

    if (batchUpdateError) {
      return NextResponse.json({ error: batchUpdateError.message }, { status: 400 })
    }

    const { data: existingAssignments, error: assignReadError } = await supabaseAdmin
      .from('batch_staff_assignments')
      .select('id, staff_type, user_id')
      .eq('batch_id', batchId)
      .in('staff_type', ['hod', 'trainer'])

    if (assignReadError) {
      return NextResponse.json({ error: assignReadError.message }, { status: 400 })
    }

    const hodAssignment = existingAssignments?.find((row) => row.staff_type === 'hod')
    const trainerAssignment = existingAssignments?.find((row) => row.staff_type === 'trainer')

    if (hodAssignment) {
      const { error: hodUpdateError } = await supabaseAdmin
        .from('batch_staff_assignments')
        .update({ user_id: hodId, reports_to: null })
        .eq('id', hodAssignment.id)

      if (hodUpdateError) {
        return NextResponse.json({ error: hodUpdateError.message }, { status: 400 })
      }
    } else {
      const { error: hodInsertError } = await supabaseAdmin.from('batch_staff_assignments').insert({
        batch_id: batchId,
        user_id: hodId,
        staff_type: 'hod',
        reports_to: null,
      })

      if (hodInsertError) {
        return NextResponse.json({ error: hodInsertError.message }, { status: 400 })
      }
    }

    if (trainerAssignment) {
      const { error: trainerUpdateError } = await supabaseAdmin
        .from('batch_staff_assignments')
        .update({ user_id: trainerId, reports_to: hodId })
        .eq('id', trainerAssignment.id)

      if (trainerUpdateError) {
        return NextResponse.json({ error: trainerUpdateError.message }, { status: 400 })
      }
    } else {
      const { error: trainerInsertError } = await supabaseAdmin.from('batch_staff_assignments').insert({
        batch_id: batchId,
        user_id: trainerId,
        staff_type: 'trainer',
        reports_to: hodId,
      })

      if (trainerInsertError) {
        return NextResponse.json({ error: trainerInsertError.message }, { status: 400 })
      }
    }

    const { data: updatedBatch, error: updatedReadError } = await supabaseAdmin
      .from('batches')
      .select('id, code')
      .eq('id', batchId)
      .maybeSingle()

    if (updatedReadError || !updatedBatch) {
      return NextResponse.json({ error: 'Batch updated but could not reload details.' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      batchId: updatedBatch.id,
      batchCode: updatedBatch.code,
      message: `Batch updated successfully. Batch ID: ${updatedBatch.code}`,
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while updating the batch.' }, { status: 500 })
  }
}
