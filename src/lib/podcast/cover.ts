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

type Viewer = { userId: number; inviteCodeId: number | null; isAdmin: boolean }

// AI 封面复用 Gemini 语音的密钥与授权链（own / member / grant / admin），
// 但不占用节目额度：一张封面不是一期节目。
export async function resolveGeminiImageKey(user: Viewer): Promise<string> {
  const access = await availableTtsAccess(user, Platform.Gemini)
  if (access.error) throw new Error(`AI 封面需要 Gemini API：${access.error}`)
  if (access.source === 'own') return getUserSetting(user.userId, 'GEMINI_TTS_API_KEY')
  if (access.source === 'member' && access.ownerUserId) return getUserSetting(access.ownerUserId, 'GEMINI_TTS_API_KEY')
  return getSetting('GEMINI_TTS_API_KEY')
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

export async function generateCover(user: Viewer, task: Task, hint?: string): Promise<string> {
  const apiKey = await resolveGeminiImageKey(user)
  const model = (await getSetting('GEMINI_IMAGE_MODEL')) || DEFAULT_IMAGE_MODEL
  const audioInput = taskGetStepItem(task, PodcastStep.Audio)?.input as LongTextResult | undefined
  const title = audioInput?.title || (task.userInputs as { text?: string } | null)?.text?.slice(0, 48) || '驿·声笺'
  const outline = audioInput?.outline || ''
  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model,
    contents: buildCoverPrompt(title, outline, hint),
    config: { responseModalities: ['IMAGE'] },
  })
  const part = response.candidates?.[0]?.content?.parts?.find(item => item.inlineData?.data)
  if (!part?.inlineData?.data) {
    const reason = response.promptFeedback?.blockReason || response.candidates?.[0]?.finishReason
    throw new Error(reason ? `模型没有返回图片（${reason}）` : '模型没有返回图片，请换个描述再试')
  }
  const mimeType = part.inlineData.mimeType || 'image/png'
  const extension = COVER_TYPES[mimeType] || 'png'
  const bytes = Buffer.from(part.inlineData.data, 'base64')
  if (bytes.length > COVER_MAX_BYTES) throw new Error('生成的图片过大，请重试')
  return replaceCover(task, bytes, mimeType, extension)
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
