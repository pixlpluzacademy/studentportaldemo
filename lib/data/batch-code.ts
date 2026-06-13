export type BatchModeCode = 'online' | 'offline'

/** UI label for offline batches (code uses OS). */
export const BATCH_MODE_ONSITE_LABEL = 'Onsite'

export function getBatchModeCode(mode: BatchModeCode): 'ON' | 'OS' {
  return mode === 'online' ? 'ON' : 'OS'
}

export function formatMonthYearForBatchCode(dateValue: string): string {
  if (!dateValue) return ''

  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)

  return `${month}${year}`
}

export function normalizeBatchCodePart(value: string | null | undefined, fallback = ''): string {
  return String(value || fallback)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

/**
 * Build batch code prefix: {BRANCH}{DEPT}{ON|OS}{MMYY}
 * Example: KOC + WD + ON + 0626 => KOCWDON0626
 */
export function buildBatchCodePrefix(input: {
  branchCode: string
  departmentCode: string
  mode: BatchModeCode
  startDate: string
}): string {
  const branchCode = normalizeBatchCodePart(input.branchCode)
  const departmentCode = normalizeBatchCodePart(input.departmentCode)
  const modeCode = getBatchModeCode(input.mode)
  const monthYearCode = formatMonthYearForBatchCode(input.startDate)

  if (!branchCode || !departmentCode || !monthYearCode) {
    return ''
  }

  return `${branchCode}${departmentCode}${modeCode}${monthYearCode}`
}

/** Append series suffix: B1, B2, ... */
export function appendBatchSeries(prefix: string, seriesNumber: number): string {
  if (!prefix || seriesNumber < 1) return ''
  return `${prefix}B${seriesNumber}`
}

/** Count existing codes matching prefix and return next B# (client preview only). */
export function getNextBatchSeriesNumber(existingCodes: string[], prefix: string): number {
  if (!prefix) return 1

  let maxSeries = 0

  for (const code of existingCodes) {
    if (!code.startsWith(prefix)) continue

    const match = code.match(/B(\d+)$/)
    if (!match) continue

    const value = Number(match[1])
    if (!Number.isNaN(value) && value > maxSeries) {
      maxSeries = value
    }
  }

  return maxSeries + 1
}

export function buildBatchCodePreview(input: {
  branchCode: string
  departmentCode: string
  mode: BatchModeCode
  startDate: string
  existingCodes?: string[]
}): string {
  const prefix = buildBatchCodePrefix(input)
  if (!prefix) return ''

  const series = getNextBatchSeriesNumber(input.existingCodes || [], prefix)
  return appendBatchSeries(prefix, series)
}

export function buildBatchSchedule(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return ''
  return `${startTime}-${endTime}`
}

export function parseBatchSchedule(schedule: string | null | undefined): {
  batch_start_time: string | null
  batch_end_time: string | null
} {
  if (!schedule?.trim()) {
    return { batch_start_time: null, batch_end_time: null }
  }

  const [start, end] = schedule.split('-').map((part) => part.trim())
  return {
    batch_start_time: start || null,
    batch_end_time: end || null,
  }
}
