'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth/provider'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import { useComplaints } from '@/lib/data/hooks/use-complaints'
import { isStudentMyCoursesView } from '@/lib/data/my-courses'
import {
  createComplaint,
  fetchStudentAssignedMentors,
  isAdminComplaintView,
  updateComplaintAdmin,
  type ComplaintListRow,
  type ComplaintPriority,
  type ComplaintStatus,
  type StudentAssignedMentor,
} from '@/lib/data/complaints'
import {
  deleteMentorRating,
  fetchStudentMentorRatings,
  submitMentorRating,
  type MentorRatingRow,
} from '@/lib/data/mentor-ratings'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { fetchStudentIdByProfileId } from '@/lib/data/tasks'
import { createClient } from '@/lib/supabase/client'

function getStatusClass(status: string) {
  const value = status.toLowerCase()

  if (value.includes('open')) {
    return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
  }

  if (value.includes('review')) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  }

  if (value.includes('resolved')) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
  }

  if (value.includes('reject')) {
    return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
  }

  return 'border-border bg-background text-foreground'
}

function getPriorityClass(priority: string) {
  const value = priority.toLowerCase()

  if (value.includes('urgent')) {
    return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
  }

  if (value.includes('high')) {
    return 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-200'
  }

  if (value.includes('medium')) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  }

  return 'border-border bg-background text-muted-foreground'
}

