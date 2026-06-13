import { NextResponse } from 'next/server'
import { callerHasPermission, getCallerFromBearerToken } from '@/lib/auth/admin'
import { validateHodAssignment } from '@/lib/auth/validate-mentor-hod'
import { supabaseAdmin } from '@/lib/supabase-admin'

const FINAL_QA_SLUG = 'mentor_final_qa'

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    const canEdit =
      (await callerHasPermission(caller.id, 'mentors.edit')) ||
      (await callerHasPermission(caller.id, 'users.edit'))

    if (!canEdit) {
      return NextResponse.json({ error: 'You do not have permission to edit mentors.' }, { status: 403 })
    }

    const body = await request.json()

    const mentorId = String(body.mentorId || body.mentor_id || '').trim()
    const branchId = String(body.branchId || body.branch_id || '').trim()
    const fullName = String(body.full_name || body.fullName || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const departmentId = String(body.department_id || body.departmentId || '').trim()
    const permissionProfileId = String(body.permission_profile_id || body.permissionProfileId || '').trim()
    const reportsToRaw = String(body.reports_to || body.reportsTo || '').trim()
    const reportsTo = reportsToRaw || null
    const phone = String(body.phone || '').trim()
    const joiningDate = String(body.joining_date || body.joiningDate || '').trim()
    const status = body.status === 'inactive' ? 'inactive' : 'active'

    if (!mentorId || !branchId || !fullName || !email || !departmentId || !permissionProfileId) {
      return NextResponse.json({ error: 'Missing required mentor fields.' }, { status: 400 })
    }

    if (reportsTo === mentorId) {
      return NextResponse.json({ error: 'A mentor cannot report to themselves.' }, { status: 400 })
    }

    const { data: existingDetails, error: detailsReadError } = await supabaseAdmin
      .from('mentor_details')
      .select('profile_id, branch_id')
      .eq('profile_id', mentorId)
      .maybeSingle()

    if (detailsReadError) {
      return NextResponse.json({ error: detailsReadError.message }, { status: 400 })
    }

    if (existingDetails && existingDetails.branch_id !== branchId) {
      return NextResponse.json({ error: 'Mentor does not belong to this branch.' }, { status: 400 })
    }

    const { data: permissionProfile, error: profileReadError } = await supabaseAdmin
      .from('permission_profiles')
      .select('id, slug, parent_role_id')
      .eq('id', permissionProfileId)
      .maybeSingle()

    if (profileReadError || !permissionProfile) {
      return NextResponse.json({ error: 'Permission profile not found.' }, { status: 400 })
    }

    if (permissionProfile.parent_role_id !== 'mentor' || permissionProfile.slug === FINAL_QA_SLUG) {
      return NextResponse.json({ error: 'Invalid mentor type for this directory.' }, { status: 400 })
    }

    const { data: department, error: departmentError } = await supabaseAdmin
      .from('departments')
      .select('id, branch_id')
      .eq('id', departmentId)
      .maybeSingle()

    if (departmentError || !department) {
      return NextResponse.json({ error: 'Department not found.' }, { status: 400 })
    }

    if (department.branch_id !== branchId) {
      return NextResponse.json({ error: 'Department must belong to the selected branch.' }, { status: 400 })
    }

    if (reportsTo) {
      const hodCheck = await validateHodAssignment(supabaseAdmin, reportsTo, branchId)
      if (!hodCheck.ok) {
        return NextResponse.json({ error: hodCheck.error }, { status: 400 })
      }
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        email,
        parent_role_id: 'mentor',
        status,
        branch_id: branchId,
      })
      .eq('id', mentorId)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    await supabaseAdmin.from('user_permission_profiles').delete().eq('user_id', mentorId)

    const { error: permissionError } = await supabaseAdmin.from('user_permission_profiles').insert({
      user_id: mentorId,
      profile_id: permissionProfile.id,
      is_primary: true,
    })

    if (permissionError) {
      return NextResponse.json({ error: permissionError.message }, { status: 400 })
    }

    await supabaseAdmin.from('user_branch_assignments').delete().eq('user_id', mentorId)

    const { error: branchError } = await supabaseAdmin.from('user_branch_assignments').insert({
      user_id: mentorId,
      branch_id: branchId,
    })

    if (branchError) {
      return NextResponse.json({ error: branchError.message }, { status: 400 })
    }

    const { error: mentorDetailsError } = existingDetails
      ? await supabaseAdmin
          .from('mentor_details')
          .update({
            department_id: departmentId,
            reports_to: reportsTo,
            phone: phone || null,
            joining_date: joiningDate || null,
          })
          .eq('profile_id', mentorId)
      : await supabaseAdmin.from('mentor_details').insert({
          profile_id: mentorId,
          branch_id: branchId,
          department_id: departmentId,
          reports_to: reportsTo,
          phone: phone || null,
          joining_date: joiningDate || null,
        })

    if (mentorDetailsError) {
      return NextResponse.json({ error: mentorDetailsError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Mentor updated successfully.',
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong while updating mentor.' },
      { status: 500 },
    )
  }
}
