#!/usr/bin/env node
/** Recover files from Cursor agent transcript JSONL by replaying Write/StrReplace ops. */

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

const EXPLICIT_TARGETS = new Set([
  'app/api/admin/tasks/route.ts',
  'app/api/admin/task-submissions/route.ts',
  'app/api/admin/class-materials/route.ts',
  'app/api/admin/attendance/route.ts',
  'app/api/admin/complaints/route.ts',
  'app/api/admin/mentor-ratings/route.ts',
  'app/task-submissions/submit/[taskId]/page.tsx',
])

const STUDENT_PREFIX = 'app/api/student/'

const NO_RESUBMIT_PATHS = new Set([
  'app/api/admin/task-submissions/route.ts',
  'app/task-submissions/submit/[taskId]/page.tsx',
])

const RESUBMIT_MARKERS = [
  'handleResubmit',
  'canStudentResubmit',
  'resubmitTask',
  'submission_history',
  'resubmit_deadline',
  'studentCanResubmit',
  'SubmissionHistoryEntry',
  'useSearchParams',
  "type: 'initial' | 'resubmit'",
  'isResubmitMode',
  'resubmit mode',
]

function normalizePath(raw) {
  if (!raw) return null
  let p = raw.replace(/\\/g, '/')
  const prefixes = [
    'd:/work/projects/latheif productions/pixel pluz/software/pixlpluzportal/',
  ]
  const lower = p.toLowerCase()
  for (const prefix of prefixes) {
    if (lower.startsWith(prefix)) {
      p = p.slice(prefix.length)
      break
    }
  }
  const m = p.match(/pixlpluzportal[/\\](.+)$/i)
  if (m) p = m[1]
  return p.replace(/\\/g, '/').replace(/^\//, '')
}

function isTargetPath(rel) {
  if (EXPLICIT_TARGETS.has(rel)) return true
  if (rel.startsWith(STUDENT_PREFIX) && rel.endsWith('.ts')) return true
  return false
}

function hasResubmitContent(content) {
  return RESUBMIT_MARKERS.some((m) => content.includes(m))
}

function applyStrReplace(content, oldStr, newStr) {
  if (content == null) return null
  if (!content.includes(oldStr)) return content
  return content.replace(oldStr, newStr)
}

function isRevertShellLine(obj) {
  try {
    const content = obj?.message?.content
    if (!Array.isArray(content)) return false
    for (const block of content) {
      if (block?.type !== 'tool_use' || block?.name !== 'Shell') continue
      const cmd = block?.input?.command || ''
      if (cmd.includes('Remove-Item') && cmd.includes('app/api/admin/tasks')) return true
    }
  } catch {
    /* ignore */
  }
  return false
}

function extractToolOps(obj, lineNo) {
  const ops = []
  const content = obj?.message?.content
  if (!Array.isArray(content)) return ops
  for (const block of content) {
    if (block?.type !== 'tool_use') continue
    const name = block?.name
    if (name !== 'Write' && name !== 'StrReplace') continue
    const inp = block?.input || {}
    const rel = normalizePath(inp.path || '')
    if (!rel || !isTargetPath(rel)) continue
    ops.push({
      line: lineNo,
      tool: name,
      path: rel,
      contents: inp.contents,
      old_string: inp.old_string,
      new_string: inp.new_string,
    })
  }
  return ops
}

async function main() {
  if (!fs.existsSync(TRANSCRIPT)) {
    console.error(`ERROR: Transcript not found: ${TRANSCRIPT}`)
    process.exit(1)
  }

  /** @type {Record<string, string|null>} */
  const files = {}
  /** @type {Record<string, string>} */
  const noResubmit = {}
  /** @type {Record<string, number>} */
  const lastLine = {}
  /** @type {Array<object>} */
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

    if (isRevertShellLine(obj)) {
      revertLine = lineNo
      break
    }

    for (const op of extractToolOps(obj, lineNo)) {
      allOps.push(op)
    }
  }

  for (const op of allOps) {
    const rel = op.path
    if (op.tool === 'Write' && op.contents != null) {
      files[rel] = op.contents
      lastLine[rel] = op.line
      if (NO_RESUBMIT_PATHS.has(rel) && !hasResubmitContent(op.contents)) {
        noResubmit[rel] = op.contents
      }
    } else if (op.tool === 'StrReplace') {
      const updated = applyStrReplace(files[rel], op.old_string, op.new_string)
      if (updated != null) {
        files[rel] = updated
        lastLine[rel] = op.line
        if (NO_RESUBMIT_PATHS.has(rel) && !hasResubmitContent(updated)) {
          noResubmit[rel] = updated
        }
      }
    }
  }

  const discovered = [...new Set(allOps.map((o) => o.path).filter((p) => p.startsWith(STUDENT_PREFIX)))].sort()
  const targets = new Set([...EXPLICIT_TARGETS, ...discovered])

  const written = []
  const failed = []
  const skippedResubmit = []

  for (const rel of [...targets].sort()) {
    let content
    if (NO_RESUBMIT_PATHS.has(rel) && noResubmit[rel]) {
      content = noResubmit[rel]
      if (files[rel] && hasResubmitContent(files[rel])) skippedResubmit.push(rel)
    } else if (files[rel] != null) {
      content = files[rel]
    } else {
      failed.push(rel)
      continue
    }

    const outPath = path.join(WORKSPACE, ...rel.split('/'))
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, content.replace(/\r?\n/g, '\n'), 'utf8')
    written.push(rel)
  }

  console.log('=== Recovery Report ===')
  console.log(`Transcript lines processed: ${revertLine ?? 'all'}`)
  console.log(`Total tool ops matched: ${allOps.length}`)
  console.log(`Discovered student routes: ${discovered.length ? discovered.join(', ') : '(none)'}`)
  console.log('')
  console.log(`Successfully written (${written.length}):`)
  for (const p of written) {
    const note = skippedResubmit.includes(p) ? ' [used pre-resubmit version]' : ''
    console.log(`  - ${p} (last op ~line ${lastLine[p] ?? '?'})${note}`)
  }
  console.log('')
  if (failed.length) {
    console.log(`Could NOT recover (${failed.length}):`)
    for (const p of failed) console.log(`  - ${p}`)
  } else {
    console.log('Could NOT recover: (none)')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
