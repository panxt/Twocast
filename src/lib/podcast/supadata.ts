import axios from 'axios'
import { INPUT_MAX_CHARACTERS } from './limits'
import { mediaClient, timedLine } from './media-client'

// This service is platform-owned, independent of members' LLM/TTS credentials.
export async function youtubeFallback(videoId: string, freeError: string): Promise<string> {
  const { getSettings } = await import('@/lib/settings')
  const config = await getSettings(['SUPADATA_API_KEY', 'SUPADATA_ENABLED'])
  if (config.SUPADATA_ENABLED !== '1' || !config.SUPADATA_API_KEY)
    throw new Error(`${freeError} 第三方字幕兜底尚未启用或配置，请联系管理员。`)
  return supadataTranscript(videoId, config.SUPADATA_API_KEY)
}

export async function supadataTranscript(videoId: string, apiKey: string): Promise<string> {
  if (!/^[\w-]{11}$/.test(videoId)) throw new Error('无效的 YouTube 视频编号')
  const source = `https://www.youtube.com/watch?v=${videoId}`
  try {
    const client = mediaClient()
    const response = await client.get('https://api.supadata.ai/v1/transcript', {
      timeout: 30_000,
      maxContentLength: 2_000_000,
      responseType: 'json',
      headers: { 'x-api-key': apiKey },
      params: { url: source, text: false, mode: 'native', lang: 'en' },
      validateStatus: () => true,
    })
    if (response.status === 401)
      throw new Error('第三方字幕 API Key 无效，请管理员检查 Supadata 配置。')
    if (
      response.status === 402 ||
      (response.status === 403 && /credit|quota|limit/i.test(JSON.stringify(response.data)))
    )
      throw new Error('第三方字幕额度不足，请管理员检查 Supadata 余额；也可手动粘贴文字稿。')
    if (response.status === 429)
      throw new Error('第三方字幕服务请求过于频繁或额度已用完，请稍后重试或联系管理员。')
    if (response.status !== 200)
      throw new Error(
        '免费提取和第三方字幕兜底均未取得正文。请在 YouTube 复制文字稿到「长文本」；私有或受限视频可能无法读取。'
      )
    const segments = Array.isArray(response.data?.content) ? response.data.content : []
    const lines = segments.filter(
      (segment: any) =>
        typeof segment.text === 'string' &&
        segment.text.trim() &&
        Number.isFinite(segment.offset) &&
        segment.offset >= 0 &&
        Number.isFinite(segment.duration) &&
        segment.duration >= 0
    )
    if (segments.length && lines.length !== segments.length)
      throw new Error('第三方字幕时间数据不完整，请稍后重试或手动导入文字稿。')
    const text = lines.length
      ? lines.map((line: any) => timedLine(line.offset / 1000, line.text)).join('\n')
      : typeof response.data?.content === 'string'
        ? response.data.content.trim()
        : ''
    if (text.length < 80)
      throw new Error('第三方字幕服务未返回完整文字稿，请复制原视频文字稿到「长文本」。')
    if (text.length > INPUT_MAX_CHARACTERS - 300)
      throw new Error('视频文字稿超过 10 万字符，请分段粘贴生成。')
    const language =
      typeof response.data?.lang === 'string' ? response.data.lang.slice(0, 30) : '原语言'
    const endMs = lines.reduce(
      (end: number, line: any) => Math.max(end, line.offset + line.duration),
      0
    )
    const coverage = lines.length
      ? `字幕段数：${lines.length}\n字幕覆盖至：${(endMs / 1000).toFixed(2)} 秒\n`
      : ''
    return `YouTube 视频：${videoId}\n来源：${source}\n以下为视频字幕正文：\n提取服务：Supadata（已有字幕）\n字幕语言：${language}\n${coverage}${text}`
  } catch (error) {
    // Never return Axios config (which includes the credential) or vendor payloads.
    if (axios.isAxiosError(error))
      throw new Error('第三方字幕服务连接失败或超时，请稍后重试，或手动粘贴文字稿。')
    throw error
  }
}
