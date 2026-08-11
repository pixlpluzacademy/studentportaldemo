import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { callerHasPermission, getCallerFromBearerToken } from '@/lib/auth/admin'
import { mapFrequencyToDb } from '@/lib/data/tasks'
import { supabaseAdmin } from '@/lib/supabase-admin'

const TASK_FILES_BUCKET = 'task-submissions'

async function callerIsSuperAdmin(userId: string) {
  const { data } = await supabaseAdmin.rpc('is_super_admin', { p_user_id: userId })
  return Boolean(data)
}

async function callerCanAccessTask(userId: string, batchId: string) {
  if (await callerIsSuperAdmin(userId)) return true

  const { data: enrolled } = await supabaseAdmin.rpc('user_enrolled_in_batch', {
    p_batch_id: batchId,
    p_user_id: userId,
  })

  if (enrolled) return true

  const { data: assignment } = await supabaseAdmin
    .from('batch_staff_assignments')
    .select('id')
    .eq('batch_id', batchId)
    .eq('user_id', userId)
    .maybeSingle()

  if (assignment) return true

  if (!(await callerHasPermission(userId, 'tasks.view'))) {
    return false
  }

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

function normalizeDueTime(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length === 5 ? `${trimmed}:00` : trimmed
}

async function callerCanManageBatchTasks(
  userId: string,
  batchId: string,
  action: 'create' | 'edit' | 'delete',
) {
  if (await callerIsSuperAdmin(userId)) return true

  const canManage =
    action === 'create'
      ? (await callerHasPermission(userId, 'tasks.create')) ||
        (await callerHasPermission(userId, 'tasks.assign'))
      : action === 'edit'
        ? await callerHasPermission(userId, 'tasks.edit')
        : await callerHasPermission(userId, 'tasks.delete')

  if (!canManage) return false

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

    const formData = await request.formData()

    const batchId = String(formData.get('batchId') || '').trim()
    const title = String(formData.get('title') || '').trim()
    const description = String(formData.get('description') || '').trim()
    const frequency = mapFrequencyToDb(String(formData.get('frequency') || 'One-time'))
    const dueDate = String(formData.get('dueDate') || '').trim()
    const dueTimeRaw = String(formData.get('dueTime') || '').trim()
    const fileRequirement = String(formData.get('fileRequirement') || '').trim()
    const fileRequired = String(formData.get('fileRequired') || '') === '1'
    const attachmentFile = formData.get('attachmentFile') as File | null

    if (!batchId || !title || !description || !dueDate) {
      return NextResponse.json(
        { error: 'Title, description, batch, and submission date are required.' },
        { status: 400 },
      )
    }

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('batches')
      .select('id')
      .eq('id', batchId)
      .maybeSingle()

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Selected batch not found.' }, { status: 400 })
    }

    const canCreate = await callerCanManageBatchTasks(caller.id, batchId, 'create')

    if (!canCreate) {
      return NextResponse.json({ error: 'You do not have permission to create tasks for this batch.' }, { status: 403 })
    }

    let attachmentPath: string | null = null
    let attachmentName: string | null = null

    if (attachmentFile && attachmentFile.size > 0) {
      const sanitizedName = attachmentFile.name.replace(/[^\w.\-() ]+/g, '_')
      attachmentPath = `briefs/${batchId}/${randomUUID()}/${sanitizedName}`
      attachmentName = attachmentFile.name

      const { error: uploadError } = await supabaseAdmin.storage
        .from(TASK_FILES_BUCKET)
        .upload(attachmentPath, attachmentFile, {
          upsert: false,
          contentType: attachmentFile.type || 'application/octet-stream',
        })

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 400 })
      }
    }

    const { data: taskRow, error: insertError } = await supabaseAdmin
      .from('tasks')
      .insert({
        batch_id: batchId,
        title,
        description,
        frequency,
        due_date: dueDate,
        due_time: normalizeDueTime(dueTimeRaw),
        file_requirement: fileRequirement || null,
        file_required: fileRequired,
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
        status: 'open',
        assigned_by: caller.id,
      })
      .select('id')
      .single()

    if (insertError || !taskRow) {
      if (attachmentPath) {
        await supabaseAdmin.storage.from(TASK_FILES_BUCKET).remove([attachmentPath])
      }
      return NextResponse.json({ error: insertError?.message || 'Could not save task.' }, { status: 400 })
    }

    return NextResponse.json({ success: true, taskId: taskRow.id })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while creating the task.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    const formData = await request.formData()

    const taskId = String(formData.get('taskId') || '').trim()
    const batchId = String(formData.get('batchId') || '').trim()
    const title = String(formData.get('title') || '').trim()
    const description = String(formData.get('description') || '').trim()
    const frequency = mapFrequencyToDb(String(formData.get('frequency') || 'One-time'))
    const dueDate = String(formData.get('dueDate') || '').trim()
    const dueTimeRaw = String(formData.get('dueTime') || '').trim()
    const fileRequirement = String(formData.get('fileRequirement') || '').trim()
    const fileRequired = String(formData.get('fileRequired') || '') === '1'
    const removeAttachment = String(formData.get('removeAttachment') || '') === '1'
    const attachmentFile = formData.get('attachmentFile') as File | null

    if (!taskId || !batchId || !title || !description || !dueDate) {
      return NextResponse.json(
        { error: 'Title, description, batch, and submission date are required.' },
        { status: 400 },
      )
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('tasks')
      .select('id, batch_id, attachment_path')
      .eq('id', taskId)
      .maybeSingle()

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
    }

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('batches')
      .select('id')
      .eq('id', batchId)
      .maybeSingle()

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Selected batch not found.' }, { status: 400 })
    }

    const canEditExisting = await callerCanManageBatchTasks(caller.id, existing.batch_id, 'edit')
    const canEditTarget =
      batchId === existing.batch_id
        ? canEditExisting
        : await callerCanManageBatchTasks(caller.id, batchId, 'edit')

    if (!canEditExisting || !canEditTarget) {
      return NextResponse.json({ error: 'You do not have permission to edit this task.' }, { status: 403 })
    }

    let attachmentPath = existing.attachment_path as string | null
    let attachmentName: string | null | undefined
    let uploadedPath: string | null = null

    if (attachmentFile && attachmentFile.size > 0) {
      const sanitizedName = attachmentFile.name.replace(/[^\w.\-() ]+/g, '_')
      uploadedPath = `briefs/${batchId}/${randomUUID()}/${sanitizedName}`

      const { error: uploadError } = await supabaseAdmin.storage
        .from(TASK_FILES_BUCKET)
        .upload(uploadedPath, attachmentFile, {
          upsert: false,
          contentType: attachmentFile.type || 'application/octet-stream',
        })

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 400 })
      }

      attachmentPath = uploadedPath
      attachmentName = attachmentFile.name
    } else if (removeAttachment) {
      attachmentPath = null
      attachmentName = null
    }

    const updatePayload: Record<string, unknown> = {
      batch_id: batchId,
      title,
      description,
      frequency,
      due_date: dueDate,
      due_time: normalizeDueTime(dueTimeRaw),
      file_requirement: fileRequirement || null,
      file_required: fileRequired,
    }

    if (attachmentName !== undefined || uploadedPath || removeAttachment) {
      updatePayload.attachment_path = attachmentPath
      updatePayload.attachment_name = attachmentName ?? null
    }

    const { error: updateError } = await supabaseAdmin
      .from('tasks')
      .update(updatePayload)
      .eq('id', taskId)

    if (updateError) {
      if (uploadedPath) {
        await supabaseAdmin.storage.from(TASK_FILES_BUCKET).remove([uploadedPath])
      }
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    const previousPath = existing.attachment_path as string | null
    if (previousPath && previousPath !== attachmentPath) {
      await supabaseAdmin.storage.from(TASK_FILES_BUCKET).remove([previousPath])
    }

    return NextResponse.json({ success: true, taskId })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while updating the task.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    const taskId = new URL(request.url).searchParams.get('id')?.trim()

    if (!taskId) {
      return NextResponse.json({ error: 'Task id is required.' }, { status: 400 })
    }

    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, batch_id, attachment_path')
      .eq('id', taskId)
      .maybeSingle()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
    }

    const canDelete = await callerCanManageBatchTasks(caller.id, task.batch_id, 'delete')

    if (!canDelete) {
      return NextResponse.json({ error: 'You do not have permission to delete this task.' }, { status: 403 })
    }

    if (task.attachment_path) {
      await supabaseAdmin.storage.from(TASK_FILES_BUCKET).remove([task.attachment_path])
    }

    const { error: deleteError } = await supabaseAdmin.from('tasks').delete().eq('id', taskId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while deleting the task.' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    const taskId = new URL(request.url).searchParams.get('id')?.trim()
    const inline = new URL(request.url).searchParams.get('inline') === '1'

    if (!taskId) {
      return NextResponse.json({ error: 'Task id is required.' }, { status: 400 })
    }

    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, batch_id, attachment_path, attachment_name')
      .eq('id', taskId)
      .maybeSingle()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
    }

    if (!task.attachment_path) {
      return NextResponse.json({ error: 'No brief file available for this task.' }, { status: 404 })
    }

    const canAccess = await callerCanAccessTask(caller.id, task.batch_id)

    if (!canAccess) {
      return NextResponse.json({ error: 'You do not have permission to view this task file.' }, { status: 403 })
    }

    const signedUrlResult = inline
      ? await supabaseAdmin.storage
          .from(TASK_FILES_BUCKET)
          .createSignedUrl(task.attachment_path, 60 * 60)
      : await supabaseAdmin.storage
          .from(TASK_FILES_BUCKET)
          .createSignedUrl(task.attachment_path, 60 * 60, {
            download: task.attachment_name || 'task-brief',
          })

    const signedUrlData = signedUrlResult.data
    const signedUrlError = signedUrlResult.error

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return NextResponse.json({ error: signedUrlError?.message || 'Failed to create download link.' }, { status: 400 })
    }

    return NextResponse.json({
      url: signedUrlData.signedUrl,
      fileName: task.attachment_name,
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while preparing download.' }, { status: 500 })
  }
}
