import type { TimedScriptItem } from './finalize_mp3'
export function parseSubtitles(input: string): TimedScriptItem[] {
  if (input.length > 100000) throw new Error('字幕最多支持 10 万字符')
  if (!input.trim()) return []
  const lines: TimedScriptItem[] = []
  if (input.includes('-->')) {
    for (const block of input.trim().split(/\r?\n\s*\r?\n/)) {
      const rows = block.split(/\r?\n/)
      const index = rows.findIndex((r) => r.includes('-->'))
      const m = rows[index]?.match(/^(\d+):(\d{2}):(\d{2})[,.](\d{3})\s*-->/)
      if (!m) throw new Error('SRT 时间格式无效')
      const text = rows
        .slice(index + 1)
        .join(' ')
        .trim()
      if (text)
        lines.push({
          role: '讲述',
          text,
          startMs: (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000 + Number(m[4]),
        })
    }
  } else {
    for (const row of input.split(/\r?\n/)) {
      const matches = [...row.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
      const text = row.replace(/\[[^\]]*\]/g, '').trim()
      for (const m of matches)
        if (text)
          lines.push({
            role: '讲述',
            text,
            startMs:
              (Number(m[1]) * 60 + Number(m[2])) * 1000 + Number((m[3] || '').padEnd(3, '0')),
          })
    }
  }
  if (!lines.length) throw new Error('未识别到带时间的 LRC / SRT 字幕；请附带时间戳')
  if (lines.length > 5000) throw new Error('字幕最多支持 5000 段')
  return lines.sort((a, b) => a.startMs - b.startMs)
}
export function toSrt(lines: TimedScriptItem[], duration: number): string {
  const time = (ms: number) => {
    const n = Math.max(0, Math.round(ms))
    return `${String(Math.floor(n / 3600000)).padStart(2, '0')}:${String(Math.floor(n / 60000) % 60).padStart(2, '0')}:${String(Math.floor(n / 1000) % 60).padStart(2, '0')},${String(n % 1000).padStart(3, '0')}`
  }
  return lines
    .map(
      (l, i) =>
        `${i + 1}\n${time(l.startMs)} --> ${time(lines[i + 1]?.startMs ?? Math.max(l.startMs + 1, duration * 1000))}\n${l.role}: ${l.text}\n`
    )
    .join('\n')
}
