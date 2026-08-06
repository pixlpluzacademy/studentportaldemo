'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useAuth } from '@/lib/auth/provider'
import {
  buildDashboardView,
  fetchDashboardStats,
  getDashboardRoleKey,
  type ChartItem,
  type DashboardStats,
  type SummaryCard,
} from '@/lib/data/dashboard'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import { cn } from '@/lib/utils'

function CustomIcon({
  icon,
  folder,
  alt = '',
  className,
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
      className={cn('h-5 w-5 shrink-0 object-contain', className)}
      onError={(event) => {
        event.currentTarget.src = `/icons/${folder}/dashboard.svg`
      }}
    />
  )
}

function StatCard({ card, iconFolder }: { card: SummaryCard; iconFolder: string }) {
  return (
    <div className="border border-border bg-card p-5 transition hover:border-[#153e90]/40 dark:hover:border-[#6ee75a]/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{card.label}</p>
          <div className="mt-3 text-3xl font-bold tracking-tight">{card.value}</div>
        </div>

        <div className="flex h-11 w-11 items-center justify-center bg-[#153e90]/10 dark:bg-[#6ee75a]/10">
          <CustomIcon icon={card.icon} folder={iconFolder} alt={card.label} />
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{card.helper}</p>
    </div>
  )
}

function MiniChart({
  title,
  data,
  iconFolder,
}: {
  title: string
  data: ChartItem[]
  iconFolder: string
}) {
  const max = Math.max(...data.map((item) => item.value), 1)

  return (
    <div className="border border-border bg-card p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>

        <div className="flex h-9 w-9 items-center justify-center bg-[#153e90]/10 dark:bg-[#6ee75a]/10">
          <CustomIcon icon="analytics.svg" folder={iconFolder} alt="Analytics" />
        </div>
      </div>

      <div className="space-y-4">
        {data.map((item) => {
          const width = `${Math.max((item.value / max) * 100, 8)}%`

          return (
            <div key={item.label}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-semibold">{item.value}</span>
              </div>

              <div className="h-2 bg-muted">
                <div className="h-2 bg-[#153e90] dark:bg-[#6ee75a]" style={{ width }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}

const initialStats: DashboardStats = {
  studentCount: 0,
  batchCount: 0,
  onlineBatchCount: 0,
  offlineBatchCount: 0,
  mentorCount: 0,
  taskCount: 0,
  openTaskCount: 0,
  submissionCount: 0,
  pendingMentorReviewCount: 0,
  pendingHodReviewCount: 0,
  pendingQaCount: 0,
  qaApprovedCount: 0,
  revisionCount: 0,
  openComplaintsCount: 0,
  classMaterialsCount: 0,
  attendanceAveragePercent: 0,
  studentAttendancePercent: 0,
  studentPendingTasks: 0,
  studentSubmittedTasks: 0,
  studentAverageMark: 0,
  studentOpenComplaints: 0,
  studentTaskProgress: 0,
}

export default function DashboardPage() {
  const { role, user, canModule, parentRoleId } = useAuth()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState<DashboardStats>(initialStats)
  const [statsLoading, setStatsLoading] = useState(true)

  const { activeBranch, activeBranchId, loading: branchLoading } = useBranchScope()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setStatsLoading(false)
      return
    }

    if (branchLoading && parentRoleId !== 'student') {
      setStatsLoading(true)
      return
    }

    let cancelled = false

    async function loadStats() {
      setStatsLoading(true)

      const result = await fetchDashboardStats({
        branchId: activeBranchId,
        userId: user!.id,
        parentRoleId,
      })

      if (!cancelled) {
        setStats(result)
        setStatsLoading(false)
      }
    }

    void loadStats()

    return () => {
      cancelled = true
    }
  }, [activeBranchId, branchLoading, parentRoleId, user?.id])

  const iconFolder = mounted && resolvedTheme === 'light' ? 'light-mode' : 'dark-mode'

  const roleKey = getDashboardRoleKey(parentRoleId, role?.name, role?.id)

  const data = useMemo(
    () =>
      buildDashboardView({
        roleKey,
        stats,
        userName: user?.fullName,
        branchCode: activeBranch?.code ?? undefined,
        branchName: activeBranch?.name ?? undefined,
      }),
    [activeBranch?.code, activeBranch?.name, roleKey, stats, user?.fullName],
  )

  const visibleCards = data.cards.filter((card) => !card.moduleId || canModule(card.moduleId))
  const visibleActions = data.quickActions.filter((action) => canModule(action.moduleId))

  return (
    <div className="space-y-6">
      <div className="border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">{data.badge}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{data.title}</h1>
            <p className="mt-2 max-w-4xl text-muted-foreground">{data.subtitle}</p>
            {statsLoading && (
              <p className="mt-3 text-sm text-muted-foreground">Loading live dashboard counts…</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleCards.map((card) => (
          <StatCard key={card.label} card={card} iconFolder={iconFolder} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <div className="border border-border bg-card p-5">
            <SectionHeader title={data.pendingTitle} subtitle="Live items generated from your database counts." />

            <div className="mt-5 space-y-3">
              {data.pendingItems.map((item) => (
                <div key={item.title} className="flex items-start justify-between gap-4 border border-border bg-background p-4">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </div>

                  <span className="shrink-0 bg-[#153e90]/10 px-3 py-1 text-xs font-semibold text-[#153e90] dark:bg-[#6ee75a]/10 dark:text-[#6ee75a]">
                    {item.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <MiniChart title={data.chartTitle} data={data.chartData} iconFolder={iconFolder} />
        </div>

        <div className="space-y-5">
          <div className="border border-border bg-card p-5">
            <SectionHeader title="Quick Actions" subtitle="Actions visible only when permission is enabled." />

            <div className="mt-5 space-y-3">
              {visibleActions.length > 0 ? (
                visibleActions.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="group flex items-center justify-between border border-border bg-background p-4 transition hover:border-[#153e90]/50 dark:hover:border-[#6ee75a]/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center bg-[#153e90]/10 dark:bg-[#6ee75a]/10">
                        <CustomIcon icon={action.icon} folder={iconFolder} alt={action.label} />
                      </span>
                      <span className="font-semibold">{action.label}</span>
                    </div>

                    <span className="text-sm text-muted-foreground transition group-hover:text-foreground">Open</span>
                  </Link>
                ))
              ) : (
                <div className="border border-border bg-background p-4 text-sm text-muted-foreground">
                  No quick actions available for your current permissions.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
