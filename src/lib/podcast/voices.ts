import type { ScriptItem, TaskUserInput } from './types'

export type SpeakerCount = 1 | 2

// 一期节目几个人说话：默认两人对谈；单人讲述时所有台词都归主持人 A。
export function speakerCount(inputs: Pick<TaskUserInput, 'speakers'> | null | undefined): SpeakerCount {
  return inputs?.speakers === 1 ? 1 : 2
}

export type VoiceMap = { host: string; guest: string }

export function voiceMapFor(inputs: Pick<TaskUserInput, 'speakers' | 'voice_id_1' | 'voice_id_2'>): VoiceMap {
  const host = inputs.voice_id_1 || ''
  const guest = speakerCount(inputs) === 1 ? host : inputs.voice_id_2 || host
  return { host, guest }
}

// 按角色而不是按行号奇偶分配声音：模型连着输出两句同一角色时，声音不会串。
export function voiceForRole(role: string | undefined, voices: VoiceMap): string {
  return role === 'guest' ? voices.guest : voices.host
}

// 脚本里没有嘉宾台词，就是单人讲述（兼容旧数据没有 speakers 字段的情况）。
export function isSoloScript(script: Pick<ScriptItem, 'role'>[] | undefined | null): boolean {
  return Boolean(script?.length) && !script!.some(line => line.role === 'guest')
}
