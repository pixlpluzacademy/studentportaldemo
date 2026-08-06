import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { supabaseAdmin } from '@/lib/supabase-admin'

export type CertificateStatus = 'draft' | 'pending' | 'issued' | 'revoked'

export type CertificateListRow = {
  id: string
  studentId: string
  studentName: string
  batchId: string
  batchName: string
  courseId: string | null
  courseName: string | null
  title: string
  certificateNo: string
  status: CertificateStatus
  issuedDate: string | null
  revokedDate: string | null
  revokeReason: string | null
  filePath: string | null
  fileName: string | null
}

export type CertificateDetailRow = CertificateListRow & {
  filePath: string | null
  fileName: string | null
  issuedBy: string | null
  revokedBy: string | null
}

type DbCertificateRow = {
  id: string
  student_id: string
  batch_id: string
  course_id: string | null
  title: string
  certificate_no: string
  status: CertificateStatus
  file_path: string | null
  file_name: string | null
  issued_by: string | null
  issued_at: string | null
  revoked_by: string | null
  revoked_at: string | null
  revoke_reason: string | null
  created_at: string
  updated_at: string
  student: {
    full_name: string | null
  } | null
  batch: {
    name: string
  } | null
  course: {
    name: string
  } | null
}

function mapDbRowToListRow(row: DbCertificateRow): CertificateListRow {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student?.full_name || 'Unknown Student',
    batchId: row.batch_id,
    batchName: row.batch?.name || 'Unknown Batch',
    courseId: row.course_id,
    courseName: row.course?.name || null,
    title: row.title,
    certificateNo: row.certificate_no,
    status: row.status,
    issuedDate: row.issued_at ? new Date(row.issued_at).toLocaleDateString() : null,
    revokedDate: row.revoked_at ? new Date(row.revoked_at).toLocaleDateString() : null,
    revokeReason: row.revoke_reason,
    filePath: row.file_path,
    fileName: row.file_name,
  }
}

function mapDbRowToDetailRow(row: DbCertificateRow): CertificateDetailRow {
  return {
    ...mapDbRowToListRow(row),
    filePath: row.file_path,
    fileName: row.file_name,
    issuedBy: row.issued_by,
    revokedBy: row.revoked_by,
  }
}

export async function fetchCertificateList(options?: {
  status?: CertificateStatus | 'all'
  search?: string
}): Promise<{ data: CertificateListRow[]; error?: string }> {
  try {
    const client = createClient()
    const user = await client.auth.getUser()

    if (!user.data.user) {
      return { data: [], error: 'Not authenticated' }
    }

    let query = client
      .from('certificates')
      .select(
        `
        id,
        student_id,
        batch_id,
        course_id,
        title,
        certificate_no,
        status,
        file_path,
        file_name,
        issued_by,
        issued_at,
        revoked_by,
        revoked_at,
        revoke_reason,
        created_at,
        updated_at,
        student:student_id(full_name),
        batch:batch_id(name),
        course:course_id(name)
      `
      )

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status)
    }

    const { data, error } = await query

    if (error) {
      return { data: [], error: error.message }
    }

    let rows = ((data || []) as unknown as DbCertificateRow[]).map(mapDbRowToListRow)

    if (options?.search) {
      const term = options.search.toLowerCase()
      rows = rows.filter(
        (row) =>
          row.studentName.toLowerCase().includes(term) ||
          row.batchName.toLowerCase().includes(term) ||
          row.courseName?.toLowerCase().includes(term) ||
          row.title.toLowerCase().includes(term) ||
          row.certificateNo.toLowerCase().includes(term)
      )
    }

    return { data: rows }
  } catch (error) {
    return { data: [], error: String(error) }
  }
}

