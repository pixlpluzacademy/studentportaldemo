'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  Save,
  Search,
  XCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Role } from '@/lib/types'

type Profile = {
  id: string
  full_name: string
  email: string
  role: Role
}

type Cohort = {
  id: string
  name: string
  cohort_code: string | null
}

type Mentor = {
  id: string
  profile_id: string
  department: string | null
  profiles?: {
    full_name: string
    email: string
  } | null
}

type Student = {
  id: string
  profile_id: string
  cohort_id: string
  student_code: string
  phone: string | null
  status: string
  profile_picture_url: string | null
  profiles: {
    full_name: string
    email: string
  } | null
}

type AttendanceStatus = 'present' | 'late' | 'absent'

type AttendanceDraft = {
  student_id: string
  status: AttendanceStatus
  notes: string
}

type AttendanceRecord = {
  id: string
  student_id: string
  mentor_id: string
  cohort_id: string
  attendance_date: string
  status: AttendanceStatus
  notes: string | null
  mentors?: {
    id: string
    profiles: {
      full_name: string
      email: string
    } | null
  } | null
}

const statusStyle: Record<AttendanceStatus, string> = {
  present: 'border-green-500/20 bg-green-500/10 text-green-500',
  late: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-500',
  absent: 'border-red-500/20 bg-red-500/10 text-red-500',
}

