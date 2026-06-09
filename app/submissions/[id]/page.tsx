'use client'

import { AppShell } from '@/components/app-shell'
import { useData } from '@/lib/data-context'
import { useApp } from '@/lib/app-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, ExternalLink, CheckCircle2, XCircle, Clock, Star, Send } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'

const statusConfig = {
  'pending': { label: 'Pending Review', variant: 'secondary' as const, icon: Clock },
  'approved': { label: 'Approved', variant: 'outline' as const, icon: CheckCircle2 },
  'rejected': { label: 'Needs Work', variant: 'destructive' as const, icon: XCircle },
}

export default function SubmissionDetailPage() {
  const params = useParams()
  const { submissions, students, tasks, projects, workstreams, reviews, mentors } = useData()
  const { currentRole, currentUser } = useApp()
  const { addReview, updateSubmissionStatus } = useData()
  const submissionId = params.id as string

  const [isReviewing, setIsReviewing] = useState(false)
  const [rating, setRating] = useState<number>(0)
  const [feedback, setFeedback] = useState('')
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved')

  const submission = submissions.find(s => s.id === submissionId)
  const student = submission ? students.find(s => s.id === submission.studentId) : null
  const task = submission ? tasks.find(t => t.id === submission.taskId) : null
  const project = task ? projects.find(p => p.id === task.projectId) : null
  const workstream = project ? workstreams.find(w => w.id === project.workstreamId) : null
  const existingReview = submission ? reviews.find(r => r.submissionId === submission.id) : null
  const reviewer = existingReview ? mentors.find(m => m.id === existingReview.reviewerId) : null

  if (!submission || !student || !task) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium">Submission not found</p>
          <Link href="/submissions">
            <Button variant="ghost" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Submissions
            </Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  const config = statusConfig[submission.status]
  const StatusIcon = config.icon
  const canReview = currentRole !== 'student' && submission.status === 'pending'
  const isOwner = currentRole === 'student' && submission.studentId === currentUser?.id

  const handleSubmitReview = () => {
    if (!feedback.trim()) return
    
    setIsReviewing(true)
    // Simulate review submission
    setTimeout(() => {
      addReview({
        submissionId: submission.id,
        reviewerId: currentUser?.id || '',
        rating,
        feedback,
      })
      updateSubmissionStatus(submission.id, reviewStatus)
      setIsReviewing(false)
    }, 500)
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Back Button */}
        <Link href="/submissions">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Submissions
          </Button>
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            <Avatar className="h-16 w-16">
              <AvatarImage src={student.avatar} />
              <AvatarFallback className="text-xl">
                {student.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">{workstream?.name}</Badge>
                <Badge variant={config.variant}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {config.label}
                </Badge>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight mb-1">{task.title}</h1>
              <p className="text-muted-foreground">
                Submitted by {student.name} on {new Date(submission.submittedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Submission Details */}
            <Card>
              <CardHeader>
                <CardTitle>Submission</CardTitle>
                <CardDescription>Submitted work and files</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Submission URL</Label>
                  <a 
                    href={submission.submissionUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span className="break-all">{submission.submissionUrl}</span>
                  </a>
                </div>

                {submission.notes && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label>Student Notes</Label>
                      <div className="bg-muted rounded-lg p-4">
                        <p className="text-sm whitespace-pre-wrap">{submission.notes}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Existing Review */}
            {existingReview && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>Review Feedback</CardTitle>
                      <CardDescription>
                        Reviewed by {reviewer?.name || 'Mentor'} on{' '}
                        {new Date(existingReview.reviewedAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    {existingReview.rating && (
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-5 w-5 ${
                              star <= (existingReview.rating || 0)
                                ? 'fill-amber-500 text-amber-500'
                                : 'text-muted-foreground'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-sm whitespace-pre-wrap">{existingReview.feedback}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Review Form (Mentors/Admins only, pending submissions) */}
            {canReview && !existingReview && (
              <Card>
                <CardHeader>
                  <CardTitle>Submit Review</CardTitle>
                  <CardDescription>
                    Provide feedback and approve or request revisions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Rating */}
                  <div className="space-y-2">
                    <Label>Rating</Label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="transition-colors"
                        >
                          <Star
                            className={`h-8 w-8 cursor-pointer ${
                              star <= rating
                                ? 'fill-amber-500 text-amber-500'
                                : 'text-muted-foreground hover:text-amber-500'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-sm text-muted-foreground ml-2">
                        {rating > 0 ? `${rating}/5` : 'No rating'}
                      </span>
                    </div>
                  </div>

                  {/* Decision */}
                  <div className="space-y-2">
                    <Label>Decision</Label>
                    <Select value={reviewStatus} onValueChange={(v) => setReviewStatus(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>Approve</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="rejected">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-destructive" />
                            <span>Request Revisions</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Feedback */}
                  <div className="space-y-2">
                    <Label>Feedback *</Label>
                    <Textarea
                      placeholder="Provide detailed feedback on the submission..."
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={8}
                    />
                  </div>

                  <Button 
                    onClick={handleSubmitReview}
                    disabled={!feedback.trim() || isReviewing}
                    className="w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isReviewing ? 'Submitting...' : 'Submit Review'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Message for students on pending submissions */}
            {isOwner && submission.status === 'pending' && !existingReview && (
              <Card className="bg-amber-500/10 border-amber-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-medium mb-1">Review Pending</p>
                      <p className="text-sm text-muted-foreground">
                        Your submission is awaiting review from a mentor. You'll be notified once feedback is available.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Task Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Task Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">Task</span>
                  <Link href={`/tasks/${task.id}`}>
                    <p className="text-sm font-medium hover:text-primary cursor-pointer">
                      {task.title}
                    </p>
                  </Link>
                </div>
                <Separator />
                <div>
                  <span className="text-sm text-muted-foreground">Project</span>
                  <Link href={`/projects/${project?.id}`}>
                    <p className="text-sm font-medium hover:text-primary cursor-pointer">
                      {project?.name}
                    </p>
                  </Link>
                </div>
                <Separator />
                <div>
                  <span className="text-sm text-muted-foreground">Workstream</span>
                  <p className="text-sm font-medium">{workstream?.name}</p>
                </div>
                <Separator />
                <div>
                  <span className="text-sm text-muted-foreground">Due Date</span>
                  <p className="text-sm font-medium">
                    {new Date(task.dueDate).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Student Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Student</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={student.avatar} />
                    <AvatarFallback>
                      {student.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Skills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {task.skills.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
