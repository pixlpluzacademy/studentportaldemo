'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth/provider'
import {
  batchMatchesBranch,
  batchVisibleToUser,
  fetchBatchById,
  type BatchDetailRow,
  type ClassDayType,
} from '@/lib/data/batches'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import type { CourseType } from '@/lib/data/courses'
import {
  createStudentAccount,
  fetchBatchStudents,
  generateStudentPassword,
  type BatchStudentRow,
} from '@/lib/data/students'
import { createClient } from '@/lib/supabase/client'

type StudentForm = {
  fullName: string
  email: string
  phone: string
}

type CreatedCredentials = {
  fullName: string
  email: string
  password: string
  studentCode: string
}

const courseTypeOptions: { value: CourseType; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'basic', label: 'Basic' },
]

const classDayOptions: { value: ClassDayType; label: string }[] = [
  { value: 'weekdays', label: 'Monday to Friday' },
  { value: 'weekend', label: 'Saturday and Sunday' },
  { value: 'custom', label: 'Custom Days' },
]

const inputClass =
  'h-10 w-full border border-border bg-background px-3 text-sm outline-none'

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

function getCourseTypeLabel(courseType: CourseType) {
  return courseTypeOptions.find((item) => item.value === courseType)?.label || 'Professional'
}

function getClassDayLabel(classDayType: ClassDayType) {
  return classDayOptions.find((item) => item.value === classDayType)?.label || 'Monday to Friday'
}

