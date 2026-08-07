'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '@/lib/auth/provider'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import {
  fetchAttendanceTrend,
  fetchMarksRadar,
  fetchMentorOverview,
  fetchPlacementBatchLine,
  fetchReportsSnapshot,
  fetchReviewPipeline,
  getAttendanceTrendPresetDates,
  type AttendanceTrendPoint,
  type AttendanceTrendRange,
  type AttendanceTrendSeries,
  type PlacementBatchModeFilter,
  type PlacementStagePoint,
  type ReportBatchOption,
  type ReportGraphPoint,
  type ReportMarksBarRow,
  type ReportMentorOverviewPoint,
  type ReportMentorProfileOption,
  type ReportMarksTaskOption,
  type ReportReviewTaskOption,
  type ReportDepartmentBatchStat,
  type ReportsSnapshot,
} from '@/lib/data/reports'

const TREND_BATCH_LIMIT = 4
const TREND_SEARCH_RESULT_LIMIT = 20

const PIE_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#64748b']

const selectClass =
  'h-10 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a] dark:[color-scheme:dark]'

const optionClass = 'bg-background text-foreground'

/** Shared Recharts tooltip styles — must set color or labels stay black in dark mode. */
const chartTooltipStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 0,
  fontSize: 12,
  color: 'var(--foreground)',
} as const

const chartTooltipItemStyle = {
  color: 'var(--foreground)',
} as const

const chartTooltipLabelStyle = {
  color: 'var(--foreground)',
} as const

function getRoleReportTitle(roleName?: string, parentRoleId?: string | null) {
  if (parentRoleId === 'placement') return 'Placement Reports'
  if (parentRoleId === 'mentor') return 'Mentor / Academic Reports'
  if (parentRoleId === 'branch_admin') return 'Branch Reports'
  if (parentRoleId === 'company_admin' || parentRoleId === 'super_admin') return 'Management Reports'
  if (!roleName) return 'Reports Dashboard'
  return 'Reports Dashboard'
}

