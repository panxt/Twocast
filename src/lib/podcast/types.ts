export type AudioOutput = {
  location: string;
  duration: number;
  timedScript?: { role: string; text: string; startMs: number }[];
}

export interface AudioResult {
  audio: Buffer;
  format: string;
  duration?: number;
  timedScript?: { role: string; text: string; startMs: number }[];
}

export enum PodcastInputType {
  Topic = 'topic',
  Link = 'link',
  File = 'file',
  LongText = 'long-text',
  FrontPage = 'front-page',
}

export type TaskUserInput = {
  type: PodcastInputType
  text?: string
  platform?: string
  voice_id_1?: string
  voice_id_2?: string
  language?: string
  fileName?: string
  fileLocation?: string
  apiAccess?: { llm: 'own' | 'grant' | 'admin'; tts: 'own' | 'grant' | 'admin' }
  reservedGrantIds?: number[]
}

export enum PodcastStep {
  Topic = 'topic',
  Link = 'link',
  File = 'file',
  LongText = 'long-text',
  FrontPage = 'front-page',
  Script = 'script',
  Audio = 'audio',
  Test = 'test',
}

export type StepsDetailItem = {
  error?: string
  try_count?: number
  updated_at?: Date
  output?: any
  input?: any
}

export enum Platform {
  Minimax = 'minimaxi',
  Gemini = 'gemini',
  FishAudio = 'fish_audio',
}

export type VoiceOption = {
  id: string
  speed?: number
  volume?: number
}

export type ScriptItem = {
  text: string
  role: string
  audio_bytes?: Buffer
}
