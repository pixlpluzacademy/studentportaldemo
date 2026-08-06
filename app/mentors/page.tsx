'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth/provider'
import { useMentorDirectory } from '@/lib/data/hooks/use-mentors'
import {
  createMentorAccount,
  deleteMentorAccount,
  MENTOR_HOD_SLUG,
  updateMentorRecord,
  type MentorFormInput,
  type MentorListRow,
  type MentorUiStatus,
} from '@/lib/data/mentors'
import { updateStaffPassword } from '@/lib/data/users'
import { createClient } from '@/lib/supabase/client'

type CreatedCredentials = {
  fullName: string
  email: string
  password: string
}

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

const inputClass =
  'h-10 w-full border border-border bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground dark:[color-scheme:dark]'

const selectClass =
  'h-10 w-full border border-border bg-transparent px-3 text-sm text-foreground outline-none dark:[color-scheme:dark]'

const optionClass = 'bg-[#111111] text-white'

function getStatusClass(status: MentorUiStatus) {
  if (status === 'active') {
    return 'border border-[#6ee75a]/30 bg-[#6ee75a]/10 px-3 py-1 text-xs font-medium text-[#6ee75a]'
  }

  return 'border border-border bg-transparent px-3 py-1 text-xs font-medium text-muted-foreground'
}

function createEmptyForm(defaultProfileId: string, defaultDepartmentId: string): MentorFormInput {
  return {
    full_name: '',
    email: '',
    phone: '',
    permission_profile_id: defaultProfileId,
    department_id: defaultDepartmentId,
    reports_to: null,
    joining_date: '',
    status: 'active',
  }
}

async function getAccessToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function formatCredentialsText(credentials: CreatedCredentials) {
  return `Name: ${credentials.fullName}\nEmail: ${credentials.email}\nPassword: ${credentials.password}`
}

async function copyCredential(
  label: string,
  text: string,
  setCopyNotice: (value: string) => void,
) {
  const copied = await copyToClipboard(text)
  setCopyNotice(copied ? `${label} copied.` : `Could not copy ${label.toLowerCase()}.`)
  window.setTimeout(() => setCopyNotice(''), 2000)
}

type SummaryCard = {
  label: string
  value: string | number
  helper: string
  icon: string
}

function mentorTypeIcon(slug: string) {
  if (slug === 'mentor_hod') return 'reviews.svg'
  if (slug === 'mentor_trainer') return 'patch.svg'
  return 'mentors.svg'
}

function StatCard({ card, iconFolder }: { card: SummaryCard; iconFolder: string }) {
  return (
    <div className="border border-border bg-card p-5 transition hover:border-[#153e90]/40 dark:hover:border-[#6ee75a]/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{card.label}</p>
          <div className="mt-3 text-3xl font-bold tracking-tight">{card.value}</div>
        </div>

        <div className="flex h-11 w-11 items-center justify-center bg-[#153e90]/10 dark:bg-[#6ee75a]/10">
          <CustomIcon icon={card.icon} folder={iconFolder} alt={card.label} className="h-5 w-5" />
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{card.helper}</p>
    </div>
  )
}