function ChartCard({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string
  subtitle: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`flex h-full flex-col border border-border bg-card p-5 ${className}`.trim()}>
      <div className="chart-card-head mb-5 flex min-h-[4.75rem] flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

type DepartmentPieMode = 'students' | 'batches' | 'avg'

type DepartmentPieRow = {
  name: string
  students: number
  batches: number
  avgStudentsPerBatch: number
  /** Slice size for the selected metric. */
  metric: number
  percent: number
  fill: string
}

function buildDepartmentPieRows(
  stats: ReportDepartmentBatchStat[],
  departments: { id: string; name: string }[],
  mode: DepartmentPieMode,
  filters: { departmentId: string; batchMode: string; status: string },
): DepartmentPieRow[] {
  const filtered = stats.filter((row) => {
    if (filters.departmentId !== 'all' && row.departmentId !== filters.departmentId) return false
    if (filters.batchMode !== 'all' && row.batchMode !== filters.batchMode) return false
    if (filters.status !== 'all' && row.status !== filters.status) return false
    return true
  })

  const byDepartment = new Map<string, { students: number; batches: number }>()

  for (const department of departments) {
    if (filters.departmentId !== 'all' && department.id !== filters.departmentId) continue
    byDepartment.set(department.name, { students: 0, batches: 0 })
  }

  for (const row of filtered) {
    const key = row.departmentName || '—'
    const current = byDepartment.get(key) || { students: 0, batches: 0 }
    current.students += row.studentCount
    current.batches += 1
    byDepartment.set(key, current)
  }

  const rows = Array.from(byDepartment.entries())
    .map(([name, item]) => {
      const avgStudentsPerBatch =
        item.batches > 0 ? Math.round((item.students / item.batches) * 10) / 10 : 0
      const metric =
        mode === 'batches' ? item.batches : mode === 'avg' ? avgStudentsPerBatch : item.students
      return {
        name,
        students: item.students,
        batches: item.batches,
        avgStudentsPerBatch,
        metric,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const totalMetric = rows.reduce((sum, row) => sum + row.metric, 0)

  return rows.map((row, index) => ({
    ...row,
    percent: totalMetric > 0 ? Math.round((row.metric / totalMetric) * 100) : 0,
    fill: PIE_COLORS[index % PIE_COLORS.length],
  }))
}

function ModernBarGraph({
  data,
  unit = '%',
  showGrid = true,
}: {
  data: ReportGraphPoint[]
  unit?: string
  showGrid?: boolean
}) {
  const maxValue = Math.max(...data.map((item) => item.value), 1)

  return (
    <div className="relative h-80 border border-border bg-background/40 p-5">
      {showGrid && (
        <div className="pointer-events-none absolute inset-5 flex flex-col justify-between">
          {[0, 1, 2, 3, 4].map((line) => (
            <div key={line} className="border-t border-border/60" />
          ))}
        </div>
      )}

      <div className="relative z-10 flex h-full items-end gap-3">
        {data.map((item, index) => {
          const height = Math.max((item.value / maxValue) * 100, item.value > 0 ? 8 : 0)
          return (
            <div key={`${item.label}-${index}`} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
              <div className="flex flex-1 items-end">
                <div className="group relative w-full">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-[#153e90] to-[#3b82f6] transition-all dark:from-[#2f9e45] dark:to-[#6ee75a]"
                    style={{ height: `${height}%`, minHeight: item.value > 0 ? '12px' : '0' }}
                    title={`${item.label}: ${item.value}${unit}`}
                  />
                </div>
              </div>
              <div className="truncate text-center text-[11px] font-semibold text-muted-foreground">{item.label}</div>
              <div className="text-center text-xs font-bold">
                {item.value}
                {unit}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AttendanceTrendChart({
  points,
  series,
  loading,
}: {
  points: AttendanceTrendPoint[]
  series: AttendanceTrendSeries[]
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center border border-border text-sm text-muted-foreground">
        Loading attendance trend…
      </div>
    )
  }

  if (!series.length) {
    return (
      <div className="flex h-80 items-center justify-center border border-border text-sm text-muted-foreground">
        Select at least one batch to view attendance trend.
      </div>
    )
  }

  return (
    <div className="h-80 w-full border border-border bg-background/40 p-3">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            {series.map((item) => (
              <linearGradient key={item.dataKey} id={`trend-${item.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={item.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={item.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="4 4" className="stroke-border" vertical />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => `${value}`}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            formatter={(value: number | null, name, item) => {
              const seriesItem = series.find((entry) => entry.dataKey === name)
              const label = seriesItem?.batchName || String(name)
              if (value === null || value === undefined) return ['No data', label]

              const present = item?.payload?.[`${name}_present`]
              const total = item?.payload?.[`${name}_total`]
              if (typeof present === 'number' && typeof total === 'number') {
                return [`${present}/${total} students (${value}%)`, label]
              }
              return [`${value}%`, label]
            }}
            labelFormatter={(label, payload) => {
              const dateKey = payload?.[0]?.payload?.dateKey
              return dateKey ? `${label} · ${dateKey}` : String(label)
            }}
            contentStyle={chartTooltipStyle}
            itemStyle={chartTooltipItemStyle}
            labelStyle={chartTooltipLabelStyle}
          />
          <Legend
            formatter={(value) => {
              const seriesItem = series.find((item) => item.dataKey === value)
              return seriesItem?.batchName || value
            }}
            wrapperStyle={{ color: 'var(--foreground)' }}
          />
          {series.map((item) => (
            <Area
              key={item.dataKey}
              type="monotone"
              dataKey={item.dataKey}
              stroke={item.color}
              fill={`url(#trend-${item.dataKey})`}
              strokeWidth={2.5}
              dot={{ r: 3.5, strokeWidth: 2, fill: 'var(--card)', stroke: item.color }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function MarksAxisTick({
  x,
  y,
  payload,
}: {
  x?: number
  y?: number
  payload?: { value?: string }
}) {
  const lines = String(payload?.value || '')
    .split('\n')
    .filter(Boolean)

  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text textAnchor="middle" fill="currentColor" fontSize={11}>
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={0} dy={index === 0 ? 12 : 14}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  )
}

function ThinMentorBar(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  payload?: ReportMentorOverviewPoint
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill = '#14b8a6', payload } = props
  if (!payload) return null

  const barWidth = 3
  const barHeight = Math.max(height, 2)
  const barY = height > 0 ? y : y - barHeight
  const barX = x + width / 2 - barWidth / 2
  const size = 26
  const avatarX = x + width / 2 - size / 2
  const avatarY = barY - size - 6
  const initial = (payload.name || 'M').trim().charAt(0).toUpperCase() || 'M'

  return (
    <g>
      {/* Soft outline keeps the thin bar visible in light and dark mode */}
      <rect
        x={barX - 0.5}
        y={barY - 0.5}
        width={barWidth + 1}
        height={barHeight + 1}
        fill="var(--background)"
        rx={1.5}
      />
      <rect x={barX} y={barY} width={barWidth} height={barHeight} fill={fill} rx={1} />
      <foreignObject x={avatarX} y={avatarY} width={size} height={size}>
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 2,
            overflow: 'hidden',
            border: `2px solid ${fill}`,
            boxShadow: '0 0 0 1px var(--background)',
            background: 'var(--card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--foreground)',
          }}
        >
          {payload.avatarUrl ? (
            <img
              src={payload.avatarUrl}
              alt=""
              width={size}
              height={size}
              style={{ width: size, height: size, objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <span style={{ color: fill }}>{initial}</span>
          )}
        </div>
      </foreignObject>
    </g>
  )
}

function MentorHoverTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: ReportMentorOverviewPoint; value?: number }>
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null

  const color = row.color || '#2563eb'

  return (
    <div
      className="border bg-card px-3 py-2 text-xs shadow-sm"
      style={{ borderColor: color }}
    >
      <div className="font-bold" style={{ color }}>
        {row.name}
      </div>
      <div className="mt-1 font-semibold" style={{ color }}>
        Rating {row.ratingLabel} / 5
      </div>
      <div className="mt-1 text-muted-foreground">
        <span style={{ color }}>{row.profileName}</span>
        <span className="mx-1">·</span>
        <span>{row.departmentName}</span>
      </div>
    </div>
  )
}

function PlacementStageAreaChart({
  data,
  loading,
}: {
  data: PlacementStagePoint[]
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center border border-border text-sm text-muted-foreground">
        Loading placement…
      </div>
    )
  }

  const hasValues = data.some((point) => point.value > 0)

  if (!data.length || !hasValues) {
    return (
      <div className="flex h-80 items-center justify-center border border-border text-sm text-muted-foreground">
        No placement counts for these filters.
      </div>
    )
  }

  return (
    <div className="h-80 w-full border border-border bg-background/40 p-3">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 8 }}>
          <defs>
            <linearGradient id="placementAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" className="stroke-border" vertical={false} />
          <XAxis
            dataKey="stage"
            interval={0}
            tick={{ fontSize: 12, fill: 'currentColor' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            width={36}
            tick={{ fontSize: 11, fill: 'currentColor' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value: number) => [value, 'Count']}
            contentStyle={chartTooltipStyle}
            itemStyle={chartTooltipItemStyle}
            labelStyle={chartTooltipLabelStyle}
          />
          <Area
            type="monotone"
            dataKey="value"
            name="Count"
            stroke="#3b82f6"
            strokeWidth={2.5}
            fill="url(#placementAreaFill)"
            dot={{ r: 4, strokeWidth: 2, fill: 'var(--card)', stroke: '#3b82f6' }}
            activeDot={{ r: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function MentorOverviewChart({
  data,
  loading,
}: {
  data: ReportMentorOverviewPoint[]
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center border border-border text-sm text-muted-foreground">
        Loading mentors…
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="flex h-80 items-center justify-center border border-border text-sm text-muted-foreground">
        No mentors found for this filter (Final QA excluded).
      </div>
    )
  }

  const chartMinWidth = Math.max(320, data.length * 64)

  return (
    <div className="h-full w-full overflow-x-auto border border-border bg-background/40 p-3">
      <div className="h-full" style={{ minWidth: chartMinWidth }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 40, right: 12, left: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="4 4" className="stroke-border" vertical={false} />
            <XAxis
              dataKey="shortName"
              interval={0}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 5]}
              ticks={[0, 1, 2, 3, 4, 5]}
              allowDecimals={false}
              width={28}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--accent)', opacity: 0.2 }}
              content={<MentorHoverTooltip />}
            />
            <Bar
              dataKey="rating"
              name="Rating"
              shape={(barProps) => <ThinMentorBar {...barProps} />}
              isAnimationActive={false}
            >
              {data.map((item) => (
                <Cell key={item.mentorId} fill={item.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function MarksBarChart({
  data,
  loading,
}: {
  data: ReportMarksBarRow[]
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center border border-border text-sm text-muted-foreground">
        Loading marks…
      </div>
    )
  }

  const hasMarks = data.some(
    (row) => row.mentorCount > 0 || row.hodCount > 0 || row.qaCount > 0,
  )

  if (!data.length || !hasMarks) {
    return (
      <div className="flex h-80 items-center justify-center border border-border text-sm text-muted-foreground">
        No mentor / HOD / Final QA marks for this selection.
      </div>
    )
  }

  const maxDomain = Math.max(100, ...data.map((row) => row.maxMarks || 100))
  const chartMinWidth = Math.max(320, data.length * 72)

  return (
    <div className="w-full overflow-x-auto border border-border bg-background/40 p-3">
      <div className="h-80" style={{ minWidth: chartMinWidth }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 12, left: 4, bottom: 28 }}
            barCategoryGap="18%"
          >
            <CartesianGrid strokeDasharray="4 4" className="stroke-border" vertical={false} />
            <XAxis
              type="category"
              dataKey="task"
              interval={0}
              height={48}
              tick={<MarksAxisTick />}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="number"
              domain={[0, maxDomain]}
              allowDecimals={false}
              width={36}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--accent)', opacity: 0.35 }}
              labelFormatter={(_label, payload) => {
                const row = payload?.[0]?.payload as ReportMarksBarRow | undefined
                if (!row) return String(_label)
                const numberLabel = row.taskNumber ? `#${row.taskNumber}` : String(_label).split('\n')[0]
                if (row.mode === 'student') {
                  return `${numberLabel} · ${row.taskName}`
                }
                const due = row.dueDate
                  ? new Date(`${row.dueDate}T00:00:00`).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : null
                return due ? `${numberLabel} · ${row.taskName} · ${due}` : `${numberLabel} · ${row.taskName}`
              }}
              formatter={(value: number, name: string, item) => {
                const row = item?.payload as ReportMarksBarRow | undefined
                const maxMarks = row?.maxMarks || 100
                if (row?.mode === 'student') {
                  return [`${value} / ${maxMarks}`, name]
                }
                if (name === 'Mentor mark') {
                  return [`${value} / ${maxMarks} · avg of ${row?.mentorCount ?? 0}`, name]
                }
                if (name === 'HOD mark') {
                  return [`${value} / ${maxMarks} · avg of ${row?.hodCount ?? 0}`, name]
                }
                return [`${value} / ${maxMarks} · avg of ${row?.qaCount ?? 0}`, name]
              }}
              contentStyle={chartTooltipStyle}
              itemStyle={chartTooltipItemStyle}
              labelStyle={chartTooltipLabelStyle}
            />
            <Legend wrapperStyle={{ color: 'var(--foreground)' }} />
            <Bar dataKey="mentorMark" name="Mentor mark" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            <Bar dataKey="hodMark" name="HOD mark" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            <Bar dataKey="finalQaMark" name="Final QA mark" fill="#22c55e" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ClassicPieChart({
  rows,
  mode,
}: {
  rows: DepartmentPieRow[]
  mode: DepartmentPieMode
}) {
  const metricLabel =
    mode === 'batches' ? 'Batches' : mode === 'avg' ? 'Avg students / batch' : 'Students'

  const sliceData = rows
    .filter((item) => item.metric > 0)
    .map((item) => ({
      name: item.name,
      value: item.metric,
      percent: item.percent,
      students: item.students,
      batches: item.batches,
      avgStudentsPerBatch: item.avgStudentsPerBatch,
      fill: item.fill,
    }))

  const sliceCount = sliceData.length
  const paddingAngle = sliceCount > 1 ? 2 : 0
  const emptyCount = rows.filter((item) => item.metric === 0).length
  const pieData =
    sliceCount > 0
      ? sliceData
      : [
          {
            name: 'No data',
            value: 1,
            percent: 0,
            students: 0,
            batches: 0,
            avgStudentsPerBatch: 0,
            fill: '#64748b',
          },
        ]

  return (
    <div className="border border-border bg-background/40 p-4">
      <div className="flex flex-col items-center gap-5">
        <div className="mx-auto h-72 w-full max-w-md">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={100}
                paddingAngle={paddingAngle}
                isAnimationActive={false}
                stroke="none"
                labelLine={false}
                label={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`${entry.name}-${index}`} fill={entry.fill} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, _name, item) => {
                  const payload = item?.payload
                  return [
                    `${value}${typeof payload?.percent === 'number' ? ` (${payload.percent}%)` : ''}`,
                    metricLabel,
                  ]
                }}
                contentStyle={chartTooltipStyle}
                itemStyle={chartTooltipItemStyle}
                labelStyle={chartTooltipLabelStyle}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {sliceCount <= 1 && emptyCount > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Only {sliceCount === 1 ? '1 department has' : 'no department has'} matching data. Empty
            departments stay in the list ({emptyCount}).
          </p>
        )}

        <div className="grid w-full gap-2 sm:grid-cols-2">
          {rows.map((item, index) => (
            <div
              key={`${item.name}-${index}`}
              className="border border-border bg-card px-3 py-2.5 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0" style={{ background: item.fill }} />
                <span className="truncate font-semibold">{item.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{item.percent}%</span>
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground">{item.students}</span> students
                </span>
                <span>
                  <span className="font-semibold text-foreground">{item.batches}</span> batches
                </span>
                <span>
                  avg{' '}
                  <span className="font-semibold text-foreground">{item.avgStudentsPerBatch}</span>
                  /batch
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  const { role, can, user, parentRoleId } = useAuth()
  const { activeBranchId, loading: branchLoading } = useBranchScope()

  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [snapshot, setSnapshot] = useState<ReportsSnapshot | null>(null)
  const [departmentPieMode, setDepartmentPieMode] = useState<DepartmentPieMode>('students')
  const [departmentPieDepartmentId, setDepartmentPieDepartmentId] = useState('all')
  const [departmentPieBatchMode, setDepartmentPieBatchMode] = useState<'all' | 'online' | 'offline'>('all')
  const [departmentPieStatus, setDepartmentPieStatus] = useState('all')
  const [trendRange, setTrendRange] = useState<AttendanceTrendRange>('weekly')
  const [trendFromDate, setTrendFromDate] = useState(() => getAttendanceTrendPresetDates('weekly').fromDate)
  const [trendToDate, setTrendToDate] = useState(() => getAttendanceTrendPresetDates('weekly').toDate)
  const [trendDepartmentId, setTrendDepartmentId] = useState('all')
  const [trendBatchSearch, setTrendBatchSearch] = useState('')
  const [trendBatchIds, setTrendBatchIds] = useState<string[]>([])
  const [trendPoints, setTrendPoints] = useState<AttendanceTrendPoint[]>([])
  const [trendSeries, setTrendSeries] = useState<AttendanceTrendSeries[]>([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendNotice, setTrendNotice] = useState('')
  const [marksDepartmentId, setMarksDepartmentId] = useState('all')
  const [marksBatchId, setMarksBatchId] = useState('all')
  const [marksBatchSearch, setMarksBatchSearch] = useState('')
  const [marksTaskId, setMarksTaskId] = useState('all')
  const [marksTasks, setMarksTasks] = useState<ReportMarksTaskOption[]>([])
  const [marksBars, setMarksBars] = useState<ReportMarksBarRow[]>([])
  const [marksLoading, setMarksLoading] = useState(false)
  const [marksNotice, setMarksNotice] = useState('')
  const [mentorDepartmentId, setMentorDepartmentId] = useState('all')
  const [mentorProfileSlug, setMentorProfileSlug] = useState('all')
  const [mentorProfileOptions, setMentorProfileOptions] = useState<ReportMentorProfileOption[]>([])
  const [mentorPoints, setMentorPoints] = useState<ReportMentorOverviewPoint[]>([])
  const [mentorTotal, setMentorTotal] = useState(0)
  const [mentorLoading, setMentorLoading] = useState(false)
  const [mentorNotice, setMentorNotice] = useState('')
  const [reviewDepartmentId, setReviewDepartmentId] = useState('all')
  const [reviewBatchId, setReviewBatchId] = useState('all')
  const [reviewTaskId, setReviewTaskId] = useState('all')
  const [reviewTasks, setReviewTasks] = useState<ReportReviewTaskOption[]>([])
  const [reviewPipeline, setReviewPipeline] = useState<ReportGraphPoint[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewNotice, setReviewNotice] = useState('')
  const [placementDepartmentId, setPlacementDepartmentId] = useState('all')
  const [placementMode, setPlacementMode] = useState<PlacementBatchModeFilter>('all')
  const [placementFromDate, setPlacementFromDate] = useState('')
  const [placementToDate, setPlacementToDate] = useState('')
  const [placementPoints, setPlacementPoints] = useState<PlacementStagePoint[]>([])
  const [placementLoading, setPlacementLoading] = useState(false)
  const [placementNotice, setPlacementNotice] = useState('')

  const canViewReports = can('reports.view') || parentRoleId === 'super_admin'

  const canSeeAcademic =
    can('students.view') ||
    can('batches.view') ||
    can('attendance.view') ||
    can('marks.view') ||
    parentRoleId === 'super_admin' ||
    parentRoleId === 'company_admin' ||
    parentRoleId === 'branch_admin' ||
    parentRoleId === 'mentor'

  const canSeeReview =
    can('submissions.view') ||
    can('tasks.view') ||
    can('hod_review.view') ||
    can('final_qa.view') ||
    parentRoleId === 'super_admin' ||
    parentRoleId === 'mentor'

  const canSeePlacement =
    can('placement.view') ||
    parentRoleId === 'super_admin' ||
    parentRoleId === 'company_admin' ||
    parentRoleId === 'placement'

  const canSeeMentors = can('mentors.view') || parentRoleId === 'super_admin' || parentRoleId === 'company_admin'

  useEffect(() => {
    if (branchLoading || !user?.id || !canViewReports) return

    let cancelled = false

    async function loadReports() {
      setLoading(true)
      setNotice('')

      const result = await fetchReportsSnapshot({
        branchId: activeBranchId,
        parentRoleId,
        userId: user!.id,
        departmentId: 'all',
        batchId: 'all',
      })

      if (cancelled) return

      setSnapshot(result.data)
      if (result.error) setNotice(result.error)
      setLoading(false)
    }

    void loadReports()

    return () => {
      cancelled = true
    }
  }, [activeBranchId, branchLoading, canViewReports, parentRoleId, user?.id])

  const departmentOptions = snapshot?.departments || []
  const batchCatalog = useMemo(() => snapshot?.batchCatalog || [], [snapshot])

  const trendBatchesForPicker = useMemo(() => {
    const query = trendBatchSearch.trim().toLowerCase()
    return batchCatalog
      .filter((batch) => {
        if (trendDepartmentId !== 'all' && batch.departmentId !== trendDepartmentId) return false
        if (!query) return true
        return (
          batch.name.toLowerCase().includes(query) ||
          batch.departmentName.toLowerCase().includes(query)
        )
      })
      .slice(0, TREND_SEARCH_RESULT_LIMIT)
  }, [batchCatalog, trendBatchSearch, trendDepartmentId])

  const selectedTrendBatches = useMemo(() => {
    const byId = new Map(batchCatalog.map((batch) => [batch.id, batch]))
    return trendBatchIds
      .map((id) => byId.get(id))
      .filter((batch): batch is ReportBatchOption => Boolean(batch))
  }, [batchCatalog, trendBatchIds])

  const trendMatchCount = useMemo(() => {
    const query = trendBatchSearch.trim().toLowerCase()
    return batchCatalog.filter((batch) => {
      if (trendDepartmentId !== 'all' && batch.departmentId !== trendDepartmentId) return false
      if (!query) return true
      return (
        batch.name.toLowerCase().includes(query) ||
        batch.departmentName.toLowerCase().includes(query)
      )
    }).length
  }, [batchCatalog, trendBatchSearch, trendDepartmentId])

  useEffect(() => {
    if (!batchCatalog.length) {
      setTrendBatchIds([])
      return
    }

    setTrendBatchIds((current) => {
      const stillValid = current.filter((id) => batchCatalog.some((batch) => batch.id === id))
      if (stillValid.length) return stillValid.slice(0, TREND_BATCH_LIMIT)
      // Default: one batch only — do not auto-pick many when catalog is large.
      return [batchCatalog[0].id]
    })
  }, [batchCatalog])

  useEffect(() => {
    if (!canSeeAcademic || !trendBatchIds.length) {
      setTrendPoints([])
      setTrendSeries([])
      setTrendNotice('')
      setTrendLoading(false)
      return
    }

    let cancelled = false

    async function loadTrend() {
      setTrendLoading(true)
      setTrendNotice('')

      const batchNames = Object.fromEntries(batchCatalog.map((batch) => [batch.id, batch.name]))
      const result = await fetchAttendanceTrend({
        batchIds: trendBatchIds,
        batchNames,
        range: trendRange,
        fromDate: trendFromDate,
        toDate: trendToDate,
      })

      if (cancelled) return

      setTrendPoints(result.points)
      setTrendSeries(result.series)
      if (result.error) setTrendNotice(result.error)
      setTrendLoading(false)
    }

    void loadTrend()

    return () => {
      cancelled = true
    }
  }, [batchCatalog, canSeeAcademic, trendBatchIds, trendFromDate, trendRange, trendToDate])

  const canSeeMarks = canSeeAcademic || canSeeReview

  const marksBatchesForSelect = useMemo(() => {
    const query = marksBatchSearch.trim().toLowerCase()
    const filtered = batchCatalog
      .filter((batch) => {
        if (marksDepartmentId !== 'all' && batch.departmentId !== marksDepartmentId) return false
        if (!query) return true
        return (
          batch.name.toLowerCase().includes(query) ||
          batch.departmentName.toLowerCase().includes(query)
        )
      })
      .slice(0, TREND_SEARCH_RESULT_LIMIT)

    if (marksBatchId !== 'all') {
      const selected = batchCatalog.find((batch) => batch.id === marksBatchId)
      if (selected && !filtered.some((batch) => batch.id === selected.id)) {
        return [selected, ...filtered]
      }
    }

    return filtered
  }, [batchCatalog, marksBatchId, marksBatchSearch, marksDepartmentId])

  useEffect(() => {
    if (marksBatchId === 'all') return
    const stillValid = batchCatalog.some((batch) => batch.id === marksBatchId)
    if (!stillValid) setMarksBatchId('all')
  }, [batchCatalog, marksBatchId])

  useEffect(() => {
    if (!canSeeMarks) {
      setMarksBars([])
      setMarksTasks([])
      setMarksNotice('')
      setMarksLoading(false)
      return
    }

    const batchIds =
      marksBatchId === 'all'
        ? marksDepartmentId === 'all'
          ? batchCatalog.map((batch) => batch.id)
          : batchCatalog
              .filter((batch) => batch.departmentId === marksDepartmentId)
              .map((batch) => batch.id)
        : [marksBatchId]

    if (!batchIds.length) {
      setMarksBars([])
      setMarksTasks([])
      setMarksNotice('')
      setMarksLoading(false)
      return
    }

    let cancelled = false

    async function loadMarks() {
      setMarksLoading(true)
      setMarksNotice('')

      const batchNames = Object.fromEntries(batchCatalog.map((batch) => [batch.id, batch.name]))
      const result = await fetchMarksRadar({
        batchIds,
        batchNames,
        taskId: marksTaskId === 'all' ? null : marksTaskId,
      })

      if (cancelled) return

      setMarksBars(result.bars)
      setMarksTasks(result.tasks)

      if (result.error) {
        setMarksNotice(result.error)
      } else if (result.chartMode === 'student') {
        if (result.chartItemCount > result.chartItemLimit) {
          setMarksNotice(
            `One task selected — showing ${result.chartItemLimit} of ${result.chartItemCount} students with marks. Each bar group is one student (not a class average).`,
          )
        } else {
          setMarksNotice(
            'One task selected — each bar group is one student’s mentor / HOD / Final QA mark for that task.',
          )
        }
      } else if (result.selectedTaskCount > result.chartItemLimit) {
        setMarksNotice(
          `Showing class averages for the ${result.chartItemLimit} most recent of ${result.selectedTaskCount} tasks. Select one Task to see each student’s marks.`,
        )
      } else if (result.selectedTaskCount > 1) {
        setMarksNotice(
          'All tasks view shows class averages per task. Select one Task to compare students clearly.',
        )
      }

      if (marksTaskId !== 'all' && !result.tasks.some((task) => task.id === marksTaskId)) {
        setMarksTaskId('all')
      }

      setMarksLoading(false)
    }

    void loadMarks()

    return () => {
      cancelled = true
    }
  }, [batchCatalog, canSeeMarks, marksBatchId, marksDepartmentId, marksTaskId])

  useEffect(() => {
    if (!canSeeMentors || branchLoading || !activeBranchId) {
      setMentorPoints([])
      setMentorTotal(0)
      setMentorProfileOptions([])
      setMentorNotice('')
      setMentorLoading(false)
      return
    }

    let cancelled = false

    async function loadMentors() {
      setMentorLoading(true)
      setMentorNotice('')

      const result = await fetchMentorOverview({
        branchId: activeBranchId,
        departmentId: mentorDepartmentId,
        profileSlug: mentorProfileSlug,
      })

      if (cancelled) return

      setMentorPoints(result.points)
      setMentorTotal(result.total)
      setMentorProfileOptions(result.profiles)
      if (result.error) {
        setMentorNotice(result.error)
      } else if (result.total > result.points.length) {
        setMentorNotice(
          `Showing top ${result.points.length} of ${result.total} mentors by rating. Final QA is excluded.`,
        )
      }
      setMentorLoading(false)
    }

    void loadMentors()

    return () => {
      cancelled = true
    }
  }, [activeBranchId, branchLoading, canSeeMentors, mentorDepartmentId, mentorProfileSlug])

  const reviewBatchesForSelect = useMemo(() => {
    return batchCatalog.filter((batch) => {
      if (reviewDepartmentId !== 'all' && batch.departmentId !== reviewDepartmentId) return false
      return true
    })
  }, [batchCatalog, reviewDepartmentId])

  useEffect(() => {
    if (reviewBatchId === 'all') return
    const stillValid = reviewBatchesForSelect.some((batch) => batch.id === reviewBatchId)
    if (!stillValid) {
      setReviewBatchId('all')
      setReviewTaskId('all')
    }
  }, [reviewBatchId, reviewBatchesForSelect])

  useEffect(() => {
    if (!canSeeReview) {
      setReviewPipeline([])
      setReviewTasks([])
      setReviewNotice('')
      setReviewLoading(false)
      return
    }

    const batchIds =
      reviewBatchId === 'all'
        ? reviewDepartmentId === 'all'
          ? batchCatalog.map((batch) => batch.id)
          : batchCatalog
              .filter((batch) => batch.departmentId === reviewDepartmentId)
              .map((batch) => batch.id)
        : [reviewBatchId]

    if (!batchIds.length) {
      setReviewPipeline([
        { label: 'Mentor', value: 0 },
        { label: 'HOD', value: 0 },
        { label: 'QA', value: 0 },
        { label: 'Revision', value: 0 },
        { label: 'Approved', value: 0 },
      ])
      setReviewTasks([])
      setReviewNotice('')
      setReviewLoading(false)
      return
    }

    let cancelled = false

    async function loadReview() {
      setReviewLoading(true)
      setReviewNotice('')

      const batchNames = Object.fromEntries(batchCatalog.map((batch) => [batch.id, batch.name]))
      const result = await fetchReviewPipeline({
        batchIds,
        batchNames,
        taskId: reviewTaskId === 'all' ? null : reviewTaskId,
      })

      if (cancelled) return

      setReviewPipeline(result.data)
      setReviewTasks(result.tasks)
      if (result.error) {
        setReviewNotice(result.error)
      }
      if (reviewTaskId !== 'all' && !result.tasks.some((task) => task.id === reviewTaskId)) {
        setReviewTaskId('all')
      }
      setReviewLoading(false)
    }

    void loadReview()

    return () => {
      cancelled = true
    }
  }, [batchCatalog, canSeeReview, reviewBatchId, reviewDepartmentId, reviewTaskId])

  useEffect(() => {
    if (!canSeePlacement || branchLoading || !activeBranchId) {
      setPlacementPoints([])
      setPlacementNotice('')
      setPlacementLoading(false)
      return
    }

    let cancelled = false

    async function loadPlacement() {
      setPlacementLoading(true)
      setPlacementNotice('')

      const result = await fetchPlacementBatchLine({
        branchId: activeBranchId,
        departmentId: placementDepartmentId,
        fromDate: placementFromDate || null,
        toDate: placementToDate || null,
        mode: placementMode,
      })

      if (cancelled) return

      setPlacementPoints(result.points)
      if (result.error) setPlacementNotice(result.error)
      setPlacementLoading(false)
    }

    void loadPlacement()

    return () => {
      cancelled = true
    }
  }, [
    activeBranchId,
    branchLoading,
    canSeePlacement,
    placementDepartmentId,
    placementFromDate,
    placementMode,
    placementToDate,
  ])

  const applyTrendPreset = (range: AttendanceTrendRange) => {
    const preset = getAttendanceTrendPresetDates(range)
    setTrendRange(range)
    setTrendFromDate(preset.fromDate)
    setTrendToDate(preset.toDate)
  }

  const addTrendBatch = (batchId: string) => {
    setTrendBatchIds((current) => {
      if (current.includes(batchId) || current.length >= TREND_BATCH_LIMIT) return current
      return [...current, batchId]
    })
  }

  const removeTrendBatch = (batchId: string) => {
    setTrendBatchIds((current) => current.filter((id) => id !== batchId))
  }

  const departmentPieRows = useMemo(
    () =>
      buildDepartmentPieRows(
        snapshot?.departmentBatchStats || [],
        snapshot?.departments || [],
        departmentPieMode,
        {
          departmentId: departmentPieDepartmentId,
          batchMode: departmentPieBatchMode,
          status: departmentPieStatus,
        },
      ),
    [
      snapshot?.departmentBatchStats,
      snapshot?.departments,
      departmentPieMode,
      departmentPieDepartmentId,
      departmentPieBatchMode,
      departmentPieStatus,
    ],
  )

  if (!canViewReports) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Reports Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view reports.</p>
      </div>
    )
  }

  const data = snapshot

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Analytics overview</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {getRoleReportTitle(role?.name, parentRoleId)}
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Live LMS graphs for your branch scope. Sections appear only for modules you can access.
          </p>
        </div>

        <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Role:</span> {role?.name || 'Not selected'}
        </div>
      </div>

      {notice && (
        <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
          {notice}
        </div>
      )}

      {canSeeAcademic && (
        <ChartCard
          title="Attendance Trend"
          subtitle="Search batches by department, then compare up to 4 on the chart."
          action={
            <div className="inline-flex border border-border p-0.5">
              <button
                type="button"
                onClick={() => applyTrendPreset('weekly')}
                className={
                  trendRange === 'weekly'
                    ? 'bg-background px-3 py-1.5 text-sm font-semibold'
                    : 'px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
                }
              >
                Weekly
              </button>
              <button
                type="button"
                onClick={() => applyTrendPreset('monthly')}
                className={
                  trendRange === 'monthly'
                    ? 'bg-background px-3 py-1.5 text-sm font-semibold'
                    : 'px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
                }
              >
                Monthly
              </button>
            </div>
          }
        >
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5 text-sm">
              <span className="font-semibold text-muted-foreground">From date</span>
              <input
                type="date"
                value={trendFromDate}
                max={trendToDate}
                onChange={(event) => setTrendFromDate(event.target.value)}
                className={`${selectClass} dark:[color-scheme:dark]`}
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-semibold text-muted-foreground">To date</span>
              <input
                type="date"
                value={trendToDate}
                min={trendFromDate}
                onChange={(event) => setTrendToDate(event.target.value)}
                className={`${selectClass} dark:[color-scheme:dark]`}
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-semibold text-muted-foreground">Department</span>
              <select
                value={trendDepartmentId}
                onChange={(event) => {
                  setTrendDepartmentId(event.target.value)
                  setTrendBatchSearch('')
                }}
                className={selectClass}
                aria-label="Filter batches by department"
              >
                <option value="all" className={optionClass}>
                  All departments
                </option>
                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id} className={optionClass}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-semibold text-muted-foreground">
                Search batch <span className="font-normal">({trendBatchIds.length}/{TREND_BATCH_LIMIT})</span>
              </span>
              <input
                type="search"
                value={trendBatchSearch}
                onChange={(event) => setTrendBatchSearch(event.target.value)}
                placeholder="Type batch name…"
                className={selectClass}
                aria-label="Search batches for attendance trend"
              />
            </label>
          </div>

          <div className="mb-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <div className="border border-border bg-background/40">
              <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
                <span>
                  Showing {trendBatchesForPicker.length}
                  {trendMatchCount > TREND_SEARCH_RESULT_LIMIT
                    ? ` of ${trendMatchCount}`
                    : trendMatchCount
                      ? ` / ${trendMatchCount}`
                      : ''}{' '}
                  batches
                </span>
                <span>Click to add · max {TREND_BATCH_LIMIT}</span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {batchCatalog.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">No batches available in this branch.</p>
                ) : trendBatchesForPicker.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">No batches match this department/search.</p>
                ) : (
                  trendBatchesForPicker.map((batch) => {
                    const selected = trendBatchIds.includes(batch.id)
                    const atLimit = !selected && trendBatchIds.length >= TREND_BATCH_LIMIT
                    return (
                      <button
                        key={batch.id}
                        type="button"
                        disabled={selected || atLimit}
                        onClick={() => addTrendBatch(batch.id)}
                        className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{batch.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {batch.departmentName}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                          {selected ? 'Added' : atLimit ? 'Limit' : 'Add'}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
              {trendMatchCount > TREND_SEARCH_RESULT_LIMIT && (
                <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                  Refine search or department to see more batches.
                </div>
              )}
            </div>

            <div className="border border-border bg-background/40 p-3">
              <div className="mb-2 text-sm font-semibold">Selected for chart</div>
              {selectedTrendBatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">Select at least one batch.</p>
              ) : (
                <div className="space-y-2">
                  {selectedTrendBatches.map((batch) => (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between gap-2 border border-border bg-card px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{batch.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{batch.departmentName}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTrendBatch(batch.id)}
                        className="shrink-0 border border-border px-2 py-1 text-xs font-semibold hover:bg-accent"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {trendNotice && (
            <div className="mb-3 border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 text-sm text-[#153e90] dark:text-white">
              {trendNotice}
            </div>
          )}
          <AttendanceTrendChart points={trendPoints} series={trendSeries} loading={trendLoading || loading} />
          <p className="mt-3 text-xs text-muted-foreground">
            X: {trendFromDate} → {trendToDate} · Y: daily attendance % (present students ÷ batch
            students). All present = 100%. Max 93 days · max {TREND_BATCH_LIMIT} batches.
          </p>
        </ChartCard>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {canSeeAcademic && (
          <ChartCard
            title="Department Distribution"
            subtitle="Students and batches per department. % is share of the selected metric. Avg = students ÷ batches."
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1.5 text-sm">
                <span className="font-semibold text-muted-foreground">Metric</span>
                <select
                  value={departmentPieMode}
                  onChange={(e) => setDepartmentPieMode(e.target.value as DepartmentPieMode)}
                  className={selectClass}
                  aria-label="Department pie metric"
                >
                  <option value="students" className={optionClass}>
                    Students in each department
                  </option>
                  <option value="batches" className={optionClass}>
                    Batches in each department
                  </option>
                  <option value="avg" className={optionClass}>
                    Avg students per batch
                  </option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-semibold text-muted-foreground">Department</span>
                <select
                  value={departmentPieDepartmentId}
                  onChange={(e) => setDepartmentPieDepartmentId(e.target.value)}
                  className={selectClass}
                  aria-label="Filter department pie by department"
                >
                  <option value="all" className={optionClass}>
                    All departments
                  </option>
                  {departmentOptions.map((department) => (
                    <option key={department.id} value={department.id} className={optionClass}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-semibold text-muted-foreground">Mode</span>
                <select
                  value={departmentPieBatchMode}
                  onChange={(e) =>
                    setDepartmentPieBatchMode(e.target.value as 'all' | 'online' | 'offline')
                  }
                  className={selectClass}
                  aria-label="Filter department pie by batch mode"
                >
                  <option value="all" className={optionClass}>
                    All modes
                  </option>
                  <option value="online" className={optionClass}>
                    Online
                  </option>
                  <option value="offline" className={optionClass}>
                    Onsite
                  </option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-semibold text-muted-foreground">Batch status</span>
                <select
                  value={departmentPieStatus}
                  onChange={(e) => setDepartmentPieStatus(e.target.value)}
                  className={selectClass}
                  aria-label="Filter department pie by batch status"
                >
                  <option value="all" className={optionClass}>
                    All statuses
                  </option>
                  <option value="active" className={optionClass}>
                    Active
                  </option>
                  <option value="full" className={optionClass}>
                    Full
                  </option>
                  <option value="completed" className={optionClass}>
                    Completed
                  </option>
                  <option value="inactive" className={optionClass}>
                    Inactive (Cancelled)
                  </option>
                </select>
              </label>
            </div>
            {loading || !data ? (
              <div className="flex h-72 items-center justify-center border border-border text-sm text-muted-foreground">
                Loading chart…
              </div>
            ) : (
              <ClassicPieChart rows={departmentPieRows} mode={departmentPieMode} />
            )}
          </ChartCard>
        )}

        {canSeeMarks && (
          <ChartCard
            title="Marks Overview"
            subtitle="All tasks = class average per task. One task = each student’s mentor / HOD / Final QA mark."
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1.5 text-sm">
                <span className="font-semibold text-muted-foreground">Department</span>
                <select
                  value={marksDepartmentId}
                  onChange={(event) => {
                    setMarksDepartmentId(event.target.value)
                    setMarksBatchId('all')
                    setMarksTaskId('all')
                    setMarksBatchSearch('')
                  }}
                  className={selectClass}
                  aria-label="Filter marks by department"
                >
                  <option value="all" className={optionClass}>
                    All departments
                  </option>
                  {departmentOptions.map((department) => (
                    <option key={department.id} value={department.id} className={optionClass}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-semibold text-muted-foreground">Search batch</span>
                <input
                  type="search"
                  value={marksBatchSearch}
                  onChange={(event) => setMarksBatchSearch(event.target.value)}
                  placeholder="Type batch name…"
                  className={selectClass}
                  aria-label="Search batches for marks overview"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-semibold text-muted-foreground">Batch</span>
                <select
                  value={marksBatchId}
                  onChange={(event) => {
                    setMarksBatchId(event.target.value)
                    setMarksTaskId('all')
                  }}
                  className={selectClass}
                  aria-label="Filter marks by batch"
                >
                  <option value="all" className={optionClass}>
                    All batches
                    {marksDepartmentId !== 'all' ? ' in department' : ''}
                  </option>
                  {marksBatchesForSelect.map((batch) => (
                    <option key={batch.id} value={batch.id} className={optionClass}>
                      {batch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-semibold text-muted-foreground">Task</span>
                <select
                  value={marksTaskId}
                  onChange={(event) => setMarksTaskId(event.target.value)}
                  className={selectClass}
                  aria-label="Filter marks by task"
                >
                  <option value="all" className={optionClass}>
                    All tasks
                  </option>
                  {marksTasks.map((task) => (
                    <option key={task.id} value={task.id} className={optionClass}>
                      {task.batchName ? `${task.title} · ${task.batchName}` : task.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {marksNotice && (
              <div className="mb-3 border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 text-sm text-[#153e90] dark:text-white">
                {marksNotice}
              </div>
            )}
            <MarksBarChart data={marksBars} loading={marksLoading || loading} />
            <p className="mt-3 text-xs text-muted-foreground">
              All tasks: up to 12 recent task averages (# + due date). One task: up to 20 students (# +
              first name). Hover for full details.
            </p>
          </ChartCard>
        )}

      </div>

      {(canSeeMentors || canSeeReview) && (
        <div className="grid items-stretch gap-2.5 xl:grid-cols-2">
          {canSeeMentors && (
            <ChartCard
              className="h-full !p-4 [&_.chart-card-head]:mb-3 [&_.chart-card-head]:min-h-[3.25rem]"
              title="Mentor Overview"
              subtitle="Thin rating bars for HOD / Trainer mentors. Final QA excluded. Photo on each bar top."
            >
              <div className="mb-3.5 grid gap-2 sm:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-muted-foreground">Department</span>
                  <select
                    value={mentorDepartmentId}
                    onChange={(event) => setMentorDepartmentId(event.target.value)}
                    className={selectClass}
                    aria-label="Filter mentors by department"
                  >
                    <option value="all" className={optionClass}>
                      All departments
                    </option>
                    {departmentOptions.map((department) => (
                      <option key={department.id} value={department.id} className={optionClass}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="font-semibold text-muted-foreground">Mentor profile</span>
                  <select
                    value={mentorProfileSlug}
                    onChange={(event) => setMentorProfileSlug(event.target.value)}
                    className={selectClass}
                    aria-label="Filter by mentor permission profile under Mentor parent role"
                  >
                    <option value="all" className={optionClass}>
                      All mentor profiles (not Final QA)
                    </option>
                    {mentorProfileOptions.map((profile) => (
                      <option key={profile.id} value={profile.slug} className={optionClass}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {mentorNotice ? (
                <div className="mb-1.5 border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-1.5 text-sm text-[#153e90] dark:text-white">
                  {mentorNotice}
                </div>
              ) : null}
              <div className="h-80 shrink-0">
                <MentorOverviewChart data={mentorPoints} loading={mentorLoading || loading} />
              </div>
              <p className="mt-2 min-h-[2rem] shrink-0 text-xs text-muted-foreground">
                Y-axis: rating 0–5 · X-axis: mentor name · Colored thin bars · Photo on bar top
                {mentorTotal ? ` · ${mentorTotal} in filter` : ''}.
              </p>
            </ChartCard>
          )}

          {canSeeReview && (
            <ChartCard
              className="h-full !p-4 [&_.chart-card-head]:mb-3 [&_.chart-card-head]:min-h-[3.25rem]"
              title="Review Pipeline"
              subtitle="Open queues across mentor, HOD, QA and approved. Filter by department, batch, and task."
            >
              <div className="mb-1.5 grid gap-2 sm:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-muted-foreground">Department</span>
                  <select
                    value={reviewDepartmentId}
                    onChange={(event) => {
                      setReviewDepartmentId(event.target.value)
                      setReviewBatchId('all')
                      setReviewTaskId('all')
                    }}
                    className={selectClass}
                    aria-label="Filter review pipeline by department"
                  >
                    <option value="all" className={optionClass}>
                      All departments
                    </option>
                    {departmentOptions.map((department) => (
                      <option key={department.id} value={department.id} className={optionClass}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-muted-foreground">Batch</span>
                  <select
                    value={reviewBatchId}
                    onChange={(event) => {
                      setReviewBatchId(event.target.value)
                      setReviewTaskId('all')
                    }}
                    className={selectClass}
                    aria-label="Filter review pipeline by batch"
                  >
                    <option value="all" className={optionClass}>
                      All batches
                      {reviewDepartmentId !== 'all' ? ' in department' : ''}
                    </option>
                    {reviewBatchesForSelect.map((batch) => (
                      <option key={batch.id} value={batch.id} className={optionClass}>
                        {batch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-muted-foreground">Task</span>
                  <select
                    value={reviewTaskId}
                    onChange={(event) => setReviewTaskId(event.target.value)}
                    className={selectClass}
                    aria-label="Filter review pipeline by task in batch"
                    disabled={reviewBatchId === 'all' && reviewTasks.length === 0}
                  >
                    <option value="all" className={optionClass}>
                      {reviewBatchId === 'all' ? 'All tasks in scope' : 'All tasks in batch'}
                    </option>
                    {reviewTasks.map((task) => (
                      <option key={task.id} value={task.id} className={optionClass}>
                        {task.batchName && reviewBatchId === 'all'
                          ? `${task.title} · ${task.batchName}`
                          : task.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {reviewNotice ? (
                <div className="mb-1.5 border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-1.5 text-sm text-[#153e90] dark:text-white">
                  {reviewNotice}
                </div>
              ) : null}
              <div className="h-80 shrink-0">
                {reviewLoading || loading ? (
                  <div className="flex h-80 items-center justify-center border border-border text-sm text-muted-foreground">
                    Loading chart…
                  </div>
                ) : (
                  <ModernBarGraph data={reviewPipeline} unit="" />
                )}
              </div>
              <p className="mt-2 min-h-[2rem] shrink-0 text-xs text-muted-foreground">
                Counts for tasks in the selected department / batch / task.
              </p>
            </ChartCard>
          )}
        </div>
      )}

      {canSeePlacement && (
        <ChartCard
          title="Placement Pipeline"
          subtitle="Area chart of placement stages. Filter by department, batch start dates, and online/offline."
        >
          <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-muted-foreground">Department</span>
              <select
                value={placementDepartmentId}
                onChange={(event) => setPlacementDepartmentId(event.target.value)}
                className={selectClass}
                aria-label="Filter placement by department"
              >
                <option value="all" className={optionClass}>
                  All departments
                </option>
                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id} className={optionClass}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-muted-foreground">Start date from</span>
              <input
                type="date"
                value={placementFromDate}
                onChange={(event) => setPlacementFromDate(event.target.value)}
                className={selectClass}
                aria-label="Filter batches by start date from"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-muted-foreground">Start date to</span>
              <input
                type="date"
                value={placementToDate}
                onChange={(event) => setPlacementToDate(event.target.value)}
                className={selectClass}
                aria-label="Filter batches by start date to"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-muted-foreground">Mode</span>
              <select
                value={placementMode}
                onChange={(event) => setPlacementMode(event.target.value as PlacementBatchModeFilter)}
                className={selectClass}
                aria-label="Filter batches by online or offline"
              >
                <option value="all" className={optionClass}>
                  Online and offline
                </option>
                <option value="online" className={optionClass}>
                  Online
                </option>
                <option value="offline" className={optionClass}>
                  Offline
                </option>
              </select>
            </label>
          </div>
          {placementNotice ? (
            <div className="mb-2 border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-1.5 text-sm text-[#153e90] dark:text-white">
              {placementNotice}
            </div>
          ) : null}
          <PlacementStageAreaChart data={placementPoints} loading={placementLoading || loading} />
          <p className="mt-2 text-xs text-muted-foreground">
            X-axis: Eligible → Applied → Interview → Rejected → Placed · Y-axis: counts. Eligible =
            placement-ready students not yet placed.
          </p>
        </ChartCard>
      )}

    </div>
  )
}
