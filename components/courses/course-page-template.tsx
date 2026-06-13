'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useDemoAuth } from '@/lib/demo/auth'
import {
  courseTypeLabel,
  createCourseRecord,
  deleteCourseRecord,
  durationLabelByType,
  shortCourseId,
  updateCourseRecord,
  type CourseFilter,
  type CourseFormInput,
  type CourseListRow,
  type CourseStatus,
  type CourseType,
} from '@/lib/data/courses'
import { useCourseList } from '@/lib/data/hooks/use-courses'
import { useDepartmentList } from '@/lib/data/hooks/use-departments'
import { cn } from '@/lib/utils'

type CourseForm = {
  name: string
  department_id: string
  course_type: CourseType
  description: string
  status: CourseStatus
  toolsText: string
  modulesText: string
  pass_mark: string
}

const tabLinks = [
  { label: 'All Courses', href: '/courses', value: 'all' as const },
  { label: 'Basic', href: '/courses/basic', value: 'basic' as const },
  { label: 'Advanced', href: '/courses/advanced', value: 'advanced' as const },
  { label: 'Professional', href: '/courses/professional', value: 'professional' as const },
]

function getEmptyForm(departmentId = ''): CourseForm {
  return {
    name: '',
    department_id: departmentId,
    course_type: 'basic',
    description: '',
    status: 'active',
    toolsText: '',
    modulesText: '',
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

function formToInput(form: CourseForm): CourseFormInput {
  return {
    name: form.name.trim(),
    department_id: form.department_id,
    course_type: form.course_type,
    description: form.description.trim(),
    status: form.status,
    tools: textToList(form.toolsText),
    modules: textToList(form.modulesText),
    pass_mark: Number(form.pass_mark) || 70,
  }
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
  const { can } = useDemoAuth()
  const { courses, activeBranch, activeBranchId, loading, error, reload } = useCourseList(filter)
  const { departments } = useDepartmentList()

  const [open, setOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<CourseListRow | null>(null)
  const [form, setForm] = useState<CourseForm>(() => getEmptyForm())
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const canView = can('courses.view')
  const canCreate = can('courses.create')
  const canEdit = can('courses.edit')
  const canDelete = can('courses.delete')

  const activeDepartments = useMemo(
    () => departments.filter((department) => department.status === 'active'),
    [departments],
  )

  const stats = useMemo(() => {
    const basic = courses.filter((course) => course.course_type === 'basic').length
    const advanced = courses.filter((course) => course.course_type === 'advanced').length
    const professional = courses.filter((course) => course.course_type === 'professional').length

    if (filter === 'all') {
      return [
        { label: 'Total Courses', value: courses.length, helper: 'In selected branch' },
        { label: 'Basic', value: basic, helper: '4 months with internship' },
        { label: 'Advanced', value: advanced, helper: '2 month course plan' },
        { label: 'Professional', value: professional, helper: '1 month intensive plan' },
      ]
    }

    const current = courses.filter((course) => course.course_type === filter)
    const currentModules = current.reduce((sum, course) => sum + course.modules.length, 0)

    return [
      { label: `${courseTypeLabel(filter)} Courses`, value: current.length, helper: 'Filtered by course type' },
      {
        label: 'Duration',
        value: filter === 'basic' ? '4M' : filter === 'advanced' ? '2M' : '1M',
        helper: durationLabelByType[filter],
      },
      { label: 'Modules', value: currentModules, helper: 'Curriculum modules' },
      { label: 'Pass Mark', value: '70%', helper: 'Default evaluation mark' },
    ]
  }, [courses, filter])

  const pageTitle = filter === 'all' ? 'Courses' : `${courseTypeLabel(filter)} Courses`

  const pageSubtitle =
    filter === 'all'
      ? 'Create and manage course blueprints for the selected branch. Courses are linked to branch departments.'
      : `View and manage ${courseTypeLabel(filter)} course blueprints for the selected branch. Duration is auto-set based on course type.`

  const openCreateModal = () => {
    setEditingCourse(null)
    setForm(getEmptyForm(activeDepartments[0]?.id || ''))
    setOpen(true)
  }

  const openEditModal = (course: CourseListRow) => {
    setEditingCourse(course)
    setForm({
      name: course.name,
      department_id: course.department_id,
      course_type: course.course_type,
      description: course.description === '—' ? '' : course.description,
      status: course.status,
      toolsText: listToText(course.tools),
      modulesText: listToText(course.modules),
      pass_mark: String(course.pass_mark),
    })
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    setEditingCourse(null)
    setForm(getEmptyForm(activeDepartments[0]?.id || ''))
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.department_id || !form.description.trim()) {
      setNotice('Course name, department, and description are required.')
      return
    }

    if (!activeBranchId) {
      setNotice('Select a branch from the header before saving a course.')
      return
    }

    setNotice('')
    setSaving(true)

    try {
      const input = formToInput(form)

      if (editingCourse) {
        if (!canEdit) {
          setNotice('You do not have permission to edit courses.')
          return
        }

        const result = await updateCourseRecord(
          editingCourse.id,
          input,
          editingCourse.branch_id || activeBranchId,
        )

        if (!result.ok) {
          setNotice(result.error)
          return
        }

        setNotice('Course updated successfully.')
        closeModal()
        await reload()
        return
      }

      if (!canCreate) {
        setNotice('You do not have permission to create courses.')
        return
      }

      const result = await createCourseRecord(input, activeBranchId)

      if (!result.ok) {
        setNotice(result.error)
        return
      }

      setNotice('Course created successfully.')
      closeModal()
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (courseId: string) => {
    if (!canDelete) {
      setNotice('You do not have permission to delete courses.')
      return
    }

    setNotice('')
    setSaving(true)

    try {
      const result = await deleteCourseRecord(courseId)

      if (!result.ok) {
        setNotice(result.error)
        return
      }

      setNotice('Course deleted successfully.')
      await reload()
    } finally {
      setSaving(false)
    }
  }

  if (!canView) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Courses Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current role cannot view courses.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Course Management</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{pageTitle}</h1>
            <p className="mt-2 max-w-4xl text-muted-foreground">{pageSubtitle}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Scope:{' '}
              <span className="font-semibold text-foreground">
                {activeBranch?.name || 'Select a branch in the header'}
              </span>
              {' · '}
              Data source: <span className="font-semibold text-foreground">Supabase (live)</span>
            </p>
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            {notice && <p className="mt-2 text-sm text-[#153e90] dark:text-[#6ee75a]">{notice}</p>}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/departments"
              className="inline-flex items-center justify-center border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              Manage Departments
            </Link>

            {canCreate && (
              <button
                type="button"
                onClick={openCreateModal}
                disabled={!activeBranchId || activeDepartments.length === 0}
                className="bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#153e90]/90 disabled:opacity-50 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
              >
                Add Course
              </button>
            )}
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
              title={filter === 'all' ? 'All Created Courses' : `${courseTypeLabel(filter)} Course List`}
              subtitle={
                activeBranch
                  ? `Courses for ${activeBranch.name}. These feed batch creation and curriculum planning.`
                  : 'Select a branch to view courses.'
              }
            />
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-[10%] px-4 py-3">Course ID</th>
                  <th className="w-[22%] px-4 py-3">Course Name</th>
                  <th className="w-[16%] px-4 py-3">Department</th>
                  <th className="w-[10%] px-4 py-3">Type</th>
                  <th className="w-[8%] px-4 py-3 text-center">Modules</th>
                  <th className="w-[8%] px-4 py-3 text-center">Pass Mark</th>
                  <th className="w-[8%] px-4 py-3 text-center">Status</th>
                  <th className="w-[18%] px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                      Loading courses…
                    </td>
                  </tr>
                )}

                {!loading && !activeBranchId && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                      Select a branch from the header to view courses.
                    </td>
                  </tr>
                )}

                {!loading &&
                  activeBranchId &&
                  courses.map((course) => (
                    <tr key={course.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-4 font-semibold">
                        <span className="block break-words">{shortCourseId(course.id)}</span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="truncate font-semibold">{course.name}</div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">{course.description}</div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="block truncate">{course.department_name}</span>
                      </td>

                      <td className="px-4 py-4">
                        <span className="block truncate">{courseTypeLabel(course.course_type)}</span>
                      </td>

                      <td className="px-4 py-4 text-center">{course.modules.length}</td>
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

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEditModal(course)}
                              className="border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                            >
                              Edit
                            </button>
                          )}

                          {canDelete && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void handleDelete(course.id)}
                              className="border border-red-500/30 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                {!loading && activeBranchId && courses.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                      {activeDepartments.length === 0
                        ? 'Create a department for this branch first, then add courses.'
                        : 'No courses found for this branch and type.'}
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
                Course is saved to Supabase for {activeBranch?.name || 'the selected branch'}.
              </p>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Course Name</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Example: Digital Marketing"
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Department</label>
                <select
                  value={form.department_id}
                  onChange={(event) => setForm((prev) => ({ ...prev, department_id: event.target.value }))}
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                >
                  <option value="">Select department</option>
                  {activeDepartments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Course Type</label>
                <select
                  value={form.course_type}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, course_type: event.target.value as CourseType }))
                  }
                  className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                >
                  <option value="basic">Basic</option>
                  <option value="advanced">Advanced</option>
                  <option value="professional">Professional</option>
                </select>

                <p className="text-xs text-muted-foreground">Duration: {durationLabelByType[form.course_type]}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Status</label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, status: event.target.value as CourseStatus }))
                  }
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
                disabled={saving}
                onClick={() => void handleSave()}
                className="bg-[#153e90] px-5 py-2 text-sm font-semibold text-white hover:bg-[#153e90]/90 disabled:opacity-50 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
              >
                {saving ? 'Saving…' : editingCourse ? 'Update Course' : 'Save Course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
