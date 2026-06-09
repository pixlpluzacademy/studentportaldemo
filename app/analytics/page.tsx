'use client'

import { AppShell } from '@/components/app-shell'
import { useData } from '@/lib/data-context'
import { useApp } from '@/lib/app-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, TrendingDown, Users, FolderKanban, ListTodo, FileText, Award, Clock, CalendarCheck, AlertTriangle } from 'lucide-react'
import { useMemo } from 'react'
import { getAttendanceRate } from '@/lib/attendance-data'
import { cn } from '@/lib/utils'

export default function AnalyticsPage() {
  const { students, projects, tasks, submissions, reviews, cohorts, attendanceRecords, sessions } = useData()
  const { currentRole } = useApp()

  const analytics = useMemo(() => {
    // Overall stats
    const totalStudents = students.length
    const totalProjects = projects.length
    const totalTasks = tasks.length
    const totalSubmissions = submissions.length

    // Completion rates
    const completedProjects = projects.filter(p => p.status === 'completed').length
    const completedTasks = tasks.filter(t => t.status === 'completed').length
    const approvedSubmissions = submissions.filter(s => s.status === 'approved').length

    const projectCompletionRate = totalProjects > 0 
      ? Math.round((completedProjects / totalProjects) * 100) 
      : 0
    const taskCompletionRate = totalTasks > 0 
      ? Math.round((completedTasks / totalTasks) * 100) 
      : 0
    const approvalRate = totalSubmissions > 0 
      ? Math.round((approvedSubmissions / totalSubmissions) * 100) 
      : 0

    // Average ratings
    const ratingsWithScores = reviews.filter(r => r.rating && r.rating > 0)
    const avgRating = ratingsWithScores.length > 0
      ? (ratingsWithScores.reduce((sum, r) => sum + (r.rating || 0), 0) / ratingsWithScores.length).toFixed(1)
      : '0.0'

    // Active students (have submissions in last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const activeStudents = new Set(
      submissions
        .filter(s => new Date(s.submittedAt) >= thirtyDaysAgo)
        .map(s => s.studentId)
    ).size

    // Pending reviews
    const pendingReviews = submissions.filter(s => s.status === 'pending').length

    return {
      totalStudents,
      totalProjects,
      totalTasks,
      totalSubmissions,
      completedProjects,
      completedTasks,
      approvedSubmissions,
      projectCompletionRate,
      taskCompletionRate,
      approvalRate,
      avgRating,
      activeStudents,
      pendingReviews
    }
  }, [students, projects, tasks, submissions, reviews])

  // Cohort breakdown
  const cohortStats = useMemo(() => {
    return cohorts.map(cohort => {
      const cohortStudents = students.filter(s => s.cohortId === cohort.id)
      const cohortProjects = projects.filter(p => 
        p.studentIds.some(sid => cohortStudents.some(s => s.id === sid))
      )
      const completedProjects = cohortProjects.filter(p => p.status === 'completed').length
      
      return {
        ...cohort,
        studentCount: cohortStudents.length,
        projectCount: cohortProjects.length,
        completedProjects,
        completionRate: cohortProjects.length > 0 
          ? Math.round((completedProjects / cohortProjects.length) * 100)
          : 0
      }
    })
  }, [cohorts, students, projects])

  // Attendance analytics
  const attendanceStats = useMemo(() => {
    // Per-cohort attendance rate
    const cohortAttendance = cohorts.map(cohort => {
      const cohortStudents = students.filter(s => s.cohortId === cohort.id)
      const rates = cohortStudents.map(s => getAttendanceRate(s.id, attendanceRecords))
      const avgRate = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0
      const belowThreshold = rates.filter(r => r < 75).length
      return { cohortId: cohort.id, cohortName: cohort.name, avgRate, studentCount: cohortStudents.length, belowThreshold }
    })

    // Top absentees (students with lowest attendance across all cohorts)
    const allStudentRates = students.map(s => ({
      student: s,
      rate: getAttendanceRate(s.id, attendanceRecords),
      absentCount: attendanceRecords.filter(r => r.studentId === s.id && r.status === 'absent').length,
    })).sort((a, b) => a.rate - b.rate)

    const topAbsentees = allStudentRates.slice(0, 8)

    // Weekly trend — group sessions by week, compute avg attendance rate for that week across all students
    const sessionsByWeek: Record<string, string[]> = {}
    sessions.forEach(s => {
      const weekKey = s.date.slice(0, 7) // YYYY-MM
      if (!sessionsByWeek[weekKey]) sessionsByWeek[weekKey] = []
      sessionsByWeek[weekKey].push(s.id)
    })

    const weeklyTrend = Object.entries(sessionsByWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, sIds]) => {
        const relevantRecords = attendanceRecords.filter(r => sIds.includes(r.sessionId))
        const attended = relevantRecords.filter(r => r.status !== 'absent').length
        const rate = relevantRecords.length > 0 ? Math.round((attended / relevantRecords.length) * 100) : 0
        return { month, rate, total: relevantRecords.length }
      })

    return { cohortAttendance, topAbsentees, weeklyTrend }
  }, [cohorts, students, attendanceRecords, sessions])

  if (currentRole === 'student') {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium">Analytics not available</p>
          <p className="text-sm text-muted-foreground mt-2">
            This page is only accessible to mentors and admins
          </p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Program insights and performance metrics
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Active Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{analytics.activeStudents}</div>
              <p className="text-xs text-muted-foreground mt-1">
                of {analytics.totalStudents} total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FolderKanban className="h-4 w-4" />
                Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{analytics.completedProjects}/{analytics.totalProjects}</div>
              <div className="flex items-center gap-1 text-xs mt-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-green-500 font-medium">{analytics.projectCompletionRate}%</span>
                <span className="text-muted-foreground">completion</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ListTodo className="h-4 w-4" />
                Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{analytics.completedTasks}/{analytics.totalTasks}</div>
              <div className="flex items-center gap-1 text-xs mt-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-green-500 font-medium">{analytics.taskCompletionRate}%</span>
                <span className="text-muted-foreground">completion</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Submissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{analytics.approvedSubmissions}/{analytics.totalSubmissions}</div>
              <div className="flex items-center gap-1 text-xs mt-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-green-500 font-medium">{analytics.approvalRate}%</span>
                <span className="text-muted-foreground">approved</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Award className="h-4 w-4" />
                Average Rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{analytics.avgRating}/5.0</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all submissions
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-amber-500">{analytics.pendingReviews}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Awaiting feedback
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Active Cohorts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{cohorts.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Running programs
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Cohort Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Cohort Performance</CardTitle>
            <CardDescription>Compare metrics across all cohorts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {cohortStats.map(cohort => (
                <div key={cohort.id} className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{cohort.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {cohort.studentCount} students
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {cohort.completedProjects}/{cohort.projectCount} projects
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${cohort.completionRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right min-w-[60px]">
                    <div className="text-lg font-semibold">{cohort.completionRate}%</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Attendance Section ──────────────────────────────────── */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Attendance — Kochi Campus
          </h2>

          {/* Cohort attendance rates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {attendanceStats.cohortAttendance.map(ca => (
              <Card key={ca.cohortId}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{ca.cohortName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    'text-2xl font-semibold',
                    ca.avgRate >= 75 ? 'text-green-400' : 'text-red-400',
                  )}>
                    {ca.avgRate}%
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full mt-2 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', ca.avgRate >= 75 ? 'bg-green-500' : 'bg-red-500')}
                      style={{ width: `${ca.avgRate}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {ca.belowThreshold} student{ca.belowThreshold !== 1 ? 's' : ''} below 75%
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Monthly trend blocks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Monthly Attendance Trend</CardTitle>
                <CardDescription>Average attendance rate across all cohorts per month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2">
                  {attendanceStats.weeklyTrend.map(({ month, rate }) => (
                    <div key={month} className="flex flex-col items-center gap-1 flex-1">
                      <span className="text-xs font-medium text-muted-foreground">{rate}%</span>
                      <div
                        className={cn(
                          'w-full rounded-t-sm min-h-[4px]',
                          rate >= 75 ? 'bg-green-500' : 'bg-red-400',
                        )}
                        style={{ height: `${Math.max(rate, 4)}px` }}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(month + '-01').toLocaleDateString('en', { month: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top absentees */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  Students Below 75%
                </CardTitle>
                <CardDescription>Attendance at risk — may affect internship & certificate eligibility</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {attendanceStats.topAbsentees
                    .filter(a => a.rate < 75)
                    .map(({ student, rate, absentCount }) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                          <span className="text-sm font-medium">{student.name}</span>
                          <Badge variant="secondary" className="text-xs">{absentCount} absent</Badge>
                        </div>
                        <span className="text-sm font-semibold text-red-400">{rate}%</span>
                      </div>
                    ))}
                  {attendanceStats.topAbsentees.filter(a => a.rate < 75).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">All students above 75%</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