export async function fetchCertificateById(
  id: string
): Promise<{ data: CertificateDetailRow | null; error?: string }> {
  try {
    const client = createClient()

    const { data, error } = await client
      .from('certificates')
      .select(
        `
        id,
        student_id,
        batch_id,
        course_id,
        title,
        certificate_no,
        status,
        file_path,
        file_name,
        issued_by,
        issued_at,
        revoked_by,
        revoked_at,
        revoke_reason,
        created_at,
        updated_at,
        student:student_id(full_name),
        batch:batch_id(name),
        course:course_id(name)
      `
      )
      .eq('id', id)
      .maybeSingle()

    if (error) {
      return { data: null, error: error.message }
    }

    if (!data) {
      return { data: null, error: 'Certificate not found' }
    }

    return { data: mapDbRowToDetailRow(data as unknown as DbCertificateRow) }
  } catch (error) {
    return { data: null, error: String(error) }
  }
}

export async function issueCertificate(
  certificateId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = createClient()
    const session = await client.auth.getSession()
    const token = session.data.session?.access_token

    if (!token) {
      return { ok: false, error: 'Not authenticated' }
    }

    const response = await fetch('/api/admin/certificates/' + certificateId + '/issue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    const text = await response.text()
    let result: { error?: string } = {}
    try {
      result = text ? (JSON.parse(text) as { error?: string }) : {}
    } catch {
      return {
        ok: false,
        error: `Issue failed (${response.status}). ${text.slice(0, 160)}`,
      }
    }

    if (!response.ok) {
      return { ok: false, error: result.error || 'Failed to issue certificate' }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
}

export async function revokeCertificate(
  certificateId: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = createClient()
    const session = await client.auth.getSession()
    const token = session.data.session?.access_token

    if (!token) {
      return { ok: false, error: 'Not authenticated' }
    }

    const response = await fetch('/api/admin/certificates/' + certificateId + '/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    })

    const result = await response.json()

    if (!response.ok) {
      return { ok: false, error: result.error || 'Failed to revoke certificate' }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
}

export async function createCertificate(input: {
  studentProfileId: string
  batchId: string
  courseId?: string | null
  title?: string
  certificateNo?: string
}): Promise<{ ok: true; certificateId: string } | { ok: false; error: string }> {
  try {
    const client = createClient()
    const session = await client.auth.getSession()
    const token = session.data.session?.access_token

    if (!token) {
      return { ok: false, error: 'Not authenticated' }
    }

    const certificateNo =
      input.certificateNo?.trim() ||
      `CERT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    const response = await fetch('/api/admin/certificates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        studentId: input.studentProfileId,
        batchId: input.batchId,
        courseId: input.courseId || null,
        title: input.title || 'Course Completion Certificate',
        certificateNo,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      return { ok: false, error: result.error || 'Failed to create certificate' }
    }

    const certificateId = result.certificate?.id as string | undefined
    if (!certificateId) {
      return { ok: false, error: 'Certificate created but id was not returned.' }
    }

    return { ok: true, certificateId }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
}

export async function uploadCertificateFile(
  certificateId: string,
  file: File
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = createClient()
    const session = await client.auth.getSession()
    const token = session.data.session?.access_token

    if (!token) {
      return { ok: false, error: 'Not authenticated' }
    }

    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/admin/certificates/' + certificateId + '/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    const text = await response.text()
    let result: { error?: string } = {}
    try {
      result = text ? (JSON.parse(text) as { error?: string }) : {}
    } catch {
      return {
        ok: false,
        error: response.ok
          ? 'Upload succeeded but returned an invalid response.'
          : `Upload failed (${response.status}). ${text.slice(0, 160)}`,
      }
    }

    if (!response.ok) {
      return { ok: false, error: result.error || 'Failed to upload certificate' }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
}

export async function getCertificateDownloadUrl(
  filePath: string
): Promise<{ url: string | null; error?: string }> {
  try {
    const client = createClient()
    const session = await client.auth.getSession()
    const token = session.data.session?.access_token

    if (!token) {
      return { url: null, error: 'Not authenticated' }
    }

    const response = await fetch('/api/certificates/download-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ filePath }),
    })

    const result = await response.json()

    if (!response.ok) {
      return { url: null, error: result.error || 'Failed to get download URL' }
    }

    return { url: result.url }
  } catch (error) {
    return { url: null, error: String(error) }
  }
}

export async function deleteCertificate(
  certificateId: string,
  accessToken: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('/api/admin/certificates/' + certificateId, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const result = await response.json()
      return { ok: false, error: result.error || 'Failed to delete certificate' }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
}
