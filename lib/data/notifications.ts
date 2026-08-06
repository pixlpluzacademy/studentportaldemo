import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataResult } from '@/lib/data/config'
import { createClient } from '@/lib/supabase/client'

export type AppNotification = {
  id: string
  userId: string
  title: string
  body: string | null
  href: string | null
  readAt: string | null
  createdAt: string
}

type DbNotification = {
  id: string
  user_id: string
  title: string
  body: string | null
  href: string | null
  read_at: string | null
  created_at: string
}

function mapNotification(row: DbNotification): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

export async function fetchMyNotifications(
  supabase?: SupabaseClient,
): Promise<DataResult<AppNotification[]>> {
  const client = supabase ?? createClient()

  try {
    const { data, error } = await client
      .from('notifications')
      .select('id, user_id, title, body, href, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return { source: 'supabase', data: [], error: error.message }
    }

    return {
      source: 'supabase',
      data: ((data || []) as DbNotification[]).map(mapNotification),
    }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load notifications.',
    }
  }
}

export async function fetchMyNotificationCount(
  supabase?: SupabaseClient,
): Promise<DataResult<number>> {
  const client = supabase ?? createClient()

  try {
    const { count, error } = await client
      .from('notifications')
      .select('id', { count: 'exact', head: true })

    if (error) {
      return { source: 'supabase', data: 0, error: error.message }
    }

    return { source: 'supabase', data: count || 0 }
  } catch (error) {
    return {
      source: 'supabase',
      data: 0,
      error: error instanceof Error ? error.message : 'Failed to load notification count.',
    }
  }
}

export async function markAllNotificationsRead(
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  try {
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser()

    if (userError || !user) {
      return { ok: false, error: 'Not authenticated.' }
    }

    const { error } = await client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null)

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to mark notifications as read.',
    }
  }
}

export async function deleteAllNotifications(
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  try {
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser()

    if (userError || !user) {
      return { ok: false, error: 'Not authenticated.' }
    }

    const { error } = await client.from('notifications').delete().eq('user_id', user.id)

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to delete notifications.',
    }
  }
}

export async function markNotificationRead(
  notificationId: string,
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  try {
    const { error } = await client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to mark notification as read.',
    }
  }
}
