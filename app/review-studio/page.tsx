'use client'

import { AppShell } from '@/components/app-shell'
import { useData } from '@/lib/data-context'
import { useApp } from '@/lib/app-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Slider } from '@/components/ui/slider'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Clock, CheckCircle2, XCircle, AlertTriangle, ExternalLink, Github,
  ChevronRight, ArrowLeft, Star, Plus, X, Timer, RotateCcw, Inbox,
} from 'lucide-react'
import Link from 'next/link'
import { useState, useMemo, useCallback } from 'react'
import type { Review, RubricScore } from '@/lib/types'
import { cn } from '@/lib/utils'

// ─── SLA Timer Badge ────────────────────────────────────────────────────────

function SlaBadge({ deadline }: { deadline?: string }) {
  if (!deadline) return null
  const now = Date.now()
  const deadlineMs = new Date(deadline).getTime()
  const diffMs = deadlineMs - now
  const diffH = Math.ceil(diffMs / (1000 * 60 * 60))
  const overdue = diffMs < 0

  return (
    <div className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border',
      overdue
        ? 'bg-destructive/10 text-destructive border-destructive/30'
        : diffH <= 12
        ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
        : diffH <= 24
        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
        : 'bg-muted text-muted-foreground border-border',
    )}>
      <Timer className="h-3 w-3" />
      {overdue ? `${Math.abs(diffH)}h overdue` : `${diffH}h left`}
    </div>
  )
}

// ─── Rubric Editor ───────────────────────────────────────────────────────────

const DEFAULT_RUBRIC: RubricScore[] = [
  { category: 'Code Quality', weight: 25, score: 3, maxScore: 5, comment: '' },
  { category: 'Technical Correctness', weight: 30, score: 3, maxScore: 5, comment: '' },
  { category: 'Documentation', weight: 20, score: 3, maxScore: 5, comment: '' },
  { category: 'Best Practices', weight: 25, score: 3, maxScore: 5, comment: '' },
]

function computeGrade(rubric: RubricScore[]): number {
  const weightedSum = rubric.reduce((acc, r) => acc + (r.score / r.maxScore) * r.weight, 0)
  const totalWeight = rubric.reduce((acc, r) => acc + r.weight, 0)
  return Math.round((weightedSum / totalWeight) * 100)
}

