import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataResult } from '@/lib/data/config'
import { createClient } from '@/lib/supabase/client'

export type ClassMaterialRow = {
  id: string
  batchId: string
  title: string
  description: string
  course: string
  batch: string
  batchMode: string
  classDate: string
  uploadedBy: string
  notesFileName: string
  notesFilePath: string | null
  classLink: string
  status: string
}

type ClassMaterialDbRow = {
  id: string
  batch_id: string
  title: string
  description: string | null
  class_date: string
  notes_file_path: string | null
  notes_file_name: string | null
  class_link: string | null
  status: 'draft' | 'published' | 'archived'
  uploader: { full_name: string | null } | { full_name: string | null }[] | null
  batch:
    | {
        id: string
        name: string
        mode: 'online' | 'offline'
        course: { name: string } | { name: string }[] | null
      }
    | {
        id: string
        name: string
        mode: 'online' | 'offline'
        course: { name: string } | { name: string }[] | null
      }[]
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] || null : value
}

function formatStatusLabel(status: ClassMaterialDbRow['status']) {
  if (status === 'draft') return 'Draft'
  if (status === 'archived') return 'Archived'
  return 'Published'
}

function formatBatchModeLabel(mode: 'online' | 'offline') {
  return mode === 'online' ? 'Online' : 'Offline'
}

export type ClassMaterialBatchLookup = {
  name: string
  courseName: string
  mode: 'online' | 'offline'
}

function mapClassMaterialRow(
  row: ClassMaterialDbRow,
  batchLookup?: ClassMaterialBatchLookup,
): ClassMaterialRow {
  const batch = unwrapRelation(row.batch)
  const course = unwrapRelation(batch?.course)
  const uploader = unwrapRelation(row.uploader)

  const resolvedMode = batchLookup?.mode || batch?.mode || 'offline'
  const resolvedBatchName = batchLookup?.name || batch?.name || 'Unknown batch'
  const resolvedCourseName = batchLookup?.courseName || course?.name || 'Unknown course'

  return {
    id: row.id,
    batchId: row.batch_id,
    title: row.title,
    description: row.description?.trim() || '',
    course: resolvedCourseName,
    batch: resolvedBatchName,
    batchMode: formatBatchModeLabel(resolvedMode),
    classDate: row.class_date,
    uploadedBy: uploader?.full_name?.trim() || 'Staff',
    notesFileName: row.notes_file_name?.trim() || '',
    notesFilePath: row.notes_file_path,
    classLink: row.class_link?.trim() || '',
    status: formatStatusLabel(row.status),
  }
}

export async function fetchClassMaterials(
  options?: {
    supabase?: SupabaseClient
    batchLookup?: Map<string, ClassMaterialBatchLookup>
  },
): Promise<DataResult<ClassMaterialRow[]>> {
  const client = options?.supabase ?? createClient()

  try {
    const { data, error } = await client
      .from('class_materials')
      .select(
        `
        id,
        batch_id,
        title,
        description,
        class_date,
        notes_file_path,
        notes_file_name,
        class_link,
        status,
        uploader:profiles!class_materials_uploaded_by_fkey (
          full_name
        ),
        batch:batches (
          id,
          name,
          mode,
          course:courses (
            name
          )
        )
      `,
      )
      .order('class_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return { source: 'supabase', data: [], error: error.message }
    }

    const rows = ((data || []) as ClassMaterialDbRow[]).map((row) =>
      mapClassMaterialRow(row, options?.batchLookup?.get(row.batch_id)),
    )
    return { source: 'supabase', data: rows }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load class materials.',
    }
  }
}

export async function getClassMaterialDownloadUrl(
  materialId: string,
  accessToken: string,
  options?: { inline?: boolean },
): Promise<{ url?: string; fileName?: string; error?: string }> {
  const params = new URLSearchParams({ id: materialId })
  if (options?.inline) {
    params.set('inline', '1')
  }

  const response = await fetch(`/api/admin/class-materials?${params.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const payload = (await response.json()) as { url?: string; fileName?: string; error?: string }

  if (!response.ok) {
    return { error: payload.error || 'Failed to prepare download.' }
  }

  return { url: payload.url, fileName: payload.fileName }
}

export async function openClassMaterialFile(
  material: Pick<ClassMaterialRow, 'id' | 'notesFileName' | 'notesFilePath'>,
  accessToken: string,
  mode: 'view' | 'download',
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!material.notesFilePath && !material.notesFileName) {
    return { ok: false, error: 'No notes file available.' }
  }

  const result = await getClassMaterialDownloadUrl(material.id, accessToken, {
    inline: mode === 'view',
  })

  if (!result.url) {
    return { ok: false, error: result.error || 'Failed to prepare file link.' }
  }

  if (mode === 'download') {
    const anchor = document.createElement('a')
    anchor.href = result.url
    anchor.download = result.fileName || material.notesFileName || 'class-notes'
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  } else {
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  return { ok: true, url: result.url }
}

export async function uploadClassMaterial(
  formData: FormData,
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch('/api/admin/class-materials', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  })

  const payload = (await response.json()) as { error?: string }

  if (!response.ok) {
    return { ok: false, error: payload.error || 'Failed to upload class material.' }
  }

  return { ok: true }
}

export async function deleteClassMaterial(
  materialId: string,
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`/api/admin/class-materials?id=${encodeURIComponent(materialId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const payload = (await response.json()) as { error?: string }

  if (!response.ok) {
    return { ok: false, error: payload.error || 'Failed to delete class material.' }
  }

  return { ok: true }
}
