'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useDemoAuth } from '@/lib/demo/auth'
import { demoModules, permissionActions } from '@/lib/demo/seed'
import type { DemoRole, ModuleId, PermissionAction, PermissionKey } from '@/lib/demo/types'

const parentRoles = [
  { id: 'admin', name: 'Company Admin', level: 2, description: 'CEO or company management access.' },
  { id: 'branch-controller', name: 'Branch Admin', level: 3, description: 'Branch-level academic and operations control.' },
  { id: 'mentor', name: 'Mentor', level: 4, description: 'Can be HOD, trainer, student support mentor or final QA by permissions.' },
  { id: 'student', name: 'Student', level: 5, description: 'Student learning portal access.' },
  { id: 'placement', name: 'Placement', level: 4, description: 'Career, placement and interview readiness access.' },
]

const protectedDefaultRoleIds = [
  'superadmin',
  'admin',
  'branch-controller',
  'mentor',
  'hod',
  'final-qa',
  'student',
  'placement',
]

const getDefaultLevelByParent = (parentRoleId?: string) => {
  return parentRoles.find((role) => role.id === parentRoleId)?.level || 4
}

const emptyRole = (createdBy = 'superadmin'): DemoRole => ({
  id: `custom-${Date.now()}`,
  name: '',
  level: 4,
  parentRoleId: 'mentor',
  companyScope: 'c1',
  branchScope: 'b1',
  status: 'active',
  createdBy,
  enabledModules: ['dashboard'],
  permissions: ['dashboard.view'],
})

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

