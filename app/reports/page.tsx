'use client'

import { useMemo, useState } from 'react'
import { attendance, batches, branches, mentors, placements, students, submissions, tasks } from '@/lib/demo/seed'
import { useDemoAuth } from '@/lib/demo/auth'

type GraphPoint = {
  label: string
  value: number
}

type PiePoint = {
  label: string
  value: number
}

const barData: GraphPoint[] = [
  { label: 'DM', value: 82 },
  { label: 'Web', value: 68 },
  { label: '3D', value: 91 },
  { label: 'AI', value: 54 },
  { label: 'Cyber', value: 47 },
]

const lineData: GraphPoint[] = [
  { label: 'Week 1', value: 45 },
  { label: 'Week 2', value: 58 },
  { label: 'Week 3', value: 72 },
  { label: 'Week 4', value: 86 },
  { label: 'Week 5', value: 78 },
  { label: 'Week 6', value: 92 },
]

const areaData: GraphPoint[] = [
  { label: 'Mon', value: 40 },
  { label: 'Tue', value: 65 },
  { label: 'Wed', value: 55 },
  { label: 'Thu', value: 78 },
  { label: 'Fri', value: 88 },
  { label: 'Sat', value: 70 },
]

const pieData: PiePoint[] = [
  { label: 'Submitted', value: 45 },
  { label: 'Pending', value: 25 },
  { label: 'Reviewed', value: 20 },
  { label: 'Revision', value: 10 },
]

function getRoleReportTitle(roleName?: string) {
  if (!roleName) return 'Reports Dashboard'

  if (roleName.toLowerCase().includes('placement')) return 'Placement Reports'
  if (roleName.toLowerCase().includes('mentor') || roleName.toLowerCase().includes('teacher')) return 'Mentor Reports'
  if (roleName.toLowerCase().includes('hod')) return 'HOD Academic Reports'
  if (roleName.toLowerCase().includes('branch')) return 'Branch Reports'
  if (roleName.toLowerCase().includes('admin')) return 'Management Reports'

  return 'Reports Dashboard'
}

