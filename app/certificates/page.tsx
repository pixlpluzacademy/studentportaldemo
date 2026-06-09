'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useDemoAuth } from '@/lib/demo/auth'
import { certificates } from '@/lib/demo/seed'

type CertificateStatus = 'issued' | 'pending' | 'revoked' | 'draft'

type CertificateRow = {
  id?: string
  student?: string
  studentName?: string
  course?: string
  courseName?: string
  title?: string
  issueDate?: string
  issuedDate?: string
  status?: CertificateStatus | string
  certificateNo?: string
  fileUrl?: string
}

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

const certificateRows = certificates as CertificateRow[]

function getStudentName(item: CertificateRow) {
  return item.studentName || item.student || 'Unnamed Student'
}

function getCourseName(item: CertificateRow) {
  return item.courseName || item.course || 'Course not assigned'
}

function getIssueDate(item: CertificateRow) {
  return item.issueDate || item.issuedDate || 'Not issued yet'
}

function getStatus(item: CertificateRow): CertificateStatus {
  const status = String(item.status || 'pending').toLowerCase()

  if (status === 'issued') return 'issued'
  if (status === 'revoked') return 'revoked'
  if (status === 'draft') return 'draft'

  return 'pending'
}

function getCertificateNo(item: CertificateRow, index: number) {
  return item.certificateNo || `CERT-${String(index + 1).padStart(4, '0')}`
}