export function AttendanceManager() {
  const today = new Date().toISOString().split('T')[0]

  const [profile, setProfile] = useState<Profile | null>(null)
  const [mentor, setMentor] = useState<Mentor | null>(null)

  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [assignedMentors, setAssignedMentors] = useState<Mentor[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [existingAttendance, setExistingAttendance] = useState<AttendanceRecord[]>([])

  const [selectedCohortId, setSelectedCohortId] = useState('')
  const [selectedMentorId, setSelectedMentorId] = useState('')
  const [attendanceDate, setAttendanceDate] = useState(today)
  const [search, setSearch] = useState('')
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft>>({})

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const isAdmin = profile?.role === 'admin'
  const isMentor = profile?.role === 'mentor'

  const fetchInitialData = async () => {
    setLoading(true)
    setError('')

    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      setError('User not logged in.')
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', userData.user.id)
      .single()

    if (profileError || !profileData) {
      setError('Profile not found.')
      setLoading(false)
      return
    }

    const currentProfile = profileData as Profile
    setProfile(currentProfile)

    if (currentProfile.role === 'mentor') {
      const { data: mentorData, error: mentorError } = await supabase
        .from('mentors')
        .select('id, profile_id, department')
        .eq('profile_id', currentProfile.id)
        .single()

      if (mentorError || !mentorData) {
        setError('Mentor record not found.')
        setLoading(false)
        return
      }

      const currentMentor = mentorData as Mentor
      setMentor(currentMentor)
      setSelectedMentorId(currentMentor.id)

      const { data: assignedCohorts, error: assignedError } = await supabase
        .from('cohort_mentors')
        .select(`
          cohorts (
            id,
            name,
            cohort_code
          )
        `)
        .eq('mentor_id', currentMentor.id)

      if (assignedError) {
        setError(assignedError.message)
        setLoading(false)
        return
      }

      const realCohorts =
        assignedCohorts
          ?.map((item: any) => item.cohorts)
          .filter(Boolean) || []

      setCohorts(realCohorts)

      if (realCohorts.length > 0) {
        setSelectedCohortId(realCohorts[0].id)
      }
    }

    if (currentProfile.role === 'admin') {
      const { data: cohortData, error: cohortError } = await supabase
        .from('cohorts')
        .select('id, name, cohort_code')
        .order('created_at', { ascending: false })

      if (cohortError) {
        setError(cohortError.message)
        setLoading(false)
        return
      }

      setCohorts((cohortData || []) as Cohort[])

      if (cohortData && cohortData.length > 0) {
        setSelectedCohortId(cohortData[0].id)
      }
    }

    setLoading(false)
  }

  const fetchAssignedMentorsForCohort = async () => {
    if (!selectedCohortId) {
      setAssignedMentors([])
      setSelectedMentorId('')
      return
    }

    if (isMentor && mentor) {
      setAssignedMentors([mentor])
      setSelectedMentorId(mentor.id)
      return
    }

    if (isAdmin) {
      const { data, error } = await supabase
        .from('cohort_mentors')
        .select(`
          mentors (
            id,
            profile_id,
            department,
            profiles (
              full_name,
              email
            )
          )
        `)
        .eq('cohort_id', selectedCohortId)

      if (error) {
        setError(error.message)
        return
      }

      const realMentors =
        data?.map((item: any) => item.mentors).filter(Boolean) || []

      setAssignedMentors(realMentors)

      if (realMentors.length > 0) {
        setSelectedMentorId(realMentors[0].id)
      } else {
        setSelectedMentorId('')
      }
    }
  }

  const fetchStudentsAndAttendance = async () => {
    if (!selectedCohortId) {
      setStudents([])
      setExistingAttendance([])
      setDrafts({})
      return
    }

    setError('')

    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select(`
        id,
        profile_id,
        cohort_id,
        student_code,
        phone,
        status,
        profile_picture_url,
        profiles (
          full_name,
          email
        )
      `)
      .eq('cohort_id', selectedCohortId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (studentError) {
      setError(studentError.message)
      return
    }

    const currentStudents = (studentData || []) as Student[]
    setStudents(currentStudents)

    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .select(`
        id,
        student_id,
        mentor_id,
        cohort_id,
        attendance_date,
        status,
        notes,
        mentors (
          id,
          profiles (
            full_name,
            email
          )
        )
      `)
      .eq('cohort_id', selectedCohortId)
      .eq('attendance_date', attendanceDate)

    if (attendanceError) {
      setError(attendanceError.message)
      return
    }

    const currentAttendance = (attendanceData || []) as AttendanceRecord[]
    setExistingAttendance(currentAttendance)

    const nextDrafts: Record<string, AttendanceDraft> = {}

    currentStudents.forEach((student) => {
      const existing = currentAttendance.find(
        (item) => item.student_id === student.id
      )

      nextDrafts[student.id] = {
        student_id: student.id,
        status: existing?.status || 'present',
        notes: existing?.notes || '',
      }
    })

    setDrafts(nextDrafts)
  }

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    fetchAssignedMentorsForCohort()
  }, [selectedCohortId, profile, mentor])

  useEffect(() => {
    fetchStudentsAndAttendance()
  }, [selectedCohortId, attendanceDate])

  const filteredStudents = useMemo(() => {
    const keyword = search.toLowerCase()

    return students.filter((student) => {
      const name = student.profiles?.full_name?.toLowerCase() || ''
      const email = student.profiles?.email?.toLowerCase() || ''
      const code = student.student_code?.toLowerCase() || ''

      return (
        name.includes(keyword) ||
        email.includes(keyword) ||
        code.includes(keyword)
      )
    })
  }, [students, search])

  const attendanceSummary = useMemo(() => {
    const source = isAdmin ? existingAttendance : Object.values(drafts)

    return {
      total: isAdmin ? students.length : source.length,
      present: source.filter((item) => item.status === 'present').length,
      late: source.filter((item) => item.status === 'late').length,
      absent: source.filter((item) => item.status === 'absent').length,
    }
  }, [drafts, existingAttendance, students.length, isAdmin])

  const selectedCohort = cohorts.find((cohort) => cohort.id === selectedCohortId)

  const selectedMentorNames =
    assignedMentors.length > 0
      ? assignedMentors
          .map((item) => item.profiles?.full_name || 'Mentor')
          .join(', ')
      : 'No mentor assigned'

  const updateDraftStatus = (studentId: string, status: AttendanceStatus) => {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        student_id: studentId,
        status,
      },
    }))
  }

  const updateDraftNotes = (studentId: string, notes: string) => {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        student_id: studentId,
        notes,
      },
    }))
  }

  const markAll = (status: AttendanceStatus) => {
    if (isAdmin) return

    const nextDrafts: Record<string, AttendanceDraft> = {}

    students.forEach((student) => {
      nextDrafts[student.id] = {
        student_id: student.id,
        status,
        notes: drafts[student.id]?.notes || '',
      }
    })

    setDrafts(nextDrafts)
  }

  const handleSaveAttendance = async () => {
    if (isAdmin) return

    setSaving(true)
    setMessage('')
    setError('')

    if (!selectedCohortId) {
      setError('Please select a cohort.')
      setSaving(false)
      return
    }

    if (!selectedMentorId) {
      setError('Mentor not found for this cohort.')
      setSaving(false)
      return
    }

    const rows = Object.values(drafts).map((draft) => ({
      student_id: draft.student_id,
      mentor_id: selectedMentorId,
      cohort_id: selectedCohortId,
      attendance_date: attendanceDate,
      status: draft.status,
      notes: draft.notes || null,
    }))

    if (rows.length === 0) {
      setError('No students found for this cohort.')
      setSaving(false)
      return
    }

    const { error: upsertError } = await supabase.from('attendance').upsert(rows, {
      onConflict: 'student_id,attendance_date',
    })

    if (upsertError) {
      setError(upsertError.message)
      setSaving(false)
      return
    }

    setMessage('Attendance saved successfully.')
    setSaving(false)
    fetchStudentsAndAttendance()
  }

  const getExistingRecord = (studentId: string) => {
    return existingAttendance.find((item) => item.student_id === studentId)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Attendance Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Loading attendance setup...
          </p>
        </CardContent>
      </Card>
    )
  }

  if (profile?.role === 'student') {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5" />
              {isAdmin ? 'Attendance Overview' : 'Attendance Manager'}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin
                ? 'View attendance status and notes by cohort and date.'
                : 'Mark attendance for students by cohort and date.'}
            </p>
          </div>

          {isMentor && (
            <Button onClick={handleSaveAttendance} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Attendance'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {message && (
          <p className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-500">
            {message}
          </p>
        )}

        {error && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-sm font-medium">Cohort</label>
            <Select value={selectedCohortId} onValueChange={setSelectedCohortId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select cohort" />
              </SelectTrigger>
              <SelectContent>
                {cohorts.map((cohort) => (
                  <SelectItem key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Mentor</label>
            <div className="mt-2 flex min-h-10 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
              {selectedMentorNames}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Search</label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students..."
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Students</p>
            <p className="mt-1 text-2xl font-semibold">
              {attendanceSummary.total}
            </p>
          </div>

          <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
            <p className="text-xs text-muted-foreground">Present</p>
            <p className="mt-1 text-2xl font-semibold text-green-500">
              {attendanceSummary.present}
            </p>
          </div>

          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
            <p className="text-xs text-muted-foreground">Late</p>
            <p className="mt-1 text-2xl font-semibold text-yellow-500">
              {attendanceSummary.late}
            </p>
          </div>

          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-xs text-muted-foreground">Absent</p>
            <p className="mt-1 text-2xl font-semibold text-red-500">
              {attendanceSummary.absent}
            </p>
          </div>
        </div>

        {isMentor && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {selectedCohort?.name || 'No cohort selected'}
            </Badge>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => markAll('present')}
            >
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
              Mark All Present
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => markAll('late')}
            >
              <Clock className="mr-2 h-4 w-4 text-yellow-500" />
              Mark All Late
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => markAll('absent')}
            >
              <XCircle className="mr-2 h-4 w-4 text-red-500" />
              Mark All Absent
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-3 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <span className="col-span-4">Student</span>
            <span className="col-span-2">Student Code</span>
            <span className="col-span-3">Status</span>
            <span className="col-span-3">Notes</span>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
              No students found for this cohort.
            </div>
          ) : (
            filteredStudents.map((student) => {
              const studentName = student.profiles?.full_name || 'No name'
              const initials = studentName
                .split(' ')
                .map((item) => item[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()

              const draft = drafts[student.id]
              const existing = getExistingRecord(student.id)
              const displayStatus = isAdmin
                ? existing?.status
                : draft?.status || 'present'

              return (
                <div
                  key={student.id}
                  className="grid grid-cols-12 gap-3 items-center rounded-lg border px-3 py-3"
                >
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={student.profile_picture_url || ''} />
                      <AvatarFallback className="text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {studentName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {student.profiles?.email || 'No email'}
                      </p>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <p className="text-sm">{student.student_code}</p>
                  </div>

                  <div className="col-span-3">
                    {isAdmin ? (
                      displayStatus ? (
                        <Badge
                          variant="outline"
                          className={statusStyle[displayStatus]}
                        >
                          {displayStatus}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not marked</Badge>
                      )
                    ) : (
                      <Select
                        value={draft?.status || 'present'}
                        onValueChange={(value) =>
                          updateDraftStatus(
                            student.id,
                            value as AttendanceStatus
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="late">Late</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="col-span-3">
                    {isAdmin ? (
                      <p className="text-sm text-muted-foreground">
                        {existing?.notes || 'No notes'}
                      </p>
                    ) : (
                      <Input
                        value={draft?.notes || ''}
                        onChange={(e) =>
                          updateDraftNotes(student.id, e.target.value)
                        }
                        placeholder="Optional notes"
                      />
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}