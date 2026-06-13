'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { APP_DISPLAY_NAME } from '@/lib/branding'
import { useActiveBranch } from '@/lib/data/active-branch-context'
import type { ModuleId } from '@/lib/demo/types'
import { useDemoAuth } from '@/lib/demo/auth'
import { PermissionGate } from '@/components/demo/permission-gate'
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  Settings,
  Sun,
  User,
} from 'lucide-react'

type NavChild = {
  label: string
  href: string
  moduleId: ModuleId
  icon: string
  lightIcon?: string
}

type NavGroup = {
  label: string
  href?: string
  moduleId?: ModuleId
  icon: string
  lightIcon?: string
  children?: NavChild[]
}

const navGroups: NavGroup[] = [
  { label: 'Dashboard', href: '/dashboard', moduleId: 'dashboard', icon: 'dashboard.svg' },
  { label: 'Roles', href: '/role-management', moduleId: 'roles', icon: 'workstream.svg' },
  { label: 'Branches', href: '/branches', moduleId: 'branches', icon: 'patch.svg' },
  {
    label: 'Courses',
    href: '/courses',
    moduleId: 'courses',
    icon: 'patch.svg',
    children: [
      { label: 'Basic', href: '/courses/basic', moduleId: 'courses', icon: '14-Digital Marketing.svg' },
      { label: 'Advanced', href: '/courses/advanced', moduleId: 'courses', icon: '18-3D Visual.svg' },
      { label: 'Professional', href: '/courses/professional', moduleId: 'courses', icon: '15-Software& web dev..svg' },
    ],
  },
  {
    label: 'Users',
    moduleId: 'users',
    icon: 'students.svg',
    children: [
      { label: 'All Users', href: '/users', moduleId: 'users', icon: 'students.svg' },
      { label: 'Students', href: '/students', moduleId: 'students', icon: 'students.svg' },
      { label: 'Mentors ', href: '/mentors', moduleId: 'mentors', icon: 'mentors.svg' },
    ],
  },
{
  label: 'Batches',
  href:'/batches',
  moduleId: 'batches',
  icon: 'workstream.svg',
  children: [
    { label: 'Online', href: '/batches/online', moduleId: 'batches', icon: 'workstream.svg' },
    { label: 'Offline', href: '/batches/offline', moduleId: 'batches', icon: 'workstream.svg' },
  ],
},
  { label: 'My Courses', href: '/my-courses', moduleId: 'my-courses', icon: 'patch.svg' },
  { label: 'Class Materials', href: '/class-materials', moduleId: 'class-materials', icon: 'submissions.svg' },
  { label: 'Attendance', href: '/attendance', moduleId: 'attendance', icon: 'attendance.svg' },
  {
    label: 'Assignments',
    icon: 'tasks.svg',
    children: [
      { label: 'Tasks', href: '/tasks', moduleId: 'tasks', icon: 'tasks.svg' },
      { label: 'Task Submissions', href: '/task-submissions', moduleId: 'submissions', icon: 'submissions.svg' },
      { label: 'Marks', href: '/marks', moduleId: 'marks', icon: 'reviews.svg' },
    ],
  },

  { label: 'Placement', href: '/placement', moduleId: 'placement', icon: 'career.svg' },
  { label: 'Certificates', href: '/certificates', moduleId: 'certificates', icon: 'portfolio.svg' },
      { label: 'Complaints', href: '/complaints', moduleId: 'complaints', icon: 'admission.svg', lightIcon: 'admission.svg' },
      { label: 'Reports', href: '/reports', moduleId: 'reports', icon: 'analytics.svg' },
]

function getIconPath(icon: string, lightIcon: string | undefined, resolvedTheme: string | undefined) {
  const folder = resolvedTheme === 'light' ? 'light-mode' : 'dark-mode'
  const file = resolvedTheme === 'light' ? lightIcon || icon : icon
  return `/icons/${folder}/${file}`
}

function SidebarIcon({
  icon,
  lightIcon,
  alt = '',
}: {
  icon: string
  lightIcon?: string
  alt?: string
}) {
  const { resolvedTheme } = useTheme()

  return (
    <img
      src={getIconPath(icon, lightIcon, resolvedTheme)}
      alt={alt}
      className="h-5 w-5 shrink-0 object-contain"
      onError={(event) => {
        event.currentTarget.src = `/icons/dark-mode/${icon}`
      }}
    />
  )
}

