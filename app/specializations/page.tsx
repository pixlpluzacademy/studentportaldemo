'use client'

import { FormEvent, useMemo, useState } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useDemoAuth } from '@/lib/demo/auth'
import { courses, mentors } from '@/lib/demo/seed'

type departmentStatus = 'active' | 'inactive'

type departmentRecord = {
  id: string
  name: string
  description: string
  status: departmentStatus
}

const initialdepartments: departmentRecord[] = [
  {
    id: 'sp-digital-marketing',
    name: 'Digital Marketing',
    description: 'SEO, social media, Meta Ads, Google Ads, analytics, campaign planning and performance marketing.',
    status: 'active',
  },
  {
    id: 'sp-web-development',
    name: 'Website Development',
    description: 'Frontend, Next.js, Supabase, Tailwind, responsive UI, deployment and web application development.',
    status: 'active',
  },
  {
    id: 'sp-3d-visualization',
    name: '3D Visualization',
    description: 'Interior rendering, exterior rendering, lighting, materials, animation and visualization workflow.',
    status: 'active',
  },
  {
    id: 'sp-data-ai',
    name: 'Data Science & AI',
    description: 'Data analysis, AI tools, automation, prompt engineering and practical AI workflows.',
    status: 'inactive',
  },
  {
    id: 'sp-cyber-security',
    name: 'Cyber Security',
    description: 'Security fundamentals, network security, threat analysis, basic SOC and cyber awareness.',
    status: 'inactive',
  },
  {
    id: 'sp-media-production',
    name: 'Media Production',
    description: 'Camera, editing, content production, storytelling, reels, production planning and creative direction.',
    status: 'inactive',
  },
]

function CustomIcon({
  icon,
  folder,
  alt = '',
  className = '',
}: {
  icon: string
  folder: string
  alt?: string
  className?: string
}) {
  return (
    <Image
      src={`/icons/${folder}/${icon}`}
      alt={alt}
      width={24}
      height={24}
      className={`shrink-0 object-contain ${className}`}
      onError={(event) => {
        event.currentTarget.src = `/icons/${folder}/dashboard.svg`
      }}
    />
  )
}

