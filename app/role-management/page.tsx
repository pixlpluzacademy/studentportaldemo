'use client'

import { useMemo, useRef, useState } from 'react'
import { useDemoAuth } from '@/lib/demo/auth'
import {
  assignUserPermissionProfile,
  deletePermissionProfile,
  enabledModulesFromPermissionKeys,
  savePermissionProfile,
  type PermissionProfileItem,
} from '@/lib/data/permissions'
import { useRoleManagementData } from '@/lib/data/hooks/use-role-management'
import type { PermissionKey } from '@/lib/demo/types'

type EditingProfile = {
  id: string | null
  slug: string
  name: string
  parent_role_id: string
  status: 'active' | 'inactive'
  is_system: boolean
  permissionKeys: PermissionKey[]
}

function emptyEditing(parentRoleId = 'mentor'): EditingProfile {
  return {
    id: null,
    slug: '',
    name: '',
    parent_role_id: parentRoleId,
    status: 'active',
    is_system: false,
    permissionKeys: ['dashboard.view'],
  }
}

function isSuperAdminProfile(profile: Pick<PermissionProfileItem, 'slug'>) {
  return profile.slug === 'super_admin_full'
}

function isSuperAdminUser(demoUser: { roleId: string }) {
  return demoUser.roleId === 'superadmin' || demoUser.roleId === 'super_admin'
}

function profileToEditing(profile: PermissionProfileItem): EditingProfile {
  return {
    id: profile.id,
    slug: profile.slug,
    name: profile.name,
    parent_role_id: profile.parent_role_id,
    status: profile.status,
    is_system: profile.is_system,
    permissionKeys: [...profile.permissions],
  }
}

