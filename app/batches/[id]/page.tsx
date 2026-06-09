'use client'

import { FormEvent, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDemoAuth } from '@/lib/demo/auth'
import {
  attendance,
  batches as demoBatches,
  branches,
  courses,
  mentors,
  students as demoStudents,
  tasks,
} from '@/lib/demo/seed'

type CourseType = 'professional' | 'advanced' | 'basic'
type BatchMode = 'online' | 'offline'
type CohortStatus = 'active' | 'inactive' | 'completed'

type DemoCohort = {
  id: string
  name: string
  cohort_code: string | null
  description: string | null
  duration_months: number | null
  start_date: string | null
  end_date: string | null
  status: CohortStatus
  created_at: string
  created_by: string | null
  course_id: string | null
  mentor_id: string | null
  branch_id: string | null
  course_type: CourseType
  batch_mode: BatchMode
  batch_start_time: string | null
  batch_end_time: string | null
  max_seats: number | null
  enrolled_count?: number
}

type DemoStudent = {
  id: string
  name: string
  email: string
  phone: string
  student_code: string
  course: string
  batch: string
  attendance: string
  grade: string
  placement: string
  status: string
  joining_date: string
  avatar_url: string
}

type StudentForm = {
  fullName: string
  email: string
  phone: string
  joiningDate: string
  status: string
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
  'h-10 w-full border border-border bg-transparent px-3 text-sm outline-none'

const textareaClass =
  'min-h-24 w-full border border-border bg-transparent px-3 py-2 text-sm outline-none resize-y'

const selectClass =
  'h-10 w-full border border-border bg-transparent px-3 text-sm outline-none'

const courseTypeOptions: {
  value: CourseType
  label: string
  durationMonths: number
}[] = [
  {
    value: 'professional',
    label: 'Professional',
    durationMonths: 1,
  },
  {
    value: 'advanced',
    label: 'Advanced',
    durationMonths: 2,
  },
  {
    value: 'basic',
    label: 'Basic',
    durationMonths: 4,
  },
]

const courseTypeFromTrack = (track: string): CourseType => {
  const value = track.toLowerCase()

  if (value.includes('basic')) return 'basic'
  if (value.includes('advanced')) return 'advanced'

  return 'professional'
}

const getCourseTypeLabel = (courseType: CourseType) => {
  return (
    courseTypeOptions.find((item) => item.value === courseType)?.label ||
    'Professional'
  )
}

const getDurationFromCourseType = (courseType: CourseType) => {
  return (
    courseTypeOptions.find((item) => item.value === courseType)
      ?.durationMonths || 1
  )
}

const calculateEndDateFromDuration = (
  startDateValue: string,
  durationMonthValue: number
) => {
  if (!startDateValue || !durationMonthValue) return ''

  const date = new Date(`${startDateValue}T00:00:00`)

  if (Number.isNaN(date.getTime())) return ''

  date.setMonth(date.getMonth() + durationMonthValue)
  date.setDate(date.getDate() - 1)

  return date.toISOString().split('T')[0]
}

const formatTimeForBatchCode = (time: string) => {
  if (!time) return 'TIME'

  const [hourValue, minuteValue] = time.split(':')
  const hour = Number(hourValue)
  const minute = Number(minuteValue || '0')

  if (Number.isNaN(hour)) return 'TIME'

  const period = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  const minuteText = minute > 0 ? String(minute).padStart(2, '0') : ''

  return `${hour12}${minuteText}${period}`
}

const formatMonthYearForBatchCode = (dateValue: string) => {
  if (!dateValue) return 'DATE'

  const date = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(date.getTime())) return 'DATE'

  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase()
  const year = String(date.getFullYear()).slice(-2)

  return `${month}${year}`
}

const getModeCode = (mode: BatchMode) => {
  return mode === 'online' ? 'ON' : 'OFF'
}

const cleanCodePart = (value: string | null | undefined, fallback: string) => {
  const cleaned = String(value || fallback)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

  return cleaned || fallback
}

const courseCodeFromName = (courseName: string) => {
  if (courseName.toLowerCase().includes('digital')) return 'DM'
  if (courseName.toLowerCase().includes('website')) return 'WD'
  if (courseName.toLowerCase().includes('3d')) return '3D'

  return cleanCodePart(courseName.slice(0, 3), 'CRS')
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

const timeTextToInputValue = (timeText: string) => {
  const value = timeText.trim().toUpperCase()
  const match = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/)

  if (!match) return '07:00'

  let hour = Number(match[1])
  const minute = match[2] || '00'
  const period = match[3]

  if (period === 'PM' && hour < 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0

  return `${String(hour).padStart(2, '0')}:${minute}`
}

const formatDate = (dateValue: string | null) => {
  if (!dateValue) return 'Not added'

  const date = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(date.getTime())) return 'Not added'

  return date.toLocaleDateString()
}

