'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchDepartmentList, type DepartmentListRow } from '@/lib/data/departments'
import { fetchPermissionProfiles, type PermissionProfileItem } from '@/lib/data/permissions'
import {
  fetchMentorList,
  isMentorDirectoryProfile,
  MENTOR_FINAL_QA_SLUG,
  type MentorListRow,
} from '@/lib/data/mentors'
import { useBranchScope } from '@/lib/data/hooks/use-branch-scope'

export function useMentorDirectory() {
  const { activeBranchId, activeBranch, hasAllBranchAccess, loading: branchLoading } = useBranchScope()

  const [mentors, setMentors] = useState<MentorListRow[]>([])
  const [departments, setDepartments] = useState<DepartmentListRow[]>([])
  const [mentorTypeProfiles, setMentorTypeProfiles] = useState<PermissionProfileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!activeBranchId) {
      setMentors([])
      setDepartments([])
      setMentorTypeProfiles([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [mentorsResult, profilesResult, departmentsResult] = await Promise.all([
        fetchMentorList(activeBranchId),
        fetchPermissionProfiles(),
        fetchDepartmentList(activeBranchId),
      ])

      setMentors(mentorsResult.data)
      setDepartments(departmentsResult.data)
      setMentorTypeProfiles(
        profilesResult.data.filter(
          (profile) =>
            profile.parent_role_id === 'mentor' &&
            profile.status === 'active' &&
            isMentorDirectoryProfile(profile.slug),
        ),
      )

      if (mentorsResult.error) {
        setError(mentorsResult.error)
      } else if (departmentsResult.error) {
        setError(departmentsResult.error)
      } else if (profilesResult.error) {
        setError(profilesResult.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mentors.')
    } finally {
      setLoading(false)
    }
  }, [activeBranchId])

  useEffect(() => {
    if (branchLoading) return
    void reload()
  }, [branchLoading, reload])

  return {
    mentors,
    departments,
    mentorTypeProfiles,
    activeBranchId,
    activeBranch,
    hasAllBranchAccess,
    branchLoading,
    loading: loading || branchLoading,
    error,
    reload,
    finalQaSlug: MENTOR_FINAL_QA_SLUG,
  }
}
