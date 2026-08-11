'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth/provider'
import {
  deleteClassMaterial,
  openClassMaterialFile,
  uploadClassMaterial,
  type ClassMaterialRow,
} from '@/lib/data/class-materials'
import { useClassMaterials } from '@/lib/data/hooks/use-class-materials'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import { fetchAccessibleBatches, isStudentMyCoursesView } from '@/lib/data/my-courses'
import type { BatchListRow } from '@/lib/data/batches'
import { createClient } from '@/lib/supabase/client'

const today = new Date().toISOString().slice(0, 10)

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

export default function Page() {
  const { can, user, role, parentRoleId } = useAuth()
  const { activeBranchId, loading: branchLoading } = useBranchScope()

  const [allowedBatches, setAllowedBatches] = useState<BatchListRow[]>([])
  const [batchesLoading, setBatchesLoading] = useState(true)

  const batchLookup = useMemo(() => {
    return new Map(
      allowedBatches.map((batch) => [
        batch.id,
        {
          name: batch.name,
          courseName: batch.course_name,
          mode: batch.batch_mode,
        },
      ]),
    )
  }, [allowedBatches])

  const { materials, loading, error, reload } = useClassMaterials(batchLookup)
  const [notice, setNotice] = useState('')
  const [selectedBatch, setSelectedBatch] = useState('All')
  const [selectedDate, setSelectedDate] = useState('All')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isStudent = isStudentMyCoursesView(parentRoleId)

  const [form, setForm] = useState({
    title: '',
    description: '',
    batchId: '',
    classDate: today,
    notesFile: null as File | null,
    notesFileName: '',
    classLink: '',
  })

  useEffect(() => {
    if (branchLoading || !activeBranchId || !user?.id) {
      setAllowedBatches([])
      setBatchesLoading(branchLoading)
      return
    }

    let cancelled = false
    const userId = user.id
    const branchId = activeBranchId

    async function loadBatches() {
      setBatchesLoading(true)

      const { batches, error: batchError } = await fetchAccessibleBatches({
        branchId,
        userId,
        parentRoleId,
      })

      if (cancelled) return

      setAllowedBatches(batches)

      if (batchError) {
        setNotice(batchError)
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
  }, [activeBranchId, branchLoading, parentRoleId, user?.id])

  const selectedFormBatch = useMemo(() => {
    return allowedBatches.find((batch) => batch.id === form.batchId)
  }, [allowedBatches, form.batchId])

  const isSelectedBatchOnline = selectedFormBatch?.batch_mode === 'online'

  const canUploadMaterial =
    !isStudent && (can('class-materials.upload') || can('class-materials.edit'))
  const canDeleteMaterial = can('class-materials.delete')

  const allowedBatchIds = useMemo(() => new Set(allowedBatches.map((batch) => batch.id)), [allowedBatches])

  const visibleMaterials = useMemo(() => {
    let filtered = materials.filter((material) => allowedBatchIds.has(material.batchId))

    if (selectedBatch !== 'All') {
      filtered = filtered.filter((material) => material.batch === selectedBatch)
    }

    if (selectedDate !== 'All') {
      filtered = filtered.filter((material) => material.classDate === selectedDate)
    }

    return filtered
  }, [allowedBatchIds, materials, selectedBatch, selectedDate])

  const uniqueDates = useMemo(() => {
    return Array.from(new Set(materials.map((material) => material.classDate))).sort().reverse()
  }, [materials])

  const totalNotes = visibleMaterials.filter((material) => material.notesFileName).length
  const totalOnlineLinks = visibleMaterials.filter((material) => material.classLink).length
  const totalToday = visibleMaterials.filter((material) => material.classDate === today).length

  const handleCreateMaterial = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.batchId || !form.classDate) {
      setNotice('Please add title, description, batch and class date.')
      return
    }

    if (!form.notesFile) {
      setNotice('Please upload notes file.')
      return
    }

    if (isSelectedBatchOnline && !form.classLink.trim()) {
      setNotice('This is an online batch. Please add the class link.')
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
    payload.append('classDate', form.classDate)
    payload.append('notesFile', form.notesFile)

    if (isSelectedBatchOnline) {
      payload.append('classLink', form.classLink.trim())
    }

    const result = await uploadClassMaterial(payload, accessToken)
    setSubmitting(false)

    if (!result.ok) {
      setNotice(result.error || 'Failed to upload class material.')
      return
    }

    await reload()
    setNotice('Class notes published for the selected batch.')
    setForm({
      title: '',
      description: '',
      batchId: allowedBatches[0]?.id || '',
      classDate: today,
      notesFile: null,
      notesFileName: '',
      classLink: '',
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (material: ClassMaterialRow) => {
    const accessToken = await getAccessToken()

    if (!accessToken) {
      setNotice('Session expired. Please login again.')
      return
    }

    const result = await deleteClassMaterial(material.id, accessToken)

    if (!result.ok) {
      setNotice(result.error || 'Failed to delete class material.')
      return
    }

    await reload()
    setNotice('Class material deleted.')
  }

  const handleView = async (material: ClassMaterialRow) => {
    if (!material.notesFilePath && !material.notesFileName) {
      setNotice('No notes file available.')
      return
    }

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setNotice('Session expired. Please login again.')
      return
    }

    setNotice('')

    const result = await openClassMaterialFile(material, accessToken, 'view')

    if (!result.ok) {
      setNotice(result.error || 'Failed to open notes.')
      return
    }

    setNotice(`Opened ${material.notesFileName || 'class notes'} in a new tab.`)
  }

  const handleDownload = async (material: ClassMaterialRow) => {
    if (!material.notesFilePath && !material.notesFileName) {
      setNotice('No notes file available.')
      return
    }

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setNotice('Session expired. Please login again.')
      return
    }

    const result = await openClassMaterialFile(material, accessToken, 'download')

    if (!result.ok) {
      setNotice(result.error || 'Failed to prepare download.')
      return
    }

    setNotice(`Download started for ${material.notesFileName || 'class notes'}.`)
  }

  const handleOpenClassLink = (material: ClassMaterialRow) => {
    if (!material.classLink) {
      setNotice('No class link available for this offline batch.')
      return
    }

    window.open(material.classLink, '_blank', 'noopener,noreferrer')
    setNotice('Class link opened.')
  }

  if (!can('class-materials.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Class Materials Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current permission cannot view class materials.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Daily learning resources</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Class Materials</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Mentors and HODs can upload daily notes. Online batches also require a class link. Students can view or
            download materials for their own batch.
          </p>
        </div>

        <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Current role:</span>{' '}
          {formatRoleLabel(parentRoleId, role?.name)}
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
                    value={form.batchId}
                    onChange={(event) => {
                      const batch = allowedBatches.find((item) => item.id === event.target.value)

                      setForm((prev) => ({
                        ...prev,
                        batchId: event.target.value,
                        classLink: batch?.batch_mode === 'online' ? prev.classLink : '',
                      }))
                    }}
                    disabled={batchesLoading || allowedBatches.length === 0}
                    className="h-11 w-full border border-border bg-background px-4 text-sm outline-none focus:border-[#153e90] dark:focus:border-[#6ee75a]"
                  >
                    {allowedBatches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.name} · {batch.batch_mode === 'online' ? 'Online' : 'Offline'}
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
                  <div
                    className={`flex h-11 items-center border px-4 text-sm font-semibold ${getModeClass(
                      selectedFormBatch?.batch_mode === 'online' ? 'Online' : 'Offline',
                    )}`}
                  >
                    {selectedFormBatch?.batch_mode === 'online' ? 'Online' : 'Offline'}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold">Upload notes</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null
                      setForm((prev) => ({
                        ...prev,
                        notesFile: file,
                        notesFileName: file?.name || '',
                      }))
                    }}
                    className="h-11 w-full border border-border bg-background px-4 py-2 text-sm outline-none file:mr-3 file:border-0 file:bg-[#153e90] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
                  />
                </div>

                {isSelectedBatchOnline && (
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold">Class link</label>
                    <input
                      value={form.classLink}
                      onChange={(event) => setForm((prev) => ({ ...prev, classLink: event.target.value }))}
                      placeholder="YouTube class link or recorded class link"
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
                  <span className="font-semibold text-foreground">
                    {selectedFormBatch?.course_name || 'Select batch'}
                  </span>
                  <span className="ml-2 text-xs font-semibold text-[#153e90] dark:text-[#6ee75a]">
                    {isSelectedBatchOnline ? 'Online batch requires class link' : 'Offline batch requires notes only'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void handleCreateMaterial()}
                  disabled={submitting || batchesLoading || allowedBatches.length === 0}
                  className="bg-[#153e90] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#153e90]/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#6ee75a] dark:text-black dark:hover:bg-[#6ee75a]/90"
                >
                  {submitting ? 'Publishing…' : 'Publish Notes'}
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

            {(notice || error) && (
              <div className="mt-4 border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
                {notice || error}
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
                  {loading || branchLoading || batchesLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Loading class materials…
                      </td>
                    </tr>
                  ) : (
                    visibleMaterials.map((material) => (
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
                          <span
                            className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getModeClass(material.batchMode)}`}
                          >
                            {material.batchMode}
                          </span>
                        </td>

                        <td className="px-4 py-4 align-top text-muted-foreground">{material.classDate}</td>
                        <td className="px-4 py-4 align-top text-muted-foreground">{material.uploadedBy}</td>

                        <td className="px-4 py-4 align-top">
                          <span
                            className={`inline-flex whitespace-nowrap border px-2 py-1 text-xs font-semibold ${getStatusClass(material.status)}`}
                          >
                            {material.status}
                          </span>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void handleView(material)}
                              disabled={!material.notesFilePath && !material.notesFileName}
                              className="border border-border px-3 py-2 text-xs font-semibold hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              View
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleDownload(material)}
                              disabled={!material.notesFilePath && !material.notesFileName}
                              className="border border-[#153e90]/30 bg-[#153e90]/10 px-3 py-2 text-xs font-semibold text-[#153e90] hover:bg-[#153e90]/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-white"
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

                            {canDeleteMaterial && (
                              <button
                                type="button"
                                onClick={() => void handleDelete(material)}
                                className="border border-border px-3 py-2 text-xs font-semibold hover:bg-red-500/10"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}

                  {!loading && !branchLoading && !batchesLoading && visibleMaterials.length === 0 && (
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
  )
}
