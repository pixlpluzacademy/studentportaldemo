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

    if (!(await callerHasPermission(caller.id, 'batches.create'))) {
      return NextResponse.json({ error: 'You do not have permission to create batches.' }, { status: 403 })
    }

    const body = (await request.json()) as BatchFormInput & { branch_id?: string }

    const branchId = String(body.branch_id || '').trim()
    const courseId = String(body.course_id || '').trim()
    const hodId = String(body.hod_id || '').trim()
    const trainerId = String(body.trainer_id || '').trim()
    const name = String(body.name || '').trim()
    const startDate = String(body.start_date || '').trim()
    const endDate = String(body.end_date || '').trim()
    const batchMode = body.batch_mode === 'online' ? 'online' : 'offline'
    const classDayType = body.class_day_type || 'weekdays'
    const batchStartTime = String(body.batch_start_time || '').trim()
    const batchEndTime = String(body.batch_end_time || '').trim()
    const maxSeats = Number(body.max_seats)
    const classLink = String(body.class_link || '').trim()
    const status = mapUiStatusToDb(body.status || 'active')

    if (!branchId) {
      return NextResponse.json({ error: 'Branch is required.' }, { status: 400 })
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

    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select(
        `
        id,
        department:departments!inner (
          id,
          branch_id,
          department_code
        )
      `,
      )
      .eq('id', courseId)
      .maybeSingle()

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 400 })
    }

    const department = Array.isArray(course.department) ? course.department[0] : course.department

    if (!department || department.branch_id !== branchId) {
      return NextResponse.json({ error: 'Course must belong to the selected branch.' }, { status: 400 })
    }

    if (!department.department_code?.trim()) {
      return NextResponse.json(
        { error: 'Department code is missing. Set it on the department before creating a batch.' },
        { status: 400 },
      )
    }

    const { data: branch, error: branchError } = await supabaseAdmin
      .from('branches')
      .select('id, code')
      .eq('id', branchId)
      .maybeSingle()

    if (branchError || !branch) {
      return NextResponse.json({ error: 'Branch not found.' }, { status: 400 })
    }

    if (!branch.code?.trim()) {
      return NextResponse.json(
        { error: 'Branch code is missing. Set it on the branch before creating a batch.' },
        { status: 400 },
      )
    }

    const staffIds = [hodId, trainerId]
    const { data: staffProfiles, error: staffError } = await supabaseAdmin
      .from('profiles')
      .select('id, parent_role_id, branch_id')
      .in('id', staffIds)

    if (staffError || !staffProfiles || staffProfiles.length !== 2) {
      return NextResponse.json({ error: 'Selected HOD or trainer was not found.' }, { status: 400 })
    }

    for (const profile of staffProfiles) {
      if (profile.parent_role_id !== 'mentor') {
        return NextResponse.json({ error: 'Batch staff must be mentor users.' }, { status: 400 })
      }
    }

    const { data: batchCode, error: codeError } = await supabaseAdmin.rpc('generate_batch_code', {
      p_branch_id: branchId,
      p_course_id: courseId,
      p_mode: batchMode,
      p_start_date: startDate,
    })

    if (codeError || !batchCode) {
      return NextResponse.json(
        { error: codeError?.message || 'Could not generate batch code.' },
        { status: 400 },
      )
    }

    const { data: batchRow, error: batchError } = await supabaseAdmin
      .from('batches')
      .insert({
        branch_id: branchId,
        course_id: courseId,
        name,
        code: batchCode,
        mode: batchMode,
        schedule: buildBatchSchedule(batchStartTime, batchEndTime),
        seat_capacity: maxSeats,
        start_date: startDate,
        end_date: endDate,
        class_day_type: classDayType,
        class_link: batchMode === 'online' ? classLink || null : null,
        status,
      })
      .select('id, code')
      .single()

    if (batchError || !batchRow) {
      return NextResponse.json({ error: batchError?.message || 'Could not save batch.' }, { status: 400 })
    }

    const { error: hodAssignError } = await supabaseAdmin.from('batch_staff_assignments').insert({
      batch_id: batchRow.id,
      user_id: hodId,
      staff_type: 'hod',
      reports_to: null,
    })

    if (hodAssignError) {
      await supabaseAdmin.from('batches').delete().eq('id', batchRow.id)
      return NextResponse.json({ error: hodAssignError.message }, { status: 400 })
    }

    const { error: trainerAssignError } = await supabaseAdmin.from('batch_staff_assignments').insert({
      batch_id: batchRow.id,
      user_id: trainerId,
      staff_type: 'trainer',
      reports_to: hodId,
    })

    if (trainerAssignError) {
      await supabaseAdmin.from('batches').delete().eq('id', batchRow.id)
      return NextResponse.json({ error: trainerAssignError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      batchId: batchRow.id,
      batchCode: batchRow.code,
      message: `Batch created successfully. Batch ID: ${batchRow.code}`,
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while creating the batch.' }, { status: 500 })
  }
}
