import { PodcastInputType } from './types'

export function safeSourceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined
  try {
    const url = new URL(value.trim())
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
      return undefined
    return url.href
  } catch {
    return undefined
  }
}

// Older transcript imports kept the source in their generated header only.
// Do not mistake a link mentioned inside an ordinary article for its source.
export function sourceUrlFor(value?: unknown) {
  if (!value || typeof value !== 'object') return undefined
  const input = value as { sourceUrl?: unknown; type?: unknown; text?: unknown }
  const explicit = safeSourceUrl(input?.sourceUrl)
  if (explicit) return explicit
  if (input?.type === PodcastInputType.Link) return safeSourceUrl(input.text)
  if (input?.type !== PodcastInputType.LongText || typeof input.text !== 'string') return undefined
  const header = input.text.slice(0, 2048)
  if (!/^(?:YouTube 视频：|B 站视频：|Vimeo 视频：|音频来源：)/.test(header)) return undefined
  return safeSourceUrl(header.match(/^(?:来源：|音频来源：)(https?:\/\/\S+)\s*$/m)?.[1])
}
