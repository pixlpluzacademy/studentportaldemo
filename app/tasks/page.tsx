'use client'

import { useMemo, useState } from 'react'
import { useDemoAuth } from '@/lib/demo/auth'
import { batches, courses, mentors, students, tasks } from '@/lib/demo/seed'

type TaskFrequency = 'Daily' | 'Weekly' | 'One-time'

type DemoTask = {
  id: string
  title: string
  description: string
  course: string
  batch: string
  assignedBy: string
  frequency: TaskFrequency
  due: string
  submissions: string
  status: string
  fileRequirement: string
  attachmentName?: string
}

const today = new Date().toISOString().slice(0, 10)

const existingTasks: DemoTask[] = tasks.map((task, index) => ({
  id: String(task.id),
  title: String(task.title),
  description:
    index === 0
      ? 'Create a complete Meta Ads funnel plan including campaign objective, audience, creative direction, ad copy, budget split, and reporting KPIs.'
      : index === 1
        ? 'Build a simple portfolio landing page with hero section, about section, project cards, contact section, and responsive layout.'
        : 'Create a bedroom interior render with proper lighting, material setup, camera angle, and final presentation output.',
  course: String(task.course),
  batch: String(task.batch),
  assignedBy: String(task.assignedBy),
  frequency: index === 0 ? 'Daily' : index === 1 ? 'Weekly' : 'One-time',
  due: String(task.due),
  submissions: String(task.submissions),
  status: String(task.status),
  fileRequirement:
    index === 0
      ? 'Upload PDF strategy document and campaign structure screenshot.'
      : index === 1
        ? 'Upload live preview link and source file ZIP.'
        : 'Upload final JPG render and working source file.',
  attachmentName: index === 0 ? 'meta-ads-task-brief.pdf' : index === 1 ? 'portfolio-landing-page-brief.pdf' : 'interior-render-reference.pdf',
}))

function isSubmissionClosed(date: string) {
  if (!date) return false
  return today > date
}

function getSeatCount(seats: string) {
  const total = seats.split('/')[1]
  return total ? total.trim() : '0'
}

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

