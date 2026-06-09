'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

type CourseType = 'basic' | 'advanced' | 'professional'
type CourseStatus = 'active' | 'inactive' | 'archived'
type CourseFilter = 'all' | CourseType

type CourseRow = {
  id: string
  course_name: string
  department: string
  type: CourseType
  description: string
  duration: string
  tools: string[]
  modules: string[]
  tasks_to_complete: string[]
  assignments_projects: string[]
  pass_mark: number
  status: CourseStatus
  created_at: string
  updated_at: string
}

type CourseForm = {
  id: string
  course_name: string
  department: string
  type: CourseType
  description: string
  status: CourseStatus
  toolsText: string
  modulesText: string
  tasksText: string
  assignmentsText: string
  pass_mark: string
}

const durationByType: Record<CourseType, string> = {
  basic: '4 Months - 3 Months Course + 1 Month Internship',
  advanced: '2 Months',
  professional: '1 Month',
}

const departmentOptions = [
  'Digital Marketing',
  'Website Development',
  '3D Visualization',
  'Data Science & AI',
  'Cyber Security',
  'Media Production',
]

const initialCourses: CourseRow[] = [
  {
    id: 'CRS-001',
    course_name: 'Digital Marketing',
    department: 'Digital Marketing',
    type: 'professional',
    description:
      'Short intensive program focused on performance marketing, Meta Ads, GA4, content and campaign execution.',
    duration: durationByType.professional,
    tools: ['Meta Ads', 'GA4', 'Canva', 'Google Ads'],
    modules: ['Marketing Foundation', 'Social Media Strategy', 'Paid Ads', 'Analytics'],
    tasks_to_complete: ['Create campaign strategy', 'Setup Meta campaign', 'Create reporting sheet'],
    assignments_projects: ['Live funnel plan', 'Ad copy set', 'Analytics report'],
    pass_mark: 70,
    status: 'active',
    created_at: '2026-06-01',
    updated_at: '2026-06-03',
  },
  {
    id: 'CRS-002',
    course_name: '3D Visualization',
    department: '3D Visualization',
    type: 'advanced',
    description:
      'Intermediate program for 3D design, rendering, lighting, material setup and presentation workflow.',
    duration: durationByType.advanced,
    tools: ['3ds Max', 'V-Ray', 'Corona', 'Photoshop'],
    modules: ['Modelling', 'Materials', 'Lighting', 'Rendering'],
    tasks_to_complete: ['Interior render', 'Product render', 'Lighting study'],
    assignments_projects: ['Bedroom scene', 'Product composition', 'Final portfolio render'],
    pass_mark: 70,
    status: 'active',
    created_at: '2026-06-01',
    updated_at: '2026-06-03',
  },
  {
    id: 'CRS-003',
    course_name: 'Website Development',
    department: 'Website Development',
    type: 'basic',
    description:
      'Complete foundation program for web development with frontend, backend basics and internship preparation.',
    duration: durationByType.basic,
    tools: ['HTML', 'CSS', 'JavaScript', 'React', 'Next.js'],
    modules: ['Frontend Basics', 'React Foundation', 'Backend Basics', 'Project Building'],
    tasks_to_complete: ['Build landing page', 'Create dashboard UI', 'Connect demo API'],
    assignments_projects: ['Portfolio website', 'Admin dashboard', 'Final internship project'],
    pass_mark: 70,
    status: 'active',
    created_at: '2026-06-01',
    updated_at: '2026-06-03',
  },
]

const tabLinks = [
  { label: 'All Courses', href: '/courses', value: 'all' },
  { label: 'Basic', href: '/courses/basic', value: 'basic' },
  { label: 'Advanced', href: '/courses/advanced', value: 'advanced' },
  { label: 'Professional', href: '/courses/professional', value: 'professional' },
]

function typeLabel(type: CourseType) {
  if (type === 'basic') return 'Basic'
  if (type === 'advanced') return 'Advanced'
  return 'Professional'
}

function getEmptyForm(): CourseForm {
  return {
    id: '',
    course_name: '',
    department: 'Digital Marketing',
    type: 'basic',
    description: '',
    status: 'active',
    toolsText: '',
    modulesText: '',
    tasksText: '',
    assignmentsText: '',
    pass_mark: '70',
  }
}

