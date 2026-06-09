'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useDemoAuth } from '@/lib/demo/auth'
import { batches, courses, students } from '@/lib/demo/seed'

type ClassMaterial = {
  id: string
  title: string
  description: string
  course: string
  batch: string
  batchMode: string
  classDate: string
  uploadedBy: string
  notesFileName: string
  classLink: string
  status: string
}

const today = new Date().toISOString().slice(0, 10)

const demoMaterials: ClassMaterial[] = [
  {
    id: 'mat1',
    title: 'Meta Ads Campaign Structure Notes',
    description:
      'Daily class notes covering campaign objective, audience setup, ad set structure, creative testing and KPI tracking.',
    course: 'Digital Marketing',
    batch: 'DM Morning Batch',
    batchMode: 'Offline',
    classDate: '2026-06-05',
    uploadedBy: 'Nisha Varghese',
    notesFileName: 'meta-ads-campaign-structure.pdf',
    classLink: '',
    status: 'Published',
  },
  {
    id: 'mat2',
    title: 'Next.js App Router Notes and Class Link',
    description:
      'Class notes for app directory routing, page structure, layout files and reusable components. Online class link is attached.',
    course: 'Website Development',
    batch: 'Web Evening Batch',
    batchMode: 'Online',
    classDate: '2026-06-05',
    uploadedBy: 'Nisha Varghese',
    notesFileName: 'nextjs-app-router-notes.pdf',
    classLink: 'https://meet.google.com/demo-class-link',
    status: 'Published',
  },
  {
    id: 'mat3',
    title: 'Interior Lighting Reference Notes',
    description:
      'Reference notes and lighting setup examples for bedroom interior visualization practice.',
    course: '3D Visualization',
    batch: '3D Weekend Batch',
    batchMode: 'Offline',
    classDate: '2026-06-04',
    uploadedBy: 'Rahul Mathew',
    notesFileName: 'interior-lighting-reference-pack.pdf',
    classLink: '',
    status: 'Published',
  },
]

function getStatusClass(status: string) {
  const value = status.toLowerCase()

  if (value.includes('published')) {
    return 'border-[#153e90]/30 bg-[#153e90]/10 text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white'
  }

  if (value.includes('draft')) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  }

  return 'border-border bg-background text-foreground'
}

function getModeClass(mode: string) {
  if (mode.toLowerCase() === 'online') {
    return 'border-[#153e90]/30 bg-[#153e90]/10 text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white'
  }

  return 'border-border bg-background text-foreground'
}