function routeIsActive(pathname: string, href: string) {
  const cleanHref = href.split('?')[0]
  return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const { user, role, logout, canModule } = useDemoAuth()

  const {
    activeBranchId,
    activeBranch,
    allowedBranches,
    loading: branchesLoading,
    setActiveBranchId,
  } = useActiveBranch()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [branchOpen, setBranchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setOpenGroups({})
    setBranchOpen(false)
    setProfileOpen(false)
  }, [user?.id])

  const logoSrc = mounted && resolvedTheme === 'light' ? '/pixlpluz-dark-logo.svg' : '/pixlpluz-white-logo.svg'

  const visibleNavGroups = useMemo(() => {
    return navGroups
      .map((group) => {
        if (group.children) {
          const children = group.children.filter((child) => canModule(child.moduleId))
          return children.length ? { ...group, children } : null
        }

        return group.moduleId && canModule(group.moduleId) ? group : null
      })
      .filter(Boolean) as NavGroup[]
  }, [canModule, role])

  const publicPage = pathname === '/login' || pathname === '/'

  if (publicPage) return <>{children}</>

  const initials = (user?.fullName || 'Demo User')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const branchLabel = branchesLoading
    ? 'Loading…'
    : activeBranch?.name || (allowedBranches.length ? 'Select branch' : 'No branches')

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className={cn('flex flex-col border-r border-border bg-card transition-all duration-300', sidebarCollapsed ? 'w-16' : 'w-64')}>
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          {!sidebarCollapsed && (
            <Link href="/dashboard" className="flex items-center">
              <Image src={logoSrc} alt={APP_DISPLAY_NAME} width={140} height={40} className="h-8 w-auto object-contain" priority />
            </Link>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed((value) => !value)}
            className={cn(sidebarCollapsed && 'mx-auto')}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleNavGroups.map((group) => {
            const groupActive = group.href
  ? routeIsActive(pathname, group.href) || group.children?.some((child) => routeIsActive(pathname, child.href))
  : group.children?.some((child) => routeIsActive(pathname, child.href))

            const isOpen = Boolean(openGroups[group.label])

            if (group.children) {
              const parentHref = group.href || group.children[0]?.href || '#'

              return (
                <div key={group.label}>
                  <div
                    className={cn(
                      'flex w-full items-center gap-2 text-sm font-medium transition-colors',
                      groupActive
                        ? 'border-l-4 border-[#153e90] bg-[#153e90]/10 text-[#153e90] dark:border-[#6ee75a] dark:bg-black dark:text-white'
                        : 'border-l-4 border-transparent text-[#153e90] hover:bg-slate-100 hover:text-[#153e90] dark:text-white dark:hover:bg-black dark:hover:text-white',
                      sidebarCollapsed && 'justify-center'
                    )}
                  >
                    <Link
                      href={parentHref}
                      onClick={() => {
                        if (!sidebarCollapsed) {
                          setOpenGroups({ [group.label]: true })
                        }
                      }}
                      className={cn('flex min-w-0 flex-1 items-center gap-3 px-3 py-2', sidebarCollapsed && 'justify-center')}
                      title={sidebarCollapsed ? group.label : undefined}
                    >
                      <SidebarIcon icon={group.icon} lightIcon={group.lightIcon} alt="" />
                      {!sidebarCollapsed && <span className="flex-1 truncate text-left">{group.label}</span>}
                    </Link>

                    {!sidebarCollapsed && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          setOpenGroups((prev) => ({
                            ...prev,
                            [group.label]: !prev[group.label],
                          }))
                        }}
                        className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
                        aria-label={`${isOpen ? 'Close' : 'Open'} ${group.label}`}
                      >
                        <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
                      </button>
                    )}
                  </div>

                  {!sidebarCollapsed && isOpen && (
                    <div className="ml-6 mt-1 space-y-1 border-l border-border pl-3">
                      {group.children.map((child) => {
                        const childActive = routeIsActive(pathname, child.href)

                        return (
                          <Link
                            key={`${group.label}-${child.label}`}
                            href={child.href}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                              childActive
                                ? 'bg-[#153e90]/10 font-semibold text-[#153e90] dark:bg-white/10 dark:text-white'
                                : 'text-[#153e90]/80 hover:bg-slate-100 hover:text-[#153e90] dark:text-white/80 dark:hover:bg-black dark:hover:text-white'
                            )}
                          >
                            <SidebarIcon icon={child.icon} lightIcon={child.lightIcon} alt="" />
                            <span>{child.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={group.label}
                href={group.href || '#'}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors',
                  groupActive
                    ? 'border-l-4 border-[#153e90] bg-[#153e90]/10 text-[#153e90] dark:border-[#6ee75a] dark:bg-black dark:text-white'
                    : 'border-l-4 border-transparent text-[#153e90] hover:bg-slate-100 hover:text-[#153e90] dark:text-white dark:hover:bg-black dark:hover:text-white',
                  sidebarCollapsed && 'justify-center'
                )}
                title={sidebarCollapsed ? group.label : undefined}
              >
                <SidebarIcon icon={group.icon} lightIcon={group.lightIcon} alt="" />
                {!sidebarCollapsed && <span>{group.label}</span>}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-border p-3">
          {canModule('settings') && (
            <Link
              href="/settings"
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm font-medium text-[#153e90] transition-colors hover:bg-slate-100 dark:text-white dark:hover:bg-black',
                routeIsActive(pathname, '/settings') &&
                  'border-l-4 border-[#153e90] bg-[#153e90]/10 pl-2 text-[#153e90] dark:border-[#6ee75a] dark:bg-black dark:text-white',
                sidebarCollapsed && 'justify-center'
              )}
              title={sidebarCollapsed ? 'Settings' : undefined}
            >
              <Settings className="h-5 w-5" />
              {!sidebarCollapsed && <span>Settings</span>}
            </Link>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6">
          <p className="hidden text-sm text-muted-foreground md:block">
            {APP_DISPLAY_NAME} · Active branch:{' '}
            <strong className="text-foreground">{branchLabel}</strong>
            {activeBranch?.code ? (
              <span className="ml-1 text-xs text-muted-foreground">({activeBranch.code})</span>
            ) : null}
          </p>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBranchOpen((prev) => !prev)}
                className="gap-2"
                disabled={branchesLoading || allowedBranches.length === 0}
              >
                Branch: {branchLabel}
                <ChevronDown className={cn('h-4 w-4 transition-transform', branchOpen && 'rotate-180')} />
              </Button>

              {branchOpen && allowedBranches.length > 0 && (
                <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden border border-border bg-card shadow-xl">
                  {allowedBranches.map((branch) => (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => {
                        setActiveBranchId(branch.id)
                        setBranchOpen(false)
                      }}
                      className={cn(
                        'block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-muted',
                        activeBranch?.id === branch.id && 'bg-[#153e90]/10 font-semibold text-[#153e90] dark:bg-white/10 dark:text-white'
                      )}
                    >
                      <span className="block truncate">{branch.name}</span>
                      {branch.code && (
                        <span className="text-xs text-muted-foreground">{branch.code}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button type="button" variant="outline" size="icon" onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}>
              {mounted && resolvedTheme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>

            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-medium text-white">
                4
              </span>
            </Button>

            <DropdownMenu open={profileOpen} onOpenChange={setProfileOpen}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 px-2 py-1.5 transition-colors hover:bg-muted">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{initials || 'U'}</AvatarFallback>
                  </Avatar>

                  <div className="hidden text-left md:block">
                    <p className="text-sm font-semibold leading-none">{user?.fullName || 'Demo User'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{user?.email || ''}</p>
                  </div>

                  <ChevronDown className="hidden h-4 w-4 opacity-70 md:block" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{initials || 'U'}</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{user?.fullName || 'Demo User'}</p>
                      <p className="truncate text-xs font-normal text-muted-foreground">{user?.email || ''}</p>
                    </div>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <PermissionGate>{children}</PermissionGate>
        </main>
      </div>
    </div>
  )
}