'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth/provider'
import { BATCH_MODE_ONSITE_LABEL } from '@/lib/data/batch-code'
import { createBatchAccount, previewBatchCode, updateBatchAccount, type BatchListRow } from '@/lib/data/batches'
import { useBatchList } from '@/lib/data/hooks/use-batches'
import { useCourseList } from '@/lib/data/hooks/use-courses'
import { useDepartmentList } from '@/lib/data/hooks/use-departments'
import { useMentorDirectory } from '@/lib/data/hooks/use-mentors'
import { durationMonthsByType, type CourseType } from '@/lib/data/courses'
import { MENTOR_HOD_SLUG, MENTOR_FINAL_QA_SLUG } from '@/lib/data/mentors'
import { createClient } from '@/lib/supabase/client'

type BatchMode = 'online' | 'offline'
type BatchStatus = 'active' | 'inactive'
type ClassDayType = 'weekdays' | 'weekend' | 'custom'

type BatchModePageProps = {
  fixedMode: BatchMode
}

const MODE_COPY = {
  online: {
    lockedTitle: 'Online Batches Locked',
    pageTitle: 'Online Batches',
    subtitle:
      'View and manage online batches with class days, timing, maximum seats, and online class links.',
    createButton: 'Create Online Batch',
    createModalTitle: 'Create Online Batch',
    createModalSubtitle:
      'Create an online batch with department, course, HOD, trainer, and auto-generated batch code.',
    createSubmit: 'Create Online Batch',
    listTitle: 'Online Batch List',
    emptyList: 'No online batches found.',
    statTotal: 'Total Online',
    statTotalHelper: 'Total online batches',
    statActive: 'Active Online Batches',
    statCompleted: 'Completed Online',
    successPrefix: 'Online batch created successfully',
    modeLabel: 'Online',
    namePlaceholder: 'Example: Online Digital Marketing Batch',
    descriptionPlaceholder: 'Short description about this online batch',
  },
  offline: {
    lockedTitle: 'Onsite Batches Locked',
    pageTitle: 'Onsite Batches',
    subtitle:
      'View and manage onsite batches with class days, timing, and maximum seats.',
    createButton: 'Create Onsite Batch',
    createModalTitle: 'Create Onsite Batch',
    createModalSubtitle:
      'Create an onsite batch with department, course, HOD, trainer, and auto-generated batch code.',
    createSubmit: 'Create Onsite Batch',
    listTitle: 'Onsite Batch List',
    emptyList: 'No onsite batches found.',
    statTotal: 'Total Onsite',
    statTotalHelper: 'Total onsite batches',
    statActive: 'Active Onsite Batches',
    statCompleted: 'Completed Onsite',
    successPrefix: 'Onsite batch created successfully',
    modeLabel: BATCH_MODE_ONSITE_LABEL,
    namePlaceholder: 'Example: Onsite Website Development Batch',
    descriptionPlaceholder: 'Short description about this onsite batch',
  },
} as const

async function getAccessToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
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

const courseTypeOptions: {
  value: CourseType
  label: string
  helper: string
}[] = [
  { value: 'professional', label: 'Professional', helper: '1 Month' },
  { value: 'advanced', label: 'Advanced', helper: '2 Months' },
  { value: 'basic', label: 'Basic', helper: '4 Months' },
]

const classDayOptions: { value: ClassDayType; label: string }[] = [
  { value: 'weekdays', label: 'Monday to Friday' },
  { value: 'weekend', label: 'Saturday and Sunday' },
  { value: 'custom', label: 'Custom Days' },
]

const getCourseTypeLabel = (courseType: CourseType) =>
  courseTypeOptions.find((item) => item.value === courseType)?.label || 'Professional'

const getDurationFromCourseType = (courseType: CourseType) => durationMonthsByType[courseType]

const getClassDayLabel = (classDayType: ClassDayType) =>
  classDayOptions.find((item) => item.value === classDayType)?.label || 'Monday to Friday'

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

