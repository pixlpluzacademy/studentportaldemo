import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import {
  courseTypeLabel,
  durationLabelByType,
  type CourseListRow,
  type CourseType,
} from '@/lib/data/courses'

export type CourseLevelColor = 'green' | 'yellow' | 'pink'

export type WorkPackage = {
  id: string
  number: string
  title: string
  duration: string
  goal: string
  skills: string[]
  tools: string[]
  practiceTasks: string[]
  finalDeliverable: string
}

export type CourseLevel = {
  id: string
  slug: string
  name: string
  color: CourseLevelColor
  summary: string
  packages: WorkPackage[]
}

export type RubricItem = {
  label: string
  value: string
}

export type CourseBlueprint = {
  id: string
  department_id: string
  department_name: string
  branch_id: string
  name: string
  course_type: CourseType
  typeLabel: string
  duration: string
  duration_months: number
  tagline: string
  description: string
  passMark: number
  status: string
  workPackages: number
  portfolioOutputs: number
  levels: CourseLevel[]
  assignments: string[]
  rubric: RubricItem[]
  tools: string[]
  outputs: string[]
}

export type WorkPackageInput = {
  level_id: string
  package_number: string
  title: string
  duration: string
  goal: string
  skills: string[]
  tools: string[]
  practice_tasks: string[]
  final_deliverable: string
}

export type OverviewUpdateInput = {
  tagline: string
  description: string
  levelSummaries: Array<{ id: string; summary: string }>
}

const DEFAULT_LEVELS: Array<{
  slug: string
  name: string
  color: CourseLevelColor
  sort_order: number
}> = [
  { slug: 'foundation', name: 'Foundation', color: 'green', sort_order: 0 },
  { slug: 'intermediate', name: 'Intermediate', color: 'yellow', sort_order: 1 },
  { slug: 'advanced', name: 'Advanced', color: 'pink', sort_order: 2 },
]

const blueprintSelect = `
  id,
  department_id,
  name,
  course_type,
  duration_months,
  description,
  tagline,
  tools,
  pass_mark,
  status,
  department:departments!inner (
    id,
    name,
    branch_id
  ),
  course_levels (
    id,
    slug,
    name,
    color,
    summary,
    sort_order,
    course_work_packages (
      id,
      package_number,
      title,
      duration,
      goal,
      skills,
      tools,
      practice_tasks,
      final_deliverable,
      sort_order
    )
  ),
  course_assignments (
    id,
    title,
    sort_order
  ),
  course_rubric_items (
    id,
    label,
    weight_label,
    sort_order
  ),
  course_portfolio_outputs (
    id,
    title,
    sort_order
  )
`

type DbWorkPackageRow = {
  id: string
  package_number: string
  title: string
  duration: string | null
  goal: string | null
  skills: string[] | null
  tools: string[] | null
  practice_tasks: string[] | null
  final_deliverable: string | null
  sort_order: number
}

type DbLevelRow = {
  id: string
  slug: string
  name: string
  color: CourseLevelColor
  summary: string | null
  sort_order: number
  course_work_packages: DbWorkPackageRow[] | null
}

type DbBlueprintRow = {
  id: string
  department_id: string
  name: string
  course_type: CourseType
  duration_months: number
  description: string | null
  tagline: string | null
  tools: string[] | null
  pass_mark: number | null
  status: string
  department: { id: string; name: string; branch_id: string } | Array<{ id: string; name: string; branch_id: string }>
  course_levels: DbLevelRow[] | null
  course_assignments: Array<{ id: string; title: string; sort_order: number }> | null
  course_rubric_items: Array<{ id: string; label: string; weight_label: string; sort_order: number }> | null
  course_portfolio_outputs: Array<{ id: string; title: string; sort_order: number }> | null
}

function unwrapDepartment(
  department: DbBlueprintRow['department'],
): { id: string; name: string; branch_id: string } {
  return Array.isArray(department) ? department[0] : department
}

function mapWorkPackage(row: DbWorkPackageRow): WorkPackage {
  return {
    id: row.id,
    number: row.package_number,
    title: row.title,
    duration: row.duration || '—',
    goal: row.goal || '—',
    skills: row.skills || [],
    tools: row.tools || [],
    practiceTasks: row.practice_tasks || [],
    finalDeliverable: row.final_deliverable || '—',
  }
}

