'use client'

import { useMemo, useState } from 'react'
import { useDemoAuth } from '@/lib/demo/auth'
import { complaints, students } from '@/lib/demo/seed'

type ComplaintStatus = 'Open' | 'In Review' | 'Resolved'
type ComplaintPriority = 'Low' | 'Medium' | 'High' | 'Urgent'

type ComplaintRecord = {
  id: string
  student: string
  course: string
  batch: string
  category: string
  subject: string
  description: string
  priority: ComplaintPriority
  assignedTo: string
  status: ComplaintStatus
  createdDate: string
  lastReply: string
  replies: {
    by: string
    role: string
    message: string
    date: string
  }[]
}

const demoComplaints: ComplaintRecord[] = complaints.map((complaint, index) => {
  const student = students.find((item) => item.name === complaint.student)

  return {
    id: complaint.id,
    student: complaint.student,
    course: student?.course || 'Course not found',
    batch: student?.batch || 'Batch not found',
    category: complaint.category,
    subject: complaint.subject,
    description:
      index === 0
        ? 'I need extra time to complete the campaign task because I had difficulty understanding the ad funnel structure.'
        : 'I am unable to upload my task file from the submission page. Please help me resolve this issue.',
    priority: complaint.priority as ComplaintPriority,
    assignedTo: complaint.assignedTo,
    status: complaint.status as ComplaintStatus,
    createdDate: index === 0 ? '2026-06-04' : '2026-06-05',
    lastReply:
      index === 0
        ? 'Mentor will review the task deadline and update you.'
        : 'Branch admin is checking the upload issue.',
    replies: [
      {
        by: complaint.assignedTo,
        role: index === 0 ? 'HOD / Mentor' : 'Branch Admin',
        message:
          index === 0
            ? 'We received your request. Please continue the work and your mentor will confirm the extension.'
            : 'Please try again after refreshing. If the issue continues, share the file with your mentor temporarily.',
        date: index === 0 ? '2026-06-04' : '2026-06-05',
      },
    ],
  }
})

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

