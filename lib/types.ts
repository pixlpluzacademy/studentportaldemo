export type Role = 'student' | 'mentor' | 'admin' | 'superadmin' | 'placement'

export type Status = 'active' | 'inactive' | 'done' | 'archived'

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'

export type SubmissionStatus = 'draft' | 'submitted' | 'in-review' | 'approved' | 'revision_requested' | 'rejected'

export type ReviewStatus = 'pending' | 'in_progress' | 'done'

export type ProjectStatus = 'live' | 'archived' | 'upcoming'

export type DeliverableStatus = 'pending' | 'submitted' | 'approved' | 'revision_requested'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  avatar?: string
  cohortId?: string
  bio?: string
  skills?: string[]
  githubUrl?: string
  linkedinUrl?: string
  portfolioUrl?: string
  createdAt: string
}

export interface Cohort {
  id: string
  name: string
  startDate: string
  endDate: string
  status: Status
  studentCount: number
  mentorIds: string[]
  workstreamIds: string[]
}

export interface WorkPackage {
  id: string
  title: string
  goal: string
  skills: string[]
  tools: string[]
  practiceTasks: string[]
  finalDeliverable: string
  estimatedTime: string // e.g. "2 weeks"
}

export interface SyllabusLevel {
  level: 'Foundation' | 'Intermediate' | 'Advanced'
  description: string
  workPackages: WorkPackage[]
}

export interface RubricCategory {
  name: string
  weight: number // percentage, all categories should sum to 100
  criteria: string[]
}

export interface WorkstreamRubric {
  categories: RubricCategory[]
  passMark: number // e.g. 70
  distincionMark: number // e.g. 85
}

export interface PortfolioOutput {
  id: string
  title: string
  description: string
  level: 'Foundation' | 'Intermediate' | 'Advanced'
  format: string // e.g. "PDF case study", "Live URL", "Video"
}

export interface WorkstreamTool {
  name: string
  category: string // e.g. "Design", "Development", "Analytics"
  description: string
  required: boolean
}

export interface Workstream {
  id: string
  name: string
  shortName: string
  description: string
  tagline: string
  icon: string
  color: string
  accentColor: string // tailwind class e.g. "blue"
  order: number
  cohortIds: string[]
  projectIds: string[]
  syllabus: SyllabusLevel[]
  rubric: WorkstreamRubric
  portfolioOutputs: PortfolioOutput[]
  tools: WorkstreamTool[]
  internshipWeight: number // 0–100, how much this contributes to internship eligibility
  totalEstimatedWeeks: number
}

export interface Deliverable {
  id: string
  projectId: string
  title: string
  description: string
  dueDate: string
  status: DeliverableStatus
  submissionId?: string
  order: number
}

export interface Project {
  id: string
  name: string
  description: string
  brief?: string
  clientName?: string
  workstreamId: string
  mentorId?: string
  studentIds: string[]
  order: number
  status: ProjectStatus
  progress: number
  startDate: string
  endDate: string
  dueDate?: string
  estimatedHours?: number
  learningOutcomes: string[]
  deliverables: Deliverable[]
  resources?: ProjectResource[]
  clientFeedback?: ClientFeedback[]
  activityLog?: ActivityEntry[]
}

export interface ProjectResource {
  id: string
  title: string
  type: 'video' | 'article' | 'documentation' | 'template'
  url: string
}

export interface ClientFeedback {
  id: string
  author: string
  authorRole: string
  content: string
  rating: number
  createdAt: string
}

export interface ActivityEntry {
  id: string
  userId: string
  userName: string
  action: string
  detail?: string
  createdAt: string
}

export interface Task {
  id: string
  title: string
  description: string
  projectId: string
  assignedTo?: string
  status: TaskStatus
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  estimatedHours?: number
  actualHours?: number
  createdAt: string
  updatedAt: string
  tags?: string[]
  fromReviewId?: string // auto-generated from Request Changes
}

export interface Submission {
  id: string
  taskId: string
  projectId: string
  deliverableId?: string
  studentId: string
  status: SubmissionStatus
  submittedAt: string
  content: string
  attachments?: SubmissionAttachment[]
  githubUrl?: string
  liveUrl?: string
  reviewId?: string
  grade?: number
  createdAt: string
  updatedAt: string
}

export interface SubmissionAttachment {
  id: string
  name: string
  url: string
  type: string
  size: number
}

export interface RubricScore {
  category: string
  weight: number // percentage weight e.g. 20
  score: number  // 0–5
  maxScore: number // always 5
  comment?: string
}

export interface Review {
  id: string
  submissionId: string
  projectId: string
  deliverableId?: string
  reviewerId: string
  status: ReviewStatus
  decision?: 'approved' | 'revision_requested' | 'rejected'
  feedback: string
  strengths?: string[]
  improvements?: string[]
  grade?: number
  rubricScores?: RubricScore[]
  slaDeadline?: string // ISO timestamp when review must be done
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface PortfolioProject {
  id: string
  studentId: string
  submissionId: string
  title: string
  description: string
  thumbnailUrl?: string
  tags: string[]
  featured: boolean
  createdAt: string
}

export interface Activity {
  id: string
  userId: string
  type: 'submission' | 'review' | 'comment' | 'task' | 'achievement'
  entityId: string
  entityType: string
  description: string
  createdAt: string
}

export interface Notification {
  id: string
  userId: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  read: boolean
  actionUrl?: string
  createdAt: string
}

export interface CareerResource {
  id: string
  title: string
  description: string
  type: 'job-board' | 'resume-tip' | 'interview-prep' | 'article' | 'video'
  url?: string
  tags: string[]
  featured: boolean
  createdAt: string
}

export interface JobPosting {
  id: string
  company: string
  position: string
  location: string
  type: 'full-time' | 'part-time' | 'contract' | 'internship'
  description: string
  requirements: string[]
  applyUrl: string
  postedAt: string
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export type AttendanceStatus = 'present' | 'late' | 'absent'

export interface ClassSession {
  id: string
  cohortId: string
  title: string          // e.g. "Morning Session – Week 3"
  date: string           // ISO date "2024-04-15"
  startTime: string      // "09:00"
  endTime: string        // "13:00"
  topic: string
  mentorId: string
  location: string       // e.g. "pixlpluzportal Kochi Campus – Room A"
}

export interface AttendanceRecord {
  id: string
  sessionId: string
  studentId: string
  cohortId: string
  date: string           // ISO date
  status: AttendanceStatus
  markedBy: string       // mentor userId or 'qr-scan'
  markedAt: string       // ISO timestamp
  note?: string
}