function RubricEditor({
  rubric,
  onChange,
}: {
  rubric: RubricScore[]
  onChange: (r: RubricScore[]) => void
}) {
  const grade = computeGrade(rubric)
  const gradeColor = grade >= 90 ? 'text-green-400' : grade >= 70 ? 'text-yellow-400' : 'text-destructive'

  const update = (idx: number, field: keyof RubricScore, value: string | number) => {
    onChange(rubric.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Scoring Rubric</p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Weighted grade:</span>
          <span className={cn('text-lg font-bold', gradeColor)}>{grade}%</span>
        </div>
      </div>

      {rubric.map((item, idx) => (
        <div key={item.category} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{item.category}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 h-4">{item.weight}%</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map(v => (
                <button
                  key={v}
                  onClick={() => update(idx, 'score', v)}
                  className={cn(
                    'h-7 w-7 rounded-md text-sm font-medium border transition-colors',
                    item.score >= v
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  {v}
                </button>
              ))}
              <span className="text-xs text-muted-foreground w-16 text-right">
                {item.score === 5 ? 'Excellent' : item.score === 4 ? 'Good' : item.score === 3 ? 'Meets standard' : item.score === 2 ? 'Needs work' : 'Poor'}
              </span>
            </div>
          </div>
          <Input
            placeholder={`Comment on ${item.category.toLowerCase()}...`}
            value={item.comment ?? ''}
            onChange={e => update(idx, 'comment', e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      ))}
    </div>
  )
}

// ─── Strengths / Improvements ────────────────────────────────────────────────

function TagList({
  label,
  items,
  placeholder,
  onChange,
  color,
}: {
  label: string
  items: string[]
  placeholder: string
  onChange: (v: string[]) => void
  color: string
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const v = input.trim()
    if (v && !items.includes(v)) onChange([...items, v])
    setInput('')
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5 min-h-8">
        {items.map(item => (
          <span
            key={item}
            className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border', color)}
          >
            {item}
            <button onClick={() => onChange(items.filter(i => i !== item))}>
              <X className="h-3 w-3 opacity-60 hover:opacity-100" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-xs"
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <Button size="sm" variant="outline" className="h-8 px-2" onClick={add} disabled={!input.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Review Queue Item ────────────────────────────────────────────────────────

function ReviewQueueItem({
  review,
  isActive,
  onClick,
}: {
  review: Review
  isActive: boolean
  onClick: () => void
}) {
  const { submissions, students, projects, deliverables } = useData()
  const submission = submissions.find(s => s.id === review.submissionId)
  const student = submission ? students.find(u => u.id === submission.studentId) : null
  const project = review.projectId ? projects.find(p => p.id === review.projectId) : null
  const deliverable = review.deliverableId ? deliverables.find(d => d.id === review.deliverableId) : null

  const statusConfig = {
    pending: { label: 'Pending', dot: 'bg-muted-foreground' },
    'in-progress': { label: 'In Progress', dot: 'bg-primary' },
    completed: { label: 'Done', dot: 'bg-green-400' },
  }
  const cfg = statusConfig[review.status]

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-all',
        isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-card',
      )}
    >
      <div className="flex items-start gap-2">
        <div className={cn('h-2 w-2 rounded-full mt-1.5 flex-shrink-0', cfg.dot)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{deliverable?.title ?? 'Submission'}</p>
          <p className="text-xs text-muted-foreground truncate">{project?.name}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <Avatar className="h-4 w-4">
              <AvatarImage src={student?.avatar} />
              <AvatarFallback className="text-[8px]">{student?.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">{student?.name}</span>
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <SlaBadge deadline={review.slaDeadline} />
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReviewStudioPage() {
  const { reviews, submissions, students, projects, deliverables, startReview, approveReview, requestChanges, rejectReview } = useData()
  const { currentUser } = useApp()

  const [activeReviewId, setActiveReviewId] = useState<string | null>(null)
  const [rubric, setRubric] = useState<RubricScore[]>(DEFAULT_RUBRIC)
  const [feedback, setFeedback] = useState('')
  const [strengths, setStrengths] = useState<string[]>([])
  const [improvements, setImprovements] = useState<string[]>([])
  const [confirmAction, setConfirmAction] = useState<'approve' | 'request-changes' | 'reject' | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Queue: reviews assigned to current mentor (or all if admin), not yet completed
  const queue = useMemo(() => {
    return reviews
      .filter(r => {
        const isMine = currentUser?.role === 'admin' || r.reviewerId === currentUser?.id
        return isMine && r.status !== 'completed'
      })
      .sort((a, b) => {
        // Sort by SLA deadline ascending
        if (!a.slaDeadline) return 1
        if (!b.slaDeadline) return -1
        return new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime()
      })
  }, [reviews, currentUser])

  const completedReviews = useMemo(() => {
    return reviews.filter(r => {
      const isMine = currentUser?.role === 'admin' || r.reviewerId === currentUser?.id
      return isMine && r.status === 'completed'
    })
  }, [reviews, currentUser])

  const activeReview = queue.find(r => r.id === activeReviewId)
  const activeSubmission = activeReview ? submissions.find(s => s.id === activeReview.submissionId) : null
  const activeStudent = activeSubmission ? students.find(u => u.id === activeSubmission.studentId) : null
  const activeProject = activeReview ? projects.find(p => p.id === activeReview.projectId) : null
  const activeDeliverable = activeReview?.deliverableId ? deliverables.find(d => d.id === activeReview.deliverableId) : null

  const grade = computeGrade(rubric)

  const selectReview = useCallback((reviewId: string) => {
    setActiveReviewId(reviewId)
    setRubric(DEFAULT_RUBRIC.map(r => ({ ...r })))
    setFeedback('')
    setStrengths([])
    setImprovements([])
    const rev = queue.find(r => r.id === reviewId)
    if (rev?.status === 'pending') {
      startReview(reviewId)
    }
  }, [queue, startReview])

  const handleDecision = () => {
    if (!activeReview || !feedback.trim()) return
    setSubmitting(true)
    setTimeout(() => {
      if (confirmAction === 'approve') {
        approveReview(activeReview.id, feedback, rubric, strengths, improvements, grade)
      } else if (confirmAction === 'request-changes') {
        requestChanges(activeReview.id, feedback, rubric, improvements, grade)
      } else if (confirmAction === 'reject') {
        rejectReview(activeReview.id, feedback, rubric, grade)
      }
      setConfirmAction(null)
      setActiveReviewId(null)
      setSubmitting(false)
    }, 600)
  }

  const pendingCount = queue.filter(r => r.status === 'pending').length
  const inProgressCount = queue.filter(r => r.status === 'in-progress').length

  return (
    <AppShell>
      <div className="flex flex-col gap-4 h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Review Studio</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {queue.length} submission{queue.length !== 1 ? 's' : ''} in queue
              {pendingCount > 0 && ` · ${pendingCount} pending`}
              {inProgressCount > 0 && ` · ${inProgressCount} in progress`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
              {completedReviews.length} completed
            </Badge>
          </div>
        </div>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Queue Sidebar */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
              Review Queue ({queue.length})
            </p>
            {queue.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-2 text-center">
                <Inbox className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Queue is empty</p>
                <p className="text-xs text-muted-foreground">All submissions have been reviewed.</p>
              </div>
            ) : (
              queue.map(review => (
                <ReviewQueueItem
                  key={review.id}
                  review={review}
                  isActive={activeReviewId === review.id}
                  onClick={() => selectReview(review.id)}
                />
              ))
            )}
          </div>

          {/* Main Review Panel */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            {!activeReview || !activeSubmission ? (
              <Card className="h-full">
                <CardContent className="flex flex-col items-center justify-center h-full py-20">
                  <Star className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-base font-medium mb-1">Select a submission to review</p>
                  <p className="text-sm text-muted-foreground">
                    Pick an item from the queue on the left to start reviewing.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Submission header */}
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={activeStudent?.avatar} />
                        <AvatarFallback>{activeStudent?.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="font-medium text-sm">{activeStudent?.name}</span>
                          <span className="text-xs text-muted-foreground">submitted</span>
                          <span className="text-sm font-medium">{activeDeliverable?.title ?? 'Submission'}</span>
                          <SlaBadge deadline={activeReview.slaDeadline} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>{activeProject?.name}</span>
                          <span>·</span>
                          <span>{new Date(activeSubmission.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {activeSubmission.githubUrl && (
                            <a href={activeSubmission.githubUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="h-6 px-2 text-xs gap-1">
                                <Github className="h-3 w-3" /> GitHub
                              </Button>
                            </a>
                          )}
                          {activeSubmission.liveUrl && (
                            <a href={activeSubmission.liveUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="h-6 px-2 text-xs gap-1">
                                <ExternalLink className="h-3 w-3" /> Live
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="bg-secondary/30 rounded-lg p-3">
                      <p className="text-sm leading-relaxed">{activeSubmission.content}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Rubric scoring */}
                <Card>
                  <CardContent className="pt-4">
                    <RubricEditor rubric={rubric} onChange={setRubric} />
                  </CardContent>
                </Card>

                {/* Written feedback */}
                <Card>
                  <CardContent className="pt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Overall Feedback <span className="text-destructive">*</span></Label>
                      <Textarea
                        placeholder="Write detailed feedback for the student. Be specific about what works and what needs improvement..."
                        value={feedback}
                        onChange={e => setFeedback(e.target.value)}
                        rows={4}
                        className="resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TagList
                        label="Strengths"
                        items={strengths}
                        placeholder="Add a strength and press Enter"
                        onChange={setStrengths}
                        color="bg-green-500/10 text-green-400 border-green-500/20"
                      />
                      <TagList
                        label="Areas for Improvement"
                        items={improvements}
                        placeholder="Add an improvement and press Enter"
                        onChange={setImprovements}
                        color="bg-orange-500/10 text-orange-400 border-orange-500/20"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Decision buttons */}
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-sm text-muted-foreground">
                        Weighted grade: <span className={cn('font-bold text-base', grade >= 90 ? 'text-green-400' : grade >= 70 ? 'text-yellow-400' : 'text-destructive')}>{grade}%</span>
                        {grade >= 70
                          ? <span className="ml-2 text-xs text-green-400">· Passing</span>
                          : <span className="ml-2 text-xs text-destructive">· Below threshold</span>
                        }
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmAction('reject')}
                          disabled={!feedback.trim()}
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-1.5 border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
                          onClick={() => setConfirmAction('request-changes')}
                          disabled={!feedback.trim() || improvements.length === 0}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Request Changes
                          {improvements.length > 0 && (
                            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                              {improvements.length} task{improvements.length !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </Button>
                        <Button
                          className="gap-1.5"
                          onClick={() => setConfirmAction('approve')}
                          disabled={!feedback.trim() || grade < 70}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </Button>
                      </div>
                    </div>
                    {!feedback.trim() && (
                      <p className="text-xs text-muted-foreground mt-2">Add feedback before submitting a decision.</p>
                    )}
                    {confirmAction === 'request-changes' && improvements.length === 0 && (
                      <p className="text-xs text-orange-400 mt-2">Add at least one improvement item to generate revision tasks.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmAction !== null} onOpenChange={open => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'approve' && 'Approve Submission'}
              {confirmAction === 'request-changes' && 'Request Changes'}
              {confirmAction === 'reject' && 'Reject Submission'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'approve' && (
                `You are approving this submission with a grade of ${grade}%. The deliverable will be marked complete and the student will be notified.`
              )}
              {confirmAction === 'request-changes' && (
                `You are requesting ${improvements.length} change${improvements.length !== 1 ? 's' : ''}. ${improvements.length} revision task${improvements.length !== 1 ? 's' : ''} will be automatically added to the student's task board.`
              )}
              {confirmAction === 'reject' && (
                `You are rejecting this submission with a grade of ${grade}%. The student will be asked to resubmit. This action cannot be undone.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDecision}
              className={cn(
                confirmAction === 'reject' && 'bg-destructive hover:bg-destructive/90',
                confirmAction === 'request-changes' && 'bg-orange-500 hover:bg-orange-500/90',
              )}
            >
              {submitting ? 'Processing...' : (
                confirmAction === 'approve' ? 'Approve' :
                confirmAction === 'request-changes' ? 'Request Changes' : 'Reject'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
