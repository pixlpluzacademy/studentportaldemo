'use client'

import { FormEvent, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDemoAuth } from '@/lib/demo/auth'
import {
  batches,
  mentors as demoMentors,
} from '@/lib/demo/seed'

type MentorStatus = 'active' | 'inactive'

type DemoMentor = {
  id: string
  name: string
  department: string
  hod: string
  batches: number
  rating: string
  status: MentorStatus
  email: string
  phone: string
  joining_date: string
  mentor_type: string
  profile_image: string
  bio: string
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

const textareaClass =
  'min-h-24 w-full resize-y border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground dark:[color-scheme:dark]'

const selectClass =
  'h-10 w-full border border-border bg-transparent px-3 text-sm text-foreground outline-none dark:[color-scheme:dark]'

const optionClass = 'bg-[#111111] text-white'

const getStatusClass = (status: MentorStatus) => {
  if (status === 'active') {
    return 'border border-[#6ee75a]/30 bg-[#6ee75a]/10 px-3 py-1 text-xs font-medium text-[#6ee75a]'
  }

  return 'border border-border bg-transparent px-3 py-1 text-xs font-medium text-muted-foreground'
}

const buildDemoMentors = (): DemoMentor[] => {
  return demoMentors.map((mentor, index) => ({
    id: mentor.id,
    name: mentor.name,
    department: mentor.department,
    hod: mentor.hod,
    batches: Number(mentor.batches || 0),
    rating: mentor.rating || '0',
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
    profile_image: '/avatar.svg',
    bio:
      index === 0
        ? 'Experienced mentor responsible for guiding students through practical learning, portfolio building and batch-level academic support.'
        : index === 1
          ? 'mentor focused on class delivery, assignment review, practical feedback and student performance improvement.'
          : 'Practical trainer supporting hands-on sessions, project reviews and skill-based learning outcomes.',
  }))
}

const formatDate = (dateValue: string) => {
  if (!dateValue) return 'Not added'

  const date = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(date.getTime())) return dateValue

  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function Page() {
  const params = useParams()
  const mentorId = String(params.id || '')
  const { can, user, role } = useDemoAuth()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const [mentors, setMentors] = useState<DemoMentor[]>(() => buildDemoMentors())
  const [isEditOpen, setIsEditOpen] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setdepartment] = useState('')
  const [hod, setHod] = useState('')
  const [mentorType, setMentorType] = useState('')
  const [joiningDate, setJoiningDate] = useState('')
  const [rating, setRating] = useState('')
  const [status, setStatus] = useState<MentorStatus>('active')
  const [bio, setBio] = useState('')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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

  const mentor = useMemo(() => {
    return scopedMentors.find((item) => item.id === mentorId) || null
  }, [scopedMentors, mentorId])

  const assignedBatches = useMemo(() => {
    if (!mentor) return []

    return batches.filter((batch) => batch.mentor === mentor.name)
  }, [mentor])

  const activeBatches = assignedBatches.filter((batch) =>
    String(batch.status || '').toLowerCase().includes('active')
  )

  const fullBatches = assignedBatches.filter((batch) =>
    String(batch.status || '').toLowerCase().includes('full')
  )

  const openEditModal = () => {
    if (!mentor) return

    setName(mentor.name)
    setEmail(mentor.email)
    setPhone(mentor.phone)
    setdepartment(mentor.department)
    setHod(mentor.hod)
    setMentorType(mentor.mentor_type)
    setJoiningDate(mentor.joining_date)
    setRating(mentor.rating)
    setStatus(mentor.status)
    setBio(mentor.bio)
    setError('')
    setMessage('')
    setIsEditOpen(true)
  }

  const closeEditModal = () => {
    setIsEditOpen(false)
    setError('')
    setSaving(false)
  }

  const handleSaveMentor = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    if (!can('mentors.edit')) {
      setError('Your current permission cannot edit mentor details.')
      setSaving(false)
      return
    }

    if (!mentor) {
      setError('Mentor not found.')
      setSaving(false)
      return
    }

    if (!name.trim()) {
      setError('Please enter mentor name.')
      setSaving(false)
      return
    }

    if (!email.trim()) {
      setError('Please enter email address.')
      setSaving(false)
      return
    }

    if (!department.trim()) {
      setError('Please enter department.')
      setSaving(false)
      return
    }

    if (!hod.trim()) {
      setError('Please enter assigned HOD.')
      setSaving(false)
      return
    }

    const updatedMentor: DemoMentor = {
      ...mentor,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || 'Not added',
      department: department.trim(),
      hod: hod.trim(),
      mentor_type: mentorType.trim() || 'Mentor',
      joining_date: joiningDate || mentor.joining_date,
      rating: rating || mentor.rating,
      status,
      bio: bio.trim() || mentor.bio,
    }

    setMentors((current) =>
      current.map((item) => (item.id === mentor.id ? updatedMentor : item))
    )

    setMessage('Mentor details updated successfully in demo.')
    setSaving(false)
    setIsEditOpen(false)
  }

  if (!can('mentors.view')) {
    return (
      <div className="border border-border bg-transparent p-8">
        <h1 className="text-2xl font-bold">Mentor Locked</h1>
        <p className="mt-2 text-muted-foreground">
          Your current permission cannot view mentor details.
        </p>
      </div>
    )
  }

  if (!mentor) {
    return (
      <div className="space-y-6">
        <Button asChild variant="outline" size="sm">
          <Link href="/mentors" className="inline-flex items-center">
            <CustomIcon
              icon="arrow-left.svg"
              folder={iconFolder}
              alt="Back"
              className="mr-2 h-4 w-4"
            />
            Back to Mentors
          </Link>
        </Button>

        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Mentor not found in demo data or not available under your current HOD scope.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="outline" size="sm">
        <Link href="/mentors" className="inline-flex items-center">
          <CustomIcon
            icon="arrow-left.svg"
            folder={iconFolder}
            alt="Back"
            className="mr-2 h-4 w-4"
          />
          Back to Mentors
        </Link>
      </Button>

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

      <Card className="border border-border bg-transparent">
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden border border-border bg-transparent">
                <Image
                  src={mentor.profile_image || '/avatar.svg'}
                  alt={mentor.name}
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                />
              </div>

              <div>
                <p className="text-sm font-semibold text-[#6ee75a]">Mentor Profile</p>
                <h1 className="mt-2 text-3xl font-bold">{mentor.name}</h1>
                <p className="mt-2 max-w-4xl text-muted-foreground">{mentor.bio}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="border border-border bg-transparent px-3 py-1 text-sm font-medium">
                    {mentor.mentor_type}
                  </span>

                  <span className="border border-border bg-transparent px-3 py-1 text-sm font-medium">
                    {mentor.department}
                  </span>

                  <span className={getStatusClass(mentor.status)}>
                    {mentor.status}
                  </span>
                </div>
              </div>
            </div>

            {can('mentors.edit') && (
              <Button
                type="button"
                onClick={openEditModal}
                className="bg-[#6ee75a] text-black hover:bg-[#5dd84a]"
              >
                Edit Mentor
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm uppercase text-muted-foreground">Assigned Batches</p>
            <p className="mt-3 text-4xl font-bold">{assignedBatches.length}</p>
            <p className="mt-4 text-sm text-muted-foreground">Total handled</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm uppercase text-muted-foreground">Active Batches</p>
            <p className="mt-3 text-4xl font-bold">{activeBatches.length}</p>
            <p className="mt-4 text-sm text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm uppercase text-muted-foreground">Full Batches</p>
            <p className="mt-3 text-4xl font-bold">{fullBatches.length}</p>
            <p className="mt-4 text-sm text-muted-foreground">Seats full</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-transparent">
          <CardContent className="p-6">
            <p className="text-sm uppercase text-muted-foreground">Rating</p>
            <p className="mt-3 text-4xl font-bold">{mentor.rating}</p>
            <p className="mt-4 text-sm text-muted-foreground">Student feedback</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border bg-transparent">
        <CardHeader>
          <CardTitle>Mentor Information</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="border border-border bg-transparent p-4">
              <p className="text-sm text-muted-foreground">Full Name</p>
              <p className="mt-2 font-semibold">{mentor.name}</p>
            </div>

            <div className="border border-border bg-transparent p-4">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="mt-2 break-all font-semibold">{mentor.email}</p>
            </div>

            <div className="border border-border bg-transparent p-4">
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="mt-2 font-semibold">{mentor.phone}</p>
            </div>

            <div className="border border-border bg-transparent p-4">
              <p className="text-sm text-muted-foreground">Mentor Type</p>
              <p className="mt-2 font-semibold">{mentor.mentor_type}</p>
            </div>

            <div className="border border-border bg-transparent p-4">
              <p className="text-sm text-muted-foreground">department</p>
              <p className="mt-2 font-semibold">{mentor.department}</p>
            </div>

            <div className="border border-border bg-transparent p-4">
              <p className="text-sm text-muted-foreground">Assigned HOD</p>
              <p className="mt-2 font-semibold">{mentor.hod}</p>
            </div>

            <div className="border border-border bg-transparent p-4">
              <p className="text-sm text-muted-foreground">Date of Joining</p>
              <p className="mt-2 font-semibold">{formatDate(mentor.joining_date)}</p>
            </div>

            <div className="border border-border bg-transparent p-4">
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="mt-2 font-semibold">{mentor.status}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border bg-transparent">
        <CardHeader>
          <CardTitle>Assigned Batches</CardTitle>
        </CardHeader>

        <CardContent>
          {assignedBatches.length === 0 ? (
            <div className="border border-border bg-transparent p-6 text-sm text-muted-foreground">
              No batches assigned to this mentor in demo data.
            </div>
          ) : (
            <div className="space-y-4">
              {assignedBatches.map((batch) => (
                <div key={batch.id} className="border border-border bg-transparent p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-lg font-bold">{batch.name}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {batch.course} • {batch.mode} • {batch.time}
                      </p>

                      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <p>
                          <span className="text-muted-foreground">Course:</span>{' '}
                          <span className="font-medium">{batch.course}</span>
                        </p>

                        <p>
                          <span className="text-muted-foreground">Mode:</span>{' '}
                          <span className="font-medium">{batch.mode}</span>
                        </p>

                        <p>
                          <span className="text-muted-foreground">Time:</span>{' '}
                          <span className="font-medium">{batch.time}</span>
                        </p>

                        <p>
                          <span className="text-muted-foreground">Seats:</span>{' '}
                          <span className="font-medium">{batch.seats}</span>
                        </p>
                      </div>
                    </div>

                    <Button asChild variant="outline" size="sm">
                      <Link href={`/batches/${batch.id}`}>View Batch</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-6">
              <div>
                <h2 className="text-2xl font-bold">Edit Mentor</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Update demo mentor profile details.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                className="border border-border px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveMentor} className="p-6">
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
                  <label className="mb-2 block text-sm font-medium">Assigned HOD</label>
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

                <div>
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

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    className={textareaClass}
                    placeholder="Short mentor description"
                    rows={3}
                  />
                </div>
              </div>

              {error && (
                <div className="mt-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeEditModal}>
                  Cancel
                </Button>

                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Mentor'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}