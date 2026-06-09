'use client'

import { FormEvent, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDemoAuth } from '@/lib/demo/auth'
import {
  attendance,
  batches,
  mentors,
  students as demoStudents,
  tasks,
  submissions,
  placements,
  certificates,
} from '@/lib/demo/seed'

type StudentStatus = 'active' | 'inactive' | 'completed' | 'archived'

type DemoStudent = {
  id: string
  name: string
  course: string
  batch: string
  attendance: string
  grade: string
  placement: string
  status: StudentStatus
  email: string
  phone: string
  joining_date: string
  avatar_url: string
  guardian_name: string
  guardian_phone: string
  address: string
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
  'h-10 w-full border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[#153e90] dark:focus:border-[#6ee75a] dark:[color-scheme:dark]'

const textareaClass =
  'min-h-24 w-full resize-y border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[#153e90] dark:focus:border-[#6ee75a] dark:[color-scheme:dark]'

const selectClass =
  'h-10 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a] dark:[color-scheme:dark]'

const optionClass = 'bg-background text-foreground'

const getStatusClass = (status: StudentStatus | string) => {
  if (status === 'active' || status === 'approved' || status === 'completed' || status === 'submitted') {
    return 'border border-[#153e90]/30 bg-[#153e90]/10 px-3 py-1 text-xs font-medium text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white'
  }

  if (status === 'inactive' || status === 'revision-requested' || status === 'pending') {
    return 'border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-400'
  }

  if (status === 'archived' || status === 'rejected' || status === 'absent') {
    return 'border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400'
  }

  return 'border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground'
}

const buildDemoStudents = (): DemoStudent[] => {
  return demoStudents.map((student, index) => ({
    ...student,
    status:
      student.status.toLowerCase() === 'active'
        ? 'active'
        : student.status.toLowerCase() === 'completed'
          ? 'completed'
          : student.status.toLowerCase() === 'archived'
            ? 'archived'
            : 'inactive',
    email:
      index === 0
        ? 'student.one@pixlpluzportal.demo'
        : index === 1
          ? 'student.two@pixlpluzportal.demo'
          : 'student.three@pixlpluzportal.demo',
    phone:
      index === 0
        ? '+91 98765 43001'
        : index === 1
          ? '+91 98765 43002'
          : '+91 98765 43003',
    joining_date:
      index === 0
        ? '2026-06-01'
        : index === 1
          ? '2026-06-03'
          : '2026-06-07',
    avatar_url: '/avatar.svg',
    guardian_name:
      index === 0
        ? 'Parent One'
        : index === 1
          ? 'Parent Two'
          : 'Parent Three',
    guardian_phone:
      index === 0
        ? '+91 98765 44001'
        : index === 1
          ? '+91 98765 44002'
          : '+91 98765 44003',
    address:
      index === 0
        ? 'Kochi, Kerala'
        : index === 1
          ? 'Ernakulam, Kerala'
          : 'Aluva, Kerala',
  }))
}

const getAttendanceNumber = (attendanceValue: string) => {
  return Number(String(attendanceValue || '0').replace('%', '')) || 0
}

const formatDate = (dateValue: string) => {
  if (!dateValue) return 'Not added'

  const date = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(date.getTime())) return dateValue

  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function Page() {
  const params = useParams()
  const studentId = String(params.id || '')
  const { can, user, role } = useDemoAuth()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const [students, setStudents] = useState<DemoStudent[]>(() => buildDemoStudents())
  const [isEditOpen, setIsEditOpen] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [course, setCourse] = useState('')
  const [batch, setBatch] = useState('')
  const [joiningDate, setJoiningDate] = useState('')
  const [attendanceValue, setAttendanceValue] = useState('100%')
  const [grade, setGrade] = useState('Not graded')
  const [placement, setPlacement] = useState('Not Started')
  const [status, setStatus] = useState<StudentStatus>('active')
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [address, setAddress] = useState('')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const currentRoleName = role?.name?.toLowerCase() || ''
  const currentUserName = user?.fullName || ''

  const ismentorView =
    (currentRoleName.includes('mentor') || currentRoleName.includes('mentor')) &&
    !currentRoleName.includes('hod') &&
    !currentRoleName.includes('admin') &&
    !currentRoleName.includes('controller') &&
    !currentRoleName.includes('super')

  const assignedBatchNames = useMemo(() => {
    if (!ismentorView) return []

    const userName = currentUserName.toLowerCase()

    const directAssignedBatches = batches.filter((batchItem) => {
      const mentorName = batchItem.mentor.toLowerCase()

      return (
        mentorName === userName ||
        mentorName.includes(userName) ||
        userName.includes(mentorName)
      )
    })

    if (directAssignedBatches.length > 0) {
      return directAssignedBatches.map((batchItem) => batchItem.name)
    }

    const firstDemoMentorName = mentors[0]?.name || ''

    return batches
      .filter((batchItem) => batchItem.mentor === firstDemoMentorName)
      .map((batchItem) => batchItem.name)
  }, [ismentorView, currentUserName])

  const scopedStudents = useMemo(() => {
    if (!ismentorView) return students

    return students.filter((student) => assignedBatchNames.includes(student.batch))
  }, [students, ismentorView, assignedBatchNames])

  const student = useMemo(() => {
    return scopedStudents.find((item) => item.id === studentId) || null
  }, [scopedStudents, studentId])

  const studentBatch = useMemo(() => {
    if (!student) return null

    return batches.find((batchItem) => batchItem.name === student.batch) || null
  }, [student])

  const studentAttendanceSessions = useMemo(() => {
    if (!student) return []

    return attendance.filter((item) => item.batch === student.batch)
  }, [student])

  const studentTasks = useMemo(() => {
    if (!student) return []

    return tasks.filter((item) => item.batch === student.batch || item.course === student.course)
  }, [student])

  const studentSubmissions = useMemo(() => {
    if (!student) return []

    return submissions.filter((item) => {
      const itemStudent = String(item.student || item.studentName || item.student_name || '').toLowerCase()
      const itemBatch = String(item.batch || '').toLowerCase()
      const itemCourse = String(item.course || '').toLowerCase()

      return (
        itemStudent === student.name.toLowerCase() ||
        itemBatch === student.batch.toLowerCase() ||
        itemCourse === student.course.toLowerCase()
      )
    })
  }, [student])

  const studentPlacements = useMemo(() => {
    if (!student) return []

    return placements.filter((item) => {
      const itemStudent = String(item.student || item.studentName || item.student_name || '').toLowerCase()
      const itemCourse = String(item.course || '').toLowerCase()

      return (
        itemStudent === student.name.toLowerCase() ||
        itemCourse === student.course.toLowerCase()
      )
    })
  }, [student])

  const studentCertificates = useMemo(() => {
    if (!student) return []

    return certificates.filter((item) => {
      const itemStudent = String(item.student || item.studentName || item.student_name || '').toLowerCase()
      const itemCourse = String(item.course || '').toLowerCase()

      return (
        itemStudent === student.name.toLowerCase() ||
        itemCourse === student.course.toLowerCase()
      )
    })
  }, [student])

  const attendanceNumber = student ? getAttendanceNumber(student.attendance) : 0
  const placementReady = student ? attendanceNumber >= 90 && student.placement !== 'Not Started' : false

  const openEditModal = () => {
    if (!student) return

    setName(student.name)
    setEmail(student.email)
    setPhone(student.phone)
    setCourse(student.course)
    setBatch(student.batch)
    setJoiningDate(student.joining_date)
    setAttendanceValue(student.attendance)
    setGrade(student.grade)
    setPlacement(student.placement)
    setStatus(student.status)
    setGuardianName(student.guardian_name)
    setGuardianPhone(student.guardian_phone)
    setAddress(student.address)
    setError('')
    setMessage('')
    setIsEditOpen(true)
  }

  const closeEditModal = () => {
    setIsEditOpen(false)
    setError('')
    setSaving(false)
  }

  const handleSaveStudent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    if (!can('students.edit')) {
      setError('Your current permission cannot edit student details.')
      setSaving(false)
      return
    }

    if (!student) {
      setError('Student not found.')
      setSaving(false)
      return
    }

    if (!name.trim()) {
      setError('Please enter student name.')
      setSaving(false)
      return
    }

    if (!email.trim()) {
      setError('Please enter email address.')
      setSaving(false)
      return
    }

    if (!course.trim()) {
      setError('Please select course.')
      setSaving(false)
      return
    }

    if (!batch.trim()) {
      setError('Please select batch.')
      setSaving(false)
      return
    }

    const updatedStudent: DemoStudent = {
      ...student,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || 'Not added',
      course,
      batch,
      joining_date: joiningDate || student.joining_date,
      attendance: attendanceValue || student.attendance,
      grade: grade || student.grade,
      placement: placement || student.placement,
      status,
      guardian_name: guardianName.trim() || 'Not added',
      guardian_phone: guardianPhone.trim() || 'Not added',
      address: address.trim() || 'Not added',
    }

    setStudents((current) =>
      current.map((item) => (item.id === student.id ? updatedStudent : item))
    )

    setMessage('Student details updated successfully in demo.')
    setSaving(false)
    setIsEditOpen(false)
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

  if (!student) {
    return (
      <div className="space-y-6">
        <Button asChild variant="outline" size="sm">
          <Link href="/students" className="inline-flex items-center">
            <CustomIcon
              icon="arrow-left.svg"
              folder={iconFolder}
              alt="Back"
              className="mr-2 h-4 w-4"
            />
            Back to Students
          </Link>
        </Button>

        <Card className="border border-border bg-card">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Student not found in demo data or not available under your current assigned batch scope.
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
          <CustomIcon
            icon="arrow-left.svg"
            folder={iconFolder}
            alt="Back"
            className="mr-2 h-4 w-4"
          />
          Back to Students
        </Link>
      </Button>

      {error && (
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
                  alt={student.name}
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                />
              </div>

              <div>
                <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Student Profile</p>
                <h1 className="mt-2 text-3xl font-bold">{student.name}</h1>
                <p className="mt-2 max-w-4xl text-muted-foreground">
                  {student.course} student enrolled in {student.batch}.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="border border-border bg-background px-3 py-1 text-sm font-medium">
                    {student.course}
                  </span>

                  <span className="border border-border bg-background px-3 py-1 text-sm font-medium">
                    {student.batch}
                  </span>

                  <span className={getStatusClass(student.status)}>
                    {student.status}
                  </span>
                </div>
              </div>
            </div>

            {can('students.edit') && !ismentorView && (
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border bg-card">
          <CardContent className="p-6">
            <p className="text-sm uppercase text-muted-foreground">Attendance</p>
            <p className="mt-3 text-4xl font-bold">{student.attendance}</p>
            <p className="mt-4 text-sm text-muted-foreground">Starts from 100%</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardContent className="p-6">
            <p className="text-sm uppercase text-muted-foreground">Grade</p>
            <p className="mt-3 text-4xl font-bold">{student.grade}</p>
            <p className="mt-4 text-sm text-muted-foreground">Academic progress</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardContent className="p-6">
            <p className="text-sm uppercase text-muted-foreground">Placement</p>
            <p className="mt-3 text-4xl font-bold">{placementReady ? 'Yes' : 'No'}</p>
            <p className="mt-4 text-sm text-muted-foreground">{student.placement}</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardContent className="p-6">
            <p className="text-sm uppercase text-muted-foreground">Tasks</p>
            <p className="mt-3 text-4xl font-bold">{studentTasks.length}</p>
            <p className="mt-4 text-sm text-muted-foreground">Assigned work</p>
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
              <p className="mt-2 font-semibold">{student.name}</p>
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
              <p className="mt-2 font-semibold">{student.course}</p>
            </div>

            <div className="border border-border bg-background/50 p-4">
              <p className="text-sm text-muted-foreground">Batch</p>
              <p className="mt-2 font-semibold">{student.batch}</p>
            </div>

            <div className="border border-border bg-background/50 p-4">
              <p className="text-sm text-muted-foreground">Guardian</p>
              <p className="mt-2 font-semibold">{student.guardian_name}</p>
            </div>

            <div className="border border-border bg-background/50 p-4">
              <p className="text-sm text-muted-foreground">Guardian Phone</p>
              <p className="mt-2 font-semibold">{student.guardian_phone}</p>
            </div>
          </div>

          <div className="mt-4 border border-border bg-background/50 p-4">
            <p className="text-sm text-muted-foreground">Address</p>
            <p className="mt-2 font-semibold">{student.address}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList className="flex flex-wrap gap-3 bg-transparent p-0">
          <TabsTrigger
            value="attendance"
            className="border border-border bg-background px-4 py-2 text-[#153e90] data-[state=active]:border-[#153e90] data-[state=active]:bg-[#153e90]/10 dark:text-white dark:data-[state=active]:border-[#6ee75a] dark:data-[state=active]:bg-[#6ee75a]/10"
          >
            Attendance
          </TabsTrigger>

          <TabsTrigger
            value="tasks"
            className="border border-border bg-background px-4 py-2 text-[#153e90] data-[state=active]:border-[#153e90] data-[state=active]:bg-[#153e90]/10 dark:text-white dark:data-[state=active]:border-[#6ee75a] dark:data-[state=active]:bg-[#6ee75a]/10"
          >
            Tasks
          </TabsTrigger>

          <TabsTrigger
            value="submissions"
            className="border border-border bg-background px-4 py-2 text-[#153e90] data-[state=active]:border-[#153e90] data-[state=active]:bg-[#153e90]/10 dark:text-white dark:data-[state=active]:border-[#6ee75a] dark:data-[state=active]:bg-[#6ee75a]/10"
          >
            Submissions
          </TabsTrigger>

          <TabsTrigger
            value="placement"
            className="border border-border bg-background px-4 py-2 text-[#153e90] data-[state=active]:border-[#153e90] data-[state=active]:bg-[#153e90]/10 dark:text-white dark:data-[state=active]:border-[#6ee75a] dark:data-[state=active]:bg-[#6ee75a]/10"
          >
            Placement
          </TabsTrigger>

          <TabsTrigger
            value="certificate"
            className="border border-border bg-background px-4 py-2 text-[#153e90] data-[state=active]:border-[#153e90] data-[state=active]:bg-[#153e90]/10 dark:text-white dark:data-[state=active]:border-[#6ee75a] dark:data-[state=active]:bg-[#6ee75a]/10"
          >
            Certificate
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle>Attendance Records</CardTitle>
            </CardHeader>

            <CardContent>
              {studentAttendanceSessions.length === 0 ? (
                <div className="border border-border bg-background/50 p-6 text-sm text-muted-foreground">
                  No attendance records found for this student's batch in demo data.
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[860px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left">
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Batch</th>
                        <th className="px-4 py-3 font-semibold">Session</th>
                        <th className="px-4 py-3 font-semibold">Marked By</th>
                        <th className="px-4 py-3 font-semibold">Present</th>
                        <th className="px-4 py-3 font-semibold">Absent</th>
                        <th className="px-4 py-3 font-semibold">Late</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {studentAttendanceSessions.map((item) => (
                        <tr key={item.id || `${item.date}-${item.session}`} className="border-b border-border">
                          <td className="px-4 py-4">{item.date}</td>
                          <td className="px-4 py-4">{item.batch}</td>
                          <td className="px-4 py-4">{item.session}</td>
                          <td className="px-4 py-4 text-muted-foreground">{item.markedBy}</td>
                          <td className="px-4 py-4 text-[#153e90] dark:text-[#6ee75a]">{item.present}</td>
                          <td className="px-4 py-4 text-red-400">{item.absent}</td>
                          <td className="px-4 py-4 text-yellow-400">{item.late}</td>
                          <td className="px-4 py-4">
                            <span className={getStatusClass(item.status)}>
                              {item.status}
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
        </TabsContent>

        <TabsContent value="tasks">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle>Assigned Tasks</CardTitle>
            </CardHeader>

            <CardContent>
              {studentTasks.length === 0 ? (
                <div className="border border-border bg-background/50 p-6 text-sm text-muted-foreground">
                  No tasks found for this student's batch in demo data.
                </div>
              ) : (
                <div className="space-y-4">
                  {studentTasks.map((item) => (
                    <div key={item.id} className="border border-border bg-background/50 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h3 className="font-semibold">{item.title}</h3>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {item.description || 'No description added.'}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <span className="border border-border bg-background px-3 py-1">
                              {item.batch || student.batch}
                            </span>
                            <span className="border border-border bg-background px-3 py-1">
                              {item.status || 'todo'}
                            </span>
                            <span className="border border-border bg-background px-3 py-1">
                              {item.dueDate || item.due_date || 'No due date'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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

            <CardContent>
              {studentSubmissions.length === 0 ? (
                <div className="border border-border bg-background/50 p-6 text-sm text-muted-foreground">
                  No submissions found for this student in demo data.
                </div>
              ) : (
                <div className="space-y-4">
                  {studentSubmissions.map((item) => (
                    <div key={item.id} className="border border-border bg-background/50 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h3 className="font-semibold">{item.title || item.task || 'Submission'}</h3>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {item.description || item.feedback || 'Demo submission record.'}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <span className={getStatusClass(item.status || 'submitted')}>
                              {item.status || 'submitted'}
                            </span>
                            <span className="border border-border bg-background px-3 py-1">
                              {item.submittedAt || item.submitted_at || 'Not submitted'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="border border-border bg-background/50 p-4">
                  <p className="text-sm text-muted-foreground">Placement Status</p>
                  <p className="mt-2 font-semibold">{student.placement}</p>
                </div>

                <div className="border border-border bg-background/50 p-4">
                  <p className="text-sm text-muted-foreground">Attendance Eligibility</p>
                  <p className="mt-2 font-semibold">{attendanceNumber >= 90 ? 'Eligible' : 'Needs Improvement'}</p>
                </div>

                <div className="border border-border bg-background/50 p-4">
                  <p className="text-sm text-muted-foreground">Grade</p>
                  <p className="mt-2 font-semibold">{student.grade}</p>
                </div>

                <div className="border border-border bg-background/50 p-4">
                  <p className="text-sm text-muted-foreground">Ready for Placement</p>
                  <p className="mt-2 font-semibold">{placementReady ? 'Yes' : 'No'}</p>
                </div>
              </div>

              <div className="mt-4">
                {studentPlacements.length === 0 ? (
                  <div className="border border-border bg-background/50 p-6 text-sm text-muted-foreground">
                    No placement records found in demo data.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {studentPlacements.map((item) => (
                      <div key={item.id} className="border border-border bg-background/50 p-4">
                        <p className="font-semibold">{item.company || item.title || 'Placement Record'}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {item.status || item.stage || 'Demo placement pipeline'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
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
              {studentCertificates.length === 0 ? (
                <div className="border border-border bg-background/50 p-6 text-sm text-muted-foreground">
                  No certificates uploaded for this student in demo data.
                </div>
              ) : (
                <div className="space-y-4">
                  {studentCertificates.map((item) => (
                    <div key={item.id} className="border border-border bg-background/50 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="font-semibold">{item.title || item.course || 'Certificate'}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.status || 'Available for download'}
                          </p>
                        </div>

                        <Button type="button" variant="outline" size="sm">
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-6">
              <div>
                <h2 className="text-2xl font-bold">Edit Student</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Update demo student profile details.
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
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={inputClass}
                    placeholder="Enter student name"
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
                    placeholder="student@pixlpluzportal.demo"
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
                  <label className="mb-2 block text-sm font-medium">Course</label>
                  <select
                    value={course}
                    onChange={(event) => setCourse(event.target.value)}
                    className={selectClass}
                    required
                  >
                    <option value="" className={optionClass}>Select course</option>
                    {Array.from(new Set(demoStudents.map((item) => item.course))).map((item) => (
                      <option key={item} value={item} className={optionClass}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Batch</label>
                  <select
                    value={batch}
                    onChange={(event) => setBatch(event.target.value)}
                    className={selectClass}
                    required
                  >
                    <option value="" className={optionClass}>Select batch</option>
                    {batches.map((batchItem) => (
                      <option key={batchItem.id} value={batchItem.name} className={optionClass}>
                        {batchItem.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Attendance</label>
                  <input
                    value={attendanceValue}
                    onChange={(event) => setAttendanceValue(event.target.value)}
                    className={inputClass}
                    placeholder="Example: 100%"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Grade</label>
                  <input
                    value={grade}
                    onChange={(event) => setGrade(event.target.value)}
                    className={inputClass}
                    placeholder="Example: A"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Placement</label>
                  <select
                    value={placement}
                    onChange={(event) => setPlacement(event.target.value)}
                    className={selectClass}
                  >
                    <option value="Not Started" className={optionClass}>Not Started</option>
                    <option value="In Progress" className={optionClass}>In Progress</option>
                    <option value="Eligible" className={optionClass}>Eligible</option>
                    <option value="Placed" className={optionClass}>Placed</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Status</label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as StudentStatus)}
                    className={selectClass}
                  >
                    <option value="active" className={optionClass}>Active</option>
                    <option value="inactive" className={optionClass}>Inactive</option>
                    <option value="completed" className={optionClass}>Completed</option>
                    <option value="archived" className={optionClass}>Archived</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Guardian Name</label>
                  <input
                    value={guardianName}
                    onChange={(event) => setGuardianName(event.target.value)}
                    className={inputClass}
                    placeholder="Guardian name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Guardian Phone</label>
                  <input
                    value={guardianPhone}
                    onChange={(event) => setGuardianPhone(event.target.value)}
                    className={inputClass}
                    placeholder="Guardian phone"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Address</label>
                  <textarea
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    className={textareaClass}
                    placeholder="Student address"
                    rows={3}
                  />
                </div>
              </div>

              {error && (
                <div className="mt-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeEditModal}>
                  Cancel
                </Button>

                <Button type="submit" disabled={saving} className="bg-[#153e90] text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90">
                  {saving ? 'Saving...' : 'Save Student'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}