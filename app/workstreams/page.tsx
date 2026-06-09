'use client'

import { AppShell } from '@/components/app-shell'
import { useApp } from '@/lib/app-context'
import { mockWorkstreams, mockProjects, mockTasks } from '@/lib/mock-data'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  TrendingUp,
  Code2,
  Film,
  BarChart3,
  ShieldCheck,
  Boxes,
  ArrowRight,
  Clock,
  Award,
  BookOpen,
} from 'lucide-react'
import Link from 'next/link'

const iconMap: Record<string, React.ElementType> = {
  TrendingUp,
  Code2,
  Film,
  BarChart3,
  ShieldCheck,
  Boxes,
}

const accentBorderMap: Record<string, string> = {
  orange: 'hover:border-orange-500/50',
  blue: 'hover:border-blue-500/50',
  red: 'hover:border-red-500/50',
  violet: 'hover:border-violet-500/50',
  green: 'hover:border-green-500/50',
  cyan: 'hover:border-cyan-500/50',
}

const accentBgMap: Record<string, string> = {
  orange: 'bg-orange-500/10',
  blue: 'bg-blue-500/10',
  red: 'bg-red-500/10',
  violet: 'bg-violet-500/10',
  green: 'bg-green-500/10',
  cyan: 'bg-cyan-500/10',
}

const accentBarMap: Record<string, string> = {
  orange: '[&>div]:bg-orange-500',
  blue: '[&>div]:bg-blue-500',
  red: '[&>div]:bg-red-500',
  violet: '[&>div]:bg-violet-500',
  green: '[&>div]:bg-green-500',
  cyan: '[&>div]:bg-cyan-500',
}

export default function WorkstreamsPage() {
  const { currentUser, currentRole } = useApp()

  const getWorkstreamProgress = (workstreamId: string) => {
    if (currentRole !== 'student' || !currentUser) return 0
    const wsProjects = mockProjects.filter((p) => p.workstreamId === workstreamId)
    const projectIds = wsProjects.map((p) => p.id)
    const wsTasks = mockTasks.filter(
      (t) => projectIds.includes(t.projectId) && t.assignedTo === currentUser.id
    )
    if (wsTasks.length === 0) return 0
    return (wsTasks.filter((t) => t.status === 'completed').length / wsTasks.length) * 100
  }

  const totalWeeks = mockWorkstreams.reduce((sum, ws) => sum + ws.totalEstimatedWeeks, 0)
  const totalWorkPackages = mockWorkstreams.reduce(
    (sum, ws) => sum + ws.syllabus.reduce((s, lvl) => s + lvl.workPackages.length, 0),
    0
  )
  const totalOutputs = mockWorkstreams.reduce((sum, ws) => sum + ws.portfolioOutputs.length, 0)

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Workstreams</h1>
          <p className="text-muted-foreground max-w-2xl">
            Six industry-aligned learning paths built around real deliverables, structured rubrics, and portfolio outputs that matter to employers.
          </p>
        </div>

        {/* Top stats strip */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <Card className="border-border/60">
            <CardContent className="flex items-center gap-3 pt-5 pb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{totalWorkPackages}</p>
                <p className="text-xs text-muted-foreground">Work Packages</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="flex items-center gap-3 pt-5 pb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{totalWeeks} wks</p>
                <p className="text-xs text-muted-foreground">Total Duration</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="flex items-center gap-3 pt-5 pb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Award className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{totalOutputs}</p>
                <p className="text-xs text-muted-foreground">Portfolio Outputs</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Workstreams Grid */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {mockWorkstreams.map((ws) => {
            const Icon = iconMap[ws.icon] ?? Code2
            const projects = mockProjects.filter((p) => p.workstreamId === ws.id)
            const progress = getWorkstreamProgress(ws.id)
            const levelCount = ws.syllabus.length
            const wpCount = ws.syllabus.reduce((s, lvl) => s + lvl.workPackages.length, 0)
            const borderClass = accentBorderMap[ws.accentColor] ?? 'hover:border-primary/50'
            const bgClass = accentBgMap[ws.accentColor] ?? 'bg-primary/10'
            const barClass = accentBarMap[ws.accentColor] ?? ''

            return (
              <Card
                key={ws.id}
                className={`group border border-border/60 transition-all duration-200 ${borderClass}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${bgClass} ${ws.color} group-hover:scale-105 transition-transform`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {ws.totalEstimatedWeeks} weeks
                    </Badge>
                  </div>
                  <CardTitle className="text-lg leading-snug">{ws.name}</CardTitle>
                  <p className="text-xs text-primary font-medium mt-0.5">{ws.tagline}</p>
                  <CardDescription className="text-sm mt-1 leading-relaxed line-clamp-2">
                    {ws.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  {/* Level pills */}
                  <div className="flex items-center gap-1.5 mb-4">
                    {ws.syllabus.map((lvl) => (
                      <Badge key={lvl.level} variant="outline" className="text-xs font-normal px-2 py-0.5">
                        {lvl.level}
                      </Badge>
                    ))}
                    <span className="text-xs text-muted-foreground ml-auto">{wpCount} packages</span>
                  </div>

                  {/* Portfolio outputs preview */}
                  <div className="space-y-1 mb-4">
                    {ws.portfolioOutputs.slice(0, 3).map((po) => (
                      <div key={po.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className={`h-1 w-1 rounded-full flex-shrink-0 ${ws.color.replace('text-', 'bg-')}`} />
                        <span className="truncate">{po.title}</span>
                      </div>
                    ))}
                    {ws.portfolioOutputs.length > 3 && (
                      <p className="text-xs text-muted-foreground pl-3">
                        +{ws.portfolioOutputs.length - 3} more outputs
                      </p>
                    )}
                  </div>

                  {/* Progress bar for students */}
                  {currentRole === 'student' && (
                    <div className="mb-4">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">Your Progress</span>
                        <span className="text-xs font-medium">{progress.toFixed(0)}%</span>
                      </div>
                      <Progress value={progress} className={`h-1.5 ${barClass}`} />
                    </div>
                  )}

                  <Button asChild size="sm" className="w-full">
                    <Link href={`/workstreams/${ws.id}`}>
                      View Curriculum
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
