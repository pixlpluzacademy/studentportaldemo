'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useAuth } from '@/lib/auth/provider'
import type { CertificateListRow, CertificateStatus } from '@/lib/data/certificates'
import {
  createCertificate,
  fetchCertificateList,
  issueCertificate,
  revokeCertificate,
  getCertificateDownloadUrl,
  uploadCertificateFile,
} from '@/lib/data/certificates'
import { useStudentList } from '@/lib/data/hooks/use-students'
import { isStudentMyCoursesView } from '@/lib/data/my-courses'
import type { StudentListRow } from '@/lib/data/students'

function CustomIcon({
  icon,
  folder,
  alt = '',
  className = '',
}: {
  icon: string
  folder: string
  alt?: string
  className?: string
}) {
  return (
    <Image
      src={`/icons/${folder}/${icon}`}
      alt={alt}
      width={24}
      height={24}
      className={`shrink-0 object-contain ${className}`}
      onError={(event) => {
        event.currentTarget.src = `/icons/${folder}/dashboard.svg`
      }}
    />
  )
}

type EligibleCertificateRow = {
  student: StudentListRow
  certificate: CertificateListRow | null
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return `${value}%`
}

export default function Page() {
  const { can, user, parentRoleId } = useAuth()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'
  const isStudent = isStudentMyCoursesView(parentRoleId)

  const { students, loading: studentsLoading, error: studentsError } = useStudentList({
    parentRoleId,
    userId: user?.id,
  })

  const [certificates, setCertificates] = useState<CertificateListRow[]>([])
  const [loadingCerts, setLoadingCerts] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | CertificateStatus | 'ready'>('all')
  const [notice, setNotice] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<EligibleCertificateRow | null>(null)

  const canUploadCertificates =
    can('certificates.upload') || parentRoleId === 'super_admin' || parentRoleId === 'company_admin'
  const canEditCertificates =
    can('certificates.edit') || parentRoleId === 'super_admin' || parentRoleId === 'company_admin'
  const canDownloadCertificates =
    can('certificates.download') || can('certificates.view') || parentRoleId === 'super_admin'
  const canViewCertificates = can('certificates.view') || isStudent || parentRoleId === 'super_admin'

  const reloadCertificates = async () => {
    setLoadingCerts(true)
    const result = await fetchCertificateList()
    if (result.data) {
      setCertificates(result.data)
    } else if (result.error) {
      setNotice(`Error loading certificates: ${result.error}`)
    }
    setLoadingCerts(false)
  }

  useEffect(() => {
    void reloadCertificates()
  }, [])

  const eligibleStudents = useMemo(
    () => students.filter((student) => student.placement_ready),
    [students],
  )

  const certByStudentBatch = useMemo(() => {
    const map = new Map<string, CertificateListRow>()
    for (const cert of certificates) {
      map.set(`${cert.studentId}:${cert.batchId}`, cert)
    }
    return map
  }, [certificates])

  const eligibleRows = useMemo((): EligibleCertificateRow[] => {
    return eligibleStudents
      .filter((student) => Boolean(student.profile_id))
      .map((student) => ({
        student,
        certificate: certByStudentBatch.get(`${student.profile_id}:${student.batch_id}`) || null,
      }))
  }, [eligibleStudents, certByStudentBatch])

  const filteredEligibleRows = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return eligibleRows.filter(({ student, certificate }) => {
      const matchesSearch =
        !keyword ||
        student.full_name.toLowerCase().includes(keyword) ||
        student.student_code.toLowerCase().includes(keyword) ||
        student.course_name.toLowerCase().includes(keyword) ||
        student.batch_name.toLowerCase().includes(keyword) ||
        student.department_name.toLowerCase().includes(keyword) ||
        (certificate?.certificateNo || '').toLowerCase().includes(keyword)

      if (!matchesSearch) return false

      if (statusFilter === 'all') return true
      if (statusFilter === 'ready') return !certificate
      return certificate?.status === statusFilter
    })
  }, [eligibleRows, searchTerm, statusFilter])

  const studentOwnCertificates = useMemo(() => {
    if (!isStudent || !user?.id) return []
    const keyword = searchTerm.trim().toLowerCase()
    return certificates.filter((item) => {
      const matchesOwner = item.studentId === user.id
      const matchesSearch =
        !keyword ||
        item.title.toLowerCase().includes(keyword) ||
        item.courseName?.toLowerCase().includes(keyword) ||
        item.certificateNo.toLowerCase().includes(keyword)
      const matchesStatus = statusFilter === 'all' || statusFilter === 'ready' || item.status === statusFilter
      return matchesOwner && matchesSearch && matchesStatus
    })
  }, [certificates, isStudent, searchTerm, statusFilter, user?.id])

  const issuedCount = certificates.filter((c) => c.status === 'issued').length
  const pendingCount = certificates.filter((c) => c.status === 'pending').length
  const revokedCount = certificates.filter((c) => c.status === 'revoked').length
  const readyCount = eligibleRows.filter((row) => !row.certificate).length

  const openUploadPicker = (row: EligibleCertificateRow) => {
    if (!canUploadCertificates) {
      setNotice('You do not have permission to upload certificates.')
      return
    }
    uploadTargetRef.current = row
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const target = uploadTargetRef.current
    event.target.value = ''
    uploadTargetRef.current = null

    if (!file || !target) return

    const student = target.student
    if (!student.profile_id) {
      setNotice('Student profile is missing. Cannot create certificate.')
      return
    }

    const busy = `${student.id}:${student.batch_id}`
    setBusyKey(busy)
    setNotice('')

    try {
      let certificateId = target.certificate?.id || null

      if (!certificateId) {
        const created = await createCertificate({
          studentProfileId: student.profile_id,
          batchId: student.batch_id,
          title: `${student.course_name} Completion Certificate`,
          certificateNo: `CERT-${student.student_code.replace(/[^A-Za-z0-9]/g, '').slice(-12)}-${Date.now().toString(36).toUpperCase()}`,
        })

        if (!created.ok) {
          setNotice(created.error || 'Failed to create certificate record.')
          setBusyKey(null)
          return
        }

        certificateId = created.certificateId
      }

      const uploaded = await uploadCertificateFile(certificateId, file)
      if (!uploaded.ok) {
        setNotice(uploaded.error || 'Failed to upload certificate file.')
        setBusyKey(null)
        await reloadCertificates()
        return
      }

      setNotice(`Certificate uploaded for ${student.full_name}. Issue it to allow student download.`)
      await reloadCertificates()
    } catch (error) {
      setNotice(`Upload failed: ${String(error)}`)
    } finally {
      setBusyKey(null)
    }
  }

  const handleDownload = async (item: CertificateListRow) => {
    if (item.status !== 'issued') {
      setNotice('Only issued certificates can be downloaded.')
      return
    }

    if (!item.filePath) {
      setNotice('No file attached to this certificate.')
      return
    }

    try {
      const result = await getCertificateDownloadUrl(item.filePath)
      if (result.url) {
        window.open(result.url, '_blank')
        setNotice('')
      } else {
        setNotice(`Download error: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      setNotice(`Download failed: ${String(error)}`)
    }
  }

  const handleRevoke = async (item: CertificateListRow) => {
    if (!canEditCertificates) {
      setNotice('You do not have permission to revoke certificates.')
      return
    }

    const reason = prompt('Enter revocation reason (optional):')
    if (reason === null) return

    setBusyKey(item.id)
    try {
      const result = await revokeCertificate(item.id, reason || '')
      if (result.ok) {
        setNotice(`Certificate revoked successfully for ${item.studentName}.`)
        await reloadCertificates()
      } else {
        setNotice(`Revoke failed: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      setNotice(`Revoke failed: ${String(error)}`)
    } finally {
      setBusyKey(null)
    }
  }

  const handleIssue = async (item: CertificateListRow) => {
    if (!canEditCertificates) {
      setNotice('You do not have permission to issue certificates.')
      return
    }

    if (!item.filePath) {
      setNotice('Upload a certificate file before issuing.')
      return
    }

    setBusyKey(item.id)
    try {
      const result = await issueCertificate(item.id)
      if (result.ok) {
        setNotice(`Certificate issued successfully for ${item.studentName}.`)
        await reloadCertificates()
      } else {
        setNotice(`Issue failed: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      setNotice(`Issue failed: ${String(error)}`)
    } finally {
      setBusyKey(null)
    }
  }

  if (!canViewCertificates) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Certificates Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view certificates.</p>
      </div>
    )
  }

  const loading = isStudent ? loadingCerts : loadingCerts || studentsLoading

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(event) => void handleFileSelected(event)}
      />

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">
            Admin controlled module
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Certificates</h1>
          <p className="mt-2 max-w-4xl text-muted-foreground">
            {isStudent
              ? 'View and download your issued certificates.'
              : 'Course-completed students who are placement eligible (attendance 75%+ and academic average 70%+) appear here so admin can upload certificates.'}
          </p>
        </div>

        {!isStudent && !canUploadCertificates && (
          <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
            <span className="font-semibold">Your access:</span> View certificates only
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{loading ? '—' : isStudent ? studentOwnCertificates.filter((c) => c.status === 'issued').length : readyCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">{isStudent ? 'Issued to me' : 'Ready for Upload'}</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">
            {isStudent ? 'Available downloads' : 'Eligible, no certificate yet'}
          </div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{loading ? '—' : pendingCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Pending</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Waiting issue / file</div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{loading ? '—' : issuedCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Issued</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Ready for student download</div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{loading ? '—' : revokedCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Revoked</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Blocked from download</div>
        </div>
      </div>

      {(notice || studentsError) && (
        <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
          {notice || studentsError}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="border border-border bg-card p-5">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
              <div>
                <h2 className="text-xl font-bold">
                  {isStudent ? 'My Certificates' : 'Eligible for Certificate'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isStudent
                    ? 'Issued certificates available for download.'
                    : 'Students who completed the course and meet placement marks/attendance rules.'}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90]"
                  placeholder={isStudent ? 'Search certificate' : 'Search student, course, batch'}
                />

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as 'all' | CertificateStatus | 'ready')
                  }
                  className="h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90]"
                >
                  <option value="all">All Status</option>
                  {!isStudent && <option value="ready">Ready (no certificate)</option>}
                  <option value="pending">Pending</option>
                  <option value="issued">Issued</option>
                  <option value="draft">Draft</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="mt-5 border border-border bg-background p-6 text-center text-sm text-muted-foreground">
                Loading certificates...
              </div>
            ) : isStudent ? (
              <div className="mt-5 w-full overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th className="px-4 py-3 font-semibold">Certificate</th>
                      <th className="px-4 py-3 font-semibold">Course</th>
                      <th className="px-4 py-3 font-semibold">Certificate No</th>
                      <th className="px-4 py-3 font-semibold">Issue Date</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentOwnCertificates.map((item) => (
                      <tr key={item.id} className="border-b border-border">
                        <td className="px-4 py-3 font-semibold">{item.title}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.courseName || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.certificateNo}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.issuedDate || 'Not issued yet'}</td>
                        <td className="px-4 py-3">
                          <span className="border border-border bg-background px-2 py-1 text-xs font-semibold capitalize">
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => void handleDownload(item)}
                              disabled={item.status !== 'issued' || !canDownloadCertificates}
                              className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Download
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {studentOwnCertificates.length === 0 && (
                  <div className="mt-5 border border-border bg-background p-6 text-center text-sm text-muted-foreground">
                    No certificates available yet.
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 w-full overflow-x-auto">
                <table className="w-full min-w-[1180px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Course</th>
                      <th className="px-4 py-3 font-semibold">Final Score</th>
                      <th className="px-4 py-3 font-semibold">Attendance</th>
                      <th className="px-4 py-3 font-semibold">Certificate</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredEligibleRows.map(({ student, certificate }) => {
                      const rowKey = `${student.id}:${student.batch_id}`
                      const busy = busyKey === rowKey || busyKey === certificate?.id

                      return (
                        <tr key={rowKey} className="border-b border-border">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center overflow-hidden border border-border bg-background">
                                <Image
                                  src={student.avatar_url || '/avatar.svg'}
                                  alt={student.full_name}
                                  width={40}
                                  height={40}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{student.full_name}</p>
                                <p className="text-xs text-muted-foreground">{student.student_code}</p>
                                <p className="text-xs text-muted-foreground">{student.batch_name}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-muted-foreground">
                            {student.course_name}
                            <div className="mt-1 text-xs">{student.department_name}</div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="inline-flex min-w-12 justify-center border border-[#153e90]/30 bg-[#153e90]/10 px-3 py-1 text-sm font-bold text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white">
                              {formatPercent(student.academic_percent)}
                            </span>
                            <div className="mt-1 text-xs text-muted-foreground">Grade {student.grade}</div>
                          </td>

                          <td className="px-4 py-3 font-semibold">{formatPercent(student.attendance_percent)}</td>

                          <td className="px-4 py-3 text-muted-foreground">
                            {certificate ? (
                              <>
                                <div className="font-semibold text-foreground">{certificate.title}</div>
                                <div className="mt-1 text-xs">{certificate.certificateNo}</div>
                              </>
                            ) : (
                              'Not uploaded'
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={
                                certificate?.status === 'issued'
                                  ? 'border border-[#153e90]/25 bg-[#153e90]/10 px-2 py-1 text-xs font-semibold capitalize text-[#153e90] dark:border-[#6ee75a]/25 dark:bg-[#6ee75a]/10 dark:text-white'
                                  : certificate?.status === 'revoked'
                                    ? 'border border-red-500/25 bg-red-500/10 px-2 py-1 text-xs font-semibold capitalize text-red-600 dark:text-red-300'
                                    : 'border border-border bg-background px-2 py-1 text-xs font-semibold capitalize text-muted-foreground'
                              }
                            >
                              {certificate?.status || 'ready'}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {canUploadCertificates && (
                                <button
                                  type="button"
                                  onClick={() => openUploadPicker({ student, certificate })}
                                  disabled={busy}
                                  className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-40"
                                  title="Upload certificate file"
                                >
                                  {busy ? 'Working...' : certificate?.filePath ? 'Replace' : 'Upload'}
                                </button>
                              )}

                              {certificate && (
                                <button
                                  type="button"
                                  onClick={() => void handleDownload(certificate)}
                                  disabled={certificate.status !== 'issued' || !canDownloadCertificates || busy}
                                  className="border border-border p-2 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                                  title="Download"
                                >
                                  <CustomIcon icon="submissions.svg" folder={iconFolder} alt="Download" className="h-4 w-4" />
                                </button>
                              )}

                              {canEditCertificates && certificate && (
                                <button
                                  type="button"
                                  onClick={() => void handleIssue(certificate)}
                                  disabled={certificate.status === 'issued' || !certificate.filePath || busy}
                                  className="border border-border p-2 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                                  title={
                                    !certificate.filePath
                                      ? 'Upload a certificate file before issuing'
                                      : certificate.status === 'issued'
                                        ? 'Already issued'
                                        : 'Issue certificate'
                                  }
                                >
                                  <CustomIcon icon="reviews.svg" folder={iconFolder} alt="Issue" className="h-4 w-4" />
                                </button>
                              )}

                              {canEditCertificates && certificate && certificate.status !== 'revoked' && (
                                <button
                                  type="button"
                                  onClick={() => void handleRevoke(certificate)}
                                  disabled={busy}
                                  className="border border-border p-2 hover:bg-red-500/10 disabled:opacity-40"
                                  title="Revoke"
                                >
                                  <CustomIcon icon="attendance.svg" folder={iconFolder} alt="Revoke" className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {filteredEligibleRows.length === 0 && (
                  <div className="mt-5 border border-border bg-background p-6 text-center text-sm text-muted-foreground">
                    No course-completed eligible students found. Students appear after batch end date with attendance
                    75%+ and academic average 70%+.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="border border-border bg-card p-5">
            <CustomIcon icon="certificates.svg" folder={iconFolder} alt="Certificate Flow" className="mb-4 h-10 w-10" />
            <h2 className="text-xl font-bold">Certificate Flow</h2>

            <div className="mt-5 space-y-4 text-sm">
              <div className="border border-border bg-background p-4">
                <p className="font-semibold">1. Course Completed</p>
                <p className="mt-1 text-muted-foreground">
                  Batch end date passed, attendance 75%+, academic average 70%+.
                </p>
              </div>

              <div className="border border-border bg-background p-4">
                <p className="font-semibold">2. Admin Upload</p>
                <p className="mt-1 text-muted-foreground">
                  Admin uploads the certificate file for the eligible student.
                </p>
              </div>

              <div className="border border-border bg-background p-4">
                <p className="font-semibold">3. Issue & Download</p>
                <p className="mt-1 text-muted-foreground">
                  After issue, student can download the certificate.
                </p>
              </div>
            </div>
          </div>

          <div className="border border-border bg-card p-5">
            <h2 className="text-xl font-bold">Access Rules</h2>

            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>Admin can upload, issue and revoke certificates for eligible students.</p>
              <p>Student can only download issued certificates.</p>
              <p className="font-semibold text-[#153e90] dark:text-[#6ee75a]">
                Student upload option is completely hidden.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
