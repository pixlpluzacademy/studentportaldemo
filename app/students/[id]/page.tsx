'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/auth/provider'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import {
  fetchStudentDetail,
  isStaffScopedStudentView,
  updateStudentAccount,
  type StudentListRow,
  type StudentUiStatus,
} from '@/lib/data/students'
import {
  computeAttendancePercent,
  fetchAttendanceRecords,
  formatAttendanceAverageLabel,
  isAttendanceClassDay,
  saveAttendanceMarks,
  type AttendanceMark,
  type DailyAttendanceRecord,
} from '@/lib/data/attendance'
import { fetchTaskList, getAssignmentTypeLabel, type TaskListRow } from '@/lib/data/tasks'
import {
  fetchTaskSubmissions,
  getReviewStageLabel,
  type TaskSubmissionListRow,
} from '@/lib/data/task-submissions'
import { createClient } from '@/lib/supabase/client'

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

const inputClass =
  'h-10 w-full border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[#153e90] dark:focus:border-[#6ee75a] dark:[color-scheme:dark]'

const selectClass =
  'h-10 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a] dark:[color-scheme:dark]'

const optionClass = 'bg-background text-foreground'

async function getAccessToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

const getStatusClass = (status: StudentUiStatus | string) => {
  if (status === 'active' || status === 'completed') {
    return 'border border-[#153e90]/30 bg-[#153e90]/10 px-3 py-1 text-xs font-medium text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white'
  }

  return 'border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground'
}