export default function Page() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { can, user, role, parentRoleId } = useAuth()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'
  const canUpdateStaffPassword =
    parentRoleId === 'super_admin' || parentRoleId === 'company_admin'

  const {
    mentors,
    departments,
    mentorTypeProfiles,
    activeBranchId,
    activeBranch,
    loading,
    error: loadError,
    reload,
  } = useMentorDirectory()

  const [search, setSearch] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('all')
  const [filterHod, setFilterHod] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<MentorFormInput>(() => createEmptyForm('', ''))

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loadingAction, setLoadingAction] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null)
  const [copyNotice, setCopyNotice] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const defaultProfileId = mentorTypeProfiles[0]?.id || ''
  const defaultDepartmentId = departments[0]?.id || ''

  const canCreateMentor = can('mentors.create')
  const canEditMentor = can('mentors.edit')
  const canDeleteMentor = can('mentors.delete')
  const canExportMentor = can('mentors.export')
  const canAssignMentor = can('mentors.assign')
  const canManageMentors = canCreateMentor || canEditMentor || canAssignMentor

  const isHodView = role?.id === 'hod'

  const selectedMentorType = useMemo(() => {
    return mentorTypeProfiles.find((profile) => profile.id === form.permission_profile_id) || null
  }, [form.permission_profile_id, mentorTypeProfiles])

  const isSelectedHodType = selectedMentorType?.slug === MENTOR_HOD_SLUG

  useEffect(() => {
    setFilterDepartment('all')
    setFilterHod('all')
    setFilterType('all')
    setFilterStatus('all')
    setSearch('')
  }, [activeBranchId])

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId || loading || !mentors.length) return

    const item = mentors.find((row) => row.id === editId)
    if (!item || editingId === editId) return

    setForm({
      full_name: item.full_name,
      email: item.email,
      phone: item.phone === 'Not added' ? '' : item.phone,
      permission_profile_id: item.permission_profile_id || defaultProfileId,
      department_id: item.department_id || defaultDepartmentId,
      reports_to: item.reports_to,
      joining_date: item.joining_date,
      status: item.status,
    })
    setNewPassword('')
    setConfirmPassword('')
    setPasswordMessage('')
    setPasswordError('')
    setEditingId(item.id)
    setIsModalOpen(true)
  }, [defaultDepartmentId, defaultProfileId, editingId, loading, mentors, searchParams])

  useEffect(() => {
    if (!editingId && defaultProfileId) {
      setForm((prev) =>
        prev.full_name
          ? prev
          : createEmptyForm(defaultProfileId, defaultDepartmentId),
      )
    }
  }, [defaultDepartmentId, defaultProfileId, editingId])

  const scopedMentors = useMemo(() => {
    if (!isHodView || !user?.id) return mentors
    return mentors.filter((mentor) => mentor.reports_to === user.id)
  }, [mentors, isHodView, user?.id])

  const departmentOptions = useMemo(() => {
    return departments
      .filter((item) => item.status === 'active')
      .map((item) => ({ id: item.id, name: item.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [departments])

  const hodOptions = useMemo(() => {
    return mentors
      .filter(
        (mentor) =>
          mentor.permission_profile_slug === MENTOR_HOD_SLUG && mentor.id !== editingId,
      )
      .map((mentor) => ({ id: mentor.id, name: mentor.full_name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [mentors, editingId])

  const filteredMentors = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return scopedMentors.filter((mentor) => {
      const matchesSearch =
        !keyword ||
        mentor.full_name.toLowerCase().includes(keyword) ||
        mentor.email.toLowerCase().includes(keyword) ||
        mentor.phone.toLowerCase().includes(keyword) ||
        mentor.department_name.toLowerCase().includes(keyword) ||
        mentor.superior_name.toLowerCase().includes(keyword) ||
        mentor.permission_profile_name.toLowerCase().includes(keyword) ||
        mentor.status.toLowerCase().includes(keyword)

      const matchesDepartment =
        filterDepartment === 'all' || mentor.department_id === filterDepartment

      return (
        matchesSearch &&
        matchesDepartment &&
        (filterHod === 'all' || mentor.reports_to === filterHod) &&
        (filterStatus === 'all' || mentor.status === filterStatus) &&
        (filterType === 'all' || mentor.permission_profile_id === filterType)
      )
    })
  }, [scopedMentors, search, filterDepartment, filterHod, filterStatus, filterType])

  const statCards = useMemo(() => {
    const cards: SummaryCard[] = [
      {
        label: isHodView ? 'Assigned mentors' : 'Total mentors',
        value: filteredMentors.length,
        helper: isHodView ? 'Under your HOD scope' : 'In selected branch',
        icon: 'mentors.svg',
      },
    ]

    mentorTypeProfiles.forEach((profile) => {
      cards.push({
        label: profile.name,
        value: filteredMentors.filter((mentor) => mentor.permission_profile_id === profile.id).length,
        helper: 'By mentor type',
        icon: mentorTypeIcon(profile.slug),
      })
    })

    return cards
  }, [filteredMentors, isHodView, mentorTypeProfiles])

  const resetFilters = () => {
    setSearch('')
    setFilterDepartment('all')
    setFilterHod('all')
    setFilterStatus('all')
    setFilterType('all')
  }

  const resetForm = () => {
    setForm(createEmptyForm(defaultProfileId, defaultDepartmentId))
    setEditingId(null)
  }

  const clearPasswordFields = () => {
    setNewPassword('')
    setConfirmPassword('')
    setPasswordMessage('')
    setPasswordError('')
  }

  const clearEditQuery = () => {
    if (searchParams.get('edit')) {
      router.replace('/mentors', { scroll: false })
    }
  }

  const openCreateModal = () => {
    const empty = createEmptyForm(defaultProfileId, defaultDepartmentId)
    const defaultProfile = mentorTypeProfiles.find((profile) => profile.id === defaultProfileId)
    if (isHodView && user?.id && defaultProfile?.slug !== MENTOR_HOD_SLUG) {
      empty.reports_to = user.id
    }
    setForm(empty)
    setEditingId(null)
    setError('')
    setMessage('')
    clearPasswordFields()
    clearEditQuery()
    setIsModalOpen(true)
  }

  const openEditModal = (mentor: MentorListRow) => {
    setEditingId(mentor.id)
    setForm({
      full_name: mentor.full_name,
      email: mentor.email,
      phone: mentor.phone === 'Not added' ? '' : mentor.phone,
      permission_profile_id: mentor.permission_profile_id || defaultProfileId,
      department_id: mentor.department_id,
      reports_to: mentor.reports_to,
      joining_date: mentor.joining_date,
      status: mentor.status,
    })
    setError('')
    setMessage('')
    clearPasswordFields()
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    resetForm()
    setError('')
    clearPasswordFields()
    clearEditQuery()
  }

  const handleUpdatePassword = async () => {
    if (!editingId || !canUpdateStaffPassword) return

    setPasswordSaving(true)
    setPasswordError('')
    setPasswordMessage('')

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      setPasswordSaving(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Password and confirm password do not match.')
      setPasswordSaving(false)
      return
    }

    const token = await getAccessToken()
    if (!token) {
      setPasswordError('Session expired. Please login again.')
      setPasswordSaving(false)
      return
    }

    const result = await updateStaffPassword(editingId, newPassword, confirmPassword, token)
    setPasswordSaving(false)

    if (!result.ok) {
      setPasswordError(result.error)
      return
    }

    setPasswordMessage('Password updated successfully.')
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleSubmitMentor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoadingAction(true)
    setError('')
    setMessage('')

    if (!activeBranchId) {
      setError('Select a branch before saving a mentor.')
      setLoadingAction(false)
      return
    }

    if (!editingId && !canCreateMentor) {
      setError('Your current permission cannot create mentors.')
      setLoadingAction(false)
      return
    }

    if (editingId && !canEditMentor) {
      setError('Your current permission cannot edit mentors.')
      setLoadingAction(false)
      return
    }

    if (!form.full_name.trim()) {
      setError('Please enter mentor name.')
      setLoadingAction(false)
      return
    }

    if (!form.email.trim()) {
      setError('Please enter email address.')
      setLoadingAction(false)
      return
    }

    if (!form.department_id) {
      setError('Please select a department.')
      setLoadingAction(false)
      return
    }

    if (!form.permission_profile_id) {
      setError('Please select a mentor type.')
      setLoadingAction(false)
      return
    }

    const token = await getAccessToken()
    if (!token) {
      setError('Session expired. Please login again.')
      setLoadingAction(false)
      return
    }

    const submitForm: MentorFormInput = {
      ...form,
      reports_to: isSelectedHodType ? null : form.reports_to,
    }

    if (editingId) {
      const result = await updateMentorRecord(editingId, submitForm, activeBranchId, token)
      if (!result.ok) {
        setError(result.error)
        setLoadingAction(false)
        return
      }

      setMessage('Mentor updated successfully.')
      await reload()
      setLoadingAction(false)
      setIsModalOpen(false)
      resetForm()
      return
    }

    const result = await createMentorAccount(
      {
        ...submitForm,
        branch_id: activeBranchId,
      },
      token,
    )

    if (!result.ok) {
      setError(result.error)
      setLoadingAction(false)
      return
    }

    setCreatedCredentials({
      fullName: form.full_name.trim(),
      email: result.email,
      password: result.temporaryPassword,
    })
    setCopyNotice('')
    setMessage('Mentor created successfully.')
    await reload()
    setLoadingAction(false)
    setIsModalOpen(false)
    resetForm()
  }

  const deleteMentor = async (mentorId: string) => {
    setError('')
    setMessage('')

    if (!canDeleteMentor) {
      setError('Your current permission cannot delete mentors.')
      return
    }

    const token = await getAccessToken()
    if (!token) {
      setError('Session expired. Please login again.')
      return
    }

    const result = await deleteMentorAccount(mentorId, token)
    if (!result.ok) {
      setError(result.error)
      return
    }

    setMessage('Mentor deleted successfully.')
    await reload()
  }

  const exportMentors = () => {
    setError('')
    setMessage('')

    if (!canExportMentor) {
      setError('Your current permission cannot export mentors.')
      return
    }

    setMessage('Export will be available in a later phase.')
  }

  if (!can('mentors.view')) {
    return (
      <div className="border border-border bg-transparent p-8">
        <h1 className="text-2xl font-bold">Mentors Locked</h1>
        <p className="mt-2 text-muted-foreground">
          Your current permission cannot view mentors.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-transparent">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#6ee75a]">Mentor Directory</p>
              <h1 className="mt-2 text-3xl font-bold">Mentors</h1>
              <p className="mt-3 max-w-4xl text-muted-foreground">
                {isHodView
                  ? 'View mentors assigned under your HOD scope.'
                  : `Manage branch mentors for ${activeBranch?.name || 'the selected branch'}.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {canManageMentors && (
                <Button
                  onClick={openCreateModal}
                  disabled={!activeBranchId || loading}
                  className="bg-[#6ee75a] text-black hover:bg-[#5dd84a]"
                >
                  <CustomIcon icon="patch.svg" folder={iconFolder} alt="Create" className="mr-2 h-4 w-4" />
                  Create Mentor
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {(error || loadError) && (
        <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error || loadError}
        </div>
      )}

      {message && (
        <div className="border border-[#6ee75a]/30 bg-[#6ee75a]/10 px-4 py-3 text-sm text-[#6ee75a]">
          {message}
        </div>
      )}

      {!activeBranchId && !loading && (
        <div className="border border-border bg-transparent px-4 py-3 text-sm text-muted-foreground">
          Select a branch from the header to view branch mentors.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <StatCard key={card.label} card={card} iconFolder={iconFolder} />
        ))}
      </div>

      <Card className="border border-border bg-transparent">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>Filters</CardTitle>
            <Button type="button" variant="outline" onClick={resetFilters}>
              Clear Filters
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div
            className={
              isHodView
                ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-4'
                : 'grid gap-3 md:grid-cols-2 xl:grid-cols-5'
            }
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={inputClass}
              placeholder="Search mentor"
            />

            <select
              value={filterDepartment}
              onChange={(event) => setFilterDepartment(event.target.value)}
              className={selectClass}
            >
              <option value="all" className={optionClass}>
                All departments
              </option>
              {departmentOptions.map((item) => (
                <option key={item.id} value={item.id} className={optionClass}>
                  {item.name}
                </option>
              ))}
            </select>

            {!isHodView && (
              <select
                value={filterHod}
                onChange={(event) => setFilterHod(event.target.value)}
                className={selectClass}
              >
                <option value="all" className={optionClass}>
                  All HOD
                </option>
                {hodOptions.map((item) => (
                  <option key={item.id} value={item.id} className={optionClass}>
                    {item.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={filterType}
              onChange={(event) => setFilterType(event.target.value)}
              className={selectClass}
            >
              <option value="all" className={optionClass}>
                All types
              </option>
              {mentorTypeProfiles.map((item) => (
                <option key={item.id} value={item.id} className={optionClass}>
                  {item.name}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              className={selectClass}
            >
              <option value="all" className={optionClass}>
                All Status
              </option>
              <option value="active" className={optionClass}>
                Active
              </option>
              <option value="inactive" className={optionClass}>
                Inactive
              </option>
            </select>
          </div>
        </CardContent>
      </Card>

      {activeBranchId && !loading && departmentOptions.length === 0 && (
        <div className="border border-border bg-transparent px-4 py-3 text-sm text-muted-foreground">
          No departments found for this branch. Add departments under Departments first, then assign them to mentors.
        </div>
      )}

      <Card className="border border-border bg-transparent">
        <CardHeader>
          <CardTitle>
            {isHodView ? 'Assigned Mentor Directory' : 'Mentor Directory'}
          </CardTitle>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="border border-border bg-transparent p-6 text-sm text-muted-foreground">
              Loading mentors...
            </div>
          ) : filteredMentors.length === 0 ? (
            <div className="border border-border bg-transparent p-6 text-sm text-muted-foreground">
              {isHodView
                ? 'No mentors are assigned under your HOD scope.'
                : 'No mentors found for this branch.'}
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 font-semibold">Mentor</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Department</th>
                    <th className="px-4 py-3 font-semibold">HOD</th>
                    <th className="px-4 py-3 font-semibold">Rating</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredMentors.map((mentor) => (
                    <tr key={mentor.id} className="border-b border-border">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden border border-border bg-background">
                            <Image
                              src={mentor.avatar_url || '/avatar.svg'}
                              alt={mentor.full_name}
                              width={40}
                              height={40}
                              className="h-full w-full object-cover"
                            />
                          </div>

                          <div>
                            <p className="font-semibold">{mentor.full_name}</p>
                            <p className="text-xs text-muted-foreground">{mentor.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-muted-foreground">
                        {mentor.permission_profile_name}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{mentor.department_name}</td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {mentor.permission_profile_slug === MENTOR_HOD_SLUG
                          ? '—'
                          : mentor.superior_name}
                      </td>
                      <td className="px-4 py-4">{mentor.average_rating}</td>
                      <td className="px-4 py-4">
                        <span className={getStatusClass(mentor.status)}>{mentor.status}</span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/mentors/${mentor.id}`}>View More</Link>
                          </Button>

                          {canEditMentor && (
                            <Button type="button" size="sm" onClick={() => openEditModal(mentor)}>
                              Edit
                            </Button>
                          )}

                          {canDeleteMentor && !isHodView && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void deleteMentor(mentor.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-6">
              <div>
                <h2 className="text-2xl font-bold">
                  {editingId ? 'Edit Mentor' : 'Create Mentor'}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add mentor profile, department, HOD assignment and contact details.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="border border-border px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmitMentor} className="p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Full Name</label>
                  <input
                    value={form.full_name}
                    onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                    className={inputClass}
                    placeholder="Enter mentor name"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    className={inputClass}
                    placeholder="mentor@pixlpluzportal.com"
                    required
                    readOnly={Boolean(editingId)}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    className={inputClass}
                    placeholder="Phone number"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Mentor Type</label>
                  <select
                    value={form.permission_profile_id}
                    onChange={(event) => {
                      const nextProfileId = event.target.value
                      const nextProfile = mentorTypeProfiles.find(
                        (profile) => profile.id === nextProfileId,
                      )
                      setForm({
                        ...form,
                        permission_profile_id: nextProfileId,
                        reports_to:
                          nextProfile?.slug === MENTOR_HOD_SLUG ? null : form.reports_to,
                      })
                    }}
                    className={selectClass}
                    required
                  >
                    {mentorTypeProfiles.map((item) => (
                      <option key={item.id} value={item.id} className={optionClass}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Department</label>
                  <select
                    value={form.department_id}
                    onChange={(event) => setForm({ ...form, department_id: event.target.value })}
                    className={selectClass}
                    required
                  >
                    {departmentOptions.map((item) => (
                      <option key={item.id} value={item.id} className={optionClass}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                {!isSelectedHodType && (
                  <div>
                    <label className="mb-2 block text-sm font-medium">Assign HOD</label>
                    <select
                      value={form.reports_to || ''}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          reports_to: event.target.value || null,
                        })
                      }
                      className={selectClass}
                      disabled={isHodView && !editingId}
                    >
                      <option value="" className={optionClass}>
                        Not assigned
                      </option>
                      {hodOptions.map((item) => (
                        <option key={item.id} value={item.id} className={optionClass}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium">Date of Joining</label>
                  <input
                    type="date"
                    value={form.joining_date}
                    onChange={(event) => setForm({ ...form, joining_date: event.target.value })}
                    className={inputClass}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Status</label>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value as MentorUiStatus })
                    }
                    className={selectClass}
                  >
                    <option value="active" className={optionClass}>
                      Active
                    </option>
                    <option value="inactive" className={optionClass}>
                      Inactive
                    </option>
                  </select>
                </div>
              </div>

              {editingId && canUpdateStaffPassword && (
                <div className="mt-6 border border-border bg-background/60 p-4">
                  <h3 className="text-base font-semibold">Update Password</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Set a new login password for this staff member when email reset is not possible.
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className={inputClass}
                        placeholder="Minimum 6 characters"
                        autoComplete="new-password"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Confirm Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className={inputClass}
                        placeholder="Re-enter password"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  {passwordError && (
                    <div className="mt-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                      {passwordError}
                    </div>
                  )}

                  {passwordMessage && (
                    <div className="mt-4 border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
                      {passwordMessage}
                    </div>
                  )}

                  <div className="mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={passwordSaving}
                      onClick={() => void handleUpdatePassword()}
                    >
                      {passwordSaving ? 'Updating…' : 'Update Password'}
                    </Button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>

                <Button type="submit" disabled={loadingAction}>
                  {loadingAction ? 'Saving...' : editingId ? 'Update Mentor' : 'Create Mentor'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(createdCredentials)}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedCredentials(null)
            setCopyNotice('')
          }
        }}
      >
        <DialogContent className="border border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mentor Created</DialogTitle>
            <DialogDescription>
              Login credentials for the new mentor. Copy and share them securely.
            </DialogDescription>
          </DialogHeader>

          {createdCredentials && (
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-sm font-semibold">Name</span>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={createdCredentials.fullName}
                    className="h-10 min-w-0 flex-1 border border-border bg-background px-3 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void copyCredential('Name', createdCredentials.fullName, setCopyNotice)
                    }
                    className="shrink-0 border border-border px-3 text-sm font-semibold hover:bg-accent"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold">Email</span>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={createdCredentials.email}
                    className="h-10 min-w-0 flex-1 border border-border bg-background px-3 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void copyCredential('Email', createdCredentials.email, setCopyNotice)
                    }
                    className="shrink-0 border border-border px-3 text-sm font-semibold hover:bg-accent"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold">Password</span>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={createdCredentials.password}
                    className="h-10 min-w-0 flex-1 border border-border bg-background px-3 text-sm font-semibold text-[#153e90] outline-none dark:text-[#6ee75a]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void copyCredential('Password', createdCredentials.password, setCopyNotice)
                    }
                    className="shrink-0 border border-border px-3 text-sm font-semibold hover:bg-accent"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {copyNotice && (
                <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">{copyNotice}</p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <button
              type="button"
              onClick={async () => {
                if (!createdCredentials) return
                await copyCredential(
                  'Login credentials',
                  formatCredentialsText(createdCredentials),
                  setCopyNotice,
                )
              }}
              className="inline-flex items-center justify-center border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
            >
              Copy All
            </button>
            <button
              type="button"
              onClick={() => {
                setCreatedCredentials(null)
                setCopyNotice('')
              }}
              className="inline-flex items-center justify-center bg-[#153e90] px-4 py-2 text-sm font-semibold text-white dark:bg-[#6ee75a] dark:text-black"
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