function formatTimeLabel(timeValue: string | null) {
  if (!timeValue) return 'No time'

  const [hourValue, minuteValue] = timeValue.split(':')
  const hour = Number(hourValue)
  const minute = Number(minuteValue || '0')

  if (Number.isNaN(hour)) return timeValue

  const period = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12

  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`
}

function formatDate(dateValue: string | null | undefined) {
  if (!dateValue) return 'Not added'

  const date = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(date.getTime())) return 'Not added'

  return date.toLocaleDateString()
}

function formatCredentialsText(credentials: CreatedCredentials) {
  return `Name: ${credentials.fullName}\nEmail: ${credentials.email}\nPassword: ${credentials.password}\nStudent Code: ${credentials.studentCode}`
}

async function getAccessToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

async function copyCredential(label: string, value: string, setNotice: (value: string) => void) {
  try {
    await navigator.clipboard.writeText(value)
    setNotice(`${label} copied.`)
  } catch {
    setNotice(`Could not copy ${label.toLowerCase()}.`)
  }
}

function getStaffName(batch: BatchDetailRow, staffType: 'hod' | 'trainer') {
  return (
    batch.staff_assignments.find((assignment) => assignment.staff_type === staffType)?.staff_name ||
    'Not assigned'
  )
}

export default function ViewBatchPage() {
  const params = useParams()
  const batchId = String(params.id || '')

  const { user, can } = useAuth()
  const { activeBranchId, hasAllBranchAccess } = useBranchScope()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const [batch, setBatch] = useState<BatchDetailRow | null>(null)
  const [students, setStudents] = useState<BatchStudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [error, setError] = useState('')
  const [studentsError, setStudentsError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null)
  const [copyNotice, setCopyNotice] = useState('')

  const [studentForm, setStudentForm] = useState<StudentForm>({
    fullName: '',
    email: '',
    phone: '',
  })

  const canCreateBatch = can('batches.create')
  const canEditBatch = can('batches.edit')
  const canAssignBatchStaff = can('batches.assign')
  const hasManagementBatchAccess = canCreateBatch || canEditBatch || canAssignBatchStaff
  const canCreateStudent = can('students.create') || can('users.create') || canEditBatch

  useEffect(() => {
    async function loadBatch() {
      setLoading(true)
      setError('')

      const result = await fetchBatchById(batchId)

      if (result.error) {
        setError(result.error)
        setBatch(null)
        setLoading(false)
        return
      }

      if (!result.data) {
        setError('Batch not found.')
        setBatch(null)
        setLoading(false)
        return
      }

      if (!hasAllBranchAccess && activeBranchId && !batchMatchesBranch(result.data, activeBranchId)) {
        setError('This batch is not in the selected branch scope.')
        setBatch(null)
        setLoading(false)
        return
      }

      if (!batchVisibleToUser(result.data, user?.id, hasManagementBatchAccess)) {
        setError('This batch is outside your permission scope.')
        setBatch(null)
        setLoading(false)
        return
      }

      setBatch(result.data)
      setLoading(false)
    }

    if (batchId) {
      void loadBatch()
    }
  }, [activeBranchId, batchId, hasAllBranchAccess, hasManagementBatchAccess, user?.id])

  useEffect(() => {
    async function loadStudents() {
      if (!batch) return

      setStudentsLoading(true)
      setStudentsError('')

      const result = await fetchBatchStudents(batch.id)

      if (result.error) {
        setStudentsError(result.error)
        setStudents([])
      } else {
        setStudents(result.data)
      }

      setStudentsLoading(false)
    }

    if (batch) {
      void loadStudents()
    }
  }, [batch])

  const enrolledCount = batch?.enrolled_count ?? students.length
  const maxSeats = batch?.max_seats || 0
  const availableSeats = maxSeats > 0 ? Math.max(maxSeats - enrolledCount, 0) : 0
  const isBatchFull = maxSeats > 0 && enrolledCount >= maxSeats

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) return students

    return students.filter((student) => {
      return (
        student.full_name.toLowerCase().includes(keyword) ||
        student.email.toLowerCase().includes(keyword) ||
        student.student_code.toLowerCase().includes(keyword) ||
        student.phone.toLowerCase().includes(keyword) ||
        student.status.toLowerCase().includes(keyword)
      )
    })
  }, [students, search])

  const resetForm = () => {
    setStudentForm({
      fullName: '',
      email: '',
      phone: '',
    })
  }

  const openAddStudentModal = () => {
    setModalError('')
    resetForm()
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setModalError('')
    setSaving(false)
  }

  const reloadStudents = async () => {
    if (!batch) return

    const result = await fetchBatchStudents(batch.id)
    if (!result.error) {
      setStudents(result.data)
    }

    const batchResult = await fetchBatchById(batch.id)
    if (!batchResult.error && batchResult.data) {
      setBatch(batchResult.data)
    }
  }

  const handleCreateStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setModalError('')

    if (!batch) return

    if (!canCreateStudent) {
      setModalError('Your current permission cannot create students.')
      return
    }

    if (!studentForm.fullName.trim()) {
      setModalError('Full name is required.')
      return
    }

    if (!studentForm.email.trim()) {
      setModalError('Email is required.')
      return
    }

    if (batch.status !== 'active') {
      setModalError('Students can only be added to an active batch.')
      return
    }

    if (isBatchFull) {
      setModalError('This batch is already full. Enrollment is stopped.')
      return
    }

    const token = await getAccessToken()
    if (!token) {
      setModalError('Session expired. Please login again.')
      return
    }

    setSaving(true)

    const password = generateStudentPassword()
    const result = await createStudentAccount(
      {
        fullName: studentForm.fullName,
        email: studentForm.email,
        phone: studentForm.phone,
        batchId: batch.id,
        password,
      },
      token,
    )

    if (!result.ok) {
      setModalError(result.error)
      setSaving(false)
      return
    }

    setCreatedCredentials({
      fullName: studentForm.fullName.trim(),
      email: result.email,
      password: result.password,
      studentCode: result.studentCode,
    })
    setCopyNotice('')
    setMessage(`Student created successfully. Student code: ${result.studentCode}`)
    await reloadStudents()
    setSaving(false)
    setIsModalOpen(false)
    resetForm()
  }

  if (!can('batches.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Batches Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view batch details.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="border border-border bg-card p-6 text-sm text-muted-foreground">
        Loading batch details…
      </div>
    )
  }

  if (error || !batch) {
    return (
      <div className="space-y-6">
        <Button asChild variant="outline" size="sm">
          <Link href="/batches">Back to Batches</Link>
        </Button>

        <Card className="border border-border bg-card">
          <CardContent className="p-6">
            <h1 className="text-xl font-bold">Batch not found</h1>
            <p className="mt-2 text-sm text-red-500">{error || 'Could not load this batch.'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const batchModeLabel = batch.batch_mode === 'online' ? 'Online' : 'Onsite'
  const statusLabel = batch.status

  return (
    <div className="space-y-6">
      <Button asChild variant="outline" size="sm">
        <Link href="/batches" className="inline-flex items-center">
          <CustomIcon icon="arrow-left.svg" folder={iconFolder} alt="Back" className="mr-2 h-4 w-4" />
          Back to Batches
        </Link>
      </Button>

      {message && (
        <div className="border border-[#6ee75a]/30 bg-[#6ee75a]/10 px-4 py-3 text-sm text-[#6ee75a]">
          {message}
        </div>
      )}

      <Card className="border border-border bg-card">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Batch Details</p>
              <h1 className="mt-2 text-3xl font-bold">{batch.name}</h1>
              <p className="mt-3 max-w-4xl text-muted-foreground">
                {batch.description || 'No description added.'}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="border border-border bg-background px-3 py-1 text-sm font-medium">
                  {batch.batch_code || '—'}
                </span>

                <span className="border border-border bg-background px-3 py-1 text-sm font-medium">
                  {getCourseTypeLabel(batch.course_type)}
                </span>

                <span
                  className={
                    statusLabel === 'active'
                      ? 'border border-[#6ee75a]/30 bg-[#6ee75a]/10 px-3 py-1 text-sm font-medium text-[#6ee75a]'
                      : statusLabel === 'full'
                        ? 'border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-600 dark:text-amber-300'
                        : statusLabel === 'completed'
                          ? 'border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-300'
                          : 'border border-red-500/30 bg-red-500/10 px-3 py-1 text-sm font-medium text-red-400'
                  }
                >
                  {statusLabel}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/batches">All Batches</Link>
              </Button>

              {canCreateStudent && (
                <Button
                  type="button"
                  onClick={openAddStudentModal}
                  disabled={isBatchFull || batch.status !== 'active'}
                  className="bg-[#153e90] text-white hover:bg-[#0f2f6d] dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#5dd84a]"
                >
                  Add Student
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border bg-card">
          <CardContent className="p-3">
            <p className="text-sm text-muted-foreground">Enrolled Students</p>
            <p className="mt-3 text-4xl font-bold">{enrolledCount}</p>
            <p className="mt-4 text-sm text-muted-foreground">Currently enrolled</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardContent className="p-3">
            <p className="text-sm text-muted-foreground">Maximum Seats</p>
            <p className="mt-3 text-4xl font-bold">{maxSeats}</p>
            <p className="mt-4 text-sm text-muted-foreground">Enrollment limit</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardContent className="p-3">
            <p className="text-sm text-muted-foreground">Available Seats</p>
            <p className="mt-3 text-4xl font-bold">{availableSeats}</p>
            <p className="mt-4 text-sm text-muted-foreground">Stops at full capacity</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardContent className="p-3">
            <p className="text-sm text-muted-foreground">Staff Assigned</p>
            <p className="mt-3 text-4xl font-bold">{batch.staff_assignments.length}</p>
            <p className="mt-4 text-sm text-muted-foreground">HOD, trainer, and mentors</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle>Batch Information</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Department</p>
              <p className="mt-2 font-semibold">{batch.department_name}</p>
            </div>

            <div className="border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Course</p>
              <p className="mt-2 font-semibold">{batch.course_name}</p>
            </div>

            <div className="border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">HOD</p>
              <p className="mt-2 font-semibold">{getStaffName(batch, 'hod')}</p>
            </div>

            <div className="border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Trainer</p>
              <p className="mt-2 font-semibold">{getStaffName(batch, 'trainer')}</p>
            </div>

            <div className="border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Branch</p>
              <p className="mt-2 font-semibold">{batch.branch_name}</p>
            </div>

            <div className="border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Mode</p>
              <p className="mt-2 font-semibold">{batchModeLabel}</p>
            </div>

            <div className="border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="mt-2 font-semibold">
                {batch.duration_months} {batch.duration_months === 1 ? 'month' : 'months'}
              </p>
            </div>

            <div className="border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Class Days</p>
              <p className="mt-2 font-semibold">{getClassDayLabel(batch.class_day_type)}</p>
            </div>

            <div className="border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Dates</p>
              <p className="mt-2 font-semibold">
                {formatDate(batch.start_date)} to {formatDate(batch.end_date)}
              </p>
            </div>

            <div className="border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Time</p>
              <p className="mt-2 font-semibold">
                {formatTimeLabel(batch.batch_start_time)} to {formatTimeLabel(batch.batch_end_time)}
              </p>
            </div>

            {batch.batch_mode === 'online' && (
              <div className="border border-border bg-background p-4 md:col-span-2">
                <p className="text-sm text-muted-foreground">Class Link</p>
                {batch.class_link ? (
                  <a
                    href={batch.class_link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block font-semibold text-[#153e90] underline dark:text-[#6ee75a]"
                  >
                    {batch.class_link}
                  </a>
                ) : (
                  <p className="mt-2 font-semibold">Not added</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border bg-card">
        <CardHeader>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle>Student Directory</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Students enrolled in this batch.
              </p>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 w-full border border-border bg-background px-3 text-sm outline-none xl:w-72"
              placeholder="Search students"
            />
          </div>
        </CardHeader>

        <CardContent>
          {studentsError && (
            <div className="mb-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {studentsError}
            </div>
          )}

          {studentsLoading ? (
            <div className="border border-border bg-background p-6 text-sm text-muted-foreground">
              Loading students…
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="border border-border bg-background p-6 text-sm text-muted-foreground">
              No students found in this batch.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Student Code</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Phone</th>
                    <th className="px-4 py-3 font-semibold">Joining Date</th>
                    <th className="px-4 py-3 font-semibold">Attendance</th>
                    <th className="px-4 py-3 font-semibold">Grade</th>
                    <th className="px-4 py-3 font-semibold">Placement</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="border-b border-border">
                      <td className="px-4 py-4">
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
                            {student.profile_id ? (
                              <Link
                                href={`/students/${student.profile_id}`}
                                className="font-semibold hover:underline"
                              >
                                {student.full_name}
                              </Link>
                            ) : (
                              <p className="font-semibold">{student.full_name}</p>
                            )}
                            <p className="text-xs text-muted-foreground">{batch.course_name}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">{student.student_code}</td>
                      <td className="px-4 py-4 text-muted-foreground">{student.email}</td>
                      <td className="px-4 py-4 text-muted-foreground">{student.phone}</td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {formatDate(student.joining_date)}
                      </td>
                      <td className="px-4 py-4">—</td>
                      <td className="px-4 py-4">—</td>
                      <td className="px-4 py-4">—</td>
                      <td className="px-4 py-4">
                        <span className="border border-[#6ee75a]/30 bg-[#6ee75a]/10 px-3 py-1 text-xs font-medium text-[#6ee75a]">
                          {student.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-6">
              <div>
                <h2 className="text-2xl font-bold">Add Student</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Creates a portal account and enrolls the student in this batch. Student code is
                  generated automatically.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="border border-border px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="p-6">
              <div className="mb-5 grid gap-4 md:grid-cols-2">
                <div className="border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">Batch Code</p>
                  <p className="mt-2 font-semibold">{batch.batch_code || '—'}</p>
                </div>

                <div className="border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">Available Seats</p>
                  <p className="mt-2 font-semibold">
                    {availableSeats} / {maxSeats}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Full Name</label>
                  <input
                    value={studentForm.fullName}
                    onChange={(event) =>
                      setStudentForm({
                        ...studentForm,
                        fullName: event.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="Enter student name"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Email</label>
                  <input
                    type="email"
                    value={studentForm.email}
                    onChange={(event) =>
                      setStudentForm({
                        ...studentForm,
                        email: event.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="student@example.com"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Phone</label>
                  <input
                    value={studentForm.phone}
                    onChange={(event) =>
                      setStudentForm({
                        ...studentForm,
                        phone: event.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="Phone number"
                  />
                </div>
              </div>

              {modalError && (
                <div className="mt-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {modalError}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>

                <Button type="submit" disabled={saving || isBatchFull}>
                  {saving ? 'Creating...' : 'Create Student'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(createdCredentials)}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedCredentials(null)
            setCopyNotice('')
          }
        }}
      >
        <DialogContent className="border border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Student Created</DialogTitle>
            <DialogDescription>
              Login credentials for the new student. Copy and share them securely.
            </DialogDescription>
          </DialogHeader>

          {createdCredentials && (
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-sm font-semibold">Student Code</span>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={createdCredentials.studentCode}
                    className="h-10 min-w-0 flex-1 border border-border bg-background px-3 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void copyCredential('Student code', createdCredentials.studentCode, setCopyNotice)
                    }
                    className="shrink-0 border border-border px-3 text-sm font-semibold hover:bg-accent"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold">Name</span>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={createdCredentials.fullName}
                    className="h-10 min-w-0 flex-1 border border-border bg-background px-3 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void copyCredential('Name', createdCredentials.fullName, setCopyNotice)
                    }
                    className="shrink-0 border border-border px-3 text-sm font-semibold hover:bg-accent"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold">Email</span>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={createdCredentials.email}
                    className="h-10 min-w-0 flex-1 border border-border bg-background px-3 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void copyCredential('Email', createdCredentials.email, setCopyNotice)
                    }
                    className="shrink-0 border border-border px-3 text-sm font-semibold hover:bg-accent"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold">Password</span>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={createdCredentials.password}
                    className="h-10 min-w-0 flex-1 border border-border bg-background px-3 text-sm font-semibold text-[#153e90] outline-none dark:text-[#6ee75a]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void copyCredential('Password', createdCredentials.password, setCopyNotice)
                    }
                    className="shrink-0 border border-border px-3 text-sm font-semibold hover:bg-accent"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {copyNotice && (
                <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">{copyNotice}</p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <button
              type="button"
              onClick={async () => {
                if (!createdCredentials) return
                await copyCredential(
                  'Login credentials',
                  formatCredentialsText(createdCredentials),
                  setCopyNotice,
                )
              }}
              className="inline-flex items-center justify-center border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
            >
              Copy All
            </button>

            <Button
              type="button"
              onClick={() => {
                setCreatedCredentials(null)
                setCopyNotice('')
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
