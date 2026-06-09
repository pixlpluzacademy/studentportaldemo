'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CalendarCheck, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Role } from '@/lib/types'

type Profile = {
  id: string
  full_name: string
  email: string
  role: Role
}

type StudentRow = {
  id: string
  profile_id: string
  cohort_id: string
}

type MentorRow = {
  id: string
  profile_id: string
}

type AttendanceRow = {
  id: string
  student_id: string
  mentor_id: string
  cohort_id: string
  attendance_date: string
  status: 'present' | 'late' | 'absent'
  notes: string | null
  created_at: string
}

export function AttendanceCard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [records, setRecords] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAttendance = async () => {
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

    if (currentProfile.role === 'student') {
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, profile_id, cohort_id')
        .eq('profile_id', currentProfile.id)
        .single()

      if (studentError || !studentData) {
        setRecords([])
        setLoading(false)
        return
      }

      const student = studentData as StudentRow

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', student.id)
        .order('attendance_date', { ascending: false })

      if (attendanceError) {
        setError(attendanceError.message)
        setLoading(false)
        return
      }

      setRecords((attendanceData || []) as AttendanceRow[])
    }

    if (currentProfile.role === 'mentor') {
      const { data: mentorData, error: mentorError } = await supabase
        .from('mentors')
        .select('id, profile_id')
        .eq('profile_id', currentProfile.id)
        .single()

      if (mentorError || !mentorData) {
        setRecords([])
        setLoading(false)
        return
      }

      const mentor = mentorData as MentorRow

      const { data: cohortMentors } = await supabase
        .from('cohort_mentors')
        .select('cohort_id')
        .eq('mentor_id', mentor.id)

      const cohortIds = (cohortMentors || []).map((item) => item.cohort_id)

      if (cohortIds.length === 0) {
        setRecords([])
        setLoading(false)
        return
      }

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .in('cohort_id', cohortIds)
        .order('attendance_date', { ascending: false })

      if (attendanceError) {
        setError(attendanceError.message)
        setLoading(false)
        return
      }

      setRecords((attendanceData || []) as AttendanceRow[])
    }

    if (currentProfile.role === 'admin') {
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .order('attendance_date', { ascending: false })

      if (attendanceError) {
        setError(attendanceError.message)
        setLoading(false)
        return
      }

      setRecords((attendanceData || []) as AttendanceRow[])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchAttendance()
  }, [])

  const stats = useMemo(() => {
    const total = records.length
    const present = records.filter((item) => item.status === 'present').length
    const late = records.filter((item) => item.status === 'late').length
    const absent = records.filter((item) => item.status === 'absent').length
    const attended = present + late
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0

    return {
      total,
      present,
      late,
      absent,
      rate,
    }
  }, [records])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading attendance...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5" />
          Attendance Progress
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {profile?.role === 'student'
                ? 'Your attendance rate'
                : 'Overall attendance rate'}
            </p>

            <p className="text-sm font-semibold">{stats.rate}%</p>
          </div>

          <Progress value={stats.rate} />

          <p className="mt-2 text-xs text-muted-foreground">
            Minimum required attendance is 75%.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-1 flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <p className="text-xl font-semibold">{stats.total}</p>
          </div>

          <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
            <div className="mb-1 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Present</p>
            </div>
            <p className="text-xl font-semibold text-green-500">
              {stats.present}
            </p>
          </div>

          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
            <div className="mb-1 flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <p className="text-xs text-muted-foreground">Late</p>
            </div>
            <p className="text-xl font-semibold text-yellow-500">{stats.late}</p>
          </div>

          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <div className="mb-1 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <p className="text-xs text-muted-foreground">Absent</p>
            </div>
            <p className="text-xl font-semibold text-red-500">{stats.absent}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Recent Attendance</p>

          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No attendance records found.
            </p>
          ) : (
            records.slice(0, 5).map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {record.attendance_date}
                  </p>
                  {record.notes && (
                    <p className="text-xs text-muted-foreground">
                      {record.notes}
                    </p>
                  )}
                </div>

                <Badge
                  variant="outline"
                  className={
                    record.status === 'present'
                      ? 'border-green-500/20 bg-green-500/10 text-green-500'
                      : record.status === 'late'
                        ? 'border-yellow-500/20 bg-yellow-500/10 text-yellow-500'
                        : 'border-red-500/20 bg-red-500/10 text-red-500'
                  }
                >
                  {record.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}