function mapBlueprintRow(row: DbBlueprintRow): CourseBlueprint {
  const department = unwrapDepartment(row.department)
  const levels = [...(row.course_levels || [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((level) => ({
      id: level.id,
      slug: level.slug,
      name: level.name,
      color: level.color,
      summary: level.summary || '',
      packages: [...(level.course_work_packages || [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(mapWorkPackage),
    }))

  const workPackageCount = levels.reduce((sum, level) => sum + level.packages.length, 0)
  const outputs = [...(row.course_portfolio_outputs || [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => item.title)

  return {
    id: row.id,
    department_id: row.department_id,
    department_name: department.name,
    branch_id: department.branch_id,
    name: row.name,
    course_type: row.course_type,
    typeLabel: courseTypeLabel(row.course_type),
    duration: durationLabelByType[row.course_type],
    duration_months: row.duration_months,
    tagline: row.tagline || '',
    description: row.description || '',
    passMark: Number(row.pass_mark ?? 70),
    status: row.status,
    workPackages: workPackageCount,
    portfolioOutputs: outputs.length,
    levels,
    assignments: [...(row.course_assignments || [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => item.title),
    rubric: [...(row.course_rubric_items || [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({ label: item.label, value: item.weight_label })),
    tools: row.tools || [],
    outputs,
  }
}

export async function ensureCourseBlueprintLevels(
  courseId: string,
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  const { data: existing, error: readError } = await client
    .from('course_levels')
    .select('id')
    .eq('course_id', courseId)

  if (readError) {
    return { ok: false, error: readError.message }
  }

  if (existing?.length) {
    return { ok: true }
  }

  const { error: insertError } = await client.from('course_levels').insert(
    DEFAULT_LEVELS.map((level) => ({
      course_id: courseId,
      slug: level.slug,
      name: level.name,
      color: level.color,
      sort_order: level.sort_order,
      summary: '',
    })),
  )

  if (insertError) {
    return { ok: false, error: insertError.message }
  }

  return { ok: true }
}

export async function fetchCourseBlueprint(
  courseId: string,
  branchId?: string | null,
  supabase?: SupabaseClient,
): Promise<{ ok: true; course: CourseBlueprint } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  try {
    const levelsResult = await ensureCourseBlueprintLevels(courseId, client)
    if (!levelsResult.ok) {
      return levelsResult
    }

    const { data, error } = await client
      .from('courses')
      .select(blueprintSelect)
      .eq('id', courseId)
      .maybeSingle()

    if (error || !data) {
      return { ok: false, error: error?.message || 'Course not found.' }
    }

    const course = mapBlueprintRow(data as DbBlueprintRow)

    if (branchId && course.branch_id !== branchId) {
      return { ok: false, error: 'Course is not available in the selected branch.' }
    }

    return { ok: true, course }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to load course blueprint.',
    }
  }
}

export async function updateCourseOverview(
  courseId: string,
  input: OverviewUpdateInput,
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  const { error: courseError } = await client
    .from('courses')
    .update({
      tagline: input.tagline.trim() || null,
      description: input.description.trim() || null,
    })
    .eq('id', courseId)

  if (courseError) {
    return { ok: false, error: courseError.message }
  }

  for (const level of input.levelSummaries) {
    const { error } = await client
      .from('course_levels')
      .update({ summary: level.summary.trim() || null })
      .eq('id', level.id)
      .eq('course_id', courseId)

    if (error) {
      return { ok: false, error: error.message }
    }
  }

  return { ok: true }
}

export async function saveWorkPackage(
  input: WorkPackageInput,
  packageId?: string | null,
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  const payload = {
    level_id: input.level_id,
    package_number: input.package_number.trim(),
    title: input.title.trim(),
    duration: input.duration.trim() || null,
    goal: input.goal.trim() || null,
    skills: input.skills,
    tools: input.tools,
    practice_tasks: input.practice_tasks,
    final_deliverable: input.final_deliverable.trim() || null,
  }

  if (packageId) {
    const { error } = await client.from('course_work_packages').update(payload).eq('id', packageId)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }

  const { data: last } = await client
    .from('course_work_packages')
    .select('sort_order')
    .eq('level_id', input.level_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await client.from('course_work_packages').insert({
    ...payload,
    sort_order: (last?.sort_order ?? -1) + 1,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteWorkPackage(
  packageId: string,
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()
  const { error } = await client.from('course_work_packages').delete().eq('id', packageId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

async function syncSimpleCourseList(
  client: SupabaseClient,
  table: 'course_assignments' | 'course_portfolio_outputs',
  courseId: string,
  titles: string[],
) {
  const { error: deleteError } = await client.from(table).delete().eq('course_id', courseId)
  if (deleteError) return { ok: false as const, error: deleteError.message }

  const rows = titles.map((title) => title.trim()).filter(Boolean)
  if (!rows.length) return { ok: true as const }

  const { error: insertError } = await client.from(table).insert(
    rows.map((title, index) => ({
      course_id: courseId,
      title,
      sort_order: index,
    })),
  )

  if (insertError) return { ok: false as const, error: insertError.message }
  return { ok: true as const }
}

export async function updateCourseAssignments(
  courseId: string,
  titles: string[],
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()
  return syncSimpleCourseList(client, 'course_assignments', courseId, titles)
}

export async function updateCourseRubric(
  courseId: string,
  items: RubricItem[],
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()

  const { error: deleteError } = await client.from('course_rubric_items').delete().eq('course_id', courseId)
  if (deleteError) return { ok: false, error: deleteError.message }

  const rows = items.filter((item) => item.label.trim())
  if (!rows.length) return { ok: true }

  const { error: insertError } = await client.from('course_rubric_items').insert(
    rows.map((item, index) => ({
      course_id: courseId,
      label: item.label.trim(),
      weight_label: item.value.trim() || '—',
      sort_order: index,
    })),
  )

  if (insertError) return { ok: false, error: insertError.message }
  return { ok: true }
}

export async function updateCourseTools(
  courseId: string,
  tools: string[],
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()
  const { error } = await client.from('courses').update({ tools }).eq('id', courseId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function updateCoursePortfolioOutputs(
  courseId: string,
  titles: string[],
  supabase?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = supabase ?? createClient()
  return syncSimpleCourseList(client, 'course_portfolio_outputs', courseId, titles)
}

export function linesToList(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function listToLines(value: string[]) {
  return value.join('\n')
}

export function rubricToLines(items: RubricItem[]) {
  return items.map((item) => `${item.label}|${item.value}`).join('\n')
}

export function linesToRubric(value: string): RubricItem[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separated = line.match(/^(.+?)\s*[|:\-–—]\s*(.+)$/)
      if (separated) {
        return { label: separated[1].trim(), value: separated[2].trim() }
      }

      const trailingWeight = line.match(/^(.+?)\s+(\d+\s*%?)$/)
      if (trailingWeight) {
        return {
          label: trailingWeight[1].trim(),
          value: trailingWeight[2].trim().includes('%')
            ? trailingWeight[2].trim()
            : `${trailingWeight[2].trim()}%`,
        }
      }

      return { label: line, value: '—' }
    })
    .filter((item) => item.label)
}
