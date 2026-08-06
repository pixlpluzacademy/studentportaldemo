'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'
import { useUsersData } from '@/lib/data/hooks/use-users'
import {
  canManageDirectoryUser,
  createUserAccount,
  deleteUserAccount,
  getAccessScope,
  isSuperAdminUserRow,
  sortUsersByParentRoleHierarchy,
  canViewDirectoryUser,
  updateStaffPassword,
  updateUserProfile,
  updateUserStatus,
  type UserFormInput,
  type UserListRow,
} from '@/lib/data/users'
import { useAuth } from '@/lib/auth/provider'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type CreatedCredentials = {
  fullName: string
  email: string
  password: string
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

function createEmptyForm(
  activeBranchId: string | null,
  defaultProfileId: string,
): UserFormInput & { id: string | null } {
  return {
    id: null,
    full_name: '',
    email: '',
    permission_profile_id: defaultProfileId,
    branch_id: activeBranchId,
    status: 'active',
  }
}

async function getAccessToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

export default function Page() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, role, can, refreshSession, parentRoleId } = useAuth()
  const { activeBranchId, allowedBranches, hasAllBranchAccess } = useBranchScope()
  const {
    users,
    permissionProfiles,
    allPermissionProfiles,
    parentRoles,
    activeBranch,
    loading,
    error,
    reload,
  } = useUsersData()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'
  const canUpdateStaffPassword =
    parentRoleId === 'super_admin' || parentRoleId === 'company_admin'

  const defaultProfileId = permissionProfiles[0]?.id || ''

  const [formUser, setFormUser] = useState(() => createEmptyForm(activeBranchId, ''))
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [notice, setNotice] = useState('')
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null)
  const [copyNotice, setCopyNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState('')

  // useEffect(() => {
  //   if (activeBranchId) {
  //     setBranchFilter(activeBranchId)
  //   }
  // }, [activeBranchId])

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId || loading || !users.length) return

    const item = users.find((row) => row.id === editId)
    if (!item || !canManageDirectoryUser(item, parentRoleId) || !canViewDirectoryUser(item, parentRoleId)) return
    if (editingUserId === editId) return

    setFormUser({
      id: item.id,
      full_name: item.full_name,
      email: item.email,
      permission_profile_id: item.permission_profile_id || defaultProfileId,
      branch_id: item.branch_id,
      status: item.status,
    })
    setNewPassword('')
    setConfirmPassword('')
    setPasswordNotice('')
    setEditingUserId(item.id)
    setSelectedUserId(item.id)
  }, [defaultProfileId, editingUserId, loading, parentRoleId, searchParams, users])

  useEffect(() => {
    if (!editingUserId && defaultProfileId) {
      setFormUser((prev) =>
        prev.id
          ? prev
          : createEmptyForm(activeBranchId, defaultProfileId),
      )
    }
  }, [activeBranchId, defaultProfileId, editingUserId])

  const activeUsers = users.filter((item) => item.status === 'active')
  const customProfileCount = allPermissionProfiles.filter((item) => !item.is_system).length
  const systemProfileCount = allPermissionProfiles.filter((item) => item.is_system).length

  const filteredUsers = useMemo(() => {
    return users.filter((item) => {
      const term = searchTerm.trim().toLowerCase()
      const matchesSearch =
        !term ||
        item.full_name.toLowerCase().includes(term) ||
        item.email.toLowerCase().includes(term) ||
        item.permission_profile_name.toLowerCase().includes(term)

      const matchesRole =
        roleFilter === 'all' || item.permission_profile_id === roleFilter
      const matchesBranch =
        branchFilter === 'all' ||
        item.branch_id === branchFilter ||
        item.branch_ids.includes(branchFilter)
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter

      return matchesSearch && matchesRole && matchesBranch && matchesStatus
    })
  }, [users, searchTerm, roleFilter, branchFilter, statusFilter])

  const directoryUsers = useMemo(
    () => sortUsersByParentRoleHierarchy(filteredUsers, parentRoles),
    [filteredUsers, parentRoles],
  )

  const getProfileName = (profileId?: string | null) => {
    if (!profileId) return 'Not assigned'
    return permissionProfiles.find((item) => item.id === profileId)?.name || 'Not assigned'
  }

  const getParentRoleName = (parentRoleId?: string) => {
    if (!parentRoleId) return 'Not assigned'
    return parentRoles.find((item) => item.id === parentRoleId)?.name || parentRoleId
  }

  const getBranchName = (branchId?: string | null) => {
    if (!branchId) return 'All Branches'
    return allowedBranches.find((item) => item.id === branchId)?.name || branchId
  }

  const clearPasswordFields = () => {
    setNewPassword('')
    setConfirmPassword('')
    setPasswordNotice('')
  }

  const clearEditQuery = () => {
    if (searchParams.get('edit')) {
      router.replace('/users', { scroll: false })
    }
  }

  const resetForm = () => {
    setFormUser(createEmptyForm(activeBranchId, defaultProfileId))
    setEditingUserId(null)
    clearPasswordFields()
    clearEditQuery()
  }

  const handleUpdatePassword = async () => {
    if (!editingUserId || !canUpdateStaffPassword) return

    setPasswordSaving(true)
    setPasswordNotice('')

    if (newPassword.length < 6) {
      setPasswordNotice('Password must be at least 6 characters.')
      setPasswordSaving(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordNotice('Password and confirm password do not match.')
      setPasswordSaving(false)
      return
    }

    const token = await getAccessToken()
    if (!token) {
      setPasswordNotice('Session expired. Please login again.')
      setPasswordSaving(false)
      return
    }

    const result = await updateStaffPassword(editingUserId, newPassword, confirmPassword, token)
    setPasswordSaving(false)

    if (!result.ok) {
      setPasswordNotice(result.error)
      return
    }

    setPasswordNotice('Password updated successfully.')
    setNewPassword('')
    setConfirmPassword('')
  }

  const copyCredential = async (label: string, text: string) => {
    const copied = await copyToClipboard(text)
    setCopyNotice(copied ? `${label} copied.` : `Could not copy ${label.toLowerCase()}.`)
    window.setTimeout(() => setCopyNotice(''), 2000)
  }

  const copyAllCredentials = async () => {
    if (!createdCredentials) return
    await copyCredential('Login credentials', formatCredentialsText(createdCredentials))
  }

  const saveUser = async () => {
    if (!can('users.create') && !editingUserId) {
      setNotice('Your current role cannot create users.')
      return
    }

    if (!can('users.edit') && editingUserId) {
      setNotice('Your current role cannot edit users.')
      return
    }

    if (!formUser.full_name.trim()) {
      setNotice('Please enter full name.')
      return
    }

    if (!formUser.email.trim()) {
      setNotice('Please enter email address.')
      return
    }

    if (!formUser.permission_profile_id) {
      setNotice('Please select a permission profile.')
      return
    }

    const resolvedBranchId = hasAllBranchAccess
      ? formUser.branch_id
      : formUser.branch_id ?? activeBranchId ?? null

    if (!hasAllBranchAccess && !resolvedBranchId) {
      setNotice('Please select a branch.')
      return
    }

    setSaving(true)
    setNotice('')

    try {
      const payload: UserFormInput = {
        full_name: formUser.full_name.trim(),
        email: formUser.email.trim().toLowerCase(),
        permission_profile_id: formUser.permission_profile_id,
        branch_id: resolvedBranchId,
        status: formUser.status,
      }

      if (editingUserId) {
        const result = await updateUserProfile(editingUserId, payload)
        if (!result.ok) {
          setNotice(result.error)
          return
        }
        setNotice('User updated successfully.')
        setSelectedUserId(editingUserId)
        resetForm()
        await reload()
        await refreshSession()
        return
      }

      const token = await getAccessToken()
      if (!token) {
        setNotice('Session expired. Please login again.')
        return
      }

      const result = await createUserAccount(
        {
          ...payload,
          password: '',
        },
        token,
      )

      if (!result.ok) {
        setNotice(result.error)
        return
      }

      setCreatedCredentials({
        fullName: payload.full_name,
        email: result.email,
        password: result.temporaryPassword,
      })
      setNotice('User created successfully.')
      setSelectedUserId(result.userId)
      if (payload.branch_id) {
        setBranchFilter(payload.branch_id)
      } else {
        setBranchFilter('all')
      }
      resetForm()
      await reload()
      await refreshSession()
    } finally {
      setSaving(false)
    }
  }

  const editUser = (item: UserListRow) => {
    if (!canManageDirectoryUser(item, parentRoleId)) {
      setNotice('Only Super Admin can edit Super Admin users.')
      return
    }

    setFormUser({
      id: item.id,
      full_name: item.full_name,
      email: item.email,
      permission_profile_id: item.permission_profile_id || defaultProfileId,
      branch_id: item.branch_id,
      status: item.status,
    })
    setEditingUserId(item.id)
    setSelectedUserId(item.id)
    clearPasswordFields()
    setNotice(`Editing ${item.full_name}.`)
  }

  const deleteUser = async (userId: string) => {
    if (!can('users.delete')) {
      setNotice('Your current role cannot delete users.')
      return
    }

    const targetUser = users.find((item) => item.id === userId)
    if (targetUser && !canManageDirectoryUser(targetUser, parentRoleId)) {
      setNotice('Only Super Admin can delete Super Admin users.')
      return
    }

    if (userId === user?.id) {
      setNotice('You cannot delete the currently logged in user.')
      return
    }

    setSaving(true)
    setNotice('')

    try {
      const token = await getAccessToken()
      if (!token) {
        setNotice('Session expired. Please login again.')
        return
      }

      const result = await deleteUserAccount(userId, token)
      if (!result.ok) {
        setNotice(result.error)
        return
      }

      if (selectedUserId === userId) {
        setSelectedUserId(users.find((item) => item.id !== userId)?.id || '')
      }

      if (editingUserId === userId) {
        resetForm()
      }

      setNotice('User deleted successfully.')
      await reload()
      await refreshSession()
    } finally {
      setSaving(false)
    }
  }

  const toggleUserStatus = async (item: UserListRow) => {
    if (!can('users.edit')) {
      setNotice('Your current role cannot enable or disable users.')
      return
    }

    if (!canManageDirectoryUser(item, parentRoleId)) {
      setNotice('Only Super Admin can change Super Admin user status.')
      return
    }

    const nextStatus = item.status === 'active' ? 'inactive' : 'active'
    setSaving(true)
    setNotice('')

    try {
      const result = await updateUserStatus(item.id, nextStatus)
      if (!result.ok) {
        setNotice(result.error)
        return
      }

      setNotice(`${item.full_name} is now ${nextStatus}.`)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  if (!can('users.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <CustomIcon icon="students.svg" folder={iconFolder} alt="Users" className="mb-4 h-10 w-10" />
        <h1 className="text-2xl font-bold">Users Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current role cannot view user access settings.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">Permission controlled module</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Users</h1>
          <p className="mt-2 max-w-4xl text-muted-foreground">
            Create portal users, assign permission profiles, control branch scope, and manage active status from
            Supabase.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Branch:{' '}
            <span className="font-semibold text-foreground">
              {activeBranch?.name || 'Select a branch in the header'}
            </span>
          </p>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>

      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">{users.length}</div>
              <div className="mt-1 text-sm text-muted-foreground">Total Users</div>
              <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">In selected branch</div>
            </div>
            <CustomIcon icon="students.svg" folder={iconFolder} alt="Users" className="h-8 w-8" />
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">{parentRoles.length}</div>
              <div className="mt-1 text-sm text-muted-foreground">Parent Roles</div>
              <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Fixed system role groups</div>
            </div>
            <CustomIcon icon="patch.svg" folder={iconFolder} alt="Roles" className="h-8 w-8" />
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">{allPermissionProfiles.length}</div>
              <div className="mt-1 text-sm text-muted-foreground">Permission Profiles</div>
              <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">
                {systemProfileCount} system · {customProfileCount} custom
              </div>
            </div>
            <CustomIcon icon="workstream.svg" folder={iconFolder} alt="Custom Roles" className="h-8 w-8" />
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">{activeUsers.length}</div>
              <div className="mt-1 text-sm text-muted-foreground">Active Users</div>
              <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Branch controlled</div>
            </div>
            <CustomIcon icon="dashboard.svg" folder={iconFolder} alt="Active" className="h-8 w-8" />
          </div>
        </div>
      </div>

      {notice && (
        <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
          {notice}
        </div>
      )}

      <div className="space-y-5">
          {(can('users.create') || can('users.edit')) && (
            <div className="border border-border bg-card p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <h2 className="text-xl font-bold">{editingUserId ? 'Edit User' : 'Create User'}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add a user to the active branch.
                  </p>
                </div>

                {editingUserId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center gap-2 border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
                  >
                    <CustomIcon icon="reviews.svg" folder={iconFolder} alt="Cancel" className="h-4 w-4" />
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-sm font-semibold">Full Name</span>
                  <input
                    value={formUser.full_name}
                    onChange={(event) => setFormUser({ ...formUser, full_name: event.target.value })}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                    placeholder="Enter user name"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold">Email</span>
                  <input
                    value={formUser.email}
                    onChange={(event) => setFormUser({ ...formUser, email: event.target.value })}
                    disabled={Boolean(editingUserId)}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90] disabled:opacity-60"
                    placeholder="name@pixlpluz.com"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold">Assigned Profile</span>
                  <select
                    value={formUser.permission_profile_id}
                    onChange={(event) => {
                      const permissionProfileId = event.target.value
                      const profile = permissionProfiles.find((item) => item.id === permissionProfileId)
                      const isAcademyWideProfile =
                        profile?.parent_role_id === 'company_admin' ||
                        profile?.parent_role_id === 'super_admin'

                      setFormUser({
                        ...formUser,
                        permission_profile_id: permissionProfileId,
                        branch_id: isAcademyWideProfile ? null : formUser.branch_id ?? activeBranchId,
                      })
                    }}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                  >
                    {permissionProfiles.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold">Branch Scope</span>
                  <select
                    value={formUser.branch_id || 'all'}
                    onChange={(event) =>
                      setFormUser({
                        ...formUser,
                        branch_id: event.target.value === 'all' ? null : event.target.value,
                      })
                    }
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                  >
                    {hasAllBranchAccess && <option value="all">All Branches</option>}
                    {allowedBranches.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold">Status</span>
                  <select
                    value={formUser.status}
                    onChange={(event) =>
                      setFormUser({ ...formUser, status: event.target.value as UserFormInput['status'] })
                    }
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              {editingUserId && canUpdateStaffPassword && (
                <div className="mt-5 border border-border bg-background/60 p-4">
                  <h3 className="text-base font-semibold">Update Password</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Set a new login password for this staff member when email reset is not possible.
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold">New Password</span>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                        placeholder="Minimum 6 characters"
                        autoComplete="new-password"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold">Confirm Password</span>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                        placeholder="Re-enter password"
                        autoComplete="new-password"
                      />
                    </label>
                  </div>

                  {passwordNotice && (
                    <div className="mt-4 border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
                      {passwordNotice}
                    </div>
                  )}

                  <div className="mt-4">
                    <button
                      type="button"
                      disabled={passwordSaving}
                      onClick={() => void handleUpdatePassword()}
                      className="inline-flex items-center gap-2 border border-border px-4 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-50"
                    >
                      {passwordSaving ? 'Updating…' : 'Update Password'}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveUser()}
                  className="inline-flex items-center gap-2 bg-[#153e90] px-5 py-3 font-semibold text-white disabled:opacity-50"
                >
                  <CustomIcon icon="students.svg" folder={iconFolder} alt="Save User" className="h-4 w-4" />
                  {saving ? 'Saving…' : editingUserId ? 'Update User' : 'Add User'}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 border border-border px-5 py-3 font-semibold hover:bg-accent"
                >
                  <CustomIcon icon="reviews.svg" folder={iconFolder} alt="Reset" className="h-4 w-4" />
                  Reset
                </button>
              </div>
            </div>
          )}

          <div className="border border-border bg-card p-5">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
              <div>
                <h2 className="text-xl font-bold">User Access Directory</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  View users with parent role, permission profile, branch scope and status.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90]"
                  placeholder="Search user"
                />

                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  className="h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90]"
                >
                  <option value="all">All Profiles</option>
                  {permissionProfiles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>

                <select
                  value={branchFilter}
                  onChange={(event) => setBranchFilter(event.target.value)}
                  className="h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90]"
                >
                  <option value="all">All Branches</option>
                  {allowedBranches.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-10 w-full border border-border bg-background px-3 text-sm outline-none focus:border-[#153e90]"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="mt-5 w-full overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Assigned Role</th>
                    <th className="px-4 py-3 font-semibold">Branch</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                        Loading users…
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    directoryUsers.map((item) => {
                      const isSelected = selectedUserId === item.id
                      const canManageUser = canManageDirectoryUser(item, parentRoleId)
                      const canViewUser = canViewDirectoryUser(item, parentRoleId)
                      const isLockedSuperAdmin = isSuperAdminUserRow(item) && !canViewUser

                      return (
                        <tr
                          key={item.id}
                          className={
                            isSelected
                              ? 'border-b border-border bg-[#153e90]/5 dark:bg-[#6ee75a]/5'
                              : 'border-b border-border'
                          }
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center overflow-hidden border border-border bg-background">
                                <Image
                                  src={item.avatar_url || '/avatar.svg'}
                                  alt={item.full_name}
                                  width={40}
                                  height={40}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{item.full_name}</p>
                                <p className="text-xs text-muted-foreground">{getAccessScope(item)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {getParentRoleName(item.parent_role_id)}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-muted-foreground">{item.email}</td>

                          <td className="px-4 py-3 text-muted-foreground">
                            {item.permission_profile_name}
                          </td>

                          <td className="px-4 py-3 text-muted-foreground">{getBranchName(item.branch_id)}</td>

                          <td className="px-4 py-3">
                            <span
                              className={
                                item.status === 'active'
                                  ? 'border border-[#153e90]/25 bg-[#153e90]/10 px-2 py-1 text-xs font-semibold capitalize text-[#153e90] dark:border-[#6ee75a]/25 dark:bg-[#6ee75a]/10 dark:text-white'
                                  : 'border border-border bg-background px-2 py-1 text-xs font-semibold capitalize text-muted-foreground'
                              }
                            >
                              {item.status}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {isLockedSuperAdmin ? (
                                <span className="border border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
                                  Feature locked
                                </span>
                              ) : (
                                <>
                              {canViewUser && (
                                <Link
                                  href={`/users/${item.id}`}
                                  onClick={() => setSelectedUserId(item.id)}
                                  className="border border-border p-2 hover:bg-accent"
                                  title="View"
                                >
                                  <CustomIcon icon="dashboard.svg" folder={iconFolder} alt="View" className="h-4 w-4" />
                                </Link>
                              )}

                              {can('users.edit') && canManageUser && (
                                <button
                                  type="button"
                                  onClick={() => editUser(item)}
                                  className="border border-border p-2 hover:bg-accent"
                                  title="Edit"
                                >
                                  <CustomIcon
                                    icon="submissions.svg"
                                    folder={iconFolder}
                                    alt="Edit"
                                    className="h-4 w-4"
                                  />
                                </button>
                              )}

                              {can('users.edit') && canManageUser && (
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void toggleUserStatus(item)}
                                  className="border border-border p-2 hover:bg-accent disabled:opacity-50"
                                  title="Enable or Disable"
                                >
                                  <CustomIcon
                                    icon="attendance.svg"
                                    folder={iconFolder}
                                    alt="Enable Disable"
                                    className="h-4 w-4"
                                  />
                                </button>
                              )}

                              {can('users.delete') && canManageUser && (
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void deleteUser(item.id)}
                                  className="border border-border p-2 hover:bg-red-500/10 disabled:opacity-50"
                                  title="Delete"
                                >
                                  <CustomIcon icon="reviews.svg" folder={iconFolder} alt="Delete" className="h-4 w-4" />
                                </button>
                              )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {!loading && directoryUsers.length === 0 && (
              <div className="mt-5 border border-border bg-background p-6 text-center text-sm text-muted-foreground">
                No users found for the selected branch and filters.
              </div>
            )}
          </div>
      </div>

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
            <DialogTitle>User Created</DialogTitle>
            <DialogDescription>
              Login credentials for the new user. Copy and share them securely.
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
                    onClick={() => void copyCredential('Name', createdCredentials.fullName)}
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
                    onClick={() => void copyCredential('Email', createdCredentials.email)}
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
                    onClick={() => void copyCredential('Password', createdCredentials.password)}
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
              onClick={() => void copyAllCredentials()}
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
              className="inline-flex items-center justify-center bg-[#153e90] px-4 py-2 text-sm font-semibold text-white"
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
