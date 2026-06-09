'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { useApp } from '@/lib/app-context'
import { mockWorkstreams, mockProjects, mockTasks } from '@/lib/mock-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import type { SyllabusLevel, WorkPackage } from '@/lib/types'
import {
  TrendingUp,
  Code2,
  Film,
  BarChart3,
  ShieldCheck,
  Boxes,
  ArrowLeft,
  Clock,
  Target,
  Wrench,
  Award,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  BookOpen,
  Layers,
  Star,
  FileText,
  ExternalLink,
} from 'lucide-react'

const iconMap: Record<string, React.ElementType> = {
  TrendingUp, Code2, Film, BarChart3, ShieldCheck, Boxes,
}

const levelColorMap: Record<string, { badge: string; dot: string; bg: string }> = {
  Foundation:   { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400', bg: 'border-l-emerald-500' },
  Intermediate: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20',       dot: 'bg-amber-400',   bg: 'border-l-amber-500' },
  Advanced:     { badge: 'bg-rose-500/15 text-rose-400 border-rose-500/20',           dot: 'bg-rose-400',    bg: 'border-l-rose-500' },
}

function WorkPackageCard({ wp, index }: { wp: WorkPackage; index: number }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/50 transition-colors"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-xs font-mono font-bold text-muted-foreground flex-shrink-0">
          {String(index + 1).padStart(2, '0')}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{wp.title}</p>
          <p className="text-xs text-muted-foreground truncate">{wp.estimatedTime}</p>
        </div>
        <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        {open
          ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border/40 bg-secondary/20">
          {/* Goal */}
          <div className="pt-4 mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Goal</p>
            <p className="text-sm leading-relaxed">{wp.goal}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {/* Skills */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {wp.skills.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs font-normal">{s}</Badge>
                ))}
              </div>
            </div>
            {/* Tools */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tools</p>
              <div className="flex flex-wrap gap-1.5">
                {wp.tools.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs font-normal">{t}</Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Practice Tasks */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Practice Tasks</p>
            <ul className="space-y-1.5">
              {wp.practiceTasks.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="leading-relaxed">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Final Deliverable */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-3">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Final Deliverable</p>
            <p className="text-sm leading-relaxed">{wp.finalDeliverable}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function LevelSection({ level }: { level: SyllabusLevel }) {
  const colors = levelColorMap[level.level]
  const totalTime = level.workPackages.length + ' packages'

  return (
    <div className={`border-l-2 pl-5 ${colors.bg} mb-8`}>
      <div className="flex items-center gap-3 mb-1.5">
        <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${colors.badge}`}>
          {level.level}
        </span>
        <span className="text-xs text-muted-foreground">{totalTime}</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{level.description}</p>
      <div className="space-y-2">
        {level.workPackages.map((wp, i) => (
          <WorkPackageCard key={wp.id} wp={wp} index={i} />
        ))}
      </div>
    </div>
  )
}

export default function WorkstreamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { currentUser, currentRole } = useApp()

  const ws = mockWorkstreams.find((w) => w.id === id)
  const projects = mockProjects.filter((p) => p.workstreamId === id)

  if (!ws) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-96">
          <p className="text-lg text-muted-foreground">Workstream not found</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/workstreams">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Workstreams
            </Link>
          </Button>
        </div>
      </AppShell>
    )
  }

  const Icon = iconMap[ws.icon] ?? Code2
  const totalWPs = ws.syllabus.reduce((s, lvl) => s + lvl.workPackages.length, 0)

  const getProgress = () => {
    if (currentRole !== 'student' || !currentUser) return 0
    const pIds = projects.map((p) => p.id)
    const all = mockTasks.filter((t) => pIds.includes(t.projectId) && t.assignedTo === currentUser.id)
    if (all.length === 0) return 0
    return (all.filter((t) => t.status === 'completed').length / all.length) * 100
  }

  const progress = getProgress()
  const requiredTools = ws.tools.filter((t) => t.required)
  const optionalTools = ws.tools.filter((t) => !t.required)

  // Group tools by category
  const toolsByCategory = ws.tools.reduce<Record<string, typeof ws.tools>>((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = []
    acc[tool.category].push(tool)
    return acc
  }, {})

  // Pass mark bar width
  const passWidth = ws.rubric.passMark
  const distinctionWidth = ws.rubric.distincionMark

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        {/* Back */}
        <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
          <Link href="/workstreams">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            All Workstreams
          </Link>
        </Button>

        {/* Hero Header */}
        <div className="mb-8">
          <div className="flex items-start gap-4 mb-5">
            <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 ${ws.color} flex-shrink-0`}>
              <Icon className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{ws.name}</h1>
              </div>
              <p className="text-sm text-primary font-medium mb-1">{ws.tagline}</p>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">{ws.description}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border/60 bg-card px-4 py-3">
              <p className="text-lg font-bold">{ws.totalEstimatedWeeks}</p>
              <p className="text-xs text-muted-foreground">Weeks</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card px-4 py-3">
              <p className="text-lg font-bold">{totalWPs}</p>
              <p className="text-xs text-muted-foreground">Work Packages</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card px-4 py-3">
              <p className="text-lg font-bold">{ws.portfolioOutputs.length}</p>
              <p className="text-xs text-muted-foreground">Portfolio Outputs</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card px-4 py-3">
              <p className="text-lg font-bold">{ws.rubric.passMark}%</p>
              <p className="text-xs text-muted-foreground">Pass Mark</p>
            </div>
          </div>

          {/* Progress (student only) */}
          {currentRole === 'student' && (
            <div className="mt-4">
              <div className="flex justify-between mb-1.5 text-xs">
                <span className="text-muted-foreground">Your progress</span>
                <span className="font-medium">{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="mb-6 h-9 w-full justify-start gap-1 bg-secondary/50 p-1 rounded-lg overflow-x-auto">
            <TabsTrigger value="overview" className="text-xs h-7 px-3">Overview</TabsTrigger>
            <TabsTrigger value="syllabus" className="text-xs h-7 px-3">Syllabus</TabsTrigger>
            <TabsTrigger value="assignments" className="text-xs h-7 px-3">Assignments</TabsTrigger>
            <TabsTrigger value="rubric" className="text-xs h-7 px-3">Rubric</TabsTrigger>
            <TabsTrigger value="tools" className="text-xs h-7 px-3">Tools</TabsTrigger>
            <TabsTrigger value="portfolio" className="text-xs h-7 px-3">Portfolio Outputs</TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW ── */}
          <TabsContent value="overview" className="space-y-6">
            {/* Level breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  Curriculum Structure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ws.syllabus.map((lvl) => {
                  const colors = levelColorMap[lvl.level]
                  return (
                    <div key={lvl.level} className="flex items-start gap-4">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${colors.badge}`}>
                        <span className="text-xs font-bold">{lvl.workPackages.length}</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{lvl.level}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{lvl.description}</p>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Portfolio outputs preview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4 text-muted-foreground" />
                  Portfolio Outputs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-3">
                  {ws.portfolioOutputs.map((po) => {
                    const colors = levelColorMap[po.level]
                    return (
                      <div key={po.id} className="rounded-lg border border-border/60 p-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-medium text-sm">{po.title}</p>
                          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${colors.badge}`}>
                            {po.level}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{po.description}</p>
                        <p className="text-xs text-primary mt-2 font-medium">{po.format}</p>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Rubric summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-muted-foreground" />
                  Assessment Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 mb-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Pass: </span>
                    <span className="font-semibold text-emerald-400">{ws.rubric.passMark}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Distinction: </span>
                    <span className="font-semibold text-amber-400">{ws.rubric.distincionMark}%</span>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {ws.rubric.categories.map((cat) => (
                    <div key={cat.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{cat.name}</span>
                        <span className="font-medium">{cat.weight}%</span>
                      </div>
                      <Progress value={cat.weight} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SYLLABUS ── */}
          <TabsContent value="syllabus">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                {totalWPs} work packages across {ws.syllabus.length} levels. Click any package to expand the full brief, skills, tools, and final deliverable.
              </p>
            </div>
            {ws.syllabus.map((lvl) => (
              <LevelSection key={lvl.level} level={lvl} />
            ))}
          </TabsContent>

          {/* ── ASSIGNMENTS ── */}
          <TabsContent value="assignments" className="space-y-4">
            {projects.length === 0 ? (
              <div className="rounded-lg border border-border/60 p-8 text-center">
                <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No projects linked to this workstream yet.</p>
              </div>
            ) : (
              projects.map((project, idx) => {
                const tasks = mockTasks.filter(
                  (t) => t.projectId === project.id && t.assignedTo === currentUser?.id
                )
                const completedCount = tasks.filter((t) => t.status === 'completed').length
                const taskProgress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : project.progress

                return (
                  <Card key={project.id} className="border-border/60">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs font-normal">Project {idx + 1}</Badge>
                            <Badge
                              variant={project.status === 'live' ? 'default' : 'secondary'}
                              className="text-xs font-normal"
                            >
                              {project.status}
                            </Badge>
                          </div>
                          <CardTitle className="text-base">{project.name}</CardTitle>
                        </div>
                        {project.dueDate && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                            <Clock className="h-3 w-3" />
                            Due {new Date(project.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{project.description}</p>

                      {/* Outcomes */}
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Learning Outcomes</p>
                        <div className="flex flex-wrap gap-1.5">
                          {project.learningOutcomes.map((o) => (
                            <Badge key={o} variant="secondary" className="text-xs font-normal">{o}</Badge>
                          ))}
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{taskProgress.toFixed(0)}%</span>
                        </div>
                        <Progress value={taskProgress} className="h-1.5" />
                      </div>

                      <Button asChild size="sm" variant="outline" className="w-full">
                        <Link href={`/projects/${project.id}`}>
                          View Project
                          <ArrowLeft className="ml-1.5 h-3.5 w-3.5 rotate-180" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </TabsContent>

          {/* ── RUBRIC ── */}
          <TabsContent value="rubric" className="space-y-5">
            {/* Thresholds */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Grade Thresholds</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative h-8 rounded-lg bg-secondary overflow-hidden mb-3">
                  <div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-500/40 to-amber-500/40 flex items-center justify-end pr-2"
                    style={{ width: `${passWidth}%` }}
                  >
                    <span className="text-xs font-medium text-muted-foreground">Fail</span>
                  </div>
                  <div
                    className="absolute top-0 h-full bg-emerald-500/30 flex items-center justify-end pr-2"
                    style={{ left: `${passWidth}%`, width: `${distinctionWidth - passWidth}%` }}
                  >
                    <span className="text-xs font-medium text-emerald-400">Pass</span>
                  </div>
                  <div
                    className="absolute top-0 right-0 h-full bg-amber-500/30 flex items-center justify-center"
                    style={{ width: `${100 - distinctionWidth}%` }}
                  >
                    <span className="text-xs font-medium text-amber-400">Distinction</span>
                  </div>
                </div>
                <div className="flex gap-6 text-sm">
                  <div><span className="text-muted-foreground">Pass: </span><span className="font-semibold text-emerald-400">{ws.rubric.passMark}%+</span></div>
                  <div><span className="text-muted-foreground">Distinction: </span><span className="font-semibold text-amber-400">{ws.rubric.distincionMark}%+</span></div>
                </div>
              </CardContent>
            </Card>

            {/* Categories */}
            <div className="space-y-3">
              {ws.rubric.categories.map((cat, idx) => (
                <Card key={cat.name} className="border-border/60">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-xs font-mono text-muted-foreground">
                          {String(idx + 1).padStart(2, '0')}
                        </div>
                        <p className="font-medium text-sm">{cat.name}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs font-semibold">
                        {cat.weight}% weight
                      </Badge>
                    </div>
                    <Progress value={cat.weight} className="h-1.5 mb-3" />
                    <ul className="space-y-1">
                      {cat.criteria.map((c, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="h-1 w-1 rounded-full bg-primary flex-shrink-0" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── TOOLS ── */}
          <TabsContent value="tools" className="space-y-6">
            {Object.entries(toolsByCategory).map(([category, tools]) => (
              <div key={category}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {tools.map((tool) => (
                    <div
                      key={tool.name}
                      className="flex items-start gap-3 rounded-lg border border-border/60 bg-card px-3.5 py-3"
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${tool.required ? 'bg-primary/10' : 'bg-secondary'}`}>
                        <Wrench className={`h-3.5 w-3.5 ${tool.required ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="font-medium text-sm">{tool.name}</p>
                          {tool.required && (
                            <Badge className="text-xs font-normal px-1.5 py-0 h-4">Required</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{tool.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* ── PORTFOLIO OUTPUTS ── */}
          <TabsContent value="portfolio" className="space-y-4">
            <p className="text-sm text-muted-foreground mb-2">
              These are the deliverables that make up your portfolio for this workstream. Each output is reviewed and must be approved before it is added to your public portfolio.
            </p>
            {ws.portfolioOutputs.map((po) => {
              const colors = levelColorMap[po.level]
              return (
                <Card key={po.id} className="border-border/60">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <p className="font-medium text-sm">{po.title}</p>
                      </div>
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${colors.badge}`}>
                        {po.level}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">{po.description}</p>
                    <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                      <ExternalLink className="h-3 w-3" />
                      {po.format}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