export default function Page() {
  const { role, user, can } = useDemoAuth()

  const isStudent = role?.id === 'student'
  const isMentor = role?.id === 'teacher' || role?.id === 'mentor'
  const isHod = role?.id === 'hod'
  const isAdminLevel = role?.id === 'superadmin' || role?.id === 'admin' || role?.id === 'branch-controller'

  const currentStudent = useMemo(() => {
    return students.find((student) => student.name === user?.fullName) || students[0]
  }, [user?.fullName])

  const [records, setRecords] = useState<ComplaintRecord[]>(demoComplaints)
  const [selectedComplaintId, setSelectedComplaintId] = useState(demoComplaints[0]?.id || '')
  const [notice, setNotice] = useState('')
  const [replyMessage, setReplyMessage] = useState('')

  const [form, setForm] = useState({
    category: 'Academic',
    subject: '',
    description: '',
    priority: 'Medium' as ComplaintPriority,
  })

  const canCreateComplaint = can('complaints.create')
  const canReplyComplaint = can('complaints.reply')
  const canResolveComplaint = can('complaints.resolve') || isAdminLevel || isHod

  const visibleComplaints = useMemo(() => {
    if (isStudent) {
      return records.filter((complaint) => complaint.student === currentStudent?.name)
    }

    if (isMentor && user?.fullName) {
      return records.filter((complaint) => complaint.assignedTo === user.fullName || complaint.batch === currentStudent?.batch)
    }

    return records
  }, [currentStudent?.batch, currentStudent?.name, isMentor, isStudent, records, user?.fullName])

  const selectedComplaint = useMemo(() => {
    return visibleComplaints.find((complaint) => complaint.id === selectedComplaintId) || visibleComplaints[0]
  }, [selectedComplaintId, visibleComplaints])

  const openCount = visibleComplaints.filter((complaint) => complaint.status === 'Open').length
  const reviewCount = visibleComplaints.filter((complaint) => complaint.status === 'In Review').length
  const resolvedCount = visibleComplaints.filter((complaint) => complaint.status === 'Resolved').length
  const urgentCount = visibleComplaints.filter((complaint) => complaint.priority === 'Urgent' || complaint.priority === 'High').length

  const createComplaint = () => {
    if (!form.subject.trim() || !form.description.trim()) {
      setNotice('Please add complaint subject and description.')
      return
    }

    const newComplaint: ComplaintRecord = {
      id: `cm-${Date.now()}`,
      student: currentStudent?.name || user?.fullName || 'Demo Student',
      course: currentStudent?.course || 'Course not selected',
      batch: currentStudent?.batch || 'Batch not selected',
      category: form.category,
      subject: form.subject.trim(),
      description: form.description.trim(),
      priority: form.priority,
      assignedTo: form.category === 'Platform' ? 'Branch Admin' : 'HOD / Mentor',
      status: 'Open',
      createdDate: new Date().toISOString().slice(0, 10),
      lastReply: 'No reply yet.',
      replies: [],
    }

    setRecords((prev) => [newComplaint, ...prev])
    setSelectedComplaintId(newComplaint.id)
    setNotice('Complaint created successfully in demo.')
    setForm({
      category: 'Academic',
      subject: '',
      description: '',
      priority: 'Medium',
    })
  }

  const addReply = () => {
    if (!selectedComplaint) return

    if (!replyMessage.trim()) {
      setNotice('Please write a reply before sending.')
      return
    }

    const reply = {
      by: user?.fullName || role?.name || 'Demo User',
      role: role?.name || 'User',
      message: replyMessage.trim(),
      date: new Date().toISOString().slice(0, 10),
    }

    setRecords((prev) =>
      prev.map((complaint) =>
        complaint.id === selectedComplaint.id
          ? {
              ...complaint,
              status: complaint.status === 'Resolved' ? complaint.status : 'In Review',
              lastReply: reply.message,
              replies: [...complaint.replies, reply],
            }
          : complaint,
      ),
    )

    setReplyMessage('')
    setNotice('Reply added to complaint.')
  }

  const resolveComplaint = () => {
    if (!selectedComplaint) return

    setRecords((prev) =>
      prev.map((complaint) =>
        complaint.id === selectedComplaint.id
          ? {
              ...complaint,
              status: 'Resolved',
              lastReply: 'Complaint marked as resolved.',
            }
          : complaint,
      ),
    )

    setNotice('Complaint resolved successfully.')
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
            Students can raise academic, platform, attendance, mentor or placement issues. Admin, HOD and mentors can reply, track and resolve them.
          </p>
        </div>

        <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Current role:</span> {role?.name || 'Not selected'}
        </div>
      </div>

      {notice && (
        <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
          {notice}
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

      {canCreateComplaint && (
        <div className="border border-border bg-card p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h2 className="text-xl font-bold">Create Complaint</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Raise an issue related to classes, tasks, attendance, platform access, mentor support or placement.
              </p>
            </div>

            {isStudent && (
              <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 text-xs font-semibold text-[#153e90] dark:text-white">
                Student: {currentStudent?.batch}
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="text-sm font-semibold">Category</span>
              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
              >
                <option value="Academic">Academic</option>
                <option value="Task">Task / Assignment</option>
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
                onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as ComplaintPriority }))}
                className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold">Subject</span>
              <input
                value={form.subject}
                onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                placeholder="Example: Need clarification for today’s task"
                className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
              />
            </label>

            <label className="space-y-2 md:col-span-2 xl:col-span-4">
              <span className="text-sm font-semibold">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Explain the issue clearly so the mentor, HOD or admin can respond properly."
                rows={4}
                className="w-full resize-none border border-border bg-background px-3 py-3 outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={createComplaint}
              className="bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
            >
              Submit Complaint
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="border border-border bg-card p-5">
          <div>
            <h2 className="text-xl font-bold">{isStudent ? 'My Complaints' : 'Complaint Queue'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a complaint to view details, replies and resolution status.
            </p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  {!isStudent && <th className="px-4 py-3 font-semibold">Student</th>}
                  <th className="px-4 py-3 font-semibold">Subject</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Assigned To</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>

              <tbody>
                {visibleComplaints.map((complaint) => (
                  <tr key={complaint.id} className="border-b border-border">
                    {!isStudent && (
                      <td className="px-4 py-4 align-top">
                        <div className="font-semibold text-foreground">{complaint.student}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{complaint.batch}</div>
                      </td>
                    )}

                    <td className="px-4 py-4 align-top">
                      <div className="max-w-[260px] font-semibold">{complaint.subject}</div>
                      <div className="mt-1 max-w-[260px] truncate text-xs text-muted-foreground">{complaint.description}</div>
                    </td>

                    <td className="px-4 py-4 align-top text-muted-foreground">{complaint.category}</td>

                    <td className="px-4 py-4 align-top">
                      <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getPriorityClass(complaint.priority)}`}>
                        {complaint.priority}
                      </span>
                    </td>

                    <td className="px-4 py-4 align-top text-muted-foreground">{complaint.assignedTo}</td>
                    <td className="px-4 py-4 align-top text-muted-foreground">{complaint.createdDate}</td>

                    <td className="px-4 py-4 align-top">
                      <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getStatusClass(complaint.status)}`}>
                        {complaint.status}
                      </span>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedComplaintId(complaint.id)
                            setNotice('Complaint details opened.')
                          }}
                          className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                        >
                          View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {visibleComplaints.length === 0 && (
                  <tr>
                    <td colSpan={isStudent ? 7 : 8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No complaints found for the current permission set.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <h2 className="text-xl font-bold">Complaint Details</h2>

          {selectedComplaint ? (
            <div className="mt-5 space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getStatusClass(selectedComplaint.status)}`}>
                    {selectedComplaint.status}
                  </span>
                  <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getPriorityClass(selectedComplaint.priority)}`}>
                    {selectedComplaint.priority}
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-bold">{selectedComplaint.subject}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedComplaint.description}</p>
              </div>

              <div className="grid gap-3 text-sm">
                <div className="border border-border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">Student</div>
                  <div className="mt-1 font-semibold">{selectedComplaint.student}</div>
                </div>

                <div className="border border-border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">Course / Batch</div>
                  <div className="mt-1 font-semibold">
                    {selectedComplaint.course} / {selectedComplaint.batch}
                  </div>
                </div>

                <div className="border border-border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">Assigned To</div>
                  <div className="mt-1 font-semibold">{selectedComplaint.assignedTo}</div>
                </div>

                <div className="border border-border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">Last Reply</div>
                  <div className="mt-1 text-sm leading-6">{selectedComplaint.lastReply}</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold">Conversation</h3>

                <div className="mt-3 space-y-3">
                  {selectedComplaint.replies.map((reply, index) => (
                    <div key={`${reply.by}-${index}`} className="border border-border bg-background/60 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold">{reply.by}</div>
                        <div className="text-xs text-muted-foreground">{reply.date}</div>
                      </div>
                      <div className="mt-1 text-xs text-[#153e90] dark:text-[#6ee75a]">{reply.role}</div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{reply.message}</p>
                    </div>
                  ))}

                  {selectedComplaint.replies.length === 0 && (
                    <div className="border border-border bg-background/60 p-3 text-sm text-muted-foreground">
                      No replies yet.
                    </div>
                  )}
                </div>
              </div>

              {canReplyComplaint && selectedComplaint.status !== 'Resolved' && (
                <div className="space-y-3">
                  <label className="text-sm font-semibold">Reply</label>
                  <textarea
                    value={replyMessage}
                    onChange={(event) => setReplyMessage(event.target.value)}
                    placeholder="Write a reply for the student."
                    rows={4}
                    className="w-full resize-none border border-border bg-background px-3 py-3 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  />

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={addReply}
                      className="bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
                    >
                      Send Reply
                    </button>

                    {canResolveComplaint && (
                      <button
                        type="button"
                        onClick={resolveComplaint}
                        className="border border-border px-5 py-2.5 text-sm font-semibold hover:bg-accent"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              )}

              {selectedComplaint.status === 'Resolved' && (
                <div className="border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-700 dark:text-emerald-200">
                  This complaint is resolved.
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No complaint selected.</p>
          )}
        </div>
      </div>
    </div>
  )
}