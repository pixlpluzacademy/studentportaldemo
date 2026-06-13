'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useDemoAuth } from '@/lib/demo/auth'
import {
  deleteWorkPackage,
  linesToList,
  linesToRubric,
  listToLines,
  rubricToLines,
  saveWorkPackage,
  updateCourseAssignments,
  updateCourseOverview,
  updateCoursePortfolioOutputs,
  updateCourseRubric,
  updateCourseTools,
  type CourseLevel,
  type CourseLevelColor,
  type WorkPackage,
} from '@/lib/data/course-blueprint'
import { useCourseDetail } from '@/lib/data/hooks/use-course-detail'
import { cn } from '@/lib/utils'

const tabs = [
  'Overview',
  'Syllabus',
  'Assignments',
  'Marking Criteria',
  'Tools',
  'Portfolio Outputs',
] as const

type EditModal =
  | 'overview'
  | 'assignments'
  | 'rubric'
  | 'tools'
  | 'outputs'
  | 'package'
  | null

type PackageFormState = {
  id: string | null
  level_id: string
  package_number: string
  title: string
  duration: string
  goal: string
  skillsText: string
  toolsText: string
  practiceTasksText: string
  final_deliverable: string
}

function levelStyle(color: CourseLevelColor) {
  if (color === 'green') return 'border-[#6ee75a] text-[#6ee75a] bg-[#6ee75a]/10'
  if (color === 'yellow') return 'border-yellow-500 text-yellow-500 bg-yellow-500/10'
  return 'border-pink-500 text-pink-500 bg-pink-500/10'
}

function levelBorder(color: CourseLevelColor) {
  if (color === 'green') return 'border-[#6ee75a]'
  if (color === 'yellow') return 'border-yellow-500'
  return 'border-pink-500'
}

function emptyPackageForm(levelId = '', packageNumber = ''): PackageFormState {
  return {
    id: null,
    level_id: levelId,
    package_number: packageNumber,
    title: '',
    duration: '',
    goal: '',
    skillsText: '',
    toolsText: '',
    practiceTasksText: '',
    final_deliverable: '',
  }
}

function nextPackageNumber(levels: CourseLevel[]) {
  const total = levels.reduce((sum, level) => sum + level.packages.length, 0)
  return String(total + 1).padStart(2, '0')
}

function packageToForm(workPackage: WorkPackage, levelId: string): PackageFormState {
  return {
    id: workPackage.id,
    level_id: levelId,
    package_number: workPackage.number,
    title: workPackage.title,
    duration: workPackage.duration === '—' ? '' : workPackage.duration,
    goal: workPackage.goal === '—' ? '' : workPackage.goal,
    skillsText: listToLines(workPackage.skills),
    toolsText: listToLines(workPackage.tools),
    practiceTasksText: listToLines(workPackage.practiceTasks),
    final_deliverable: workPackage.finalDeliverable === '—' ? '' : workPackage.finalDeliverable,
  }
}