const parseBatchSeats = (seats: string) => {
  const [currentValue, maxValue] = seats.split('/')

  return {
    enrolled: Number(currentValue || 0),
    maxSeats: Number(maxValue || 0),
  }
}

const buildDemoCohorts = (): DemoCohort[] => {
  return demoBatches.map((batch, index) => {
    const course = courses.find((item) => item.name === batch.course) || courses[0]
    const mentor = mentors.find((item) => item.name === batch.mentor) || mentors[0]
    const courseType = courseTypeFromTrack(course.track)
    const durationMonths = getDurationFromCourseType(courseType)
    const startDate =
      index === 0 ? '2026-06-01' : index === 1 ? '2026-06-03' : '2026-06-07'
    const endDate = calculateEndDateFromDuration(startDate, durationMonths)
    const batchMode = batch.mode.toLowerCase() === 'online' ? 'online' : 'offline'
    const startTime = timeTextToInputValue(batch.time)
    const endTime = index === 0 ? '09:00' : index === 1 ? '21:30' : '13:00'
    const seats = parseBatchSeats(batch.seats)
    const courseCode = courseCodeFromName(course.name)
    const cohortCode = `PP-${courseCode}-${getModeCode(batchMode)}-${formatTimeForBatchCode(startTime)}-${formatMonthYearForBatchCode(startDate)}-${String(index + 1).padStart(2, '0')}`

    return {
      id: batch.id,
      name: batch.name,
      cohort_code: cohortCode,
      description:
        index === 0
          ? 'Morning offline cohort for Digital Marketing students.'
          : index === 1
            ? 'Evening online cohort for Website Development students.'
            : 'Weekend offline cohort for 3D Visualization students.',
      duration_months: durationMonths,
      start_date: startDate,
      end_date: endDate,
      status: seats.enrolled >= seats.maxSeats ? 'completed' : 'active',
      created_at: new Date().toISOString(),
      created_by: 'demo',
      course_id: course.id,
      mentor_id: mentor.id,
      branch_id: branches[0]?.id || 'b1',
      course_type: courseType,
      batch_mode: batchMode,
      batch_start_time: startTime,
      batch_end_time: endTime,
      max_seats: seats.maxSeats,
      enrolled_count: seats.enrolled,
    }
  })
}

const buildDemoStudents = (cohort: DemoCohort | undefined): DemoStudent[] => {
  if (!cohort) return []

  const course = courses.find((item) => item.id === cohort.course_id)

  return demoStudents
    .filter((student) => {
      return student.batch === cohort.name || student.course === course?.name
    })
    .map((student, index) => {
      return {
        id: student.id,
        name: student.name,
        email: `${student.name.toLowerCase().replace(/\s+/g, '.')}@pixlpluzportal.demo`,
        phone: index === 0 ? '+91 98765 43210' : index === 1 ? '+91 98765 43211' : '+91 98765 43212',
        student_code: `${cohort.cohort_code}-ST${String(index + 1).padStart(3, '0')}`,
        course: student.course,
        batch: student.batch,
        attendance: student.attendance,
        grade: student.grade,
        placement: student.placement,
        status: student.status.toLowerCase(),
        joining_date:
          index === 0 ? '2026-06-01' : index === 1 ? '2026-06-03' : '2026-06-07',
        avatar_url: '/avatar.svg',
      }
    })
}

