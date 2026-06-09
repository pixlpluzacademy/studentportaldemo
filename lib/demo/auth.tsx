'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { storageKeys } from '@/lib/branding'
import { defaultRoles, defaultUsers, demoModules } from './seed'
import type { DemoRole, DemoUser, ModuleId, PermissionKey } from './types'

type DemoAuthContextValue = {
  user: DemoUser | null
  role: DemoRole | null
  users: DemoUser[]
  roles: DemoRole[]
  login: (email: string, password: string) => { ok: true } | { ok: false; error: string }
  logout: () => void
  can: (permission: PermissionKey | string) => boolean
  canModule: (moduleId: ModuleId) => boolean
  updateRoles: (roles: DemoRole[]) => void
  updateUsers: (users: DemoUser[]) => void
  switchRole: (roleId: string) => void
}

const DemoAuthContext = createContext<DemoAuthContextValue | null>(null)

const USERS_KEY = storageKeys.users
const ROLES_KEY = storageKeys.roles
const CURRENT_USER_KEY = storageKeys.currentUser

function loadArray<T>(key: string, fallback: T[]): T[] {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [users, setUsers] = useState<DemoUser[]>(defaultUsers)
  const [roles, setRoles] = useState<DemoRole[]>(defaultRoles)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    setUsers(loadArray(USERS_KEY, defaultUsers))
    setRoles(loadArray(ROLES_KEY, defaultRoles))
    setCurrentUserId(localStorage.getItem(CURRENT_USER_KEY))
  }, [])

  const user = useMemo(() => users.find((u) => u.id === currentUserId) || null, [users, currentUserId])
  const role = useMemo(() => roles.find((r) => r.id === user?.roleId) || null, [roles, user])

  const persistUsers = (nextUsers: DemoUser[]) => {
    setUsers(nextUsers)
    localStorage.setItem(USERS_KEY, JSON.stringify(nextUsers))
  }

  const persistRoles = (nextRoles: DemoRole[]) => {
    setRoles(nextRoles)
    localStorage.setItem(ROLES_KEY, JSON.stringify(nextRoles))
  }

  const login = (email: string, password: string) => {
    const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password)
    if (!found) return { ok: false as const, error: 'Invalid demo login. Use demo123 as password.' }
    if (found.status !== 'active') return { ok: false as const, error: 'This demo user is inactive.' }
    setCurrentUserId(found.id)
    localStorage.setItem(CURRENT_USER_KEY, found.id)
    return { ok: true as const }
  }

  const logout = () => {
    setCurrentUserId(null)
    localStorage.removeItem(CURRENT_USER_KEY)
    router.replace('/login')
  }

  const can = (permission: PermissionKey | string) => {
    if (role?.id === 'superadmin') return true
    return Boolean(role?.permissions.includes(permission as PermissionKey))
  }

  const canModule = (moduleId: ModuleId) => {
    if (role?.id === 'superadmin') return true
    return Boolean(role?.enabledModules.includes(moduleId) && role?.permissions.includes(`${moduleId}.view` as PermissionKey))
  }

  const switchRole = (roleId: string) => {
    if (!user) return
    const updatedUsers = users.map((u) => u.id === user.id ? { ...u, roleId } : u)
    persistUsers(updatedUsers)
  }

  const value: DemoAuthContextValue = {
    user, role, users, roles, login, logout, can, canModule, updateRoles: persistRoles, updateUsers: persistUsers, switchRole,
  }

  return <DemoAuthContext.Provider value={value}>{children}</DemoAuthContext.Provider>
}

export function useDemoAuth() {
  const ctx = useContext(DemoAuthContext)
  if (!ctx) throw new Error('useDemoAuth must be used inside DemoAuthProvider')
  return ctx
}

export function getModuleByHref(pathname: string) {
  const exact = demoModules.find((m) => pathname === m.href || pathname.startsWith(`${m.href}/`))
  return exact || null
}
