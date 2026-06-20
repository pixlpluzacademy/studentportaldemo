'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth/provider'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import {
  fetchAttendanceRecords,
  fetchStudentIdByProfile,
  fetchStudentsForBatches,
  mapBatchListRowToAttendanceBatch,
  mapBatchStudentsToAttendanceStudents,
  saveAttendanceMarks,
  type AttendanceBatch,
  type AttendanceMark,
  type AttendanceStudent,
  type DailyAttendanceRecord,
} from '@/lib/data/attendance'
import { fetchAccessibleBatches, isStudentMyCoursesView } from '@/lib/data/my-courses'
import { createClient } from '@/lib/supabase/client'

type ViewLevel = 'batches' | 'batch-students' | 'student-days'
type AttendanceTab = 'view' | 'mark'

type MarkingRow = {
  studentId: string
  status: AttendanceMark
  note: string
}

async function getAccessToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
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

const inputClass =
  'h-10 w-full border border-border bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground dark:[color-scheme:dark]'

const selectClass =
  'h-10 w-full border border-border bg-transparent px-3 text-sm text-foreground outline-none dark:[color-scheme:dark]'

const optionClass = 'bg-[#111111] text-white'

const getToday = () => {
  return new Date().toISOString().split('T')[0]
}

const formatTimeLabel = (timeValue: string | null) => {
  if (!timeValue) return 'No time'

  const [hourValue, minuteValue] = timeValue.split(':')
  const hour = Number(hourValue)
  const minute = Number(minuteValue || '0')

  if (Number.isNaN(hour)) return timeValue

  const period = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12

  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`
}

const formatDate = (dateValue: string) => {
  if (!dateValue) return 'Not selected'

  const date = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(date.getTime())) return dateValue

  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const getClassDayLabel = (classDayType: AttendanceBatch['class_day_type']) => {
  if (classDayType === 'weekdays') return 'Monday to Friday'
  if (classDayType === 'weekend') return 'Saturday and Sunday'

  return 'Custom Days'
}

const getMarkClass = (status: AttendanceMark | string) => {
  if (status === 'present') {
    return 'border border-[#6ee75a]/30 bg-[#6ee75a]/10 px-3 py-1 text-xs font-medium text-[#6ee75a]'
  }

  if (status === 'absent') {
    return 'border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400'
  }

  if (status === 'late') {
    return 'border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-400'
  }

  return 'border border-border bg-transparent px-3 py-1 text-xs font-medium text-muted-foreground'
}

const isDateInsideBatchRange = (dateValue: string, batch: AttendanceBatch) => {
  if (!dateValue || !batch.start_date || !batch.end_date) return false

  const selected = new Date(`${dateValue}T00:00:00`)
  const start = new Date(`${batch.start_date}T00:00:00`)
  const end = new Date(`${batch.end_date}T00:00:00`)

  if (
    Number.isNaN(selected.getTime()) ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return false
  }

  return selected >= start && selected <= end
}

const isValidClassDay = (dateValue: string, classDayType: AttendanceBatch['class_day_type']) => {
  if (!dateValue) return false

  const date = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(date.getTime())) return false

  const day = date.getDay()

  if (classDayType === 'weekdays') return day >= 1 && day <= 5
  if (classDayType === 'weekend') return day === 0 || day === 6

  return true
}

export default function Page() {
  const { can, user, role, parentRoleId } = useAuth()
  const { activeBranchId, loading: branchLoading } = useBranchScope()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const [scopedBatches, setScopedBatches] = useState<AttendanceBatch[]>([])
  const [allStudents, setAllStudents] = useState<AttendanceStudent[]>([])
  const [dailyAttendance, setDailyAttendance] = useState<DailyAttendanceRecord[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<AttendanceTab>('view')
  const [viewLevel, setViewLevel] = useState<ViewLevel>('batches')
  const [selectedViewBatchName, setSelectedViewBatchName] = useState('')
  const [selectedViewStudentId, setSelectedViewStudentId] = useState('')

  const [selectedMarkBatchName, setSelectedMarkBatchName] = useState('')
  const [selectedDate] = useState(getToday())
  const [classLink, setClassLink] = useState('')
  const [markingRows, setMarkingRows] = useState<Record<string, MarkingRow>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const isStudentView = isStudentMyCoursesView(parentRoleId)
  const isMentorView = parentRoleId === 'mentor'
  const isHodView = false

  const canMarkAttendance =
    !isStudentView && (can('attendance.mark') || can('attendance.edit'))

  useEffect(() => {
    if (branchLoading || !user?.id) {
      setDataLoading(branchLoading)
      return
    }

    if (!isStudentView && !activeBranchId) {
      setDataLoading(false)
      return
    }

    let cancelled = false
    const userId = user.id
    const branchId = activeBranchId || ''

    async function loadAttendanceData() {
      setDataLoading(true)
      setDataError('')

      const batchResult = await fetchAccessibleBatches({
        branchId,
        userId,
        parentRoleId,
      })

      if (cancelled) return

      if (batchResult.error) {
        setDataError(batchResult.error)
        setScopedBatches([])
        setAllStudents([])
        setDailyAttendance([])
        setDataLoading(false)
        return
      }

      const batches = batchResult.batches.map(mapBatchListRowToAttendanceBatch)
      const batchIds = batches.map((batch) => batch.id)
      const batchById = new Map(batches.map((batch) => [batch.id, batch]))

      const [studentsResult, recordsResult, studentId] = await Promise.all([
        fetchStudentsForBatches(batchIds),
        fetchAttendanceRecords(batchIds, { batchesById: batchById }),
        isStudentView ? fetchStudentIdByProfile(userId) : Promise.resolve(null),
      ])

      if (cancelled) return

      if (studentsResult.error || recordsResult.error) {
        setDataError(studentsResult.error || recordsResult.error || 'Failed to load attendance.')
      }

      const students = batches.flatMap((batch) => {
        const batchStudents = studentsResult.data.filter((student) => student.batch_id === batch.id)
        return mapBatchStudentsToAttendanceStudents(batchStudents, batch, recordsResult.data)
      })

      const records = recordsResult.data.map((record) => {
        const batch = batchById.get(record.batchId)
        return {
          ...record,
          sessionTime: batch
            ? `${formatTimeLabel(batch.start_time)} to ${formatTimeLabel(batch.end_time)}`
            : record.sessionTime,
          classLink: isStudentView ? null : record.classLink,
        }
      })

      setScopedBatches(batches)
      setAllStudents(students)
      setDailyAttendance(records)
      setCurrentStudentId(studentId)
      setDataLoading(false)
    }

    void loadAttendanceData()

    return () => {
      cancelled = true
    }
  }, [activeBranchId, branchLoading, isStudentView, parentRoleId, user?.id])

  const scopedBatchNames = useMemo(() => {
    return scopedBatches.map((batch) => batch.name)
  }, [scopedBatches])

  const currentStudent = useMemo(() => {
    if (!currentStudentId) return null
    return allStudents.find((student) => student.id === currentStudentId) || null
  }, [allStudents, currentStudentId])

  const visibleStudents = useMemo(() => {
    if (isStudentView) return currentStudent ? [currentStudent] : []

    return allStudents.filter((student) => scopedBatchNames.includes(student.batch))
  }, [allStudents, scopedBatchNames, isStudentView, currentStudent])

  const visibleAttendance = useMemo(() => {
    if (isStudentView) {
      if (!currentStudent) return []

      return dailyAttendance.filter((item) => item.studentId === currentStudent.id)
    }

    return dailyAttendance.filter((item) => scopedBatchNames.includes(item.batch))
  }, [dailyAttendance, scopedBatchNames, isStudentView, currentStudent])

  const selectedViewBatch = useMemo(() => {
    return scopedBatches.find((batch) => batch.name === selectedViewBatchName) || null
  }, [scopedBatches, selectedViewBatchName])

  const selectedViewStudent = useMemo(() => {
    return visibleStudents.find((student) => student.id === selectedViewStudentId) || null
  }, [visibleStudents, selectedViewStudentId])

  const selectedMarkBatch = useMemo(() => {
    return scopedBatches.find((batch) => batch.name === selectedMarkBatchName) || null
  }, [scopedBatches, selectedMarkBatchName])

  const selectedMarkStudents = useMemo(() => {
    if (!selectedMarkBatch) return []

    return allStudents.filter((student) => student.batch === selectedMarkBatch.name)
  }, [allStudents, selectedMarkBatch])

  const isInsideDateRange = selectedMarkBatch
    ? isDateInsideBatchRange(selectedDate, selectedMarkBatch)
    : false

  const isScheduledClassDay = selectedMarkBatch
    ? isValidClassDay(selectedDate, selectedMarkBatch.class_day_type)
    : false

  const canShowMarkRegister =
    Boolean(selectedMarkBatch) && isInsideDateRange && isScheduledClassDay

  const batchSummary = useMemo(() => {
    return scopedBatches.map((batch) => {
      const batchStudents = visibleStudents.filter((student) => student.batch === batch.name)
      const batchAttendance = visibleAttendance.filter((item) => item.batch === batch.name)
      const todayAttendance = batchAttendance.filter((item) => item.date === getToday())

      const presentToday = todayAttendance.filter((item) => item.status === 'present').length
      const absentToday = todayAttendance.filter((item) => item.status === 'absent').length
      const lateToday = todayAttendance.filter((item) => item.status === 'late').length

      const presentTotal = batchAttendance.filter((item) => item.status === 'present').length
      const average =
        batchAttendance.length > 0
          ? Math.round((presentTotal / batchAttendance.length) * 100)
          : 0

      return {
        batch,
        totalStudents: batchStudents.length,
        average,
        presentToday,
        absentToday,
        lateToday,
      }
    })
  }, [scopedBatches, visibleStudents, visibleAttendance])

  const selectedBatchStudents = useMemo(() => {
    if (!selectedViewBatch) return []

    return visibleStudents.filter((student) => student.batch === selectedViewBatch.name)
  }, [visibleStudents, selectedViewBatch])

  const getStudentSummary = (student: AttendanceStudent) => {
    const records = visibleAttendance.filter((item) => item.studentId === student.id)
    const present = records.filter((item) => item.status === 'present').length
    const absent = records.filter((item) => item.status === 'absent').length
    const late = records.filter((item) => item.status === 'late').length
    const average = records.length > 0 ? Math.round((present / records.length) * 100) : 0

    return {
      present,
      absent,
      late,
      average,
      records,
    }
  }

  const totalPresent = visibleAttendance.filter((item) => item.status === 'present').length
  const totalAbsent = visibleAttendance.filter((item) => item.status === 'absent').length
  const totalLate = visibleAttendance.filter((item) => item.status === 'late').length
  const overallAverage =
    visibleAttendance.length > 0 ? Math.round((totalPresent / visibleAttendance.length) * 100) : 0

  const handleViewBatch = (batchName: string) => {
    setSelectedViewBatchName(batchName)
    setSelectedViewStudentId('')
    setViewLevel('batch-students')
    setMessage('')
    setError('')
  }

  const handleViewStudent = (studentId: string) => {
    setSelectedViewStudentId(studentId)
    setViewLevel('student-days')
    setMessage('')
    setError('')
  }

  const backToBatches = () => {
    setSelectedViewBatchName('')
    setSelectedViewStudentId('')
    setViewLevel('batches')
  }

  const backToBatchStudents = () => {
    setSelectedViewStudentId('')
    setViewLevel('batch-students')
  }

  const handleSelectMarkBatch = (batchName: string) => {
    const batch = scopedBatches.find((item) => item.name === batchName) || null
    const batchStudents = allStudents.filter((student) => student.batch === batchName)
    const today = getToday()
    const todayRecords = dailyAttendance.filter(
      (record) => record.batch === batchName && record.date === today,
    )
    const savedClassLink = todayRecords.find((record) => record.classLink)?.classLink

    setSelectedMarkBatchName(batchName)
    setClassLink(savedClassLink || batch?.class_link || '')
    setMessage('')
    setError('')

    const defaultRows = batchStudents.reduce<Record<string, MarkingRow>>((result, student) => {
      const todayRecord = todayRecords.find((record) => record.studentId === student.id)

      result[student.id] = {
        studentId: student.id,
        status:
          todayRecord && todayRecord.status !== 'unmarked' ? todayRecord.status : 'unmarked',
        note: todayRecord?.note || '',
      }

      return result
    }, {})

    setMarkingRows(defaultRows)
  }

  const updateStudentMark = (studentId: string, status: AttendanceMark) => {
    setMarkingRows((current) => ({
      ...current,
      [studentId]: {
        studentId,
        status,
        note: current[studentId]?.note || '',
      },
    }))
  }

  const updateStudentNote = (studentId: string, note: string) => {
    setMarkingRows((current) => ({
      ...current,
      [studentId]: {
        studentId,
        status: current[studentId]?.status || 'unmarked',
        note,
      },
    }))
  }

  const markAll = (status: AttendanceMark) => {
    const nextRows = selectedMarkStudents.reduce<Record<string, MarkingRow>>((result, student) => {
      result[student.id] = {
        studentId: student.id,
        status,
        note: markingRows[student.id]?.note || '',
      }

      return result
    }, {})

    setMarkingRows(nextRows)
  }

  const resetMarking = () => {
    const nextRows = selectedMarkStudents.reduce<Record<string, MarkingRow>>((result, student) => {
      result[student.id] = {
        studentId: student.id,
        status: 'unmarked',
        note: '',
      }

      return result
    }, {})

    setMarkingRows(nextRows)
  }

  const saveAttendance = async () => {
    setMessage('')
    setError('')

    if (!canMarkAttendance) {
      setError('Your current permission cannot mark attendance.')
      return
    }

    if (!selectedMarkBatch) {
      setError('Please select a batch first.')
      return
    }

    if (!isInsideDateRange) {
      setError('Today is outside this batch date range.')
      return
    }

    if (!isScheduledClassDay) {
      setError('No class scheduled for today.')
      return
    }

    if (selectedMarkBatch.mode === 'online' && !classLink.trim()) {
      setError('Please add Zoom / Google Meet link for this online batch.')
      return
    }

    if (selectedMarkStudents.length === 0) {
      setError('No students found in this batch.')
      return
    }

    const unmarkedCount = Object.values(markingRows).filter((item) => item.status === 'unmarked').length

    if (unmarkedCount > 0) {
      setError('Please mark all students before saving attendance.')
      return
    }

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setError('Session expired. Please login again.')
      return
    }

    setSaving(true)

    const result = await saveAttendanceMarks(
      {
        batchId: selectedMarkBatch.id,
        attendanceDate: selectedDate,
        classLink: selectedMarkBatch.mode === 'online' ? classLink.trim() : undefined,
        marks: selectedMarkStudents.map((student) => ({
          studentId: student.id,
          status: markingRows[student.id]?.status || 'unmarked',
          note: markingRows[student.id]?.note || '',
        })),
      },
      accessToken,
    )

    setSaving(false)

    if (!result.ok) {
      setError(result.error || 'Failed to save attendance.')
      return
    }

    const batchById = new Map(scopedBatches.map((batch) => [batch.id, batch]))
    const recordsResult = await fetchAttendanceRecords(scopedBatches.map((batch) => batch.id), {
      batchesById: batchById,
    })
    const records = recordsResult.data.map((record) => {
      const batch = batchById.get(record.batchId)
      return {
        ...record,
        sessionTime: batch
          ? `${formatTimeLabel(batch.start_time)} to ${formatTimeLabel(batch.end_time)}`
          : record.sessionTime,
        classLink: isStudentView ? null : record.classLink,
      }
    })

    setDailyAttendance(records)
    setAllStudents(
      scopedBatches.flatMap((batch) => {
        const batchStudents = allStudents
          .filter((student) => student.batchId === batch.id)
          .map((student) => ({
            id: student.id,
            full_name: student.name,
            email: student.email,
            phone: student.phone,
            status: student.status,
            avatar_url: student.avatar_url,
            batch_id: batch.id,
          }))

        return mapBatchStudentsToAttendanceStudents(batchStudents, batch, records)
      }),
    )

    setMessage('Today attendance saved successfully.')
    resetMarking()
    setActiveTab('view')
    setViewLevel('batches')
  }

  const markedPresent = Object.values(markingRows).filter((item) => item.status === 'present').length
  const markedAbsent = Object.values(markingRows).filter((item) => item.status === 'absent').length
  const markedLate = Object.values(markingRows).filter((item) => item.status === 'late').length

  if (dataLoading || branchLoading) {
    return (
      <div className="border border-border bg-transparent p-8 text-sm text-muted-foreground">
        Loading attendance…
      </div>
    )
  }

  if (!can('attendance.view')) {
    return (
      <div className="border border-border bg-transparent p-8">
        <h1 className="text-2xl font-bold">Attendance Locked</h1>
        <p className="mt-2 text-muted-foreground">
          Your current permission cannot view attendance.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-transparent">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#6ee75a]">Attendance Module</p>
              <h1 className="mt-2 text-3xl font-bold">Attendance</h1>
              <p className="mt-3 max-w-4xl text-muted-foreground">
                {isStudentView
                  ? 'View your day-wise attendance details.'
                  : isMentorView || isHodView
                    ? 'View assigned batch attendance and student day-wise attendance.'
                    : 'View all batch attendance, drill into students, and review daily attendance.'}
              </p>
            </div>

            {canMarkAttendance && (
              <Button
                type="button"
                onClick={() => setActiveTab('mark')}
                className="bg-[#6ee75a] text-black hover:bg-[#5dd84a]"
              >
                Mark Attendance
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {dataError && (
        <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {dataError}
        </div>
      )}

      {error && (
        <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {message && (
        <div className="border border-[#6ee75a]/30 bg-[#6ee75a]/10 px-4 py-3 text-sm text-[#6ee75a]">
          {message}
        </div>
      )}

      {!isStudentView && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setActiveTab('view')
              setMessage('')
              setError('')
            }}
            className={
              activeTab === 'view'
                ? 'border border-[#6ee75a] bg-[#6ee75a]/10 px-4 py-2 text-sm font-semibold text-[#6ee75a]'
                : 'border border-border bg-transparent px-4 py-2 text-sm font-semibold'
            }
          >
            View Attendance
          </button>

          {canMarkAttendance && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('mark')
                setMessage('')
                setError('')
              }}
              className={
                activeTab === 'mark'
                  ? 'border border-[#6ee75a] bg-[#6ee75a]/10 px-4 py-2 text-sm font-semibold text-[#6ee75a]'
                  : 'border border-border bg-transparent px-4 py-2 text-sm font-semibold'
              }
            >
              Mark Attendance
            </button>
          )}
        </div>
      )}

      {(activeTab === 'view' || isStudentView) && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border border-border bg-transparent">
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">
                {isStudentView ? 'My Attendance' : 'Average Attendance'}
              </p>
              <p className="mt-2 text-3xl font-bold">{overallAverage}%</p>
              <p className="mt-3 text-xs text-muted-foreground">Based on visible records</p>
            </CardContent>
          </Card>

          <Card className="border border-border bg-transparent">
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Present</p>
              <p className="mt-2 text-3xl font-bold">{totalPresent}</p>
              <p className="mt-3 text-xs text-muted-foreground">Total present records</p>
            </CardContent>
          </Card>

          <Card className="border border-border bg-transparent">
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Absent</p>
              <p className="mt-2 text-3xl font-bold">{totalAbsent}</p>
              <p className="mt-3 text-xs text-muted-foreground">Total absent records</p>
            </CardContent>
          </Card>

          <Card className="border border-border bg-transparent">
            <CardContent className="p-4">
              <p className="text-xs uppercase text-muted-foreground">Late</p>
              <p className="mt-2 text-3xl font-bold">{totalLate}</p>
              <p className="mt-3 text-xs text-muted-foreground">Total late records</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isStudentView && currentStudent && (
        <Card className="border border-border bg-transparent">
          <CardHeader>
            <CardTitle>My Day-wise Attendance</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="border border-border bg-transparent p-4">
                <p className="text-sm text-muted-foreground">Student</p>
                <p className="mt-2 font-semibold">{currentStudent.name}</p>
              </div>

              <div className="border border-border bg-transparent p-4">
                <p className="text-sm text-muted-foreground">Course</p>
                <p className="mt-2 font-semibold">{currentStudent.course}</p>
              </div>

              <div className="border border-border bg-transparent p-4">
                <p className="text-sm text-muted-foreground">Batch</p>
                <p className="mt-2 font-semibold">{currentStudent.batch}</p>
              </div>

              <div className="border border-border bg-transparent p-4">
                <p className="text-sm text-muted-foreground">Current Attendance</p>
                <p className="mt-2 font-semibold">{currentStudent.attendance}</p>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Batch</th>
                    <th className="px-4 py-3 font-semibold">Session Time</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Marked By</th>
                    <th className="px-4 py-3 font-semibold">Note</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleAttendance.map((record) => (
                    <tr key={record.id} className="border-b border-border">
                      <td className="px-4 py-4">{formatDate(record.date)}</td>
                      <td className="px-4 py-4">{record.batch}</td>
                      <td className="px-4 py-4">{record.sessionTime}</td>
                      <td className="px-4 py-4">
                        <span className={getMarkClass(record.status)}>{record.status}</span>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{record.markedBy}</td>
                      <td className="px-4 py-4 text-muted-foreground">{record.note || 'No note'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!isStudentView && activeTab === 'view' && viewLevel === 'batches' && (
        <Card className="border border-border bg-transparent">
          <CardHeader>
            <CardTitle>
              {isMentorView || isHodView ? 'Assigned Batch Attendance Summary' : 'All Batch Attendance Summary'}
            </CardTitle>
          </CardHeader>

          <CardContent>
            {batchSummary.length === 0 ? (
              <div className="border border-border bg-transparent p-6 text-sm text-muted-foreground">
                No batches available for your attendance scope.
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-3 font-semibold">Batch</th>
                      <th className="px-4 py-3 font-semibold">Course</th>
                      <th className="px-4 py-3 font-semibold">mentor</th>
                      <th className="px-4 py-3 font-semibold">Mode</th>
                      <th className="px-4 py-3 font-semibold">Students</th>
                      <th className="px-4 py-3 font-semibold">Attendance %</th>
                      <th className="px-4 py-3 font-semibold">Present Today</th>
                      <th className="px-4 py-3 font-semibold">Absent Today</th>
                      <th className="px-4 py-3 font-semibold">Late Today</th>
                      <th className="px-4 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {batchSummary.map((item) => (
                      <tr key={item.batch.id} className="border-b border-border">
                        <td className="px-4 py-4 font-semibold">{item.batch.name}</td>
                        <td className="px-4 py-4 text-muted-foreground">{item.batch.course}</td>
                        <td className="px-4 py-4 text-muted-foreground">{item.batch.mentor}</td>
                        <td className="px-4 py-4">{item.batch.mode}</td>
                        <td className="px-4 py-4">{item.totalStudents}</td>
                        <td className="px-4 py-4 font-semibold">{item.average}%</td>
                        <td className="px-4 py-4 text-[#6ee75a]">{item.presentToday}</td>
                        <td className="px-4 py-4 text-red-400">{item.absentToday}</td>
                        <td className="px-4 py-4 text-yellow-400">{item.lateToday}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewBatch(item.batch.name)}
                            >
                              View Batch
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isStudentView && activeTab === 'view' && viewLevel === 'batch-students' && selectedViewBatch && (
        <Card className="border border-border bg-transparent">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>{selectedViewBatch.name} Students</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  View each student attendance status inside this batch.
                </p>
              </div>

              <Button type="button" variant="outline" onClick={backToBatches}>
                Back to Batches
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {selectedBatchStudents.length === 0 ? (
              <div className="border border-border bg-transparent p-6 text-sm text-muted-foreground">
                No students found in this batch.
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Course</th>
                      <th className="px-4 py-3 font-semibold">Attendance %</th>
                      <th className="px-4 py-3 font-semibold">Present Days</th>
                      <th className="px-4 py-3 font-semibold">Absent Days</th>
                      <th className="px-4 py-3 font-semibold">Late Days</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedBatchStudents.map((student) => {
                      const summary = getStudentSummary(student)

                      return (
                        <tr key={student.id} className="border-b border-border">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center overflow-hidden border border-border bg-transparent">
                                <Image
                                  src={student.avatar_url || '/avatar.svg'}
                                  alt={student.name}
                                  width={40}
                                  height={40}
                                  className="h-full w-full object-cover"
                                />
                              </div>

                              <div>
                                <p className="font-semibold">{student.name}</p>
                                <p className="text-xs text-muted-foreground">{student.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">{student.course}</td>
                          <td className="px-4 py-4 font-semibold">{summary.average}%</td>
                          <td className="px-4 py-4 text-[#6ee75a]">{summary.present}</td>
                          <td className="px-4 py-4 text-red-400">{summary.absent}</td>
                          <td className="px-4 py-4 text-yellow-400">{summary.late}</td>
                          <td className="px-4 py-4">{student.status}</td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewStudent(student.id)}
                              >
                                View Student Attendance
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isStudentView && activeTab === 'view' && viewLevel === 'student-days' && selectedViewStudent && (
        <Card className="border border-border bg-transparent">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>{selectedViewStudent.name} Day-wise Attendance</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Daily attendance records for this student.
                </p>
              </div>

              <Button type="button" variant="outline" onClick={backToBatchStudents}>
                Back to Batch Students
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="border border-border bg-transparent p-4">
                <p className="text-sm text-muted-foreground">Student</p>
                <p className="mt-2 font-semibold">{selectedViewStudent.name}</p>
              </div>

              <div className="border border-border bg-transparent p-4">
                <p className="text-sm text-muted-foreground">Course</p>
                <p className="mt-2 font-semibold">{selectedViewStudent.course}</p>
              </div>

              <div className="border border-border bg-transparent p-4">
                <p className="text-sm text-muted-foreground">Batch</p>
                <p className="mt-2 font-semibold">{selectedViewStudent.batch}</p>
              </div>

              <div className="border border-border bg-transparent p-4">
                <p className="text-sm text-muted-foreground">Current Attendance</p>
                <p className="mt-2 font-semibold">{selectedViewStudent.attendance}</p>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Session Time</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Marked By</th>
                    <th className="px-4 py-3 font-semibold">Note</th>
                  </tr>
                </thead>

                <tbody>
                  {getStudentSummary(selectedViewStudent).records.map((record) => (
                    <tr key={record.id} className="border-b border-border">
                      <td className="px-4 py-4">{formatDate(record.date)}</td>
                      <td className="px-4 py-4">{record.sessionTime}</td>
                      <td className="px-4 py-4">
                        <span className={getMarkClass(record.status)}>{record.status}</span>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{record.markedBy}</td>
                      <td className="px-4 py-4 text-muted-foreground">{record.note || 'No note'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!isStudentView && activeTab === 'mark' && canMarkAttendance && (
        <div className="space-y-6">
          <Card className="border border-border bg-transparent">
            <CardHeader>
              <CardTitle>Mark Today Attendance</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Batch</label>
                  <select
                    value={selectedMarkBatchName}
                    onChange={(event) => handleSelectMarkBatch(event.target.value)}
                    className={selectClass}
                  >
                    <option value="" className={optionClass}>Select batch</option>
                    {scopedBatches.map((batch) => (
                      <option key={batch.id} value={batch.name} className={optionClass}>
                        {batch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Attendance Date</label>
                  <input value={formatDate(selectedDate)} className={inputClass} readOnly />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Class Time</label>
                  <input
                    value={
                      selectedMarkBatch
                        ? `${formatTimeLabel(selectedMarkBatch.start_time)} to ${formatTimeLabel(selectedMarkBatch.end_time)}`
                        : 'Select batch first'
                    }
                    className={inputClass}
                    readOnly
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Mode</label>
                  <input
                    value={selectedMarkBatch ? selectedMarkBatch.mode : 'Select batch first'}
                    className={inputClass}
                    readOnly
                  />
                </div>
              </div>

              {selectedMarkBatch && (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="border border-border bg-transparent p-4">
                    <p className="text-sm text-muted-foreground">Course</p>
                    <p className="mt-2 font-semibold">{selectedMarkBatch.course}</p>
                  </div>

                  <div className="border border-border bg-transparent p-4">
                    <p className="text-sm text-muted-foreground">mentor</p>
                    <p className="mt-2 font-semibold">{selectedMarkBatch.mentor}</p>
                  </div>

                  <div className="border border-border bg-transparent p-4">
                    <p className="text-sm text-muted-foreground">Class Days</p>
                    <p className="mt-2 font-semibold">{getClassDayLabel(selectedMarkBatch.class_day_type)}</p>
                  </div>

                  <div className="border border-border bg-transparent p-4">
                    <p className="text-sm text-muted-foreground">Batch Date Range</p>
                    <p className="mt-2 font-semibold">
                      {formatDate(selectedMarkBatch.start_date)} to {formatDate(selectedMarkBatch.end_date)}
                    </p>
                  </div>
                </div>
              )}

              {selectedMarkBatch && selectedMarkBatch.mode === 'online' && (
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium">Zoom / Google Meet Link</label>
                  <input
                    value={classLink}
                    onChange={(event) => setClassLink(event.target.value)}
                    className={inputClass}
                    placeholder="Add online class link"
                  />
                </div>
              )}

              {selectedMarkBatch && !isInsideDateRange && (
                <div className="mt-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  Today is outside this batch date range.
                </div>
              )}

              {selectedMarkBatch && isInsideDateRange && !isScheduledClassDay && (
                <div className="mt-4 border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
                  No class scheduled for today.
                </div>
              )}
            </CardContent>
          </Card>

          {canShowMarkRegister && (
            <Card className="border border-border bg-transparent">
              <CardHeader>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <CardTitle>Student Attendance Register</CardTitle>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Mark all students as Present, Absent or Late before saving attendance.
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="border border-border bg-transparent px-4 py-3">
                      <p className="text-lg font-bold">{selectedMarkStudents.length}</p>
                      <p className="text-xs text-muted-foreground">Students</p>
                    </div>

                    <div className="border border-[#6ee75a]/30 bg-[#6ee75a]/10 px-4 py-3">
                      <p className="text-lg font-bold text-[#6ee75a]">{markedPresent}</p>
                      <p className="text-xs text-muted-foreground">Present</p>
                    </div>

                    <div className="border border-red-500/30 bg-red-500/10 px-4 py-3">
                      <p className="text-lg font-bold text-red-400">{markedAbsent}</p>
                      <p className="text-xs text-muted-foreground">Absent</p>
                    </div>

                    <div className="border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
                      <p className="text-lg font-bold text-yellow-400">{markedLate}</p>
                      <p className="text-xs text-muted-foreground">Late</p>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => markAll('present')}>
                    Mark All Present
                  </Button>

                  <Button type="button" variant="outline" onClick={() => markAll('absent')}>
                    Mark All Absent
                  </Button>

                  <Button type="button" variant="outline" onClick={resetMarking}>
                    Reset
                  </Button>

                  <Button
                    type="button"
                    onClick={() => void saveAttendance()}
                    disabled={saving}
                    className="bg-[#6ee75a] text-black hover:bg-[#5dd84a]"
                  >
                    Save Attendance
                  </Button>
                </div>

                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-4 py-3 font-semibold">Student</th>
                        <th className="px-4 py-3 font-semibold">Course</th>
                        <th className="px-4 py-3 font-semibold">Current Attendance</th>
                        <th className="px-4 py-3 font-semibold">Grade</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Mark Attendance</th>
                        <th className="px-4 py-3 font-semibold">Note</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedMarkStudents.map((student) => {
                        const currentStatus = markingRows[student.id]?.status || 'unmarked'

                        return (
                          <tr key={student.id} className="border-b border-border">
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center overflow-hidden border border-border bg-transparent">
                                  <Image
                                    src={student.avatar_url || '/avatar.svg'}
                                    alt={student.name}
                                    width={40}
                                    height={40}
                                    className="h-full w-full object-cover"
                                  />
                                </div>

                                <div>
                                  <p className="font-semibold">{student.name}</p>
                                  <p className="text-xs text-muted-foreground">{student.batch}</p>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-4 text-muted-foreground">{student.course}</td>
                            <td className="px-4 py-4">{student.attendance}</td>
                            <td className="px-4 py-4">{student.grade}</td>
                            <td className="px-4 py-4">
                              <span className={getMarkClass(currentStatus)}>{currentStatus}</span>
                            </td>

                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateStudentMark(student.id, 'present')}
                                  className={
                                    currentStatus === 'present'
                                      ? 'border border-[#6ee75a]/40 bg-[#6ee75a]/10 px-3 py-1 text-xs font-semibold text-[#6ee75a]'
                                      : 'border border-border px-3 py-1 text-xs font-semibold text-muted-foreground'
                                  }
                                >
                                  Present
                                </button>

                                <button
                                  type="button"
                                  onClick={() => updateStudentMark(student.id, 'absent')}
                                  className={
                                    currentStatus === 'absent'
                                      ? 'border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400'
                                      : 'border border-border px-3 py-1 text-xs font-semibold text-muted-foreground'
                                  }
                                >
                                  Absent
                                </button>

                                <button
                                  type="button"
                                  onClick={() => updateStudentMark(student.id, 'late')}
                                  className={
                                    currentStatus === 'late'
                                      ? 'border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400'
                                      : 'border border-border px-3 py-1 text-xs font-semibold text-muted-foreground'
                                  }
                                >
                                  Late
                                </button>
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <input
                                value={markingRows[student.id]?.note || ''}
                                onChange={(event) => updateStudentNote(student.id, event.target.value)}
                                className="h-9 w-full min-w-[180px] border border-border bg-transparent px-3 text-xs outline-none"
                                placeholder="Optional note"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {!selectedMarkBatch && (
            <Card className="border border-border bg-transparent">
              <CardContent className="p-8">
                <div className="flex flex-col items-center justify-center text-center">
                  <CustomIcon
                    icon="attendance.svg"
                    folder={iconFolder}
                    alt="Attendance"
                    className="h-12 w-12"
                  />
                  <h2 className="mt-4 text-2xl font-bold">Select a Batch</h2>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                    Students are hidden until a batch is selected. Attendance can be marked only for today.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}