function BarGraph({ data }: { data: GraphPoint[] }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1)

  return (
    <div className="h-72 border border-border bg-background/60 p-5">
      <div className="flex h-full items-end gap-4">
        {data.map((item) => (
          <div key={item.label} className="flex h-full flex-1 flex-col justify-end gap-2">
            <div className="flex flex-1 items-end">
              <div className="w-full bg-[#153e90]/10 dark:bg-[#6ee75a]/10">
                <div
                  className="w-full bg-[#153e90] dark:bg-[#6ee75a]"
                  style={{ height: `${(item.value / maxValue) * 100}%`, minHeight: '16px' }}
                />
              </div>
            </div>
            <div className="text-center text-xs font-semibold text-muted-foreground">{item.label}</div>
            <div className="text-center text-xs font-bold">{item.value}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LineGraph({ data }: { data: GraphPoint[] }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1)
  const points = data
    .map((item, index) => {
      const x = (index / (data.length - 1)) * 100
      const y = 100 - (item.value / maxValue) * 85
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="h-72 border border-border bg-background/60 p-5">
      <div className="relative h-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" className="text-[#153e90] dark:text-[#6ee75a]" />
        </svg>

        <div className="absolute inset-x-0 bottom-0 flex justify-between text-xs text-muted-foreground">
          {data.map((item) => (
            <span key={item.label}>{item.label}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function AreaGraph({ data }: { data: GraphPoint[] }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1)
  const points = data
    .map((item, index) => {
      const x = (index / (data.length - 1)) * 100
      const y = 100 - (item.value / maxValue) * 85
      return `${x},${y}`
    })
    .join(' ')

  const areaPoints = `0,100 ${points} 100,100`

  return (
    <div className="h-72 border border-border bg-background/60 p-5">
      <div className="relative h-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={areaPoints} className="fill-[#153e90]/20 dark:fill-[#6ee75a]/20" />
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" className="text-[#153e90] dark:text-[#6ee75a]" />
        </svg>

        <div className="absolute inset-x-0 bottom-0 flex justify-between text-xs text-muted-foreground">
          {data.map((item) => (
            <span key={item.label}>{item.label}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function PieChart({ data }: { data: PiePoint[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  let current = 0

  const gradient = data
    .map((item, index) => {
      const start = current
      const end = current + (item.value / total) * 100
      current = end

      const colors = ['#153e90', '#6ee75a', '#f59e0b', '#ef4444']
      return `${colors[index % colors.length]} ${start}% ${end}%`
    })
    .join(', ')

  return (
    <div className="border border-border bg-background/60 p-5">
      <div className="grid gap-5 md:grid-cols-[180px_1fr] md:items-center">
        <div
          className="mx-auto h-44 w-44 rounded-full"
          style={{ background: `conic-gradient(${gradient})` }}
        />

        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.label} className="flex items-center justify-between border border-border bg-card p-3 text-sm">
              <span className="font-semibold">{item.label}</span>
              <span className="text-muted-foreground">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  const { role, can } = useDemoAuth()
  const [notice, setNotice] = useState('')

  const canExport = can('reports.export')

  const totalStudents = students.length
  const totalBatches = batches.length
  const totalMentors = mentors.length
  const totalBranches = branches.length
  const totalTasks = tasks.length
  const totalSubmissions = submissions.length
  const totalPlacements = placements.length

  const averageAttendance = useMemo(() => {
    if (students.length === 0) return '0%'
    return `${Math.round(
      students.reduce((total, student) => total + Number(String(student.attendance).replace('%', '')), 0) / students.length,
    )}%`
  }, [])

  const exportReport = (name: string) => {
    if (!canExport) {
      setNotice('Export permission is not enabled for this role.')
      return
    }

    setNotice(`${name} exported in demo.`)
  }

  if (!can('reports.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Reports Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view reports.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Visual report dashboard</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{getRoleReportTitle(role?.name)}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Dashboard-style LMS reports with bar graph, pie chart, line graph and area graph based on enabled permissions.
          </p>
        </div>

        <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Current role:</span> {role?.name || 'Not selected'}
        </div>
      </div>

      {notice && (
        <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
          {notice}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{totalStudents}</div>
          <div className="mt-1 text-sm text-muted-foreground">Students</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Active learning records</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{totalBatches}</div>
          <div className="mt-1 text-sm text-muted-foreground">Batches</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Online and offline</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{averageAttendance}</div>
          <div className="mt-1 text-sm text-muted-foreground">Attendance</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Average percentage</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{totalSubmissions}</div>
          <div className="mt-1 text-sm text-muted-foreground">Submissions</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">{totalTasks} tasks assigned</div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="border border-border bg-card p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Batch Performance Bar Graph</h2>
              <p className="mt-1 text-sm text-muted-foreground">Course-wise performance percentage.</p>
            </div>
            <button onClick={() => exportReport('Batch Performance')} className="border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">
              Export
            </button>
          </div>
          <BarGraph data={barData} />
        </div>

        <div className="border border-border bg-card p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Submission Status Pie Chart</h2>
              <p className="mt-1 text-sm text-muted-foreground">Submission distribution by current status.</p>
            </div>
            <button onClick={() => exportReport('Submission Status')} className="border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">
              Export
            </button>
          </div>
          <PieChart data={pieData} />
        </div>

        <div className="border border-border bg-card p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Student Progress Line Graph</h2>
              <p className="mt-1 text-sm text-muted-foreground">Weekly student learning progress.</p>
            </div>
            <button onClick={() => exportReport('Student Progress')} className="border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">
              Export
            </button>
          </div>
          <LineGraph data={lineData} />
        </div>

        <div className="border border-border bg-card p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Attendance Area Graph</h2>
              <p className="mt-1 text-sm text-muted-foreground">Day-wise attendance activity.</p>
            </div>
            <button onClick={() => exportReport('Attendance Activity')} className="border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">
              Export
            </button>
          </div>
          <AreaGraph data={areaData} />
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Report Summary</h2>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-semibold">Report</th>
                <th className="px-4 py-3 font-semibold">Visible For</th>
                <th className="px-4 py-3 font-semibold">Main Metrics</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>

            <tbody>
              <tr className="border-b border-border">
                <td className="px-4 py-4 font-semibold">Academic Performance</td>
                <td className="px-4 py-4 text-muted-foreground">Admin, Branch Admin, HOD, Mentor</td>
                <td className="px-4 py-4 text-muted-foreground">Students, batches, submissions, marks</td>
                <td className="px-4 py-4">
                  <span className="border border-[#153e90]/30 bg-[#153e90]/10 px-2 py-1 text-xs font-semibold text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white">
                    Ready
                  </span>
                </td>
              </tr>

              <tr className="border-b border-border">
                <td className="px-4 py-4 font-semibold">Attendance Report</td>
                <td className="px-4 py-4 text-muted-foreground">Admin, Branch Admin, HOD, Mentor</td>
                <td className="px-4 py-4 text-muted-foreground">Present, absent, late, percentage</td>
                <td className="px-4 py-4">
                  <span className="border border-[#153e90]/30 bg-[#153e90]/10 px-2 py-1 text-xs font-semibold text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white">
                    Ready
                  </span>
                </td>
              </tr>

              <tr className="border-b border-border">
                <td className="px-4 py-4 font-semibold">Placement Report</td>
                <td className="px-4 py-4 text-muted-foreground">Placement Cell, Admin</td>
                <td className="px-4 py-4 text-muted-foreground">Eligible, interviewing, CV pending, company pipeline</td>
                <td className="px-4 py-4">
                  <span className="border border-[#153e90]/30 bg-[#153e90]/10 px-2 py-1 text-xs font-semibold text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white">
                    Ready
                  </span>
                </td>
              </tr>

              <tr>
                <td className="px-4 py-4 font-semibold">Mentor Monitoring</td>
                <td className="px-4 py-4 text-muted-foreground">HOD, Branch Admin</td>
                <td className="px-4 py-4 text-muted-foreground">Mentors, tasks, submissions, review load</td>
                <td className="px-4 py-4">
                  <span className="border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-200">
                    Draft
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="border border-border bg-background/60 p-4">
            <div className="text-2xl font-bold">{totalBranches}</div>
            <div className="mt-1 text-sm text-muted-foreground">Branches</div>
          </div>

          <div className="border border-border bg-background/60 p-4">
            <div className="text-2xl font-bold">{totalMentors}</div>
            <div className="mt-1 text-sm text-muted-foreground">Mentors</div>
          </div>

          <div className="border border-border bg-background/60 p-4">
            <div className="text-2xl font-bold">{attendance.length}</div>
            <div className="mt-1 text-sm text-muted-foreground">Attendance Sessions</div>
          </div>

          <div className="border border-border bg-background/60 p-4">
            <div className="text-2xl font-bold">{totalPlacements}</div>
            <div className="mt-1 text-sm text-muted-foreground">Placement Records</div>
          </div>
        </div>
      </div>
    </div>
  )
}