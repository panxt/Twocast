import { Platform } from './podcast/types'

export const TTS_CAPABILITIES = {
  [Platform.Minimax]: 'tts:minimaxi',
  [Platform.FishAudio]: 'tts:fish_audio',
  [Platform.Gemini]: 'tts:gemini',
} as const

export type TtsCapability = typeof TTS_CAPABILITIES[Platform]
export type ShareCapability = 'llm' | TtsCapability

export const SHARE_CAPABILITIES: readonly ShareCapability[] = [
  'llm', 'tts:minimaxi', 'tts:fish_audio', 'tts:gemini',
]

export const CAPABILITY_LABELS: Record<ShareCapability, string> = {
  llm: '大模型',
  'tts:minimaxi': 'MiniMax 语音',
  'tts:fish_audio': 'Fish Audio 语音',
  'tts:gemini': 'Gemini 语音',
}

export function isShareCapability(value: unknown): value is ShareCapability {
  return typeof value === 'string' && SHARE_CAPABILITIES.includes(value as ShareCapability)
}