export default function Page() {
  const { can, role, user } = useDemoAuth()

  const currentStudent = useMemo(() => {
    return students.find((student) => student.name === user?.fullName) || students[0]
  }, [user?.fullName])

  const isStudent = role?.id === 'student'
  const ismentor = role?.id === 'mentor'

  const visibleBatches = useMemo(() => {
    if (ismentor && user?.fullName) {
      return batches.filter((batch) => batch.mentor === user.fullName)
    }

    if (isStudent) {
      return batches.filter((batch) => batch.name === currentStudent?.batch)
    }

    return batches
  }, [currentStudent?.batch, isStudent, ismentor, user?.fullName])

  const [records, setRecords] = useState<DemoTask[]>(existingTasks)
  const [selectedTask, setSelectedTask] = useState<DemoTask>(existingTasks[0])
  const [notice, setNotice] = useState('')

  const [form, setForm] = useState({
    title: '',
    description: '',
    batch: visibleBatches[0]?.name || '',
    frequency: 'Daily' as TaskFrequency,
    due: today,
    fileRequirement: '',
    attachmentName: '',
  })

  const visibleTasks = useMemo(() => {
    if (isStudent) {
      return records.filter((task) => task.batch === currentStudent?.batch)
    }

    if (ismentor && user?.fullName) {
      const assignedBatchNames = visibleBatches.map((batch) => batch.name)
      return records.filter((task) => assignedBatchNames.includes(task.batch) || task.assignedBy === user.fullName)
    }

    return records
  }, [currentStudent?.batch, isStudent, ismentor, records, user?.fullName, visibleBatches])

  const selectedBatch = useMemo(() => {
    return batches.find((batch) => batch.name === form.batch)
  }, [form.batch])

  const selectedCourse = useMemo(() => {
    return courses.find((course) => course.name === selectedBatch?.course)
  }, [selectedBatch?.course])

  const totalOpen = visibleTasks.filter((task) => task.status === 'Open').length
  const totalReview = visibleTasks.filter((task) => task.status === 'Review').length
  const totalClosed = visibleTasks.filter((task) => isSubmissionClosed(task.due)).length

  const handleCreateTask = () => {
    if (!form.title.trim() || !form.description.trim() || !form.batch || !form.due) {
      setNotice('Please add title, description, batch and submission date.')
      return
    }

    const batch = batches.find((item) => item.name === form.batch)
    const newTask: DemoTask = {
      id: `task-${Date.now()}`,
      title: form.title.trim(),
      description: form.description.trim(),
      course: batch?.course || selectedCourse?.name || 'Course not selected',
      batch: form.batch,
      assignedBy: user?.fullName || 'Demo Mentor',
      frequency: form.frequency,
      due: form.due,
      submissions: `0/${getSeatCount(String(batch?.seats || '0/0'))}`,
      status: 'Open',
      fileRequirement: form.fileRequirement.trim() || 'Student must upload the requested work file before the submission date.',
      attachmentName: form.attachmentName || undefined,
    }

    setRecords((prev) => [newTask, ...prev])
    setSelectedTask(newTask)
    setNotice('Demo task created and assigned to the selected batch.')
    setForm({
      title: '',
      description: '',
      batch: visibleBatches[0]?.name || '',
      frequency: 'Daily',
      due: today,
      fileRequirement: '',
      attachmentName: '',
    })
  }

  const handleDelete = (id: string) => {
    const nextRecords = records.filter((task) => task.id !== id)
    setRecords(nextRecords)
    setSelectedTask(nextRecords[0] || existingTasks[0])
    setNotice('Demo task deleted from local state.')
  }

  const handleSubmitDemo = (task: DemoTask) => {
    if (isSubmissionClosed(task.due)) {
      setNotice('Submission date is over. Student cannot submit this task now.')
      return
    }

    setNotice('Demo submission added. In real system, student file upload will be saved in Supabase storage.')
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
          <span className="font-semibold">Current role:</span> {role?.name || 'Not selected'}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{visibleTasks.length}</div>
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

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {can('tasks.create') && !isStudent && (
            <div className="border border-border bg-card p-5">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <h2 className="text-xl font-bold">Create Batch Assignment</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Assign a task to one batch. Only students in that batch will see it.
                  </p>
                </div>
                <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 text-xs font-semibold text-[#153e90] dark:border-[#6ee75a]/25 dark:bg-[#6ee75a]/10 dark:text-white">
                  Demo local state
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
                    value={form.batch}
                    onChange={(event) => setForm((prev) => ({ ...prev, batch: event.target.value }))}
                    className="h-11 w-full border border-border bg-background px-4 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  >
                    {visibleBatches.map((batch) => (
                      <option key={batch.id} value={batch.name}>
                        {batch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Assignment type</label>
                  <select
                    value={form.frequency}
                    onChange={(event) => setForm((prev) => ({ ...prev, frequency: event.target.value as TaskFrequency }))}
                    className="h-11 w-full border border-border bg-background px-4 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  >
                    <option value="Daily">Daily Assignment</option>
                    <option value="Weekly">Weekly Assignment</option>
                    <option value="One-time">One-time Assignment</option>
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
                    type="file"
                    onChange={(event) => setForm((prev) => ({ ...prev, attachmentName: event.target.files?.[0]?.name || '' }))}
                    className="h-11 w-full border border-border bg-background px-4 py-2 text-sm outline-none file:mr-3 file:border-0 file:bg-[#153e90] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-col justify-between gap-3 border border-border bg-background/60 p-4 md:flex-row md:items-center">
                <div className="text-sm text-muted-foreground">
                  Selected course:{' '}
                  <span className="font-semibold text-foreground">{selectedBatch?.course || 'Select batch'}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCreateTask}
                  className="bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
                >
                  Create Task
                </button>
              </div>
            </div>
          )}

          <div className="border border-border bg-card p-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-bold">Task Board</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Batch-wise assignment overview for investor presentation.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="border border-border bg-background px-3 py-2 font-semibold">Today: {today}</span>
                {isStudent && <span className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 font-semibold text-[#153e90] dark:text-white">Student batch: {currentStudent?.batch}</span>}
              </div>
            </div>

            {notice && (
              <div className="mt-4 border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
                {notice}
              </div>
            )}

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
                  {visibleTasks.map((task) => {
                    const closed = isSubmissionClosed(task.due)

                    return (
                      <tr key={task.id} className="border-b border-border">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{task.title}</div>
                          <div className="mt-1 max-w-[260px] truncate text-xs text-muted-foreground">{task.description}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{task.course}</td>
                        <td className="px-4 py-3 text-muted-foreground">{task.batch}</td>
                        <td className="px-4 py-3">
                          <span className="border border-border bg-background px-2 py-1 text-xs font-semibold">
                            {task.frequency}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{task.assignedBy}</td>
                        <td className="px-4 py-3 text-muted-foreground">{task.due}</td>
                        <td className="px-4 py-3 text-muted-foreground">{task.submissions}</td>
                        <td className="px-4 py-3">
                          <span className={`border px-2 py-1 text-xs font-semibold ${getStatusClass(closed ? 'Closed' : task.status)}`}>
                            {closed ? 'Submission Closed' : task.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTask(task)
                                setNotice('Task preview opened.')
                              }}
                              className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                            >
                              View
                            </button>

                            {isStudent && (
                              <button
                                type="button"
                                disabled={closed}
                                onClick={() => handleSubmitDemo(task)}
                                className={
                                  closed
                                    ? 'cursor-not-allowed border border-border px-3 py-2 text-xs font-semibold text-muted-foreground opacity-60'
                                    : 'border border-[#153e90]/30 bg-[#153e90]/10 px-3 py-2 text-xs font-semibold text-[#153e90] hover:bg-[#153e90]/15 dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white'
                                }
                              >
                                {closed ? 'Closed' : 'Submit'}
                              </button>
                            )}

                            {can('tasks.edit') && !isStudent && (
                              <button
                                type="button"
                                onClick={() => setNotice('Edit action available in demo. Real edit will update the task record.')}
                                className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                              >
                                Edit
                              </button>
                            )}

                            {can('tasks.delete') && !isStudent && (
                              <button
                                type="button"
                                onClick={() => handleDelete(task.id)}
                                className="border border-border px-3 py-2 text-xs font-semibold hover:bg-red-500/10"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Task Preview</h3>
                <p className="mt-1 text-sm text-muted-foreground">Full assignment details shown from View action.</p>
              </div>
              <span className={`border px-2 py-1 text-xs font-semibold ${getStatusClass(isSubmissionClosed(selectedTask?.due || '') ? 'Closed' : selectedTask?.status || '')}`}>
                {isSubmissionClosed(selectedTask?.due || '') ? 'Closed' : selectedTask?.status}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Title</div>
                <div className="mt-1 font-bold">{selectedTask?.title}</div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{selectedTask?.description}</p>
              </div>

              <div className="grid gap-3 text-sm">
                <div className="border border-border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">Course</div>
                  <div className="mt-1 font-semibold">{selectedTask?.course}</div>
                </div>

                <div className="border border-border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">Batch</div>
                  <div className="mt-1 font-semibold">{selectedTask?.batch}</div>
                </div>

                <div className="border border-border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">Assignment Type</div>
                  <div className="mt-1 font-semibold">{selectedTask?.frequency}</div>
                </div>

                <div className="border border-border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">Submission Date</div>
                  <div className="mt-1 font-semibold">{selectedTask?.due}</div>
                </div>

                <div className="border border-border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">File Requirement</div>
                  <div className="mt-1 font-semibold">{selectedTask?.fileRequirement}</div>
                </div>

                <div className="border border-border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">Attached Brief</div>
                  <div className="mt-1 font-semibold">{selectedTask?.attachmentName || 'No file attached'}</div>
                </div>
              </div>

              {isStudent && (
                <div className="border border-[#153e90]/25 bg-[#153e90]/10 p-4 text-sm text-[#153e90] dark:text-white">
                  {isSubmissionClosed(selectedTask?.due || '')
                    ? 'Submission date is over. Student cannot submit this task.'
                    : 'Submission is open. Student can upload the required file before the due date.'}
                </div>
              )}
            </div>
          </div>

          <div className="border border-border bg-card p-5">
            <h3 className="text-lg font-bold">Investor Demo Notes</h3>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#153e90] dark:bg-[#6ee75a]" />
                Mentor assigns tasks to a selected batch, not to every student manually.
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#153e90] dark:bg-[#6ee75a]" />
                Daily, weekly and one-time assignments are supported in the same workflow.
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#153e90] dark:bg-[#6ee75a]" />
                Students only see assignments connected to their own batch.
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#153e90] dark:bg-[#6ee75a]" />
                After the submission date, the submit action is automatically locked.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}