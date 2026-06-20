import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataResult } from '@/lib/data/config'
import { createClient } from '@/lib/supabase/client'
import { fetchStudentIdByProfileId } from '@/lib/data/tasks'

export type MentorRatingRow = {
  id: string
  mentorId: string
  batchId: string
  branchId: string
  rating: number
}

export type MentorRatingSummary = {
  averageRating: string
  totalRatings: number
  distribution: Record<string, number>
}

type DbMentorRatingRow = {
  id: string
  mentor_id: string
  batch_id: string
  branch_id: string
  rating: number
}

export async function fetchStudentMentorRatings(
  profileId: string,
  supabase?: SupabaseClient,
): Promise<DataResult<MentorRatingRow[]>> {
  const client = supabase ?? createClient()

  try {
    const studentId = await fetchStudentIdByProfileId(profileId, client)

    if (!studentId) {
      return { source: 'supabase', data: [] }
    }

    const { data, error } = await client
      .from('mentor_ratings')
      .select('id, mentor_id, batch_id, branch_id, rating')
      .eq('student_id', studentId)

    if (error) {
      return { source: 'supabase', data: [], error: error.message }
    }

    return {
      source: 'supabase',
      data: ((data || []) as DbMentorRatingRow[]).map((row) => ({
        id: row.id,
        mentorId: row.mentor_id,
        batchId: row.batch_id,
        branchId: row.branch_id,
        rating: row.rating,
      })),
    }
  } catch (error) {
    return {
      source: 'supabase',
      data: [],
      error: error instanceof Error ? error.message : 'Failed to load ratings.',
    }
  }
}

export async function fetchMyMentorRatingSummary(
  supabase?: SupabaseClient,
): Promise<DataResult<MentorRatingSummary>> {
  const client = supabase ?? createClient()

  try {
    const { data, error } = await client.rpc('get_my_mentor_rating_summary')

    if (error) {
      return {
        source: 'supabase',
        data: { averageRating: '—', totalRatings: 0, distribution: {} },
        error: error.message,
      }
    }

    const payload = (data || {}) as {
      average_rating?: number | null
      total_ratings?: number
      distribution?: Record<string, number>
    }

    return {
      source: 'supabase',
      data: {
        averageRating:
          payload.average_rating === null || payload.average_rating === undefined
            ? '—'
            : Number(payload.average_rating).toFixed(1),
        totalRatings: payload.total_ratings || 0,
        distribution: payload.distribution || {},
      },
    }
  } catch (error) {
    return {
      source: 'supabase',
      data: { averageRating: '—', totalRatings: 0, distribution: {} },
      error: error instanceof Error ? error.message : 'Failed to load rating summary.',
    }
  }
}

export async function submitMentorRating(
  input: {
    mentorId: string
    batchId: string
    branchId: string
    rating: number
  },
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch('/api/admin/mentor-ratings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const payload = (await response.json()) as { error?: string }

  if (!response.ok) {
    return { ok: false, error: payload.error || 'Failed to save rating.' }
  }

  return { ok: true }
}

export async function deleteMentorRating(ratingId: string, accessToken: string): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`/api/admin/mentor-ratings?id=${encodeURIComponent(ratingId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const payload = (await response.json()) as { error?: string }

  if (!response.ok) {
    return { ok: false, error: payload.error || 'Failed to remove rating.' }
  }

  return { ok: true }
}