function formatRoleLabel(parentRoleId: string | null, roleName?: string) {
  if (roleName) return roleName
  if (!parentRoleId) return 'User'
  return parentRoleId
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function mentorOptionKey(mentor: StudentAssignedMentor) {
  return `${mentor.batchId}:${mentor.mentorId}:${mentor.staffType}`
}
async function getAccessToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (rating: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          className={`text-2xl leading-none transition-opacity ${
            star <= value ? 'text-[#153e90] dark:text-[#6ee75a]' : 'text-muted-foreground/40'
          } disabled:cursor-not-allowed disabled:opacity-60`}
          aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function Page() {
  const { can, user, role, parentRoleId } = useAuth()
  const { activeBranchId, loading: branchLoading, filterByBranch } = useBranchScope()

  const isStudent = isStudentMyCoursesView(parentRoleId)
  const isAdminView = isAdminComplaintView(parentRoleId) && can('complaints.view')

  const [ownStudentId, setOwnStudentId] = useState<string | null>(null)
  const [studentIdLoading, setStudentIdLoading] = useState(isStudent)

  useEffect(() => {
    if (!isStudent || !user?.id) {
      setOwnStudentId(null)
      setStudentIdLoading(false)
      return
    }

    let cancelled = false

    async function loadStudentId() {
      setStudentIdLoading(true)
      const studentId = await fetchStudentIdByProfileId(user!.id)
      if (cancelled) return
      setOwnStudentId(studentId)
      setStudentIdLoading(false)
    }

    void loadStudentId()

    return () => {
      cancelled = true
    }
  }, [isStudent, user?.id])

  const branchFilterId = isAdminView && activeBranchId ? activeBranchId : null
  const { complaints, loading, error, reload } = useComplaints({
    branchId: branchFilterId,
    studentId: isStudent ? ownStudentId : null,
    requireStudentId: isStudent,
  })

  const visibleComplaints = useMemo(() => {
    if (isAdminView) {
      return filterByBranch(complaints, (item) => item.branchId)
    }
    if (isStudent) {
      if (!ownStudentId) return []
      return complaints.filter((complaint) => complaint.studentId === ownStudentId)
    }
    return []
  }, [complaints, filterByBranch, isAdminView, isStudent, ownStudentId])

  const [assignedMentors, setAssignedMentors] = useState<StudentAssignedMentor[]>([])
  const [studentRatings, setStudentRatings] = useState<MentorRatingRow[]>([])
  const [mentorsLoading, setMentorsLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalComplaint, setModalComplaint] = useState<ComplaintListRow | null>(null)
  const [adminReply, setAdminReply] = useState('')
  const [savingAdmin, setSavingAdmin] = useState(false)

  const [form, setForm] = useState({
    mentorKey: '',
    category: 'Academic',
    title: '',
    description: '',
    priority: 'Medium' as ComplaintPriority,
  })

  const [ratingDrafts, setRatingDrafts] = useState<Record<string, number>>({})
  const [ratingSavingKey, setRatingSavingKey] = useState('')

  const canCreateComplaint = can('complaints.create')
  const canManageComplaints = can('complaints.edit') || can('complaints.resolve')
  const canRateMentor = can('ratings.submit')

  const selectedMentor = useMemo(() => {
    return assignedMentors.find((mentor) => mentorOptionKey(mentor) === form.mentorKey) || assignedMentors[0] || null
  }, [assignedMentors, form.mentorKey])

  useEffect(() => {
    if (!user?.id || !isStudent) {
      setAssignedMentors([])
      setStudentRatings([])
      setMentorsLoading(false)
      return
    }

    let cancelled = false

    async function loadStudentContext() {
      setMentorsLoading(true)

      const [mentorsResult, ratingsResult] = await Promise.all([
        fetchStudentAssignedMentors(user!.id),
        fetchStudentMentorRatings(user!.id),
      ])

      if (cancelled) return

      setAssignedMentors(mentorsResult.data)
      setStudentRatings(ratingsResult.data)

      if (mentorsResult.data[0]) {
        setForm((prev) => ({
          ...prev,
          mentorKey: prev.mentorKey || mentorOptionKey(mentorsResult.data[0]),
        }))
      }

      const drafts: Record<string, number> = {}
      mentorsResult.data.forEach((mentor) => {
        const existing = ratingsResult.data.find((rating) => rating.mentorId === mentor.mentorId)
        if (existing) {
          drafts[mentor.mentorId] = existing.rating
        }
      })
      setRatingDrafts(drafts)
      setMentorsLoading(false)
    }

    void loadStudentContext()

    return () => {
      cancelled = true
    }
  }, [isStudent, user?.id])

  const openCount = visibleComplaints.filter((complaint) => complaint.status === 'Open').length
  const reviewCount = visibleComplaints.filter((complaint) => complaint.status === 'In Review').length
  const resolvedCount = visibleComplaints.filter((complaint) => complaint.status === 'Resolved').length
  const urgentCount = visibleComplaints.filter(
    (complaint) => complaint.priority === 'Urgent' || complaint.priority === 'High',
  ).length

  const handleCreateComplaint = async () => {
    if (!selectedMentor) {
      setNotice('No assigned mentor found for your batch.')
      return
    }

    if (!form.title.trim() || !form.description.trim()) {
      setNotice('Please add complaint title and description.')
      return
    }

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setNotice('Session expired. Please login again.')
      return
    }

    setSubmitting(true)
    setNotice('')

    const result = await createComplaint(
      {
        mentorId: selectedMentor.mentorId,
        batchId: selectedMentor.batchId,
        branchId: selectedMentor.branchId,
        mentorStaffType: selectedMentor.staffType,
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
        priority: form.priority,
      },
      accessToken,
    )

    setSubmitting(false)

    if (!result.ok) {
      setNotice(result.error || 'Failed to submit complaint.')
      return
    }

    setNotice('Complaint submitted successfully.')
    setForm((prev) => ({
      ...prev,
      title: '',
      description: '',
      priority: 'Medium',
    }))
    await reload()
  }

  const handleSaveRating = async (mentor: StudentAssignedMentor) => {
    const rating = ratingDrafts[mentor.mentorId]

    if (!rating || rating < 1 || rating > 5) {
      setNotice('Please select a star rating between 1 and 5.')
      return
    }

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setNotice('Session expired. Please login again.')
      return
    }

    setRatingSavingKey(mentor.mentorId)
    setNotice('')

    const result = await submitMentorRating(
      {
        mentorId: mentor.mentorId,
        batchId: mentor.batchId,
        branchId: mentor.branchId,
        rating,
      },
      accessToken,
    )

    setRatingSavingKey('')

    if (!result.ok) {
      setNotice(result.error || 'Failed to save rating.')
      return
    }

    const ratingsResult = await fetchStudentMentorRatings(user!.id)
    setStudentRatings(ratingsResult.data)
    setNotice(`Rating saved for ${mentor.mentorName}.`)
  }

  const handleRemoveRating = async (mentor: StudentAssignedMentor) => {
    const existing = studentRatings.find((rating) => rating.mentorId === mentor.mentorId)

    if (!existing) return

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setNotice('Session expired. Please login again.')
      return
    }

    setRatingSavingKey(mentor.mentorId)

    const result = await deleteMentorRating(existing.id, accessToken)
    setRatingSavingKey('')

    if (!result.ok) {
      setNotice(result.error || 'Failed to remove rating.')
      return
    }

    setStudentRatings((prev) => prev.filter((rating) => rating.id !== existing.id))
    setRatingDrafts((prev) => {
      const next = { ...prev }
      delete next[mentor.mentorId]
      return next
    })
    setNotice(`Rating removed for ${mentor.mentorName}.`)
  }

  const openComplaintModal = (complaint: ComplaintListRow) => {
    setModalComplaint(complaint)
    setAdminReply(complaint.adminReply || '')
  }

  const handleAdminStatus = async (status: ComplaintStatus) => {
    if (!modalComplaint) return

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setNotice('Session expired. Please login again.')
      return
    }

    setSavingAdmin(true)
    setNotice('')

    const result = await updateComplaintAdmin(
      {
        complaintId: modalComplaint.id,
        status,
        adminReply: adminReply.trim(),
      },
      accessToken,
    )

    setSavingAdmin(false)

    if (!result.ok) {
      setNotice(result.error || 'Failed to update complaint.')
      return
    }

    setNotice(`Complaint marked as ${status}.`)
    setModalComplaint(null)
    await reload()
  }

  if (!can('complaints.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Complaints Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view complaints.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Student support desk</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Complaints</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            {isStudent
              ? 'Raise a complaint against your batch mentor and rate their support with stars only.'
              : 'Review branch-scoped student complaints, update status, and add resolution notes.'}
          </p>
        </div>

        <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Current role:</span> {formatRoleLabel(parentRoleId, role?.name)}
        </div>
      </div>

      {notice && (
        <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
          {notice}
        </div>
      )}

      {error && (
        <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{openCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Open</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Needs first response</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{reviewCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">In Review</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Assigned and active</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{resolvedCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Resolved</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Closed complaints</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{urgentCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">High Priority</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">High or urgent issues</div>
        </div>
      </div>

      {isStudent && canRateMentor && (
        <div className="border border-border bg-card p-5">
          <h2 className="text-xl font-bold">Rate Your Mentor</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Give a 1–5 star rating to your batch mentor. No written review is required.
          </p>

          {mentorsLoading ? (
            <p className="mt-5 text-sm text-muted-foreground">Loading assigned mentors…</p>
          ) : assignedMentors.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">No batch mentor found for your enrolled batch.</p>
          ) : (
            <div className="mt-5 space-y-4">
              {assignedMentors.map((mentor) => {
                const existing = studentRatings.find((rating) => rating.mentorId === mentor.mentorId)
                const draftRating = ratingDrafts[mentor.mentorId] || 0

                return (
                  <div key={mentorOptionKey(mentor)} className="border border-border bg-background/60 p-4">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                      <div>
                        <div className="font-semibold">{mentor.mentorName}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {mentor.staffRoleLabel} · {mentor.batchName} · {mentor.branchName}
                        </div>
                        {existing && (
                          <div className="mt-2 text-xs text-[#153e90] dark:text-[#6ee75a]">
                            Current rating: {existing.rating} / 5
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-start gap-3 md:items-end">
                        <StarRatingInput
                          value={draftRating}
                          disabled={ratingSavingKey === mentor.mentorId}
                          onChange={(rating) =>
                            setRatingDrafts((prev) => ({
                              ...prev,
                              [mentor.mentorId]: rating,
                            }))
                          }
                        />

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={ratingSavingKey === mentor.mentorId}
                            onClick={() => void handleSaveRating(mentor)}
                            className="bg-[#153e90] px-4 py-2 text-xs font-semibold text-white hover:bg-[#153e90]/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#6ee75a] dark:text-black"
                          >
                            {existing ? 'Update Rating' : 'Save Rating'}
                          </button>

                          {existing && (
                            <button
                              type="button"
                              disabled={ratingSavingKey === mentor.mentorId}
                              onClick={() => void handleRemoveRating(mentor)}
                              className="border border-border px-4 py-2 text-xs font-semibold hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {isStudent && canCreateComplaint && (
        <div className="border border-border bg-card p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h2 className="text-xl font-bold">Create Complaint</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Submit a complaint only against a mentor assigned to your batch.
              </p>
            </div>
          </div>

          {mentorsLoading ? (
            <p className="mt-5 text-sm text-muted-foreground">Loading assigned mentor…</p>
          ) : assignedMentors.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">No batch mentor found. Complaint form is unavailable.</p>
          ) : (
            <>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-semibold">Batch Mentor</span>
                  <select
                    value={form.mentorKey || mentorOptionKey(assignedMentors[0])}
                    onChange={(event) => setForm((prev) => ({ ...prev, mentorKey: event.target.value }))}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  >
                    {assignedMentors.map((mentor) => (
                      <option key={mentorOptionKey(mentor)} value={mentorOptionKey(mentor)}>
                        {mentor.mentorName} ({mentor.staffRoleLabel}) · {mentor.batchName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold">Category</span>
                  <select
                    value={form.category}
                    onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  >
                    <option value="Academic">Academic</option>
                    <option value="Task / Assignment">Task / Assignment</option>
                    <option value="Attendance">Attendance</option>
                    <option value="Mentor Support">Mentor Support</option>
                    <option value="Platform">Platform</option>
                    <option value="Placement">Placement</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold">Priority</span>
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, priority: event.target.value as ComplaintPriority }))
                    }
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </label>

                <label className="space-y-2 md:col-span-2 xl:col-span-4">
                  <span className="text-sm font-semibold">Complaint Title</span>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Example: Need clarification for today's task"
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  />
                </label>

                <label className="space-y-2 md:col-span-2 xl:col-span-4">
                  <span className="text-sm font-semibold">Description</span>
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Explain the issue clearly for admin review."
                    rows={4}
                    className="w-full resize-none border border-border bg-background px-3 py-3 outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  />
                </label>
              </div>

              {selectedMentor && (
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <div className="border border-border bg-background/60 p-3">
                    <div className="text-xs text-muted-foreground">Branch</div>
                    <div className="mt-1 font-semibold">{selectedMentor.branchName}</div>
                  </div>
                  <div className="border border-border bg-background/60 p-3">
                    <div className="text-xs text-muted-foreground">Batch</div>
                    <div className="mt-1 font-semibold">{selectedMentor.batchName}</div>
                  </div>
                  <div className="border border-border bg-background/60 p-3">
                    <div className="text-xs text-muted-foreground">Role</div>
                    <div className="mt-1 font-semibold">{selectedMentor.staffRoleLabel}</div>
                  </div>
                </div>
              )}

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleCreateComplaint()}
                  className="bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#153e90]/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
                >
                  {submitting ? 'Submitting…' : 'Submit Complaint'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="border border-border bg-card p-5">
        <div>
          <h2 className="text-xl font-bold">{isStudent ? 'My Complaints' : 'Complaint Queue'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isStudent
              ? 'Track your complaint status and admin resolution notes.'
              : 'Branch-scoped complaints from students in your access scope.'}
          </p>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                {isAdminView && <th className="px-4 py-3 font-semibold">Student</th>}
                {isAdminView && <th className="px-4 py-3 font-semibold">Branch</th>}
                {isAdminView && <th className="px-4 py-3 font-semibold">Batch</th>}
                {isAdminView && <th className="px-4 py-3 font-semibold">Mentor</th>}
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading || branchLoading ? (
                <tr>
                  <td colSpan={isAdminView ? 10 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Loading complaints…
                  </td>
                </tr>
              ) : visibleComplaints.length === 0 ? (
                <tr>
                  <td colSpan={isAdminView ? 10 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No complaints found for your scope.
                  </td>
                </tr>
              ) : (
                visibleComplaints.map((complaint) => (
                  <tr key={complaint.id} className="border-b border-border">
                    {isAdminView && (
                      <td className="px-4 py-4 align-top">
                        <div className="font-semibold text-foreground">{complaint.studentName}</div>
                      </td>
                    )}
                    {isAdminView && (
                      <td className="px-4 py-4 align-top text-muted-foreground">{complaint.branchName}</td>
                    )}
                    {isAdminView && (
                      <td className="px-4 py-4 align-top text-muted-foreground">{complaint.batchName}</td>
                    )}
                    {isAdminView && (
                      <td className="px-4 py-4 align-top">
                        <div className="font-semibold">{complaint.mentorName}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{complaint.mentorStaffRole}</div>
                      </td>
                    )}
                    <td className="px-4 py-4 align-top">
                      <div className="max-w-[260px] font-semibold">{complaint.title}</div>
                      <div className="mt-1 max-w-[260px] truncate text-xs text-muted-foreground">
                        {complaint.description}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-muted-foreground">{complaint.category}</td>
                    <td className="px-4 py-4 align-top">
                      <span
                        className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getPriorityClass(complaint.priority)}`}
                      >
                        {complaint.priority}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span
                        className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getStatusClass(complaint.status)}`}
                      >
                        {complaint.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top text-muted-foreground">{complaint.createdDate}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => openComplaintModal(complaint)}
                          className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                        >
                          View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={Boolean(modalComplaint)} onOpenChange={(open) => !open && setModalComplaint(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {modalComplaint && (
            <>
              <DialogHeader>
                <DialogTitle>{modalComplaint.title}</DialogTitle>
                <DialogDescription>Complaint details and resolution information.</DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getStatusClass(modalComplaint.status)}`}
                  >
                    {modalComplaint.status}
                  </span>
                  <span
                    className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getPriorityClass(modalComplaint.priority)}`}
                  >
                    {modalComplaint.priority}
                  </span>
                </div>

                <div className="grid gap-3 text-sm md:grid-cols-2">
                  {isAdminView && (
                    <div className="border border-border bg-background/60 p-3">
                      <div className="text-xs text-muted-foreground">Student</div>
                      <div className="mt-1 font-semibold">{modalComplaint.studentName}</div>
                    </div>
                  )}
                  <div className="border border-border bg-background/60 p-3">
                    <div className="text-xs text-muted-foreground">Branch</div>
                    <div className="mt-1 font-semibold">{modalComplaint.branchName}</div>
                  </div>
                  <div className="border border-border bg-background/60 p-3">
                    <div className="text-xs text-muted-foreground">Batch</div>
                    <div className="mt-1 font-semibold">{modalComplaint.batchName}</div>
                  </div>
                  <div className="border border-border bg-background/60 p-3">
                    <div className="text-xs text-muted-foreground">Assigned Mentor</div>
                    <div className="mt-1 font-semibold">{modalComplaint.mentorName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{modalComplaint.mentorStaffRole}</div>
                  </div>
                  <div className="border border-border bg-background/60 p-3">
                    <div className="text-xs text-muted-foreground">Category</div>
                    <div className="mt-1 font-semibold">{modalComplaint.category}</div>
                  </div>
                  <div className="border border-border bg-background/60 p-3">
                    <div className="text-xs text-muted-foreground">Created</div>
                    <div className="mt-1 font-semibold">{modalComplaint.createdDate}</div>
                  </div>
                  <div className="border border-border bg-background/60 p-3 md:col-span-2">
                    <div className="text-xs text-muted-foreground">Updated</div>
                    <div className="mt-1 font-semibold">{modalComplaint.updatedDate}</div>
                  </div>
                </div>

                <div className="border border-border bg-background/60 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{modalComplaint.description}</p>
                </div>

                {modalComplaint.adminReply && (
                  <div className="border border-[#153e90]/25 bg-[#153e90]/10 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#153e90] dark:text-white">
                      Admin Reply / Resolution Note
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#153e90] dark:text-white">{modalComplaint.adminReply}</p>
                  </div>
                )}

                {isAdminView && canManageComplaints && (
                  <div className="space-y-4 border border-border bg-background/60 p-4">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold">Admin Reply / Resolution Note</span>
                      <textarea
                        value={adminReply}
                        onChange={(event) => setAdminReply(event.target.value)}
                        rows={4}
                        placeholder="Add a reply or resolution note for the student."
                        className="w-full resize-none border border-border bg-background px-3 py-3 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                      />
                    </label>

                    <div className="flex flex-wrap gap-2">
                      {(['Open', 'In Review', 'Resolved', 'Rejected'] as ComplaintStatus[]).map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={savingAdmin}
                          onClick={() => void handleAdminStatus(status)}
                          className="border border-border px-4 py-2 text-xs font-semibold hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Mark {status}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
