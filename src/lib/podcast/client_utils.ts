import { multiTextLength } from '@/utils/text'
import { Platform, ScriptItem } from './types'

export function getPlatformDefaultVoices(
  lang?: string
): Record<Platform | string, { voiceId_1: string; voiceId_2: string }> {
  const platformDefaultVoices = {
    [Platform.FishAudio]: {
      voiceId_1: 'c7cbda1c101c4ce8906c046f01eca1a2',
      voiceId_2: '5c353fdb312f4888836a9a5680099ef0',
    },
    [Platform.FishAudio + '_custom']: {
      voiceId_1: 'c7cbda1c101c4ce8906c046f01eca1a2',
      voiceId_2: '5c353fdb312f4888836a9a5680099ef0',
    },
    [Platform.ElevenLabs]: { voiceId_1: 'JBFqnCBsd6RMkjVDRZzb', voiceId_2: 'EXAVITQu4vr4xnSDxMaL' },
    [Platform.Gemini]: { voiceId_1: 'Puck', voiceId_2: 'Kore' },
    [Platform.Minimax]: {
      voiceId_1: 'Chinese (Mandarin)_Stubborn_Friend',
      voiceId_2: 'Arrogant_Miss',
    },
  }
  if (lang == 'en') {
    platformDefaultVoices[Platform.FishAudio].voiceId_1 = '802e3bc2b27e49c2995d23ef70e6ac89'
    platformDefaultVoices[Platform.FishAudio].voiceId_2 = 'b545c585f631496c914815291da4e893'
    platformDefaultVoices[Platform.FishAudio + '_custom'].voiceId_1 =
      '802e3bc2b27e49c2995d23ef70e6ac89'
    platformDefaultVoices[Platform.FishAudio + '_custom'].voiceId_2 =
      'b545c585f631496c914815291da4e893'
  }
  return platformDefaultVoices
}

export function getPlatformConcurrencies(): Record<Platform | string, number> {
  const platformConcurrencies = {
    [Platform.FishAudio]: 5,
    [Platform.FishAudio + '_custom']: 5,
    [Platform.ElevenLabs]: 1,
    [Platform.Gemini]: 1,
    [Platform.Minimax]: 1,
  }
  return platformConcurrencies
}

export function getScriptLength(script: ScriptItem[]) {
  const text = script.map((item) => item.text).join('')
  const { cntChar, cntByte, cntMergedChar } = multiTextLength(text)
  return { cntChar, cntByte, cntMergedChar }
}
