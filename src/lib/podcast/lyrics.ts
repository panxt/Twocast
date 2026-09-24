import type { TimedScriptItem } from './finalize_mp3'

export function toLrc(lines: TimedScriptItem[], title: string): string {
  const safeTitle = title.replace(/[\r\n[\]]/g, ' ').trim()
  const body = lines.map(line => {
    const totalCentiseconds = Math.max(0, Math.floor(line.startMs / 10))
    const minutes = Math.floor(totalCentiseconds / 6000)
    const seconds = Math.floor(totalCentiseconds / 100) % 60
    const hundredths = totalCentiseconds % 100
    const time = `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}]`
    return `${time}${line.role}: ${line.text.replace(/[\r\n]+/g, ' ')}`
  })
  return [`[ti:${safeTitle}]`, '[ar:ToCast]', ...body].join('\n') + '\n'
}
