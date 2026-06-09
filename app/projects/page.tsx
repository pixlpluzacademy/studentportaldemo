'use client'

import { AppShell } from '@/components/app-shell'
import { useData } from '@/lib/data-context'
import { useApp } from '@/lib/app-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Search, Calendar, ChevronRight, CircleDot, CheckCircle2, Clock,
  FolderKanban, ArrowUpDown, User,
} from 'lucide-react'
import Link from 'next/link'
import { useState, useMemo } from 'react'
import type { Project } from '@/lib/types'

const workstreamColors: Record<string, string> = {
  'ws-dm':  'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'ws-swd': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'ws-mp':  'bg-red-500/10 text-red-400 border-red-500/20',
  'ws-ds':  'bg-violet-500/10 text-violet-400 border-violet-500/20',
  'ws-cs':  'bg-green-500/10 text-green-400 border-green-500/20',
  'ws-3d':  'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
}

function ProgressRing({ value, size = 40 }: { value: number; size?: number }) {
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={3} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke="hsl(var(--primary))" strokeWidth={3}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
    </svg>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const { workstreams, students, deliverables } = useData()
  const workstream = workstreams.find(w => w.id === project.workstreamId)
  const projectStudents = students.filter(s => project.studentIds.includes(s.id))
  const projectDeliverables = deliverables.filter(d => d.projectId === project.id)
  const nextDeliverable = projectDeliverables
    .filter(d => d.status === 'pending' || d.status === 'submitted')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]

  const isOverdue = project.dueDate && new Date(project.dueDate) < new Date()
  const daysLeft = project.dueDate
    ? Math.ceil((new Date(project.dueDate).getTime() - Date.now()) / 86400000)
    : null

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="group h-full hover:border-primary/50 transition-all duration-200 cursor-pointer flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${workstreamColors[project.workstreamId] ?? 'bg-muted text-muted-foreground border-border'}`}>
                  {workstream?.name}
                </span>
                {project.status === 'archived' && (
                  <Badge variant="secondary" className="text-xs">Archived</Badge>
                )}
              </div>
              <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors">
                {project.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {project.description}
              </p>
            </div>
            <div className="flex-shrink-0 flex flex-col items-center">
              <div className="relative">
                <ProgressRing value={project.progress} />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold rotate-0">
                  {project.progress}%
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 flex-1 flex flex-col justify-end gap-3">
          {/* Next deliverable */}
          {nextDeliverable && (
            <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-2">
              <CircleDot className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{nextDeliverable.title}</p>
                <p className="text-xs text-muted-foreground">
                  Due {new Date(nextDeliverable.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
              {nextDeliverable.status === 'submitted' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-yellow-500/40 text-yellow-400">
                  In Review
                </Badge>
              )}
            </div>
          )}

          {/* Footer row */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              {/* Mentor avatar */}
              {project.mentorId && (() => {
                const mentor = students.find(s => s.id === project.mentorId) ??
                  { name: 'Mentor', avatar: undefined, id: project.mentorId }
                return (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{mentor.name}</span>
                  </div>
                )
              })()}
            </div>
            <div className="flex items-center gap-1.5">
              {daysLeft !== null && (
                <div className={`flex items-center gap-1 ${isOverdue ? 'text-destructive' : daysLeft <= 7 ? 'text-yellow-400' : ''}`}>
                  <Calendar className="h-3 w-3" />
                  <span>
                    {isOverdue
                      ? `${Math.abs(daysLeft)}d overdue`
                      : `${daysLeft}d left`}
                  </span>
                </div>
              )}
              <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

type SortKey = 'dueDate' | 'progress' | 'name'

export default function ProjectsPage() {
  const { projects, workstreams } = useData()
  const { currentRole, currentUser } = useApp()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'live' | 'archived'>('live')
  const [workstreamFilter, setWorkstreamFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('dueDate')

  const filtered = useMemo(() => {
    return projects
      .filter(p => {
        const matchesTab = tab === 'live' ? p.status !== 'archived' : p.status === 'archived'
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.description.toLowerCase().includes(search.toLowerCase())
        const matchesWorkstream = workstreamFilter === 'all' || p.workstreamId === workstreamFilter
        const matchesRole = currentRole !== 'student' || p.studentIds.includes(currentUser?.id ?? '')
        return matchesTab && matchesSearch && matchesWorkstream && matchesRole
      })
      .sort((a, b) => {
        if (sortKey === 'dueDate') {
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        }
        if (sortKey === 'progress') return b.progress - a.progress
        return a.name.localeCompare(b.name)
      })
  }, [projects, tab, search, workstreamFilter, sortKey, currentRole, currentUser])

  const liveCount = projects.filter(p => p.status !== 'archived' && (currentRole !== 'student' || p.studentIds.includes(currentUser?.id ?? ''))).length
  const archivedCount = projects.filter(p => p.status === 'archived' && (currentRole !== 'student' || p.studentIds.includes(currentUser?.id ?? ''))).length

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {currentRole === 'student' ? 'Your active project assignments' : 'All cohort projects'}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Live / Archived toggle */}
          <Tabs value={tab} onValueChange={v => setTab(v as 'live' | 'archived')} className="flex-shrink-0">
            <TabsList className="h-9">
              <TabsTrigger value="live" className="gap-1.5 text-sm">
                <CircleDot className="h-3.5 w-3.5 text-green-400" />
                Live
                <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{liveCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="archived" className="gap-1.5 text-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                Archived
                <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{archivedCount}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Workstream filter */}
          <Select value={workstreamFilter} onValueChange={setWorkstreamFilter}>
            <SelectTrigger className="w-[170px] h-9 text-sm">
              <SelectValue placeholder="Workstream" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Workstreams</SelectItem>
              {workstreams.map(ws => (
                <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortKey} onValueChange={v => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-[150px] h-9 text-sm">
              <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dueDate">Due Date</SelectItem>
              <SelectItem value="progress">Progress</SelectItem>
              <SelectItem value="name">Name A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20">
              <FolderKanban className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-base font-medium mb-1">No projects found</p>
              <p className="text-sm text-muted-foreground">
                {search ? 'Try adjusting your search or filters' : `No ${tab} projects yet`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
