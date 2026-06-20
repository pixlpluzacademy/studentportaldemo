import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { callerHasPermission, getCallerFromBearerToken } from '@/lib/auth/admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

const CLASS_MATERIALS_BUCKET = 'class-materials'

async function callerIsSuperAdmin(userId: string) {
  const { data } = await supabaseAdmin.rpc('is_super_admin', { p_user_id: userId })
  return Boolean(data)
}

async function callerCanUploadToBatch(userId: string, batchId: string) {
  if (await callerIsSuperAdmin(userId)) return true

  const canUpload =
    (await callerHasPermission(userId, 'class-materials.upload')) ||
    (await callerHasPermission(userId, 'class-materials.edit'))

  if (!canUpload) return false

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

async function callerCanDeleteMaterial(userId: string, batchId: string) {
  if (await callerIsSuperAdmin(userId)) return true

  if (!(await callerHasPermission(userId, 'class-materials.delete'))) {
    return false
  }

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

async function callerHasAllBranchScope(userId: string) {
  const { data } = await supabaseAdmin.rpc('has_all_branch_scope', { p_user_id: userId })
  return Boolean(data)
}

async function callerCanAccessMaterial(userId: string, batchId: string) {
  if (await callerIsSuperAdmin(userId)) return true

  const { data: staffAssignment } = await supabaseAdmin
    .from('batch_staff_assignments')
    .select('id')
    .eq('batch_id', batchId)
    .eq('user_id', userId)
    .maybeSingle()

  if (staffAssignment) return true

  const { data: enrolled } = await supabaseAdmin.rpc('user_enrolled_in_batch', {
    p_batch_id: batchId,
    p_user_id: userId,
  })

  if (enrolled) {
    return (
      (await callerHasPermission(userId, 'class-materials.view')) ||
      (await callerHasPermission(userId, 'class-materials.download'))
    )
  }

  const canView = await callerHasPermission(userId, 'class-materials.view')
  const canDownload = await callerHasPermission(userId, 'class-materials.download')

  if (!canView && !canDownload) {
    return false
  }

  if (await callerHasAllBranchScope(userId)) {
    return true
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
    const classDate = String(formData.get('classDate') || '').trim()
    const classLink = String(formData.get('classLink') || '').trim()
    const notesFile = formData.get('notesFile') as File | null

    if (!batchId || !title || !description || !classDate) {
      return NextResponse.json(
        { error: 'Title, description, batch, and class date are required.' },
        { status: 400 },
      )
    }

    if (!notesFile || notesFile.size === 0) {
      return NextResponse.json({ error: 'Notes file is required.' }, { status: 400 })
    }

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('batches')
      .select('id, mode')
      .eq('id', batchId)
      .single()

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Selected batch not found.' }, { status: 400 })
    }

    if (batch.mode === 'online' && !classLink) {
      return NextResponse.json({ error: 'Online batches require a class link.' }, { status: 400 })
    }

    const canUpload = await callerCanUploadToBatch(caller.id, batchId)

    if (!canUpload) {
      return NextResponse.json({ error: 'You do not have permission to upload for this batch.' }, { status: 403 })
    }

    const sanitizedName = notesFile.name.replace(/[^\w.\-() ]+/g, '_')
    const filePath = `${batchId}/${randomUUID()}/${sanitizedName}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from(CLASS_MATERIALS_BUCKET)
      .upload(filePath, notesFile, {
        upsert: false,
        contentType: notesFile.type || 'application/octet-stream',
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 })
    }

    const { error: insertError } = await supabaseAdmin.from('class_materials').insert({
      batch_id: batchId,
      title,
      description,
      class_date: classDate,
      notes_file_path: filePath,
      notes_file_name: notesFile.name,
      class_link: batch.mode === 'online' ? classLink : null,
      status: 'published',
      uploaded_by: caller.id,
    })

    if (insertError) {
      await supabaseAdmin.storage.from(CLASS_MATERIALS_BUCKET).remove([filePath])
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while uploading class material.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    const materialId = new URL(request.url).searchParams.get('id')?.trim()
    const inline = new URL(request.url).searchParams.get('inline') === '1'

    if (!materialId) {
      return NextResponse.json({ error: 'Material id is required.' }, { status: 400 })
    }

    const { data: material, error: materialError } = await supabaseAdmin
      .from('class_materials')
      .select('id, batch_id, notes_file_path')
      .eq('id', materialId)
      .single()

    if (materialError || !material) {
      return NextResponse.json({ error: 'Class material not found.' }, { status: 404 })
    }

    const canDelete = await callerCanDeleteMaterial(caller.id, material.batch_id)

    if (!canDelete) {
      return NextResponse.json({ error: 'You do not have permission to delete this material.' }, { status: 403 })
    }

    if (material.notes_file_path) {
      await supabaseAdmin.storage.from(CLASS_MATERIALS_BUCKET).remove([material.notes_file_path])
    }

    const { error: deleteError } = await supabaseAdmin.from('class_materials').delete().eq('id', materialId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while deleting class material.' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const caller = await getCallerFromBearerToken(token)

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
    }

    const materialId = new URL(request.url).searchParams.get('id')?.trim()
    const inline = new URL(request.url).searchParams.get('inline') === '1'

    if (!materialId) {
      return NextResponse.json({ error: 'Material id is required.' }, { status: 400 })
    }

    const { data: material, error: materialError } = await supabaseAdmin
      .from('class_materials')
      .select('id, batch_id, notes_file_path, notes_file_name')
      .eq('id', materialId)
      .single()

    if (materialError || !material) {
      return NextResponse.json({ error: 'Class material not found.' }, { status: 404 })
    }

    if (!material.notes_file_path) {
      return NextResponse.json({ error: 'No notes file available for this material.' }, { status: 404 })
    }

    const canAccess = await callerCanAccessMaterial(caller.id, material.batch_id)

    if (!canAccess) {
      return NextResponse.json({ error: 'You do not have permission to download this material.' }, { status: 403 })
    }

    const signedUrlResult = inline
      ? await supabaseAdmin.storage
          .from(CLASS_MATERIALS_BUCKET)
          .createSignedUrl(material.notes_file_path, 60 * 60)
      : await supabaseAdmin.storage
          .from(CLASS_MATERIALS_BUCKET)
          .createSignedUrl(material.notes_file_path, 60 * 60, {
            download: material.notes_file_name || 'class-notes',
          })

    const signedUrlData = signedUrlResult.data
    const signedUrlError = signedUrlResult.error

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return NextResponse.json({ error: signedUrlError?.message || 'Failed to create download link.' }, { status: 400 })
    }

    return NextResponse.json({
      url: signedUrlData.signedUrl,
      fileName: material.notes_file_name,
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong while preparing download.' }, { status: 500 })
  }
}