export default function Page() {
  const { role, user, can } = useDemoAuth()

  const isStudent = role?.id === 'student'
  const ismentor = role?.id === 'mentor' || role?.id === 'mentor'
  const isHod = role?.id === 'hod'
  const isAdminLevel = role?.id === 'superadmin' || role?.id === 'admin' || role?.id === 'branch-controller'

  const demomentorName =
    ismentor && user?.fullName === 'Super Admin'
      ? 'Nisha Varghese'
      : user?.fullName

  const currentStudent = useMemo(() => {
    return students.find((student) => student.name === user?.fullName) || students[0]
  }, [user?.fullName])

  const allowedBatches = useMemo(() => {
    if (isStudent) {
      return batches.filter((batch) => batch.name === currentStudent?.batch)
    }

    if (ismentor && demomentorName) {
      return batches.filter((batch) => batch.mentor === demomentorName)
    }

    return batches
  }, [currentStudent?.batch, demomentorName, isStudent, ismentor])

  const [records, setRecords] = useState<ClassMaterial[]>(demoMaterials)
  const [selectedMaterial, setSelectedMaterial] = useState<ClassMaterial>(demoMaterials[0])
  const [notice, setNotice] = useState('')
  const [selectedBatch, setSelectedBatch] = useState('All')
  const [selectedDate, setSelectedDate] = useState('All')

  const [form, setForm] = useState({
    title: '',
    description: '',
    course: allowedBatches[0]?.course || courses[0]?.name || '',
    batch: allowedBatches[0]?.name || '',
    classDate: today,
    notesFileName: '',
    classLink: '',
    status: 'Published',
  })

  const selectedFormBatch = useMemo(() => {
    return batches.find((batch) => batch.name === form.batch)
  }, [form.batch])

  const isSelectedBatchOnline = selectedFormBatch?.mode?.toLowerCase() === 'online'

  const canUploadMaterial = !isStudent && (ismentor || isHod || isAdminLevel || can('courses.edit'))

  const visibleMaterials = useMemo(() => {
    let filtered = records

    if (isStudent) {
      filtered = filtered.filter((material) => material.batch === currentStudent?.batch)
    } else if (ismentor && demomentorName) {
      const mentorBatchNames = allowedBatches.map((batch) => batch.name)
      filtered = filtered.filter((material) => mentorBatchNames.includes(material.batch))
    } else if (isHod) {
      const hodBatchNames = allowedBatches.map((batch) => batch.name)
      filtered = filtered.filter((material) => hodBatchNames.includes(material.batch))
    }

    if (selectedBatch !== 'All') {
      filtered = filtered.filter((material) => material.batch === selectedBatch)
    }

    if (selectedDate !== 'All') {
      filtered = filtered.filter((material) => material.classDate === selectedDate)
    }

    return filtered
  }, [allowedBatches, currentStudent?.batch, demomentorName, isHod, isStudent, ismentor, records, selectedBatch, selectedDate])

  const uniqueDates = useMemo(() => {
    return Array.from(new Set(records.map((material) => material.classDate))).sort().reverse()
  }, [records])

  const totalNotes = visibleMaterials.filter((material) => material.notesFileName).length
  const totalOnlineLinks = visibleMaterials.filter((material) => material.classLink).length
  const totalToday = visibleMaterials.filter((material) => material.classDate === today).length

  const handleCreateMaterial = () => {
    if (!form.title.trim() || !form.description.trim() || !form.batch || !form.classDate) {
      setNotice('Please add title, description, batch and class date.')
      return
    }

    if (!form.notesFileName.trim()) {
      setNotice('Please upload notes file.')
      return
    }

    if (isSelectedBatchOnline && !form.classLink.trim()) {
      setNotice('This is an online batch. Please add the class link.')
      return
    }

    const batch = batches.find((item) => item.name === form.batch)

    const newMaterial: ClassMaterial = {
      id: `mat-${Date.now()}`,
      title: form.title.trim(),
      description: form.description.trim(),
      course: batch?.course || form.course,
      batch: form.batch,
      batchMode: batch?.mode || 'Offline',
      classDate: form.classDate,
      uploadedBy: ismentor ? demomentorName || 'Demo mentor' : user?.fullName || 'Demo User',
      notesFileName: form.notesFileName,
      classLink: batch?.mode?.toLowerCase() === 'online' ? form.classLink.trim() : '',
      status: form.status,
    }

    setRecords((prev) => [newMaterial, ...prev])
    setSelectedMaterial(newMaterial)
    setNotice('Class notes published for the selected batch.')
    setForm({
      title: '',
      description: '',
      course: allowedBatches[0]?.course || courses[0]?.name || '',
      batch: allowedBatches[0]?.name || '',
      classDate: today,
      notesFileName: '',
      classLink: '',
      status: 'Published',
    })
  }

  const handleDelete = (id: string) => {
    const nextRecords = records.filter((material) => material.id !== id)

    setRecords(nextRecords)
    setSelectedMaterial(nextRecords[0] || demoMaterials[0])
    setNotice('Class material deleted from demo local state.')
  }

  const handleDownload = (material: ClassMaterial) => {
    if (!material.notesFileName) {
      setNotice('No notes file available.')
      return
    }

    setNotice(`Demo download started for ${material.notesFileName}. Real file will come from Supabase Storage.`)
  }

  const handleOpenClassLink = (material: ClassMaterial) => {
    if (!material.classLink) {
      setNotice('No class link available for this offline batch.')
      return
    }

    setNotice('Demo class link opened. In real system, this will open Google Meet, Zoom, YouTube or recorded class link.')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Daily learning resources</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Class Materials</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            mentors and HODs can upload daily notes. Online batches also require a class link. Students can view or download materials for their own batch.
          </p>
        </div>

        <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Current role:</span> {role?.name || 'Not selected'}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{visibleMaterials.length}</div>
          <div className="mt-1 text-sm text-muted-foreground">Materials</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Visible based on role</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{totalNotes}</div>
          <div className="mt-1 text-sm text-muted-foreground">Notes Uploaded</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">PDF notes for daily class</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{totalOnlineLinks}</div>
          <div className="mt-1 text-sm text-muted-foreground">Class Links</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Only for online batches</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-3xl font-bold">{totalToday}</div>
          <div className="mt-1 text-sm text-muted-foreground">Today</div>
          <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">{today}</div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {canUploadMaterial && (
            <div className="border border-border bg-card p-5">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <h2 className="text-xl font-bold">Upload Daily Notes</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Offline batches need notes only. Online batches need notes and class link.
                  </p>
                </div>

                <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-3 py-2 text-xs font-semibold text-[#153e90] dark:border-[#6ee75a]/25 dark:bg-[#6ee75a]/10 dark:text-white">
                  Demo local state
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Title</label>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Example: Meta Ads Campaign Notes"
                    className="h-11 w-full border border-border bg-background px-4 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Assign to batch</label>
                  <select
                    value={form.batch}
                    onChange={(event) => {
                      const batch = batches.find((item) => item.name === event.target.value)

                      setForm((prev) => ({
                        ...prev,
                        batch: event.target.value,
                        course: batch?.course || prev.course,
                        classLink: batch?.mode?.toLowerCase() === 'online' ? prev.classLink : '',
                      }))
                    }}
                    className="h-11 w-full border border-border bg-background px-4 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  >
                    {allowedBatches.map((batch) => (
                      <option key={batch.id} value={batch.name}>
                        {batch.name} · {batch.mode}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Class date</label>
                  <input
                    type="date"
                    value={form.classDate}
                    onChange={(event) => setForm((prev) => ({ ...prev, classDate: event.target.value }))}
                    className="h-11 w-full border border-border bg-background px-4 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Batch mode</label>
                  <div className={`flex h-11 items-center border px-4 text-sm font-semibold ${getModeClass(selectedFormBatch?.mode || 'Offline')}`}>
                    {selectedFormBatch?.mode || 'Offline'}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold">Upload notes</label>
                  <input
                    type="file"
                    onChange={(event) => setForm((prev) => ({ ...prev, notesFileName: event.target.files?.[0]?.name || '' }))}
                    className="h-11 w-full border border-border bg-background px-4 py-2 text-sm outline-none file:mr-3 file:border-0 file:bg-[#153e90] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
                  />
                </div>

                {isSelectedBatchOnline && (
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold">Class link</label>
                    <input
                      value={form.classLink}
                      onChange={(event) => setForm((prev) => ({ ...prev, classLink: event.target.value }))}
                      placeholder="Google Meet, Zoom, YouTube or recorded class link"
                      className="h-11 w-full border border-border bg-background px-4 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                    />
                  </div>
                )}

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Write what this note contains and how students should use it."
                    rows={4}
                    className="w-full resize-none border border-border bg-background px-4 py-3 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-col justify-between gap-3 border border-border bg-background/60 p-4 md:flex-row md:items-center">
                <div className="text-sm text-muted-foreground">
                  Selected course:{' '}
                  <span className="font-semibold text-foreground">{selectedFormBatch?.course || form.course || 'Select batch'}</span>
                  <span className="ml-2 text-xs font-semibold text-[#153e90] dark:text-[#6ee75a]">
                    {isSelectedBatchOnline ? 'Online batch requires class link' : 'Offline batch requires notes only'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCreateMaterial}
                  className="bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#153e90]/90 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
                >
                  Publish Notes
                </button>
              </div>
            </div>
          )}

          <div className="border border-border bg-card p-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <h2 className="text-xl font-bold">Daily Notes and Class Links</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Date-wise notes for all batches. Online batches also show class link.
                </p>
              </div>

              <div className={isStudent ? 'grid gap-3' : 'grid gap-3 md:grid-cols-2'}>
  {!isStudent && (
    <select
      value={selectedBatch}
      onChange={(event) => setSelectedBatch(event.target.value)}
      className="h-10 border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
    >
      <option value="All">All Batches</option>
      {allowedBatches.map((batch) => (
        <option key={batch.id} value={batch.name}>
          {batch.name}
        </option>
      ))}
    </select>
  )}

  <select
    value={selectedDate}
    onChange={(event) => setSelectedDate(event.target.value)}
    className="h-10 border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
  >
    <option value="All">All Dates</option>
    {uniqueDates.map((date) => (
      <option key={date} value={date}>
        {date}
      </option>
    ))}
  </select>
</div>
            </div>

            {notice && (
              <div className="mt-4 border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
                {notice}
              </div>
            )}

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[1040px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="px-4 py-3 font-semibold">Material</th>
                    <th className="px-4 py-3 font-semibold">Course</th>
                    <th className="px-4 py-3 font-semibold">Batch</th>
                    <th className="px-4 py-3 font-semibold">Mode</th>
                    <th className="px-4 py-3 font-semibold">Class Date</th>
                    <th className="px-4 py-3 font-semibold">Uploaded By</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleMaterials.map((material) => (
                    <tr key={material.id} className="border-b border-border">
                      <td className="px-4 py-4 align-top">
                        <div className="font-semibold text-foreground">{material.title}</div>
                        <div className="mt-1 max-w-[280px] truncate text-xs text-muted-foreground">
                          {material.description}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top text-muted-foreground">{material.course}</td>
                      <td className="px-4 py-4 align-top text-muted-foreground">{material.batch}</td>

                      <td className="px-4 py-4 align-top">
                        <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getModeClass(material.batchMode)}`}>
                          {material.batchMode}
                        </span>
                      </td>

                      <td className="px-4 py-4 align-top text-muted-foreground">{material.classDate}</td>
                      <td className="px-4 py-4 align-top text-muted-foreground">{material.uploadedBy}</td>

                      <td className="px-4 py-4 align-top">
                        <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getStatusClass(material.status)}`}>
                          {material.status}
                        </span>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMaterial(material)
                              setNotice('Material preview opened.')
                            }}
                            className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
                          >
                            View
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownload(material)}
                            className="border border-[#153e90]/30 bg-[#153e90]/10 px-3 py-2 text-xs font-semibold text-[#153e90] hover:bg-[#153e90]/15 dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white"
                          >
                            Download Notes
                          </button>

                          {material.classLink && (
                            <button
                              type="button"
                              onClick={() => handleOpenClassLink(material)}
                              className="border border-[#153e90]/30 bg-[#153e90]/10 px-3 py-2 text-xs font-semibold text-[#153e90] hover:bg-[#153e90]/15 dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white"
                            >
                              Class Link
                            </button>
                          )}

                          {canUploadMaterial && (
                            <button
                              type="button"
                              onClick={() => handleDelete(material.id)}
                              className="border border-border px-3 py-2 text-xs font-semibold hover:bg-red-500/10"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {visibleMaterials.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No class materials found for the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>


      </div>
    </div>
  )
}