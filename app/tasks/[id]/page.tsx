'use client'

import { AppShell } from '@/components/app-shell'
import { useData } from '@/lib/data-context'
import { useApp } from '@/lib/app-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowLeft, Calendar, Clock, CheckCircle2, AlertCircle, FileText, Upload, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'

const statusConfig = {
  'not-started': { label: 'Not Started', variant: 'secondary' as const, icon: Clock },
  'in-progress': { label: 'In Progress', variant: 'default' as const, icon: Clock },
  'completed': { label: 'Completed', variant: 'outline' as const, icon: CheckCircle2 },
  'blocked': { label: 'Blocked', variant: 'destructive' as const, icon: AlertCircle },
}

export default function TaskDetailPage() {
  const params = useParams()
  const { tasks, projects, workstreams, students, submissions } = useData()
  const { currentRole, currentUser } = useApp()
  const { addSubmission } = useData()
  const taskId = params.id as string

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionUrl, setSubmissionUrl] = useState('')
  const [submissionNotes, setSubmissionNotes] = useState('')

  const task = tasks.find(t => t.id === taskId)
  const project = task ? projects.find(p => p.id === task.projectId) : null
  const workstream = project ? workstreams.find(w => w.id === project.workstreamId) : null
  const taskSubmissions = submissions.filter(s => s.taskId === taskId)
  const userSubmission = taskSubmissions.find(s => s.studentId === currentUser?.id)

  if (!task) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium">Task not found</p>
          <Link href="/tasks">
            <Button variant="ghost" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tasks
            </Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  const config = statusConfig[task.status]
  const StatusIcon = config.icon

  const handleSubmit = () => {
    if (!submissionUrl.trim()) return
    
    setIsSubmitting(true)
    // Simulate submission
    setTimeout(() => {
      addSubmission({
        studentId: currentUser?.id || '',
        taskId: task.id,
        projectId: task.projectId,
        submissionUrl,
        notes: submissionNotes,
        status: 'pending'
      })
      setIsSubmitting(false)
      setSubmissionUrl('')
      setSubmissionNotes('')
    }, 500)
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Back Button */}
        <Link href="/tasks">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tasks
          </Button>
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">{workstream?.name}</Badge>
              <Badge variant={config.variant}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
              {task.priority && (
                <Badge variant={task.priority === 'high' ? 'destructive' : 'outline'}>
                  {task.priority} priority
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">{task.title}</h1>
            <p className="text-muted-foreground max-w-2xl">{task.description}</p>
          </div>
          {currentRole === 'admin' && (
            <Button>Edit Task</Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task Details */}
            <Card>
              <CardHeader>
                <CardTitle>Task Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Project</span>
                  <Link href={`/projects/${project?.id}`}>
                    <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                      {project?.name}
                    </Badge>
                  </Link>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Due Date</span>
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estimated Time</span>
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {task.estimatedHours} hours
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Requirements */}
            <Card>
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {task.requirements.map((req, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Skills Required */}
            <Card>
              <CardHeader>
                <CardTitle>Skills Required</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {task.skills.map((skill, index) => (
                    <Badge key={index} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Resources */}
            {task.resources && task.resources.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Resources</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {task.resources.map((resource, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                        <a href="#" className="text-primary hover:underline">{resource}</a>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Submission Form (Students Only) */}
            {currentRole === 'student' && !userSubmission && (
              <Card>
                <CardHeader>
                  <CardTitle>Submit Your Work</CardTitle>
                  <CardDescription>
                    Upload your completed work for review
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="submission-url">Submission URL *</Label>
                    <Input
                      id="submission-url"
                      placeholder="https://github.com/username/repo or https://..."
                      value={submissionUrl}
                      onChange={(e) => setSubmissionUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="submission-notes">Notes (Optional)</Label>
                    <Textarea
                      id="submission-notes"
                      placeholder="Add any notes or comments about your submission..."
                      value={submissionNotes}
                      onChange={(e) => setSubmissionNotes(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <Button 
                    onClick={handleSubmit} 
                    disabled={!submissionUrl.trim() || isSubmitting}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Submitting...' : 'Submit for Review'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* User's Submission Status */}
            {currentRole === 'student' && userSubmission && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Submission</CardTitle>
                  <CardDescription>
                    Submitted {new Date(userSubmission.submittedAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      userSubmission.status === 'approved' ? 'outline' :
                      userSubmission.status === 'rejected' ? 'destructive' : 'secondary'
                    }>
                      {userSubmission.status === 'pending' && 'Pending Review'}
                      {userSubmission.status === 'approved' && 'Approved'}
                      {userSubmission.status === 'rejected' && 'Needs Revision'}
                    </Badge>
                  </div>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground">Submission URL:</span>
                    <a href={userSubmission.submissionUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline ml-2">
                      {userSubmission.submissionUrl}
                    </a>
                  </div>
                  {userSubmission.notes && (
                    <>
                      <Separator />
                      <div>
                        <span className="text-sm text-muted-foreground">Notes:</span>
                        <p className="text-sm mt-1">{userSubmission.notes}</p>
                      </div>
                    </>
                  )}
                  <Link href={`/submissions/${userSubmission.id}`}>
                    <Button variant="outline" className="w-full">
                      <FileText className="h-4 w-4 mr-2" />
                      View Submission Details
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Submissions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Submissions</CardTitle>
                <CardDescription className="text-xs">
                  {taskSubmissions.length} total
                </CardDescription>
              </CardHeader>
              <CardContent>
                {taskSubmissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No submissions yet</p>
                ) : (
                  <div className="space-y-3">
                    {taskSubmissions.map(submission => {
                      const student = students.find(s => s.id === submission.studentId)
                      return (
                        <Link key={submission.id} href={`/submissions/${submission.id}`}>
                          <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={student?.avatar} />
                              <AvatarFallback className="text-xs">
                                {student?.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{student?.name}</p>
                              <Badge variant="secondary" className="text-xs">
                                {submission.status}
                              </Badge>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