function textToList(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function listToText(value: string[]) {
  return value.join('\n')
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}

export function CoursePageTemplate({ filter = 'all' }: { filter?: CourseFilter }) {
  const [courses, setCourses] = useState<CourseRow[]>(initialCourses)
  const [open, setOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<CourseRow | null>(null)
  const [form, setForm] = useState<CourseForm>(getEmptyForm())

  const filteredCourses = useMemo(() => {
    if (filter === 'all') return courses
    return courses.filter((course) => course.type === filter)
  }, [courses, filter])

  const stats = useMemo(() => {
    const basic = courses.filter((course) => course.type === 'basic').length
    const advanced = courses.filter((course) => course.type === 'advanced').length
    const professional = courses.filter((course) => course.type === 'professional').length

    if (filter === 'all') {
      return [
        { label: 'Total Courses', value: courses.length, helper: 'All course blueprints' },
        { label: 'Basic', value: basic, helper: '4 months with internship' },
        { label: 'Advanced', value: advanced, helper: '2 month course plan' },
        { label: 'Professional', value: professional, helper: '1 month intensive plan' },
      ]
    }

    const current = courses.filter((course) => course.type === filter)
    const currentTasks = current.reduce((sum, course) => sum + course.tasks_to_complete.length, 0)

    return [
      { label: `${typeLabel(filter)} Courses`, value: current.length, helper: 'Filtered by course type' },
      {
        label: 'Duration',
        value: filter === 'basic' ? '4M' : filter === 'advanced' ? '2M' : '1M',
        helper: durationByType[filter],
      },
      { label: 'Tasks', value: currentTasks, helper: 'Tasks to complete' },
      { label: 'Pass Mark', value: '70%', helper: 'Default evaluation mark' },
    ]
  }, [courses, filter])

  const pageTitle = filter === 'all' ? 'Courses' : `${typeLabel(filter)} Courses`

  const pageSubtitle =
    filter === 'all'
      ? 'Create and manage all pixlpluzportal course blueprints. Courses are separated by Basic, Advanced and Professional types.'
      : `View and manage only ${typeLabel(filter)} course blueprints. Duration is auto-set based on course type.`

  const openCreateModal = () => {
    setEditingCourse(null)
    setForm(getEmptyForm())
    setOpen(true)
  }

  const openEditModal = (course: CourseRow) => {
    setEditingCourse(course)
    setForm({
      id: course.id,
      course_name: course.course_name,
      department: course.department,
      type: course.type,
      description: course.description,
      status: course.status,
      toolsText: listToText(course.tools),
      modulesText: listToText(course.modules),
      tasksText: listToText(course.tasks_to_complete),
      assignmentsText: listToText(course.assignments_projects),
      pass_mark: String(course.pass_mark),
    })
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    setEditingCourse(null)
    setForm(getEmptyForm())
  }

  const handleSave = () => {
    if (!form.id.trim() || !form.course_name.trim() || !form.department.trim() || !form.description.trim()) return

    const now = new Date().toISOString().slice(0, 10)

    const payload: CourseRow = {
      id: form.id.trim(),
      course_name: form.course_name.trim(),
      department: form.department,
      type: form.type,
      description: form.description.trim(),
      duration: durationByType[form.type],
      tools: textToList(form.toolsText),
      modules: textToList(form.modulesText),
      tasks_to_complete: textToList(form.tasksText),
      assignments_projects: textToList(form.assignmentsText),
      pass_mark: Number(form.pass_mark) || 70,
      status: form.status,
      created_at: editingCourse?.created_at || now,
      updated_at: now,
    }

    if (editingCourse) {
      setCourses((prev) => prev.map((course) => (course.id === editingCourse.id ? payload : course)))
    } else {
      setCourses((prev) => [payload, ...prev])
    }

    closeModal()
  }

  const handleDelete = (courseId: string) => {
    setCourses((prev) => prev.filter((course) => course.id !== courseId))
  }

  return (
    <div className="space-y-6">
      <div className="border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Course Management</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{pageTitle}</h1>
            <p className="mt-2 max-w-4xl text-muted-foreground">{pageSubtitle}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/specializations"
              className="inline-flex items-center justify-center bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
            >
              Create Department
            </Link>

            <button
              type="button"
              onClick={openCreateModal}
              className="bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
            >
              Add Course
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border border-border bg-card p-3">
        {tabLinks.map((tab) => (
          <Link
            key={tab.value}
            href={tab.href}
            className={cn(
              'border border-border px-4 py-2 text-sm font-semibold transition',
              filter === tab.value
                ? 'bg-[#153e90] text-white dark:bg-[#6ee75a] dark:text-black'
                : 'bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <div className="mt-3 text-3xl font-bold">{item.value}</div>
            <p className="mt-3 text-xs text-muted-foreground">{item.helper}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5">
        <div className="border border-border bg-card">
          <div className="border-b border-border p-5">
            <SectionTitle
              title={filter === 'all' ? 'All Created Courses' : `${typeLabel(filter)} Course List`}
              subtitle="Courses created here will feed batch creation, curriculum planning and assignment setup later."
            />
          </div>

          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-[8%] px-4 py-3">Course ID</th>
                  <th className="w-[22%] px-4 py-3">Course Name</th>
                  <th className="w-[16%] px-4 py-3">Department</th>
                  <th className="w-[10%] px-4 py-3">Type</th>
                  <th className="w-[8%] px-4 py-3 text-center">Modules</th>
                  <th className="w-[7%] px-4 py-3 text-center">Tasks</th>
                  <th className="w-[8%] px-4 py-3 text-center">Pass Mark</th>
                  <th className="w-[8%] px-4 py-3 text-center">Status</th>
                  <th className="w-[13%] px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredCourses.map((course) => (
                  <tr key={course.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-4 font-semibold">
                      <span className="block break-words">{course.id}</span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="truncate font-semibold">{course.course_name}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{course.description}</div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="block truncate">{course.department}</span>
                    </td>

                    <td className="px-4 py-4">
                      <span className="block truncate">{typeLabel(course.type)}</span>
                    </td>

                    <td className="px-4 py-4 text-center">{course.modules.length}</td>
                    <td className="px-4 py-4 text-center">{course.tasks_to_complete.length}</td>
                    <td className="px-4 py-4 text-center">{course.pass_mark}%</td>

                    <td className="px-4 py-4 text-center">
                      <span
                        className={
                          course.status === 'active'
                            ? 'bg-[#153e90]/10 px-3 py-1 text-xs font-semibold text-[#153e90] dark:bg-[#6ee75a]/10 dark:text-[#6ee75a]'
                            : 'bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground'
                        }
                      >
                        {course.status}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/courses/${course.id}`}
                          className="border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                        >
                          View
                        </Link>

                        <button
                          type="button"
                          onClick={() => openEditModal(course)}
                          className="border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(course.id)}
                          className="border border-red-500/30 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredCourses.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-muted-foreground">
                      No courses found for this type.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-border bg-card shadow-xl">
            <div className="border-b border-border p-5">
              <h2 className="text-xl font-bold">{editingCourse ? 'Edit Course Blueprint' : 'Add Course'}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create the course by selecting department, course type and entering the course name manually.
              </p>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Course ID</label>
                <input
                  value={form.id}
                  onChange={(event) => setForm((prev) => ({ ...prev, id: event.target.value }))}
                  placeholder="Example: CRS-004"
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Course Name</label>
                <input
                  value={form.course_name}
                  onChange={(event) => setForm((prev) => ({ ...prev, course_name: event.target.value }))}
                  placeholder="Example: Digital Marketing"
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Department</label>
                <select
                  value={form.department}
                  onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                >
                  {departmentOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Course Type</label>
                <select
                  value={form.type}
                  onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as CourseType }))}
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                >
                  <option value="basic">Basic</option>
                  <option value="advanced">Advanced</option>
                  <option value="professional">Professional</option>
                </select>

                <p className="text-xs text-muted-foreground">Duration: {durationByType[form.type]}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Status</label>
                <select
                  value={form.status}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as CourseStatus }))}
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="archived">archived</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Short course description"
                  rows={3}
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Tools Used</label>
                <textarea
                  value={form.toolsText}
                  onChange={(event) => setForm((prev) => ({ ...prev, toolsText: event.target.value }))}
                  placeholder="One tool per line"
                  rows={5}
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Modules / Curriculum</label>
                <textarea
                  value={form.modulesText}
                  onChange={(event) => setForm((prev) => ({ ...prev, modulesText: event.target.value }))}
                  placeholder="One module per line"
                  rows={5}
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Tasks to Complete</label>
                <textarea
                  value={form.tasksText}
                  onChange={(event) => setForm((prev) => ({ ...prev, tasksText: event.target.value }))}
                  placeholder="One task per line"
                  rows={5}
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Assignments / Project List</label>
                <textarea
                  value={form.assignmentsText}
                  onChange={(event) => setForm((prev) => ({ ...prev, assignmentsText: event.target.value }))}
                  placeholder="One assignment or project per line"
                  rows={5}
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Pass Mark</label>
                <input
                  value={form.pass_mark}
                  onChange={(event) => setForm((prev) => ({ ...prev, pass_mark: event.target.value }))}
                  placeholder="70"
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border p-5">
              <button
                type="button"
                onClick={closeModal}
                className="border border-border px-5 py-2 text-sm font-semibold hover:bg-muted"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="bg-[#153e90] px-5 py-2 text-sm font-semibold text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
              >
                {editingCourse ? 'Update Course' : 'Save Course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}