export function BatchModePage({ fixedMode }: BatchModePageProps) {
  const copy = MODE_COPY[fixedMode]
  const { user, can } = useAuth()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const {
    batches,
    activeBranchId,
    activeBranch,
    loading: batchesLoading,
    error: batchesLoadError,
    reload: reloadBatches,
  } = useBatchList()
  const { courses, loading: coursesLoading } = useCourseList()
  const { departments, loading: departmentsLoading } = useDepartmentList()
  const { mentors, loading: mentorsLoading } = useMentorDirectory()

  const modeBatches = useMemo(
    () => batches.filter((batch) => batch.batch_mode === fixedMode),
    [batches, fixedMode],
  )

  const [filterCourseType, setFilterCourseType] = useState('all')
  const [filterCourse, setFilterCourse] = useState('all')
  const [filterStaff, setFilterStaff] = useState('all')
  const [filterYear, setFilterYear] = useState('all')
  const [filterMonth, setFilterMonth] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterStartTime, setFilterStartTime] = useState('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null)

  const [courseType, setCourseType] = useState<CourseType>('professional')
  const [departmentId, setDepartmentId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [courseId, setCourseId] = useState('')
  const [academicLeadId, setAcademicLeadId] = useState('')
  const [supportMentorId, setSupportMentorId] = useState('')
  const [durationMonths, setDurationMonths] = useState('1')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
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
  const canManageBatches = canCreateBatch || canEditBatch || can('batches.assign')
  const hasManagementBatchAccess = canManageBatches

  const hodOptions = useMemo(
    () =>
      mentors.filter(
        (mentor) =>
          mentor.permission_profile_slug === MENTOR_HOD_SLUG &&
          (!departmentId || mentor.department_id === departmentId),
      ),
    [departmentId, mentors],
  )

  const trainerOptions = useMemo(
    () =>
      mentors.filter(
        (mentor) =>
          mentor.permission_profile_slug !== MENTOR_HOD_SLUG &&
          mentor.permission_profile_slug !== MENTOR_FINAL_QA_SLUG &&
          (!departmentId || mentor.department_id === departmentId),
      ),
    [departmentId, mentors],
  )

  useEffect(() => {
    if (academicLeadId && !hodOptions.some((staff) => staff.id === academicLeadId)) {
      setAcademicLeadId('')
    }
  }, [academicLeadId, hodOptions])

  useEffect(() => {
    if (supportMentorId && !trainerOptions.some((staff) => staff.id === supportMentorId)) {
      setSupportMentorId('')
    }
  }, [supportMentorId, trainerOptions])

  const staffFilterOptions = useMemo(
    () => mentors.map((mentor) => ({ id: mentor.id, name: mentor.full_name })),
    [mentors],
  )

  const filteredCoursesByType = useMemo(() => {
    return courses.filter((course) => {
      if (course.course_type !== courseType) return false
      if (!departmentId) return true
      return course.department_id === departmentId
    })
  }, [courseType, courses, departmentId])

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === courseId) || null,
    [courseId, courses],
  )

  const batchCodePreview = useMemo(() => {
    if (!selectedCourse || !startDate) return ''

    return previewBatchCode({
      branchCode: activeBranch?.code || '',
      departmentCode: selectedCourse.department_code || '',
      mode: fixedMode,
      startDate,
      existingCodes: modeBatches.map((batch) => batch.batch_code || '').filter(Boolean),
    })
  }, [activeBranch?.code, fixedMode, modeBatches, selectedCourse, startDate])

  const canCurrentUserSeeBatch = (batch: BatchListRow) => {
    if (hasManagementBatchAccess) return true
    if (!user?.id) return false

    return batch.staff_assignments.some(
      (assignment) =>
        assignment.staff_id === user.id || assignment.reports_to_assignment_id === user.id,
    )
  }

  const filteredBatches = useMemo(() => {
    return modeBatches.filter((batch) => {
      if (!canCurrentUserSeeBatch(batch)) return false

      const batchYear = getYearFromDate(batch.start_date)
      const batchMonth = getMonthFromDate(batch.start_date)
      const matchesStaff =
        filterStaff === 'all' ||
        batch.staff_assignments.some((assignment) => assignment.staff_id === filterStaff)

      return (
        (filterCourseType === 'all' || batch.course_type === filterCourseType) &&
        (filterCourse === 'all' || batch.course_id === filterCourse) &&
        matchesStaff &&
        (filterYear === 'all' || batchYear === filterYear) &&
        (filterMonth === 'all' || batchMonth === filterMonth) &&
        (filterStatus === 'all' || batch.status === filterStatus) &&
        (filterStartTime === 'all' || batch.batch_start_time === filterStartTime)
      )
    })
  }, [
    modeBatches,
    filterCourseType,
    filterCourse,
    filterStaff,
    filterYear,
    filterMonth,
    filterStatus,
    filterStartTime,
    hasManagementBatchAccess,
    user?.id,
  ])

  const yearOptions = useMemo(
    () =>
      Array.from(new Set(modeBatches.map((batch) => getYearFromDate(batch.start_date)).filter(Boolean))).sort(
        (a, b) => Number(b) - Number(a),
      ),
    [modeBatches],
  )

  const monthOptions = useMemo(
    () =>
      Array.from(new Set(modeBatches.map((batch) => getMonthFromDate(batch.start_date)).filter(Boolean))).sort(
        (a, b) => Number(a) - Number(b),
      ),
    [modeBatches],
  )

  const startTimeOptions = useMemo(
    () =>
      Array.from(
        new Set(modeBatches.map((batch) => batch.batch_start_time).filter(Boolean) as string[]),
      ).sort(),
    [modeBatches],
  )

  const activeCount = filteredBatches.filter(
    (batch) => batch.status === 'active' || batch.status === 'full',
  ).length
  const completedCount = filteredBatches.filter((batch) => batch.status === 'completed').length

  const resetFilters = () => {
    setFilterCourseType('all')
    setFilterCourse('all')
    setFilterStaff('all')
    setFilterYear('all')
    setFilterMonth('all')
    setFilterStatus('all')
    setFilterStartTime('all')
  }

  const resetForm = () => {
    const defaultType: CourseType = 'professional'
    const defaultDepartment = departments[0]
    const defaultDeptId = defaultDepartment?.id || ''
    const firstCourse = courses.find(
      (course) =>
        course.course_type === defaultType &&
        (!defaultDeptId || course.department_id === defaultDeptId),
    )
    const defaultHod = mentors.find(
      (mentor) =>
        mentor.permission_profile_slug === MENTOR_HOD_SLUG &&
        (!defaultDeptId || mentor.department_id === defaultDeptId),
    )
    const defaultTrainer = mentors.find(
      (mentor) =>
        mentor.permission_profile_slug !== MENTOR_HOD_SLUG &&
        mentor.permission_profile_slug !== MENTOR_FINAL_QA_SLUG &&
        (!defaultDeptId || mentor.department_id === defaultDeptId),
    )

    setCourseType(defaultType)
    setDepartmentId(defaultDeptId)
    setName(firstCourse ? `${firstCourse.name} Batch` : '')
    setDescription('')
    setCourseId(firstCourse?.id || '')
    setAcademicLeadId(defaultHod?.id || '')
    setSupportMentorId(defaultTrainer?.id || '')
    setDurationMonths(String(getDurationFromCourseType(defaultType)))
    setStartDate('')
    setEndDate('')
    setClassDayType('weekdays')
    setBatchStartTime('07:00')
    setBatchEndTime('09:00')
    setMaxSeats('20')
    setClassLink('')
    setStatus('active')
  }

  const openAddModal = () => {
    resetForm()
    setEditingBatchId(null)
    setMessage('')
    setError('')
    setIsModalOpen(true)
  }

  const openEditModal = (batch: BatchListRow) => {
    const hodAssignment = batch.staff_assignments.find((assignment) => assignment.staff_type === 'hod')
    const trainerAssignment = batch.staff_assignments.find((assignment) => assignment.staff_type === 'trainer')

    setEditingBatchId(batch.id)
    setCourseType(batch.course_type)
    setDepartmentId(batch.department_id || '')
    setName(batch.name || '')
    setDescription(batch.description || '')
    setCourseId(batch.course_id || '')
    setAcademicLeadId(hodAssignment?.staff_id || '')
    setSupportMentorId(trainerAssignment?.staff_id || '')
    setDurationMonths(String(batch.duration_months || getDurationFromCourseType(batch.course_type)))
    setStartDate(batch.start_date || '')
    setEndDate(batch.end_date || '')
    setClassDayType(batch.class_day_type || 'weekdays')
    setBatchStartTime(batch.batch_start_time || '07:00')
    setBatchEndTime(batch.batch_end_time || '09:00')
    setMaxSeats(String(batch.max_seats || 20))
    setClassLink(batch.class_link || '')
    // completed/full are auto display states — form only toggles active vs cancelled.
    setStatus(batch.status === 'inactive' ? 'inactive' : 'active')
    setMessage('')
    setError('')
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingBatchId(null)
    setError('')
  }

  const updateCourseType = (selectedCourseType: CourseType) => {
    const durationValue = getDurationFromCourseType(selectedCourseType)
    const firstCourse = courses.find(
      (course) =>
        course.course_type === selectedCourseType &&
        (!departmentId || course.department_id === departmentId),
    )

    setCourseType(selectedCourseType)
    setDurationMonths(String(durationValue))
    setCourseId(firstCourse?.id || '')
    setName(firstCourse ? `${firstCourse.name} Batch` : '')
  }

  const updateDepartment = (selectedDepartmentId: string) => {
    setDepartmentId(selectedDepartmentId)

    const firstCourse = courses.find(
      (course) =>
        course.department_id === selectedDepartmentId && course.course_type === courseType,
    )

    setCourseId(firstCourse?.id || '')
    setName(firstCourse ? `${firstCourse.name} Batch` : '')

    if (firstCourse) {
      setDurationMonths(String(firstCourse.duration_months))
    }
  }

  const updateCourse = (selectedCourseId: string) => {
    const course = courses.find((item) => item.id === selectedCourseId)
    setCourseId(selectedCourseId)

    if (course) {
      setCourseType(course.course_type)
      setDepartmentId(course.department_id)
      setDurationMonths(String(course.duration_months))
      setName(`${course.name} Batch`)
    }
  }

  const handleSubmitBatch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    const isEditing = Boolean(editingBatchId)

    if (isEditing && !canEditBatch) {
      setError('Your current permission cannot edit batches.')
      setLoading(false)
      return
    }

    if (!isEditing && !canCreateBatch) {
      setError('Your current permission cannot create batches.')
      setLoading(false)
      return
    }

    if (!isEditing && !activeBranchId) {
      setError('Select a branch from the header before creating a batch.')
      setLoading(false)
      return
    }

    if (!courseId) {
      setError('Please select course.')
      setLoading(false)
      return
    }

    if (!academicLeadId) {
      setError('Please select HOD.')
      setLoading(false)
      return
    }

    if (!supportMentorId) {
      setError('Please select trainer.')
      setLoading(false)
      return
    }

    if (academicLeadId === supportMentorId) {
      setError('HOD and trainer should be different people.')
      setLoading(false)
      return
    }

    if (!startDate || !endDate) {
      setError('Please select batch start date and end date.')
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

    if (!isEditing) {
      if (!activeBranch?.code) {
        setError('Branch code is missing. Set it on the branch before creating a batch.')
        setLoading(false)
        return
      }

      if (!course.department_code) {
        setError('Department code is missing. Set it on the department before creating a batch.')
        setLoading(false)
        return
      }
    }

    const token = await getAccessToken()
    if (!token) {
      setError('Session expired. Please login again.')
      setLoading(false)
      return
    }

    const payload = {
      name: name.trim() || `${course.name} Batch`,
      description: description.trim(),
      course_id: courseId,
      hod_id: academicLeadId,
      trainer_id: supportMentorId,
      start_date: startDate,
      end_date: endDate,
      batch_mode: fixedMode,
      class_day_type: classDayType,
      batch_start_time: batchStartTime,
      batch_end_time: batchEndTime,
      max_seats: seatCount,
      class_link: classLink,
      status,
    }

    const result = isEditing
      ? await updateBatchAccount(editingBatchId!, payload, token)
      : await createBatchAccount(payload, activeBranchId!, token)

    if (!result.ok) {
      setError(result.error)
      setLoading(false)
      return
    }

    setMessage(
      isEditing
        ? `Batch updated successfully. Batch ID: ${result.batchCode}`
        : `${copy.successPrefix}. Batch ID: ${result.batchCode}`,
    )
    setLoading(false)
    closeModal()
    resetForm()
    await reloadBatches()
  }

  if (!can('batches.view')) {
    return (
      <div className="border border-border bg-transparent p-8">
        <h1 className="text-2xl font-bold">{copy.lockedTitle}</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view batches.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-transparent">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Batch Management</p>
              <h1 className="mt-2 text-3xl font-bold">{copy.pageTitle}</h1>
              <p className="mt-3 max-w-4xl text-muted-foreground">{copy.subtitle}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Branch:{' '}
                <span className="font-semibold text-foreground">
                  {activeBranch?.name || 'Select a branch in the header'}
                  {activeBranch?.code ? ` (${activeBranch.code})` : ''}
                </span>
              </p>
            </div>

            {canManageBatches && (
              <Button
                onClick={openAddModal}
                disabled={!activeBranchId || coursesLoading || departmentsLoading || mentorsLoading}
                className="bg-[#153e90] text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#5dd84a]"
              >
                <CustomIcon icon="patch.svg" folder={iconFolder} alt="Create" className="mr-2 h-4 w-4" />
                {copy.createButton}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {batchesLoadError && (
        <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {batchesLoadError}
        </div>
      )}

      {error && (
        <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {message && (
        <div className="border border-[#153e90]/30 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white">
          {message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="border border-border bg-transparent">
          <CardContent className="p-3">
            <p className="text-sm uppercase text-muted-foreground">{copy.statTotal}</p>
            <p className="mt-3 text-4xl font-bold">{filteredBatches.length}</p>
            <p className="mt-4 text-sm text-muted-foreground">{copy.statTotalHelper}</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-transparent">
          <CardContent className="p-3">
            <p className="text-sm uppercase text-muted-foreground">{copy.statActive}</p>
            <p className="mt-3 text-4xl font-bold">{activeCount}</p>
            <p className="mt-4 text-sm text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-transparent">
          <CardContent className="p-3">
            <p className="text-sm uppercase text-muted-foreground">{copy.statCompleted}</p>
            <p className="mt-3 text-4xl font-bold">{completedCount}</p>
            <p className="mt-4 text-sm text-muted-foreground">Completed batches</p>
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
                <option key={type.value} value={type.value} className={optionClass}>{type.label}</option>
              ))}
            </select>

            <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} className={selectClass}>
              <option value="all" className={optionClass}>All Courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id} className={optionClass}>{course.name}</option>
              ))}
            </select>

            <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} className={selectClass}>
              <option value="all" className={optionClass}>All Assigned Staff</option>
              {staffFilterOptions.map((staff) => (
                <option key={staff.id} value={staff.id} className={optionClass}>{staff.name}</option>
              ))}
            </select>

            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className={selectClass}>
              <option value="all" className={optionClass}>All Years</option>
              {yearOptions.map((year) => (
                <option key={year} value={year} className={optionClass}>{year}</option>
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
              <option value="full" className={optionClass}>Full</option>
              <option value="completed" className={optionClass}>Completed (end date passed)</option>
              <option value="inactive" className={optionClass}>Inactive (Cancelled)</option>
            </select>

            <select value={filterStartTime} onChange={(e) => setFilterStartTime(e.target.value)} className={selectClass}>
              <option value="all" className={optionClass}>All Start Times</option>
              {startTimeOptions.map((time) => (
                <option key={time} value={time} className={optionClass}>{formatTimeLabel(time)}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border bg-transparent">
        <CardHeader>
          <CardTitle>{copy.listTitle}</CardTitle>
        </CardHeader>

        <CardContent>
          {batchesLoading ? (
            <div className="border border-border bg-transparent p-6 text-sm text-muted-foreground">
              Loading batches…
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="border border-border bg-transparent p-6 text-sm text-muted-foreground">
              {copy.emptyList}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBatches.map((batch) => {
                const enrolledCount = batch.enrolled_count || 0
                const maxSeatCount = batch.max_seats || 0
                const displayStatus = batch.status

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
                                : displayStatus === 'full'
                                  ? 'border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-300'
                                  : displayStatus === 'completed'
                                    ? 'border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300'
                                    : 'border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400'
                            }
                          >
                            {displayStatus}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                          <p>
                            <span className="text-muted-foreground">Department:</span>{' '}
                            <span className="font-medium">{batch.department_name}</span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Course:</span>{' '}
                            <span className="font-medium">{batch.course_name}</span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Branch:</span>{' '}
                            <span className="font-medium">{batch.branch_name}</span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Mode:</span>{' '}
                            <span className="font-medium">{copy.modeLabel}</span>
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
                          {fixedMode === 'online' && (
                            <p className="min-w-0 sm:col-span-2 xl:col-span-4">
                              <span className="text-muted-foreground">Online Link:</span>{' '}
                              {batch.class_link ? (
                                <a
                                  href={batch.class_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="break-all font-medium text-[#153e90] underline-offset-2 hover:underline dark:text-[#6ee75a]"
                                >
                                  {batch.class_link}
                                </a>
                              ) : (
                                <span className="font-medium">Not added yet</span>
                              )}
                            </p>
                          )}
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
                          <Button type="button" onClick={() => openEditModal(batch)}>
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
                <h2 className="text-2xl font-bold">
                  {editingBatchId ? `Edit ${copy.modeLabel} Batch` : copy.createModalTitle}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {editingBatchId
                    ? 'Update batch details, schedule, seats, and HOD/trainer assignments.'
                    : copy.createModalSubtitle}
                </p>
              </div>
              <button type="button" onClick={closeModal} className="border border-border px-3 py-2 text-sm">
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
                  <label className="mb-2 block text-sm font-medium">Department</label>
                  <select value={departmentId} onChange={(e) => updateDepartment(e.target.value)} className={selectClass} required>
                    <option value="" className={optionClass}>Select department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id} className={optionClass}>
                        {department.name}
                        {department.department_code ? ` (${department.department_code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Course</label>
                  <select value={courseId} onChange={(e) => updateCourse(e.target.value)} className={selectClass} required>
                    <option value="" className={optionClass}>Select course</option>
                    {filteredCoursesByType.map((course) => (
                      <option key={course.id} value={course.id} className={optionClass}>{course.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">HOD</label>
                  <select value={academicLeadId} onChange={(e) => setAcademicLeadId(e.target.value)} className={selectClass} required>
                    <option value="" className={optionClass}>
                      {departmentId
                        ? hodOptions.length
                          ? 'Select HOD'
                          : 'No HOD in this department'
                        : 'Select department first'}
                    </option>
                    {hodOptions.map((staff) => (
                      <option key={staff.id} value={staff.id} className={optionClass}>{staff.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Trainer</label>
                  <select value={supportMentorId} onChange={(e) => setSupportMentorId(e.target.value)} className={selectClass} required>
                    <option value="" className={optionClass}>
                      {departmentId
                        ? trainerOptions.length
                          ? 'Select trainer'
                          : 'No trainer in this department'
                        : 'Select department first'}
                    </option>
                    {trainerOptions.map((staff) => (
                      <option key={staff.id} value={staff.id} className={optionClass}>{staff.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Mode</label>
                  <input value={copy.modeLabel} className={inputClass} readOnly />
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
                    <option value="inactive" className={optionClass}>Inactive (Cancelled)</option>
                  </select>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Active keeps student access. Inactive cancels the batch and blocks notes/tasks.
                    Full and Completed badges appear automatically from seats and end date.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Batch Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder={copy.namePlaceholder} required />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={textareaClass} placeholder={copy.descriptionPlaceholder} rows={3} />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Batch Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} required />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Batch End Date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} required />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Batch Code Preview</label>
                  <input value={batchCodePreview || 'Select course and start date'} className={inputClass} readOnly />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Format: branch + department + ON/OS + MMYY + B series.
                    Branch: {activeBranch?.code || '—'} · Department: {selectedCourse?.department_name || '—'} ({selectedCourse?.department_code || '—'})
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Class Days</label>
                  <select value={classDayType} onChange={(e) => setClassDayType(e.target.value as ClassDayType)} className={selectClass} required>
                    {classDayOptions.map((item) => (
                      <option key={item.value} value={item.value} className={optionClass}>{item.label}</option>
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

                {fixedMode === 'online' && (
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium">Online Class Link</label>
                    <input value={classLink} onChange={(e) => setClassLink(e.target.value)} className={inputClass} placeholder="Zoom / Google Meet link" />
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
                <Button type="submit" disabled={loading} className="bg-[#153e90] text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#5dd84a]">
                  {loading
                    ? editingBatchId
                      ? 'Updating...'
                      : 'Creating...'
                    : editingBatchId
                      ? 'Update Batch'
                      : copy.createSubmit}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
