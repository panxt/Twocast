import { sourceUrlFor } from './source'

export function sourceTextFor(task: {
  userInputs?: unknown
  stepsDetail?: unknown
}): string | null {
  if (!sourceUrlFor(task.userInputs)) return null
  const input = task.userInputs as { type?: string; text?: unknown } | null
  const steps = task.stepsDetail as Record<string, { input?: unknown }> | null
  const text = input?.type === 'long-text' ? input.text : steps?.['long-text']?.input
  return typeof text === 'string' && text.trim() ? text : null
}

export function sourceTextInfo(text: string) {
  const seconds = Number(text.match(/^字幕覆盖至：([\d.]+) 秒/m)?.[1])
  const times = [...text.matchAll(/^\[(\d+):(\d{2})\]/gm)].map(
    (m) => Number(m[1]) * 60 + Number(m[2])
  )
  const end =
    Number.isFinite(seconds) && seconds > 0 ? seconds : times.length ? Math.max(...times) : null
  const minutes =
    end === null
      ? null
      : `${Math.floor(end / 60)}:${Math.floor(end % 60)
          .toString()
          .padStart(2, '0')}`
  return {
    characters: text.length,
    language: text.match(/^字幕语言：([^\r\n]+)/m)?.[1] || null,
    coverage: minutes,
  }
}
