/** Demo batch id → branch id mapping when seed batches are shown across branches. */
export function demoBatchBranchMap(branchNavIds: string[]): Record<string, string> {
  const primaryBranchId = branchNavIds[0] || 'b1'
  const secondaryBranchId = branchNavIds[1] || primaryBranchId

  return {
    ba1: primaryBranchId,
    ba2: primaryBranchId,
    ba3: secondaryBranchId,
  }
}

export function matchesActiveBranch(
  recordBranchId: string | null | undefined,
  activeBranchId: string | null,
): boolean {
  if (!activeBranchId) return true
  if (!recordBranchId) return false
  return recordBranchId === activeBranchId
}

export function filterByActiveBranch<T>(
  items: T[],
  getBranchId: (item: T) => string | null | undefined,
  activeBranchId: string | null,
): T[] {
  if (!activeBranchId) return items
  return items.filter((item) => matchesActiveBranch(getBranchId(item), activeBranchId))
}

export function filterByBatchNames<T>(
  items: T[],
  getBatchName: (item: T) => string,
  batchNames: string[],
): T[] {
  if (!batchNames.length) return []
  return items.filter((item) => batchNames.includes(getBatchName(item)))
}

export function demoBatchNamesForBranch(
  branchNavIds: string[],
  activeBranchId: string | null,
): string[] {
  const map = demoBatchBranchMap(branchNavIds)
  const demoBatchNames = ['DM Morning Batch', 'Web Evening Batch', '3D Weekend Batch']

  if (!activeBranchId) {
    return demoBatchNames
  }

  return demoBatchNames.filter((_, index) => {
    const batchId = `ba${index + 1}`
    return map[batchId] === activeBranchId
  })
}
