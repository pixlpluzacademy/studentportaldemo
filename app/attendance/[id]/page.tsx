'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { Role } from '@/lib/types'
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock,
  User,
  XCircle,
} from 'lucide-react'

type Profile = {
  id: string
  role: Role
}

type Student = {
  id: string
  profile_id: string
  cohort_id: string
  student_code: string
  status: string
  profile_picture_url: string | null
  profiles: {
    full_name: string
    email: string
  } | null
  cohorts: {
    name: string
    cohort_code: string | null
  } | null
}

type AttendanceRecord = {
  id: string
  attendance_date: string
  status: 'present' | 'late' | 'absent'
  notes: string | null
mentors: {
  id: string
  profiles: {
    full_name: string
    email: string
  } | null
} | null
}

type CalendarAttendanceRow = {
  date: string
  record: AttendanceRecord | null
}

const statusStyle = {
  present: 'border-green-500/20 bg-green-500/10 text-green-500',
  late: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-500',
  absent: 'border-red-500/20 bg-red-500/10 text-red-500',
}

const getCurrentMonth = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}`
}

const formatMonthLabel = (monthValue: string) => {
  if (!monthValue) return 'Selected Month'

  return new Date(`${monthValue}-01`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

const getAllDatesInMonth = (monthValue: string) => {
  if (!monthValue) return []

  const [yearString, monthString] = monthValue.split('-')
  const year = Number(yearString)
  const month = Number(monthString)

  const daysInMonth = new Date(year, month, 0).getDate()

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, '0')
    return `${monthValue}-${day}`
  })
}

export default function AttendanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [student, setStudent] = useState<Student | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const checkAccess = async (currentProfile: Profile, studentData: Student) => {
    if (currentProfile.role === 'admin') {
      return true
    }

    if (currentProfile.role === 'student') {
      return studentData.profile_id === currentProfile.id
    }

    if (currentProfile.role === 'mentor') {
      const { data: mentorData } = await supabase
        .from('mentors')
        .select('id')
        .eq('profile_id', currentProfile.id)
        .single()

      if (!mentorData) {
        return false
      }

      const { data: assignedCohort } = await supabase
        .from('cohort_mentors')
        .select('cohort_id')
        .eq('mentor_id', mentorData.id)
        .eq('cohort_id', studentData.cohort_id)
        .maybeSingle()

      return !!assignedCohort
    }

    return false
  }

  const fetchStudentAttendance = async () => {
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
      .select('id, role')
      .eq('id', userData.user.id)
      .single()

    if (profileError || !profileData) {
      setError('Profile not found.')
      setLoading(false)
      return
    }

    const currentProfile = profileData as Profile
    setProfile(currentProfile)

    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select(`
        id,
        profile_id,
        cohort_id,
        student_code,
        status,
        profile_picture_url,
        profiles (
          full_name,
          email
        ),
        cohorts (
          name,
          cohort_code
        )
      `)
      .eq('id', id)
      .single()

    if (studentError || !studentData) {
      setError('Student not found.')
      setLoading(false)
      return
    }

    const currentStudent = studentData as Student
    const hasAccess = await checkAccess(currentProfile, currentStudent)

    if (!hasAccess) {
      setError('You do not have permission to view this attendance.')
      setLoading(false)
      return
    }

const { data: attendanceData, error: attendanceError } = await supabase
  .from('attendance')
  .select(`
    id,
    attendance_date,
    status,
    notes,
    mentors!attendance_mentor_id_fkey (
      id,
      profiles (
        full_name,
        email
      )
    )
  `)
  .eq('student_id', id)
  .order('attendance_date', { ascending: false })

    if (attendanceError) {
      setError(attendanceError.message)
      setLoading(false)
      return
    }

    const realRecords = (attendanceData || []) as AttendanceRecord[]

    setStudent(currentStudent)
    setRecords(realRecords)

    if (realRecords.length > 0) {
      setSelectedMonth(realRecords[0].attendance_date.slice(0, 7))
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchStudentAttendance()
  }, [id])

  const filteredRecords = useMemo(() => {
    return records.filter((record) =>
      record.attendance_date.startsWith(selectedMonth)
    )
  }, [records, selectedMonth])

  const calendarRows = useMemo<CalendarAttendanceRow[]>(() => {
    const dates = getAllDatesInMonth(selectedMonth)

    return dates.map((date) => {
      const record =
        records.find((attendance) => attendance.attendance_date === date) || null

      return {
        date,
        record,
      }
    })
  }, [records, selectedMonth])

  const overallStats = useMemo(() => {
    const total = records.length
    const present = records.filter((record) => record.status === 'present').length
    const late = records.filter((record) => record.status === 'late').length
    const absent = records.filter((record) => record.status === 'absent').length
    const attended = present + late
    const attendanceRate =
      total > 0 ? Math.round((attended / total) * 100) : 0

    return {
      total,
      present,
      late,
      absent,
      attendanceRate,
      eligible: attendanceRate >= 75,
    }
  }, [records])

  const monthStats = useMemo(() => {
    const total = filteredRecords.length
    const present = filteredRecords.filter(
      (record) => record.status === 'present'
    ).length
    const late = filteredRecords.filter((record) => record.status === 'late')
      .length
    const absent = filteredRecords.filter((record) => record.status === 'absent')
      .length
    const attended = present + late
    const attendanceRate =
      total > 0 ? Math.round((attended / total) * 100) : 0

    return {
      total,
      present,
      late,
      absent,
      attendanceRate,
      eligible: attendanceRate >= 75,
    }
  }, [filteredRecords])

  if (loading) {
    return (
      <AppShell>
        <div className="py-16 text-center text-sm text-muted-foreground">
          Loading attendance details...
        </div>
      </AppShell>
    )
  }

  if (error || !student) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <p className="text-sm text-red-500">{error || 'Student not found.'}</p>
          <Button asChild variant="outline">
            <Link href="/attendance">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Attendance
            </Link>
          </Button>
        </div>
      </AppShell>
    )
  }

  const name = student.profiles?.full_name || 'No name'
  const initials = name
    .split(' ')
    .map((item) => item[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-5xl">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/attendance">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Attendance
            </Link>
          </Button>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={student.profile_picture_url || ''} />
              <AvatarFallback className="text-xl">
                {initials || <User className="h-6 w-6" />}
              </AvatarFallback>
            </Avatar>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">{name}</h1>

                <Badge variant="secondary">
                  {student.cohorts?.name || 'No cohort'}
                </Badge>

                <Badge variant="outline">{student.student_code}</Badge>

                <Badge
                  variant="outline"
                  className={
                    overallStats.eligible
                      ? 'border-green-500/20 bg-green-500/10 text-green-500'
                      : 'border-yellow-500/20 bg-yellow-500/10 text-yellow-500'
                  }
                >
                  {overallStats.eligible ? 'Eligible' : 'Not Eligible'}
                </Badge>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                {student.profiles?.email || 'No email'}
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Cohort Code: {student.cohorts?.cohort_code || 'No code'}
              </p>
            </div>
          </div>

          <div className="w-full lg:w-64">
            <label className="text-sm font-medium">Select Month & Year</label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="mt-2"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>Overall Course Attendance</span>
              <Badge
                variant="outline"
                className={
                  overallStats.eligible
                    ? 'border-green-500/20 bg-green-500/10 text-green-500'
                    : 'border-yellow-500/20 bg-yellow-500/10 text-yellow-500'
                }
              >
                {overallStats.attendanceRate}%
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent>
            <Progress value={overallStats.attendanceRate} />

            <div className="mt-3 grid grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Total Marked</p>
                <p className="font-semibold">{overallStats.total}</p>
              </div>

              <div>
                <p className="text-muted-foreground">Present</p>
                <p className="font-semibold text-green-500">
                  {overallStats.present}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Late</p>
                <p className="font-semibold text-yellow-500">
                  {overallStats.late}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Absent</p>
                <p className="font-semibold text-red-500">
                  {overallStats.absent}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">
                {formatMonthLabel(selectedMonth)}
              </p>

              <p
                className={cn(
                  'mt-1 text-2xl font-bold',
                  monthStats.attendanceRate >= 75
                    ? 'text-green-500'
                    : 'text-yellow-500'
                )}
              >
                {monthStats.attendanceRate}%
              </p>

              <Progress value={monthStats.attendanceRate} className="mt-3" />

              <p className="mt-2 text-xs text-muted-foreground">
                Based on marked records only
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <p className="text-xs text-muted-foreground">Present</p>
              </div>
              <p className="mt-1 text-2xl font-bold text-green-500">
                {monthStats.present}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <p className="text-xs text-muted-foreground">Late</p>
              </div>
              <p className="mt-1 text-2xl font-bold text-yellow-500">
                {monthStats.late}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
              <p className="mt-1 text-2xl font-bold text-red-500">
                {monthStats.absent}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5" />
              All Dates in {formatMonthLabel(selectedMonth)}
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-3 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span className="col-span-3">Date</span>
                <span className="col-span-2">Status</span>
                <span className="col-span-3">Marked By</span>
                <span className="col-span-4">Notes</span>
              </div>

              {calendarRows.map((row) => (
                <div
                  key={row.date}
                  className={cn(
                    'grid grid-cols-12 gap-3 items-center rounded-lg border px-3 py-3',
                    !row.record && 'bg-muted/20'
                  )}
                >
                  <div className="col-span-3 text-sm font-medium">
                    {row.date}
                  </div>

                  <div className="col-span-2">
                    {row.record ? (
                      <Badge
                        variant="outline"
                        className={statusStyle[row.record.status]}
                      >
                        {row.record.status}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        No recorded data
                      </Badge>
                    )}
                  </div>

                  <div className="col-span-3 text-sm text-muted-foreground">
                    {row.record?.mentors?.profiles?.full_name || '—'}
                  </div>

                  <div className="col-span-4 text-sm text-muted-foreground">
                    {row.record?.notes || '—'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}