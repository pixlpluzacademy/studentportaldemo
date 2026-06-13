'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadAuthContext } from '@/lib/auth/context'
import { canModuleAccess, canPermission } from '@/lib/auth/modules'
import type { AuthContextValue, AuthSessionState } from '@/lib/auth/types'
import { createClient } from '@/lib/supabase/client'
import type { DemoRole, DemoUser, ModuleId, PermissionKey } from '@/lib/demo/types'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [sessionState, setSessionState] = useState<AuthSessionState>('loading')
  const [user, setUser] = useState<DemoUser | null>(null)
  const [role, setRole] = useState<DemoRole | null>(null)
  const [users, setUsers] = useState<DemoUser[]>([])
  const [roles, setRoles] = useState<DemoRole[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [parentRoleId, setParentRoleId] = useState<string | null>(null)

  const refreshSession = useCallback(async () => {
    const context = await loadAuthContext(supabase)
    setUser(context.user)
    setRole(context.role)
    setUsers(context.users)
    setRoles(context.roles)
    setPermissions(context.permissions)
    setParentRoleId(context.parentRoleId)
    setSessionState(context.user ? 'authenticated' : 'unauthenticated')
  }, [supabase])

  useEffect(() => {
    void refreshSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshSession()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [refreshSession, supabase])

  const login = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      })

      if (error) {
        return { ok: false as const, error: error.message }
      }

      await refreshSession()
      return { ok: true as const }
    },
    [refreshSession, supabase],
  )

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setRole(null)
    setUsers([])
    setRoles([])
    setPermissions([])
    setParentRoleId(null)
    setSessionState('unauthenticated')
    router.replace('/login')
  }, [router, supabase])

  const can = useCallback(
    (permission: PermissionKey | string) => canPermission(permissions, parentRoleId || undefined, permission),
    [parentRoleId, permissions],
  )

  const canModule = useCallback(
    (moduleId: ModuleId) => canModuleAccess(permissions, parentRoleId || undefined, moduleId),
    [parentRoleId, permissions],
  )

  const updateRoles = useCallback((_nextRoles: DemoRole[]) => {
    void refreshSession()
  }, [refreshSession])

  const updateUsers = useCallback((_nextUsers: DemoUser[]) => {
    void refreshSession()
  }, [refreshSession])

  const switchRole = useCallback((_roleId: string) => {
    // Permission profiles are assigned in the database (Phase 2 UI).
  }, [])

  const value: AuthContextValue = {
    user,
    role,
    users,
    roles,
    parentRoleId: (parentRoleId as AuthContextValue['parentRoleId']) || null,
    sessionState,
    login,
    logout,
    can,
    canModule,
    updateRoles,
    updateUsers,
    switchRole,
    refreshSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export { getModuleByHref } from '@/lib/auth/modules'
