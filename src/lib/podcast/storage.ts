import 'server-only'
import fs from 'fs/promises'
import path from 'path'

const BUCKET = 'podcast-audio'

function storageConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required for audio storage')
  return { url, key }
}

export async function storeAudio(filename: string, audio: Buffer): Promise<string> {
  if (process.env.NODE_ENV !== 'production' && !process.env.SUPABASE_URL) {
    const dir = path.join(process.cwd(), 'public', 'assets', 'audio')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, filename), audio)
    return `/assets/audio/${filename}`
  }
  const { url, key } = storageConfig()
  const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'audio/mpeg', 'x-upsert': 'true' },
    body: new Uint8Array(audio),
  })
  if (!response.ok) throw new Error(`Audio upload failed (${response.status}): ${(await response.text()).slice(0, 200)}`)
  return `supabase:${filename}`
}

export async function getAudioUrl(location: string): Promise<string> {
  if (!location?.startsWith('supabase:')) return location
  const { url, key } = storageConfig()
  const filename = location.slice('supabase:'.length)
  const response = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json' },
    body: JSON.stringify({ expiresIn: 24 * 60 * 60 }),
  })
  if (!response.ok) throw new Error(`Audio URL signing failed (${response.status})`)
  const data = await response.json()
  return new URL(data.signedURL, url).toString()
}

export async function readAudio(filename: string): Promise<Buffer> {
  const { url, key } = storageConfig()
  const response = await fetch(`${url}/storage/v1/object/authenticated/${BUCKET}/${encodeURIComponent(filename)}`, {
    headers: { authorization: `Bearer ${key}`, apikey: key },
  })
  if (!response.ok) throw new Error(`Audio download failed (${response.status})`)
  return Buffer.from(await response.arrayBuffer())
}

export async function removeAudio(files: string[]): Promise<void> {
  if (!files.length) return
  const { url, key } = storageConfig()
  const response = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes: files }),
  })
  if (!response.ok) throw new Error(`Audio cleanup failed (${response.status})`)
}