export default function RoleManagementPage() {
  const { users, can, refreshSession } = useDemoAuth()

  const { profiles, profilesByParentRole, parentRoles, allParentRoles, moduleGroups, actions, loading, error, reload } =
    useRoleManagementData()

  const profileDetailsRef = useRef<HTMLDivElement>(null)

  const [editing, setEditing] = useState<EditingProfile>(() => emptyEditing())
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const assignableUsers = useMemo(
    () => users.filter((demoUser) => !isSuperAdminUser(demoUser)),
    [users],
  )

  const assignableProfiles = useMemo(
    () => profiles.filter((profile) => !isSuperAdminProfile(profile)),
    [profiles],
  )

  const enabledModules = useMemo(
    () => enabledModulesFromPermissionKeys(editing.permissionKeys),
    [editing.permissionKeys],
  )

  const canSaveProfile = editing.id ? can('roles.edit') : can('roles.create')
  const isLockedProfile = editing.slug === 'super_admin_full'
  const isEditingExisting = Boolean(editing.id)
  const canEditFields = canSaveProfile && !isLockedProfile

  const getStatusButtonClass = (current: 'active' | 'inactive', target: 'active' | 'inactive') => {
    const isSelected = current === target
    if (target === 'active') {
      return isSelected
        ? 'border-[#153e90]/30 bg-[#153e90]/10 px-3 py-1.5 text-xs font-semibold text-[#153e90] dark:border-[#6ee75a]/30 dark:bg-[#6ee75a]/10 dark:text-[#6ee75a]'
        : 'border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40'
    }
    return isSelected
      ? 'border-border bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground'
      : 'border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40'
  }

  const getParentRoleName = (parentRoleId?: string) => {
    if (!parentRoleId) return 'Not assigned'
    return parentRoles.find((role) => role.id === parentRoleId)?.name || parentRoleId
  }

  const toggleModule = (moduleId: string) => {
    if (!canEditFields) return

    const viewKey = `${moduleId}.view` as PermissionKey
    const hasView = editing.permissionKeys.includes(viewKey)

    if (hasView) {
      setEditing({
        ...editing,
        permissionKeys: editing.permissionKeys.filter((key) => !key.startsWith(`${moduleId}.`)),
      })
    } else {
      setEditing({
        ...editing,
        permissionKeys: Array.from(new Set([...editing.permissionKeys, viewKey])),
      })
    }
  }

  const togglePermission = (permissionKey: PermissionKey) => {
    if (!canEditFields) return

    const exists = editing.permissionKeys.includes(permissionKey)
    const nextPermissions = exists
      ? editing.permissionKeys.filter((key) => key !== permissionKey)
      : [...editing.permissionKeys, permissionKey]

    setEditing({
      ...editing,
      permissionKeys: nextPermissions,
    })
  }

  const saveRole = async () => {
    if (!editing.name.trim()) {
      setNotice('Please enter role name.')
      return
    }

    if (!editing.parent_role_id) {
      setNotice('Please select a parent role.')
      return
    }

    if (isLockedProfile) {
      setNotice('Super Admin profile is locked.')
      return
    }

    if (!canSaveProfile) {
      setNotice(
        isEditingExisting
          ? 'You do not have roles.edit permission to update this profile.'
          : 'You do not have roles.create permission to create a profile.',
      )
      return
    }

    setSaving(true)
    setNotice('')

    const wasUpdate = Boolean(editing.id)

    try {
      const result = await savePermissionProfile(
        {
          name: editing.name.trim(),
          parent_role_id: editing.parent_role_id,
          status: editing.status,
          permissionKeys: editing.permissionKeys,
        },
        editing.id,
      )

      if (!result.ok) {
        setNotice(result.error)
        return
      }

      setEditing(profileToEditing(result.profile))
      setSelectedProfileId(result.profile.id)
      await reload()
      await refreshSession()
      setNotice(
        wasUpdate
          ? 'Permission profile updated in Supabase.'
          : 'Permission profile created in Supabase.',
      )
    } finally {
      setSaving(false)
    }
  }

  const editRole = (profile: PermissionProfileItem) => {
    setEditing(profileToEditing(profile))
    setNotice(`Editing "${profile.name}". Update the profile name below, then click Save Profile.`)

    requestAnimationFrame(() => {
      profileDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const setProfileStatus = async (profile: PermissionProfileItem, status: 'active' | 'inactive') => {
    if (profile.status === status) return

    if (isSuperAdminProfile(profile)) {
      setNotice('Super Admin profile status cannot be changed.')
      return
    }

    if (!can('roles.edit')) {
      setNotice('You do not have roles.edit permission to change profile status.')
      return
    }

    setSaving(true)
    setNotice('')

    try {
      const result = await savePermissionProfile(
        {
          name: profile.name,
          parent_role_id: profile.parent_role_id,
          status,
          permissionKeys: profile.permissions,
        },
        profile.id,
      )

      if (!result.ok) {
        setNotice(result.error)
        return
      }

      if (editing.id === profile.id) {
        setEditing(profileToEditing(result.profile))
      }

      await reload()
      await refreshSession()
      setNotice(`Profile marked as ${status === 'active' ? 'Active' : 'Inactive'}.`)
    } finally {
      setSaving(false)
    }
  }

  const deleteRole = async (profile: PermissionProfileItem) => {
    if (isSuperAdminProfile(profile)) {
      setNotice('Super Admin profile cannot be deleted.')
      return
    }

    if (profile.is_system) {
      setNotice('System profiles cannot be deleted.')
      return
    }

    setSaving(true)
    setNotice('')

    try {
      const result = await deletePermissionProfile(profile.id)
      if (!result.ok) {
        setNotice(result.error)
        return
      }

      if (editing.id === profile.id) {
        setEditing(emptyEditing(parentRoles[0]?.id || 'mentor'))
      }

      await reload()
      await refreshSession()
      setNotice('Permission profile deleted.')
    } finally {
      setSaving(false)
    }
  }

  const assignRole = async () => {
    if (!selectedUserId || !selectedProfileId) {
      setNotice('Select a user and permission profile to assign.')
      return
    }

    setSaving(true)
    setNotice('')

    try {
      const result = await assignUserPermissionProfile(selectedUserId, selectedProfileId)
      if (!result.ok) {
        setNotice(result.error)
        return
      }

      await refreshSession()
      setNotice('Permission profile assigned to user.')
    } finally {
      setSaving(false)
    }
  }

  const startNewProfile = () => {
    setEditing(emptyEditing(parentRoles[0]?.id || 'mentor'))
    setNotice('Creating a new custom permission profile.')
  }

  if (!can('roles.view')) {
    return (
      <div className="border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Role Management Locked</h1>
        <p className="mt-2 text-muted-foreground">Your current role cannot view role settings.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-[#153e90] dark:text-[#6ee75a]">LMS permission builder</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Role Management</h1>
        <p className="mt-2 max-w-4xl text-muted-foreground">
          Manage academy-wide permission profiles from Supabase. Roles are shared across all branches — switching
          branch in the header does not change this list. Parent roles are fixed categories; profiles define
          module and action access.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Scope:{' '}
          <span className="font-semibold text-foreground">All branches (not branch-filtered)</span>
          {' · '}
          Data source: <span className="font-semibold text-foreground">Supabase (live)</span>
        </p>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="border border-border bg-card p-5">
          <h2 className="text-xl font-bold">Role Preview</h2>
          {isEditingExisting ? (
            <p className="mt-2 text-sm text-[#153e90] dark:text-[#6ee75a]">
              Editing: <span className="font-semibold">{editing.name || 'Unnamed profile'}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {editing.name ? `Draft: ${editing.name}` : 'Create or select a profile to edit'}
            </p>
          )}

          <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
            <div className="border border-border p-3">
              <div className="text-2xl font-bold">{enabledModules.length}</div>
              <div className="text-muted-foreground">Modules</div>
            </div>

            <div className="border border-border p-3">
              <div className="text-2xl font-bold">{editing.permissionKeys.length}</div>
              <div className="text-muted-foreground">Permissions</div>
            </div>

            <div className="border border-border p-3">
              <div className="text-sm font-semibold">Parent Role</div>
              <div className="mt-1 text-muted-foreground">{getParentRoleName(editing.parent_role_id)}</div>
            </div>
          </div>
        </div>

        <div className="border border-border bg-card p-4">
          <h2 className="text-base font-bold">Assign Profile</h2>

          <div className="mt-3 space-y-3">
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="h-10 w-full border border-border bg-background px-3 text-sm"
            >
              <option value="">Select user</option>
              {assignableUsers.map((demoUser) => (
                <option key={demoUser.id} value={demoUser.id}>
                  {demoUser.fullName}
                </option>
              ))}
            </select>

            <select
              value={selectedProfileId}
              onChange={(event) => setSelectedProfileId(event.target.value)}
              className="h-10 w-full border border-border bg-background px-3 text-sm"
            >
              <option value="">Select permission profile</option>
              {assignableProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void assignRole()}
              disabled={!can('roles.assign') || saving}
              className="inline-flex w-full items-center justify-center bg-[#153e90] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-[#6ee75a] dark:text-black"
            >
              Assign
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <div className="border border-[#153e90]/25 bg-[#153e90]/10 px-4 py-3 text-sm text-[#153e90] dark:text-white">
          {notice}
        </div>
      )}

      <div
        ref={profileDetailsRef}
        className={`border bg-card p-5 ${
          isEditingExisting
            ? 'border-[#153e90] dark:border-[#6ee75a]'
            : 'border-border'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Profile Details</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEditingExisting
                ? 'Change the profile name here, then save. Custom profiles can be renamed.'
                : 'Fill in details for a new custom profile, then save.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can('roles.create') && (
              <button
                type="button"
                onClick={startNewProfile}
                className="border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
              >
                New Profile
              </button>
            )}
            <button
              type="button"
              disabled={!canSaveProfile || saving || isLockedProfile}
              onClick={() => void saveRole()}
              className="inline-flex items-center gap-2 bg-[#153e90] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-[#6ee75a] dark:text-black"
            >
              {saving ? 'Saving…' : isEditingExisting ? 'Save Profile' : 'Create Profile'}
            </button>
          </div>
        </div>

        {!canSaveProfile && !isLockedProfile && (
          <p className="mt-3 text-sm text-amber-600 dark:text-amber-300">
            {isEditingExisting
              ? 'You need roles.edit permission to rename or update this profile.'
              : 'You need roles.create permission to add a new profile.'}
          </p>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-2 md:col-span-2 xl:col-span-1">
            <span className="text-sm font-semibold">Profile Name</span>
            <input
              value={editing.name}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              disabled={!canEditFields}
              className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90] disabled:cursor-not-allowed disabled:opacity-60 dark:focus:border-[#6ee75a]"
              placeholder="Example: HOD"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold">Parent Role</span>
            <select
              value={editing.parent_role_id}
              onChange={(event) => setEditing({ ...editing, parent_role_id: event.target.value })}
              disabled={!canEditFields || editing.is_system}
              className="h-11 w-full border border-border bg-background px-3 outline-none disabled:opacity-60"
            >
              <option value="">Select Parent Role</option>
              {parentRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold">Status</span>
            <select
              value={editing.status}
              onChange={(event) =>
                setEditing({ ...editing, status: event.target.value as EditingProfile['status'] })
              }
              disabled={!canEditFields}
              className="h-11 w-full border border-border bg-background px-3 outline-none disabled:opacity-60"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Module and Permission Matrix</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Permissions loaded from the Supabase permissions catalog.
            </p>
          </div>

          <button
            disabled={!canSaveProfile || saving || isLockedProfile}
            type="button"
            onClick={() => void saveRole()}
            className="inline-flex items-center bg-[#153e90] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-[#6ee75a] dark:text-black"
          >
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>

        <div className="mt-5 overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading permission catalog…</p>
          ) : (
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Sidebar</th>
                  {actions.map((action) => (
                    <th key={action} className="px-3 py-3 text-center capitalize">
                      {action}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {moduleGroups.map((module) => (
                  <tr key={module.module_id} className="border-b border-border">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{module.label}</p>
                      <p className="text-xs text-muted-foreground">{module.module_id}</p>
                    </td>

                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={enabledModules.includes(module.module_id)}
                        onChange={() => toggleModule(module.module_id)}
                        disabled={!canEditFields}
                        className="h-4 w-4"
                      />
                    </td>

                    {actions.map((action) => {
                      const permission = module.permissions.find((item) => item.action === action)
                      const permissionKey = permission?.permission_key as PermissionKey | undefined

                      return (
                        <td key={action} className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            disabled={!permissionKey || !canEditFields}
                            checked={permissionKey ? editing.permissionKeys.includes(permissionKey) : false}
                            onChange={() => permissionKey && togglePermission(permissionKey)}
                            className="h-4 w-4 disabled:opacity-20"
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>


      <div className="border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Permission Profiles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          System and custom profiles from Supabase. Available on every branch.
        </p>

        {loading && <p className="mt-5 text-sm text-muted-foreground">Loading permission profiles…</p>}

        {!loading && !profiles.length && (
          <p className="mt-5 text-sm text-muted-foreground">No permission profiles found in Supabase.</p>
        )}

        {!loading && profiles.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[180px]" />
                <col className="w-[140px]" />
                <col className="w-[88px]" />
                <col className="w-[108px]" />
                <col className="w-[88px]" />
                <col className="w-[320px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="whitespace-nowrap px-4 py-3">Profile</th>
                  <th className="whitespace-nowrap px-4 py-3">Parent Role</th>
                  <th className="whitespace-nowrap px-4 py-3">Modules</th>
                  <th className="whitespace-nowrap px-4 py-3">Permissions</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {profilesByParentRole.flatMap(({ parentRole, profiles: groupedProfiles }) =>
                  groupedProfiles.map((profile) => {
                    const moduleCount = enabledModulesFromPermissionKeys(profile.permissions).length

                    return (
                      <tr key={profile.id} className="border-b border-border">
                        <td className="truncate px-4 py-3 font-semibold">{profile.name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{parentRole.name}</td>
                        <td className="whitespace-nowrap px-4 py-3">{moduleCount}</td>
                        <td className="whitespace-nowrap px-4 py-3">{profile.permissions.length}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                        <button
                                type="button"
                                disabled={profile.status === 'active' || saving || !can('roles.edit')}
                                onClick={() => void setProfileStatus(profile, 'active')}
                                className={getStatusButtonClass(profile.status, 'active')}
                              >
                                Active
                              </button>

                              <button
                                type="button"
                                disabled={profile.status === 'inactive' || saving || !can('roles.edit')}
                                onClick={() => void setProfileStatus(profile, 'inactive')}
                                className={getStatusButtonClass(profile.status, 'inactive')}
                              >
                                Inactive
                              </button>
                              </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {isSuperAdminProfile(profile) ? (
                            <span className="inline-flex min-w-[280px] justify-end text-xs text-muted-foreground">
                              Locked · Active
                            </span>
                          ) : (
                            <div className="inline-flex min-w-[280px] justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => editRole(profile)}
                                className="border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                              >
                                Edit
                              </button> 



                              <button
                                type="button"
                                disabled={profile.is_system || saving}
                                onClick={() => void deleteRole(profile)}
                                className="border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/10 disabled:opacity-40"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  }),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
