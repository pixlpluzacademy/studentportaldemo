'use client'

import { FormEvent, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDemoAuth } from '@/lib/demo/auth'
import {
  batches as demoBatches,
  branches,
  courses,
  mentors,
} from '@/lib/demo/seed'

type CourseType = 'professional' | 'advanced' | 'basic'
type BatchMode = 'online' | 'offline'
type BatchStatus = 'active' | 'inactive' | 'completed'
type ClassDayType = 'weekdays' | 'weekend' | 'custom'

type BatchStaffPermission =
  | 'view_batch'
  | 'view_staff'
  | 'view_students'
  | 'take_lecture'
  | 'upload_materials'
  | 'assign_tasks'
  | 'monitor_submissions'
  | 'review_submissions'
  | 'approve_marks'
  | 'reply_complaints'
  | 'final_qa'
  | 'view_reports'

type StaffMember = {
  id: string
  name: string
  designation: string
}

type BatchStaffAssignment = {
  id: string
  batch_id: string
  staff_id: string
  staff_name: string
  responsibility_title: string
  reports_to_assignment_id: string | null
  reports_to_name: string | null
  permissions: BatchStaffPermission[]
  status: 'active' | 'inactive'
}

type DemoBatch = {
  id: string
  name: string
  batch_code: string | null
  description: string | null
  duration_months: number | null
  start_date: string | null
  end_date: string | null
  status: BatchStatus
  created_at: string
  created_by: string | null
  course_id: string | null
  mentor_id: string | null
  branch_id: string | null
  course_type: CourseType
  batch_mode: BatchMode
  class_day_type: ClassDayType
  custom_days: string[]
  batch_start_time: string | null
  batch_end_time: string | null
  max_seats: number | null
  enrolled_count: number
  class_link: string | null
  staff_assignments: BatchStaffAssignment[]
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

const textareaClass =
  'min-h-24 w-full resize-y border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground dark:[color-scheme:dark]'

const selectClass =
  'h-10 w-full border border-border bg-transparent px-3 text-sm text-foreground outline-none dark:[color-scheme:dark]'

const optionClass = 'bg-[#111111] text-white'

const staffMembers: StaffMember[] = [
  { id: 'arjun-das', name: 'Arjun Das', designation: 'Academic Lead' },
  { id: 'nisha-varghese', name: 'Nisha Varghese', designation: 'Student Mentor' },
  { id: 'rahul-mathew', name: 'Rahul Mathew', designation: 'Trainer' },
  { id: 'devika-iyer', name: 'Devika Iyer', designation: 'Academic Lead' },
  { id: 'maya-joseph', name: 'Maya Joseph', designation: 'Final QA' },
  ...mentors
    .filter((mentor) => !['Nisha Varghese', 'Rahul Mathew', 'Devika Iyer'].includes(mentor.name))
    .map((mentor) => ({
      id: mentor.id,
      name: mentor.name,
      designation: mentor.department,
    })),
]

const permissionOptions: {
  value: BatchStaffPermission
  label: string
}[] = [
  { value: 'view_batch', label: 'View batch' },
  { value: 'view_staff', label: 'View staff under them' },
  { value: 'view_students', label: 'View students' },
  { value: 'take_lecture', label: 'Take lecture' },
  { value: 'upload_materials', label: 'Upload materials' },
  { value: 'assign_tasks', label: 'Assign tasks' },
  { value: 'monitor_submissions', label: 'Monitor submissions' },
  { value: 'review_submissions', label: 'Review submissions' },
  { value: 'approve_marks', label: 'Approve marks' },
  { value: 'reply_complaints', label: 'Reply complaints' },
  { value: 'final_qa', label: 'Final QA' },
  { value: 'view_reports', label: 'View reports' },
]

const leadPermissions: BatchStaffPermission[] = [
  'view_batch',
  'view_staff',
  'view_students',
  'take_lecture',
  'upload_materials',
  'review_submissions',
  'approve_marks',
  'view_reports',
]

const mentorPermissions: BatchStaffPermission[] = [
  'view_batch',
  'view_students',
  'assign_tasks',
  'monitor_submissions',
  'reply_complaints',
]

const courseTypeOptions: {
  value: CourseType
  label: string
  durationMonths: number
  helper: string
}[] = [
  {
    value: 'professional',
    label: 'Professional',
    durationMonths: 1,
    helper: '1 Month',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    durationMonths: 2,
    helper: '2 Months',
  },
  {
    value: 'basic',
    label: 'Basic',
    durationMonths: 4,
    helper: '4 Months',
  },
]

const classDayOptions: {
  value: ClassDayType
  label: string
}[] = [
  {
    value: 'weekdays',
    label: 'Monday to Friday',
  },
  {
    value: 'weekend',
    label: 'Saturday and Sunday',
  },
  {
    value: 'custom',
    label: 'Custom Days',
  },
]

const courseTypeFromTrack = (track: string): CourseType => {
  const value = track.toLowerCase()

  if (value.includes('basic')) return 'basic'
  if (value.includes('advanced')) return 'advanced'

  return 'professional'
}

const getCourseTypeLabel = (courseType: CourseType) => {
  return courseTypeOptions.find((item) => item.value === courseType)?.label || 'Professional'
}

const getDurationFromCourseType = (courseType: CourseType) => {
  return courseTypeOptions.find((item) => item.value === courseType)?.durationMonths || 1
}

const getClassDayLabel = (classDayType: ClassDayType) => {
  return classDayOptions.find((item) => item.value === classDayType)?.label || 'Monday to Friday'
}

const calculateEndDateFromDuration = (startDateValue: string, durationMonthValue: number) => {
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

const getBatchNumber = (
  batches: DemoBatch[],
  courseCode: string,
  mode: BatchMode,
  batchStartTime: string,
  startDate: string
) => {
  const modeCode = getModeCode(mode)
  const timeCode = formatTimeForBatchCode(batchStartTime)
  const monthYearCode = formatMonthYearForBatchCode(startDate)
  const prefix = `PP-${courseCode}-${modeCode}-${timeCode}-${monthYearCode}`

  const matchingBatches = batches.filter((batch) => {
    return batch.batch_code?.startsWith(prefix)
  })

  return String(matchingBatches.length + 1).padStart(2, '0')
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

const parseBatchSeats = (seats: string) => {
  const [currentValue, maxValue] = seats.split('/')

  return {
    enrolled: Number(currentValue || 0),
    maxSeats: Number(maxValue || 0),
  }
}

const getYearFromDate = (dateValue: string | null) => {
  if (!dateValue) return ''

  const date = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(date.getTime())) return ''

  return String(date.getFullYear())
}

const getMonthFromDate = (dateValue: string | null) => {
  if (!dateValue) return ''

  const date = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(date.getTime())) return ''

  return String(date.getMonth() + 1)
}

const getStaffName = (staffId: string) => {
  return staffMembers.find((staff) => staff.id === staffId)?.name || 'Staff not found'
}

const buildStaffAssignment = ({
  id,
  batchId,
  staffId,
  responsibilityTitle,
  reportsToAssignmentId,
  reportsToName,
  permissions,
}: {
  id: string
  batchId: string
  staffId: string
  responsibilityTitle: string
  reportsToAssignmentId: string | null
  reportsToName: string | null
  permissions: BatchStaffPermission[]
}): BatchStaffAssignment => {
  return {
    id,
    batch_id: batchId,
    staff_id: staffId,
    staff_name: getStaffName(staffId),
    responsibility_title: responsibilityTitle,
    reports_to_assignment_id: reportsToAssignmentId,
    reports_to_name: reportsToName,
    permissions,
    status: 'active',
  }
}

const buildDemoStaffAssignments = (batchId: string, index: number): BatchStaffAssignment[] => {
  if (index === 0) {
    const leadId = `${batchId}-staff-lead`

    return [
      buildStaffAssignment({
        id: leadId,
        batchId,
        staffId: 'arjun-das',
        responsibilityTitle: 'Academic Lead',
        reportsToAssignmentId: null,
        reportsToName: 'Branch Admin',
        permissions: leadPermissions,
      }),
      buildStaffAssignment({
        id: `${batchId}-staff-mentor`,
        batchId,
        staffId: 'nisha-varghese',
        responsibilityTitle: 'Student Support Mentor',
        reportsToAssignmentId: leadId,
        reportsToName: 'Arjun Das',
        permissions: mentorPermissions,
      }),
    ]
  }

  if (index === 1) {
    const leadId = `${batchId}-staff-lead`

    return [
      buildStaffAssignment({
        id: leadId,
        batchId,
        staffId: 'devika-iyer',
        responsibilityTitle: 'Academic Lead',
        reportsToAssignmentId: null,
        reportsToName: 'Branch Admin',
        permissions: leadPermissions,
      }),
      buildStaffAssignment({
        id: `${batchId}-staff-mentor`,
        batchId,
        staffId: 'nisha-varghese',
        responsibilityTitle: 'Student Support Mentor',
        reportsToAssignmentId: leadId,
        reportsToName: 'Devika Iyer',
        permissions: mentorPermissions,
      }),
    ]
  }

  const leadId = `${batchId}-staff-lead`

  return [
    buildStaffAssignment({
      id: leadId,
      batchId,
      staffId: 'arjun-das',
      responsibilityTitle: 'Academic Lead',
      reportsToAssignmentId: null,
      reportsToName: 'Branch Admin',
      permissions: leadPermissions,
    }),
    buildStaffAssignment({
      id: `${batchId}-staff-trainer`,
      batchId,
      staffId: 'rahul-mathew',
      responsibilityTitle: 'Trainer / Student Mentor',
      reportsToAssignmentId: leadId,
      reportsToName: 'Arjun Das',
      permissions: [...mentorPermissions, 'take_lecture', 'upload_materials'],
    }),
  ]
}

const buildDemoBatches = (): DemoBatch[] => {
  return demoBatches.map((batch, index) => {
    const course = courses.find((item) => item.name === batch.course) || courses[0]
    const courseType = courseTypeFromTrack(course.track)
    const durationMonths = getDurationFromCourseType(courseType)
    const startDate = index === 0 ? '2026-06-01' : index === 1 ? '2026-06-03' : '2026-06-07'
    const endDate = calculateEndDateFromDuration(startDate, durationMonths)
    const batchMode = batch.mode.toLowerCase() === 'online' ? 'online' : 'offline'
    const startTime = timeTextToInputValue(batch.time)
    const endTime = index === 0 ? '09:00' : index === 1 ? '21:30' : '13:00'
    const seats = parseBatchSeats(batch.seats)
    const courseCode = courseCodeFromName(course.name)
    const batchCode = `PP-${courseCode}-${getModeCode(batchMode)}-${formatTimeForBatchCode(startTime)}-${formatMonthYearForBatchCode(startDate)}-${String(index + 1).padStart(2, '0')}`
    const batchId = batch.id
    const staffAssignments = buildDemoStaffAssignments(batchId, index)
    const supportAssignment = staffAssignments.find((item) => item.responsibility_title.toLowerCase().includes('mentor')) || staffAssignments[1]

    return {
      id: batchId,
      name: batch.name,
      batch_code: batchCode,
      description:
        index === 0
          ? 'Morning offline batch for Digital Marketing students.'
          : index === 1
            ? 'Evening online batch for Website Development students.'
            : 'Weekend offline batch for 3D Visualization students.',
      duration_months: durationMonths,
      start_date: startDate,
      end_date: endDate,
      status: batch.status === 'Full' ? 'completed' : 'active',
      created_at: new Date().toISOString(),
      created_by: 'demo',
      course_id: course.id,
      mentor_id: supportAssignment?.staff_id || null,
      branch_id: branches[0]?.id || 'b1',
      course_type: courseType,
      batch_mode: batchMode,
      class_day_type: index === 2 ? 'weekend' : 'weekdays',
      custom_days: [],
      batch_start_time: startTime,
      batch_end_time: endTime,
      max_seats: seats.maxSeats,
      enrolled_count: seats.enrolled,
      class_link: batchMode === 'online' ? 'https://zoom.us/j/demo-class-link' : null,
      staff_assignments: staffAssignments,
    }
  })
}

const getPermissionLabel = (permission: BatchStaffPermission) => {
  return permissionOptions.find((item) => item.value === permission)?.label || permission
}

const getAssignmentLevel = (assignment: BatchStaffAssignment) => {
  if (!assignment.reports_to_assignment_id) return 1
  return 2
}

export default function Page() {
  const { user, role, can } = useDemoAuth()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const [batches, setBatches] = useState<DemoBatch[]>(() => buildDemoBatches())

  const [filterCourseType, setFilterCourseType] = useState('all')
  const [filterCourse, setFilterCourse] = useState('all')
  const [filterMode, setFilterMode] = useState('all')
  const [filterStaff, setFilterStaff] = useState('all')
  const [filterYear, setFilterYear] = useState('all')
  const [filterMonth, setFilterMonth] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterStartTime, setFilterStartTime] = useState('all')
  const [filterDuration, setFilterDuration] = useState('all')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [courseType, setCourseType] = useState<CourseType>('professional')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [courseId, setCourseId] = useState('')
  const [academicLeadId, setAcademicLeadId] = useState('arjun-das')
  const [academicLeadTitle, setAcademicLeadTitle] = useState('Academic Lead')
  const [supportMentorId, setSupportMentorId] = useState('nisha-varghese')
  const [supportMentorTitle, setSupportMentorTitle] = useState('Student Support Mentor')
  const [branchId, setBranchId] = useState(branches[0]?.id || 'b1')
  const [durationMonths, setDurationMonths] = useState('1')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [batchMode, setBatchMode] = useState<BatchMode>('offline')
  const [classDayType, setClassDayType] = useState<ClassDayType>('weekdays')
  const [batchStartTime, setBatchStartTime] = useState('07:00')
  const [batchEndTime, setBatchEndTime] = useState('09:00')
  const [maxSeats, setMaxSeats] = useState('20')
  const [classLink, setClassLink] = useState('')
  const [status, setStatus] = useState<BatchStatus>('active')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const canCreateBatch = can('batches.create')
  const canEditBatch = can('batches.edit')
  const canAssignBatchStaff = can('batches.assign')
  const canManageBatches = canCreateBatch || canEditBatch || canAssignBatchStaff

  const demoCurrentUserName =
    user?.fullName === 'Super Admin' && role?.id === 'teacher'
      ? 'Nisha Varghese'
      : user?.fullName === 'Super Admin' && role?.id === 'hod'
        ? 'Arjun Das'
        : user?.fullName || ''

  const hasManagementBatchAccess = canCreateBatch || canEditBatch || canAssignBatchStaff

  const filteredCoursesByType = useMemo(() => {
    return courses.filter((course) => courseTypeFromTrack(course.track) === courseType)
  }, [courseType])

  const getVisibleAssignmentsForCurrentUser = (batch: DemoBatch) => {
    if (hasManagementBatchAccess) {
      return batch.staff_assignments
    }

    const ownAssignments = batch.staff_assignments.filter((assignment) => assignment.staff_name === demoCurrentUserName)
    const ownAssignmentIds = ownAssignments.map((assignment) => assignment.id)
    const subordinateAssignments = batch.staff_assignments.filter((assignment) =>
      assignment.reports_to_assignment_id ? ownAssignmentIds.includes(assignment.reports_to_assignment_id) : false
    )

    return [...ownAssignments, ...subordinateAssignments]
  }

  const canCurrentUserSeeBatch = (batch: DemoBatch) => {
    if (hasManagementBatchAccess) return true

    const visibleAssignments = getVisibleAssignmentsForCurrentUser(batch)

    return visibleAssignments.some((assignment) => assignment.permissions.includes('view_batch'))
  }

  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      if (!canCurrentUserSeeBatch(batch)) return false

      const enrolledCount = batch.enrolled_count || 0
      const maxSeatCount = batch.max_seats || 0
      const derivedStatus = maxSeatCount > 0 && enrolledCount >= maxSeatCount ? 'completed' : batch.status
      const batchYear = getYearFromDate(batch.start_date)
      const batchMonth = getMonthFromDate(batch.start_date)
      const durationValue = batch.duration_months ? String(batch.duration_months) : ''
      const matchesStaff =
        filterStaff === 'all' || batch.staff_assignments.some((assignment) => assignment.staff_id === filterStaff)

      return (
        (filterCourseType === 'all' || batch.course_type === filterCourseType) &&
        (filterCourse === 'all' || batch.course_id === filterCourse) &&
        (filterMode === 'all' || batch.batch_mode === filterMode) &&
        matchesStaff &&
        (filterYear === 'all' || batchYear === filterYear) &&
        (filterMonth === 'all' || batchMonth === filterMonth) &&
        (filterStatus === 'all' || derivedStatus === filterStatus) &&
        (filterStartTime === 'all' || batch.batch_start_time === filterStartTime) &&
        (filterDuration === 'all' || durationValue === filterDuration)
      )
    })
  }, [
    batches,
    filterCourseType,
    filterCourse,
    filterMode,
    filterStaff,
    filterYear,
    filterMonth,
    filterStatus,
    filterStartTime,
    filterDuration,
    demoCurrentUserName,
    hasManagementBatchAccess,
  ])

  const yearOptions = useMemo(() => {
    return Array.from(
      new Set(batches.map((batch) => getYearFromDate(batch.start_date)).filter(Boolean))
    ).sort((a, b) => Number(b) - Number(a))
  }, [batches])

  const monthOptions = useMemo(() => {
    return Array.from(
      new Set(batches.map((batch) => getMonthFromDate(batch.start_date)).filter(Boolean))
    ).sort((a, b) => Number(a) - Number(b))
  }, [batches])

  const startTimeOptions = useMemo(() => {
    return Array.from(
      new Set(batches.map((batch) => batch.batch_start_time).filter(Boolean) as string[])
    ).sort()
  }, [batches])

  const durationOptions = useMemo(() => {
    return Array.from(
      new Set(
        batches
          .map((batch) => (batch.duration_months ? String(batch.duration_months) : ''))
          .filter(Boolean)
      )
    ).sort((a, b) => Number(a) - Number(b))
  }, [batches])

  const activeCount = filteredBatches.filter((batch) => batch.status === 'active').length
  const inactiveCount = filteredBatches.filter((batch) => batch.status === 'inactive').length
  const completedCount = filteredBatches.filter((batch) => {
    const enrolled = batch.enrolled_count || 0
    const max = batch.max_seats || 0

    return batch.status === 'completed' || (max > 0 && enrolled >= max)
  }).length

  const resetFilters = () => {
    setFilterCourseType('all')
    setFilterCourse('all')
    setFilterMode('all')
    setFilterStaff('all')
    setFilterYear('all')
    setFilterMonth('all')
    setFilterStatus('all')
    setFilterStartTime('all')
    setFilterDuration('all')
  }

  const resetForm = () => {
    const defaultType: CourseType = 'professional'
    const firstCourse = courses.find((course) => courseTypeFromTrack(course.track) === defaultType)

    setCourseType(defaultType)
    setName(firstCourse ? `${firstCourse.name} Batch` : '')
    setDescription('')
    setCourseId(firstCourse?.id || '')
    setAcademicLeadId('arjun-das')
    setAcademicLeadTitle('Academic Lead')
    setSupportMentorId('nisha-varghese')
    setSupportMentorTitle('Student Support Mentor')
    setBranchId(branches[0]?.id || 'b1')
    setDurationMonths(String(getDurationFromCourseType(defaultType)))
    setStartDate('')
    setEndDate('')
    setBatchMode('offline')
    setClassDayType('weekdays')
    setBatchStartTime('07:00')
    setBatchEndTime('09:00')
    setMaxSeats('20')
    setClassLink('')
    setStatus('active')
  }

  const openAddModal = () => {
    resetForm()
    setMessage('')
    setError('')
    setIsModalOpen(true)
  }

  const updateCourseType = (selectedCourseType: CourseType) => {
    const durationValue = getDurationFromCourseType(selectedCourseType)
    const firstCourse = courses.find((course) => courseTypeFromTrack(course.track) === selectedCourseType)

    setCourseType(selectedCourseType)
    setDurationMonths(String(durationValue))
    setCourseId(firstCourse?.id || '')
    setName(firstCourse ? `${firstCourse.name} Batch` : '')
    setEndDate(calculateEndDateFromDuration(startDate, durationValue))
  }

  const updateCourse = (selectedCourseId: string) => {
    const course = courses.find((item) => item.id === selectedCourseId)

    setCourseId(selectedCourseId)

    if (course) {
      setName(`${course.name} Batch`)
    }
  }

  const updateStartDate = (value: string) => {
    setStartDate(value)
    setEndDate(calculateEndDateFromDuration(value, Number(durationMonths)))
  }

  const generateBatchCode = (
    selectedCourseName: string,
    selectedMode: BatchMode,
    selectedTime: string,
    selectedStartDate: string
  ) => {
    const courseCode = courseCodeFromName(selectedCourseName)
    const modeCode = getModeCode(selectedMode)
    const timeCode = formatTimeForBatchCode(selectedTime)
    const monthYearCode = formatMonthYearForBatchCode(selectedStartDate)
    const batchNumber = getBatchNumber(batches, courseCode, selectedMode, selectedTime, selectedStartDate)

    return `PP-${courseCode}-${modeCode}-${timeCode}-${monthYearCode}-${batchNumber}`
  }

  const handleSubmitBatch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    if (!canCreateBatch) {
      setError('Your current permission cannot create batches.')
      setLoading(false)
      return
    }

    if (!courseId) {
      setError('Please select course.')
      setLoading(false)
      return
    }

    if (!academicLeadId) {
      setError('Please select academic lead.')
      setLoading(false)
      return
    }

    if (!supportMentorId) {
      setError('Please select student support mentor.')
      setLoading(false)
      return
    }

    if (academicLeadId === supportMentorId) {
      setError('Academic lead and student support mentor should be different people.')
      setLoading(false)
      return
    }

    if (!startDate) {
      setError('Please select batch start date.')
      setLoading(false)
      return
    }

    if (!endDate) {
      setError('Please select batch end date.')
      setLoading(false)
      return
    }

    if (!batchStartTime || !batchEndTime) {
      setError('Please select batch start time and end time.')
      setLoading(false)
      return
    }

    const seatCount = Number(maxSeats)

    if (!seatCount || seatCount < 1) {
      setError('Maximum seats should be at least 1.')
      setLoading(false)
      return
    }

    const course = courses.find((item) => item.id === courseId)

    if (!course) {
      setError('Selected course not found.')
      setLoading(false)
      return
    }

    const finalCode = generateBatchCode(course.name, batchMode, batchStartTime, startDate)
    const newBatchId = `batch-${Date.now()}`
    const leadAssignmentId = `${newBatchId}-staff-lead`
    const leadStaffName = getStaffName(academicLeadId)

    const staffAssignments: BatchStaffAssignment[] = [
      buildStaffAssignment({
        id: leadAssignmentId,
        batchId: newBatchId,
        staffId: academicLeadId,
        responsibilityTitle: academicLeadTitle.trim() || 'Academic Lead',
        reportsToAssignmentId: null,
        reportsToName: 'Branch Admin',
        permissions: leadPermissions,
      }),
      buildStaffAssignment({
        id: `${newBatchId}-staff-mentor`,
        batchId: newBatchId,
        staffId: supportMentorId,
        responsibilityTitle: supportMentorTitle.trim() || 'Student Support Mentor',
        reportsToAssignmentId: leadAssignmentId,
        reportsToName: leadStaffName,
        permissions: mentorPermissions,
      }),
    ]

    const newBatch: DemoBatch = {
      id: newBatchId,
      name: name.trim() || `${course.name} Batch`,
      batch_code: finalCode,
      description: description || null,
      duration_months: Number(durationMonths),
      start_date: startDate,
      end_date: endDate,
      status,
      created_at: new Date().toISOString(),
      created_by: 'demo',
      course_id: courseId,
      mentor_id: supportMentorId,
      branch_id: branchId,
      course_type: courseType,
      batch_mode: batchMode,
      class_day_type: classDayType,
      custom_days: [],
      batch_start_time: batchStartTime,
      batch_end_time: batchEndTime,
      max_seats: seatCount,
      enrolled_count: 0,
      class_link: batchMode === 'online' ? classLink || null : null,
      staff_assignments: staffAssignments,
    }

    setBatches([newBatch, ...batches])
    setMessage(`Batch created successfully. Batch ID: ${finalCode}`)
    setLoading(false)
    setIsModalOpen(false)
    resetForm()
  }

  if (!can('batches.view')) {
    return (
      <div className="border border-border bg-transparent p-8">
        <h1 className="text-2xl font-bold">Batches Locked</h1>
        <p className="mt-2 text-muted-foreground">
          Your current permission cannot view batches.
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
              <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Permission Based Batch Management</p>
              <h1 className="mt-2 text-3xl font-bold">Batches</h1>
              <p className="mt-3 max-w-4xl text-muted-foreground">
                Create and manage online/offline batches with staff hierarchy. Each batch can have an Academic Lead and a Student Support Mentor, where the mentor reports to the lead for that batch.
              </p>
            </div>

            {canManageBatches && (
              <Button onClick={openAddModal} className="bg-[#153e90] text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#5dd84a]">
                <CustomIcon icon="patch.svg" folder={iconFolder} alt="Create" className="mr-2 h-4 w-4" />
                Create Batch
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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
        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm uppercase text-muted-foreground">Total Batches</p>
            <p className="mt-3 text-4xl font-bold">{filteredBatches.length}</p>
            <p className="mt-4 text-sm text-muted-foreground">Visible by permission</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm uppercase text-muted-foreground">Active Batches</p>
            <p className="mt-3 text-4xl font-bold">{activeCount}</p>
            <p className="mt-4 text-sm text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm uppercase text-muted-foreground">Inactive Batches</p>
            <p className="mt-3 text-4xl font-bold">{inactiveCount}</p>
            <p className="mt-4 text-sm text-muted-foreground">Not active now</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm uppercase text-muted-foreground">Completed Batches</p>
            <p className="mt-3 text-4xl font-bold">{completedCount}</p>
            <p className="mt-4 text-sm text-muted-foreground">Completed or full</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border bg-transparent">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>Filters</CardTitle>
            <Button type="button" variant="outline" onClick={resetFilters}>
              Clear Filters
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select value={filterCourseType} onChange={(e) => setFilterCourseType(e.target.value)} className={selectClass}>
              <option value="all" className={optionClass}>All Course Types</option>
              {courseTypeOptions.map((type) => (
                <option key={type.value} value={type.value} className={optionClass}>
                  {type.label}
                </option>
              ))}
            </select>

            <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} className={selectClass}>
              <option value="all" className={optionClass}>All Courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id} className={optionClass}>
                  {course.name}
                </option>
              ))}
            </select>

            <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)} className={selectClass}>
              <option value="all" className={optionClass}>All Modes</option>
              <option value="online" className={optionClass}>Online</option>
              <option value="offline" className={optionClass}>Offline</option>
            </select>

            <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} className={selectClass}>
              <option value="all" className={optionClass}>All Assigned Staff</option>
              {staffMembers.map((staff) => (
                <option key={staff.id} value={staff.id} className={optionClass}>
                  {staff.name}
                </option>
              ))}
            </select>

            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className={selectClass}>
              <option value="all" className={optionClass}>All Years</option>
              {yearOptions.map((year) => (
                <option key={year} value={year} className={optionClass}>
                  {year}
                </option>
              ))}
            </select>

            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className={selectClass}>
              <option value="all" className={optionClass}>All Months</option>
              {monthOptions.map((month) => (
                <option key={month} value={month} className={optionClass}>
                  {new Date(2026, Number(month) - 1, 1).toLocaleString('en-US', { month: 'long' })}
                </option>
              ))}
            </select>

            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass}>
              <option value="all" className={optionClass}>All Status</option>
              <option value="active" className={optionClass}>Active</option>
              <option value="inactive" className={optionClass}>Inactive</option>
              <option value="completed" className={optionClass}>Completed / Full</option>
            </select>

            <select value={filterStartTime} onChange={(e) => setFilterStartTime(e.target.value)} className={selectClass}>
              <option value="all" className={optionClass}>All Start Times</option>
              {startTimeOptions.map((time) => (
                <option key={time} value={time} className={optionClass}>
                  {formatTimeLabel(time)}
                </option>
              ))}
            </select>

            <select value={filterDuration} onChange={(e) => setFilterDuration(e.target.value)} className={selectClass}>
              <option value="all" className={optionClass}>All Durations</option>
              {durationOptions.map((duration) => (
                <option key={duration} value={duration} className={optionClass}>
                  {duration} {duration === '1' ? 'Month' : 'Months'}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border bg-transparent">
        <CardHeader>
          <CardTitle>Batch List</CardTitle>
        </CardHeader>

        <CardContent>
          {filteredBatches.length === 0 ? (
            <div className="border border-border bg-transparent p-6 text-sm text-muted-foreground">
              No batches found for the selected filters or permission scope.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBatches.map((batch) => {
                const course = courses.find((item) => item.id === batch.course_id)
                const branch = branches.find((item) => item.id === batch.branch_id)
                const enrolledCount = batch.enrolled_count || 0
                const maxSeatCount = batch.max_seats || 0
                const isFull = maxSeatCount > 0 && enrolledCount >= maxSeatCount
                const displayStatus = isFull ? 'completed' : batch.status
                const visibleAssignments = getVisibleAssignmentsForCurrentUser(batch).sort(
                  (a, b) => getAssignmentLevel(a) - getAssignmentLevel(b)
                )
                const leadAssignment = batch.staff_assignments.find((assignment) => !assignment.reports_to_assignment_id)
                const supportAssignments = batch.staff_assignments.filter((assignment) => assignment.reports_to_assignment_id)

                return (
                  <div key={batch.id} className="border border-border bg-transparent p-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-bold">{batch.name}</h3>

                          {batch.batch_code && (
                            <span className="border border-border px-2 py-1 text-xs text-muted-foreground">
                              {batch.batch_code}
                            </span>
                          )}

                          <span className="border border-border px-2 py-1 text-xs font-medium capitalize">
                            {getCourseTypeLabel(batch.course_type)}
                          </span>

                          <span
                            className={
                              displayStatus === 'active'
                                ? 'border border-[#153e90]/30 bg-[#153e90]/10 px-2 py-1 text-xs font-medium text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white'
                                : displayStatus === 'completed'
                                  ? 'border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-300'
                                  : 'border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400'
                            }
                          >
                            {displayStatus}
                          </span>
                        </div>

                        <p className="mt-3 text-muted-foreground">{batch.description || 'No description'}</p>

                        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                          <p>
                            <span className="text-muted-foreground">Course:</span>{' '}
                            <span className="font-medium">{course?.name || 'No course'}</span>
                          </p>

                          <p>
                            <span className="text-muted-foreground">Branch:</span>{' '}
                            <span className="font-medium">{branch?.name || 'No branch'}</span>
                          </p>

                          <p>
                            <span className="text-muted-foreground">Mode:</span>{' '}
                            <span className="font-medium">{batch.batch_mode === 'online' ? 'Online' : 'Offline'}</span>
                          </p>

                          <p>
                            <span className="text-muted-foreground">Class Days:</span>{' '}
                            <span className="font-medium">{getClassDayLabel(batch.class_day_type)}</span>
                          </p>

                          <p>
                            <span className="text-muted-foreground">Time:</span>{' '}
                            <span className="font-medium">
                              {formatTimeLabel(batch.batch_start_time)} to {formatTimeLabel(batch.batch_end_time)}
                            </span>
                          </p>

                          <p>
                            <span className="text-muted-foreground">Duration:</span>{' '}
                            <span className="font-medium">
                              {batch.duration_months} {batch.duration_months === 1 ? 'month' : 'months'}
                            </span>
                          </p>

                          <p>
                            <span className="text-muted-foreground">Dates:</span>{' '}
                            <span className="font-medium">
                              {batch.start_date} to {batch.end_date}
                            </span>
                          </p>

                          <p>
                            <span className="text-muted-foreground">Seats:</span>{' '}
                            <span className="font-medium">
                              {enrolledCount}/{maxSeatCount || 0}
                            </span>
                          </p>

                          {batch.batch_mode === 'online' && (
                            <p className="sm:col-span-2 xl:col-span-4">
                              <span className="text-muted-foreground">Online Link:</span>{' '}
                              <span className="font-medium">
                                {batch.class_link ? 'Link added' : 'Not added yet'}
                              </span>
                            </p>
                          )}
                        </div>

                        <div className="mt-5 border border-border bg-background/40 p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <h4 className="font-bold">Batch Staff Hierarchy</h4>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Access is based on batch assignment, reports-to relationship and batch permissions.
                              </p>
                            </div>

                            {leadAssignment && (
                              <span className="border border-border px-2 py-1 text-xs text-muted-foreground">
                                {supportAssignments.length} staff reporting to {leadAssignment.staff_name}
                              </span>
                            )}
                          </div>

                          <div className="mt-4 grid gap-3 lg:grid-cols-2">
                            {visibleAssignments.map((assignment) => (
                              <div key={assignment.id} className="border border-border bg-card p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="font-bold">{assignment.staff_name}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{assignment.responsibility_title}</p>
                                  </div>

                                  <span className="border border-border px-2 py-1 text-xs capitalize">
                                    {assignment.status}
                                  </span>
                                </div>

                                <div className="mt-3 text-xs text-muted-foreground">
                                  Reports to:{' '}
                                  <span className="font-semibold text-foreground">
                                    {assignment.reports_to_name || 'Top level'}
                                  </span>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {assignment.permissions.slice(0, 5).map((permission) => (
                                    <span
                                      key={permission}
                                      className="border border-[#153e90]/25 bg-[#153e90]/10 px-2 py-1 text-[11px] font-semibold text-[#153e90] dark:border-[#6ee75a]/25 dark:bg-[#6ee75a]/10 dark:text-white"
                                    >
                                      {getPermissionLabel(permission)}
                                    </span>
                                  ))}

                                  {assignment.permissions.length > 5 && (
                                    <span className="border border-border px-2 py-1 text-[11px] text-muted-foreground">
                                      +{assignment.permissions.length - 5} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 xl:justify-end">
                        <Button asChild variant="outline">
                          <Link href={`/batches/${batch.id}`}>
                            <CustomIcon icon="dashboard.svg" folder={iconFolder} alt="View More" className="mr-2 h-4 w-4" />
                            View More
                          </Link>
                        </Button>

                        {canEditBatch && (
                          <Button type="button">
                            <CustomIcon icon="submissions.svg" folder={iconFolder} alt="Edit" className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-6">
              <div>
                <h2 className="text-2xl font-bold">Create Batch</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create a batch with academic lead and student support mentor hierarchy.
                </p>
              </div>

              <button type="button" onClick={() => setIsModalOpen(false)} className="border border-border px-3 py-2 text-sm">
                Close
              </button>
            </div>

            <form onSubmit={handleSubmitBatch} className="p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Course Type</label>
                  <select value={courseType} onChange={(e) => updateCourseType(e.target.value as CourseType)} className={selectClass} required>
                    {courseTypeOptions.map((type) => (
                      <option key={type.value} value={type.value} className={optionClass}>
                        {type.label} - {type.helper}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Course</label>
                  <select value={courseId} onChange={(e) => updateCourse(e.target.value)} className={selectClass} required>
                    <option value="" className={optionClass}>Select course</option>
                    {filteredCoursesByType.map((course) => (
                      <option key={course.id} value={course.id} className={optionClass}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Academic Lead</label>
                  <select value={academicLeadId} onChange={(e) => setAcademicLeadId(e.target.value)} className={selectClass} required>
                    <option value="" className={optionClass}>Select academic lead</option>
                    {staffMembers.map((staff) => (
                      <option key={staff.id} value={staff.id} className={optionClass}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Academic Lead Responsibility</label>
                  <input
                    value={academicLeadTitle}
                    onChange={(e) => setAcademicLeadTitle(e.target.value)}
                    className={inputClass}
                    placeholder="Example: Academic Lead"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Student Support Mentor</label>
                  <select value={supportMentorId} onChange={(e) => setSupportMentorId(e.target.value)} className={selectClass} required>
                    <option value="" className={optionClass}>Select student support mentor</option>
                    {staffMembers.map((staff) => (
                      <option key={staff.id} value={staff.id} className={optionClass}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Mentor Responsibility</label>
                  <input
                    value={supportMentorTitle}
                    onChange={(e) => setSupportMentorTitle(e.target.value)}
                    className={inputClass}
                    placeholder="Example: Student Support Mentor"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="border border-border bg-background/40 p-4">
                    <h3 className="font-bold">Hierarchy Preview</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
                      <div className="border border-border bg-card p-4">
                        <p className="font-bold">{getStaffName(academicLeadId)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{academicLeadTitle || 'Academic Lead'}</p>
                        <p className="mt-3 text-xs text-muted-foreground">Can view staff under them and review academic quality.</p>
                      </div>

                      <div className="text-center text-sm font-semibold text-muted-foreground">supervises</div>

                      <div className="border border-border bg-card p-4">
                        <p className="font-bold">{getStaffName(supportMentorId)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{supportMentorTitle || 'Student Support Mentor'}</p>
                        <p className="mt-3 text-xs text-muted-foreground">Reports to {getStaffName(academicLeadId)} for this batch.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Branch</label>
                  <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={selectClass} required>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id} className={optionClass}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Batch Duration</label>
                  <input value={`${durationMonths} ${durationMonths === '1' ? 'Month' : 'Months'}`} className={inputClass} readOnly />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Maximum Seats</label>
                  <input type="number" min="1" value={maxSeats} onChange={(e) => setMaxSeats(e.target.value)} className={inputClass} required />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as BatchStatus)} className={selectClass}>
                    <option value="active" className={optionClass}>Active</option>
                    <option value="inactive" className={optionClass}>Inactive</option>
                    <option value="completed" className={optionClass}>Completed</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Batch Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Example: Digital Marketing Batch" required />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={textareaClass} placeholder="Short description about this batch" rows={3} />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Batch Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => updateStartDate(e.target.value)} className={inputClass} required />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Batch End Date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} required />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Online / Offline Mode</label>
                  <select value={batchMode} onChange={(e) => setBatchMode(e.target.value as BatchMode)} className={selectClass} required>
                    <option value="offline" className={optionClass}>Offline</option>
                    <option value="online" className={optionClass}>Online</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Class Days</label>
                  <select value={classDayType} onChange={(e) => setClassDayType(e.target.value as ClassDayType)} className={selectClass} required>
                    {classDayOptions.map((item) => (
                      <option key={item.value} value={item.value} className={optionClass}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Batch Start Time</label>
                  <input type="time" value={batchStartTime} onChange={(e) => setBatchStartTime(e.target.value)} className={inputClass} required />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Batch End Time</label>
                  <input type="time" value={batchEndTime} onChange={(e) => setBatchEndTime(e.target.value)} className={inputClass} required />
                </div>

                {batchMode === 'online' && (
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium">Online Class Link</label>
                    <input
                      value={classLink}
                      onChange={(e) => setClassLink(e.target.value)}
                      className={inputClass}
                      placeholder="Zoom / Google Meet / YouTube link"
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>

                <Button type="submit" disabled={loading} className="bg-[#153e90] text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#5dd84a]">
                  {loading ? 'Creating...' : 'Create Batch'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}