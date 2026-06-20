import { NextResponse } from 'next/server'
import { callerHasPermission, getCallerFromBearerToken } from '@/lib/auth/admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

type DbStaffType = 'mentor' | 'trainer'

async function callerIsSuperAdmin(userId: string) {
  const { data } = await supabaseAdmin.rpc('is_super_admin', { p_user_id: userId })
  return Boolean(data)
}

async function validateAssignedMentor(input: {
  studentId: string
  mentorId: string
  batchId: string
  branchId: string
}) {
  const { data, error } = await supabaseAdmin.rpc('student_assigned_mentor_ids', {
    p_student_id: input.studentId,
  })

  if (error) return false

  const rows = (data || []) as Array<{
    mentor_id: string
    batch_id: string
    branch_id: string
  }>

  return rows.some(
    (row) =>
      row.mentor_id === input.mentorId &&
      row.batch_id === input.batchId &&
      row.branch_id === input.branchId,
  )
}

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    const summary = new URL(request.url).searchParams.get('summary') === '1'

    if (!summary) {
      return NextResponse.json({ error: 'Unsupported request.' }, { status: 400 })
    }

    if (!(await callerHasPermission(caller.id, 'ratings.view')) && !(await callerIsSuperAdmin(caller.id))) {
      return NextResponse.json({ error: 'You do not have permission to view rating summary.' }, { status: 403 })
    }

    const { data: avgRow } = await supabaseAdmin
      .from('mentor_ratings')
      .select('rating')
      .eq('mentor_id', caller.id)

    const ratings = (avgRow || []).map((row) => Number(row.rating))
    const totalRatings = ratings.length
    const averageRating =
      totalRatings > 0 ? Number((ratings.reduce((sum, value) => sum + value, 0) / totalRatings).toFixed(1)) : null

    const distribution: Record<string, number> = {}
    ratings.forEach((rating) => {
      const key = String(rating)
      distribution[key] = (distribution[key] || 0) + 1
    })

    return NextResponse.json({
      averageRating,
      totalRatings,
      distribution,
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while loading rating summary.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    if (!(await callerHasPermission(caller.id, 'ratings.submit')) && !(await callerIsSuperAdmin(caller.id))) {
      return NextResponse.json({ error: 'You do not have permission to submit ratings.' }, { status: 403 })
    }

    const body = (await request.json()) as {
      mentorId?: string
      batchId?: string
      branchId?: string
      rating?: number
    }

    const mentorId = String(body.mentorId || '').trim()
    const batchId = String(body.batchId || '').trim()
    const branchId = String(body.branchId || '').trim()
    const rating = Number(body.rating)

    if (!mentorId || !batchId || !branchId || !rating) {
      return NextResponse.json({ error: 'Mentor, batch, branch, and rating are required.' }, { status: 400 })
    }

    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json({ error: 'Rating must be a whole number between 1 and 5.' }, { status: 400 })
    }

    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('profile_id', caller.id)
      .maybeSingle()

    if (studentError || !student) {
      return NextResponse.json({ error: 'Student profile not found.' }, { status: 400 })
    }

    const isAssigned = await validateAssignedMentor({
      studentId: student.id,
      mentorId,
      batchId,
      branchId,
    })

    if (!isAssigned) {
      return NextResponse.json({ error: 'You can only rate a mentor assigned to your batch.' }, { status: 403 })
    }

    const { error: upsertError } = await supabaseAdmin.from('mentor_ratings').upsert(
      {
        student_id: student.id,
        mentor_id: mentorId,
        branch_id: branchId,
        batch_id: batchId,
        rating,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id,mentor_id' },
    )

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 400 })
    }

    await supabaseAdmin.rpc('sync_mentor_average_rating', { p_mentor_id: mentorId })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while saving the rating.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    const ratingId = new URL(request.url).searchParams.get('id')?.trim()

    if (!ratingId) {
      return NextResponse.json({ error: 'Rating id is required.' }, { status: 400 })
    }

    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('profile_id', caller.id)
      .maybeSingle()

    if (studentError || !student) {
      return NextResponse.json({ error: 'Student profile not found.' }, { status: 400 })
    }

    const { data: rating, error: ratingError } = await supabaseAdmin
      .from('mentor_ratings')
      .select('id, mentor_id, student_id')
      .eq('id', ratingId)
      .maybeSingle()

    if (ratingError || !rating) {
      return NextResponse.json({ error: 'Rating not found.' }, { status: 404 })
    }

    if (rating.student_id !== student.id) {
      return NextResponse.json({ error: 'You can only remove your own rating.' }, { status: 403 })
    }

    const { error: deleteError } = await supabaseAdmin.from('mentor_ratings').delete().eq('id', ratingId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    await supabaseAdmin.rpc('sync_mentor_average_rating', { p_mentor_id: rating.mentor_id })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while removing the rating.' }, { status: 500 })
  }
}
