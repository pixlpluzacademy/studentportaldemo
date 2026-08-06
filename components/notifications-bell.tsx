'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  deleteAllNotifications,
  fetchMyNotificationCount,
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/lib/data/notifications'

function formatNotificationTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString()
}

export function NotificationsBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<AppNotification[]>([])
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')

    const [countResult, listResult] = await Promise.all([
      fetchMyNotificationCount(),
      fetchMyNotifications(),
    ])

    if (countResult.error || listResult.error) {
      setError(countResult.error || listResult.error || 'Failed to load notifications.')
    }

    setCount(countResult.data)
    setItems(listResult.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (open) {
      void refresh()
    }
  }, [open, refresh])

  const handleMarkAllRead = async () => {
    setActing(true)
    const result = await markAllNotificationsRead()
    if (!result.ok) {
      setError(result.error)
    }
    await refresh()
    setActing(false)
  }

  const handleDeleteAll = async () => {
    setActing(true)
    const result = await deleteAllNotifications()
    if (!result.ok) {
      setError(result.error)
    }
    await refresh()
    setActing(false)
  }

  const handleItemClick = async (item: AppNotification) => {
    if (!item.readAt) {
      await markNotificationRead(item.id)
      await refresh()
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-medium text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <DropdownMenuLabel className="p-0">Notifications ({count})</DropdownMenuLabel>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={acting || count === 0}
              onClick={() => void handleMarkAllRead()}
            >
              Mark all read
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-500 hover:text-red-500"
              disabled={acting || count === 0}
              onClick={() => void handleDeleteAll()}
            >
              Delete all
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator className="m-0" />

        <div className="max-h-80 overflow-y-auto">
          {loading && items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading...</p>
          ) : error ? (
            <p className="px-3 py-6 text-center text-sm text-red-500">{error}</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications</p>
          ) : (
            items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className={cn(
                  'cursor-pointer items-start gap-2 rounded-none px-3 py-3',
                  !item.readAt && 'bg-[#153e90]/5 dark:bg-white/5',
                )}
                onSelect={(event) => {
                  event.preventDefault()
                  void handleItemClick(item)
                  if (item.href) {
                    setOpen(false)
                    router.push(item.href)
                  }
                }}
              >
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    item.readAt ? 'bg-transparent' : 'bg-red-500',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm', !item.readAt && 'font-semibold')}>{item.title}</p>
                  {item.body ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatNotificationTime(item.createdAt)}
                  </p>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