export default function Page() {
  const { role } = useDemoAuth()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [notice, setNotice] = useState('')

  const currentRoleId = role?.id || 'student'

  const canManageCertificates =
    currentRoleId === 'superadmin' ||
    currentRoleId === 'admin' ||
    currentRoleId === 'final-qa' ||
    currentRoleId === 'qa'

  const filteredCertificates = useMemo(() => {
    return certificateRows.filter((item, index) => {
      const term = searchTerm.trim().toLowerCase()
      const status = getStatus(item)

      const matchesSearch =
        !term ||
        getStudentName(item).toLowerCase().includes(term) ||
        getCourseName(item).toLowerCase().includes(term) ||
        String(item.title || '').toLowerCase().includes(term) ||
        getCertificateNo(item, index).toLowerCase().includes(term) ||
        status.toLowerCase().includes(term)

      const matchesStatus = statusFilter === 'all' || status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [searchTerm, statusFilter])

  const issuedCertificates = certificateRows.filter((item) => getStatus(item) === 'issued')
  const pendingCertificates = certificateRows.filter((item) => getStatus(item) === 'pending')
  const revokedCertificates = certificateRows.filter((item) => getStatus(item) === 'revoked')
  const uploadedCertificates = certificateRows.filter((item) => Boolean(item.fileUrl))

  const handleUpload = () => {
    if (!canManageCertificates) {
      setNotice('Students cannot upload certificates. Only Admin, Super Admin or Final QA can upload.')
      return
    }

    setNotice('Certificate upload will connect with Supabase Storage later.')
  }

  const handleDownload = (item: CertificateRow) => {
    const status = getStatus(item)

    if (status !== 'issued') {
      setNotice('Only issued certificates can be downloaded.')
      return
    }

    setNotice(`${getStudentName(item)} certificate download will connect with Supabase Storage later.`)
  }

  const handlePreview = (item: CertificateRow) => {
    setNotice(`Preview opened for ${getStudentName(item)} certificate.`)
  }

  const handleEdit = (item: CertificateRow) => {
    if (!canManageCertificates) {
      setNotice('Students cannot edit certificates.')
      return
    }

    setNotice(`Editing certificate for ${getStudentName(item)}.`)
  }

  const handleRevoke = (item: CertificateRow) => {
    if (!canManageCertificates) {
      setNotice('Students cannot revoke certificates.')
      return
    }

    setNotice(`Certificate revoke action selected for ${getStudentName(item)}.`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">
            Admin controlled module
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Certificates</h1>
          <p className="mt-2 max-w-4xl text-muted-foreground">
            Admin uploads certificates manually after final approval. Students can only view and download issued certificates. Students do not have upload, edit or revoke access.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {canManageCertificates ? (
            <button
              type="button"
              onClick={handleUpload}
              className="inline-flex items-center gap-2 bg-[#153e90] px-5 py-3 font-semibold text-white"
            >
              <CustomIcon icon="certificates.svg" folder={iconFolder} alt="Upload Certificate" className="h-4 w-4" />
              Upload Certificate
            </button>
          ) : (
            <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
              <span className="font-semibold">Student access:</span> Download issued certificates only
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">{issuedCertificates.length}</div>
              <div className="mt-1 text-sm text-muted-foreground">Issued</div>
              <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Ready for student download</div>
            </div>
            <CustomIcon icon="certificates.svg" folder={iconFolder} alt="Issued" className="h-8 w-8" />
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">{pendingCertificates.length}</div>
              <div className="mt-1 text-sm text-muted-foreground">Pending</div>
              <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Waiting final QA approval</div>
            </div>
            <CustomIcon icon="reviews.svg" folder={iconFolder} alt="Pending" className="h-8 w-8" />
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">{uploadedCertificates.length}</div>
              <div className="mt-1 text-sm text-muted-foreground">Uploads</div>
              <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Manual certificate files</div>
            </div>
            <CustomIcon icon="submissions.svg" folder={iconFolder} alt="Uploads" className="h-8 w-8" />
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">{revokedCertificates.length}</div>
              <div className="mt-1 text-sm text-muted-foreground">Revoked</div>
              <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Blocked from download</div>
            </div>
            <CustomIcon icon="attendance.svg" folder={iconFolder} alt="Revoked" className="h-8 w-8" />
          </div>
        </div>
      </div>

      {notice && (
        <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
          {notice}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="border border-border bg-card p-5">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
              <div>
                <h2 className="text-xl font-bold">Certificate Records</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage issued, pending and revoked certificates. Student upload option is not available.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90]"
                  placeholder="Search certificate"
                />

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90]"
                >
                  <option value="all">All Status</option>
                  <option value="issued">Issued</option>
                  <option value="pending">Pending</option>
                  <option value="draft">Draft</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>
            </div>

            <div className="mt-5 w-full overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Course</th>
                    <th className="px-4 py-3 font-semibold">Certificate Title</th>
                    <th className="px-4 py-3 font-semibold">Certificate No</th>
                    <th className="px-4 py-3 font-semibold">Issue Date</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCertificates.map((item, index) => {
                    const status = getStatus(item)
                    const isIssued = status === 'issued'

                    return (
                      <tr key={item.id || `${getStudentName(item)}-${index}`} className="border-b border-border">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden border border-border bg-background">
                              <Image
                                src="/avatar.svg"
                                alt={getStudentName(item)}
                                width={40}
                                height={40}
                                className="h-full w-full object-cover"
                              />
                            </div>

                            <div>
                              <p className="font-semibold text-foreground">{getStudentName(item)}</p>
                              <p className="text-xs text-muted-foreground">
                                {isIssued ? 'Download enabled' : 'Download locked'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">{getCourseName(item)}</td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {item.title || 'Course Completion Certificate'}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">{getCertificateNo(item, index)}</td>

                        <td className="px-4 py-3 text-muted-foreground">{getIssueDate(item)}</td>

                        <td className="px-4 py-3">
                          <span
                            className={
                              status === 'issued'
                                ? 'border border-[#153e90]/25 bg-[#153e90]/10 px-2 py-1 text-xs font-semibold capitalize text-[#153e90] dark:border-[#6ee75a]/25 dark:bg-[#6ee75a]/10 dark:text-white'
                                : status === 'revoked'
                                  ? 'border border-red-500/25 bg-red-500/10 px-2 py-1 text-xs font-semibold capitalize text-red-600 dark:text-red-300'
                                  : 'border border-border bg-background px-2 py-1 text-xs font-semibold capitalize text-muted-foreground'
                            }
                          >
                            {status}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handlePreview(item)}
                              className="border border-border p-2 hover:bg-accent"
                              title="Preview"
                            >
                              <CustomIcon icon="dashboard.svg" folder={iconFolder} alt="Preview" className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownload(item)}
                              disabled={!isIssued}
                              className="border border-border p-2 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                              title="Download"
                            >
                              <CustomIcon icon="submissions.svg" folder={iconFolder} alt="Download" className="h-4 w-4" />
                            </button>

                            {canManageCertificates && (
                              <button
                                type="button"
                                onClick={() => handleEdit(item)}
                                className="border border-border p-2 hover:bg-accent"
                                title="Edit"
                              >
                                <CustomIcon icon="reviews.svg" folder={iconFolder} alt="Edit" className="h-4 w-4" />
                              </button>
                            )}

                            {canManageCertificates && status !== 'revoked' && (
                              <button
                                type="button"
                                onClick={() => handleRevoke(item)}
                                className="border border-border p-2 hover:bg-red-500/10"
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
            </div>

            {filteredCertificates.length === 0 && (
              <div className="mt-5 border border-border bg-background p-6 text-center text-sm text-muted-foreground">
                No certificates found for the selected filters.
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
                <p className="font-semibold">1. Final Evaluation</p>
                <p className="mt-1 text-muted-foreground">
                  Certificate becomes eligible only after final evaluation or QA approval.
                </p>
              </div>

              <div className="border border-border bg-background p-4">
                <p className="font-semibold">2. Admin Upload</p>
                <p className="mt-1 text-muted-foreground">
                  Admin, Super Admin or Final QA uploads the certificate manually.
                </p>
              </div>

              <div className="border border-border bg-background p-4">
                <p className="font-semibold">3. Student Download</p>
                <p className="mt-1 text-muted-foreground">
                  Student can download only when the certificate status is issued.
                </p>
              </div>
            </div>
          </div>

          <div className="border border-border bg-card p-5">
            <h2 className="text-xl font-bold">Access Rules</h2>

            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>
                Admin can upload, preview, edit, issue and revoke certificates.
              </p>
              <p>
                Final QA can approve or control certificate release if assigned.
              </p>
              <p>
                Student can only preview and download issued certificates.
              </p>
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