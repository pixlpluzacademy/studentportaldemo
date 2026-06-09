'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import type {
  Task,
  Submission,
  Review,
  Notification,
  Project,
  Deliverable,
  TaskStatus,
  SubmissionStatus,
  AttendanceRecord,
  AttendanceStatus,
  ClassSession,
} from './types'
import {
  mockTasks,
  mockSubmissions,
  mockReviews,
  mockNotifications,
  mockProjects,
  mockDeliverables,
  mockUsers,
  mockWorkstreams,
  mockCohorts,
} from './mock-data'
import { mockAttendanceRecords, mockSessions } from './attendance-data'
import type { User, Workstream, Cohort } from './types'

interface DataContextType {
  // Static data
  users: User[]
  students: User[]
  mentors: User[]
  workstreams: Workstream[]
  cohorts: Cohort[]
  projects: Project[]
  deliverables: Deliverable[]
  sessions: ClassSession[]
  // Mutable data
  tasks: Task[]
  submissions: Submission[]
  reviews: Review[]
  notifications: Notification[]
  attendanceRecords: AttendanceRecord[]
  // Task actions
  updateTaskStatus: (taskId: string, status: TaskStatus) => void
  createTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Task
  // Submission actions
  createSubmission: (submission: Omit<Submission, 'id' | 'createdAt' | 'updatedAt'>) => Submission
  updateSubmission: (submissionId: string, updates: Partial<Submission>) => void
  // Review actions
  createReview: (review: Omit<Review, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateReview: (reviewId: string, updates: Partial<Review>) => void
  approveReview: (reviewId: string, feedback: string, rubricScores: Review['rubricScores'], strengths: string[], improvements: string[], grade: number) => void
  requestChanges: (reviewId: string, feedback: string, rubricScores: Review['rubricScores'], improvements: string[], grade: number) => void
  rejectReview: (reviewId: string, feedback: string, rubricScores: Review['rubricScores'], grade: number) => void
  startReview: (reviewId: string) => void
  // Deliverable actions
  updateDeliverableStatus: (deliverableId: string, status: Deliverable['status']) => void
  // Notification actions
  markNotificationRead: (notificationId: string) => void
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void
  // Attendance actions
  markAttendance: (sessionId: string, studentId: string, cohortId: string, status: AttendanceStatus, markedBy: string) => void
  markAllPresent: (sessionId: string, cohortId: string, studentIds: string[], markedBy: string) => void
  bulkMarkAttendance: (sessionId: string, cohortId: string, records: Array<{ studentId: string; status: AttendanceStatus }>, markedBy: string) => void
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(mockTasks)
  const [submissions, setSubmissions] = useState<Submission[]>(mockSubmissions)
  const [reviews, setReviews] = useState<Review[]>(mockReviews)
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const [deliverables, setDeliverables] = useState<Deliverable[]>(mockDeliverables)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(mockAttendanceRecords)

  // Persist mutable state to localStorage
  useEffect(() => {
    try {
      const savedTasks = localStorage.getItem('gs_tasks')
      const savedSubmissions = localStorage.getItem('gs_submissions')
      const savedReviews = localStorage.getItem('gs_reviews')
      const savedNotifications = localStorage.getItem('gs_notifications')
      const savedDeliverables = localStorage.getItem('gs_deliverables')
      const savedAttendance = localStorage.getItem('gs_attendance')
      if (savedTasks) setTasks(JSON.parse(savedTasks))
      if (savedSubmissions) setSubmissions(JSON.parse(savedSubmissions))
      if (savedReviews) setReviews(JSON.parse(savedReviews))
      if (savedNotifications) setNotifications(JSON.parse(savedNotifications))
      if (savedDeliverables) setDeliverables(JSON.parse(savedDeliverables))
      if (savedAttendance) setAttendanceRecords(JSON.parse(savedAttendance))
    } catch {
      // ignore parse errors
    }
  }, [])

  useEffect(() => { localStorage.setItem('gs_tasks', JSON.stringify(tasks)) }, [tasks])
  useEffect(() => { localStorage.setItem('gs_submissions', JSON.stringify(submissions)) }, [submissions])
  useEffect(() => { localStorage.setItem('gs_reviews', JSON.stringify(reviews)) }, [reviews])
  useEffect(() => { localStorage.setItem('gs_notifications', JSON.stringify(notifications)) }, [notifications])
  useEffect(() => { localStorage.setItem('gs_deliverables', JSON.stringify(deliverables)) }, [deliverables])
  useEffect(() => { localStorage.setItem('gs_attendance', JSON.stringify(attendanceRecords)) }, [attendanceRecords])

  // ─── Task actions ────────────────────────────────────────────────────────────

  const updateTaskStatus = (taskId: string, status: TaskStatus) => {
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, status, updatedAt: new Date().toISOString() } : t)
    )
  }

  const createTask = (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task => {
    const newTask: Task = {
      ...task,
      id: `task-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setTasks(prev => [...prev, newTask])
    return newTask
  }

  // ─── Submission actions ──────────────────────────────────────────────────────

  const createSubmission = (
    submission: Omit<Submission, 'id' | 'createdAt' | 'updatedAt'>
  ): Submission => {
    const newSubmission: Submission = {
      ...submission,
      id: `sub-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setSubmissions(prev => [...prev, newSubmission])
    // Move task to review
    updateTaskStatus(submission.taskId, 'review')
    // Update deliverable to submitted
    if (submission.deliverableId) {
      updateDeliverableStatus(submission.deliverableId, 'submitted')
    }
    return newSubmission
  }

  const updateSubmission = (submissionId: string, updates: Partial<Submission>) => {
    setSubmissions(prev =>
      prev.map(s => s.id === submissionId ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s)
    )
  }

  // ─── Deliverable actions ─────────────────────────────────────────────────────

  const updateDeliverableStatus = (deliverableId: string, status: Deliverable['status']) => {
    setDeliverables(prev =>
      prev.map(d => d.id === deliverableId ? { ...d, status } : d)
    )
  }

  // ─── Review actions ──────────────────────────────────────────────────────────

  const startReview = (reviewId: string) => {
    setReviews(prev =>
      prev.map(r => r.id === reviewId
        ? { ...r, status: 'in-progress' as const, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : r
      )
    )
  }

  const approveReview = (
    reviewId: string,
    feedback: string,
    rubricScores: Review['rubricScores'],
    strengths: string[],
    improvements: string[],
    grade: number,
  ) => {
    const now = new Date().toISOString()
    const review = reviews.find(r => r.id === reviewId)
    if (!review) return

    setReviews(prev =>
      prev.map(r => r.id === reviewId ? {
        ...r,
        status: 'completed' as const,
        decision: 'approved' as const,
        feedback,
        rubricScores,
        strengths,
        improvements,
        grade,
        completedAt: now,
        updatedAt: now,
      } : r)
    )

    // Mark submission approved
    updateSubmission(review.submissionId, { status: 'approved', grade })

    // Mark deliverable approved
    if (review.deliverableId) {
      updateDeliverableStatus(review.deliverableId, 'approved')
    }

    // Mark related task completed
    const submission = submissions.find(s => s.id === review.submissionId)
    if (submission) {
      updateTaskStatus(submission.taskId, 'completed')
      // Notify student
      addNotification({
        userId: submission.studentId,
        type: 'success',
        title: 'Submission Approved',
        message: `Your submission has been approved with a score of ${grade}%.`,
        read: false,
        actionUrl: `/submissions/${review.submissionId}`,
      })
    }
  }

  const requestChanges = (
    reviewId: string,
    feedback: string,
    rubricScores: Review['rubricScores'],
    improvements: string[],
    grade: number,
  ) => {
    const now = new Date().toISOString()
    const review = reviews.find(r => r.id === reviewId)
    if (!review) return

    setReviews(prev =>
      prev.map(r => r.id === reviewId ? {
        ...r,
        status: 'completed' as const,
        decision: 'revision-requested' as const,
        feedback,
        rubricScores,
        improvements,
        grade,
        completedAt: now,
        updatedAt: now,
      } : r)
    )

    // Mark submission as revision-requested
    updateSubmission(review.submissionId, { status: 'revision-requested', grade })

    // Mark deliverable back to pending
    if (review.deliverableId) {
      updateDeliverableStatus(review.deliverableId, 'pending')
    }

    const submission = submissions.find(s => s.id === review.submissionId)
    if (submission) {
      // Put task back to in-progress
      updateTaskStatus(submission.taskId, 'in-progress')

      // Auto-create revision tasks from improvements
      improvements.forEach((improvement, idx) => {
        createTask({
          title: `Revision: ${improvement}`,
          description: `Requested by mentor in review of submission ${review.submissionId}. ${improvement}`,
          projectId: review.projectId,
          assignedTo: submission.studentId,
          status: 'todo',
          priority: 'high',
          tags: ['revision', 'requested-changes'],
          fromReviewId: reviewId,
        })
      })

      // Notify student
      addNotification({
        userId: submission.studentId,
        type: 'warning',
        title: 'Changes Requested',
        message: `Your mentor has requested ${improvements.length} change${improvements.length !== 1 ? 's' : ''}. ${improvements.length} revision task${improvements.length !== 1 ? 's' : ''} added to your board.`,
        read: false,
        actionUrl: `/submissions/${review.submissionId}`,
      })
    }
  }

  const rejectReview = (
    reviewId: string,
    feedback: string,
    rubricScores: Review['rubricScores'],
    grade: number,
  ) => {
    const now = new Date().toISOString()
    const review = reviews.find(r => r.id === reviewId)
    if (!review) return

    setReviews(prev =>
      prev.map(r => r.id === reviewId ? {
        ...r,
        status: 'completed' as const,
        decision: 'rejected' as const,
        feedback,
        rubricScores,
        grade,
        completedAt: now,
        updatedAt: now,
      } : r)
    )

    updateSubmission(review.submissionId, { status: 'rejected', grade })

    const submission = submissions.find(s => s.id === review.submissionId)
    if (submission) {
      addNotification({
        userId: submission.studentId,
        type: 'error',
        title: 'Submission Rejected',
        message: 'Your submission did not meet the minimum standard. Please review the feedback and resubmit.',
        read: false,
        actionUrl: `/submissions/${review.submissionId}`,
      })
    }
  }

  const createReview = (review: Omit<Review, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newReview: Review = {
      ...review,
      id: `rev-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setReviews(prev => [...prev, newReview])
  }

  const updateReview = (reviewId: string, updates: Partial<Review>) => {
    setReviews(prev =>
      prev.map(r => r.id === reviewId ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r)
    )
  }

  // ─── Notification actions ────────────────────────────────────────────────────

  const markNotificationRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    )
  }

  const addNotification = (notification: Omit<Notification, 'id' | 'createdAt'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setNotifications(prev => [newNotification, ...prev])
  }

  // ─── Attendance actions ───────────────────────────────────────────────────────

  const markAttendance = (
    sessionId: string,
    studentId: string,
    cohortId: string,
    status: AttendanceStatus,
    markedBy: string,
  ) => {
    const now = new Date()
    const date = now.toISOString().split('T')[0]
    setAttendanceRecords(prev => {
      const existing = prev.findIndex(r => r.sessionId === sessionId && r.studentId === studentId)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], status, markedBy, markedAt: now.toISOString() }
        return updated
      }
      const newRecord: AttendanceRecord = {
        id: `att-${sessionId}-${studentId}-${Date.now()}`,
        sessionId,
        studentId,
        cohortId,
        date,
        status,
        markedBy,
        markedAt: now.toISOString(),
      }
      return [...prev, newRecord]
    })
  }

  const markAllPresent = (
    sessionId: string,
    cohortId: string,
    studentIds: string[],
    markedBy: string,
  ) => {
    studentIds.forEach(sid => markAttendance(sessionId, sid, cohortId, 'present', markedBy))
  }

  const bulkMarkAttendance = (
    sessionId: string,
    cohortId: string,
    records: Array<{ studentId: string; status: AttendanceStatus }>,
    markedBy: string,
  ) => {
    records.forEach(({ studentId, status }) =>
      markAttendance(sessionId, studentId, cohortId, status, markedBy)
    )
  }

  return (
    <DataContext.Provider
      value={{
        users: mockUsers,
        students: mockUsers.filter(u => u.role === 'student'),
        mentors: mockUsers.filter(u => u.role === 'mentor'),
        workstreams: mockWorkstreams,
        cohorts: mockCohorts,
        projects: mockProjects,
        deliverables,
        sessions: mockSessions,
        tasks,
        submissions,
        reviews,
        notifications,
        attendanceRecords,
        updateTaskStatus,
        createTask,
        createSubmission,
        updateSubmission,
        createReview,
        updateReview,
        approveReview,
        requestChanges,
        rejectReview,
        startReview,
        updateDeliverableStatus,
        markNotificationRead,
        addNotification,
        markAttendance,
        markAllPresent,
        bulkMarkAttendance,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}
