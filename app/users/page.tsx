'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useDemoAuth } from '@/lib/demo/auth'
import { branches, companies, demoModules } from '@/lib/demo/seed'
import type { DemoUser } from '@/lib/demo/types'

const parentRoles = [
  { id: 'superadmin', name: 'Super Admin' },
  { id: 'admin', name: 'Admin' },
  { id: 'branch-controller', name: 'Branch Admin' },
  { id: 'hod', name: 'HOD ' },
  { id: 'mentor', name: 'Mentor' },
  { id: 'student', name: 'Student' },
  { id: 'final-qa', name: 'Final QA' },
  { id: 'placement', name: 'Placement Cell' },
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

function createEmptyUser(): DemoUser {
  return {
    id: `u-${Date.now()}`,
    fullName: '',
    email: '',
    password: 'demo123',
    roleId: 'student',
    companyId: 'c1',
    branchId: 'b1',
    status: 'active',
  }
}

export default function Page() {
  const { users, roles, updateUsers, user, role, can } = useDemoAuth()
  const { resolvedTheme } = useTheme()
  const iconFolder = resolvedTheme === 'dark' ? 'dark-mode' : 'light-mode'

  const [formUser, setFormUser] = useState<DemoUser>(() => createEmptyUser())
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || '')
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [notice, setNotice] = useState('')

  const selectedUser = useMemo(() => {
    return users.find((item) => item.id === selectedUserId) || users[0]
  }, [selectedUserId, users])

  const selectedUserRole = useMemo(() => {
    return roles.find((item) => item.id === selectedUser?.roleId)
  }, [roles, selectedUser])

  const activeUsers = users.filter((item) => item.status === 'active')
  const customRoles = roles.filter((item) => !parentRoles.some((parent) => parent.id === item.id))

  const filteredUsers = useMemo(() => {
    return users.filter((item) => {
      const term = searchTerm.trim().toLowerCase()
      const matchesSearch =
        !term ||
        item.fullName.toLowerCase().includes(term) ||
        item.email.toLowerCase().includes(term) ||
        item.roleId.toLowerCase().includes(term)

      const matchesRole = roleFilter === 'all' || item.roleId === roleFilter
      const matchesBranch = branchFilter === 'all' || item.branchId === branchFilter
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter

      return matchesSearch && matchesRole && matchesBranch && matchesStatus
    })
  }, [users, searchTerm, roleFilter, branchFilter, statusFilter])

  const getRoleName = (roleId?: string) => {
    return roles.find((item) => item.id === roleId)?.name || 'Not assigned'
  }

  const getParentRoleName = (roleId?: string) => {
    const currentRole = roles.find((item) => item.id === roleId)
    const parentRoleId = currentRole?.parentRoleId || currentRole?.id || roleId
    return parentRoles.find((item) => item.id === parentRoleId)?.name || 'Not assigned'
  }

  const getCompanyName = (companyId?: string) => {
    if (!companyId || companyId === 'all') return 'All Companies'
    return companies.find((item) => item.id === companyId)?.name || companyId
  }

  const getBranchName = (branchId?: string) => {
    if (!branchId || branchId === 'all') return 'All Branches'
    return branches.find((item) => item.id === branchId)?.name || branchId
  }

  const getAccessScope = (item: DemoUser) => {
    if (item.roleId === 'superadmin') return 'Full system access'
    if (item.branchId === 'all') return 'Company level access'
    if (item.roleId === 'student') return 'Own student data only'
    if (item.roleId === 'mentor') return 'Assigned batches only'
    return 'Assigned branch access'
  }

  const getVisibleModules = (roleId?: string) => {
    const currentRole = roles.find((item) => item.id === roleId)

    if (!currentRole) return []

    return demoModules.filter((module) => currentRole.enabledModules.includes(module.id))
  }

  const resetForm = () => {
    setFormUser(createEmptyUser())
    setEditingUserId(null)
  }

  const saveUser = () => {
    if (!can('users.create') && !editingUserId) {
      setNotice('Your current role cannot create users.')
      return
    }

    if (!can('users.edit') && editingUserId) {
      setNotice('Your current role cannot edit users.')
      return
    }

    if (!formUser.fullName.trim()) {
      setNotice('Please enter full name.')
      return
    }

    if (!formUser.email.trim()) {
      setNotice('Please enter email address.')
      return
    }

    const cleanUser: DemoUser = {
      ...formUser,
      fullName: formUser.fullName.trim(),
      email: formUser.email.trim().toLowerCase(),
      password: formUser.password || 'demo123',
      companyId: formUser.companyId || 'c1',
      branchId: formUser.branchId || 'b1',
    }

    const exists = users.some((item) => item.id === cleanUser.id)

    if (exists) {
      updateUsers(users.map((item) => (item.id === cleanUser.id ? cleanUser : item)))
      setNotice('User updated successfully in demo.')
    } else {
      updateUsers([cleanUser, ...users])
      setNotice('User created successfully in demo.')
    }

    setSelectedUserId(cleanUser.id)
    resetForm()
  }

  const editUser = (item: DemoUser) => {
    setFormUser({ ...item })
    setEditingUserId(item.id)
    setSelectedUserId(item.id)
    setNotice(`Editing ${item.fullName}.`)
  }

  const deleteUser = (userId: string) => {
    if (!can('users.delete')) {
      setNotice('Your current role cannot delete users.')
      return
    }

    if (userId === user?.id) {
      setNotice('You cannot delete the currently logged in demo user.')
      return
    }

    updateUsers(users.filter((item) => item.id !== userId))

    if (selectedUserId === userId) {
      setSelectedUserId(users.find((item) => item.id !== userId)?.id || '')
    }

    setNotice('User deleted from demo state.')
  }

  const toggleUserStatus = (item: DemoUser) => {
    if (!can('users.edit')) {
      setNotice('Your current role cannot enable or disable users.')
      return
    }

    const nextStatus = item.status === 'active' ? 'inactive' : 'active'
    updateUsers(users.map((userItem) => (userItem.id === item.id ? { ...userItem, status: nextStatus } : userItem)))
    setNotice(`${item.fullName} is now ${nextStatus}.`)
  }

  const assignRole = (item: DemoUser, roleId: string) => {
    if (!can('users.assign')) {
      setNotice('Your current role cannot assign roles.')
      return
    }

    updateUsers(users.map((userItem) => (userItem.id === item.id ? { ...userItem, roleId } : userItem)))
    setNotice(`Role assigned to ${item.fullName}.`)
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
            Create demo users, assign parent based custom roles, control company and branch scope, and check which modules each user can access before connecting Supabase.
          </p>
        </div>

        <div className="border border-[#153e90]/25 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Current role:</span> {role?.name || 'Not selected'}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">{users.length}</div>
              <div className="mt-1 text-sm text-muted-foreground">Total Users</div>
              <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Demo logins and new local users</div>
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
              <div className="text-3xl font-bold">{customRoles.length}</div>
              <div className="mt-1 text-sm text-muted-foreground">Custom Roles</div>
              <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Created under parent roles</div>
            </div>
            <CustomIcon icon="workstream.svg" folder={iconFolder} alt="Custom Roles" className="h-8 w-8" />
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">{activeUsers.length}</div>
              <div className="mt-1 text-sm text-muted-foreground">Active Users</div>
              <div className="mt-3 text-xs text-[#153e90] dark:text-[#6ee75a]">Company and branch controlled</div>
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

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {(can('users.create') || can('users.edit')) && (
            <div className="border border-border bg-card p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <h2 className="text-xl font-bold">{editingUserId ? 'Edit User' : 'Create User'}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Demo user creation. Later this will connect with auth users, profiles, user roles and branch assignments.
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
                    value={formUser.fullName}
                    onChange={(event) => setFormUser({ ...formUser, fullName: event.target.value })}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                    placeholder="Enter user name"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold">Email</span>
                  <input
                    value={formUser.email}
                    onChange={(event) => setFormUser({ ...formUser, email: event.target.value })}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                    placeholder="name@pixlpluzportal.demo"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold">Assigned Role</span>
                  <select
                    value={formUser.roleId}
                    onChange={(event) => setFormUser({ ...formUser, roleId: event.target.value })}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                  >
                    {roles.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

            

                <label className="space-y-2">
                  <span className="text-sm font-semibold">Branch Scope</span>
                  <select
                    value={formUser.branchId || 'b1'}
                    onChange={(event) => setFormUser({ ...formUser, branchId: event.target.value })}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                  >
                    <option value="all">All Branches</option>
                    {branches.map((item) => (
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
                    onChange={(event) => setFormUser({ ...formUser, status: event.target.value as DemoUser['status'] })}
                    className="h-11 w-full border border-border bg-background px-3 outline-none focus:border-[#153e90]"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={saveUser}
                  className="inline-flex items-center gap-2 bg-[#153e90] px-5 py-3 font-semibold text-white"
                >
                  <CustomIcon icon="students.svg" folder={iconFolder} alt="Save User" className="h-4 w-4" />
                  {editingUserId ? 'Update User' : 'Add User'}
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
                  View users with parent role, custom role, branch scope and allowed modules.
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
                  <option value="all">All Roles</option>
                  {roles.map((item) => (
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
                  {branches.map((item) => (
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
                  {filteredUsers.map((item) => {
                    const userModules = getVisibleModules(item.roleId)
                    const isSelected = selectedUserId === item.id

                    return (
                      <tr key={item.id} className={isSelected ? 'border-b border-border bg-[#153e90]/5 dark:bg-[#6ee75a]/5' : 'border-b border-border'}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            
                             <div className="flex h-10 w-10 items-center justify-center overflow-hidden border border-border bg-background">
                                                        <Image
                                                          src={ '/avatar.svg'}
                                                          alt={item.fullName} 
                                                          width={40}
                                                          height={40}
                                                          className="h-full w-full object-cover"
                                                        />
                                                      </div>
                            <div>
                              <p className="font-semibold text-foreground">{item.fullName}</p>
                              <p className="text-xs text-muted-foreground">{getAccessScope(item)}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">{item.email}</td>
                        
                        <td className="px-4 py-3">
                          <select
                            value={item.roleId}
                            onChange={(event) => assignRole(item, event.target.value)}
                            disabled={!can('users.assign')}
                            className="h-9 w-[180px] border border-border bg-background px-2 text-xs outline-none disabled:opacity-60"
                          >
                            {roles.map((roleItem) => (
                              <option key={roleItem.id} value={roleItem.id}>
                                {roleItem.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{getBranchName(item.branchId)}</td>
                        <td className="px-4 py-3">
                          <span className={item.status === 'active' ? 'border border-[#153e90]/25 bg-[#153e90]/10 px-2 py-1 text-xs font-semibold capitalize text-[#153e90] dark:border-[#6ee75a]/25 dark:bg-[#6ee75a]/10 dark:text-white' : 'border border-border bg-background px-2 py-1 text-xs font-semibold capitalize text-muted-foreground'}>
                            {item.status}
                          </span>
                        </td>
                       
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedUserId(item.id)}
                              className="border border-border p-2 hover:bg-accent"
                              title="View"
                            >
                              <CustomIcon icon="dashboard.svg" folder={iconFolder} alt="View" className="h-4 w-4" />
                            </button>

                            {can('users.edit') && (
                              <button
                                type="button"
                                onClick={() => editUser(item)}
                                className="border border-border p-2 hover:bg-accent"
                                title="Edit"
                              >
                                <CustomIcon icon="submissions.svg" folder={iconFolder} alt="Edit" className="h-4 w-4" />
                              </button>
                            )}

                            {can('users.edit') && (
                              <button
                                type="button"
                                onClick={() => toggleUserStatus(item)}
                                className="border border-border p-2 hover:bg-accent"
                                title="Enable or Disable"
                              >
                                <CustomIcon icon="attendance.svg" folder={iconFolder} alt="Enable Disable" className="h-4 w-4" />
                              </button>
                            )}

                            {can('users.delete') && (
                              <button
                                type="button"
                                onClick={() => deleteUser(item.id)}
                                className="border border-border p-2 hover:bg-red-500/10"
                                title="Delete"
                              >
                                <CustomIcon icon="reviews.svg" folder={iconFolder} alt="Delete" className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {filteredUsers.length === 0 && (
              <div className="mt-5 border border-border bg-background p-6 text-center text-sm text-muted-foreground">
                No users found for the selected filters.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}