export function CourseDetailTemplate() {
  const params = useParams()
  const { can } = useDemoAuth()
  const courseId = String(params?.id || '')
  const { course, loading, error, reload } = useCourseDetail(courseId)

  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Overview')
  const [openPackage, setOpenPackage] = useState('')
  const [editModal, setEditModal] = useState<EditModal>(null)
  const [notice, setNotice] = useState('')
  const [modalMessage, setModalMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const [overviewForm, setOverviewForm] = useState({
    tagline: '',
    description: '',
    levelSummaries: {} as Record<string, string>,
  })
  const [assignmentsText, setAssignmentsText] = useState('')
  const [rubricText, setRubricText] = useState('')
  const [toolsText, setToolsText] = useState('')
  const [outputsText, setOutputsText] = useState('')
  const [packageForm, setPackageForm] = useState<PackageFormState>(() => emptyPackageForm())

  const canEdit = can('courses.edit') || can('courses.create')

  const requireEditPermission = () => {
    if (canEdit) return true
    setModalMessage('You need courses.edit permission to save changes.')
    return false
  }

  const levelOptions = useMemo(
    () => course?.levels.map((level) => ({ id: level.id, name: level.name })) || [],
    [course?.levels],
  )

  const openOverviewModal = () => {
    if (!course) return
    setModalMessage('')
    setOverviewForm({
      tagline: course.tagline,
      description: course.description,
      levelSummaries: Object.fromEntries(course.levels.map((level) => [level.id, level.summary])),
    })
    setEditModal('overview')
  }

  const openAssignmentsModal = () => {
    if (!course) return
    setModalMessage('')
    setAssignmentsText(listToLines(course.assignments))
    setEditModal('assignments')
  }

  const openRubricModal = () => {
    if (!course) return
    setModalMessage('')
    setRubricText(rubricToLines(course.rubric))
    setEditModal('rubric')
  }

  const openToolsModal = () => {
    if (!course) return
    setModalMessage('')
    setToolsText(listToLines(course.tools))
    setEditModal('tools')
  }

  const openOutputsModal = () => {
    if (!course) return
    setModalMessage('')
    setOutputsText(listToLines(course.outputs))
    setEditModal('outputs')
  }

  const openAddPackageModal = (levelId?: string) => {
    if (!course) return
    setModalMessage('')
    setPackageForm(
      emptyPackageForm(
        levelId || levelOptions[0]?.id || '',
        nextPackageNumber(course.levels),
      ),
    )
    setEditModal('package')
  }

  const openEditPackageModal = (level: CourseLevel, workPackage: WorkPackage) => {
    setModalMessage('')
    setPackageForm(packageToForm(workPackage, level.id))
    setEditModal('package')
  }

  const closeModal = () => {
    setEditModal(null)
    setModalMessage('')
    setPackageForm(emptyPackageForm())
  }

  const handleSaveOverview = async () => {
    if (!course || !requireEditPermission()) return
    setSaving(true)
    setModalMessage('')
    setNotice('')
    try {
      const result = await updateCourseOverview(course.id, {
        tagline: overviewForm.tagline,
        description: overviewForm.description,
        levelSummaries: course.levels.map((level) => ({
          id: level.id,
          summary: overviewForm.levelSummaries[level.id] || '',
        })),
      })
      if (!result.ok) {
        setModalMessage(result.error)
        return
      }
      setNotice('Overview updated.')
      closeModal()
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAssignments = async () => {
    if (!course || !requireEditPermission()) return
    setSaving(true)
    setModalMessage('')
    setNotice('')
    try {
      const result = await updateCourseAssignments(course.id, linesToList(assignmentsText))
      if (!result.ok) {
        setModalMessage(result.error)
        return
      }
      setNotice('Assignments updated.')
      closeModal()
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRubric = async () => {
    if (!course || !requireEditPermission()) return

    const parsed = linesToRubric(rubricText)
    if (rubricText.trim() && parsed.length === 0) {
      setModalMessage('Add at least one rubric line. Example: Strategy clarity|20%')
      return
    }

    setSaving(true)
    setModalMessage('')
    setNotice('')
    try {
      const result = await updateCourseRubric(course.id, parsed)
      if (!result.ok) {
        setModalMessage(result.error)
        return
      }
      setNotice('Marking criteria updated.')
      closeModal()
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const handleSaveTools = async () => {
    if (!course || !requireEditPermission()) return
    setSaving(true)
    setModalMessage('')
    setNotice('')
    try {
      const result = await updateCourseTools(course.id, linesToList(toolsText))
      if (!result.ok) {
        setModalMessage(result.error)
        return
      }
      setNotice('Tools updated.')
      closeModal()
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const handleSaveOutputs = async () => {
    if (!course || !requireEditPermission()) return
    setSaving(true)
    setModalMessage('')
    setNotice('')
    try {
      const result = await updateCoursePortfolioOutputs(course.id, linesToList(outputsText))
      if (!result.ok) {
        setModalMessage(result.error)
        return
      }
      setNotice('Portfolio outputs updated.')
      closeModal()
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const handleSavePackage = async () => {
    if (!course || !requireEditPermission()) return

    if (!packageForm.level_id) {
      setModalMessage('Select a syllabus level for this package.')
      return
    }

    if (!packageForm.title.trim()) {
      setModalMessage('Package title is required.')
      return
    }

    const packageNumber =
      packageForm.package_number.trim() ||
      (packageForm.id ? packageForm.package_number : nextPackageNumber(course.levels))

    setSaving(true)
    setModalMessage('')
    setNotice('')
    try {
      const result = await saveWorkPackage(
        {
          level_id: packageForm.level_id,
          package_number: packageNumber,
          title: packageForm.title,
          duration: packageForm.duration,
          goal: packageForm.goal,
          skills: linesToList(packageForm.skillsText),
          tools: linesToList(packageForm.toolsText),
          practice_tasks: linesToList(packageForm.practiceTasksText),
          final_deliverable: packageForm.final_deliverable,
        },
        packageForm.id,
      )
      if (!result.ok) {
        setModalMessage(result.error)
        return
      }
      setNotice(packageForm.id ? 'Work package updated.' : 'Work package added.')
      closeModal()
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePackage = async (packageId: string) => {
    if (!canEdit) return
    setSaving(true)
    setNotice('')
    try {
      const result = await deleteWorkPackage(packageId)
      if (!result.ok) {
        setNotice(result.error)
        return
      }
      setNotice('Work package deleted.')
      setOpenPackage('')
      await reload()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="border border-border bg-card p-8">
        <p className="text-muted-foreground">Loading course blueprint…</p>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Course Not Found</h1>
        <p className="mt-2 text-muted-foreground">{error || 'Course not available in this branch.'}</p>
        <Link href="/courses" className="mt-4 inline-block text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">
          ← All Courses
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/courses" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
          ← All Courses
        </Link>

        {canEdit && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openOverviewModal}
              className="border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              Edit Course
            </button>
            <button
              type="button"
              onClick={() => openAddPackageModal()}
              className="bg-[#153e90] px-4 py-2 text-sm font-semibold text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black"
            >
              Add Work Package
            </button>
          </div>
        )}
      </div>

      {notice && (
        <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
          {notice}
        </div>
      )}

      <div className="border border-border bg-card p-6">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex h-14 w-14 items-center justify-center bg-[#153e90]/10 text-xl font-bold text-[#153e90] dark:bg-[#6ee75a]/10 dark:text-[#6ee75a]">
            {course.name.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1">
            <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">
              {course.typeLabel.toUpperCase()} COURSE BLUEPRINT
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{course.name}</h1>
            <p className="mt-1 text-[#153e90] dark:text-[#6ee75a]">
              {course.tagline || 'Add a tagline from Edit Overview'}
            </p>
            <p className="mt-3 max-w-4xl text-muted-foreground">{course.description || 'No description yet.'}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <p className="text-2xl font-bold">{course.duration}</p>
          <p className="mt-1 text-sm text-muted-foreground">Duration</p>
        </div>
        <div className="border border-border bg-card p-5">
          <p className="text-2xl font-bold">{course.workPackages}</p>
          <p className="mt-1 text-sm text-muted-foreground">Work Packages</p>
        </div>
        <div className="border border-border bg-card p-5">
          <p className="text-2xl font-bold">{course.portfolioOutputs}</p>
          <p className="mt-1 text-sm text-muted-foreground">Portfolio Outputs</p>
        </div>
        <div className="border border-border bg-card p-5">
          <p className="text-2xl font-bold">{course.passMark}%</p>
          <p className="mt-1 text-sm text-muted-foreground">Pass Mark</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border border-border bg-card p-2 md:grid-cols-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-semibold transition',
              activeTab === tab
                ? 'bg-[#153e90] text-white dark:bg-[#6ee75a] dark:text-black'
                : 'bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Curriculum Structure</h2>
              <p className="mt-1 text-sm text-muted-foreground">Course levels and work package summary.</p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={openOverviewModal}
                className="border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Edit Overview
              </button>
            )}
          </div>

          <div className="mt-6 space-y-4">
            {course.levels.map((level) => (
              <div key={level.id} className="flex gap-4">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center border text-sm font-bold',
                    levelStyle(level.color),
                  )}
                >
                  {level.packages.length}
                </span>
                <div>
                  <p className="font-semibold">{level.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {level.summary || 'No summary added yet.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Syllabus' && (
        <div className="border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Syllabus Structure</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Work packages grouped by Foundation, Intermediate and Advanced levels.
              </p>
            </div>

            {canEdit && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={openOverviewModal}
                  className="border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  Edit Syllabus
                </button>
                <button
                  type="button"
                  onClick={() => openAddPackageModal()}
                  className="bg-[#153e90] px-4 py-2 text-sm font-semibold text-white dark:bg-[#6ee75a] dark:text-black"
                >
                  Add Package
                </button>
              </div>
            )}
          </div>

          <div className="mt-7 space-y-8">
            {course.levels.map((level) => (
              <div key={level.id} className={cn('border-l-2 pl-5', levelBorder(level.color))}>
                <div className="mb-4">
                  <span className={cn('inline-flex border px-3 py-1 text-xs font-bold', levelStyle(level.color))}>
                    {level.name}
                  </span>
                  <span className="ml-3 text-sm text-muted-foreground">{level.packages.length} packages</span>
                  <p className="mt-3 text-sm text-muted-foreground">{level.summary || 'No level summary yet.'}</p>
                </div>

                <div className="space-y-3">
                  {level.packages.length === 0 && (
                    <p className="text-sm text-muted-foreground">No work packages in this level yet.</p>
                  )}

                  {level.packages.map((workPackage) => {
                    const isOpen = openPackage === workPackage.id

                    return (
                      <div key={workPackage.id} className="border border-border bg-background">
                        <button
                          type="button"
                          onClick={() => setOpenPackage(isOpen ? '' : workPackage.id)}
                          className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                        >
                          <div className="flex items-center gap-4">
                            <span className="bg-muted px-2 py-1 text-xs font-bold">{workPackage.number}</span>
                            <div>
                              <p className="font-semibold">{workPackage.title}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{workPackage.duration}</p>
                            </div>
                          </div>

                          <span className="text-muted-foreground">{isOpen ? '⌄' : '›'}</span>
                        </button>

                        {isOpen && (
                          <div className="border-t border-border p-4">
                            {canEdit && (
                              <div className="mb-5 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditPackageModal(level, workPackage)}
                                  className="border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                                >
                                  Edit Package
                                </button>
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void handleDeletePackage(workPackage.id)}
                                  className="border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              </div>
                            )}

                            <div className="space-y-5">
                              <div>
                                <p className="text-xs font-bold uppercase text-muted-foreground">Goal</p>
                                <p className="mt-2 font-medium">{workPackage.goal}</p>
                              </div>

                              <div className="grid gap-5 md:grid-cols-2">
                                <div>
                                  <p className="text-xs font-bold uppercase text-muted-foreground">Skills</p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {workPackage.skills.map((skill) => (
                                      <span key={skill} className="border border-border bg-card px-2 py-1 text-xs">
                                        {skill}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <p className="text-xs font-bold uppercase text-muted-foreground">Tools</p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {workPackage.tools.map((tool) => (
                                      <span key={tool} className="border border-border bg-card px-2 py-1 text-xs">
                                        {tool}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <p className="text-xs font-bold uppercase text-muted-foreground">Practice Tasks</p>
                                <ul className="mt-3 space-y-2 text-sm">
                                  {workPackage.practiceTasks.map((task) => (
                                    <li key={task}>○ {task}</li>
                                  ))}
                                </ul>
                              </div>

                              <div className="border border-[#153e90]/40 bg-[#153e90]/5 p-4 dark:border-[#6ee75a]/40 dark:bg-[#6ee75a]/5">
                                <p className="text-xs font-bold uppercase text-[#153e90] dark:text-[#6ee75a]">
                                  Final Deliverable
                                </p>
                                <p className="mt-2 text-sm font-medium">{workPackage.finalDeliverable}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Assignments' && (
        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Assignments</h2>
              <p className="mt-1 text-sm text-muted-foreground">Assignment and project list attached to this course.</p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={openAssignmentsModal}
                className="border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                Edit Assignments
              </button>
            )}
          </div>

          {course.assignments.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">No assignments added yet.</p>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {course.assignments.map((assignment, index) => (
                <div key={assignment} className="border border-border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Assignment {String(index + 1).padStart(2, '0')}</p>
                  <p className="mt-2 font-semibold">{assignment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'Marking Criteria' && (
        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Evaluation Rubric</h2>
              <p className="mt-1 text-sm text-muted-foreground">Marks distribution for evaluation and final QA.</p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={openRubricModal}
                className="border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                Edit Rubric
              </button>
            )}
          </div>

          {course.rubric.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">No marking criteria added yet.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {course.rubric.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between border border-border bg-background p-4"
                >
                  <span className="font-semibold">{item.label}</span>
                  <span className="text-[#153e90] dark:text-[#6ee75a]">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'Tools' && (
        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Tools Used</h2>
              <p className="mt-1 text-sm text-muted-foreground">Tools students need to learn and use in this course.</p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={openToolsModal}
                className="border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                Edit Tools
              </button>
            )}
          </div>

          {course.tools.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">No tools listed yet.</p>
          ) : (
            <div className="mt-5 flex flex-wrap gap-3">
              {course.tools.map((tool) => (
                <span key={tool} className="border border-border bg-background px-4 py-2 text-sm font-semibold">
                  {tool}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'Portfolio Outputs' && (
        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Portfolio Outputs</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Final outputs students should complete before course completion.
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={openOutputsModal}
                className="border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                Edit Outputs
              </button>
            )}
          </div>

          {course.outputs.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">No portfolio outputs added yet.</p>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {course.outputs.map((output, index) => (
                <div key={output} className="border border-border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Output {String(index + 1).padStart(2, '0')}</p>
                  <p className="mt-2 font-semibold">{output}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editModal === 'overview' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border border-border bg-card shadow-xl">
            <div className="border-b border-border p-5">
              <h2 className="text-xl font-bold">Edit Overview</h2>
              <p className="mt-1 text-sm text-muted-foreground">Update tagline, description, and level summaries.</p>
            </div>
            {modalMessage && (
              <p className="border-b border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-600">{modalMessage}</p>
            )}
            <div className="space-y-4 p-5">
              <label className="block space-y-2">
                <span className="text-sm font-semibold">Tagline</span>
                <input
                  value={overviewForm.tagline}
                  onChange={(e) => setOverviewForm((prev) => ({ ...prev, tagline: e.target.value }))}
                  className="w-full border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold">Description</span>
                <textarea
                  value={overviewForm.description}
                  onChange={(e) => setOverviewForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              {course.levels.map((level) => (
                <label key={level.id} className="block space-y-2">
                  <span className="text-sm font-semibold">{level.name} Summary</span>
                  <textarea
                    value={overviewForm.levelSummaries[level.id] || ''}
                    onChange={(e) =>
                      setOverviewForm((prev) => ({
                        ...prev,
                        levelSummaries: { ...prev.levelSummaries, [level.id]: e.target.value },
                      }))
                    }
                    rows={3}
                    className="w-full border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 border-t border-border p-5">
              <button type="button" onClick={closeModal} className="border border-border px-5 py-2 text-sm font-semibold hover:bg-muted">
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveOverview()}
                className="bg-[#153e90] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-[#6ee75a] dark:text-black"
              >
                {saving ? 'Saving…' : 'Save Overview'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal === 'assignments' && (
        <EditListModal
          title="Edit Assignments"
          subtitle="One assignment per line."
          value={assignmentsText}
          onChange={setAssignmentsText}
          onClose={closeModal}
          onSave={() => void handleSaveAssignments()}
          saving={saving}
          saveLabel="Save Assignments"
          message={modalMessage}
        />
      )}

      {editModal === 'rubric' && (
        <EditListModal
          title="Edit Marking Criteria"
          subtitle="One row per line. Examples: Strategy clarity|20% or Strategy clarity 20%"
          value={rubricText}
          onChange={setRubricText}
          onClose={closeModal}
          onSave={() => void handleSaveRubric()}
          saving={saving}
          saveLabel="Save Rubric"
          rows={8}
          message={modalMessage}
        />
      )}

      {editModal === 'tools' && (
        <EditListModal
          title="Edit Tools"
          subtitle="One tool per line."
          value={toolsText}
          onChange={setToolsText}
          onClose={closeModal}
          onSave={() => void handleSaveTools()}
          saving={saving}
          saveLabel="Save Tools"
          message={modalMessage}
        />
      )}

      {editModal === 'outputs' && (
        <EditListModal
          title="Edit Portfolio Outputs"
          subtitle="One output per line."
          value={outputsText}
          onChange={setOutputsText}
          onClose={closeModal}
          onSave={() => void handleSaveOutputs()}
          saving={saving}
          saveLabel="Save Outputs"
          message={modalMessage}
        />
      )}

      {editModal === 'package' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-border bg-card shadow-xl">
            <div className="border-b border-border p-5">
              <h2 className="text-xl font-bold">{packageForm.id ? 'Edit Work Package' : 'Add Work Package'}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Title and level are required. Package number auto-fills if left empty.
              </p>
            </div>
            {modalMessage && (
              <p className="border-b border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-600">{modalMessage}</p>
            )}
            <div className="grid gap-4 p-5 md:grid-cols-2">
              {levelOptions.length === 0 && (
                <p className="md:col-span-2 text-sm text-red-500">
                  No syllabus levels found. Run migration 20250609000009_course_blueprint_details.sql in Supabase,
                  then reload this page.
                </p>
              )}
              <label className="space-y-2">
                <span className="text-sm font-semibold">Level</span>
                <select
                  value={packageForm.level_id}
                  onChange={(e) => setPackageForm((prev) => ({ ...prev, level_id: e.target.value }))}
                  className="w-full border border-border bg-background px-3 py-2 text-sm"
                >
                  {levelOptions.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Package Number</span>
                <input
                  value={packageForm.package_number}
                  onChange={(e) => setPackageForm((prev) => ({ ...prev, package_number: e.target.value }))}
                  placeholder="01"
                  className="w-full border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Title</span>
                <input
                  value={packageForm.title}
                  onChange={(e) => setPackageForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Duration</span>
                <input
                  value={packageForm.duration}
                  onChange={(e) => setPackageForm((prev) => ({ ...prev, duration: e.target.value }))}
                  placeholder="2 weeks"
                  className="w-full border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold">Goal</span>
                <textarea
                  value={packageForm.goal}
                  onChange={(e) => setPackageForm((prev) => ({ ...prev, goal: e.target.value }))}
                  rows={3}
                  className="w-full border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Skills (one per line)</span>
                <textarea
                  value={packageForm.skillsText}
                  onChange={(e) => setPackageForm((prev) => ({ ...prev, skillsText: e.target.value }))}
                  rows={5}
                  className="w-full border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Tools (one per line)</span>
                <textarea
                  value={packageForm.toolsText}
                  onChange={(e) => setPackageForm((prev) => ({ ...prev, toolsText: e.target.value }))}
                  rows={5}
                  className="w-full border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Practice Tasks (one per line)</span>
                <textarea
                  value={packageForm.practiceTasksText}
                  onChange={(e) => setPackageForm((prev) => ({ ...prev, practiceTasksText: e.target.value }))}
                  rows={5}
                  className="w-full border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Final Deliverable</span>
                <textarea
                  value={packageForm.final_deliverable}
                  onChange={(e) => setPackageForm((prev) => ({ ...prev, final_deliverable: e.target.value }))}
                  rows={5}
                  className="w-full border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-border p-5">
              <button type="button" onClick={closeModal} className="border border-border px-5 py-2 text-sm font-semibold hover:bg-muted">
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || levelOptions.length === 0}
                onClick={() => void handleSavePackage()}
                className="bg-[#153e90] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-[#6ee75a] dark:text-black"
              >
                {saving ? 'Saving…' : packageForm.id ? 'Update Package' : 'Save Package'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EditListModal({
  title,
  subtitle,
  value,
  onChange,
  onClose,
  onSave,
  saving,
  saveLabel,
  rows = 10,
  message = '',
}: {
  title: string
  subtitle: string
  value: string
  onChange: (value: string) => void
  onClose: () => void
  onSave: () => void
  saving: boolean
  saveLabel: string
  rows?: number
  message?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-2xl border border-border bg-card shadow-xl">
        <div className="border-b border-border p-5">
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {message && (
          <p className="border-b border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-600">{message}</p>
        )}
        <div className="p-5">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            className="w-full border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-3 border-t border-border p-5">
          <button type="button" onClick={onClose} className="border border-border px-5 py-2 text-sm font-semibold hover:bg-muted">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="bg-[#153e90] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-[#6ee75a] dark:text-black"
          >
            {saving ? 'Saving…' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
