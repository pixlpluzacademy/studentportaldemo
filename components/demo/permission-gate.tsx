'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { getModuleByHref, useAuth } from '@/lib/auth/provider'

export function PermissionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, canModule, sessionState } = useAuth()
  const module = getModuleByHref(pathname)

  if (pathname === '/login' || pathname === '/') return <>{children}</>

  if (sessionState === 'loading') {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading session...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="max-w-md border border-[#153e90]/25 bg-card p-8 text-center">
          <Lock className="mx-auto mb-4 h-10 w-10 text-[#153e90] dark:text-[#6ee75a]" />
          <h1 className="text-2xl font-bold">Login Required</h1>
          <p className="mt-2 text-muted-foreground">Please login to access the portal.</p>
          <Link href="/login" className="mt-6 inline-flex bg-[#153e90] px-5 py-3 font-semibold text-white">Go to Login</Link>
        </div>
      </div>
    )
  }

  if (module && !canModule(module.id)) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="max-w-lg border border-red-500/20 bg-card p-8 text-center">
          <Lock className="mx-auto mb-4 h-10 w-10 text-red-500" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="mt-2 text-muted-foreground">Your current role does not have permission to view {module.label}.</p>
          <Link href="/dashboard" className="mt-6 inline-flex border border-[#153e90]/30 px-5 py-3 font-semibold text-[#153e90] dark:text-white">Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
