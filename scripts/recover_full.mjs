#!/usr/bin/env node
/**
 * Replay Write/StrReplace ops from agent transcript before the revert shell command.
 * Restores lib/data, pages, API routes, migrations from today's session.
 * Skips resubmit-only migration 30 and prefers pre-resubmit versions where marked.
 */

import fs from 'fs'
import path from 'path'
import readline from 'readline'

const TRANSCRIPT = path.join(
  'C:',
  'Users',
  'laksh',
  '.cursor',
  'projects',
  'd-Work-Projects-Latheif-Productions-Pixel-Pluz-Software-pixlpluzportal',
  'agent-transcripts',
  'ca00464f-795f-4a27-bf61-556dff566421',
  'ca00464f-795f-4a27-bf61-556dff566421.jsonl',
)
const WORKSPACE = path.join(
  'd:',
  'Work',
  'Projects',
  'Latheif Productions',
  'Pixel Pluz',
  'Software',
  'pixlpluzportal',
)

const RESUBMIT_MARKERS = [
  'handleResubmit',
  'canStudentResubmit',
  'resubmitTask',
  'submission_history',
  'resubmit_deadline',
  'studentCanResubmit',
  'SubmissionHistoryEntry',
  'isResubmitMode',
  "type: 'initial' | 'resubmit'",
]

const NO_RESUBMIT_PATHS = new Set([
  'app/api/admin/task-submissions/route.ts',
  'app/task-submissions/submit/[taskId]/page.tsx',
  'lib/data/task-submissions.ts',
  'app/task-submissions/[id]/page.tsx',
  'app/task-submissions/page.tsx',
  'lib/data/tasks.ts',
  'app/tasks/page.tsx',
])

const SKIP_PATHS = new Set([
  'supabase/migrations/20250609000030_task_submission_resubmit_history.sql',
])

const PREFIXES = [
  'lib/data/',
  'app/api/admin/',
  'app/api/student/',
  'app/tasks/',
  'app/task-submissions/',
  'app/class-materials/',
  'app/my-courses/',
  'app/attendance/',
  'app/complaints/',
  'app/settings/page.tsx',
  'supabase/migrations/20250609000019_',
  'supabase/migrations/20250609000020_',
  'supabase/migrations/20250609000021_',
  'supabase/migrations/20250609000022_',
  'supabase/migrations/20250609000023_',
  'supabase/migrations/20250609000024_',
  'supabase/migrations/20250609000025_',
  'supabase/migrations/20250609000026_',
  'supabase/migrations/20250609000027_',
  'supabase/migrations/20250609000028_',
  'supabase/migrations/20250609000029_',
  'supabase/migrations/20250609000031_',
]

function normalizePath(raw) {
  if (!raw) return null
  let p = raw.replace(/\\/g, '/')
  const prefix = 'd:/work/projects/latheif productions/pixel pluz/software/pixlpluzportal/'
  if (p.toLowerCase().startsWith(prefix)) p = p.slice(prefix.length)
  const m = p.match(/pixlpluzportal[/\\](.+)$/i)
  if (m) p = m[1]
  return p.replace(/\\/g, '/').replace(/^\//, '')
}

function isTarget(rel) {
  if (!rel || SKIP_PATHS.has(rel)) return false
  if (rel.startsWith('scripts/')) return false
  return PREFIXES.some((pre) => rel.startsWith(pre) || rel === pre)
}

function hasResubmit(content) {
  return RESUBMIT_MARKERS.some((m) => content.includes(m))
}

function readSeedContent(rel) {
  const outPath = path.join(WORKSPACE, ...rel.split('/'))
  if (!fs.existsSync(outPath)) return null
  try {
    return fs.readFileSync(outPath, 'utf8')
  } catch {
    return null
  }
}

function applyStrReplace(content, oldStr, newStr) {
  if (content == null) return null
  if (!content.includes(oldStr)) return content
  return content.replace(oldStr, newStr)
}

function isRevertShell(obj) {
  const content = obj?.message?.content
  if (!Array.isArray(content)) return false
  for (const block of content) {
    if (block?.type !== 'tool_use' || block?.name !== 'Shell') continue
    const cmd = block?.input?.command || ''
    if (cmd.includes('Remove-Item') && cmd.includes('app/api/admin/tasks')) return true
  }
  return false
}

function extractOps(obj, lineNo) {
  const ops = []
  const content = obj?.message?.content
  if (!Array.isArray(content)) return ops
  for (const block of content) {
    if (block?.type !== 'tool_use') continue
    if (block.name !== 'Write' && block.name !== 'StrReplace') continue
    const inp = block.input || {}
    const rel = normalizePath(inp.path || '')
    if (!rel || !isTarget(rel)) continue
    ops.push({
      line: lineNo,
      tool: block.name,
      path: rel,
      contents: inp.contents,
      old_string: inp.old_string,
      new_string: inp.new_string,
    })
  }
  return ops
}

async function main() {
  const files = {}
  const preResubmit = {}
  const lastLine = {}
  const allOps = []
  let revertLine = null

  const rl = readline.createInterface({
    input: fs.createReadStream(TRANSCRIPT, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  let lineNo = 0
  for await (const line of rl) {
    lineNo++
    const trimmed = line.trim()
    if (!trimmed) continue
    let obj
    try {
      obj = JSON.parse(trimmed)
    } catch {
      continue
    }
    if (isRevertShell(obj)) {
      revertLine = lineNo
      break
    }
    for (const op of extractOps(obj, lineNo)) allOps.push(op)
  }

  for (const op of allOps) {
    const rel = op.path
    if (op.tool === 'Write' && op.contents != null) {
      files[rel] = op.contents
      lastLine[rel] = op.line
      if (NO_RESUBMIT_PATHS.has(rel) && !hasResubmit(op.contents)) {
        preResubmit[rel] = op.contents
      }
    } else if (op.tool === 'StrReplace') {
      if (files[rel] == null) {
        files[rel] = readSeedContent(rel) ?? ''
      }
      const updated = applyStrReplace(files[rel], op.old_string, op.new_string)
      if (updated != null) {
        files[rel] = updated
        lastLine[rel] = op.line
        if (NO_RESUBMIT_PATHS.has(rel) && !hasResubmit(updated)) {
          preResubmit[rel] = updated
        }
      }
    }
  }

  const targets = new Set(
    [...Object.keys(files), ...allOps.map((op) => op.path)].filter((rel) => isTarget(rel)),
  )
  const written = []
  const skipped = []

  for (const rel of [...targets].sort()) {
    let content
    if (NO_RESUBMIT_PATHS.has(rel) && preResubmit[rel]) {
      content = preResubmit[rel]
      if (files[rel] && hasResubmit(files[rel]) && files[rel] !== preResubmit[rel]) {
        skipped.push(`${rel} (used pre-resubmit)`)
      }
    } else {
      content = files[rel]
    }
    if (!content) continue
    if (!lastLine[rel] && !preResubmit[rel]) continue

    const outPath = path.join(WORKSPACE, ...rel.split('/'))
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, content.replace(/\r?\n/g, '\n'), 'utf8')
    written.push(rel)
  }

  console.log(`Processed through line ${revertLine ?? 'EOF'}`)
  console.log(`Ops: ${allOps.length}, Written: ${written.length}`)
  if (skipped.length) {
    console.log('Pre-resubmit versions:')
    skipped.forEach((s) => console.log(`  ${s}`))
  }
  console.log('\nFiles:')
  written.forEach((p) => console.log(`  ${p}`))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
