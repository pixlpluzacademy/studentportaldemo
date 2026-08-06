'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth/provider'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import { useTasks } from '@/lib/data/hooks/use-tasks'
import { fetchAccessibleBatches, isStudentMyCoursesView } from '@/lib/data/my-courses'
import {
  createTask,
  deleteTask,
  getAssignmentTypeLabel,
  getStudentTaskSubmitHref,
  isTaskSubmissionClosed,
  type TaskFrequency,
  type TaskListRow,
} from '@/lib/data/tasks'
import type { BatchListRow } from '@/lib/data/batches'
import { createClient } from '@/lib/supabase/client'

function getStatusClass(status: string) {
  const value = status.toLowerCase()

  if (value.includes('open')) {
    return 'border-[#153e90]/30 bg-[#153e90]/10 text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white'
  }

  if (value.includes('review')) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  }

  if (value.includes('closed')) {
    return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
  }

  return 'border-border bg-background text-foreground'
}

function formatRoleLabel(parentRoleId: string | null, roleName?: string) {
  if (roleName) return roleName

  if (!parentRoleId) return 'User'

  return parentRoleId
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

async function getAccessToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

const today = new Date().toISOString().slice(0, 10)

export default function Page() {
  const { can, user, role, parentRoleId } = useAuth()
  const { activeBranchId, loading: branchLoading } = useBranchScope()

  const [allowedBatches, setAllowedBatches] = useState<BatchListRow[]>([])
  const [batchesLoading, setBatchesLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const attachmentRef = useRef<HTMLInputElement | null>(null)

  const isStudent = isStudentMyCoursesView(parentRoleId)
  const isMentor = parentRoleId === 'mentor'

  const canCreateTask = !isStudent && (can('tasks.create') || can('tasks.assign'))

  const [form, setForm] = useState({
    title: '',
    description: '',
    batchId: '',
    frequency: 'Daily' as TaskFrequency,
    due: today,
    useScheduledTime: false,
    dueTime: '',
    fileRequirement: '',
    attachmentFile: null as File | null,
    attachmentName: '',
  })

  useEffect(() => {
    if (branchLoading || !user?.id) {
      setAllowedBatches([])
      setBatchesLoading(branchLoading)
      return
    }

    if (!isStudent && !activeBranchId) {
      setAllowedBatches([])
      setBatchesLoading(false)
      return
    }

    let cancelled = false

    async function loadBatches() {
      setBatchesLoading(true)

      const { batches, error } = await fetchAccessibleBatches({
        branchId: activeBranchId || '',
        userId: user!.id,
        parentRoleId,
      })

      if (cancelled) return

      setAllowedBatches(batches)

      if (error) {
        setNotice(error)
      }

      if (batches.length > 0) {
        setForm((prev) => ({
          ...prev,
          batchId: prev.batchId || batches[0].id,
        }))
      }

      setBatchesLoading(false)
    }

    void loadBatches()

    return () => {
      cancelled = true
    }
  }, [activeBranchId, branchLoading, isStudent, parentRoleId, user?.id])

  const batchLookup = useMemo(() => {
    return new Map(
      allowedBatches.map((batch) => [
        batch.id,
        {
          name: batch.name,
          courseName: batch.course_name,
          enrolledCount: batch.enrolled_count,
        },
      ]),
    )
  }, [allowedBatches])

  const allowedBatchIds = useMemo(() => allowedBatches.map((batch) => batch.id), [allowedBatches])

  const { tasks, loading, error, reload } = useTasks(allowedBatchIds, {
    batchLookup,
    studentProfileId: user?.id,
    isStudent,
  })

  const selectedFormBatch = useMemo(
    () => allowedBatches.find((batch) => batch.id === form.batchId) || null,
    [allowedBatches, form.batchId],
  )

  const studentBatchName = isStudent ? allowedBatches[0]?.name : null

  const totalOpen = tasks.filter((task) => task.status === 'Open').length
  const totalReview = tasks.filter((task) => task.status === 'Review').length
  const totalClosed = tasks.filter(
    (task) => isTaskSubmissionClosed(task.due, task.dueTime) || task.status === 'Closed',
  ).length

  const handleCreateTask = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.batchId || !form.due) {
      setNotice('Please add title, description, batch and submission date.')
      return
    }

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setNotice('Session expired. Please login again.')
      return
    }

    setSubmitting(true)
    setNotice('')

    const payload = new FormData()
    payload.append('batchId', form.batchId)
    payload.append('title', form.title.trim())
    payload.append('description', form.description.trim())
    payload.append('frequency', form.frequency)
    payload.append('dueDate', form.due)
    payload.append('fileRequirement', form.fileRequirement.trim())

    if (form.useScheduledTime && form.dueTime) {
      payload.append('dueTime', form.dueTime)
    }

    if (form.attachmentFile) {
      payload.append('attachmentFile', form.attachmentFile)
    }

    const result = await createTask(payload, accessToken)
    setSubmitting(false)

    if (!result.ok) {
      setNotice(result.error || 'Failed to create task.')
      return
    }

    await reload()
    setNotice('Task created and assigned to the selected batch.')
    setForm({
      title: '',
      description: '',
      batchId: allowedBatches[0]?.id || '',
      frequency: 'Daily',
      due: today,
      useScheduledTime: false,
      dueTime: '',
      fileRequirement: '',
      attachmentFile: null,
      attachmentName: '',
    })

    if (attachmentRef.current) {
      attachmentRef.current.value = ''
    }
  }

  const handleDelete = async (task: TaskListRow) => {
    const accessToken = await getAccessToken()

    if (!accessToken) {
      setNotice('Session expired. Please login again.')
      return
    }

    const result = await deleteTask(task.id, accessToken)

    if (!result.ok) {
      setNotice(result.error || 'Failed to delete task.')
      return
    }

    await reload()
    setNotice('Task deleted.')
  }

  if (!can('tasks.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Tasks Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view tasks.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Permission controlled module</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Tasks / Assignments</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Create daily, weekly or one-time assignments for a selected batch. Students only see tasks assigned to their own batch.
          </p>
        </div>

        <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Current role:</span> {formatRoleLabel(parentRoleId, role?.name)}
        </div>
      </div>

      {(error || notice) && (
        <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
          {notice || error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{tasks.length}</div>
          <div className="mt-1 text-sm text-muted-foreground">Assigned Tasks</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Visible based on role</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{totalOpen}</div>
          <div className="mt-1 text-sm text-muted-foreground">Open Tasks</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Students can submit</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{totalReview}</div>
          <div className="mt-1 text-sm text-muted-foreground">In Review</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Mentor evaluation</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{totalClosed}</div>
          <div className="mt-1 text-sm text-muted-foreground">Submission Closed</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Due date completed</div>
        </div>
      </div>

      <div className="space-y-5">
          {canCreateTask && (
            <div className="border border-border bg-card p-5">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <h2 className="text-xl font-bold">Create Batch Assignment</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Assign a task to one batch. Only students in that batch will see it.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Task title</label>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Example: Daily Photoshop Poster Practice"
                    className="h-11 w-full border border-border bg-background px-4 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Assign to batch</label>
                  <select
                    value={form.batchId}
                    onChange={(event) => setForm((prev) => ({ ...prev, batchId: event.target.value }))}
                    disabled={batchesLoading || allowedBatches.length === 0}
                    className="h-11 w-full border border-border bg-background px-4 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  >
                    {allowedBatches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Assignment type</label>
                  <select
                    value={form.frequency}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, frequency: event.target.value as TaskFrequency }))
                    }
                    className="h-11 w-full border border-border bg-background px-4 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  >
                    <option value="Daily">Daily Assignment (out of 50)</option>
                    <option value="Weekly">Weekly Assignment (out of 75)</option>
                    <option value="One-time">Final Project (out of 100)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Submission date</label>
                  <input
                    type="date"
                    value={form.due}
                    onChange={(event) => setForm((prev) => ({ ...prev, due: event.target.value }))}
                    className="h-11 w-full border border-border bg-background px-4 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={form.useScheduledTime}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          useScheduledTime: event.target.checked,
                          dueTime: event.target.checked ? prev.dueTime : '',
                        }))
                      }
                      className="h-4 w-4 border border-border"
                    />
                    Set submission time (optional)
                  </label>
                  <input
                    type="time"
                    value={form.dueTime}
                    disabled={!form.useScheduledTime}
                    onChange={(event) => setForm((prev) => ({ ...prev, dueTime: event.target.value }))}
                    className="h-11 w-full border border-border bg-background px-4 text-sm outline-none focus:border-[#153e90] disabled:cursor-not-allowed disabled:opacity-60 dark:focus:border-[#6ee75a] dark:[color-scheme:dark]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave unchecked for date-only deadlines. Enable when this task must close at a specific time.
                  </p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold">Task description</label>
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Write the full assignment details, expected output, rules, and evaluation points."
                    rows={4}
                    className="w-full resize-none border border-border bg-background px-4 py-3 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">File requirement</label>
                  <input
                    value={form.fileRequirement}
                    onChange={(event) => setForm((prev) => ({ ...prev, fileRequirement: event.target.value }))}
                    placeholder="Example: Upload JPG and source file"
                    className="h-11 w-full border border-border bg-background px-4 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Attach brief / reference file</label>
                  <input
                    ref={attachmentRef}
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null
                      setForm((prev) => ({
                        ...prev,
                        attachmentFile: file,
                        attachmentName: file?.name || '',
                      }))
                    }}
                    className="h-11 w-full border border-border bg-background px-4 py-2 text-sm outline-none file:mr-3 file:border-0 file:bg-[#153e90] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-col justify-between gap-3 border border-border bg-background/60 p-4 md:flex-row md:items-center">
                <div className="text-sm text-muted-foreground">
                  Selected course:{' '}
                  <span className="font-semibold text-foreground">
                    {selectedFormBatch?.course_name || 'Select batch'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCreateTask()}
                  disabled={submitting || batchesLoading || allowedBatches.length === 0}
                  className="bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#153e90]/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
                >
                  {submitting ? 'Creating…' : 'Create Task'}
                </button>
              </div>
            </div>
          )}

          <div className="border border-border bg-card p-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-bold">Task Board</h2>
                <p className="mt-1 text-sm text-muted-foreground">Batch-wise assignment overview.</p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="border border-border bg-background px-3 py-2 font-semibold">Today: {today}</span>
                {isStudent && studentBatchName && (
                  <span className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 font-semibold text-[#153e90] dark:text-white">
                    Student batch: {studentBatchName}
                  </span>
                )}
                {isMentor && (
                  <span className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 font-semibold text-[#153e90] dark:text-white">
                    Assigned batches only
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="px-4 py-3 font-semibold">Task</th>
                    <th className="px-4 py-3 font-semibold">Course</th>
                    <th className="px-4 py-3 font-semibold">Batch</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Assigned By</th>
                    <th className="px-4 py-3 font-semibold">Submission Date</th>
                    <th className="px-4 py-3 font-semibold">Submissions</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading || batchesLoading || branchLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Loading tasks…
                      </td>
                    </tr>
                  ) : tasks.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No tasks found for your scope.
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => {
                      const closed = isTaskSubmissionClosed(task.due, task.dueTime) || task.status === 'Closed'
                      const displayStatus = closed ? 'Submission Closed' : task.status

                      return (
                        <tr key={task.id} className="border-b border-border">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">{task.title}</div>
                            <div className="mt-1 max-w-[260px] truncate text-xs text-muted-foreground">
                              {task.description}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{task.course}</td>
                          <td className="px-4 py-3 text-muted-foreground">{task.batch}</td>
                          <td className="px-4 py-3">
                            <span className="border border-border bg-background px-2 py-1 text-xs font-semibold">
                              {getAssignmentTypeLabel(task.frequency)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{task.assignedBy}</td>
                          <td className="px-4 py-3 text-muted-foreground">{task.dueDisplay}</td>
                          <td className="px-4 py-3 text-muted-foreground">{task.submissions}</td>
                          <td className="px-4 py-3">
                            <span className={`border px-2 py-1 text-xs font-semibold ${getStatusClass(displayStatus)}`}>
                              {displayStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Link
                                href={`/tasks/${task.id}`}
                                className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                              >
                                View
                              </Link>

                              {isStudent && can('submissions.submit') && (
                                closed || task.studentSubmitted ? (
                                  task.studentSubmitted ? (
                                    <Link
                                      href={getStudentTaskSubmitHref(task)}
                                      className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                                    >
                                      Submitted
                                    </Link>
                                  ) : (
                                    <span className="cursor-not-allowed border border-border px-3 py-2 text-xs font-semibold text-muted-foreground opacity-60">
                                      Closed
                                    </span>
                                  )
                                ) : (
                                  <Link
                                    href={getStudentTaskSubmitHref(task)}
                                    className="border border-[#153e90]/30 bg-[#153e90]/10 px-3 py-2 text-xs font-semibold text-[#153e90] hover:bg-[#153e90]/15 dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white"
                                  >
                                    Submit
                                  </Link>
                                )
                              )}

                              {can('tasks.delete') && !isStudent && (
                                <button
                                  type="button"
                                  onClick={() => void handleDelete(task)}
                                  className="border border-border px-3 py-2 text-xs font-semibold hover:bg-red-500/10"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
      </div>
    </div>
  )
}