export default function Page() {
  const params = useParams()
  const cohortId = String(params.id || '')
  const { can } = useDemoAuth()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const cohorts = useMemo(() => buildDemoCohorts(), [])
  const cohort = useMemo(() => {
    return cohorts.find((item) => item.id === cohortId) || null
  }, [cohortId, cohorts])

  const course = useMemo(() => {
    return courses.find((item) => item.id === cohort?.course_id) || null
  }, [cohort])

  const mentor = useMemo(() => {
    return mentors.find((item) => item.id === cohort?.mentor_id) || null
  }, [cohort])

  const branch = useMemo(() => {
    return branches.find((item) => item.id === cohort?.branch_id) || null
  }, [cohort])

  const [students, setStudents] = useState<DemoStudent[]>(() =>
    buildDemoStudents(cohort || undefined)
  )
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [studentForm, setStudentForm] = useState<StudentForm>({
    fullName: '',
    email: '',
    phone: '',
    joiningDate: new Date().toISOString().split('T')[0],
    status: 'active',
  })

  const enrolledCount = students.length
  const maxSeats = cohort?.max_seats || 0
  const availableSeats = maxSeats > 0 ? Math.max(maxSeats - enrolledCount, 0) : 0
  const isCohortFull = maxSeats > 0 && enrolledCount >= maxSeats

  const cohortAttendance = useMemo(() => {
    if (!cohort) return []
    return attendance.filter((item) => item.batch === cohort.name)
  }, [cohort])

  const cohortTasks = useMemo(() => {
    if (!cohort) return []
    return tasks.filter((item) => item.batch === cohort.name)
  }, [cohort])

  const nextStudentCode = useMemo(() => {
    if (!cohort?.cohort_code) return 'Batch ID not generated'

    const highestStudentNumber = students.reduce((highest, student) => {
      const match = student.student_code?.match(/-ST(\d+)$/)
      const currentNumber = match ? Number(match[1]) : 0

      return currentNumber > highest ? currentNumber : highest
    }, 0)

    return `${cohort.cohort_code}-ST${String(highestStudentNumber + 1).padStart(3, '0')}`
  }, [cohort?.cohort_code, students])

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) return students

    return students.filter((student) => {
      return (
        student.name.toLowerCase().includes(keyword) ||
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
      joiningDate: new Date().toISOString().split('T')[0],
      status: 'active',
    })
  }

  const openAddStudentModal = () => {
    setError('')
    setMessage('')
    resetForm()
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setError('')
    setSaving(false)
  }

  const handleCreateStudent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!cohort || !course) return

    if (!can('students.create') && !can('batches.edit')) {
      setError('Your current role cannot create students.')
      return
    }

    if (!studentForm.fullName.trim()) {
      setError('Full name is required.')
      return
    }

    if (!studentForm.email.trim()) {
      setError('Email is required.')
      return
    }

    if (!cohort.cohort_code) {
      setError('This cohort does not have a Batch ID.')
      return
    }

    if (cohort.status !== 'active') {
      setError('Students can only be added to an active cohort.')
      return
    }

    if (isCohortFull) {
      setError('This cohort is already full. Enrollment is stopped.')
      return
    }

    setSaving(true)

    const newStudent: DemoStudent = {
      id: `student-${Date.now()}`,
      name: studentForm.fullName.trim(),
      email: studentForm.email.trim().toLowerCase(),
      phone: studentForm.phone.trim() || 'Not added',
      student_code: nextStudentCode,
      course: course.name,
      batch: cohort.name,
      attendance: '100%',
      grade: 'Not graded',
      placement: 'Not Started',
      status: studentForm.status,
      joining_date: studentForm.joiningDate,
      avatar_url: '/avatar.svg',
    }

    setStudents([newStudent, ...students])
    setMessage(`Student created successfully. Student code: ${nextStudentCode}`)
    setSaving(false)
    setIsModalOpen(false)
    resetForm()
  }

  if (!can('batches.view')) {
    return (
      <div className="border border-border bg-transparent p-8">
        <h1 className="text-2xl font-bold">Cohort Locked</h1>
        <p className="mt-2 text-muted-foreground">
          Your current role cannot view cohort details.
        </p>
      </div>
    )
  }

  if (!cohort) {
    return (
      <div className="space-y-6">
        <Button asChild variant="outline" size="sm">
          <Link href="/batches">Back to Cohorts</Link>
        </Button>

        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Cohort not found in demo data.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="outline" size="sm">
        <Link href="/batches" className="inline-flex items-center">
          <CustomIcon
            icon="arrow-left.svg"
            folder={iconFolder}
            alt="Back"
            className="mr-2 h-4 w-4"
          />
          Back to Cohorts
        </Link>
      </Button>

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

      <Card className="border border-border bg-transparent">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#6ee75a]">Cohort Details</p>
              <h1 className="mt-2 text-3xl font-bold">{cohort.name}</h1>
              <p className="mt-3 max-w-4xl text-muted-foreground">
                {cohort.description || 'No description added.'}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="border border-border bg-transparent px-3 py-1 text-sm font-medium">
                  {cohort.cohort_code}
                </span>

                <span className="border border-border bg-transparent px-3 py-1 text-sm font-medium">
                  {getCourseTypeLabel(cohort.course_type)}
                </span>

                <span
                  className={
                    isCohortFull || cohort.status === 'completed'
                      ? 'border border-red-500/30 bg-red-500/10 px-3 py-1 text-sm font-medium text-red-400'
                      : 'border border-[#6ee75a]/30 bg-[#6ee75a]/10 px-3 py-1 text-sm font-medium text-[#6ee75a]'
                  }
                >
                  {isCohortFull ? 'Full' : cohort.status}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/batches">All Cohorts</Link>
              </Button>

              {(can('students.create') || can('batches.edit')) && (
                <Button
                  type="button"
                  onClick={openAddStudentModal}
                  disabled={isCohortFull || cohort.status !== 'active'}
                  className="bg-[#6ee75a] text-black hover:bg-[#5dd84a]"
                >
                  Add Student
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Enrolled Students</p>
            <p className="mt-3 text-4xl font-bold">{enrolledCount}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Current demo students
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Maximum Seats</p>
            <p className="mt-3 text-4xl font-bold">{maxSeats}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Enrollment limit
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Available Seats</p>
            <p className="mt-3 text-4xl font-bold">{availableSeats}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Stops at full capacity
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Tasks</p>
            <p className="mt-3 text-4xl font-bold">{cohortTasks.length}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Assigned work packages
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border bg-transparent">
        <CardHeader>
          <CardTitle>Cohort Information</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="border border-border bg-transparent p-4">
              <p className="text-sm text-muted-foreground">Course</p>
              <p className="mt-2 font-semibold">{course?.name || 'Not added'}</p>
            </div>

            <div className="border border-border bg-transparent p-4">
              <p className="text-sm text-muted-foreground">mentor / Mentor</p>
              <p className="mt-2 font-semibold">{mentor?.name || 'Not added'}</p>
            </div>

            <div className="border border-border bg-transparent p-4">
              <p className="text-sm text-muted-foreground">Branch</p>
              <p className="mt-2 font-semibold">{branch?.name || 'Not added'}</p>
            </div>

            <div className="border border-border bg-transparent p-4">
              <p className="text-sm text-muted-foreground">Mode</p>
              <p className="mt-2 font-semibold">
                {cohort.batch_mode === 'online' ? 'Online' : 'Offline'}
              </p>
            </div>

            <div className="border border-border bg-transparent p-4">
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="mt-2 font-semibold">
                {cohort.duration_months}{' '}
                {cohort.duration_months === 1 ? 'month' : 'months'}
              </p>
            </div>

            <div className="border border-border bg-transparent p-4">
              <p className="text-sm text-muted-foreground">Dates</p>
              <p className="mt-2 font-semibold">
                {formatDate(cohort.start_date)} to {formatDate(cohort.end_date)}
              </p>
            </div>

            <div className="border border-border bg-transparent p-4">
              <p className="text-sm text-muted-foreground">Time</p>
              <p className="mt-2 font-semibold">
                {formatTimeLabel(cohort.batch_start_time)} to{' '}
                {formatTimeLabel(cohort.batch_end_time)}
              </p>
            </div>

            <div className="border border-border bg-transparent p-4">
              <p className="text-sm text-muted-foreground">Attendance Records</p>
              <p className="mt-2 font-semibold">{cohortAttendance.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border bg-transparent">
        <CardHeader>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle>Student Directory</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Demo students enrolled in this cohort.
              </p>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 w-full border border-border bg-transparent px-3 text-sm outline-none xl:w-72"
              placeholder="Search students"
            />
          </div>
        </CardHeader>

        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="border border-border bg-transparent p-6 text-sm text-muted-foreground">
              No students found in this cohort.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
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
                          <div className="flex h-10 w-10 items-center justify-center border border-border bg-transparent">
                            <CustomIcon
                              icon="students.svg"
                              folder={iconFolder}
                              alt="Student"
                              className="h-5 w-5"
                            />
                          </div>
                          <div>
                            <p className="font-semibold">{student.name}</p>
                            <p className="text-xs text-muted-foreground">{student.course}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">{student.student_code}</td>
                      <td className="px-4 py-4 text-muted-foreground">{student.email}</td>
                      <td className="px-4 py-4 text-muted-foreground">{student.phone}</td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {formatDate(student.joining_date)}
                      </td>
                      <td className="px-4 py-4">{student.attendance}</td>
                      <td className="px-4 py-4">{student.grade}</td>
                      <td className="px-4 py-4">{student.placement}</td>
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
                  Demo student will be added to this cohort only. Student code is generated from Batch ID.
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
                <div className="border border-border bg-transparent p-4">
                  <p className="text-sm text-muted-foreground">Next Student Code</p>
                  <p className="mt-2 font-semibold">{nextStudentCode}</p>
                </div>

                <div className="border border-border bg-transparent p-4">
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
                    placeholder="student@pixlpluzportal.demo"
                    required
                  />
                </div>

                <div>
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

                <div>
                  <label className="mb-2 block text-sm font-medium">Joining Date</label>
                  <input
                    type="date"
                    value={studentForm.joiningDate}
                    onChange={(event) =>
                      setStudentForm({
                        ...studentForm,
                        joiningDate: event.target.value,
                      })
                    }
                    className={inputClass}
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Status</label>
                  <select
                    value={studentForm.status}
                    onChange={(event) =>
                      setStudentForm({
                        ...studentForm,
                        status: event.target.value,
                      })
                    }
                    className={selectClass}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="mt-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>

                <Button type="submit" disabled={saving || isCohortFull}>
                  {saving ? 'Creating...' : 'Create Student'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}