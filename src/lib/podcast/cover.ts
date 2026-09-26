import 'server-only'
import { GoogleGenAI } from '@google/genai'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { tasksTable } from '@/db/schema'
import type { Task } from '@/db/types'
import { availableTtsAccess } from '@/lib/api-access'
import { getSetting, getUserSetting } from '@/lib/settings'
import { Platform, PodcastStep } from './types'
import { taskGetStepItem } from './task'
import { removeCover, storeCover } from './storage'
import type { LongTextResult } from '@/queue/types'

export const COVER_MAX_BYTES = 3_000_000
export const COVER_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image'
export type CoverProvider = 'minimax' | 'gemini'

type Viewer = { userId: number; inviteCodeId: number | null; isAdmin: boolean }

// 复用用户选定平台的密钥及其已有授权链，不把密钥传给浏览器。
export async function resolveImageKey(user: Viewer, provider: CoverProvider): Promise<string> {
  const platform = provider === 'minimax' ? Platform.Minimax : Platform.Gemini
  const key = provider === 'minimax' ? 'MINIMAX_TOKEN' : 'GEMINI_TTS_API_KEY'
  const access = await availableTtsAccess(user, platform)
  if (access.error) throw new Error(`${provider === 'minimax' ? 'MiniMax' : 'Gemini'} 封面 API 不可用：${access.error}`)
  if (access.source === 'own') return getUserSetting(user.userId, key)
  if (access.source === 'member' && access.ownerUserId) return getUserSetting(access.ownerUserId, key)
  return getSetting(key)
}

export function buildCoverPrompt(title: string, outline: string, hint?: string): string {
  const summary = outline.replace(/[#*`>-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600)
  return [
    '为一期中文播客节目设计一张方形封面插画。',
    `节目标题：${title}。`,
    summary ? `节目内容摘要：${summary}。` : '',
    hint ? `额外要求：${hint}。` : '',
    '风格：现代扁平插画或抽象几何，主色调为深蓝与青绿，纸质感浅色背景，构图简洁留白。',
    '画面里不要出现任何文字、字母、数字、水印或 logo。不要出现真实人物面孔。',
  ].filter(Boolean).join(' ')
}

export async function generateCover(user: Viewer, task: Task, hint?: string, provider: CoverProvider = 'minimax'): Promise<string> {
  const apiKey = await resolveImageKey(user, provider)
  const audioInput = taskGetStepItem(task, PodcastStep.Audio)?.input as LongTextResult | undefined
  const title = audioInput?.title || (task.userInputs as { text?: string } | null)?.text?.slice(0, 48) || '驿·声笺'
  const outline = audioInput?.outline || ''
  const prompt = buildCoverPrompt(title, outline, hint)
  const bytes = provider === 'minimax' ? await generateMiniMaxImage(apiKey, prompt) : await generateGeminiImage(apiKey, prompt)
  const mimeType = sniffImageType(bytes)
  if (!mimeType) throw new Error('图片模型返回了不支持的格式')
  if (bytes.length > COVER_MAX_BYTES) throw new Error('生成的图片超过 3 MB，请重试')
  return replaceCover(task, bytes, mimeType, COVER_TYPES[mimeType])
}

async function generateMiniMaxImage(apiKey: string, prompt: string): Promise<Buffer> {
  const response = await fetch('https://api.minimax.cn/v1/image_generation', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'image-01', prompt: prompt.slice(0, 1500), aspect_ratio: '1:1', response_format: 'base64', n: 1 }),
    signal: AbortSignal.timeout(45_000),
  })
  const result = await response.json().catch(() => null) as {
    data?: { image_base64?: string[] }; base_resp?: { status_code?: number; status_msg?: string }
  } | null
  if (!response.ok || result?.base_resp?.status_code !== 0) {
    const code = result?.base_resp?.status_code
    if (code === 1008) throw new Error('MiniMax 图片 API 余额不足，请检查账户余额或套餐权益')
    if (code === 1002) throw new Error('MiniMax 图片 API 请求过于频繁，请稍后再试')
    if (code === 1004 || code === 2049) throw new Error('MiniMax API Key 无效，请检查设置')
    throw new Error(`MiniMax 图片生成失败：${String(result?.base_resp?.status_msg || `HTTP ${response.status}`).slice(0, 160)}`)
  }
  const encoded = result.data?.image_base64?.[0]
  if (!encoded) throw new Error('MiniMax 没有返回图片，请换个描述再试')
  return Buffer.from(encoded.replace(/^data:image\/[^;]+;base64,/, ''), 'base64')
}

async function generateGeminiImage(apiKey: string, prompt: string): Promise<Buffer> {
  const model = (await getSetting('GEMINI_IMAGE_MODEL')) || DEFAULT_IMAGE_MODEL
  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { responseModalities: ['IMAGE'] },
  })
  const part = response.candidates?.[0]?.content?.parts?.find(item => item.inlineData?.data)
  if (!part?.inlineData?.data) {
    const reason = response.promptFeedback?.blockReason || response.candidates?.[0]?.finishReason
    throw new Error(reason ? `模型没有返回图片（${reason}）` : '模型没有返回图片，请换个描述再试')
  }
  return Buffer.from(part.inlineData.data, 'base64')
}

export async function replaceCover(task: Task, bytes: Buffer, mimeType: string, extension: string): Promise<string> {
  const filename = `${task.uuid}-${Date.now().toString(36)}.${extension}`
  const location = await storeCover(filename, bytes, mimeType)
  await getDb().update(tasksTable).set({ coverLocation: location, updatedAt: new Date() }).where(eq(tasksTable.id, task.id))
  if (task.coverLocation && task.coverLocation !== location) await removeCover(task.coverLocation).catch(() => undefined)
  return location
}

// 只认真实图片头，不信任上传声明的 content-type。
export function sniffImageType(bytes: Buffer): string | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes.toString('ascii', 1, 4) === 'PNG') return 'image/png'
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}