const getAttendanceMarkClass = (status: AttendanceMark | string) => {
  if (status === 'present') {
    return 'border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium capitalize text-emerald-700 dark:text-emerald-200'
  }
  if (status === 'absent') {
    return 'border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium capitalize text-red-700 dark:text-red-200'
  }
  if (status === 'late') {
    return 'border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium capitalize text-amber-700 dark:text-amber-200'
  }
  if (status === 'no-class') {
    return 'border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground'
  }
  return 'border border-border bg-background px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground'
}

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const toIsoDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function Page() {
  const params = useParams()
  const studentId = String(params.id || '')
  const { can, user, parentRoleId } = useAuth()
  const { activeBranchId, loading: branchLoading } = useBranchScope()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const [student, setStudent] = useState<StudentListRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attendanceRecords, setAttendanceRecords] = useState<DailyAttendanceRecord[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceError, setAttendanceError] = useState('')
  const [attendanceFrom, setAttendanceFrom] = useState(() =>
    toIsoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  )
  const [attendanceTo, setAttendanceTo] = useState(() => toIsoDate(new Date()))
  const [isAttendanceEditOpen, setIsAttendanceEditOpen] = useState(false)
  const [editingAttendanceDate, setEditingAttendanceDate] = useState('')
  const [editAttendanceStatus, setEditAttendanceStatus] = useState<AttendanceMark>('present')
  const [editAttendanceNote, setEditAttendanceNote] = useState('')
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [attendanceEditError, setAttendanceEditError] = useState('')
  const [attendanceMessage, setAttendanceMessage] = useState('')
  const [studentTasks, setStudentTasks] = useState<TaskListRow[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [tasksError, setTasksError] = useState('')
  const [studentSubmissions, setStudentSubmissions] = useState<TaskSubmissionListRow[]>([])
  const [submissionsLoading, setSubmissionsLoading] = useState(false)
  const [submissionsError, setSubmissionsError] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [joiningDate, setJoiningDate] = useState('')
  const [status, setStatus] = useState<StudentUiStatus>('active')

  const staffScoped = isStaffScopedStudentView(parentRoleId)
  const canEditStudent = can('students.edit') && !staffScoped
  const canEditAttendance = can('attendance.mark') || can('attendance.edit')
  const canViewTasks = can('tasks.view')
  const canViewSubmissions = can('submissions.view')

  async function loadAttendanceForStudent(detail: StudentListRow) {
    if (!detail.batch_id) {
      setAttendanceRecords([])
      setAttendanceError('')
      return
    }

    setAttendanceFrom(
      detail.batch_start_date ||
        toIsoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    )
    setAttendanceTo(detail.batch_end_date || toIsoDate(new Date()))

    setAttendanceLoading(true)
    setAttendanceError('')

    const batchesById = new Map([
      [
        detail.batch_id,
        {
          id: detail.batch_id,
          name: detail.batch_name,
          course: detail.course_name,
          mentor: '',
          mode: 'offline' as const,
          time: '—',
          seats: '',
          status: 'Active',
          start_date: detail.batch_start_date || '',
          end_date: detail.batch_end_date || '',
          class_day_type: detail.batch_class_day_type || 'weekdays',
          custom_days: detail.batch_custom_days || [],
          start_time: null,
          end_time: null,
          class_link: null,
        },
      ],
    ])

    const result = await fetchAttendanceRecords([detail.batch_id], {
      studentId: detail.id,
      batchesById,
    })

    setAttendanceRecords(result.data)
    if (result.error) {
      setAttendanceError(result.error)
    }
    setAttendanceLoading(false)
  }

  async function loadStudent() {
    if (!studentId) return

    setLoading(true)
    setError('')

    const result = await fetchStudentDetail(studentId, {
      branchId: activeBranchId,
      staffUserId: staffScoped ? user?.id || null : null,
    })

    if (result.error || !result.data) {
      setStudent(null)
      setAttendanceRecords([])
      setError(result.error || 'Student not found.')
      setLoading(false)
      return
    }

    setStudent(result.data)
    setLoading(false)
    await loadAttendanceForStudent(result.data)
  }

  useEffect(() => {
    if (!studentId || branchLoading) return

    let cancelled = false

    async function run() {
      setLoading(true)
      setError('')

      const result = await fetchStudentDetail(studentId, {
        branchId: activeBranchId,
        staffUserId: staffScoped ? user?.id || null : null,
      })

      if (cancelled) return

      if (result.error || !result.data) {
        setStudent(null)
        setAttendanceRecords([])
        setError(result.error || 'Student not found.')
        setLoading(false)
        return
      }

      setStudent(result.data)
      setAttendanceFrom(
        result.data.batch_start_date ||
          toIsoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
      )
      setAttendanceTo(result.data.batch_end_date || toIsoDate(new Date()))
      setLoading(false)

      if (!result.data.batch_id) {
        setAttendanceRecords([])
        setAttendanceError('')
        setStudentTasks([])
        setTasksError('')
        setStudentSubmissions([])
        setSubmissionsError('')
        return
      }

      setAttendanceLoading(true)
      setAttendanceError('')
      setTasksLoading(true)
      setTasksError('')
      setSubmissionsLoading(true)
      setSubmissionsError('')

      const batchLookup = new Map([
        [
          result.data.batch_id,
          {
            name: result.data.batch_name,
            courseName: result.data.course_name,
            enrolledCount: 1,
          },
        ],
      ])

      const batchesById = new Map([
        [
          result.data.batch_id,
          {
            id: result.data.batch_id,
            name: result.data.batch_name,
            course: result.data.course_name,
            mentor: '',
            mode: 'offline' as const,
            time: '—',
            seats: '',
            status: 'Active',
            start_date: result.data.batch_start_date || '',
            end_date: result.data.batch_end_date || '',
            class_day_type: result.data.batch_class_day_type || 'weekdays',
            custom_days: result.data.batch_custom_days || [],
            start_time: null,
            end_time: null,
            class_link: null,
          },
        ],
      ])

      const [attendanceResult, tasksResult, submissionsResult] = await Promise.all([
        fetchAttendanceRecords([result.data.batch_id], {
          studentId: result.data.id,
          batchesById,
        }),
        canViewTasks
          ? fetchTaskList([result.data.batch_id], {
              studentId: result.data.id,
              batchLookup,
            })
          : Promise.resolve({ source: 'supabase' as const, data: [] as TaskListRow[], error: null }),
        canViewSubmissions
          ? fetchTaskSubmissions({
              studentId: result.data.id,
              batchIds: [result.data.batch_id],
              batchLookup,
            })
          : Promise.resolve({
              source: 'supabase' as const,
              data: [] as TaskSubmissionListRow[],
              error: null,
            }),
      ])

      if (cancelled) return

      setAttendanceRecords(attendanceResult.data)
      if (attendanceResult.error) {
        setAttendanceError(attendanceResult.error)
      }
      setAttendanceLoading(false)

      setStudentTasks(tasksResult.data || [])
      if (tasksResult.error) {
        setTasksError(tasksResult.error)
      }
      setTasksLoading(false)

      setStudentSubmissions(submissionsResult.data || [])
      if (submissionsResult.error) {
        setSubmissionsError(submissionsResult.error)
      }
      setSubmissionsLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [studentId, activeBranchId, branchLoading, staffScoped, user?.id, canViewTasks, canViewSubmissions])

  const attendancePercent = useMemo(
    () => computeAttendancePercent(attendanceRecords),
    [attendanceRecords],
  )
  const attendanceLabel = useMemo(
    () => formatAttendanceAverageLabel(attendancePercent, attendanceRecords.length > 0),
    [attendancePercent, attendanceRecords.length],
  )
  const presentCount = useMemo(
    () => attendanceRecords.filter((record) => record.status === 'present').length,
    [attendanceRecords],
  )
  const absentCount = useMemo(
    () => attendanceRecords.filter((record) => record.status === 'absent').length,
    [attendanceRecords],
  )
  const lateCount = useMemo(
    () => attendanceRecords.filter((record) => record.status === 'late').length,
    [attendanceRecords],
  )

  const attendanceDayRows = useMemo(() => {
    if (!attendanceFrom || !attendanceTo) return []

    const recordsByDate = new Map<string, DailyAttendanceRecord>()
    attendanceRecords.forEach((record) => {
      recordsByDate.set(record.date, record)
    })

    const start = new Date(`${attendanceFrom}T00:00:00`)
    const end = new Date(`${attendanceTo}T00:00:00`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return []

    const classDayType = student?.batch_class_day_type || 'weekdays'
    const customDays = student?.batch_custom_days || []
    const batchStartDate = student?.batch_start_date || null
    const batchEndDate = student?.batch_end_date || null
    const todayIso = toIsoDate(new Date())
    const rows: { date: string; record: DailyAttendanceRecord | null; isClassDay: boolean }[] = []
    const cursor = new Date(start)

    while (cursor <= end && rows.length < 370) {
      const iso = toIsoDate(cursor)
      if (iso > todayIso) break
      rows.push({
        date: iso,
        record: recordsByDate.get(iso) || null,
        isClassDay: isAttendanceClassDay(iso, {
          startDate: batchStartDate,
          endDate: batchEndDate,
          classDayType,
          customDays,
        }),
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    rows.reverse()
    return rows
  }, [
    attendanceRecords,
    attendanceFrom,
    attendanceTo,
    student?.batch_class_day_type,
    student?.batch_custom_days,
    student?.batch_start_date,
    student?.batch_end_date,
  ])

  const placementReady = Boolean(student?.placement_ready)

  function openEditModal() {
    if (!student) return
    setFullName(student.full_name)
    setEmail(student.email === '—' ? '' : student.email)
    setPhone(student.phone === 'Not added' ? '' : student.phone)
    setJoiningDate(student.joining_date || '')
    setStatus(student.status === 'inactive' ? 'inactive' : 'active')
    setError('')
    setMessage('')
    setIsEditOpen(true)
  }

  function closeEditModal() {
    setIsEditOpen(false)
    setSaving(false)
  }

  function openAttendanceEdit(date: string, record: DailyAttendanceRecord | null) {
    if (!canEditAttendance || !student?.batch_id) return
    if (
      !isAttendanceClassDay(date, {
        startDate: student.batch_start_date,
        endDate: student.batch_end_date,
        classDayType: student.batch_class_day_type || 'weekdays',
        customDays: student.batch_custom_days || [],
      })
    ) {
      return
    }
    setEditingAttendanceDate(date)
    setEditAttendanceStatus(
      record?.status === 'absent' || record?.status === 'late' || record?.status === 'present'
        ? record.status
        : 'present',
    )
    setEditAttendanceNote(record?.note || '')
    setAttendanceEditError('')
    setAttendanceMessage('')
    setIsAttendanceEditOpen(true)
  }

  function closeAttendanceEdit() {
    setIsAttendanceEditOpen(false)
    setSavingAttendance(false)
    setAttendanceEditError('')
    setEditingAttendanceDate('')
  }

  async function handleSaveAttendanceDay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!student?.batch_id || !editingAttendanceDate) return

    if (!canEditAttendance) {
      setAttendanceEditError('Your current permission cannot update attendance.')
      return
    }

    const accessToken = await getAccessToken()
    if (!accessToken) {
      setAttendanceEditError('Session expired. Please login again.')
      return
    }

    setSavingAttendance(true)
    setAttendanceEditError('')

    const result = await saveAttendanceMarks(
      {
        batchId: student.batch_id,
        attendanceDate: editingAttendanceDate,
        marks: [
          {
            studentId: student.id,
            status: editAttendanceStatus,
            note: editAttendanceNote,
          },
        ],
      },
      accessToken,
    )

    setSavingAttendance(false)

    if (!result.ok) {
      setAttendanceEditError(result.error || 'Failed to update attendance.')
      return
    }

    setIsAttendanceEditOpen(false)
    setAttendanceMessage(`Attendance updated for ${formatDate(editingAttendanceDate)}.`)
    await loadAttendanceForStudent(student)
  }

  async function handleSaveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!student) return

    setSaving(true)
    setError('')
    setMessage('')

    if (!canEditStudent) {
      setError('Your current permission cannot edit student details.')
      setSaving(false)
      return
    }

    if (!fullName.trim()) {
      setError('Please enter student name.')
      setSaving(false)
      return
    }

    if (!email.trim()) {
      setError('Please enter email address.')
      setSaving(false)
      return
    }

    const token = await getAccessToken()
    if (!token) {
      setError('Session expired. Please login again.')
      setSaving(false)
      return
    }

    const result = await updateStudentAccount(
      {
        studentId: student.id,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        joiningDate,
        status,
      },
      token,
    )

    if (!result.ok) {
      setError(result.error)
      setSaving(false)
      return
    }

    setMessage('Student details updated successfully.')
    setSaving(false)
    setIsEditOpen(false)
    await loadStudent()
  }

  if (!can('students.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Student Locked</h1>
        <p className="mt-2 text-muted-foreground">
          Your current permission cannot view student details.
        </p>
      </div>
    )
  }

  if (loading || branchLoading) {
    return (
      <div className="border border-border bg-card p-6 text-sm text-muted-foreground">
        Loading student details...
      </div>
    )
  }

  if (!student) {
    return (
      <div className="space-y-6">
        <Button asChild variant="outline" size="sm">
          <Link href="/students" className="inline-flex items-center">
            <CustomIcon icon="arrow.svg" folder={iconFolder} alt="Back" className="mr-2 h-3 w-3 rotate-180" />
            Back to Students
          </Link>
        </Button>

        <Card className="border border-border bg-card">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              {error || 'Student not found or not available under your current assigned batch scope.'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="outline" size="sm">
        <Link href="/students" className="inline-flex items-center">
          <CustomIcon icon="arrow.svg" folder={iconFolder} alt="Back" className="mr-2 h-3 w-3 rotate-180" />
          Back to Students
        </Link>
      </Button>

      {error && !isEditOpen && (
        <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {message && (
        <div className="border border-[#153e90]/30 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white">
          {message}
        </div>
      )}

      <Card className="border border-border bg-card">
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden border border-border bg-card">
                <Image
                  src={student.avatar_url || '/avatar.svg'}
                  alt={student.full_name}
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                />
              </div>

              <div>
                <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Student Profile</p>
                <h1 className="mt-2 text-3xl font-bold">{student.full_name}</h1>
                <p className="mt-2 max-w-4xl text-muted-foreground">
                  {student.course_name} student enrolled in {student.batch_name}.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{student.student_code}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="border border-border bg-background px-3 py-1 text-sm font-medium">
                    {student.course_name}
                  </span>
                  <span className="border border-border bg-background px-3 py-1 text-sm font-medium">
                    {student.batch_name}
                  </span>
                  <span className={getStatusClass(student.status)}>{student.status}</span>
                </div>
              </div>
            </div>

            {canEditStudent && (
              <Button
                type="button"
                onClick={openEditModal}
                className="bg-[#153e90] text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
              >
                Edit Student
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border bg-card">
          <CardContent className="p-3">
            <p className="text-xs uppercase text-muted-foreground">Attendance</p>
            <p className="mt-1 text-xl font-bold">{attendanceLoading ? '…' : attendanceLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {attendanceRecords.length > 0
                ? `${presentCount} present · ${absentCount} absent · ${lateCount} late`
                : 'No marked sessions yet'}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardContent className="p-3">
            <p className="text-xs uppercase text-muted-foreground">Grade</p>
            <p className="mt-1 text-xl font-bold">{student.grade}</p>
            <p className="mt-1 text-xs text-muted-foreground">Academic progress</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardContent className="p-3">
            <p className="text-xs uppercase text-muted-foreground">Placement</p>
            <p className="mt-1 text-xl font-bold">{placementReady ? 'Yes' : 'No'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{student.placement}</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardContent className="p-3">
            <p className="text-xs uppercase text-muted-foreground">Batch Code</p>
            <p className="mt-1 text-lg font-bold">{student.batch_code || '—'}</p>
            <p className="mt-1 text-xs text-muted-foreground">Current enrollment</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle>Student Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="border border-border bg-background/50 p-4">
              <p className="text-sm text-muted-foreground">Full Name</p>
              <p className="mt-2 font-semibold">{student.full_name}</p>
            </div>
            <div className="border border-border bg-background/50 p-4">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="mt-2 break-all font-semibold">{student.email}</p>
            </div>
            <div className="border border-border bg-background/50 p-4">
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="mt-2 font-semibold">{student.phone}</p>
            </div>
            <div className="border border-border bg-background/50 p-4">
              <p className="text-sm text-muted-foreground">Joining Date</p>
              <p className="mt-2 font-semibold">{formatDate(student.joining_date)}</p>
            </div>
            <div className="border border-border bg-background/50 p-4">
              <p className="text-sm text-muted-foreground">Course</p>
              <p className="mt-2 font-semibold">{student.course_name}</p>
            </div>
            <div className="border border-border bg-background/50 p-4">
              <p className="text-sm text-muted-foreground">Batch</p>
              <p className="mt-2 font-semibold">{student.batch_name}</p>
            </div>
            <div className="border border-border bg-background/50 p-4">
              <p className="text-sm text-muted-foreground">Student Code</p>
              <p className="mt-2 font-semibold">{student.student_code}</p>
            </div>
            <div className="border border-border bg-background/50 p-4">
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="mt-2 font-semibold capitalize">{student.status}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList className="flex flex-wrap gap-3 bg-transparent p-0">
          {['attendance', 'tasks', 'submissions', 'placement', 'certificate'].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="border border-border bg-background px-4 py-2 capitalize text-[#153e90] data-[state=active]:border-[#153e90] data-[state=active]:bg-[#153e90]/10 dark:text-white dark:data-[state=active]:border-[#6ee75a] dark:data-[state=active]:bg-[#6ee75a]/10"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="attendance">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle>Attendance Records</CardTitle>
            </CardHeader>
            <CardContent>
              {attendanceError && (
                <div className="mb-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
                  {attendanceError}
                </div>
              )}

              {attendanceMessage && (
                <div className="mb-4 border border-[#153e90]/30 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-[#6ee75a]">
                  {attendanceMessage}
                </div>
              )}

              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">From</label>
                  <input
                    type="date"
                    value={attendanceFrom}
                    max={attendanceTo || undefined}
                    onChange={(event) => setAttendanceFrom(event.target.value)}
                    className={`${inputClass} w-44`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">To</label>
                  <input
                    type="date"
                    value={attendanceTo}
                    min={attendanceFrom || undefined}
                    max={toIsoDate(new Date())}
                    onChange={(event) => setAttendanceTo(event.target.value)}
                    className={`${inputClass} w-44`}
                  />
                </div>
              </div>

              {attendanceLoading ? (
                <div className="border border-border bg-background/50 p-6 text-sm text-muted-foreground">
                  Loading attendance records...
                </div>
              ) : attendanceDayRows.length === 0 ? (
                <div className="border border-border bg-background/50 p-6 text-sm text-muted-foreground">
                  No days in the selected date range.
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[800px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left">
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Session</th>
                        <th className="px-4 py-3 font-semibold">Batch</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Marked By</th>
                        <th className="px-4 py-3 font-semibold">Note</th>
                        {canEditAttendance && <th className="px-4 py-3 font-semibold">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceDayRows.map(({ date, record, isClassDay }) => (
                        <tr key={date} className="border-b border-border">
                          <td className="px-4 py-3 text-foreground">{formatDate(date)}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {isClassDay ? record?.sessionTime || '—' : '—'}
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {record?.batch || student.batch_name || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {!isClassDay ? (
                              <span className={getAttendanceMarkClass('no-class')}>No class assigned</span>
                            ) : record ? (
                              <span className={getAttendanceMarkClass(record.status)}>{record.status}</span>
                            ) : (
                              <span className={getAttendanceMarkClass('unmarked')}>Not marked</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {isClassDay ? record?.markedBy || '—' : '—'}
                          </td>
                          <td className="max-w-[240px] px-4 py-3 text-muted-foreground">
                            <p className="line-clamp-2 whitespace-pre-wrap">
                              {isClassDay ? record?.note || '—' : '—'}
                            </p>
                          </td>
                          {canEditAttendance && (
                            <td className="px-4 py-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!student.batch_id || !isClassDay}
                                onClick={() => openAttendanceEdit(date, record)}
                              >
                                Edit
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canViewTasks ? (
                <div className="border border-border bg-background/50 p-6 text-sm text-muted-foreground">
                  Your current permission cannot view tasks.
                </div>
              ) : tasksError ? (
                <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {tasksError}
                </div>
              ) : tasksLoading ? (
                <div className="border border-border bg-background/50 p-6 text-sm text-muted-foreground">
                  Loading tasks…
                </div>
              ) : studentTasks.length === 0 ? (
                <div className="border border-border bg-background/50 p-6 text-sm text-muted-foreground">
                  No tasks assigned for this student&apos;s batch yet.
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left">
                        <th className="px-4 py-3 font-semibold">Task</th>
                        <th className="px-4 py-3 font-semibold">Assigned By</th>
                        <th className="px-4 py-3 font-semibold">Frequency</th>
                        <th className="px-4 py-3 font-semibold">Due</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Submission</th>
                        <th className="px-4 py-3 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentTasks.map((task) => (
                        <tr key={task.id} className="border-b border-border">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">{task.title}</div>
                            <div className="mt-1 max-w-[280px] text-xs text-muted-foreground">
                              {task.course} · {task.batch}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{task.assignedBy}</td>
                          <td className="px-4 py-3 text-muted-foreground">{getAssignmentTypeLabel(task.frequency)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{task.dueDisplay}</td>
                          <td className="px-4 py-3 text-muted-foreground">{task.status}</td>
                          <td className="px-4 py-3 text-muted-foreground">{task.submissions}</td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/tasks/${task.id}`}
                              className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submissions">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle>Submissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canViewSubmissions ? (
                <div className="border border-border bg-background/50 p-6 text-sm text-muted-foreground">
                  Your current permission cannot view submissions.
                </div>
              ) : submissionsError ? (
                <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {submissionsError}
                </div>
              ) : submissionsLoading ? (
                <div className="border border-border bg-background/50 p-6 text-sm text-muted-foreground">
                  Loading submissions…
                </div>
              ) : studentSubmissions.length === 0 ? (
                <div className="border border-border bg-background/50 p-6 text-sm text-muted-foreground">
                  No submissions found for this student yet.
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left">
                        <th className="px-4 py-3 font-semibold">Task</th>
                        <th className="px-4 py-3 font-semibold">Submitted</th>
                        <th className="px-4 py-3 font-semibold">Stage</th>
                        <th className="px-4 py-3 font-semibold">Mentor Mark</th>
                        <th className="px-4 py-3 font-semibold">HOD Mark</th>
                        <th className="px-4 py-3 font-semibold">Final QA Mark</th>
                        <th className="px-4 py-3 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentSubmissions.map((submission) => (
                        <tr key={submission.id} className="border-b border-border">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">{submission.task}</div>
                            <div className="mt-1 max-w-[240px] break-words text-xs text-muted-foreground">
                              {submission.fileName}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{submission.submitted}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {getReviewStageLabel(submission)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{submission.mentorMark}</td>
                          <td className="px-4 py-3 text-muted-foreground">{submission.hodMark}</td>
                          <td className="px-4 py-3 text-muted-foreground">{submission.qaMark}</td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/task-submissions/${submission.id}`}
                              className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="placement">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle>Placement Readiness</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Placement starts after the batch end date. Then student must have attendance 75%+ and academic average 70%+.
              </p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="border border-border bg-background/50 p-4">
                  <p className="text-sm text-muted-foreground">Placement Status</p>
                  <p className="mt-2 font-semibold">{student.placement}</p>
                </div>
                <div className="border border-border bg-background/50 p-4">
                  <p className="text-sm text-muted-foreground">Course</p>
                  <p className="mt-2 font-semibold">{student.course_name}</p>
                </div>
                <div className="border border-border bg-background/50 p-4">
                  <p className="text-sm text-muted-foreground">Ready for Placement</p>
                  <p className="mt-2 font-semibold">{placementReady ? 'Yes' : 'No'}</p>
                </div>
                <div className="border border-border bg-background/50 p-4">
                  <p className="text-sm text-muted-foreground">Batch End Date</p>
                  <p className="mt-2 font-semibold">{student.batch_end_date || '—'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {student.placement_batch_completed
                      ? 'Batch completed · Placement window open'
                      : 'Batch still running · Placement not started'}
                  </p>
                </div>
                <div className="border border-border bg-background/50 p-4">
                  <p className="text-sm text-muted-foreground">Attendance</p>
                  <p className="mt-2 font-semibold">
                    {student.attendance_percent === null ? '—' : `${student.attendance_percent}%`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Need 75%+ ·{' '}
                    {!student.placement_batch_completed
                      ? 'Checked after batch ends'
                      : student.placement_attendance_ok
                        ? 'Met'
                        : 'Not met'}
                  </p>
                </div>
                <div className="border border-border bg-background/50 p-4">
                  <p className="text-sm text-muted-foreground">Academic Average</p>
                  <p className="mt-2 font-semibold">
                    {student.academic_percent === null ? '—' : `${student.academic_percent}%`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Need 70%+ ·{' '}
                    {!student.placement_batch_completed
                      ? 'Checked after batch ends'
                      : student.placement_academic_ok
                        ? 'Met'
                        : 'Not met'}
                  </p>
                </div>
                <div className="border border-border bg-background/50 p-4">
                  <p className="text-sm text-muted-foreground">Grade</p>
                  <p className="mt-2 font-semibold">{student.grade}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certificate">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle>Certificates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border border-border bg-background/50 p-6 text-sm text-muted-foreground">
                Certificates for this student will appear here.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-6">
              <div>
                <h2 className="text-2xl font-bold">Edit Student</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Update student profile details. Course and batch stay linked to enrollment.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="border border-border px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Full Name</label>
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Phone</label>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className={inputClass}
                    placeholder="Phone number"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Joining Date</label>
                  <input
                    type="date"
                    value={joiningDate}
                    onChange={(event) => setJoiningDate(event.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Status</label>
                  <select
                    value={status === 'inactive' ? 'inactive' : 'active'}
                    onChange={(event) => setStatus(event.target.value as StudentUiStatus)}
                    className={selectClass}
                  >
                    <option value="active" className={optionClass}>
                      Active
                    </option>
                    <option value="inactive" className={optionClass}>
                      Inactive
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Course</label>
                  <input value={student.course_name} className={inputClass} readOnly />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Batch</label>
                  <input value={student.batch_name} className={inputClass} readOnly />
                  <p className="mt-2 text-xs text-muted-foreground">
                    To move a student to another batch, use batch enrollment management.
                  </p>
                </div>
              </div>

              {error && (
                <div className="mt-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={closeEditModal}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[#153e90] text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAttendanceEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-6">
              <div>
                <h2 className="text-xl font-bold">Edit Attendance</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(editingAttendanceDate)} · {student.batch_name || 'Batch'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAttendanceEdit}
                className="border border-border px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveAttendanceDay} className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-sm font-medium">Status</label>
                <select
                  value={editAttendanceStatus}
                  onChange={(event) => setEditAttendanceStatus(event.target.value as AttendanceMark)}
                  className={selectClass}
                  required
                >
                  <option value="present" className={optionClass}>
                    Present
                  </option>
                  <option value="absent" className={optionClass}>
                    Absent
                  </option>
                  <option value="late" className={optionClass}>
                    Late
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Note</label>
                <textarea
                  value={editAttendanceNote}
                  onChange={(event) => setEditAttendanceNote(event.target.value)}
                  rows={3}
                  className="w-full border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  placeholder="Optional note"
                />
              </div>

              {attendanceEditError && (
                <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {attendanceEditError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={closeAttendanceEdit}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingAttendance}
                  className="bg-[#153e90] text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
                >
                  {savingAttendance ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
