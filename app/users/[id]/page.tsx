'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import {
  canManageDirectoryUser,
  canViewDirectoryUser,
  fetchUserById,
  getAccessScope,
  userMatchesBranch,
  type UserDetailRow,
} from '@/lib/data/users'
import { useAuth } from '@/lib/auth/provider'

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return value.slice(0, 10)
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

export default function ViewUserPage() {
  const params = useParams()
  const userId = String(params.id)

  const { can, parentRoleId } = useAuth()
  const { activeBranchId, hasAllBranchAccess, allowedBranches } = useBranchScope()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const [profile, setProfile] = useState<UserDetailRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadUser() {
      setLoading(true)
      setError('')

      const branchNameMap = new Map(allowedBranches.map((branch) => [branch.id, branch.name]))
      const result = await fetchUserById(userId, branchNameMap)

      if (result.error) {
        setError(result.error)
        setProfile(null)
        setLoading(false)
        return
      }

      if (!result.data) {
        setError('User not found.')
        setProfile(null)
        setLoading(false)
        return
      }

      if (!hasAllBranchAccess && activeBranchId && !userMatchesBranch(result.data, activeBranchId)) {
        setError('This user is not in the selected branch scope.')
        setProfile(null)
        setLoading(false)
        return
      }

      if (!canViewDirectoryUser(result.data, parentRoleId)) {
        setError('Only Super Admin can view Super Admin user details.')
        setProfile(null)
        setLoading(false)
        return
      }

      setProfile(result.data)
      setLoading(false)
    }

    if (userId) {
      void loadUser()
    }
  }, [activeBranchId, allowedBranches, hasAllBranchAccess, parentRoleId, userId])

  if (!can('users.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <CustomIcon icon="students.svg" folder={iconFolder} alt="Users" className="mb-4 h-10 w-10" />
        <h1 className="text-2xl font-bold">Users Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current role cannot view user details.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="border border-border bg-card p-6 text-sm text-muted-foreground">
        Loading user details…
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="border border-border bg-card p-6">
        <h1 className="text-xl font-bold">User not found</h1>
        <p className="mt-2 text-sm text-red-500">{error || 'Could not load this user.'}</p>
        <Link
          href="/users"
          className="mt-5 inline-flex border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
        >
          Back to Users
        </Link>
      </div>
    )
  }

  const canEdit = can('users.edit') && canManageDirectoryUser(profile, parentRoleId)

  return (
    <div className="space-y-6">
      <div className="border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden border border-border bg-background">
              <Image
                src={profile.avatar_url || '/avatar.svg'}
                alt={profile.full_name}
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">User Details</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">{profile.full_name}</h1>
              <p className="mt-2 text-muted-foreground">{profile.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">{getAccessScope(profile)}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href="/users"
              className="border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              Back
            </Link>

            {canEdit && (
              <Link
                href={`/users?edit=${profile.id}`}
                className="bg-[#153e90] px-4 py-2 text-sm font-semibold text-white dark:bg-[#6ee75a] dark:text-black"
              >
                Edit User
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Status</div>
          <div className="mt-3">
            <span
              className={
                profile.status === 'active'
                  ? 'border border-[#153e90]/25 bg-[#153e90]/10 px-2 py-1 text-xs font-semibold capitalize text-[#153e90] dark:border-[#6ee75a]/25 dark:bg-[#6ee75a]/10 dark:text-white'
                  : 'border border-border bg-background px-2 py-1 text-xs font-semibold capitalize text-muted-foreground'
              }
            >
              {profile.status}
            </span>
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Assigned Profile</div>
          <div className="mt-3 font-bold">{profile.permission_profile_name}</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Parent Role</div>
          <div className="mt-3 font-bold">{profile.parent_role_name}</div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">Branch Scope</div>
          <div className="mt-3 font-bold">{profile.branch_name}</div>
        </div>
      </div>

      <div className="border border-border bg-card">
        <div className="border-b border-border p-5">
          <h2 className="text-xl font-bold">Profile Information</h2>
          <p className="mt-1 text-sm text-muted-foreground">Live data from Supabase profiles.</p>
        </div>

        <div className="grid gap-0 md:grid-cols-2">
          <div className="border-b border-border p-5 md:border-r">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Full Name</p>
            <p className="mt-2 font-semibold">{profile.full_name}</p>
          </div>

          <div className="border-b border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
            <p className="mt-2 font-semibold">{profile.email}</p>
          </div>

          <div className="border-b border-border p-5 md:border-r">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Permission Profile</p>
            <p className="mt-2 font-semibold">{profile.permission_profile_name}</p>
          </div>

          <div className="border-b border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">User ID</p>
            <p className="mt-2 break-all font-semibold">{profile.id}</p>
          </div>

          <div className="border-b border-border p-5 md:border-r">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Created At</p>
            <p className="mt-2 font-semibold">{formatDate(profile.created_at)}</p>
          </div>

          <div className="border-b border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Updated At</p>
            <p className="mt-2 font-semibold">{formatDate(profile.updated_at)}</p>
          </div>
        </div>
      </div>

      {profile.branch_ids.length > 0 && (
        <div className="border border-border bg-card p-5">
          <h2 className="text-xl font-bold">Branch Assignments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Branches linked to this user via profile or assignments.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {profile.branch_ids.map((branchId) => (
              <li key={branchId} className="border border-border bg-background px-3 py-2">
                {allowedBranches.find((branch) => branch.id === branchId)?.name || branchId}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
