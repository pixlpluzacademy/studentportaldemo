import fs from 'fs'

const TRANSCRIPT =
  'C:/Users/laksh/.cursor/projects/d-Work-Projects-Latheif-Productions-Pixel-Pluz-Software-pixlpluzportal/agent-transcripts/ca00464f-795f-4a27-bf61-556dff566421/ca00464f-795f-4a27-bf61-556dff566421.jsonl'

const lines = fs.readFileSync(TRANSCRIPT, 'utf8').split(/\r?\n/)
const paths = []

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  if (!line.trim()) continue
  let obj
  try {
    obj = JSON.parse(line)
  } catch {
    continue
  }
  const content = obj?.message?.content || []
  for (const b of content) {
    if (b?.type !== 'tool_use') continue
    if (b.name !== 'Write' && b.name !== 'StrReplace') continue
    const p = (b.input?.path || '').replace(/\\/g, '/')
    if (
      /student|mentor-rating|complaint|attendance|class-material|task-submission|tasks\/route/i.test(
        p,
      )
    ) {
      paths.push(`${i + 1}: ${b.name} ${p}`)
    }
  }
}

console.log(paths.join('\n'))
