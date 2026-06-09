'use client'

import { FormEvent, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDemoAuth } from '@/lib/demo/auth'
import { mentors as demoMentors } from '@/lib/demo/seed'

type MentorStatus = 'active' | 'inactive'

type DemoMentor = {
  id: string
  name: string
  department: string
  hod: string
  batches: number
  rating: string
  status: MentorStatus
  email?: string
  phone?: string
  joining_date?: string
  mentor_type?: string
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

const buildDemoMentors = (): DemoMentor[] => {
  return demoMentors.map((mentor, index) => ({
    ...mentor,
    status: mentor.status.toLowerCase() === 'active' ? 'active' : 'inactive',
    email:
      index === 0
        ? 'mentor.one@pixlpluzportal.demo'
        : index === 1
          ? 'mentor.two@pixlpluzportal.demo'
          : 'mentor.three@pixlpluzportal.demo',
    phone:
      index === 0
        ? '+91 98765 43210'
        : index === 1
          ? '+91 98765 43211'
          : '+91 98765 43212',
    joining_date:
      index === 0
        ? '2026-05-01'
        : index === 1
          ? '2026-05-10'
          : '2026-05-20',
    mentor_type:
      index === 0
        ? 'Senior Mentor'
        : index === 1
          ? 'Mentor'
          : 'Practical Trainer',
  }))
}

const getStatusClass = (status: MentorStatus) => {
  if (status === 'active') {
    return 'border border-[#6ee75a]/30 bg-[#6ee75a]/10 px-3 py-1 text-xs font-medium text-[#6ee75a]'
  }

  return 'border border-border bg-transparent px-3 py-1 text-xs font-medium text-muted-foreground'
}

export default function Page() {
  const { can, user, role } = useDemoAuth()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const [mentors, setMentors] = useState<DemoMentor[]>(() => buildDemoMentors())

  const [search, setSearch] = useState('')
  const [filterdepartment, setFilterdepartment] = useState('all')
  const [filterHod, setFilterHod] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setdepartment] = useState('')
  const [hod, setHod] = useState('')
  const [mentorType, setMentorType] = useState('Mentor')
  const [joiningDate, setJoiningDate] = useState('')
  const [rating, setRating] = useState('0')
  const [status, setStatus] = useState<MentorStatus>('active')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const canCreateMentor = can('mentors.create')
  const canEditMentor = can('mentors.edit')
  const canDeleteMentor = can('mentors.delete')
  const canExportMentor = can('mentors.export')
  const canAssignMentor = can('mentors.assign')
  const canManageMentors = canCreateMentor || canEditMentor || canAssignMentor

  const currentRoleName = role?.name?.toLowerCase() || ''
  const currentUserName = user?.fullName || ''
  const isHodView =
    currentRoleName.includes('hod') ||
    currentRoleName.includes('superior mentor')

  const scopedMentors = useMemo(() => {
    if (!isHodView) return mentors

    return mentors.filter((mentor) => {
      const mentorHod = mentor.hod.toLowerCase()
      const userName = currentUserName.toLowerCase()
      const roleName = role?.name?.toLowerCase() || ''

      return (
        mentorHod === userName ||
        mentorHod === roleName ||
        mentorHod.includes(userName) ||
        mentorHod.includes('hod') ||
        mentorHod.includes('superior mentor')
      )
    })
  }, [mentors, isHodView, currentUserName, role?.name])

  const departmentOptions = useMemo(() => {
    return Array.from(
      new Set(scopedMentors.map((mentor) => mentor.department).filter(Boolean))
    ).sort()
  }, [scopedMentors])

  const hodOptions = useMemo(() => {
    return Array.from(
      new Set(scopedMentors.map((mentor) => mentor.hod).filter(Boolean))
    ).sort()
  }, [scopedMentors])

  const mentorTypeOptions = useMemo(() => {
    return Array.from(
      new Set(scopedMentors.map((mentor) => mentor.mentor_type || 'Mentor').filter(Boolean))
    ).sort()
  }, [scopedMentors])

  const filteredMentors = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return scopedMentors.filter((mentor) => {
      const matchesSearch =
        !keyword ||
        mentor.name.toLowerCase().includes(keyword) ||
        mentor.email?.toLowerCase().includes(keyword) ||
        mentor.phone?.toLowerCase().includes(keyword) ||
        mentor.department.toLowerCase().includes(keyword) ||
        mentor.hod.toLowerCase().includes(keyword) ||
        mentor.status.toLowerCase().includes(keyword)

      return (
        matchesSearch &&
        (filterdepartment === 'all' || mentor.department === filterdepartment) &&
        (filterHod === 'all' || mentor.hod === filterHod) &&
        (filterStatus === 'all' || mentor.status === filterStatus) &&
        (filterType === 'all' || mentor.mentor_type === filterType)
      )
    })
  }, [scopedMentors, search, filterdepartment, filterHod, filterStatus, filterType])

  const activeMentors = filteredMentors.filter((mentor) => mentor.status === 'active')
  const assignedHodCount = filteredMentors.filter(
    (mentor) => mentor.hod && mentor.hod !== 'Not assigned'
  ).length

  const totalBatches = filteredMentors.reduce(
    (total, mentor) => total + Number(mentor.batches || 0),
    0
  )

  const averageRating =
    filteredMentors.length > 0
      ? (
          filteredMentors.reduce((total, mentor) => total + Number(mentor.rating || 0), 0) /
          filteredMentors.length
        ).toFixed(1)
      : '0.0'

  const resetFilters = () => {
    setSearch('')
    setFilterdepartment('all')
    setFilterHod('all')
    setFilterStatus('all')
    setFilterType('all')
  }

  const resetForm = () => {
    setName('')
    setEmail('')
    setPhone('')
    setdepartment('')
    setHod(isHodView ? currentUserName || role?.name || '' : '')
    setMentorType('Mentor')
    setJoiningDate('')
    setRating('0')
    setStatus('active')
    setEditingId(null)
  }

  const openCreateModal = () => {
    resetForm()
    setError('')
    setMessage('')
    setIsModalOpen(true)
  }

  const openEditModal = (mentor: DemoMentor) => {
    setEditingId(mentor.id)
    setName(mentor.name)
    setEmail(mentor.email || '')
    setPhone(mentor.phone || '')
    setdepartment(mentor.department)
    setHod(mentor.hod)
    setMentorType(mentor.mentor_type || 'Mentor')
    setJoiningDate(mentor.joining_date || '')
    setRating(mentor.rating || '0')
    setStatus(mentor.status)
    setError('')
    setMessage('')
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    resetForm()
    setError('')
  }

  const handleSubmitMentor = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (!editingId && !canCreateMentor) {
      setError('Your current permission cannot create mentors.')
      setLoading(false)
      return
    }

    if (editingId && !canEditMentor) {
      setError('Your current permission cannot edit mentors.')
      setLoading(false)
      return
    }

    if (!name.trim()) {
      setError('Please enter mentor name.')
      setLoading(false)
      return
    }

    if (!email.trim()) {
      setError('Please enter email address.')
      setLoading(false)
      return
    }

    if (!department.trim()) {
      setError('Please enter department.')
      setLoading(false)
      return
    }

    if (!hod.trim()) {
      setError('Please enter or assign HOD.')
      setLoading(false)
      return
    }

    const cleanMentor: DemoMentor = {
      id: editingId || `mentor-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || 'Not added',
      department: department.trim(),
      hod: hod.trim(),
      mentor_type: mentorType,
      joining_date: joiningDate || new Date().toISOString().split('T')[0],
      batches: editingId
        ? mentors.find((mentor) => mentor.id === editingId)?.batches || 0
        : 0,
      rating: rating || '0',
      status,
    }

    if (editingId) {
      setMentors(
        mentors.map((mentor) => (mentor.id === editingId ? cleanMentor : mentor))
      )
      setMessage('Mentor updated successfully in demo.')
    } else {
      setMentors([cleanMentor, ...mentors])
      setMessage('Mentor created successfully in demo.')
    }

    setLoading(false)
    setIsModalOpen(false)
    resetForm()
  }

  const deleteMentor = (mentorId: string) => {
    setError('')
    setMessage('')

    if (!canDeleteMentor) {
      setError('Your current permission cannot delete mentors.')
      return
    }

    setMentors(mentors.filter((mentor) => mentor.id !== mentorId))
    setMessage('Mentor deleted from demo.')
  }

  const exportMentors = () => {
    setError('')
    setMessage('')

    if (!canExportMentor) {
      setError('Your current permission cannot export mentors.')
      return
    }

    setMessage('Demo export triggered. Later this will download mentor report from Supabase.')
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
                  : 'Manage mentor profiles, department, HOD assignment, batch load and student rating.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">


              {canManageMentors && (
                <Button onClick={openCreateModal} className="bg-[#6ee75a] text-black hover:bg-[#5dd84a]">
                  <CustomIcon icon="patch.svg" folder={iconFolder} alt="Create" className="mr-2 h-4 w-4" />
                  Create Mentor
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {message && (
        <div className="border border-[#6ee75a]/30 bg-[#6ee75a]/10 px-4 py-3 text-sm text-[#6ee75a]">
          {message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm uppercase text-muted-foreground">
              {isHodView ? 'Assigned mentors' : 'mentors'}
            </p>
            <p className="mt-3 text-4xl font-bold">{filteredMentors.length}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              {isHodView ? 'Under your HOD scope' : 'Filtered mentors'}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm uppercase text-muted-foreground">Assigned HOD</p>
            <p className="mt-3 text-4xl font-bold">{assignedHodCount}</p>
            <p className="mt-4 text-sm text-muted-foreground">Superior mentor mapping</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm uppercase text-muted-foreground">Avg Rating</p>
            <p className="mt-3 text-4xl font-bold">{averageRating}</p>
            <p className="mt-4 text-sm text-muted-foreground">Student feedback</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm uppercase text-muted-foreground">Batches</p>
            <p className="mt-3 text-4xl font-bold">{totalBatches}</p>
            <p className="mt-4 text-sm text-muted-foreground">Total handled</p>
          </CardContent>
        </Card>
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
          <div className={isHodView ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-4' : 'grid gap-3 md:grid-cols-2 xl:grid-cols-5'}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={inputClass}
              placeholder="Search mentor"
            />

            <select
              value={filterdepartment}
              onChange={(event) => setFilterdepartment(event.target.value)}
              className={selectClass}
            >
              <option value="all" className={optionClass}>All departments</option>
              {departmentOptions.map((item) => (
                <option key={item} value={item} className={optionClass}>
                  {item}
                </option>
              ))}
            </select>

            {!isHodView && (
              <select
                value={filterHod}
                onChange={(event) => setFilterHod(event.target.value)}
                className={selectClass}
              >
                <option value="all" className={optionClass}>All HOD</option>
                {hodOptions.map((item) => (
                  <option key={item} value={item} className={optionClass}>
                    {item}
                  </option>
                ))}
              </select>
            )}

            <select
              value={filterType}
              onChange={(event) => setFilterType(event.target.value)}
              className={selectClass}
            >
              <option value="all" className={optionClass}>All Types</option>
              {mentorTypeOptions.map((item) => (
                <option key={item} value={item} className={optionClass}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              className={selectClass}
            >
              <option value="all" className={optionClass}>All Status</option>
              <option value="active" className={optionClass}>Active</option>
              <option value="inactive" className={optionClass}>Inactive</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border bg-transparent">
        <CardHeader>
          <CardTitle>{isHodView ? 'Assigned Mentor Directory' : 'Mentor Directory'}</CardTitle>
        </CardHeader>

        <CardContent>
          {filteredMentors.length === 0 ? (
            <div className="border border-border bg-transparent p-6 text-sm text-muted-foreground">
              {isHodView
                ? 'No mentors are assigned under your HOD scope in demo data.'
                : 'No mentors found.'}
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 font-semibold">mentor</th>
                    <th className="px-4 py-3 font-semibold">department</th>
                    <th className="px-4 py-3 font-semibold">HOD</th>
                    <th className="px-4 py-3 font-semibold">Batches</th>
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
                                                        src={'/avatar.svg'}
                                                        alt={mentor.name}
                                                        width={40}
                                                        height={40}
                                                        className="h-full w-full object-cover"
                                                      />
                                                    </div>

                          <div>
                            <p className="font-semibold">{mentor.name}</p>
                            <p className="text-xs text-muted-foreground">{mentor.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-muted-foreground">{mentor.department}</td>
                      <td className="px-4 py-4 text-muted-foreground">{mentor.hod}</td>
                      <td className="px-4 py-4">{mentor.batches}</td>
                      <td className="px-4 py-4">{mentor.rating}</td>
                      <td className="px-4 py-4">
                        <span className={getStatusClass(mentor.status)}>
                          {mentor.status}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/mentors/${mentor.id}`}>View More</Link>
                          </Button>

                          {canEditMentor && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => openEditModal(mentor)}
                            >
                              Edit
                            </Button>
                          )}

                          {canDeleteMentor && !isHodView && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => deleteMentor(mentor.id)}
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
                  Add mentor profile, department, HOD assignment and basic contact details.
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
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={inputClass}
                    placeholder="Enter mentor name"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClass}
                    placeholder="mentor@pixlpluzportal.demo"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Phone</label>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className={inputClass}
                    placeholder="Phone number"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Mentor Type</label>
                  <select
                    value={mentorType}
                    onChange={(event) => setMentorType(event.target.value)}
                    className={selectClass}
                  >
                    <option value="Mentor" className={optionClass}>Mentor</option>
                    <option value="Senior Mentor" className={optionClass}>Senior Mentor</option>
                    <option value="Practical Trainer" className={optionClass}>Practical Trainer</option>
                    <option value="Guest Mentor" className={optionClass}>Guest Mentor</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">department</label>
                  <input
                    value={department}
                    onChange={(event) => setdepartment(event.target.value)}
                    className={inputClass}
                    placeholder="Example: Digital Marketing"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Assign HOD</label>
                  <input
                    value={hod}
                    onChange={(event) => setHod(event.target.value)}
                    className={inputClass}
                    placeholder="Example: Superior Mentor"
                    readOnly={isHodView}
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Date of Joining</label>
                  <input
                    type="date"
                    value={joiningDate}
                    onChange={(event) => setJoiningDate(event.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Rating</label>
                  <input
                    value={rating}
                    onChange={(event) => setRating(event.target.value)}
                    className={inputClass}
                    placeholder="Example: 4.7"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Status</label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as MentorStatus)}
                    className={selectClass}
                  >
                    <option value="active" className={optionClass}>Active</option>
                    <option value="inactive" className={optionClass}>Inactive</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="mt-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>

                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : editingId ? 'Update Mentor' : 'Create Mentor'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}