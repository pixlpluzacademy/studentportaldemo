'use client'

import { AppShell } from '@/components/app-shell'
import { useData } from '@/lib/data-context'
import { useApp } from '@/lib/app-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft, Calendar, Clock, CheckCircle2, Circle, Upload, ExternalLink,
  Github, Star, MessageSquare, User, Activity, FileText, Send,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState, useMemo } from 'react'
import type { Deliverable } from '@/lib/types'
import { cn } from '@/lib/utils'

const deliverableStatusConfig: Record<Deliverable['status'], { label: string; icon: typeof Circle; className: string }> = {
  pending: { label: 'Pending', icon: Circle, className: 'text-muted-foreground' },
  submitted: { label: 'In Review', icon: Clock, className: 'text-yellow-400' },
  approved: { label: 'Approved', icon: CheckCircle2, className: 'text-green-400' },
  'revision-requested': { label: 'Revision Needed', icon: Clock, className: 'text-orange-400' },
}

function DeliverableRow({
  deliverable,
  onSubmit,
  canSubmit,
}: {
  deliverable: Deliverable
  onSubmit: (del: Deliverable) => void
  canSubmit: boolean
}) {
  const cfg = deliverableStatusConfig[deliverable.status]
  const Icon = cfg.icon
  const isOverdue = deliverable.status === 'pending' && new Date(deliverable.dueDate) < new Date()

  return (
    <div className="flex items-center gap-4 py-3 px-4 rounded-lg hover:bg-secondary/30 transition-colors group">
      <Icon className={cn('h-4 w-4 flex-shrink-0', cfg.className)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{deliverable.title}</p>
          <span className={cn('text-xs', cfg.className)}>{cfg.label}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{deliverable.description}</p>
      </div>
      <div className={cn('text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1', isOverdue && 'text-destructive')}>
        <Calendar className="h-3 w-3" />
        {new Date(deliverable.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </div>
      {canSubmit && deliverable.status !== 'approved' && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onSubmit(deliverable)}
        >
          <Upload className="h-3 w-3 mr-1" />
          Submit
        </Button>
      )}
    </div>
  )
}

function SubmissionModal({
  deliverable,
  projectId,
  open,
  onOpenChange,
}: {
  deliverable: Deliverable | null
  projectId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { currentUser } = useApp()
  const { createSubmission, tasks } = useData()
  const [content, setContent] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [liveUrl, setLiveUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  if (!deliverable) return null

  // Find the associated task
  const relatedTask = tasks.find(t => t.projectId === projectId && t.status !== 'completed')

  const handleSubmit = () => {
    if (!content.trim() || !currentUser) return
    setSubmitting(true)
    setTimeout(() => {
      createSubmission({
        taskId: relatedTask?.id ?? `task-${projectId}`,
        projectId,
        deliverableId: deliverable.id,
        studentId: currentUser.id,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        content,
        githubUrl: githubUrl || undefined,
        liveUrl: liveUrl || undefined,
      })
      setSubmitting(false)
      setDone(true)
      setTimeout(() => {
        onOpenChange(false)
        setDone(false)
        setContent('')
        setGithubUrl('')
        setLiveUrl('')
      }, 1500)
    }, 600)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit: {deliverable.title}</DialogTitle>
          <DialogDescription>{deliverable.description}</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="h-12 w-12 text-green-400" />
            <p className="font-medium">Submitted successfully!</p>
            <p className="text-sm text-muted-foreground">Your mentor will review this soon.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>What did you build / deliver?</Label>
              <Textarea
                placeholder="Describe your work, what you implemented, key decisions you made..."
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Github className="h-3.5 w-3.5" /> GitHub URL <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                placeholder="https://github.com/you/repo"
                value={githubUrl}
                onChange={e => setGithubUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ExternalLink className="h-3.5 w-3.5" /> Live URL <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                placeholder="https://your-project.vercel.app"
                value={liveUrl}
                onChange={e => setLiveUrl(e.target.value)}
              />
            </div>
          </div>
        )}

        {!done && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!content.trim() || submitting}>
              <Send className="h-4 w-4 mr-2" />
              {submitting ? 'Submitting...' : 'Submit for Review'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function ProjectDetailPage() {
  const params = useParams()
  const { projects, workstreams, students, tasks, submissions, reviews, deliverables } = useData()
  const { currentRole } = useApp()
  const projectId = params.id as string

  const [submitTarget, setSubmitTarget] = useState<Deliverable | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const project = projects.find(p => p.id === projectId)
  const workstream = project ? workstreams.find(w => w.id === project.workstreamId) : null
  const projectStudents = project ? students.filter(s => project.studentIds.includes(s.id)) : []
  const mentor = project?.mentorId ? students.find(s => s.id === project.mentorId) ?? null : null
  const projectTasks = tasks.filter(t => t.projectId === projectId)
  const projectSubmissions = submissions.filter(s => s.projectId === projectId)
  const projectDeliverables = deliverables
    .filter(d => d.projectId === projectId)
    .sort((a, b) => a.order - b.order)

  const stats = useMemo(() => {
    const approved = projectDeliverables.filter(d => d.status === 'approved').length
    const total = projectDeliverables.length
    return { approved, total, pct: total > 0 ? Math.round((approved / total) * 100) : 0 }
  }, [projectDeliverables])

  const openSubmit = (del: Deliverable) => {
    setSubmitTarget(del)
    setModalOpen(true)
  }

  if (!project) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24">
          <p className="text-muted-foreground">Project not found</p>
          <Link href="/projects">
            <Button variant="ghost" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />Back to Projects
            </Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-5xl">
        {/* Back */}
        <Link href="/projects">
          <Button variant="ghost" size="sm" className="-ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />Projects
          </Button>
        </Link>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">{workstream?.name}</Badge>
              {project.clientName && (
                <span className="text-xs text-muted-foreground">for {project.clientName}</span>
              )}
              <Badge
                variant={project.status === 'archived' ? 'secondary' : 'outline'}
                className={project.status === 'live' ? 'border-green-500/40 text-green-400' : ''}
              >
                {project.status === 'live' ? 'Live' : 'Archived'}
              </Badge>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{project.description}</p>
          </div>
          {currentRole === 'admin' && (
            <Button variant="outline" size="sm">Edit Project</Button>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Progress', value: `${project.progress}%`, sub: <Progress value={project.progress} className="h-1 mt-2" /> },
            { label: 'Deliverables', value: `${stats.approved}/${stats.total}`, sub: <span className="text-xs text-muted-foreground">{stats.pct}% approved</span> },
            { label: 'Submissions', value: projectSubmissions.length, sub: <span className="text-xs text-muted-foreground">{projectSubmissions.filter(s => s.status === 'submitted').length} pending review</span> },
            { label: 'Due', value: project.dueDate ? new Date(project.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—', sub: <span className="text-xs text-muted-foreground">{project.estimatedHours}h estimated</span> },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-xl font-semibold">{stat.value}</p>
                <div className="mt-1">{stat.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="brief" className="w-full">
          <TabsList className="mb-0">
            <TabsTrigger value="brief">Brief</TabsTrigger>
            <TabsTrigger value="deliverables">
              Deliverables
              <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">{projectDeliverables.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="feedback">Client Feedback</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
          </TabsList>

          {/* ── Brief ─────────────────────────────── */}
          <TabsContent value="brief" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Project Brief</CardTitle>
                </CardHeader>
                <CardContent>
                  {project.brief ? (
                    <div className="prose prose-sm prose-invert max-w-none">
                      {project.brief.split('\n').map((line, i) => {
                        if (line.startsWith('## ')) return <h2 key={i} className="text-base font-semibold mt-4 mb-2 first:mt-0">{line.slice(3)}</h2>
                        if (line.startsWith('- ')) return <li key={i} className="text-sm text-muted-foreground ml-4">{line.slice(2)}</li>
                        if (line === '') return <div key={i} className="h-2" />
                        return <p key={i} className="text-sm text-muted-foreground">{line}</p>
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No brief available.</p>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Learning Outcomes</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-1.5">
                      {project.learningOutcomes.map((lo, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          {lo}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {project.resources && project.resources.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Resources</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-1.5">
                      {project.resources.map(r => (
                        <a
                          key={r.id}
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {r.title}
                        </a>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Deliverables ──────────────────────── */}
          <TabsContent value="deliverables" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Deliverables</CardTitle>
                  <span className="text-xs text-muted-foreground">{stats.approved} of {stats.total} approved</span>
                </div>
                <Progress value={stats.pct} className="h-1 mt-2" />
              </CardHeader>
              <CardContent className="pt-0">
                {projectDeliverables.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm">
                    No deliverables defined for this project.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {projectDeliverables.map(del => (
                      <DeliverableRow
                        key={del.id}
                        deliverable={del}
                        onSubmit={openSubmit}
                        canSubmit={currentRole === 'student'}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Client Feedback ───────────────────── */}
          <TabsContent value="feedback" className="mt-4">
            {!project.clientFeedback || project.clientFeedback.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center py-16">
                  <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No client feedback yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {project.clientFeedback.map(fb => (
                  <Card key={fb.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{fb.author}</span>
                            <span className="text-xs text-muted-foreground">{fb.authorRole}</span>
                            <div className="ml-auto flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={cn('h-3.5 w-3.5', i < fb.rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground')}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{fb.content}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(fb.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Timeline ──────────────────────────── */}
          <TabsContent value="timeline" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between text-sm mb-6">
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs mb-1">Start</p>
                    <p className="font-medium">{new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                  <div className="flex-1 mx-6 relative">
                    <div className="h-1 bg-border rounded-full" />
                    <div
                      className="absolute top-0 left-0 h-1 bg-primary rounded-full transition-all"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs mb-1">End</p>
                    <p className="font-medium">{new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                </div>
                <Separator className="mb-4" />
                {/* Tasks */}
                <p className="text-xs font-medium text-muted-foreground mb-2">TASKS ({projectTasks.length})</p>
                <div className="space-y-1.5">
                  {projectTasks.map(task => (
                    <Link key={task.id} href={`/tasks/${task.id}`}>
                      <div className="flex items-center gap-3 py-1.5 hover:text-foreground transition-colors">
                        {task.status === 'completed'
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                          : task.status === 'review'
                          ? <Clock className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />
                          : task.status === 'in-progress'
                          ? <Circle className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          : <Circle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        }
                        <span className={cn('text-sm flex-1 truncate', task.status === 'completed' && 'line-through text-muted-foreground')}>
                          {task.title}
                        </span>
                        {task.dueDate && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Team ──────────────────────────────── */}
          <TabsContent value="team" className="mt-4">
            <div className="space-y-3">
              {mentor && (
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-3">MENTOR</p>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={mentor.avatar} />
                        <AvatarFallback>{mentor.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{mentor.name}</p>
                        <p className="text-xs text-muted-foreground">{mentor.email}</p>
                        {mentor.bio && <p className="text-xs text-muted-foreground mt-0.5">{mentor.bio}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              <p className="text-xs font-medium text-muted-foreground px-1">STUDENTS ({projectStudents.length})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projectStudents.map(student => (
                  <Card key={student.id}>
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={student.avatar} />
                          <AvatarFallback>{student.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{student.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                        </div>
                        {student.githubUrl && (
                          <a href={student.githubUrl} target="_blank" rel="noopener noreferrer">
                            <Github className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                          </a>
                        )}
                      </div>
                      {student.skills && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {student.skills.slice(0, 3).map(skill => (
                            <Badge key={skill} variant="secondary" className="text-[10px] h-4 px-1.5">{skill}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── Activity Log ──────────────────────── */}
          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                {!project.activityLog || project.activityLog.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm">
                    No activity yet
                  </div>
                ) : (
                  <ol className="relative border-l border-border ml-2 space-y-5">
                    {project.activityLog.map(entry => (
                      <li key={entry.id} className="ml-4">
                        <div className="absolute -left-1.5 h-3 w-3 rounded-full border border-border bg-background mt-1" />
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium">{entry.userName}</span>
                          <span className="text-sm text-muted-foreground">{entry.action}</span>
                          {entry.detail && <span className="text-sm text-primary">{entry.detail}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Submission Modal */}
      <SubmissionModal
        deliverable={submitTarget}
        projectId={projectId}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </AppShell>
  )
}