export default function RoleManagementPage() {
  const { roles, updateRoles, users, updateUsers, user, can } = useDemoAuth()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const [editing, setEditing] = useState<DemoRole>(() => emptyRole(user?.roleId))
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || '')
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id || '')
  const [notice, setNotice] = useState('')

  const selectedModuleCount = editing.enabledModules.length
  const selectedPermissionCount = editing.permissions.length

  const canManage = can('roles.create') || can('roles.edit') || can('roles.assign')

  const getParentRoleName = (parentRoleId?: string) => {
    if (parentRoleId === 'superadmin') {
      return 'Super Admin'
    }

    if (parentRoleId === 'mentor' || parentRoleId === 'hod' || parentRoleId === 'final-qa') {
      return 'Mentor'
    }

    return parentRoles.find((role) => role.id === parentRoleId)?.name || 'Not assigned'
  }

  const getRoleCategoryName = (role: DemoRole) => {
    if (role.id === 'superadmin') {
      return 'Super Admin'
    }

    if (role.id === 'mentor' || role.id === 'hod' || role.id === 'final-qa') {
      return 'Mentor'
    }

    if (role.parentRoleId === 'mentor' || role.parentRoleId === 'hod' || role.parentRoleId === 'final-qa') {
      return 'Mentor'
    }

    return getParentRoleName(role.parentRoleId || role.id)
  }

  const toggleModule = (moduleId: ModuleId) => {
    const enabled = editing.enabledModules.includes(moduleId)

    if (enabled) {
      setEditing({
        ...editing,
        enabledModules: editing.enabledModules.filter((id) => id !== moduleId),
        permissions: editing.permissions.filter((permission) => !permission.startsWith(`${moduleId}.`)),
      })
    } else {
      setEditing({
        ...editing,
        enabledModules: [...editing.enabledModules, moduleId],
        permissions: Array.from(new Set([...editing.permissions, `${moduleId}.view` as PermissionKey])),
      })
    }
  }

  const togglePermission = (moduleId: ModuleId, action: PermissionAction) => {
    const key = `${moduleId}.${action}` as PermissionKey
    const exists = editing.permissions.includes(key)
    const nextPermissions = exists ? editing.permissions.filter((permission) => permission !== key) : [...editing.permissions, key]
    const nextModules =
      action === 'view' && !exists && !editing.enabledModules.includes(moduleId)
        ? [...editing.enabledModules, moduleId]
        : editing.enabledModules

    setEditing({
      ...editing,
      enabledModules: nextModules,
      permissions: nextPermissions,
    })
  }

  const saveRole = () => {
    if (!editing.name.trim()) {
      setNotice('Please enter role name.')
      return
    }

    const exists = roles.some((role) => role.id === editing.id)
    const next = exists ? roles.map((role) => (role.id === editing.id ? editing : role)) : [...roles, editing]

    updateRoles(next)
    setSelectedRoleId(editing.id)
    setNotice(exists ? 'Role updated successfully in demo.' : 'Role created successfully in demo.')
  }

  const editRole = (role: DemoRole) => {
    const normalizedParentRoleId =
      role.id === 'mentor' || role.id === 'hod' || role.id === 'final-qa'
        ? 'mentor'
        : role.parentRoleId

    setEditing({
      ...role,
      parentRoleId: normalizedParentRoleId,
      permissions: [...role.permissions],
      enabledModules: [...role.enabledModules],
    })
    setNotice(`Editing ${role.name}.`)
  }

  const duplicateRole = (role: DemoRole) => {
    const copyParentRoleId =
      role.id === 'mentor' || role.id === 'hod' || role.id === 'final-qa'
        ? 'mentor'
        : role.parentRoleId || 'mentor'

    const copy = {
      ...role,
      id: `custom-${Date.now()}`,
      name: `${role.name} Copy`,
      parentRoleId: copyParentRoleId,
      createdBy: user?.roleId || 'superadmin',
      permissions: [...role.permissions],
      enabledModules: [...role.enabledModules],
    }

    setEditing(copy)
    setNotice('Role duplicated. Review and save it.')
  }

  const deleteRole = (roleId: string) => {
    if (protectedDefaultRoleIds.includes(roleId)) {
      setNotice('Default demo roles cannot be deleted. You can duplicate and customize them.')
      return
    }

    updateRoles(roles.filter((role) => role.id !== roleId))
    setNotice('Custom role deleted in demo.')
  }

  const assignRole = () => {
    updateUsers(users.map((demoUser) => (demoUser.id === selectedUserId ? { ...demoUser, roleId: selectedRoleId } : demoUser)))
    setNotice('Role assigned to demo user. Use the top role dropdown or login again to test.')
  }

  const availableActions = useMemo(() => new Set(permissionActions), [])

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
          Create custom permission profiles under fixed parent roles. Super Admin is not listed as a parent role because there will be only one Super Admin.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {parentRoles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() =>
              setEditing({
                ...editing,
                parentRoleId: role.id,
                level: role.level,
              })
            }
            className={
              editing.parentRoleId === role.id
                ? 'border border-[#153e90] bg-card p-4 text-left dark:border-white'
                : 'border border-border bg-card p-4 text-left'
            }
          >
            <div className="text-sm font-bold">{role.name}</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{role.description}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="border border-border bg-card p-5">
          <CustomIcon icon="patch.svg" folder={iconFolder} alt="Role Preview" className="mb-4 h-8 w-8" />

          <h2 className="text-xl font-bold">Role Preview</h2>
          <p className="mt-2 text-sm text-muted-foreground">{editing.name || 'Unnamed Custom Role'}</p>

          <div className="mt-5 grid gap-3 text-sm md:grid-cols-4">
            <div className="border border-border p-3">
              <div className="text-2xl font-bold">{selectedModuleCount}</div>
              <div className="text-muted-foreground">Modules</div>
            </div>

            <div className="border border-border p-3">
              <div className="text-2xl font-bold">{selectedPermissionCount}</div>
              <div className="text-muted-foreground">Permissions</div>
            </div>

            <div className="border border-border p-3">
              <div className="text-sm font-semibold">Parent Role</div>
              <div className="mt-1 text-muted-foreground">{getParentRoleName(editing.parentRoleId)}</div>
            </div>

            <div className="border border-border p-3">
              <div className="text-sm font-semibold">Scope</div>
              <div className="mt-1 text-muted-foreground">
                {editing.companyScope} / {editing.branchScope}
              </div>
            </div>
          </div>
        </div>

        <div className="border border-border bg-card p-4">
          <h2 className="text-base font-bold">Assign Role</h2>

          <div className="mt-3 space-y-3">
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="h-10 w-full border border-border bg-background px-3 text-sm"
            >
              <option value="">Select user</option>
              {users.map((demoUser) => (
                <option key={demoUser.id} value={demoUser.id}>
                  {demoUser.fullName}
                </option>
              ))}
            </select>

            <select
              value={selectedRoleId}
              onChange={(event) => setSelectedRoleId(event.target.value)}
              className="h-10 w-full border border-border bg-background px-3 text-sm"
            >
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={assignRole}
              disabled={!can('roles.assign')}
              className="inline-flex w-full items-center justify-center gap-2 bg-[#153e90] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              <CustomIcon icon="students.svg" folder={iconFolder} alt="Assign Role" className="h-4 w-4" />
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

      <div className="border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Role Details</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-semibold">Custom Role Name</span>
            <input
              value={editing.name}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              className="h-11 w-full border border-border bg-background px-3 outline-none"
              placeholder="Example: HOD "
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold">Parent Role</span>
            <select
              value={editing.parentRoleId || ''}
              onChange={(event) => {
                const parentRoleId = event.target.value

                setEditing({
                  ...editing,
                  parentRoleId,
                  level: getDefaultLevelByParent(parentRoleId),
                })
              }}
              className="h-11 w-full border border-border bg-background px-3 outline-none"
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
            <span className="text-sm font-semibold">Branch </span>
            <select
              value={editing.branchScope}
              onChange={(event) => setEditing({ ...editing, branchScope: event.target.value })}
              className="h-11 w-full border border-border bg-background px-3 outline-none"
            >
              <option value="all">All Branches</option>
              <option value="b1">Kochi Main Branch</option>
              <option value="b2">Calicut Satellite</option>
              <option value="b3">Dubai Training Hub</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold">Status</span>
            <select
              value={editing.status}
              onChange={(event) => setEditing({ ...editing, status: event.target.value as DemoRole['status'] })}
              className="h-11 w-full border border-border bg-background px-3 outline-none"
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
              Enable sidebar modules and select what actions this role can perform.
            </p>
          </div>

          <button
            disabled={!canManage}
            type="button"
            onClick={saveRole}
            className="inline-flex items-center gap-2 bg-[#153e90] px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            <CustomIcon icon="tasks.svg" folder={iconFolder} alt="Save Role" className="h-4 w-4" />
            Save Role
          </button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Sidebar</th>
                {permissionActions.map((action) => (
                  <th key={action} className="px-3 py-3 text-center capitalize">
                    {action}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {demoModules.map((module) => (
                <tr key={module.id} className="border-b border-border">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{module.label}</p>
                    <p className="text-xs text-muted-foreground">{module.description}</p>
                  </td>

                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={editing.enabledModules.includes(module.id)}
                      onChange={() => toggleModule(module.id)}
                      className="h-4 w-4"
                    />
                  </td>

                  {permissionActions.map((action) => {
                    const available = module.actions.includes(action)
                    const key = `${module.id}.${action}` as PermissionKey

                    return (
                      <td key={action} className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          disabled={!available}
                          checked={editing.permissions.includes(key)}
                          onChange={() => togglePermission(module.id, action)}
                          className="h-4 w-4 disabled:opacity-20"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Saved Roles</h2>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Parent Role</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Modules</th>
                <th className="px-4 py-3">Permissions</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-b border-border">
                  <td className="px-4 py-3 font-semibold">{role.name}</td>
                  <td className="px-4 py-3">{getRoleCategoryName(role)}</td>
                  <td className="px-4 py-3">{role.level}</td>
                  <td className="px-4 py-3">
                    {role.companyScope} / {role.branchScope}
                  </td>
                  <td className="px-4 py-3">{role.enabledModules.length}</td>
                  <td className="px-4 py-3">{role.permissions.length}</td>
                  <td className="px-4 py-3">
                    <span className="border border-border px-2 py-1 text-xs capitalize">{role.status}</span>
                  </td>

                  <td className="px-4 py-3">
                    {role.id === 'superadmin' ? (
                      <span className="text-xs text-muted-foreground">Locked</span>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => editRole(role)} className="border border-border p-2 hover:bg-accent">
                          <CustomIcon icon="submissions.svg" folder={iconFolder} alt="Edit" className="h-4 w-4" />
                        </button>

                        <button onClick={() => duplicateRole(role)} className="border border-border p-2 hover:bg-accent">
                          <CustomIcon icon="workstream.svg" folder={iconFolder} alt="Duplicate" className="h-4 w-4" />
                        </button>

                        <button onClick={() => deleteRole(role.id)} className="border border-border p-2 hover:bg-red-500/10">
                          <CustomIcon icon="reviews.svg" folder={iconFolder} alt="Delete" className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}