function getStatusClass(status: departmentStatus) {
  if (status === 'active') {
    return 'border-[#153e90]/30 bg-[#153e90]/10 text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white'
  }

  return 'border-border bg-background text-muted-foreground'
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isConnectedToCourse(departmentName: string, courseName: string) {
  const department = normalize(departmentName)
  const course = normalize(courseName)

  if (department.includes('digital') && course.includes('digital')) return true
  if (department.includes('website') && course.includes('website')) return true
  if (department.includes('web') && course.includes('website')) return true
  if (department.includes('3d') && course.includes('3d')) return true
  if (department.includes('visualization') && course.includes('visualization')) return true
  if (department.includes('data') && course.includes('data')) return true
  if (department.includes('ai') && course.includes('ai')) return true
  if (department.includes('cyber') && course.includes('cyber')) return true
  if (department.includes('media') && course.includes('media')) return true

  return course.includes(department) || department.includes(course)
}

function isConnectedToMentor(departmentName: string, mentordepartment: string) {
  const department = normalize(departmentName)
  const mentor = normalize(mentordepartment)

  if (department.includes('digital') && mentor.includes('digital')) return true
  if (department.includes('website') && mentor.includes('web')) return true
  if (department.includes('web') && mentor.includes('web')) return true
  if (department.includes('3d') && mentor.includes('3d')) return true
  if (department.includes('visualization') && mentor.includes('visualization')) return true
  if (department.includes('data') && mentor.includes('data')) return true
  if (department.includes('ai') && mentor.includes('ai')) return true
  if (department.includes('cyber') && mentor.includes('cyber')) return true
  if (department.includes('media') && mentor.includes('media')) return true

  return mentor.includes(department) || department.includes(mentor)
}

export default function Page() {
  const { role, can } = useDemoAuth()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const [records, setRecords] = useState<departmentRecord[]>(initialdepartments)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | departmentStatus>('all')

  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'active' as departmentStatus,
  })

  const canView = can('courses.view')
  const canCreate = can('courses.create')
  const canEdit = can('courses.edit')
  const canDelete = can('courses.delete')

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesSearch =
        record.name.toLowerCase().includes(search.toLowerCase()) ||
        record.description.toLowerCase().includes(search.toLowerCase())

      const matchesStatus = statusFilter === 'all' || record.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [records, search, statusFilter])

  const activeCount = records.filter((record) => record.status === 'active').length
  const inactiveCount = records.filter((record) => record.status === 'inactive').length

  const totalConnectedCourses = useMemo(() => {
    return records.reduce((total, department) => {
      return total + courses.filter((course) => isConnectedToCourse(department.name, course.name)).length
    }, 0)
  }, [records])

  const totalConnectedMentors = useMemo(() => {
    return records.reduce((total, department) => {
      return total + mentors.filter((mentor) => isConnectedToMentor(department.name, mentor.department)).length
    }, 0)
  }, [records])

  const resetForm = () => {
    setEditingId(null)
    setForm({
      name: '',
      description: '',
      status: 'active',
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.name.trim() || !form.description.trim()) {
      setNotice('Please add department name and description.')
      return
    }

    if (editingId) {
      if (!canEdit) {
        setNotice('Your current permission cannot edit departments.')
        return
      }

      setRecords((prev) =>
        prev.map((record) =>
          record.id === editingId
            ? {
                ...record,
                name: form.name.trim(),
                description: form.description.trim(),
                status: form.status,
              }
            : record,
        ),
      )

      setNotice('department updated successfully in demo.')
      resetForm()
      return
    }

    if (!canCreate) {
      setNotice('Your current permission cannot create departments.')
      return
    }

    const newRecord: departmentRecord = {
      id: `sp-${Date.now()}`,
      name: form.name.trim(),
      description: form.description.trim(),
      status: form.status,
    }

    setRecords((prev) => [newRecord, ...prev])
    setNotice('department created successfully in demo.')
    resetForm()
  }

  const handleEdit = (record: departmentRecord) => {
    setEditingId(record.id)
    setForm({
      name: record.name,
      description: record.description,
      status: record.status,
    })
    setNotice(`Editing ${record.name}.`)
  }

  const handleDelete = (recordId: string) => {
    if (!canDelete) {
      setNotice('Your current permission cannot delete departments.')
      return
    }

    setRecords((prev) => prev.filter((record) => record.id !== recordId))
    setNotice('department deleted from demo local state.')
  }

  if (!canView) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">departments Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view department settings.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Course and mentor connection</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">departments</h1>
          <p className="mt-2 max-w-4xl text-muted-foreground">
            departments connect courses and mentors. When creating a batch, the course department should filter eligible mentors before assigning staff to that batch.
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
          <div className="text-3xl font-bold">{records.length}</div>
          <div className="mt-1 text-sm text-muted-foreground">departments</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Total created</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{activeCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">Active</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Available for batches</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{totalConnectedCourses}</div>
          <div className="mt-1 text-sm text-muted-foreground">Course Links</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Demo matching</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{totalConnectedMentors}</div>
          <div className="mt-1 text-sm text-muted-foreground">Mentor Links</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Eligible mentors</div>
        </div>
      </div>

      {(canCreate || canEdit) && (
        <div className="border border-border bg-card p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h2 className="text-xl font-bold">{editingId ? 'Edit department' : 'Create department'}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This will later connect to courses and mentor profiles in Supabase.
              </p>
            </div>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 xl:col-span-1">
                <span className="text-sm font-semibold">department Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Example: Digital Marketing"
                  className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                />
              </label>

              <label className="space-y-2 xl:col-span-1">
                <span className="text-sm font-semibold">Status</span>
                <select
                  value={form.status}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as departmentStatus }))}
                  className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold">Description</span>
                <input
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Short description of this department"
                  className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
              >
                <CustomIcon icon="tasks.svg" folder={iconFolder} alt="" className="h-4 w-4" />
                {editingId ? 'Update department' : 'Create department'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="border border-border bg-card p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-xl font-bold">department List</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These departments will control which mentors are eligible for each course batch.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search department"
              className="h-10 border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | departmentStatus)}
              className="h-10 border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-semibold">department</th>
                <th className="px-4 py-3 font-semibold">Connected Courses</th>
                <th className="px-4 py-3 font-semibold">Eligible Mentors</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredRecords.map((record) => {
                const connectedCourses = courses.filter((course) => isConnectedToCourse(record.name, course.name))
                const connectedMentors = mentors.filter((mentor) => isConnectedToMentor(record.name, mentor.department))

                return (
                  <tr key={record.id} className="border-b border-border">
                    <td className="px-4 py-4 align-top">
                      <div className="font-semibold text-foreground">{record.name}</div>
                      <div className="mt-1 max-w-[360px] text-xs leading-5 text-muted-foreground">{record.description}</div>
                    </td>

                    <td className="px-4 py-4 align-top">
                      {connectedCourses.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {connectedCourses.map((course) => (
                            <span key={course.id} className="border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                              {course.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No course connected</span>
                      )}
                    </td>

                    <td className="px-4 py-4 align-top">
                      {connectedMentors.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {connectedMentors.map((mentor) => (
                            <span
                              key={mentor.id}
                              className="border border-[#153e90]/25 bg-[#153e90]/10 px-2 py-1 text-xs font-semibold text-[#153e90] dark:border-[#6ee75a]/25 dark:bg-[#6ee75a]/10 dark:text-white"
                            >
                              {mentor.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No mentor connected</span>
                      )}
                    </td>

                    <td className="px-4 py-4 align-top">
                      <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold capitalize ${getStatusClass(record.status)}`}>
                        {record.status}
                      </span>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <div className="flex justify-end gap-2">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleEdit(record)}
                            className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                          >
                            Edit
                          </button>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(record.id)}
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

              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No departments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <h2 className="text-xl font-bold">How this works in LMS</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="border border-border bg-background/60 p-4">
            <div className="text-sm font-bold">1. department</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Create Digital Marketing, Web Development, 3D Visualization, etc.</p>
          </div>

          <div className="border border-border bg-background/60 p-4">
            <div className="text-sm font-bold">2. Course</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Course belongs to one department and can have Basic, Advanced, Professional levels.</p>
          </div>

          <div className="border border-border bg-background/60 p-4">
            <div className="text-sm font-bold">3. Mentor</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Mentor has department. This decides eligibility for course batches.</p>
          </div>

          <div className="border border-border bg-background/60 p-4">
            <div className="text-sm font-bold">4. Batch</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Batch selects course and level, then only matching mentors should be assignable.</p>
          </div>
        </div>
      </div>
    </div>
  )
}