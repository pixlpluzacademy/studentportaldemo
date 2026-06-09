'use client'

import { FormEvent, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { useDemoAuth } from '@/lib/demo/auth'
import {
  batches,
  courses,
  mentors,
  students as demoStudents,
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
  email?: string
  phone?: string
  joining_date?: string
  avatar_url?: string
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

const selectClass =
  'h-10 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a] dark:[color-scheme:dark]'

const optionClass = 'bg-background text-foreground'

const getStatusClass = (status: StudentStatus) => {
  if (status === 'active') {
    return 'border border-[#153e90]/30 bg-[#153e90]/10 px-3 py-1 text-xs font-medium text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white'
  }

  if (status === 'completed') {
    return 'border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-200'
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
  }))
}

const getAttendanceNumber = (attendanceValue: string) => {
  return Number(String(attendanceValue || '0').replace('%', '')) || 0
}

export default function Page() {
  const { can, user, role } = useDemoAuth()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const [students, setStudents] = useState<DemoStudent[]>(() => buildDemoStudents())

  const [search, setSearch] = useState('')
  const [filterCourse, setFilterCourse] = useState('all')
  const [filterBatch, setFilterBatch] = useState('all')
  const [filterPlacement, setFilterPlacement] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterGrade, setFilterGrade] = useState('all')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [course, setCourse] = useState('')
  const [batch, setBatch] = useState('')
  const [joiningDate, setJoiningDate] = useState('')
  const [attendance, setAttendance] = useState('100%')
  const [grade, setGrade] = useState('Not graded')
  const [placement, setPlacement] = useState('Not Started')
  const [status, setStatus] = useState<StudentStatus>('active')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const canCreateStudent = can('students.create')
  const canEditStudent = can('students.edit')
  const canDeleteStudent = can('students.delete')
  const canExportStudent = can('students.export')
  const canAssignStudent = can('students.assign')
  const canManageStudents = canCreateStudent || canEditStudent || canAssignStudent

  const currentRoleName = role?.name?.toLowerCase() || ''
  const currentUserName = user?.fullName || ''

  const ismentorView =
    currentRoleName.includes('mentor') &&
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

  const courseOptions = useMemo(() => {
    return Array.from(new Set(scopedStudents.map((student) => student.course).filter(Boolean))).sort()
  }, [scopedStudents])

  const batchOptions = useMemo(() => {
    return Array.from(new Set(scopedStudents.map((student) => student.batch).filter(Boolean))).sort()
  }, [scopedStudents])

  const placementOptions = useMemo(() => {
    return Array.from(new Set(scopedStudents.map((student) => student.placement).filter(Boolean))).sort()
  }, [scopedStudents])

  const gradeOptions = useMemo(() => {
    return Array.from(new Set(scopedStudents.map((student) => student.grade).filter(Boolean))).sort()
  }, [scopedStudents])

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return scopedStudents.filter((student) => {
      const matchesSearch =
        !keyword ||
        student.name.toLowerCase().includes(keyword) ||
        student.email?.toLowerCase().includes(keyword) ||
        student.phone?.toLowerCase().includes(keyword) ||
        student.course.toLowerCase().includes(keyword) ||
        student.batch.toLowerCase().includes(keyword) ||
        student.placement.toLowerCase().includes(keyword) ||
        student.status.toLowerCase().includes(keyword)

      return (
        matchesSearch &&
        (filterCourse === 'all' || student.course === filterCourse) &&
        (filterBatch === 'all' || student.batch === filterBatch) &&
        (filterPlacement === 'all' || student.placement === filterPlacement) &&
        (filterStatus === 'all' || student.status === filterStatus) &&
        (filterGrade === 'all' || student.grade === filterGrade)
      )
    })
  }, [scopedStudents, search, filterCourse, filterBatch, filterPlacement, filterStatus, filterGrade])

  const activeStudents = filteredStudents.filter((student) => student.status === 'active')
  const placementEligible = filteredStudents.filter((student) => {
    const attendanceNumber = getAttendanceNumber(student.attendance)

    return attendanceNumber >= 90 && student.placement.toLowerCase() !== 'not started'
  })

  const averageAttendance =
    filteredStudents.length > 0
      ? Math.round(
          filteredStudents.reduce((total, student) => total + getAttendanceNumber(student.attendance), 0) /
            filteredStudents.length,
        )
      : 0

  const resetFilters = () => {
    setSearch('')
    setFilterCourse('all')
    setFilterBatch('all')
    setFilterPlacement('all')
    setFilterStatus('all')
    setFilterGrade('all')
  }

  const resetForm = () => {
    const firstCourse = courses[0]
    const firstBatch = batches[0]

    setName('')
    setEmail('')
    setPhone('')
    setCourse(firstCourse?.name || '')
    setBatch(firstBatch?.name || '')
    setJoiningDate('')
    setAttendance('100%')
    setGrade('Not graded')
    setPlacement('Not Started')
    setStatus('active')
    setEditingId(null)
  }

  const openCreateModal = () => {
    resetForm()
    setError('')
    setMessage('')
    setIsModalOpen(true)
  }

  const openEditModal = (student: DemoStudent) => {
    setEditingId(student.id)
    setName(student.name)
    setEmail(student.email || '')
    setPhone(student.phone || '')
    setCourse(student.course)
    setBatch(student.batch)
    setJoiningDate(student.joining_date || '')
    setAttendance(student.attendance)
    setGrade(student.grade)
    setPlacement(student.placement)
    setStatus(student.status)
    setError('')
    setMessage('')
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    resetForm()
    setError('')
  }

  const handleSubmitStudent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (!editingId && !canCreateStudent) {
      setError('Your current permission cannot create students.')
      setLoading(false)
      return
    }

    if (editingId && !canEditStudent) {
      setError('Your current permission cannot edit students.')
      setLoading(false)
      return
    }

    if (!name.trim()) {
      setError('Please enter student name.')
      setLoading(false)
      return
    }

    if (!email.trim()) {
      setError('Please enter email address.')
      setLoading(false)
      return
    }

    if (!course.trim()) {
      setError('Please select course.')
      setLoading(false)
      return
    }

    if (!batch.trim()) {
      setError('Please select batch.')
      setLoading(false)
      return
    }

    const cleanStudent: DemoStudent = {
      id: editingId || `student-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || 'Not added',
      course,
      batch,
      attendance: attendance || '100%',
      grade: grade || 'Not graded',
      placement: placement || 'Not Started',
      status,
      joining_date: joiningDate || new Date().toISOString().split('T')[0],
      avatar_url: '/avatar.svg',
    }

    if (editingId) {
      setStudents(
        students.map((student) => (student.id === editingId ? cleanStudent : student)),
      )
      setMessage('Student updated successfully in demo.')
    } else {
      setStudents([cleanStudent, ...students])
      setMessage('Student created successfully in demo.')
    }

    setLoading(false)
    setIsModalOpen(false)
    resetForm()
  }

  const deleteStudent = (studentId: string) => {
    setError('')
    setMessage('')

    if (!canDeleteStudent) {
      setError('Your current permission cannot delete students.')
      return
    }

    setStudents(students.filter((student) => student.id !== studentId))
    setMessage('Student deleted from demo.')
  }

  const exportStudents = () => {
    setError('')
    setMessage('')

    if (!canExportStudent) {
      setError('Your current permission cannot export students.')
      return
    }

    setMessage('Demo export triggered. Later this will download student report from Supabase.')
  }

  if (!can('students.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Students Locked</h1>
        <p className="mt-2 text-muted-foreground">
          Your current permission cannot view students.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border border-border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Student Directory</p>
            <h1 className="mt-2 text-3xl font-bold">Students</h1>
            <p className="mt-3 max-w-4xl text-muted-foreground">
              {ismentorView
                ? 'View students from your assigned batches only.'
                : 'Manage student records with batch allocation, attendance, grade and placement status.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {canExportStudent && !ismentorView && (
              <Button type="button" variant="outline" onClick={exportStudents}>
                Export
              </Button>
            )}

            {canManageStudents && !ismentorView && (
              <Button
                onClick={openCreateModal}
                className="bg-[#153e90] text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
              >
                <CustomIcon icon="patch.svg" folder={iconFolder} alt="Create" className="mr-2 h-4 w-4" />
                Create Student
              </Button>
            )}
          </div>
        </div>
      </div>

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            {ismentorView ? 'Assigned Students' : 'Students'}
          </p>
          <p className="mt-4 text-4xl font-bold">{filteredStudents.length}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            {ismentorView ? 'From your batches' : 'Filtered list'}
          </p>
        </div>

        <div className="border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Average Attendance</p>
          <p className="mt-4 text-4xl font-bold">{averageAttendance}%</p>
          <p className="mt-4 text-sm text-muted-foreground">Starts from 100%</p>
        </div>

        <div className="border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Placement Eligible</p>
          <p className="mt-4 text-4xl font-bold">{placementEligible.length}</p>
          <p className="mt-4 text-sm text-muted-foreground">Ready pipeline</p>
        </div>

        <div className="border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="mt-4 text-4xl font-bold">{activeStudents.length}</p>
          <p className="mt-4 text-sm text-muted-foreground">Current learners</p>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold">Filters</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Filter students by course, batch, grade, placement and status.
            </p>
          </div>

          <Button type="button" variant="outline" onClick={resetFilters}>
            Clear Filters
          </Button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={inputClass}
            placeholder="Search student"
          />

          <select
            value={filterCourse}
            onChange={(event) => setFilterCourse(event.target.value)}
            className={selectClass}
          >
            <option value="all" className={optionClass}>All Courses</option>
            {courseOptions.map((item) => (
              <option key={item} value={item} className={optionClass}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filterBatch}
            onChange={(event) => setFilterBatch(event.target.value)}
            className={selectClass}
          >
            <option value="all" className={optionClass}>All Batches</option>
            {batchOptions.map((item) => (
              <option key={item} value={item} className={optionClass}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filterGrade}
            onChange={(event) => setFilterGrade(event.target.value)}
            className={selectClass}
          >
            <option value="all" className={optionClass}>All Grades</option>
            {gradeOptions.map((item) => (
              <option key={item} value={item} className={optionClass}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filterPlacement}
            onChange={(event) => setFilterPlacement(event.target.value)}
            className={selectClass}
          >
            <option value="all" className={optionClass}>All Placement</option>
            {placementOptions.map((item) => (
              <option key={item} value={item} className={optionClass}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
            className={selectClass}
          >
            <option value="all" className={optionClass}>All Status</option>
            <option value="active" className={optionClass}>Active</option>
            <option value="inactive" className={optionClass}>Inactive</option>
            <option value="completed" className={optionClass}>Completed</option>
            <option value="archived" className={optionClass}>Archived</option>
          </select>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {ismentorView ? 'Assigned Batch Students' : 'Student Directory'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Student list is scoped by current permission and batch assignment.
            </p>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredStudents.length}</span> records
          </div>
        </div>

        <div className="mt-5">
          {filteredStudents.length === 0 ? (
            <div className="border border-border bg-background/50 p-6 text-sm text-muted-foreground">
              {ismentorView
                ? 'No students found under your assigned batches in demo data.'
                : 'No students found.'}
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[1040px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Course</th>
                    <th className="px-4 py-3 font-semibold">Batch</th>
                    <th className="px-4 py-3 font-semibold">Attendance</th>
                    <th className="px-4 py-3 font-semibold">Grade</th>
                    <th className="px-4 py-3 font-semibold">Placement</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
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
                      <td className="px-4 py-4 text-muted-foreground">{student.batch}</td>
                      <td className="px-4 py-4">{student.attendance}</td>
                      <td className="px-4 py-4">{student.grade}</td>
                      <td className="px-4 py-4">{student.placement}</td>
                      <td className="px-4 py-4">
                        <span className={getStatusClass(student.status)}>
                          {student.status}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/students/${student.id}`}>View More</Link>
                          </Button>

                          {canEditStudent && !ismentorView && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => openEditModal(student)}
                              className="bg-[#153e90] text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
                            >
                              Edit
                            </Button>
                          )}

                          {canDeleteStudent && !ismentorView && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => deleteStudent(student.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-6">
              <div>
                <h2 className="text-2xl font-bold">
                  {editingId ? 'Edit Student' : 'Create Student'}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add student details, course, batch, attendance and placement status.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="border border-border px-3 py-2 text-sm font-semibold hover:bg-accent"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmitStudent} className="p-6">
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
                    {courses.map((courseItem) => (
                      <option key={courseItem.id} value={courseItem.name} className={optionClass}>
                        {courseItem.name}
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
                    value={attendance}
                    onChange={(event) => setAttendance(event.target.value)}
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

                <Button type="submit" disabled={loading} className="bg-[#153e90] text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90">
                  {loading ? 'Saving...' : editingId ? 'Update Student' : 'Create Student'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}