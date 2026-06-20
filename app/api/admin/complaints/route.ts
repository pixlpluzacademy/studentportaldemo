import { NextResponse } from 'next/server'
import { callerHasPermission, getCallerFromBearerToken } from '@/lib/auth/admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

type DbComplaintStatus = 'open' | 'in_review' | 'resolved' | 'rejected'
type DbStaffType = 'hod' | 'mentor' | 'trainer' | 'final_qa'

async function callerIsSuperAdmin(userId: string) {
  const { data } = await supabaseAdmin.rpc('is_super_admin', { p_user_id: userId })
  return Boolean(data)
}

async function callerHasAllBranchScope(userId: string) {
  const { data } = await supabaseAdmin.rpc('has_all_branch_scope', { p_user_id: userId })
  return Boolean(data)
}

async function callerCanManageComplaintsInBranch(userId: string, branchId: string) {
  if (await callerIsSuperAdmin(userId)) return true

  const canManage =
    (await callerHasPermission(userId, 'complaints.edit')) ||
    (await callerHasPermission(userId, 'complaints.resolve'))

  if (!canManage) return false

  if (await callerHasAllBranchScope(userId)) return true

  const { data: assignment } = await supabaseAdmin
    .from('user_branch_assignments')
    .select('id')
    .eq('user_id', userId)
    .eq('branch_id', branchId)
    .maybeSingle()

  return Boolean(assignment)
}

async function validateAssignedMentor(input: {
  studentId: string
  mentorId: string
  batchId: string
  branchId: string
  mentorStaffType: DbStaffType
}) {
  const { data, error } = await supabaseAdmin.rpc('student_assigned_mentor_ids', {
    p_student_id: input.studentId,
  })

  if (error) return false

  const rows = (data || []) as Array<{
    mentor_id: string
    batch_id: string
    branch_id: string
    mentor_staff_type: DbStaffType
  }>

  return rows.some(
    (row) =>
      row.mentor_id === input.mentorId &&
      row.batch_id === input.batchId &&
      row.branch_id === input.branchId &&
      row.mentor_staff_type === input.mentorStaffType,
  )
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    if (!(await callerHasPermission(caller.id, 'complaints.create')) && !(await callerIsSuperAdmin(caller.id))) {
      return NextResponse.json({ error: 'You do not have permission to create complaints.' }, { status: 403 })
    }

    const body = (await request.json()) as {
      mentorId?: string
      batchId?: string
      branchId?: string
      mentorStaffType?: DbStaffType
      title?: string
      category?: string
      description?: string
      priority?: string
    }

    const mentorId = String(body.mentorId || '').trim()
    const batchId = String(body.batchId || '').trim()
    const branchId = String(body.branchId || '').trim()
    const mentorStaffType = body.mentorStaffType
    const title = String(body.title || '').trim()
    const category = String(body.category || '').trim()
    const description = String(body.description || '').trim()
    const priority = String(body.priority || 'medium').trim().toLowerCase()

    if (!mentorId || !batchId || !branchId || !mentorStaffType || !title || !category || !description) {
      return NextResponse.json({ error: 'All complaint fields are required.' }, { status: 400 })
    }

    if (!['hod', 'mentor', 'trainer', 'final_qa'].includes(mentorStaffType)) {
      return NextResponse.json({ error: 'Invalid batch mentor assignment.' }, { status: 400 })
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
      mentorStaffType,
    })

    if (!isAssigned) {
      return NextResponse.json(
        { error: 'You can only complain against a mentor assigned to your batch.' },
        { status: 403 },
      )
    }

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('batches')
      .select('branch_id')
      .eq('id', batchId)
      .maybeSingle()

    if (batchError || !batch || batch.branch_id !== branchId) {
      return NextResponse.json({ error: 'Invalid batch or branch for this complaint.' }, { status: 400 })
    }

    const { data: row, error: insertError } = await supabaseAdmin
      .from('complaints')
      .insert({
        student_id: student.id,
        mentor_id: mentorId,
        branch_id: branchId,
        batch_id: batchId,
        mentor_staff_type: mentorStaffType,
        title,
        category,
        description,
        priority,
        status: 'open',
      })
      .select('id')
      .single()

    if (insertError || !row) {
      return NextResponse.json({ error: insertError?.message || 'Could not save complaint.' }, { status: 400 })
    }

    return NextResponse.json({ success: true, complaintId: row.id })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while creating the complaint.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    const body = (await request.json()) as {
      complaintId?: string
      status?: DbComplaintStatus
      adminReply?: string
    }

    const complaintId = String(body.complaintId || '').trim()
    const status = body.status
    const adminReply = String(body.adminReply || '').trim()

    if (!complaintId || !status) {
      return NextResponse.json({ error: 'Complaint id and status are required.' }, { status: 400 })
    }

    if (!['open', 'in_review', 'resolved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid complaint status.' }, { status: 400 })
    }

    const { data: complaint, error: complaintError } = await supabaseAdmin
      .from('complaints')
      .select('id, branch_id')
      .eq('id', complaintId)
      .maybeSingle()

    if (complaintError || !complaint) {
      return NextResponse.json({ error: 'Complaint not found.' }, { status: 404 })
    }

    const canManage = await callerCanManageComplaintsInBranch(caller.id, complaint.branch_id)

    if (!canManage) {
      return NextResponse.json({ error: 'You do not have permission to update this complaint.' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const payload: Record<string, unknown> = {
      status,
      updated_at: now,
    }

    if (adminReply) {
      payload.admin_reply = adminReply
      payload.replied_by = caller.id
      payload.replied_at = now
    }

    if (status === 'resolved' || status === 'rejected') {
      payload.resolved_by = caller.id
      payload.resolved_at = now
    }

    const { error: updateError } = await supabaseAdmin.from('complaints').update(payload).eq('id', complaintId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while updating the complaint.' }, { status: 500 })
  }
}
